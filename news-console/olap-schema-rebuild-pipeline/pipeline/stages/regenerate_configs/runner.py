"""Stage 2: build schema and chart config in the temp database before finalize."""

from __future__ import annotations

import logging
from typing import Any

from pymongo.database import Database

from pipeline.config import RebuildConfig
from pipeline.llm import LlmClient
from pipeline.progress import PipelineProgress
from pipeline.stages.regenerate_configs.document import build_chart_config_document
from pipeline.stages.regenerate_configs.staging import stage_chart_config, stage_metadata, stage_schema

logger = logging.getLogger(__name__)


def run_regenerate_configs(
    db: Database,
    temp_db: Database,
    config: RebuildConfig,
    llm: LlmClient,
    progress: PipelineProgress,
    cluster_name: str,
    subcluster_name: str,
    proposed_schema: dict[str, Any],
) -> bool:
    """Generate chart config and stage schema, chart, and metadata in temp_db.

    Args:
        db: Main MongoDB database (for reading extracted_news samples).
        temp_db: Staging database (olap_rebuild_{process_id}).
        config: Rebuild configuration.
        llm: LLM client (passed to chart builder for future use).
        progress: Progress tracker for stage 1.
        cluster_name: Target cluster_label.
        subcluster_name: Target sc_id.
        proposed_schema: Validated proposed OLAP schema.

    Returns:
        True if staging succeeded, False on error (progress.pipeline_error emitted).
    """
    progress.start_stage(1, "Regenerate Configurations", 1)

    try:
        stage_schema(temp_db, config, cluster_name, subcluster_name, proposed_schema)
        progress.update(message="Schema stored in temp database")

        _ = llm
        chart_config_doc = build_chart_config_document(
            db=db,
            config=config,
            cluster_name=cluster_name,
            subcluster_name=subcluster_name,
            schema=proposed_schema,
        )

        stage_chart_config(temp_db, config, chart_config_doc)
        progress.update(message="Chart configuration generated")

        stage_metadata(temp_db, config, cluster_name, subcluster_name)

        progress.complete_stage({"status": "success", "files_generated": 2})
        return True

    except Exception as exc:
        logger.exception("Regenerate configs error")
        progress.pipeline_error(str(exc))
        return False
