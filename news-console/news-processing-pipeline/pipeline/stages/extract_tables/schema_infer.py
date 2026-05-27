"""Rule-based OLAP schema inference and validation when LLM output is missing or invalid."""

from __future__ import annotations

import re
from typing import Any

from pipeline.stages.extract_tables.date_dimension import (
    consolidate_date_dimensions,
    is_date_dimension_name,
)


def snake_case(value: str) -> str:
    """Normalize a name to lowercase snake_case for schema fields.

    Args:
        value: Raw dimension or fact name.

    Returns:
        Sanitized identifier.
    """
    return re.sub(r"\W+", "_", str(value).strip().lower()).strip("_")


def detect_target_language(sample_articles: list[dict[str, Any]]) -> str:
    """Choose ukrainian vs english for LLM schema naming based on title script.

    Args:
        sample_articles: Articles whose titles hint at content language.

    Returns:
        ``ukrainian`` or ``english`` for prompt conditioning.
    """
    text = " ".join(str(article.get("title", "")) for article in sample_articles)
    cyrillic_chars = len(re.findall(r"[А-Яа-яІіЇїЄєҐґ]", text))
    latin_chars = len(re.findall(r"[A-Za-z]", text))
    return "ukrainian" if cyrillic_chars > latin_chars else "english"


def infer_schema(
    records: list[dict[str, Any]],
    *,
    target_language: str = "ukrainian",
) -> dict[str, Any]:
    """Build a minimal OLAP schema from parsed table rows using numeric vs text heuristics.

    Args:
        records: Flat row dicts from build_records.

    Returns:
        Schema with facts, dimensions, and table_description.
    """
    if not records:
        return {
            "table_description": "No table records",
            "facts": [],
            "dimensions": [],
        }

    keys = list(records[0].keys())
    facts: list[dict[str, str]] = []
    dimensions: list[dict[str, Any]] = []

    for key in keys:
        values = [r.get(key) for r in records if key in r]
        numeric_count = sum(1 for v in values if isinstance(v, (int, float)))
        ratio = numeric_count / max(1, len(values))
        if ratio >= 0.6:
            facts.append({"name": key, "description": f"Numeric metric for {key}", "unit": "unknown"})
        elif is_date_dimension_name(key):
            sample_values = []
            for value in values:
                text = str(value).strip()
                if text and text not in sample_values:
                    sample_values.append(text)
            dimensions.append(
                {
                    "name": key,
                    "description": f"Temporal dimension for {key}",
                    "type": "temporal",
                    "possible_values": sample_values,
                }
            )
        else:
            sample_values = []
            for value in values:
                text = str(value)
                if text not in sample_values:
                    sample_values.append(text)
                if len(sample_values) >= 10:
                    break
            dimensions.append(
                {
                    "name": key,
                    "description": f"Categorical dimension for {key}",
                    "type": "categorical",
                    "possible_values": sample_values,
                }
            )

    dimensions = consolidate_date_dimensions(dimensions, facts, target_language=target_language)

    return {
        "table_description": "Auto-inferred OLAP schema from parsed HTML table",
        "facts": facts,
        "dimensions": dimensions,
    }


def validate_schema(
    schema: dict[str, Any],
    fallback_records: list[dict[str, Any]],
    *,
    target_language: str = "ukrainian",
    table: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Normalize and repair LLM or inferred schema; fall back to infer_schema when invalid.

    Args:
        schema: Raw schema dict from LLM.
        fallback_records: Rows used if validation yields no facts.

    Returns:
        Canonical schema with date dimension and per-fact dimension refs.
    """
    if not isinstance(schema, dict):
        return infer_schema(fallback_records, target_language=target_language)

    table_description = str(schema.get("table_description", "")).strip() or "Auto-inferred OLAP schema"
    facts_in = schema.get("facts", []) if isinstance(schema.get("facts", []), list) else []
    dims_in = schema.get("dimensions", []) if isinstance(schema.get("dimensions", []), list) else []

    facts: list[dict[str, Any]] = []
    for fact in facts_in:
        if not isinstance(fact, dict):
            continue
        name = snake_case(str(fact.get("name", "")))
        if not name:
            continue
        facts.append(
            {
                "name": name,
                "description": str(fact.get("description", "")).strip() or name.replace("_", " "),
                "unit": str(fact.get("unit", "")).strip(),
                "dimensions": fact.get("dimensions"),
            }
        )

    dimensions: list[dict[str, Any]] = []
    for dim in dims_in:
        if not isinstance(dim, dict):
            continue
        name = snake_case(str(dim.get("name", "")))
        if not name:
            continue
        dim_type = str(dim.get("type", "categorical")).lower()
        if dim_type not in ("categorical", "temporal", "ordinal", "numeric"):
            dim_type = "categorical"
        values = dim.get("possible_values", [])
        if not isinstance(values, list):
            values = []
        dimensions.append(
            {
                "name": name,
                "description": str(dim.get("description", "")).strip() or name.replace("_", " "),
                "type": dim_type,
                "possible_values": [str(v) for v in values[:100]],
            }
        )

    if not facts:
        return infer_schema(fallback_records, target_language=target_language)

    all_dim_names = [d["name"] for d in dimensions]
    canonical_dim_name_by_norm = {snake_case(name): name for name in all_dim_names}
    for fact in facts:
        dim_refs = fact.get("dimensions")
        if not isinstance(dim_refs, list):
            fact["dimensions"] = list(all_dim_names)
        else:
            valid: list[str] = []
            for dim_name in dim_refs:
                if not isinstance(dim_name, str):
                    continue
                canonical = canonical_dim_name_by_norm.get(snake_case(dim_name))
                if canonical and canonical not in valid:
                    valid.append(canonical)
            fact["dimensions"] = valid if valid else list(all_dim_names)

    dimensions = consolidate_date_dimensions(
        dimensions,
        facts,
        target_language=target_language,
        table=table,
    )

    return {
        "table_description": table_description,
        "facts": facts,
        "dimensions": dimensions,
    }
