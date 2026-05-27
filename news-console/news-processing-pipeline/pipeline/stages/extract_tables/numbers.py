
from __future__ import annotations

from typing import Any


def to_number(value: Any) -> float | None:
    """Parse a table cell value as float, tolerating spaces and comma decimals.

    Args:
        value: Raw cell value (string, number, or None).

    Returns:
        Parsed float, or None if not numeric.
    """
    if value is None:
        return None
    text = str(value).strip().replace(" ", "")
    text = text.replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None
