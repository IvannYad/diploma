"""Rule-based OLAP record extraction when table columns align with the schema field names."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from pipeline.llm import LlmClient
from pipeline.stages.extract_tables.date_dimension import is_date_dimension_name
from pipeline.stages.extract_tables.extraction_llm import normalize_per_fact_records
from pipeline.stages.extract_tables.html_tables import build_records
from pipeline.stages.extract_tables.numbers import to_number


def table_keys_align_with_schema(table: dict[str, Any], schema: dict[str, Any]) -> bool:
    """Return True when parsed row keys cover all schema facts and non-date dimensions.

    Used to decide whether LLM extraction is required (composite headers need decomposition).

    Args:
        table: Parsed HTML table.
        schema: Validated OLAP schema for the subcluster.

    Returns:
        True if deterministic row parsing can populate the schema without LLM.
    """
    records = build_records(table)
    if not records:
        return False

    row_keys: set[str] = set()
    for row in records[:8]:
        row_keys.update(str(k) for k in row.keys())

    for fact in schema.get("facts") or []:
        name = str(fact.get("name", "")).strip()
        if name and name not in row_keys:
            return False

    for dim in schema.get("dimensions") or []:
        name = str(dim.get("name", "")).strip()
        if not name or is_date_dimension_name(name):
            continue
        if name not in row_keys:
            return False

    return True


def extract_article_deterministic(
    article: dict[str, Any],
    schema: dict[str, Any],
) -> list[dict[str, Any]]:
    """Build per-fact OLAP records from HTML rows using the same path as the LLM fallback.

    Args:
        article: Article with table, date, and article_id.
        schema: Subcluster OLAP schema.

    Returns:
        Normalized per-fact records (may be empty if no numeric facts parse).
    """
    table = article.get("table") or {}
    article_date = str(article.get("date", "") or "").strip() or None
    results: list[dict[str, Any]] = []

    for row in build_records(table):
        results.extend(normalize_per_fact_records(row, schema, article_date=article_date))

    return results


def deterministic_records_are_usable(
    records: list[dict[str, Any]],
    schema: dict[str, Any],
) -> bool:
    """Check that deterministic extraction produced numeric values for schema facts.

    Args:
        records: Output of extract_article_deterministic.
        schema: Subcluster OLAP schema.

    Returns:
        True when at least one record exists and every fact has a parsed numeric value somewhere.
    """
    if not records:
        return False

    fact_names = [str(f.get("name", "")).strip() for f in (schema.get("facts") or [])]
    fact_names = [n for n in fact_names if n]
    if not fact_names:
        return False

    found: set[str] = set()
    for record in records:
        for name in fact_names:
            if to_number(record.get(name)) is not None:
                found.add(name)

    return len(found) == len(fact_names)


def extract_batch_with_deterministic_fallback(
    llm: LlmClient,
    schema: dict[str, Any],
    batch: list[dict[str, Any]],
    extract_batch_llm_fn: Callable[
        [LlmClient, dict[str, Any], list[dict[str, Any]]],
        dict[str, list[dict[str, Any]]],
    ],
) -> tuple[dict[str, list[dict[str, Any]]], int, int]:
    """Extract records per article: deterministic when possible, LLM only for the rest.

    Args:
        llm: OpenAI client (forwarded to LLM extraction).
        schema: Subcluster OLAP schema.
        batch: Articles with parsed tables.
        extract_batch_llm_fn: LLM batch extractor (typically extract_batch_llm).

    Returns:
        Tuple of (article_id -> records, deterministic_article_count, llm_batch_calls).
    """
    out: dict[str, list[dict[str, Any]]] = {}
    needs_llm: list[dict[str, Any]] = []
    deterministic_count = 0

    for article in batch:
        article_id = str(article.get("article_id", "")).strip()
        table = article.get("table") or {}
        if table_keys_align_with_schema(table, schema):
            records = extract_article_deterministic(article, schema)
            if deterministic_records_are_usable(records, schema):
                out[article_id] = records
                deterministic_count += 1
                continue
        needs_llm.append(article)

    llm_calls = 0
    if needs_llm:
        llm_out = extract_batch_llm_fn(llm, schema, needs_llm)
        llm_calls = 1
        for article in needs_llm:
            article_id = str(article.get("article_id", "")).strip()
            records = llm_out.get(article_id)
            if records:
                out[article_id] = records

    return out, deterministic_count, llm_calls
