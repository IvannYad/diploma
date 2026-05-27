"""HTTP completion callbacks to the backend after rebuild finishes."""

from __future__ import annotations

import sys

import requests


def send_completion_callback(
    process_id: str,
    callback_endpoint: str | None,
    succeeded: bool,
    message: str | None = None,
    validation_error: str | None = None,
) -> bool:
    """Notify the backend that a rebuild process completed or failed.

    Args:
        process_id: Backend process identifier for this rebuild run.
        callback_endpoint: Webhook URL; no-op if missing.
        succeeded: Whether the rebuild succeeded.
        message: Human-readable status for the UI.
        validation_error: Detailed validation failure text when succeeded is False.

    Returns:
        True if the HTTP call returned 200/202, False otherwise.
    """
    if not callback_endpoint or not process_id:
        return False

    try:
        payload = {
            "processId": process_id,
            "succeeded": succeeded,
            "message": message,
            "validationError": validation_error,
        }
        response = requests.post(
            callback_endpoint,
            json=payload,
            timeout=10,
        )
        if response.status_code in (200, 202):
            return True
        print(f"[WARN] Callback failed: {response.status_code} - {response.text}", file=sys.stderr)
        return False
    except Exception as exc:
        print(f"[WARN] Failed to send callback: {exc}", file=sys.stderr)
        return False
