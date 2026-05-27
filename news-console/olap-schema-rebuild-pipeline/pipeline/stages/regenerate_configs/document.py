
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pymongo.database import Database

from pipeline.config import RebuildConfig
from pipeline.stages.regenerate_configs.chart_builder import build_chart


def _extracted_stats(
    db: Database,
    config: RebuildConfig,
    cluster_name: str,
    subcluster_name: str,
) -> tuple[int, int]:
    """Read num_articles and num_records from extracted_news metadata.

    Args:
        db: Main MongoDB database.
        config: Rebuild configuration.
        cluster_name: Target cluster_label.
        subcluster_name: Target sc_id.

    Returns:
        Tuple of (num_articles, num_records).
    """
    extracted_doc = db[config.extracted_collection].find_one(
        {"cluster_label": cluster_name, "sc_id": subcluster_name},
        {"metadata": 1, "articles": 1},
    ) or {}
    metadata = extracted_doc.get("metadata") or {}
    num_articles = int(metadata.get("num_articles", 0) or 0)
    num_records = int(metadata.get("num_records", 0) or 0)
    if not num_articles:
        num_articles = len(extracted_doc.get("articles") or [])
    return num_articles, num_records


def build_chart_config_document(
    db: Database,
    config: RebuildConfig,
    cluster_name: str,
    subcluster_name: str,
    schema: dict[str, Any],
    *,
    validation_issues: list[str] | None = None,
) -> dict[str, Any]:
    """Build a chart_configs document matching news-processing-pipeline layout.

    Top-level keys: cluster_label, sc_id, olap_schema, chart, metadata.

    Args:
        db: Main MongoDB database (for extracted_news stats).
        config: Rebuild configuration.
        cluster_name: Target cluster_label.
        subcluster_name: Target sc_id.
        schema: Validated proposed OLAP schema.
        validation_issues: Optional validation notes stored in metadata.

    Returns:
        Full document ready for chart_configs collection.
    """
    chart, rule_chart_type = build_chart(
        db=db,
        config=config,
        cluster_name=cluster_name,
        subcluster_name=subcluster_name,
        schema=schema,
    )
    num_articles, num_records = _extracted_stats(db, config, cluster_name, subcluster_name)

    return {
        "cluster_label": cluster_name,
        "sc_id": subcluster_name,
        "olap_schema": {
            "table_description": schema.get("table_description", ""),
            "facts": schema.get("facts", []),
            "dimensions": schema.get("dimensions", []),
        },
        "chart": chart,
        "metadata": {
            "cluster_label": cluster_name,
            "subcluster_id": subcluster_name,
            "num_articles": num_articles,
            "num_records": num_records,
            "rule_chart_type": rule_chart_type,
            "final_chart_type": chart.get("chart_type", rule_chart_type),
            "rag_enabled": False,
            "pdf_sources_count": 0,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "model": f"{config.model_name}:v3-rebuild",
            "validation_issues": validation_issues or [],
        },
    }
