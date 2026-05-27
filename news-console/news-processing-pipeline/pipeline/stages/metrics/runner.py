
from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from typing import Any

from pymongo.database import Database

from pipeline.config import PipelineConfig
from pipeline.progress import PipelineProgress
from pipeline.stages.metrics.gini import gini
from pipeline.stages.metrics.intrinsic import compute_intrinsic_metrics
from pipeline.text import build_article_text_for_metrics


def run_metrics(
    db: Database,
    config: PipelineConfig,
    progress: PipelineProgress,
    stage_index: int,
) -> dict[str, Any]:
    """Aggregate clustering quality metrics and upsert clustering_metrics document.

    Args:
        db: MongoDB database handle.
        config: Pipeline configuration.
        progress: Progress tracker (one step per clustered article).
        stage_index: 1-based stage index.

    Returns:
        Summary with totalArticles, totalClusters, and intrinsicStatus.
    """
    import numpy as np

    clustered = list(
        db[config.clustered_collection].find(
            {},
            {"_id": 0, "cluster_label": 1, "cluster_id": 1, "prepared": 1},
        )
    )
    clustering_meta = db[config.clustering_meta_collection].find_one(
        {"source": "clustering_metadata"},
        {"_id": 0},
    ) or {}

    total = len(clustered)
    progress.start_stage(stage_index, "Calculating metrics", total)

    counter: Counter[str] = Counter()
    texts: list[str] = []
    cluster_ids: list[int] = []
    for item in clustered:
        label = str(item.get("cluster_label", "unclassified"))
        counter[label] += 1

        cluster_id = item.get("cluster_id", -1)
        if isinstance(cluster_id, (int, float)):
            cluster_ids.append(int(cluster_id))
        else:
            cluster_ids.append(-1)

        texts.append(build_article_text_for_metrics(item))
        progress.update(1)

    counts = list(counter.values())
    valid_rows = [(txt, cid) for txt, cid in zip(texts, cluster_ids) if txt and cid >= 0]
    intrinsic = compute_intrinsic_metrics(valid_rows)

    label_stats = clustering_meta.get("label_statistics", {}) if isinstance(clustering_meta, dict) else {}
    api_usage = clustering_meta.get("api_usage", {}) if isinstance(clustering_meta, dict) else {}

    unclassified_count = int(counter.get("некласифіковано", 0)) + int(counter.get("unclassified", 0))

    doc: dict[str, Any] = {
        "source": "clustering_metrics",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_articles": total,
        "total_clusters": len(counter),
        "cluster_distribution": dict(counter),
        "gini_cluster_size": gini(counts),
        "cluster_size": {
            "mean": (sum(counts) / len(counts)) if counts else 0.0,
            "median": float(np.median(counts)) if counts else 0.0,
            "min": min(counts) if counts else 0,
            "max": max(counts) if counts else 0,
            "std": float(np.std(counts)) if counts else 0.0,
        },
        "intrinsic_metrics": intrinsic,
        "coverage": {
            "unclassified_articles": unclassified_count,
            "unclassified_rate": (unclassified_count / total) if total else 0.0,
        },
        "label_statistics": {
            "candidate_labels_generated": label_stats.get("candidate_labels_generated"),
            "unique_labels_before_merge": label_stats.get("unique_labels_before_merge"),
            "final_labels_after_merge": label_stats.get("final_labels_after_merge"),
        },
        "api_usage": {
            "prompt_tokens": api_usage.get("prompt_tokens"),
            "completion_tokens": api_usage.get("completion_tokens"),
            "total_api_calls": api_usage.get("total_api_calls"),
            "estimated_cost_usd": api_usage.get("estimated_cost_usd"),
        },
    }

    db[config.metrics_collection].update_one({"source": "clustering_metrics"}, {"$set": doc}, upsert=True)

    summary = {
        "totalArticles": total,
        "totalClusters": len(counter),
        "intrinsicStatus": intrinsic["status"],
    }
    progress.complete_stage(summary)
    return summary
