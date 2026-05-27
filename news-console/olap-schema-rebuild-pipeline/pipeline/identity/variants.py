
from __future__ import annotations

from typing import Any


def _unique(values: list[Any]) -> list[Any]:
    """Return values with duplicates removed (type + string key).

    Args:
        values: Candidate identifier variants.

    Returns:
        Deduplicated list preserving first-seen order.
    """
    seen: set[tuple[str, str]] = set()
    result: list[Any] = []
    for value in values:
        key = (type(value).__name__, str(value))
        if key in seen:
            continue
        seen.add(key)
        result.append(value)
    return result


def normalize_sc_id(raw: str) -> str:
    """Normalize subcluster id to sc_NNN form when the input is numeric or sc_-prefixed.

    Args:
        raw: Subcluster name from CLI or stored documents.

    Returns:
        Canonical sc_id string (e.g. sc_001).
    """
    value = (raw or "").strip()
    if value.lower().startswith("sc_"):
        suffix = value[3:]
        if suffix.isdigit():
            return f"sc_{int(suffix):03d}"
        return value

    if value.isdigit():
        return f"sc_{int(value):03d}"

    return value


def value_variants(raw: str) -> list[Any]:
    """Produce all MongoDB match variants for a cluster or subcluster label.

    Handles string labels, sc_NNN ids, bare numeric suffixes, and int forms so
    delete/copy filters match documents written by different pipeline versions.

    Args:
        raw: Cluster or subcluster name from the user or database.

    Returns:
        List of string and int values to use in $in queries.
    """
    value = (raw or "").strip()
    variants: list[Any] = []

    if value:
        variants.append(value)

    normalized_sc = normalize_sc_id(value)
    if normalized_sc and normalized_sc != value:
        variants.append(normalized_sc)

    if normalized_sc.lower().startswith("sc_"):
        suffix = normalized_sc[3:]
        if suffix:
            variants.append(suffix)
            if suffix.isdigit():
                variants.append(int(suffix))
    elif value.isdigit():
        variants.append(int(value))

    return _unique(variants)
