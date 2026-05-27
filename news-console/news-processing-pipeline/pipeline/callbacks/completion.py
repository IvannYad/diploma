
from __future__ import annotations

import sys

import requests


def send_completion_callback(
    process_id: str,
    callback_endpoint: str,
    succeeded: bool,
    message: str | None = None,
) -> bool:
    """Notify the backend that a pipeline run completed or failed.

    Args:
        process_id: Backend process identifier (PROCESS_ID env).
        callback_endpoint: Webhook URL (BACKEND_CALLBACK_ENDPOINT env).
        succeeded: True on full success, False on error.
        message: Optional human-readable status or error text.

    Returns:
        True if the server responded with 200 or 202, False otherwise.
    """
    if not callback_endpoint or not process_id:
        return False

    try:
        payload = {
            "processId": process_id,
            "succeeded": succeeded,
            "message": message,
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
    except Exception as e:
        print(f"[WARN] Failed to send callback: {e}", file=sys.stderr)
        return False
