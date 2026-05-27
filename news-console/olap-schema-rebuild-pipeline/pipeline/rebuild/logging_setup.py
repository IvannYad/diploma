
from __future__ import annotations

import logging
import sys


def setup_logging(log_file: str) -> logging.Logger:
    """Configure root logger with file (DEBUG) and console (INFO) handlers.

    Args:
        log_file: Path to the rebuild log file on disk.

    Returns:
        The root logger after handlers are attached.
    """
    fmt = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"

    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setFormatter(logging.Formatter(fmt))
    file_handler.setLevel(logging.DEBUG)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(logging.Formatter(fmt))
    console_handler.setLevel(logging.INFO)

    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(logging.DEBUG)
    root.addHandler(file_handler)
    root.addHandler(console_handler)
    return root
