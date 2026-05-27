
from __future__ import annotations

from typing import Any

from bs4 import BeautifulSoup
from pymongo import UpdateOne
from pymongo.database import Database

from pipeline.config import PipelineConfig
from pipeline.progress import PipelineProgress
from pipeline.stages.prepare_news.preprocess import preprocess_text


def run_prepare_news(
    db: Database,
    config: PipelineConfig,
    progress: PipelineProgress,
    stage_index: int,
) -> dict[str, Any]:
    """Prepare all source articles: parse HTML body, normalize text, upsert into prepared_news.

    Args:
        db: MongoDB database handle.
        config: Pipeline configuration (source and prepared collection names).
        progress: Progress tracker for this stage.
        stage_index: 1-based stage index for progress events.

    Returns:
        Summary with prepared count and collection names.
    """
    source_docs = list(
        db[config.source_collection].find(
            {},
            {"_id": 0, "id": 1, "title": 1, "full_body": 1},
        )
    )

    total = len(source_docs)
    progress.start_stage(stage_index, "Preparing news", total)

    if total == 0:
        progress.complete_stage({"prepared": 0})
        return {"prepared": 0}

    operations: list[UpdateOne] = []
    for doc in source_docs:
        article_id = str(doc.get("id", "")).strip()
        if not article_id:
            progress.update(1)
            continue

        title = preprocess_text(str(doc.get("title", "")))
        full_body = str(doc.get("full_body", ""))
        body_text = BeautifulSoup(full_body, "html.parser").get_text(" ", strip=True)
        body_text = preprocess_text(body_text)

        operations.append(
            UpdateOne(
                {"id": article_id},
                {
                    "$set": {
                        "id": article_id,
                        "prepared": {
                            "title": title,
                            "body_text": body_text,
                        },
                    }
                },
                upsert=True,
            )
        )
        progress.update(1)

    if operations:
        db[config.prepared_collection].bulk_write(operations, ordered=False)

    summary = {
        "prepared": len(operations),
        "sourceCollection": config.source_collection,
        "targetCollection": config.prepared_collection,
    }
    progress.complete_stage(summary)
    return summary
