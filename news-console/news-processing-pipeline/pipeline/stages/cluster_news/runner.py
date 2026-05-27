"""Stage 2: LLM topic clustering and persistence to clustered_articles."""

from __future__ import annotations

import logging
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any

from pymongo import UpdateOne
from pymongo.database import Database

from pipeline.config import PipelineConfig
from pipeline.llm import LlmClient
from pipeline.progress import PipelineProgress
from pipeline.stages.cluster_news.labeling import (
    ASSIGN_BATCH_SIZE,
    MAX_ASSIGN_WORKERS,
    assign_labels_batch,
    generate_labels,
    merge_labels,
)
from pipeline.stages.cluster_news.language import detect_language
from pipeline.text import build_article_text

logger = logging.getLogger(__name__)


def run_cluster_news(
    db: Database,
    config: PipelineConfig,
    llm: LlmClient,
    progress: PipelineProgress,
    stage_index: int,
) -> dict[str, Any]:
    """Cluster prepared articles with LLM labels and write clustered_articles plus metadata.

    Args:
        db: MongoDB database handle.
        config: Pipeline configuration.
        llm: OpenAI client for label generate/merge/classify.
        progress: Progress tracker for this stage.
        stage_index: 1-based stage index.

    Returns:
        Summary with clustered article count and distinct label count.
    """
    prepared_articles = list(db[config.prepared_collection].find({}, {"_id": 0}))
    total = len(prepared_articles)
    progress.start_stage(stage_index, "Clustering news", total)

    if total == 0:
        progress.complete_stage({"clustered": 0, "labels": 0})
        return {"clustered": 0, "labels": 0}

    texts = [build_article_text(article) for article in prepared_articles]
    article_languages = [detect_language(text) for text in texts]

    progress.info("Generating candidate labels")
    labels_by_lang = generate_labels(llm, texts, article_languages, config.batch_size)

    progress.info("Merging similar labels")
    merged_labels_by_lang: dict[str, list[str]] = {}
    for lang, labels in labels_by_lang.items():
        merged_labels_by_lang[lang] = merge_labels(llm, labels, lang)

    global_label_pool: list[str] = []
    for labels in merged_labels_by_lang.values():
        for label in labels:
            if label not in global_label_pool:
                global_label_pool.append(label)
    if not global_label_pool:
        global_label_pool = ["unclassified"]

    progress.info("Assigning labels to articles")

    # Collect articles that have a valid ID; emit progress ticks for skipped ones now.
    valid: list[tuple[int, str, str, str, list[str]]] = []
    # (orig_idx, article_id, text, lang, language_labels)
    for orig_idx, (article, text, lang) in enumerate(
        zip(prepared_articles, texts, article_languages)
    ):
        article_id = str(article.get("id", "")).strip()
        if not article_id:
            progress.update(1)
            continue
        language_labels = merged_labels_by_lang.get(lang) or global_label_pool
        valid.append((orig_idx, article_id, text, lang, language_labels))

    # Group valid articles by language so every batch shares the same label pool.
    by_lang: dict[str, list[tuple[int, str, str, list[str]]]] = defaultdict(list)
    for orig_idx, article_id, text, lang, language_labels in valid:
        by_lang[lang].append((orig_idx, article_id, text, language_labels))

    # Chunk each language group into batches of ASSIGN_BATCH_SIZE.
    batches: list[tuple[list[int], list[str], list[str], list[str], str]] = []
    # (orig_indices, article_ids, texts, language_labels, lang)
    for lang, items in by_lang.items():
        language_labels = items[0][3]
        for start in range(0, len(items), ASSIGN_BATCH_SIZE):
            chunk = items[start : start + ASSIGN_BATCH_SIZE]
            batches.append((
                [item[0] for item in chunk],
                [item[1] for item in chunk],
                [item[2] for item in chunk],
                language_labels,
                lang,
            ))

    # Submit all batches concurrently; each batch makes exactly one LLM call.
    batch_results: dict[int, tuple[str, str, str]] = {}
    # orig_idx -> (article_id, assigned_label, lang)
    workers = min(MAX_ASSIGN_WORKERS, max(1, len(batches)))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(assign_labels_batch, llm, batch_texts, language_labels, lang): (
                orig_indices,
                article_ids,
                language_labels,
                lang,
            )
            for orig_indices, article_ids, batch_texts, language_labels, lang in batches
        }
        for future in as_completed(futures):
            orig_indices, article_ids, language_labels, lang = futures[future]
            try:
                assigned_list = future.result()
            except Exception:
                logger.exception(
                    "assign_labels_batch future failed for lang=%s", lang
                )
                assigned_list = ["unclassified"] * len(orig_indices)
            for orig_idx, article_id, assigned in zip(
                orig_indices, article_ids, assigned_list
            ):
                batch_results[orig_idx] = (article_id, assigned, lang)
            progress.update(len(orig_indices))

    # Rebuild updates in the original article order for deterministic MongoDB output.
    updates: list[UpdateOne] = []
    assigned_labels: list[str] = []
    assigned_languages: list[str] = []

    for orig_idx, (article, lang) in enumerate(
        zip(prepared_articles, article_languages)
    ):
        if orig_idx not in batch_results:
            continue
        article_id, assigned, _ = batch_results[orig_idx]
        language_labels = merged_labels_by_lang.get(lang) or global_label_pool
        if assigned not in language_labels:
            assigned = language_labels[0] if language_labels else "unclassified"

        assigned_labels.append(assigned)
        assigned_languages.append(lang)

        updates.append(
            UpdateOne(
                {"id": article_id},
                {
                    "$set": {
                        "id": article_id,
                        "cluster_label": assigned,
                        "cluster_id": global_label_pool.index(assigned) if assigned in global_label_pool else -1,
                        "cluster_language": lang,
                        "prepared": article.get("prepared", {}),
                    }
                },
                upsert=True,
            )
        )

    if updates:
        db[config.clustered_collection].bulk_write(updates, ordered=False)

    counter = Counter(assigned_labels)
    metadata = {
        "source": "clustering_metadata",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model": config.model_name,
        "batch_size": config.batch_size,
        "total_articles": len(assigned_labels),
        "total_clusters": len(counter),
        "cluster_labels": list(counter.keys()),
        "cluster_summary": dict(counter),
        "cluster_labels_by_language": merged_labels_by_lang,
        "article_language_summary": dict(Counter(assigned_languages)),
    }
    db[config.clustering_meta_collection].update_one(
        {"source": "clustering_metadata"},
        {"$set": metadata},
        upsert=True,
    )

    summary = {
        "clustered": len(assigned_labels),
        "labels": len(counter),
        "targetCollection": config.clustered_collection,
    }
    progress.complete_stage(summary)
    return summary
