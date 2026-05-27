"""Write regenerated schema and chart documents into the temporary staging database."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pymongo.database import Database

from pipeline.config import RebuildConfig
from pipeline.identity import build_identity_fields


def now_iso() -> str:
    """Return current UTC timestamp in ISO format for metadata documents.

    Returns:
        ISO 8601 timestamp string.
    """
    return datetime.now(timezone.utc).isoformat()


def stage_schema(
    temp_db: Database,
    config: RebuildConfig,
    cluster_name: str,
    subcluster_name: str,
    proposed_schema: dict[str, Any],
) -> None:
    """Insert the proposed OLAP schema into the temp olap_schemas collection.

    Args:
        temp_db: Process-scoped staging database.
        config: Rebuild configuration.
        cluster_name: Target cluster label.
        subcluster_name: Target subcluster id.
        proposed_schema: Validated schema body (facts, dimensions).
    """
    temp_db[config.schemas_collection].insert_one({
        **build_identity_fields(cluster_name, subcluster_name),
        **proposed_schema,
    })


def stage_chart_config(
    temp_db: Database,
    config: RebuildConfig,
    chart_config_doc: dict[str, Any],
) -> None:
    """Insert the generated chart config into the temp chart_configs collection.

    Args:
        temp_db: Process-scoped staging database.
        config: Rebuild configuration.
        chart_config_doc: Full chart_configs document (cluster_label, sc_id, olap_schema, chart, metadata).
    """
    temp_db[config.chart_configs_collection].insert_one(chart_config_doc)


def stage_metadata(
    temp_db: Database,
    config: RebuildConfig,
    cluster_name: str,
    subcluster_name: str,
) -> None:
    """Insert charts metadata stub into the temp charts_metadata collection.

    Args:
        temp_db: Process-scoped staging database.
        config: Rebuild configuration.
        cluster_name: Target cluster label.
        subcluster_name: Target subcluster id.
    """
    temp_db[config.charts_meta_collection].insert_one({
        **build_identity_fields(cluster_name, subcluster_name),
        "schema_version": 1,
        "generated_at": now_iso(),
    })
