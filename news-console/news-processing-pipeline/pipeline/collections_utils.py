"""Generic collection utilities for batch processing."""

from __future__ import annotations

from typing import TypeVar

T = TypeVar("T")


def chunked(items: list[T], size: int = 5) -> list[list[T]]:
    """Split a list into fixed-size batches for LLM calls and bulk operations.

    Args:
        items: Sequence to partition.
        size: Maximum items per chunk (default 5 for table extraction batches).

    Returns:
        List of consecutive sublists covering all items.
    """
    return [items[i : i + size] for i in range(0, len(items), size)]
