"""Validate and repair LLM chart configs against the OLAP schema."""

from __future__ import annotations

from typing import Any

from pipeline.stages.chart_configs.rules import select_filter_type
from pipeline.stages.chart_configs.x_axis import display_name

VALID_AGG_METHODS = {"avg", "sum", "min", "max", "last", "first", "count", "median"}


def validate_chart_config(
    chart_config: dict[str, Any],
    schema: dict[str, Any],
    x_axis: dict[str, str],
) -> tuple[dict[str, Any], list[str]]:
    """Ensure chart JSON matches schema facts, dimensions, filters, and X-axis strategy.

    Args:
        chart_config: Raw or LLM-produced chart dict.
        schema: OLAP schema for the subcluster.
        x_axis: Enforced X-axis strategy.

    Returns:
        Tuple of (repaired chart config, list of FIX/FALLBACK issue strings).
    """
    issues: list[str] = []
    cfg = chart_config if isinstance(chart_config, dict) else {}

    facts = schema.get("facts", []) or []
    fact_names = {str(f.get("name", "")) for f in facts if str(f.get("name", "")).strip()}
    dimensions = schema.get("dimensions", []) or []
    dim_names = {str(d.get("name", "")) for d in dimensions if str(d.get("name", "")).strip()}

    if not cfg.get("title"):
        cfg["title"] = schema.get("table_description", "Chart")
        issues.append("FIXED: missing title")
    if "{{selected_fact_label}}" not in str(cfg.get("title", "")):
        cfg["title"] = f"{cfg['title']} - {{{{selected_fact_label}}}}"
        issues.append("FIXED: title missing selected_fact placeholder")

    dm = cfg.setdefault("data_model", {})
    dm["x_axis_strategy"] = x_axis["strategy"]
    dm["x_source_field"] = x_axis["x_field"]
    dm["granularity"] = x_axis["granularity_hint"]

    agg = dm.setdefault("fact_aggregation", {})
    method = str(agg.get("method", ""))
    if method not in VALID_AGG_METHODS:
        agg["method"] = "last" if x_axis["strategy"] == "temporal_dimension" else "avg"
        issues.append("FIXED: invalid aggregation method")
    agg.setdefault("explanation", "Aggregation for multi-row records")

    fs = cfg.setdefault("fact_selector", {})
    available = fs.get("available_facts", []) if isinstance(fs.get("available_facts", []), list) else []
    existing_names = {
        str(f.get("name", ""))
        for f in available
        if isinstance(f, dict) and str(f.get("name", "")).strip()
    }
    fact_dim_map: dict[str, list[str]] = {
        str(f.get("name", "")): [str(d) for d in f["dimensions"] if str(d).strip()]
        for f in facts
        if isinstance(f.get("dimensions"), list)
    }
    for fact in facts:
        name = str(fact.get("name", "")).strip()
        if not name or name in existing_names:
            continue
        entry: dict[str, Any] = {
            "name": name,
            "label": str(fact.get("description", "")).strip() or display_name(name),
            "unit": str(fact.get("unit", "")).strip(),
            "description": str(fact.get("description", "")).strip(),
        }
        if name in fact_dim_map:
            entry["dimensions"] = fact_dim_map[name]
        available.append(entry)
        issues.append(f"FIXED: added missing fact '{name}'")

    for af in available:
        if isinstance(af, dict) and str(af.get("name", "")) in fact_dim_map:
            af.setdefault("dimensions", fact_dim_map[str(af.get("name", ""))])

    fs["available_facts"] = available
    fs["enabled"] = len(available) >= 2
    fs.setdefault("ui_component", "dropdown")
    fs.setdefault("placement", "chart_top")
    fs.setdefault("label", "{{fact_selector_label}}")
    if str(fs.get("default_fact", "")) not in fact_names and available:
        fs["default_fact"] = str(available[0].get("name", ""))
        issues.append("FIXED: default_fact")

    filters = cfg.get("dimension_filters", []) if isinstance(cfg.get("dimension_filters", []), list) else []
    by_name: dict[str, dict[str, Any]] = {}
    for flt in filters:
        if isinstance(flt, dict) and str(flt.get("dimension_name", "")).strip():
            by_name[str(flt.get("dimension_name"))] = flt

    validated_filters: list[dict[str, Any]] = []
    for dim in dimensions:
        name = str(dim.get("name", "")).strip()
        if not name:
            continue
        flt = by_name.get(name, {"dimension_name": name})
        filter_type = str(flt.get("type", ""))
        if filter_type not in {"multi_select", "dropdown", "search", "toggle", "slider", "date_range"}:
            flt["type"] = select_filter_type(dim)
            issues.append(f"FIXED: filter type for '{name}'")

        flt.setdefault("label", str(dim.get("description", "")).strip() or display_name(name))
        flt.setdefault("default", "all")
        flt.setdefault("placement", "toolbar")
        flt.setdefault("description", str(dim.get("description", "")).strip())
        values = flt.get("possible_values")
        if not isinstance(values, list):
            values = []
        if not values:
            values = [str(v) for v in (dim.get("possible_values", []) or [])]
        flt["possible_values"] = values
        flt["allow_multiple"] = flt.get("type") in ("multi_select", "search")
        validated_filters.append(flt)

    cfg["dimension_filters"] = validated_filters

    axes = cfg.setdefault("axes", {})
    x = axes.setdefault("x", {})
    x["field"] = x_axis["x_field"]
    x["label"] = x_axis["x_label"]
    x["type"] = "temporal"
    x.setdefault("format", "DD.MM.YYYY")
    x.setdefault("sort", "asc")
    y = axes.setdefault("y", {})
    y["field"] = "{{selected_fact}}"
    y["label"] = "{{selected_fact_label}} ({{selected_fact_unit}})"
    y.setdefault("scale", "linear")
    y.setdefault("zero_baseline", True)

    ce = cfg.setdefault("color_encoding", {"enabled": False, "field": None, "label": None, "palette": "qualitative"})
    if ce.get("enabled") and ce.get("field") not in dim_names:
        ce["enabled"] = False
        ce["field"] = None
        ce["label"] = None
        issues.append("FIXED: disabled invalid color field")
    ce.setdefault("palette", "qualitative")

    cfg.setdefault(
        "article_identity",
        {"id_field": "article_id", "label_field": "title", "date_field": "date"},
    )
    inter = cfg.setdefault("interactivity", {})
    cta = inter.setdefault("click_to_article", {})
    cta["enabled"] = True
    cta["action"] = "open_article_detail"
    cta["id_field"] = "article_id"
    cta.setdefault("label", "{{open_article_label}}")
    tooltip = inter.setdefault("tooltip", {})
    tooltip["enabled"] = True
    tooltip.setdefault(
        "fields",
        [
            {"field": "title", "label": "{{tooltip_title_label}}"},
            {"field": "date", "label": "{{tooltip_date_label}}"},
            {"field": "{{selected_fact}}", "label": "{{selected_fact_label}}"},
        ],
    )
    inter.setdefault(
        "zoom_pan",
        {"enabled": cfg.get("chart_type") in ("line", "area", "scatter", "dot_plot"), "reset_on_double_click": True},
    )
    inter.setdefault("export", {"enabled": True, "formats": ["png", "svg", "csv"]})

    vo = cfg.setdefault("visual_options", {})
    vo.setdefault("show_data_labels", False)
    vo.setdefault("show_legend", bool((cfg.get("color_encoding") or {}).get("enabled")))
    vo.setdefault("show_grid", True)
    vo.setdefault("theme", "light")
    vo.setdefault("empty_state_message", "{{empty_state_message}}")

    return cfg, issues
