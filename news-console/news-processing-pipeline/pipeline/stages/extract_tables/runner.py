
from __future__ import annotations

from typing import Any

from pymongo.database import Database

from pipeline.config import PipelineConfig
from pipeline.llm import LlmClient
from pipeline.progress import PipelineProgress
from pipeline.stages.extract_tables.html_tables import parse_tables
from pipeline.stages.extract_tables.persistence import persist_extraction_results
from pipeline.stages.extract_tables.subclustering import process_cluster_articles


def run_extract_tables(
    db: Database,
    config: PipelineConfig,
    llm: LlmClient,
    progress: PipelineProgress,
    stage_index: int,
) -> dict[str, Any]:
    """Group clustered articles by label, subcluster by schema fit, extract OLAP rows, persist.

    Args:
        db: MongoDB database handle.
        config: Pipeline configuration.
        llm: OpenAI client for schema and extraction.
        progress: Progress tracker (start_stage may run twice when totals change).
        stage_index: 1-based stage index.

    Returns:
        Summary with subcluster counts and LLM call counters.
    """
    clustered = list(db[config.clustered_collection].find({}, {"_id": 0}))
    raw_news = list(
        db[config.source_collection].find({}, {"_id": 0, "id": 1, "title": 1, "date": 1, "full_body": 1})
    )
    raw_by_id = {str(doc.get("id", "")): doc for doc in raw_news}

    progress.start_stage(stage_index, "Extracting tables", max(1, len(clustered)))

    cluster_articles: dict[str, list[dict[str, Any]]] = {}

    for item in clustered:
        article_id = str(item.get("id", "")).strip()
        cluster_label = str(item.get("cluster_label", "unclassified"))
        raw = raw_by_id.get(article_id)

        if raw is None:
            continue

        parsed_tables = parse_tables(str(raw.get("full_body", "")))
        if not parsed_tables:
            continue

        primary = max(parsed_tables, key=lambda t: t["num_rows"])
        cluster_articles.setdefault(cluster_label, []).append(
            {
                "article_id": article_id,
                "title": raw.get("title"),
                "date": raw.get("date"),
                "table": primary,
            }
        )

    articles_with_tables = sum(len(v) for v in cluster_articles.values())
    progress.start_stage(stage_index, "Extracting tables", max(1, articles_with_tables))

    (
        extracted_docs,
        schemas,
        schema_calls,
        fit_calls,
        extraction_calls,
        fit_skips,
        deterministic_extractions,
    ) = process_cluster_articles(
        cluster_articles,
        llm,
        progress,
    )

    persist_extraction_results(db, config, extracted_docs, schemas)

    summary = {
        "subclusters": len(extracted_docs),
        "clusters": len(cluster_articles),
        "schemaLlmCalls": schema_calls,
        "schemaFitLlmCalls": fit_calls,
        "schemaFitSkipped": fit_skips,
        "extractionLlmCalls": extraction_calls,
        "deterministicExtractions": deterministic_extractions,
        "targetCollection": config.extracted_collection,
    }
    progress.complete_stage(summary)
    return summary
