"""Heuristic chart type and filter UI selection before LLM refinement."""

from __future__ import annotations

from typing import Any

from pipeline.stages.chart_configs.x_axis import display_name


def rule_select_chart_type(schema: dict[str, Any], num_articles: int, x_axis: dict[str, str]) -> tuple[str, str]:
    """Suggest default chart type and justification from schema shape and article count.

    Args:
        schema: OLAP schema for the subcluster.
        num_articles: Number of articles in the subcluster.
        x_axis: Output from detect_x_axis_strategy.

    Returns:
        Tuple of (chart_type, justification text).
    """
    facts = schema.get("facts", []) or []
    dimensions = schema.get("dimensions", []) or []

    def low_cardinality(dim: dict[str, Any]) -> bool:
        values = dim.get("possible_values", []) or []
        return len(values) <= 7 if values else True

    low_card_dims = [
        d for d in dimensions if str(d.get("type", "categorical")) in ("categorical", "ordinal") and low_cardinality(d)
    ]

    if x_axis["strategy"] == "temporal_dimension":
        if low_card_dims:
            return (
                "line",
                f"Temporal x-axis '{x_axis['x_field']}' with low-cardinality grouping dimension '{low_card_dims[0].get('name', '')}'.",
            )
        return (
            "line",
            f"Temporal x-axis '{x_axis['x_field']}' is best visualized as a trend line.",
        )

    if num_articles <= 10:
        return ("bar", f"Only {num_articles} articles; bar chart is clearer for comparison.")
    if low_card_dims:
        return (
            "line",
            f"{num_articles} articles with groupable categorical dimension '{low_card_dims[0].get('name', '')}'.",
        )
    if len(facts) >= 3:
        return ("bar", "Several facts are available; bar chart works well with fact switching.")
    return ("line", f"{num_articles} articles; line chart shows progression over publication dates.")


def choose_color_dimension(dimensions: list[dict[str, Any]]) -> tuple[bool, str | None, str | None]:
    """Pick a low-cardinality categorical dimension for series color, if any.

    Args:
        dimensions: OLAP dimensions from the schema.

    Returns:
        Tuple of (enabled, field name, legend label).
    """
    for dim in dimensions:
        dim_type = str(dim.get("type", "categorical"))
        if dim_type not in ("categorical", "ordinal"):
            continue
        values = dim.get("possible_values", []) or []
        if values and 2 <= len(values) <= 7:
            name = str(dim.get("name", ""))
            return True, name, str(dim.get("description", "")).strip() or display_name(name)
    return False, None, None


def select_filter_type(dim: dict[str, Any]) -> str:
    """Map a dimension to the frontend filter control type.

    Args:
        dim: Single dimension definition.

    Returns:
        Filter widget type name (multi_select, date_range, etc.).
    """
    dim_type = str(dim.get("type", "categorical")).lower()
    values = dim.get("possible_values", []) or []

    if dim_type == "temporal":
        return "date_range"
    if dim_type == "numeric":
        return "slider"
    if values and len(values) <= 2:
        return "toggle"
    if values and len(values) <= 7:
        return "multi_select"
    if values and len(values) > 7:
        return "search"
    return "multi_select"
