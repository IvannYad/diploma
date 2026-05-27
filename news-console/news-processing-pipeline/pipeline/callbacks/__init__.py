"""Backend webhook integration for pipeline completion and progress."""

from .completion import send_completion_callback
from .progress import derive_progress_endpoint, send_progress_callback
from .wiring import build_progress_handler

__all__ = [
    "build_progress_handler",
    "derive_progress_endpoint",
    "send_completion_callback",
    "send_progress_callback",
]
