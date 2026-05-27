"""HTTP progress callbacks derived from pipeline NDJSON events."""

from __future__ import annotations

import sys
from typing import Any

import requests


def send_progress_callback(
    process_id: str,
    progress_endpoint: str,
    payload: dict[str, object],
) -> bool:
    """Forward a progress event to the backend progress webhook.

    Args:
        process_id: Backend process identifier.
        progress_endpoint: URL for incremental progress updates.
        payload: Event fields (event, stage, processed, total, percent, etc.).

    Returns:
        True if the server responded with 200 or 202, False otherwise.
    """
    if not progress_endpoint or not process_id:
        return False

    try:
        body = {
            "processId": process_id,
            "event": payload.get("event"),
            "stage": payload.get("stage"),
            "stageIndex": payload.get("stageIndex"),
            "totalStages": payload.get("totalStages"),
            "processed": payload.get("processed"),
            "total": payload.get("total"),
            "percent": payload.get("percent"),
            "message": payload.get("message"),
            "error": payload.get("error"),
        }
        response = requests.post(progress_endpoint, json=body, timeout=5)
        return response.status_code in (200, 202)
    except Exception as e:
        print(f"[WARN] Failed to send progress callback: {e}", file=sys.stderr)
        return False


def derive_progress_endpoint(completion_endpoint: str | None) -> str | None:
    """Map a completion webhook URL to its sibling progress URL when not set explicitly.

    Args:
        completion_endpoint: URL ending in ``/completed`` or a generic callback base.

    Returns:
        Progress endpoint URL, or None if completion_endpoint is missing.
    """
    if not completion_endpoint:
        return None
    if completion_endpoint.endswith("/completed"):
        return completion_endpoint[:-10] + "/progress"
    return completion_endpoint
