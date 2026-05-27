"""X-axis strategy detection for chart configuration (article date vs table temporal dimension)."""

from __future__ import annotations

from typing import Any

TEMPORAL_NAME_HINTS = (
    "date",
    "period",
    "month",
    "year",
    "quarter",
    "week",
    "time",
    "day",
)


def display_name(name: str) -> str:
    """Turn a snake_case field name into a human-readable label.

    Args:
        name: Schema field name.

    Returns:
        Spaced label for UI placeholders.
    """
    return str(name or "").replace("_", " ").strip() or "value"


def detect_x_axis_strategy(schema: dict[str, Any]) -> dict[str, str]:
    """Choose article_date vs temporal_dimension X-axis strategy from OLAP dimensions.

    Args:
        schema: Subcluster OLAP schema.

    Returns:
        Dict with strategy, x_field, x_label, and granularity_hint.
    """
    dimensions = schema.get("dimensions", []) or []
    temporal_dims = [d for d in dimensions if str(d.get("type", "")).lower() == "temporal"]

    if temporal_dims:
        primary = temporal_dims[0]
        for hint in TEMPORAL_NAME_HINTS:
            hit = next(
                (d for d in temporal_dims if hint in str(d.get("name", "")).lower()),
                None,
            )
            if hit is not None:
                primary = hit
                break

        x_field = str(primary.get("name", "date")) or "date"
        x_label = str(primary.get("description", "")).strip() or display_name(x_field)
        return {
            "strategy": "temporal_dimension",
            "x_field": x_field,
            "x_label": x_label,
            "granularity_hint": "per_record",
        }

    return {
        "strategy": "article_date",
        "x_field": "date",
        "x_label": "Publication date",
        "granularity_hint": "per_article",
    }
