
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from pipeline.collections_utils import chunked
from pipeline.llm import LlmClient
from pipeline.progress import PipelineProgress
from pipeline.stages.extract_tables.date_dimension import (
    enrich_date_dimension,
    enrich_date_dimension_for_subcluster,
)
from pipeline.stages.extract_tables.extraction_deterministic import (
    extract_article_deterministic,
    extract_batch_with_deterministic_fallback,
)
from pipeline.stages.extract_tables.extraction_llm import extract_batch_llm, normalize_per_fact_records
from pipeline.stages.extract_tables.html_tables import build_records
from pipeline.stages.extract_tables.schema_fit import find_best_subcluster_for_article
from pipeline.stages.extract_tables.schema_infer import detect_target_language, infer_schema, validate_schema
from pipeline.stages.extract_tables.schema_llm import extract_schema_for_article_llm
from pipeline.stages.extract_tables.table_similarity import header_keys

logger = logging.getLogger(__name__)

MAX_EXTRACTION_WORKERS = 20


def _extract_subcluster(
    cluster_label: str,
    subcluster: dict[str, Any],
    llm: LlmClient,
    progress: PipelineProgress,
) -> tuple[dict[str, Any], int, int]:
    """Extract OLAP records for one subcluster and return the result document.

    Runs the date-dimension enrichment, iterates batches of articles with the
    deterministic-first / LLM-fallback strategy, and emits one progress tick per article.

    Args:
        cluster_label: Parent cluster label (for logging and the result document).
        subcluster: Subcluster dict with ``sc_id``, ``schema``, and ``articles``.
        llm: OpenAI client shared across threads (thread-safe via the openai SDK).
        progress: Progress tracker; ``update`` and ``info`` are called from worker threads.

    Returns:
        Tuple of (extracted_doc, deterministic_count, llm_batch_calls).
    """
    sc_id = str(subcluster["sc_id"])
    schema = subcluster["schema"]
    subcluster_articles = subcluster["articles"]

    subcluster_language = detect_target_language(subcluster_articles)
    enrich_date_dimension_for_subcluster(
        schema,
        subcluster_articles,
        target_language=subcluster_language,
    )
    progress.info(f"Extracting OLAP records for {cluster_label}/{sc_id}")

    articles_payload: list[dict[str, Any]] = []
    num_records = 0
    det_count_total = 0
    llm_calls_total = 0

    for batch in chunked(subcluster_articles, size=5):
        try:
            llm_records_by_article, det_count, llm_batches = extract_batch_with_deterministic_fallback(
                llm,
                schema,
                batch,
                extract_batch_llm,
            )
            det_count_total += det_count
            llm_calls_total += llm_batches
        except Exception:
            logger.exception(
                "extract_batch failed for cluster=%s sc_id=%s",
                cluster_label,
                sc_id,
            )
            llm_records_by_article = {}

        for article in batch:
            article_id = str(article.get("article_id", "")).strip()
            records = llm_records_by_article.get(article_id)
            if not records:
                records = extract_article_deterministic(article, schema)
            if not records:
                fallback = build_records(article.get("table", {}))
                records = [
                    nr
                    for r in fallback
                    for nr in normalize_per_fact_records(
                        r,
                        schema,
                        article_date=str(article.get("date", "")).strip() or None,
                    )
                ]
            num_records += len(records)
            articles_payload.append(
                {
                    "article_id": article_id,
                    "title": article.get("title"),
                    "date": article.get("date"),
                    "records": records,
                }
            )
            progress.update(1)

    extracted_doc = {
        "cluster_label": cluster_label,
        "sc_id": sc_id,
        "metadata": {
            "num_articles": len(subcluster_articles),
            "num_records": num_records,
        },
        "articles": articles_payload,
    }
    return extracted_doc, det_count_total, llm_calls_total


def process_cluster_articles(
    cluster_articles: dict[str, list[dict[str, Any]]],
    llm: LlmClient,
    progress: PipelineProgress,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], int, int, int, int, int]:
    """Run schema fit, new subcluster creation, and batched extraction for all clusters.

    Phase 1 (subclustering) is sequential: each article's assignment depends on the
    subcluster list that grows as prior articles are processed.

    Phase 2 (extraction) is parallelised across all subclusters from all clusters using
    a thread pool (up to MAX_EXTRACTION_WORKERS workers). Each subcluster is fully
    independent at this point, so no shared mutable state is accessed concurrently.

    Args:
        cluster_articles: Map of cluster_label to articles with parsed primary table.
        llm: OpenAI client.
        progress: Progress tracker (one update per article processed).

    Returns:
        Tuple of (extracted_docs, schemas tree, schema_calls, fit_calls, extraction_calls,
        fit_skips, deterministic_extractions).
    """
    schemas: dict[str, dict[str, Any]] = {}
    schema_calls = 0
    fit_calls = 0
    fit_skips = 0
    extraction_calls = 0
    deterministic_extractions = 0

    # Phase 1: sequential subclustering — must stay sequential because each article's
    # assignment decision reads and extends the subcluster list built by prior articles.
    all_subclusters: list[tuple[str, dict[str, Any]]] = []

    for cluster_label, articles in cluster_articles.items():
        schemas[cluster_label] = {}
        subclusters: list[dict[str, Any]] = []
        next_sc_index = 0

        # Sort articles so those with identical/similar headers are consecutive.
        # This maximises auto-assign hits (overlap >= threshold) early in the loop,
        # reducing both schema inference calls and LLM fit checks.
        articles_sorted = sorted(
            articles,
            key=lambda a: tuple(sorted(header_keys(a.get("table") or {}))),
        )

        for batch in chunked(articles_sorted, size=5):
            for article in batch:
                assigned, batch_fit_calls, batch_fit_skips = find_best_subcluster_for_article(
                    llm,
                    subclusters,
                    article,
                )
                fit_calls += batch_fit_calls
                fit_skips += batch_fit_skips

                if assigned is None:
                    sc_id = f"sc_{next_sc_index:03d}"
                    next_sc_index += 1
                    fallback_records = build_records(article.get("table", {}))
                    target_language = detect_target_language([article])
                    try:
                        schema_raw = extract_schema_for_article_llm(llm, cluster_label, article)
                        schema_calls += 1
                    except Exception:
                        logger.exception(
                            "extract_schema_for_article_llm failed for cluster=%s article=%s",
                            cluster_label,
                            article.get("article_id", ""),
                        )
                        schema_raw = infer_schema(
                            fallback_records,
                            target_language=target_language,
                        )
                    validated_schema = validate_schema(
                        schema_raw,
                        fallback_records,
                        target_language=target_language,
                        table=article.get("table", {}),
                    )
                    enrich_date_dimension(
                        validated_schema,
                        article.get("table", {}),
                        str(article.get("date", "") or "") or None,
                        target_language=target_language,
                    )
                    assigned = {
                        "sc_id": sc_id,
                        "schema": validated_schema,
                        "articles": [],
                    }
                    subclusters.append(assigned)
                    progress.info(
                        f"Created new subcluster {cluster_label}/{sc_id} for article {article.get('article_id', '')}"
                    )

                assigned["articles"].append(article)

        all_subclusters.extend((cluster_label, sc) for sc in subclusters)

    # Phase 2: parallel extraction — each subcluster is independent; worker threads share
    # the LlmClient (openai SDK is thread-safe) and call progress.update/info concurrently.
    extracted_docs: list[dict[str, Any]] = []
    workers = min(MAX_EXTRACTION_WORKERS, max(1, len(all_subclusters)))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(_extract_subcluster, cluster_label, subcluster, llm, progress): (
                cluster_label,
                subcluster,
            )
            for cluster_label, subcluster in all_subclusters
        }
        for future in as_completed(futures):
            cluster_label, subcluster = futures[future]
            extracted_doc, det_count, llm_calls = future.result()
            extracted_docs.append(extracted_doc)
            schemas[cluster_label][subcluster["sc_id"]] = subcluster["schema"]
            deterministic_extractions += det_count
            extraction_calls += llm_calls

    return (
        extracted_docs,
        schemas,
        schema_calls,
        fit_calls,
        extraction_calls,
        fit_skips,
        deterministic_extractions,
    )
