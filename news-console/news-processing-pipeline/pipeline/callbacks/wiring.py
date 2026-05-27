
from __future__ import annotations

from collections.abc import Callable
from typing import Any

from .progress import send_progress_callback


def build_progress_handler(
    process_id: str | None,
    progress_endpoint: str | None,
) -> Callable[[dict[str, Any]], None] | None:
    """Build the on_event handler passed to PipelineProgress when backend env is set.

    Args:
        process_id: PROCESS_ID from environment, or None to disable HTTP progress.
        progress_endpoint: BACKEND_PROGRESS_ENDPOINT or derived URL.

    Returns:
        Callable that posts each progress payload, or None if credentials are incomplete.
    """
    if not process_id or not progress_endpoint:
        return None
    return lambda payload: send_progress_callback(process_id, progress_endpoint, payload)
