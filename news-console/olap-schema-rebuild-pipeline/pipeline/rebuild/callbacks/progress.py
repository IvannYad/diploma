
from __future__ import annotations

import sys
from typing import Any

import requests


def send_progress_callback(
    process_id: str,
    progress_endpoint: str | None,
    payload: dict[str, Any],
) -> bool:
    """Forward one progress event to the backend progress webhook.

    Args:
        process_id: Backend process identifier.
        progress_endpoint: Progress webhook URL; no-op if missing.
        payload: NDJSON event fields (event, stage, percent, etc.).

    Returns:
        True if the HTTP call returned 200/202, False otherwise.
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
    except Exception as exc:
        print(f"[WARN] Failed to send progress callback: {exc}", file=sys.stderr)
        return False


def derive_progress_endpoint(completion_endpoint: str | None) -> str | None:
    """Map a completion callback URL to the matching progress URL when applicable.

    Args:
        completion_endpoint: URL ending in /completed, or another callback base.

    Returns:
        Progress endpoint URL, or the original endpoint if no mapping applies.
    """
    if not completion_endpoint:
        return None
    if completion_endpoint.endswith("/completed"):
        return completion_endpoint[:-10] + "/progress"
    return completion_endpoint
