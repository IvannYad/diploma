"""Cheap table-structure similarity checks before LLM schema-fit calls."""

from __future__ import annotations

import re
from typing import Any


def header_keys(table: dict[str, Any]) -> set[str]:
    """Return normalized header token set for a parsed table.

    Used both for Jaccard similarity and for sorting articles by structure.

    Args:
        table: Parsed table with headers list.

    Returns:
        Set of snake_case-normalized header strings.
    """
    keys: set[str] = set()
    for header in table.get("headers") or []:
        text = re.sub(r"\W+", "_", str(header).strip().lower()).strip("_")
        if text:
            keys.add(text)
    return keys


def header_overlap_ratio(table_a: dict[str, Any], table_b: dict[str, Any]) -> float:
    """Jaccard similarity of normalized header names between two parsed tables.

    Args:
        table_a: Parsed table with headers.
        table_b: Another parsed table.

    Returns:
        Value in [0.0, 1.0]; 0 when either table has no headers.
    """
    keys_a = header_keys(table_a)
    keys_b = header_keys(table_b)
    if not keys_a or not keys_b:
        return 0.0
    intersection = len(keys_a & keys_b)
    union = len(keys_a | keys_b)
    return intersection / union if union else 0.0
