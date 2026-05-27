
from __future__ import annotations

import logging
import sys


def setup_logging(log_file: str) -> logging.Logger:
    """Configure root logging to a file (DEBUG) and stderr (WARNING+).

    Args:
        log_file: Path to the pipeline log file.

    Returns:
        Logger for the orchestration module.
    """
    fmt = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(logging.Formatter(fmt))

    stderr_handler = logging.StreamHandler(sys.stderr)
    stderr_handler.setLevel(logging.WARNING)
    stderr_handler.setFormatter(logging.Formatter(fmt))

    root = logging.getLogger()
    root.setLevel(logging.DEBUG)
    root.addHandler(file_handler)
    root.addHandler(stderr_handler)
    return logging.getLogger("pipeline.orchestration")
