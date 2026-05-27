
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def safe_float(value: Any) -> float | None:
    """Coerce a numeric result to float, returning None on failure.

    Args:
        value: Scalar from numpy/sklearn.

    Returns:
        float value or None.
    """
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


def compute_intrinsic_metrics(valid_rows: list[tuple[str, int]]) -> dict[str, Any]:
    """Compute silhouette and related indices on sentence embeddings of clustered articles.

    Args:
        valid_rows: List of (article_text, cluster_id) with cluster_id >= 0.

    Returns:
        intrinsic_metrics dict with status, scores, and per-cluster silhouette stats.
    """
    import numpy as np
    from sentence_transformers import SentenceTransformer
    from sklearn.metrics import (
        calinski_harabasz_score,
        davies_bouldin_score,
        silhouette_samples,
        silhouette_score,
    )

    intrinsic: dict[str, Any] = {
        "embedding_model": "paraphrase-multilingual-MiniLM-L12-v2",
        "silhouette_score": None,
        "davies_bouldin_index": None,
        "calinski_harabasz_index": None,
        "per_cluster_silhouette": {},
        "status": "not_computed",
        "reason": None,
    }

    unique_cluster_ids = sorted({cid for _, cid in valid_rows})

    if len(valid_rows) < 2:
        intrinsic["reason"] = "Need at least 2 valid clustered articles with text"
    elif len(unique_cluster_ids) < 2:
        intrinsic["reason"] = "Need at least 2 clusters for intrinsic metrics"
    elif len(valid_rows) <= len(unique_cluster_ids):
        intrinsic["reason"] = "Need more articles than clusters for intrinsic metrics"
    else:
        try:
            model = SentenceTransformer(intrinsic["embedding_model"])
            metric_texts = [x[0] for x in valid_rows]
            metric_labels = np.array([x[1] for x in valid_rows], dtype=int)
            embeddings = model.encode(metric_texts, show_progress_bar=False, batch_size=64)
            embeddings_np = np.array(embeddings)

            sil = safe_float(silhouette_score(embeddings_np, metric_labels))
            dbi = safe_float(davies_bouldin_score(embeddings_np, metric_labels))
            chi = safe_float(calinski_harabasz_score(embeddings_np, metric_labels))
            sil_samples = silhouette_samples(embeddings_np, metric_labels)

            per_cluster: dict[str, dict[str, Any]] = {}
            for cid in unique_cluster_ids:
                idx = np.where(metric_labels == cid)[0]
                if len(idx) == 0:
                    continue
                values = sil_samples[idx]
                per_cluster[str(cid)] = {
                    "size": int(len(idx)),
                    "avg_silhouette": safe_float(np.mean(values)),
                    "min_silhouette": safe_float(np.min(values)),
                    "max_silhouette": safe_float(np.max(values)),
                }

            intrinsic.update(
                {
                    "silhouette_score": sil,
                    "davies_bouldin_index": dbi,
                    "calinski_harabasz_index": chi,
                    "per_cluster_silhouette": per_cluster,
                    "status": "computed",
                    "reason": None,
                }
            )
        except Exception as exc:
            logger.exception("Intrinsic metrics computation failed: %s", exc)
            intrinsic["status"] = "error"
            intrinsic["reason"] = str(exc)

    return intrinsic
