"""Stage 3: atomically replace main-database configs from the temp staging database."""

from __future__ import annotations

import logging

from pymongo.database import Database

from pipeline.config import RebuildConfig
from pipeline.identity import build_cluster_subcluster_filter
from pipeline.progress import PipelineProgress
from pipeline.stages.finalize_rebuild.persistence import copy_from_temp, delete_old_configs

logger = logging.getLogger(__name__)


def run_finalize_rebuild(
    db: Database,
    temp_db: Database,
    config: RebuildConfig,
    progress: PipelineProgress,
    cluster_name: str,
    subcluster_name: str,
) -> bool:
    """Delete old subcluster configs on main DB and copy staged documents from temp_db.

    Args:
        db: Main MongoDB database.
        temp_db: Staging database with regenerated documents.
        config: Rebuild configuration.
        progress: Progress tracker for stage 2 (three substeps).
        cluster_name: Target cluster_label.
        subcluster_name: Target sc_id.

    Returns:
        True if delete and copy succeeded, False on error.
    """
    progress.start_stage(2, "Finalize Rebuild", 3)

    try:
        identity_filter = build_cluster_subcluster_filter(cluster_name, subcluster_name)

        progress.update(1, "Removing old configuration files")
        delete_old_configs(db, config, identity_filter)
        logger.info("Deleted old configs for %s/%s", cluster_name, subcluster_name)
        progress.update(1, "Old files removed")

        progress.update(1, "Copying new configuration files")
        copy_from_temp(db, temp_db, config, identity_filter)
        logger.info("Copied new configs for %s/%s", cluster_name, subcluster_name)
        progress.update(1, "New files copied to main database")

        progress.complete_stage({
            "status": "success",
            "cluster": cluster_name,
            "subcluster": subcluster_name,
            "temp_db_name": temp_db.name,
        })

        return True

    except Exception as exc:
        logger.exception("Finalize rebuild error")
        progress.pipeline_error(str(exc))
        return False
