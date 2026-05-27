
from __future__ import annotations

import re
from typing import Any

AUTO_DATE_DIMENSION_NAME = "date"

_DATE_DIMENSION_ALIASES: frozenset[str] = frozenset(
    {"date", "дата", "дату", "datum", "fecha", "data", "dt"}
)

_SKIP_VALUES = frozenset({"-", "—", "–", "n/a", "N/A", "*", "**", ""})


def _snake_case(value: str) -> str:
    return re.sub(r"\W+", "_", str(value).strip().lower()).strip("_")


def is_date_dimension_name(name: str) -> bool:
    """Check whether a field name refers to observation or publication date (any language alias).

    Args:
        name: Dimension or column header name.

    Returns:
        True if the normalized name matches a known date alias.
    """
    normalized = re.sub(r"\W+", "", str(name or "").strip().lower())
    return normalized in _DATE_DIMENSION_ALIASES


def is_date_like_dimension(dim: dict[str, Any]) -> bool:
    """Return True if a dimension definition represents the main observation/publication date axis.

    Args:
        dim: OLAP dimension definition.

    Returns:
        True for temporal type or known date aliases (not maturity/term-only fields).
    """
    name = str(dim.get("name", ""))
    if is_date_dimension_name(name):
        return True
    dim_type = str(dim.get("type", "")).strip().lower()
    if dim_type != "temporal":
        return False
    # Other temporal fields (e.g. month label as category) keep their own dimension.
    normalized = re.sub(r"\W+", "", name.lower())
    return any(hint in normalized for hint in ("date", "дата", "datum", "fecha", "data", "dt", "day", "день"))


def canonical_date_dimension_name(target_language: str) -> str:
    """Return the single canonical date dimension name for the article language.

    Args:
        target_language: ``ukrainian`` or ``english`` (from detect_target_language).

    Returns:
        ``дата`` for Ukrainian content, ``date`` for English.
    """
    return "дата" if str(target_language).strip().lower() == "ukrainian" else AUTO_DATE_DIMENSION_NAME


def find_date_dimension(dimensions: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Locate the primary temporal date dimension in a schema dimension list.

    Args:
        dimensions: OLAP dimension definitions.

    Returns:
        The date dimension dict, or None if not found.
    """
    for dim in dimensions:
        if is_date_like_dimension(dim):
            return dim
    return None


def table_date_field_name(table: dict[str, Any]) -> str | None:
    """Snake_case field name of the first date-labelled column in a parsed HTML table.

    Args:
        table: Parsed table with headers and rows.

    Returns:
        Column key matching build_records / extraction, or None.
    """
    for header in table.get("headers") or []:
        if is_date_dimension_name(str(header)):
            return _snake_case(str(header)) or None
    return None


def extract_date_values_from_table(table: dict[str, Any]) -> list[str]:
    """Collect unique date strings from a dedicated date column in the HTML table.

    Args:
        table: Parsed table with headers and rows.

    Returns:
        Ordered unique date values for chart X-axis when present in the table.
    """
    headers = table.get("headers") or []
    rows = table.get("rows") or []

    date_col_idx: int | None = None
    for idx, header in enumerate(headers):
        if is_date_dimension_name(str(header)):
            date_col_idx = idx
            break

    if date_col_idx is None:
        return []

    values: list[str] = []
    for row in rows:
        if date_col_idx < len(row):
            v = str(row[date_col_idx]).strip()
            if v and v not in _SKIP_VALUES and v not in values:
                values.append(v)
    return values


def _merge_unique_values(*sources: list[str]) -> list[str]:
    merged: list[str] = []
    for source in sources:
        for value in source:
            text = str(value).strip()
            if text and text not in _SKIP_VALUES and text not in merged:
                merged.append(text)
    return merged


def consolidate_date_dimensions(
    dimensions: list[dict[str, Any]],
    facts: list[dict[str, Any]],
    *,
    target_language: str = "ukrainian",
    table: dict[str, Any] | None = None,
    extra_table_dates: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Merge duplicate date/temporal dimensions into exactly one canonical date dimension.

    Removes parallel ``дата`` + ``date`` entries, rewrites fact dimension refs, and unions
    possible_values from duplicates plus any date column in the table.

    Args:
        dimensions: Global dimension list (mutated logically via return value).
        facts: Fact list whose ``dimensions`` refs are updated in place.
        target_language: Article language for canonical naming.
        table: Optional parsed HTML table for observation dates in rows.
        extra_table_dates: Additional date strings from other articles in the subcluster.

    Returns:
        New dimensions list with a single canonical date dimension.
    """
    canonical = canonical_date_dimension_name(target_language)
    table_dates = list(extra_table_dates or [])
    if table:
        table_dates = _merge_unique_values(table_dates, extract_date_values_from_table(table))

    date_like = [d for d in dimensions if is_date_like_dimension(d)]
    non_date = [d for d in dimensions if not is_date_like_dimension(d)]

    if not date_like:
        description = (
            "Дата публікації джерельної статті"
            if canonical == "дата"
            else "Publication date of the source article"
        )
        merged_dim: dict[str, Any] = {
            "name": canonical,
            "description": description,
            "type": "temporal",
            "possible_values": table_dates.copy(),
            "role": "x_axis",
        }
    else:
        merged_values = _merge_unique_values(
            table_dates,
            *[list(d.get("possible_values") or []) for d in date_like],
        )
        primary = next((d for d in date_like if str(d.get("name")) == canonical), None)
        if primary is None and table:
            field = table_date_field_name(table)
            if field:
                primary = next((d for d in date_like if str(d.get("name")) == field), None)
        if primary is None:
            primary = date_like[0]

        description = str(primary.get("description", "")).strip()
        if not description:
            description = (
                "Дата спостереження / дата з таблиці"
                if canonical == "дата"
                else "Observation or table date"
            )

        merged_dim = {
            "name": canonical,
            "description": description,
            "type": "temporal",
            "possible_values": merged_values,
            "role": "x_axis",
        }

    old_names = {str(d.get("name", "")) for d in date_like}

    for fact in facts:
        refs = fact.get("dimensions")
        if not isinstance(refs, list):
            refs = [str(d.get("name", "")) for d in non_date]
        cleaned: list[str] = []
        for ref in refs:
            if not isinstance(ref, str):
                continue
            if ref in old_names or is_date_dimension_name(ref) or is_date_like_dimension({"name": ref, "type": ""}):
                if canonical not in cleaned:
                    cleaned.append(canonical)
                continue
            if ref not in cleaned:
                cleaned.append(ref)
        if canonical not in cleaned:
            cleaned.append(canonical)
        fact["dimensions"] = cleaned

    return non_date + [merged_dim]


def ensure_auto_date_dimension(
    dimensions: list[dict[str, Any]],
    *,
    target_language: str = "ukrainian",
    table: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Guarantee exactly one canonical temporal date dimension.

    Args:
        dimensions: Dimension list from LLM or inference.
        target_language: Article language for canonical naming.
        table: Optional parsed table used to seed possible_values.

    Returns:
        Dimensions list with duplicates merged.
    """
    return consolidate_date_dimensions(
        dimensions,
        [],
        target_language=target_language,
        table=table,
    )


def enrich_date_dimension(
    schema: dict[str, Any],
    table: dict[str, Any],
    article_date: str | None,
    *,
    target_language: str = "ukrainian",
) -> None:
    """Fill and extend date dimension possible_values from table rows and publication date.

    When the table has a date column, all distinct cell values are included (not only
    the first article). Publication date is used only when no table dates exist.

    Args:
        schema: OLAP schema dict (mutated in place).
        table: Parsed HTML table for the article.
        article_date: Publication date fallback when the table has no date column.
        target_language: Article language for canonical date dimension naming.
    """
    dimensions: list[dict[str, Any]] = schema.get("dimensions") or []
    facts: list[dict[str, Any]] = schema.get("facts") or []
    schema["dimensions"] = consolidate_date_dimensions(
        dimensions,
        facts,
        target_language=target_language,
        table=table,
    )

    date_dim = find_date_dimension(schema["dimensions"])
    if date_dim is None:
        return

    date_dim["role"] = "x_axis"
    table_dates = extract_date_values_from_table(table)
    existing = list(date_dim.get("possible_values") or [])
    merged = _merge_unique_values(existing, table_dates)

    if not merged and article_date:
        merged = [str(article_date)]
    elif article_date and not table_dates:
        merged = _merge_unique_values(merged, [str(article_date)])

    date_dim["possible_values"] = merged


def enrich_date_dimension_for_subcluster(
    schema: dict[str, Any],
    articles: list[dict[str, Any]],
    *,
    target_language: str,
) -> None:
    """Union observation dates from every article table in a subcluster into the date dimension.

    Args:
        schema: Subcluster OLAP schema (mutated in place).
        articles: All articles assigned to the subcluster.
        target_language: Article language for canonical naming.
    """
    all_table_dates: list[str] = []
    for article in articles:
        all_table_dates = _merge_unique_values(
            all_table_dates,
            extract_date_values_from_table(article.get("table") or {}),
        )

    dimensions: list[dict[str, Any]] = schema.get("dimensions") or []
    facts: list[dict[str, Any]] = schema.get("facts") or []
    schema["dimensions"] = consolidate_date_dimensions(
        dimensions,
        facts,
        target_language=target_language,
        extra_table_dates=all_table_dates,
    )

    date_dim = find_date_dimension(schema["dimensions"])
    if date_dim is None:
        return

    merged = _merge_unique_values(list(date_dim.get("possible_values") or []), all_table_dates)
    if not merged:
        pub_dates = [
            str(article.get("date", "")).strip()
            for article in articles
            if str(article.get("date", "")).strip()
        ]
        merged = _merge_unique_values(merged, pub_dates)

    date_dim["possible_values"] = merged
