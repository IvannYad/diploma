
from __future__ import annotations

from typing import Any

from pymongo.database import Database

from pipeline.config import RebuildConfig


def delete_old_configs(db: Database, config: RebuildConfig, identity_filter: dict[str, Any]) -> None:
    """Remove existing schema, chart, and metadata documents for the target subcluster.

    Args:
        db: Main MongoDB database.
        config: Rebuild configuration (collection names).
        identity_filter: Query from build_cluster_subcluster_filter.
    """
    db[config.schemas_collection].delete_many(identity_filter)
    db[config.chart_configs_collection].delete_many(identity_filter)
    db[config.charts_meta_collection].delete_many(identity_filter)


def copy_from_temp(
    main_db: Database,
    temp_db: Database,
    config: RebuildConfig,
    identity_filter: dict[str, Any],
) -> None:
    """Insert staged documents from temp_db into main_db for the subcluster.

    Args:
        main_db: Production MongoDB database.
        temp_db: Process-scoped staging database.
        config: Rebuild configuration.
        identity_filter: Query matching the staged documents in temp collections.
    """
    schema_doc = temp_db[config.schemas_collection].find_one(identity_filter)
    if schema_doc:
        schema_doc.pop("_id", None)
        main_db[config.schemas_collection].insert_one(schema_doc)

    chart_config = temp_db[config.chart_configs_collection].find_one(identity_filter)
    if chart_config:
        chart_config.pop("_id", None)
        main_db[config.chart_configs_collection].insert_one(chart_config)

    meta_doc = temp_db[config.charts_meta_collection].find_one(identity_filter)
    if meta_doc:
        meta_doc.pop("_id", None)
        main_db[config.charts_meta_collection].insert_one(meta_doc)
