"""Stage 4: generate interactive chart configuration per OLAP subcluster."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any

from pymongo import UpdateOne
from pymongo.database import Database

from pipeline.config import PipelineConfig
from pipeline.llm import LlmClient
from pipeline.progress import PipelineProgress
from pipeline.stages.chart_configs.builders import build_v3_chart_config
from pipeline.stages.chart_configs.llm_chart import generate_chart_with_llm
from pipeline.stages.chart_configs.persistence import persist_chart_configs
from pipeline.stages.chart_configs.rules import rule_select_chart_type
from pipeline.stages.chart_configs.validation import validate_chart_config
from pipeline.stages.chart_configs.x_axis import detect_x_axis_strategy

logger = logging.getLogger(__name__)

MAX_CHART_WORKERS = 20


def _generate_chart_for_target(
    cluster_label: str,
    sc_id: str,
    schema: dict[str, Any],
    article_count: int,
    num_records: int,
    sample_records: list[dict[str, Any]],
    llm: LlmClient,
    model_name: str,
    progress: PipelineProgress,
) -> dict[str, Any] | None:
    """Build one chart config payload for a subcluster via LLM with rule-based fallback.

    All inputs are read-only; no shared mutable state is accessed. Safe to run concurrently.

    Args:
        cluster_label: Parent cluster label.
        sc_id: Subcluster identifier.
        schema: OLAP schema for this subcluster.
        article_count: Number of articles in the subcluster.
        num_records: Total extracted records count.
        sample_records: Up to 20 sample OLAP rows for LLM context.
        llm: OpenAI client (thread-safe).
        model_name: Model identifier string for metadata.
        progress: Progress tracker (``update`` and ``info`` called from worker threads).

    Returns:
        Fully assembled payload dict ready for MongoDB upsert, or None if the schema
        has no facts and should be skipped.
    """
    if not isinstance(schema, dict):
        progress.update(1)
        return None

    facts = schema.get("facts", [])
    if not facts:
        progress.update(1)
        return None

    x_axis = detect_x_axis_strategy(schema)
    chart_type, chart_justification = rule_select_chart_type(schema, article_count, x_axis)
    default_chart = build_v3_chart_config(schema, chart_type, chart_justification, x_axis)

    used_fallback = False
    try:
        chart = generate_chart_with_llm(
            llm=llm,
            schema=schema,
            x_axis=x_axis,
            rule_chart_type=chart_type,
            rule_justification=chart_justification,
            sample_records=sample_records,
        )
        if not isinstance(chart, dict):
            chart = default_chart
            used_fallback = True
    except Exception:
        logger.exception(
            "LLM chart config failed for cluster=%s sc_id=%s; using fallback",
            cluster_label,
            sc_id,
        )
        chart = default_chart
        used_fallback = True

    chart, validation_issues = validate_chart_config(chart, schema, x_axis)
    if used_fallback:
        validation_issues = ["FALLBACK: default v3 rule-based chart used", *validation_issues]

    payload = {
        "cluster_label": cluster_label,
        "sc_id": sc_id,
        "olap_schema": {
            "table_description": schema.get("table_description", ""),
            "facts": schema.get("facts", []),
            "dimensions": schema.get("dimensions", []),
        },
        "chart": chart,
        "metadata": {
            "cluster_label": cluster_label,
            "subcluster_id": sc_id,
            "num_articles": article_count,
            "num_records": num_records,
            "rule_chart_type": chart_type,
            "final_chart_type": chart.get("chart_type", chart_type),
            "rag_enabled": False,
            "pdf_sources_count": 0,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "model": f"{model_name}:v3-llm",
            "validation_issues": validation_issues,
            "used_fallback": used_fallback,
        },
    }
    progress.update(1)
    return payload


def run_chart_configs(
    db: Database,
    config: PipelineConfig,
    llm: LlmClient,
    progress: PipelineProgress,
    stage_index: int,
) -> dict[str, Any]:
    """Build one chart config per subcluster via LLM with rule-based fallback and validation.

    Chart generation for each subcluster is independent, so all targets are processed in
    parallel using a thread pool (up to MAX_CHART_WORKERS workers). Results are collected
    on the main thread before the final bulk MongoDB write.

    Args:
        db: MongoDB database handle.
        config: Pipeline configuration.
        llm: OpenAI client.
        progress: Progress tracker (one step per subcluster).
        stage_index: 1-based stage index.

    Returns:
        Summary with generated count, LLM call stats, and schema version.
    """
    schemas_doc = db[config.schemas_collection].find_one({"source": "olap_schemas"}, {"_id": 0}) or {}
    schemas = schemas_doc.get("schemas", {})

    targets: list[tuple[str, str, dict[str, Any]]] = []
    for cluster_label, subclusters in schemas.items():
        for sc_id, schema in subclusters.items():
            targets.append((cluster_label, sc_id, schema))

    extracted_docs = list(
        db[config.extracted_collection].find(
            {},
            {
                "_id": 0,
                "cluster_label": 1,
                "sc_id": 1,
                "metadata": 1,
                "articles.article_id": 1,
                "articles.records": 1,
            },
        )
    )
    extracted_meta_map: dict[tuple[str, str], dict[str, Any]] = {}
    sample_records_map: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for doc in extracted_docs:
        key = (str(doc.get("cluster_label", "")), str(doc.get("sc_id", "")))
        extracted_meta_map[key] = doc.get("metadata", {})
        sample_records: list[dict[str, Any]] = []
        for article in (doc.get("articles", []) or []):
            if not isinstance(article, dict):
                continue
            article_id = str(article.get("article_id", ""))
            for rec in (article.get("records", []) or []):
                if not isinstance(rec, dict):
                    continue
                enriched = {"article_id": article_id, **rec}
                sample_records.append(enriched)
                if len(sample_records) >= 20:
                    break
            if len(sample_records) >= 20:
                break
        sample_records_map[key] = sample_records

    progress.start_stage(stage_index, "Generating chart configs", len(targets))

    updates: list[UpdateOne] = []
    charts_meta: dict[str, dict[str, Any]] = {}
    llm_calls = 0
    llm_fallbacks = 0

    workers = min(MAX_CHART_WORKERS, max(1, len(targets)))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(
                _generate_chart_for_target,
                cluster_label,
                sc_id,
                schema,
                int(extracted_meta_map.get((cluster_label, sc_id), {}).get("num_articles", 0) or 0),
                int(extracted_meta_map.get((cluster_label, sc_id), {}).get("num_records", 0) or 0),
                sample_records_map.get((cluster_label, sc_id), []),
                llm,
                config.model_name,
                progress,
            ): (cluster_label, sc_id)
            for cluster_label, sc_id, schema in targets
        }
        for future in as_completed(futures):
            cluster_label, sc_id = futures[future]
            payload = future.result()
            if payload is None:
                continue

            used_fallback = payload["metadata"].pop("used_fallback")
            if used_fallback:
                llm_fallbacks += 1
            else:
                llm_calls += 1

            updates.append(
                UpdateOne(
                    {"cluster_label": cluster_label, "sc_id": sc_id},
                    {"$set": payload},
                    upsert=True,
                )
            )
            charts_meta.setdefault(cluster_label, {})[sc_id] = payload["chart"]

    persist_chart_configs(db, config, updates, charts_meta, llm_calls)

    summary = {
        "generated": len(updates),
        "targetCollection": config.chart_configs_collection,
        "schemaVersion": "3.1",
        "generator": "chart-type-selection-v3-llm",
        "llmCalls": llm_calls,
        "llmFallbacks": llm_fallbacks,
    }
    progress.complete_stage(summary)
    return summary
