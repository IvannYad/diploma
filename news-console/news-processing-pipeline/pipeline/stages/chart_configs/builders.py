
from __future__ import annotations

from typing import Any

from pipeline.stages.chart_configs.rules import choose_color_dimension, select_filter_type
from pipeline.stages.chart_configs.x_axis import display_name


def build_fact_selector(facts: list[dict[str, Any]]) -> dict[str, Any]:
    """Build fact_selector block for switching measures on one chart.

    Args:
        facts: OLAP fact definitions.

    Returns:
        fact_selector dict for chart JSON.
    """
    available_facts: list[dict[str, Any]] = []
    for fact in facts:
        name = str(fact.get("name", "")).strip()
        if not name:
            continue
        description = str(fact.get("description", "")).strip()
        entry: dict[str, Any] = {
            "name": name,
            "label": description or display_name(name),
            "unit": str(fact.get("unit", "")).strip(),
            "description": description,
        }
        if isinstance(fact.get("dimensions"), list):
            entry["dimensions"] = [str(d) for d in fact["dimensions"] if str(d).strip()]
        available_facts.append(entry)

    default_fact = available_facts[0]["name"] if available_facts else ""
    return {
        "enabled": len(available_facts) >= 2,
        "ui_component": "dropdown",
        "placement": "chart_top",
        "label": "{{fact_selector_label}}",
        "default_fact": default_fact,
        "available_facts": available_facts,
    }


def build_dimension_filters(dimensions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build dimension_filters toolbar entries for every schema dimension.

    Args:
        dimensions: OLAP dimensions.

    Returns:
        List of filter configuration objects.
    """
    filters: list[dict[str, Any]] = []
    for dim in dimensions:
        name = str(dim.get("name", "")).strip()
        if not name:
            continue
        filter_type = select_filter_type(dim)
        values = dim.get("possible_values", []) or []
        filters.append(
            {
                "dimension_name": name,
                "label": str(dim.get("description", "")).strip() or display_name(name),
                "type": filter_type,
                "possible_values": [str(v) for v in values],
                "default": "all",
                "placement": "toolbar",
                "description": str(dim.get("description", "")).strip(),
                "allow_multiple": filter_type in ("multi_select", "search"),
            }
        )
    return filters


def build_v3_chart_config(
    schema: dict[str, Any],
    chart_type: str,
    chart_justification: str,
    x_axis: dict[str, str],
) -> dict[str, Any]:
    """Assemble a complete rule-based chart config used when LLM generation fails.

    Args:
        schema: OLAP schema.
        chart_type: line or bar from heuristics.
        chart_justification: Text explaining the chart type choice.
        x_axis: X-axis strategy from detect_x_axis_strategy.

    Returns:
        Full chart configuration dict (v3 schema).
    """
    facts = schema.get("facts", []) or []
    dimensions = schema.get("dimensions", []) or []

    fact_selector = build_fact_selector(facts)
    color_enabled, color_field, color_label = choose_color_dimension(dimensions)

    return {
        "chart_type": chart_type,
        "chart_justification": chart_justification,
        "title": f"Trend of {{{{selected_fact_label}}}} for {schema.get('table_description', 'subcluster')}",
        "description": str(schema.get("table_description", "")).strip() or "Auto-generated chart configuration",
        "data_model": {
            "x_axis_strategy": x_axis["strategy"],
            "x_source_field": x_axis["x_field"],
            "granularity": x_axis["granularity_hint"],
            "note": (
                "Each point represents one table record."
                if x_axis["strategy"] == "temporal_dimension"
                else "Each point represents one article."
            ),
            "fact_aggregation": {
                "method": "last" if x_axis["strategy"] == "temporal_dimension" else "avg",
                "explanation": "Default aggregation applied when multiple rows map to one visual point.",
            },
        },
        "fact_selector": fact_selector,
        "dimension_filters": build_dimension_filters(dimensions),
        "axes": {
            "x": {
                "field": x_axis["x_field"],
                "label": x_axis["x_label"],
                "type": "temporal",
                "format": "DD.MM.YYYY",
                "sort": "asc",
            },
            "y": {
                "field": "{{selected_fact}}",
                "label": "{{selected_fact_label}} ({{selected_fact_unit}})",
                "scale": "linear",
                "zero_baseline": True,
            },
        },
        "color_encoding": {
            "enabled": color_enabled,
            "field": color_field,
            "label": color_label,
            "palette": "qualitative",
        },
        "article_identity": {
            "id_field": "article_id",
            "label_field": "title",
            "date_field": "date",
        },
        "interactivity": {
            "click_to_article": {
                "enabled": True,
                "action": "open_article_detail",
                "id_field": "article_id",
                "label": "{{open_article_label}}",
            },
            "tooltip": {
                "enabled": True,
                "fields": [
                    {"field": "title", "label": "{{tooltip_title_label}}"},
                    {"field": "date", "label": "{{tooltip_date_label}}"},
                    {"field": "{{selected_fact}}", "label": "{{selected_fact_label}}"},
                ],
            },
            "zoom_pan": {
                "enabled": chart_type in ("line", "area", "scatter", "dot_plot"),
                "reset_on_double_click": True,
            },
            "export": {
                "enabled": True,
                "formats": ["png", "svg", "csv"],
            },
        },
        "visual_options": {
            "show_data_labels": False,
            "show_legend": color_enabled,
            "show_grid": True,
            "theme": "light",
            "empty_state_message": "{{empty_state_message}}",
        },
    }
