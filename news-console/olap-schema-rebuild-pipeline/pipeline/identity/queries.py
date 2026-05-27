
from __future__ import annotations

from typing import Any

from pipeline.identity.variants import normalize_sc_id, value_variants


def build_cluster_subcluster_filter(cluster_name: str, subcluster_name: str) -> dict[str, Any]:
    """Build a filter that matches all field naming conventions for one subcluster.

    Args:
        cluster_name: Cluster label (cluster or cluster_label field).
        subcluster_name: Subcluster id (sc_id, subcluster, or subcluster_id field).

    Returns:
        MongoDB query document with $and/$or on cluster and subcluster fields.
    """
    cluster_values = value_variants(cluster_name)
    subcluster_values = value_variants(subcluster_name)

    cluster_or = [
        {"cluster": {"$in": cluster_values}},
        {"cluster_label": {"$in": cluster_values}},
    ]
    subcluster_or = [
        {"subcluster": {"$in": subcluster_values}},
        {"sc_id": {"$in": subcluster_values}},
        {"subcluster_id": {"$in": subcluster_values}},
    ]

    return {
        "$and": [
            {"$or": cluster_or},
            {"$or": subcluster_or},
        ]
    }


def build_identity_fields(cluster_name: str, subcluster_name: str) -> dict[str, Any]:
    """Build canonical identity fields to embed in staged or copied documents.

    Args:
        cluster_name: Cluster label for the rebuild target.
        subcluster_name: Subcluster id for the rebuild target.

    Returns:
        Dict with cluster, cluster_label, sc_id, subcluster, and subcluster_id keys.
    """
    normalized_sc = normalize_sc_id(subcluster_name)
    return {
        "cluster": cluster_name,
        "subcluster": subcluster_name,
        "cluster_label": cluster_name,
        "sc_id": normalized_sc,
        "subcluster_id": normalized_sc,
    }
