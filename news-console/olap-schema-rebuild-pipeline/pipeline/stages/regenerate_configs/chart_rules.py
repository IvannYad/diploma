"""Rule-based chart type and axis heuristics for regenerated chart configs."""

from __future__ import annotations

from typing import Any


def display_name(name: str) -> str:
    """Convert a snake_case field name to a human-readable label.

    Args:
        name: Fact or dimension field name.

    Returns:
        Spaced label, or "value" if empty.
    """
    return str(name or "").replace("_", " ").strip() or "value"


def detect_x_axis_strategy(schema: dict[str, Any]) -> dict[str, str]:
    """Choose article_date vs temporal_dimension X-axis strategy from schema dimensions.

    Args:
        schema: Proposed OLAP schema with dimensions list.

    Returns:
        Dict with strategy, x_field, x_label, and granularity_hint keys.
    """
    dimensions = schema.get("dimensions", []) or []
    temporal_hints = ("date", "period", "month", "year", "quarter", "week", "time", "day", "дата", "період")

    temporal_dims = [
        d for d in dimensions
        if str(d.get("type", "")).lower() == "temporal"
    ]

    if temporal_dims:
        primary = temporal_dims[0]
        for hint in temporal_hints:
            hit = next(
                (d for d in temporal_dims if hint in str(d.get("name", "")).lower()),
                None,
            )
            if hit:
                primary = hit
                break

        x_field = str(primary.get("name", "date")) or "date"
        x_label = display_name(x_field)
        return {
            "strategy": "temporal_dimension",
            "x_field": x_field,
            "x_label": x_label,
            "granularity_hint": "per_record",
        }

    return {
        "strategy": "article_date",
        "x_field": "date",
        "x_label": "Date",
        "granularity_hint": "per_article",
    }


def rule_select_chart_type(
    schema: dict[str, Any],
    num_articles: int,
    x_axis: dict[str, str],
    *,
    language: str = "ukrainian",
) -> tuple[str, str]:
    """Pick chart type (line/bar) and justification from schema shape and article count.

    Args:
        schema: Proposed OLAP schema.
        num_articles: Number of articles in the subcluster sample.
        x_axis: Output of detect_x_axis_strategy.

    Returns:
        Tuple of (chart_type, chart_justification).
    """
    facts = schema.get("facts", []) or []
    dimensions = schema.get("dimensions", []) or []

    def low_cardinality(dim: dict[str, Any]) -> bool:
        values = dim.get("possible_values", []) or []
        return len(values) <= 7 if values else True

    low_card_dims = [
        d for d in dimensions
        if str(d.get("type", "")).lower() in ("categorical", "ordinal")
        and low_cardinality(d)
    ]

    uk = language == "ukrainian"
    group_dim = display_name(str(low_card_dims[0].get("name", ""))) if low_card_dims else ""

    if x_axis["strategy"] == "temporal_dimension":
        if low_card_dims and group_dim:
            msg = f"Лінійний графік за часом, групування: {group_dim}" if uk else f"Line chart over time, by {group_dim}"
        else:
            msg = "Лінійний графік за часом" if uk else "Line chart over time"
        return ("line", msg)

    if num_articles <= 10:
        msg = "Стовпчики — мало спостережень" if uk else "Bar chart — few data points"
        return ("bar", msg)
    if len(facts) >= 3:
        msg = "Стовпчики — кілька показників" if uk else "Bar chart — multiple metrics"
        return ("bar", msg)
    msg = "Лінійний графік" if uk else "Line chart"
    return ("line", msg)


def choose_color_dimension(dimensions: list[dict[str, Any]]) -> tuple[bool, str | None, str | None]:
    """Select a low-cardinality categorical dimension suitable for color encoding.

    Args:
        dimensions: OLAP dimension definitions.

    Returns:
        Tuple of (enabled, field_name, legend_label).
    """
    for dim in dimensions:
        dim_type = str(dim.get("type", "")).lower()
        if dim_type not in ("categorical", "ordinal"):
            continue
        values = dim.get("possible_values", []) or []
        if values and 2 <= len(values) <= 7:
            name = str(dim.get("name", ""))
            return True, name, display_name(name)
    return False, None, None


def select_filter_type(dim: dict[str, Any]) -> str:
    """Map a dimension to the frontend filter UI component type.

    Args:
        dim: Single dimension definition from the schema.

    Returns:
        Filter type string (date_range, slider, multi_select, search, dropdown).
    """
    dim_type = str(dim.get("type", "")).lower()
    values = dim.get("possible_values", []) or []

    if dim_type == "temporal":
        return "date_range"
    if dim_type == "numeric":
        return "slider"
    if len(values) <= 7:
        return "multi_select"
    if len(values) > 7:
        return "search"
    return "dropdown"
