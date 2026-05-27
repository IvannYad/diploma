
from __future__ import annotations

from collections.abc import Callable
from typing import Any

from .progress import send_progress_callback


def build_progress_handler(
    process_id: str,
    progress_endpoint: str | None,
) -> Callable[[dict[str, Any]], None] | None:
    """Build the on_event callback for PipelineProgress when a progress URL is configured.

    Args:
        process_id: Backend process identifier.
        progress_endpoint: Progress webhook URL.

    Returns:
        Callable that posts each event, or None if no endpoint is configured.
    """
    if not progress_endpoint:
        return None
    return lambda payload: send_progress_callback(process_id, progress_endpoint, payload)
