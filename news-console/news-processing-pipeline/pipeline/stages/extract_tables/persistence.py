"""MongoDB writes for extracted OLAP data, indexes, and schema catalog."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pymongo import UpdateOne
from pymongo.database import Database

from pipeline.config import PipelineConfig


def persist_extraction_results(
    db: Database,
    config: PipelineConfig,
    extracted_docs: list[dict[str, Any]],
    schemas: dict[str, dict[str, Any]],
) -> None:
    """Replace extracted collections, backfill sc_id on clustered articles, and save indexes.

    Args:
        db: MongoDB database handle.
        config: Collection names for extracted data and schemas.
        extracted_docs: Per-subcluster extraction payloads.
        schemas: Nested map cluster_label -> sc_id -> schema.
    """
    db[config.extracted_collection].delete_many({})
    if extracted_docs:
        db[config.extracted_collection].insert_many(extracted_docs)

    # Downstream OLAP rebuild queries clustered articles by cluster_label + sc_id.
    sc_id_updates: list[UpdateOne] = []
    for doc in extracted_docs:
        for article in doc.get("articles", []):
            article_id = article.get("article_id", "")
            if article_id:
                sc_id_updates.append(
                    UpdateOne(
                        {"id": str(article_id)},
                        {"$set": {"sc_id": doc["sc_id"]}},
                    )
                )
    if sc_id_updates:
        db[config.clustered_collection].bulk_write(sc_id_updates, ordered=False)

    subcluster_index_docs = [
        {
            "cluster_label": doc["cluster_label"],
            "sc_id": doc["sc_id"],
            "article_ids": [a["article_id"] for a in doc.get("articles", []) if a.get("article_id")],
            "num_articles": doc["metadata"].get("num_articles", 0),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        for doc in extracted_docs
    ]
    db[config.subcluster_articles_collection].delete_many({})
    if subcluster_index_docs:
        db[config.subcluster_articles_collection].insert_many(subcluster_index_docs)

    index_doc = {
        "source": "extracted_news_index",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_subclusters": len(extracted_docs),
        "clusters": {
            doc["cluster_label"]: {
                "sc_ids": [d["sc_id"] for d in extracted_docs if d["cluster_label"] == doc["cluster_label"]]
            }
            for doc in extracted_docs
        },
    }
    db[config.extracted_index_collection].update_one(
        {"source": "extracted_news_index"}, {"$set": index_doc}, upsert=True
    )

    schemas_doc = {
        "source": "olap_schemas",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": f"{config.model_name}:llm-table-data-extraction",
        "schemas": schemas,
    }
    db[config.schemas_collection].update_one(
        {"source": "olap_schemas"}, {"$set": schemas_doc}, upsert=True
    )
