
from __future__ import annotations

import logging
from typing import Any

from pipeline.callbacks import (
    build_progress_handler,
    derive_progress_endpoint,
    send_completion_callback,
)
from pipeline.config import PipelineConfig
from pipeline.llm import LlmClient
from pipeline.logging_setup import setup_logging
from pipeline.mongo_utils import create_client, resolve_database_name
from pipeline.orchestration.cli import parse_args, resolve_backend_env, resolve_credentials
from pipeline.orchestration.stage_spec import StageSpec
from pipeline.progress import PipelineProgress
from pipeline.stages import (
    run_chart_configs,
    run_cluster_news,
    run_extract_tables,
    run_prepare_news,
)
from pipeline.timing import PipelineTimingRecorder

logger = logging.getLogger(__name__)


def _build_stage_specs(skip_charts: bool) -> list[StageSpec]:
    """Define the ordered list of stages for this run.

    Args:
        skip_charts: If True, omit the chart_configs stage.

    Returns:
        Stage specifications in execution order.
    """
    specs = [
        StageSpec("prepare_news", run_prepare_news, False),
        StageSpec("cluster_news", run_cluster_news, True),
        StageSpec("extract_tables", run_extract_tables, True),
    ]
    if not skip_charts:
        specs.append(StageSpec("chart_configs", run_chart_configs, True))
    return specs


def _run_stage(
    spec: StageSpec,
    db: Any,
    config: PipelineConfig,
    llm: LlmClient,
    progress: PipelineProgress,
    stage_index: int,
) -> dict[str, Any]:
    """Invoke one stage runner with or without LlmClient depending on spec.

    Args:
        spec: Stage metadata and runner callable.
        db: MongoDB database handle.
        config: Pipeline configuration.
        llm: Shared LLM client for stages that need it.
        progress: Progress emitter for this run.
        stage_index: 1-based stage index.

    Returns:
        Stage summary dictionary returned by the runner.
    """
    if spec.needs_llm:
        return spec.runner(db, config, llm, progress, stage_index)
    return spec.runner(db, config, progress, stage_index)


def _save_pipeline_timing(
    timing: PipelineTimingRecorder,
    db: Any,
    config: PipelineConfig,
    *,
    status: str,
    error: str | None = None,
    failed_stage: str | None = None,
) -> None:
    """Write timing document to MongoDB.

    Args:
        timing: Recorder with completed stage entries.
        db: MongoDB database handle.
        config: Pipeline configuration (timing collection name).
        status: success or failed.
        error: Optional failure message.
        failed_stage: Stage name where failure occurred.
    """
    document = timing.build_document(status=status, error=error, failed_stage=failed_stage)
    timing.save(db, config.pipeline_timing_collection, document)
    logger.info(
        "Pipeline timing saved to %s (status=%s, total=%ss, stages=%d)",
        config.pipeline_timing_collection,
        status,
        document["duration_seconds"],
        len(document.get("stages", [])),
    )


def main() -> int:
    """Run the full news processing pipeline and return a process exit code.

    Returns:
        0 on success, 1 on configuration error or stage failure.
    """
    args = parse_args()
    logger = setup_logging(args.log_file)
    logger.info("Pipeline starting. log_file=%s", args.log_file)

    mongo_uri, openai_token = resolve_credentials(args)
    process_id, callback_endpoint, progress_endpoint = resolve_backend_env()
    if not progress_endpoint:
        progress_endpoint = derive_progress_endpoint(callback_endpoint)

    if not mongo_uri:
        logger.error("MONGO_URI not provided")
        return 1

    if not openai_token:
        logger.error("OPENAI_API_KEY not provided")
        return 1

    db_name = resolve_database_name(mongo_uri, args.db_name)
    logger.info("Using MongoDB database: %s", db_name)

    config = PipelineConfig(
        mongo_uri=mongo_uri,
        openai_token=openai_token,
        db_name=db_name,
        source_collection=args.source_collection,
        batch_size=args.batch_size,
        model_name=args.model_name,
    )

    stage_specs = _build_stage_specs(args.skip_charts)
    progress = PipelineProgress(
        total_stages=len(stage_specs),
        on_event=build_progress_handler(process_id, progress_endpoint),
    )
    llm = LlmClient(api_key=config.openai_token, model_name=config.model_name)

    timing = PipelineTimingRecorder(
        pipeline="news_processing",
        process_id=process_id,
        metadata={
            "db_name": config.db_name,
            "model_name": config.model_name,
            "skip_charts": args.skip_charts,
        },
    )

    client = None
    db = None
    try:
        client = create_client(config.mongo_uri)
        db = client[config.db_name]
        db.command("ping")

        summary: dict[str, dict[str, Any]] = {}
        for idx, spec in enumerate(stage_specs, start=1):
            logger.info("Starting stage %d/%d: %s", idx, len(stage_specs), spec.name)
            timing.start_stage(spec.name, idx)
            try:
                result = _run_stage(spec, db, config, llm, progress, idx)
                elapsed = timing.end_stage(result)
                logger.info("Finished stage %s in %.3fs: %s", spec.name, elapsed, result)
                summary[spec.name] = result
            except Exception:
                timing.end_stage(status="failed")
                raise

        _save_pipeline_timing(timing, db, config, status="success")
        progress.pipeline_complete(summary)
        logger.info("Pipeline done.")
        client.close()

        if process_id and callback_endpoint:
            send_completion_callback(
                process_id,
                callback_endpoint,
                True,
                f"Pipeline completed. Processed {len(summary)} stages.",
            )

        return 0
    except Exception as exc:
        stage_name = progress.stage.name if progress.stage else None
        if stage_name is None and timing.stages:
            stage_name = str(timing.stages[-1].get("name", ""))
        error_msg = f"Pipeline failed at stage {stage_name}: {exc}"
        logger.exception(error_msg)
        progress.pipeline_error(stage_name, f"{exc}")

        if db is not None:
            _save_pipeline_timing(
                timing,
                db,
                config,
                status="failed",
                error=str(exc),
                failed_stage=stage_name,
            )

        if process_id and callback_endpoint:
            send_completion_callback(
                process_id,
                callback_endpoint,
                False,
                error_msg,
            )

        if client is not None:
            client.close()

        return 1
