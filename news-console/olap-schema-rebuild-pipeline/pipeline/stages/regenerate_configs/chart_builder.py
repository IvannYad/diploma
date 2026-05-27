
from __future__ import annotations

from typing import Any

from pymongo.database import Database

from pipeline.config import RebuildConfig
from pipeline.stages.regenerate_configs.chart_rules import (
    choose_color_dimension,
    detect_x_axis_strategy,
    rule_select_chart_type,
    select_filter_type,
)
from pipeline.stages.regenerate_configs.text_labels import (
    aggregation_explanation,
    chart_description,
    chart_title,
    data_model_note,
    detect_schema_language,
    field_label,
    short_justification,
    x_axis_label,
)


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
        short_label = field_label(name, description)
        entry: dict[str, Any] = {
            "name": name,
            "label": short_label,
            "unit": str(fact.get("unit", "")).strip(),
            "description": short_label,
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
        short_label = field_label(name, str(dim.get("description", "")))
        filters.append(
            {
                "dimension_name": name,
                "label": short_label,
                "type": filter_type,
                "possible_values": [str(v) for v in values],
                "default": "all",
                "placement": "toolbar",
                "description": short_label,
                "allow_multiple": filter_type in ("multi_select", "search"),
            }
        )
    return filters


def build_v3_chart_config(
    schema: dict[str, Any],
    chart_type: str,
    chart_justification: str,
    x_axis: dict[str, str],
    *,
    language: str = "ukrainian",
) -> dict[str, Any]:
    """Assemble a complete rule-based chart config (news-processing v3 shape).

    Args:
        schema: OLAP schema.
        chart_type: line or bar from heuristics.
        chart_justification: Text explaining the chart type choice.
        x_axis: X-axis strategy from detect_x_axis_strategy.

    Returns:
        Chart configuration dict nested under chart_configs.chart.
    """
    facts = schema.get("facts", []) or []
    dimensions = schema.get("dimensions", []) or []

    fact_selector = build_fact_selector(facts)
    color_enabled, color_field, color_label = choose_color_dimension(dimensions)
    if color_label:
        color_label = field_label(str(color_field or ""), color_label)

    agg_method = "last" if x_axis["strategy"] == "temporal_dimension" else "avg"

    return {
        "chart_type": chart_type,
        "chart_justification": short_justification(chart_justification),
        "title": chart_title(schema, language=language),
        "description": chart_description(schema, language=language),
        "data_model": {
            "x_axis_strategy": x_axis["strategy"],
            "x_source_field": x_axis["x_field"],
            "granularity": x_axis["granularity_hint"],
            "note": data_model_note(x_axis["strategy"], language=language),
            "fact_aggregation": {
                "method": agg_method,
                "explanation": aggregation_explanation(agg_method, language=language),
            },
        },
        "fact_selector": fact_selector,
        "dimension_filters": build_dimension_filters(dimensions),
        "axes": {
            "x": {
                "field": x_axis["x_field"],
                "label": x_axis_label(x_axis["x_label"], x_axis["x_field"], language=language),
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


def build_chart(
    db: Database,
    config: RebuildConfig,
    cluster_name: str,
    subcluster_name: str,
    schema: dict[str, Any],
) -> tuple[dict[str, Any], str]:
    """Build the chart subsection and the rule-selected chart type.

    Args:
        db: Main MongoDB database.
        config: Rebuild configuration.
        cluster_name: Target cluster_label.
        subcluster_name: Target sc_id.
        schema: Validated proposed OLAP schema.

    Returns:
        Tuple of (chart dict, rule_chart_type).
    """
    extracted_doc = db[config.extracted_collection].find_one(
        {"cluster_label": cluster_name, "sc_id": subcluster_name},
        {"metadata": 1, "articles": 1},
    ) or {}
    metadata = extracted_doc.get("metadata") or {}
    num_articles = int(metadata.get("num_articles", 0) or 0)
    if not num_articles:
        num_articles = len(extracted_doc.get("articles") or [])

    language = detect_schema_language(schema)
    x_axis = detect_x_axis_strategy(schema)
    chart_type, justification = rule_select_chart_type(
        schema, num_articles, x_axis, language=language
    )
    chart = build_v3_chart_config(
        schema, chart_type, justification, x_axis, language=language
    )
    return chart, chart_type
