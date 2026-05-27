
from __future__ import annotations

import json
import logging
from argparse import Namespace
from pymongo.database import Database

from pipeline.config import RebuildConfig
from pipeline.llm import LlmClient
from pipeline.mongo_utils import create_client, resolve_database_name
from pipeline.progress import PipelineProgress
from pipeline.rebuild.callbacks import (
    build_progress_handler,
    derive_progress_endpoint,
    send_completion_callback,
)
from pipeline.rebuild.schema_input import parse_proposed_schema
from pipeline.stages import (
    run_finalize_rebuild,
    run_regenerate_configs,
    run_validate_schema,
)
from pipeline.timing import PipelineTimingRecorder

logger = logging.getLogger(__name__)


def _save_pipeline_timing(
    timing: PipelineTimingRecorder,
    db: Database,
    config: RebuildConfig,
    *,
    status: str,
    error: str | None = None,
    failed_stage: str | None = None,
) -> None:
    """Write rebuild timing document to MongoDB.

    Args:
        timing: Recorder with completed stage entries.
        db: Main MongoDB database handle.
        config: Rebuild configuration (timing collection name).
        status: success or failed.
        error: Optional failure message.
        failed_stage: Stage name where failure occurred.
    """
    document = timing.build_document(status=status, error=error, failed_stage=failed_stage)
    timing.save(db, config.pipeline_timing_collection, document)
    logger.info(
        "Rebuild timing saved to %s (status=%s, total=%ss, stages=%d)",
        config.pipeline_timing_collection,
        status,
        document["duration_seconds"],
        len(document.get("stages", [])),
    )


def run_rebuild_pipeline(args: Namespace) -> int:
    """Execute the full OLAP schema rebuild for one cluster/subcluster pair.

    Stages: (1) LLM validation against sample extracted data, (2) regenerate schema
    and chart config into a temp database, (3) replace main DB documents for that subcluster.

    Args:
        args: Parsed CLI namespace (mongo, tokens, cluster, subcluster, schema JSON).

    Returns:
        0 on success, 1 on validation failure or any stage error.
    """
    logger.info("=" * 80)
    logger.info("OLAP Schema Rebuild Pipeline Started")
    logger.info("Process ID: %s", args.process_id)
    logger.info("Cluster: %s / Subcluster: %s", args.cluster, args.subcluster)
    logger.info("=" * 80)

    timing = PipelineTimingRecorder(
        pipeline="olap_schema_rebuild",
        process_id=args.process_id,
        metadata={
            "cluster": args.cluster,
            "subcluster": args.subcluster,
            "model_name": args.model,
        },
    )

    try:
        proposed_schema = parse_proposed_schema(args.schema)
    except json.JSONDecodeError as exc:
        logger.error("Invalid schema JSON: %s", exc)
        send_completion_callback(
            args.process_id,
            args.callback_endpoint,
            succeeded=False,
            message="Invalid schema JSON format",
        )
        return 1

    db_name = resolve_database_name(args.mongo_uri)
    logger.info("Using MongoDB database: %s", db_name)

    config = RebuildConfig(
        mongo_uri=args.mongo_uri,
        openai_token=args.openai_token,
        model_name=args.model,
        db_name=db_name,
    )

    main_db: Database | None = None
    try:
        mongo_client = create_client(config.mongo_uri)
        main_db = mongo_client[config.db_name]
        temp_db_name = f"olap_rebuild_{args.process_id}"
        temp_db = mongo_client[temp_db_name]
        llm = LlmClient(config.openai_token, config.model_name)

        progress_endpoint = derive_progress_endpoint(args.callback_endpoint)
        progress = PipelineProgress(
            total_stages=3,
            on_event=build_progress_handler(args.process_id, progress_endpoint),
        )

        logger.info("Starting Stage 1: Schema Validation")
        timing.start_stage("validate_schema", 1)
        is_valid, error_reason = run_validate_schema(
            db=main_db,
            config=config,
            llm=llm,
            progress=progress,
            cluster_name=args.cluster,
            subcluster_name=args.subcluster,
            proposed_schema=proposed_schema,
        )

        if not is_valid:
            elapsed = timing.end_stage(
                {"valid": False, "reason": error_reason},
                status="failed",
            )
            logger.warning("Schema validation failed in %.3fs: %s", elapsed, error_reason)
            _save_pipeline_timing(
                timing,
                main_db,
                config,
                status="failed",
                error=error_reason,
                failed_stage="validate_schema",
            )
            send_completion_callback(
                args.process_id,
                args.callback_endpoint,
                succeeded=False,
                message="Schema validation failed",
                validation_error=error_reason,
            )
            progress.pipeline_complete(
                {
                    "status": "validation_failed",
                    "reason": error_reason,
                }
            )
            return 1

        elapsed = timing.end_stage({"valid": True})
        logger.info("Schema validation passed in %.3fs", elapsed)

        logger.info("Starting Stage 2: Regenerate Configurations")
        timing.start_stage("regenerate_configs", 2)
        regen_success = run_regenerate_configs(
            db=main_db,
            temp_db=temp_db,
            config=config,
            llm=llm,
            progress=progress,
            cluster_name=args.cluster,
            subcluster_name=args.subcluster,
            proposed_schema=proposed_schema,
        )

        if not regen_success:
            elapsed = timing.end_stage({"success": False}, status="failed")
            logger.error("Regenerate configs failed after %.3fs", elapsed)
            _save_pipeline_timing(
                timing,
                main_db,
                config,
                status="failed",
                error="Failed to regenerate configuration files",
                failed_stage="regenerate_configs",
            )
            send_completion_callback(
                args.process_id,
                args.callback_endpoint,
                succeeded=False,
                message="Failed to regenerate configuration files",
            )
            return 1

        elapsed = timing.end_stage({"success": True})
        logger.info("Regenerate configs completed in %.3fs", elapsed)

        logger.info("Starting Stage 3: Finalize Rebuild")
        timing.start_stage("finalize_rebuild", 3)
        finalize_success = run_finalize_rebuild(
            db=main_db,
            temp_db=temp_db,
            config=config,
            progress=progress,
            cluster_name=args.cluster,
            subcluster_name=args.subcluster,
        )

        if not finalize_success:
            elapsed = timing.end_stage({"success": False}, status="failed")
            logger.error("Finalize rebuild failed after %.3fs", elapsed)
            _save_pipeline_timing(
                timing,
                main_db,
                config,
                status="failed",
                error="Failed to finalize rebuild",
                failed_stage="finalize_rebuild",
            )
            send_completion_callback(
                args.process_id,
                args.callback_endpoint,
                succeeded=False,
                message="Failed to finalize rebuild",
            )
            return 1

        elapsed = timing.end_stage({"success": True})
        logger.info("Finalize rebuild completed in %.3fs", elapsed)

        timing.metadata["temp_db"] = temp_db_name
        _save_pipeline_timing(timing, main_db, config, status="success")

        logger.info("=" * 80)
        logger.info("OLAP rebuild done")
        logger.info("Temp Database: %s", temp_db_name)
        logger.info("=" * 80)

        send_completion_callback(
            args.process_id,
            args.callback_endpoint,
            succeeded=True,
            message="Rebuild done",
        )

        progress.pipeline_complete(
            {
                "status": "success",
                "temp_db": temp_db_name,
            }
        )
        return 0
    except Exception as exc:
        logger.exception("Unexpected error in pipeline")
        if main_db is not None:
            failed_stage = timing.stages[-1]["name"] if timing.stages else None
            _save_pipeline_timing(
                timing,
                main_db,
                config,
                status="failed",
                error=str(exc),
                failed_stage=failed_stage,
            )
        send_completion_callback(
            args.process_id,
            args.callback_endpoint,
            succeeded=False,
            message=f"Unexpected error: {exc}",
        )
        return 1
