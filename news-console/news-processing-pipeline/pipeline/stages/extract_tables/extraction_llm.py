"""LLM batch extraction of OLAP records and per-fact record shaping."""

from __future__ import annotations

from typing import Any

from pipeline.llm import LlmClient
from pipeline.stages.extract_tables.date_dimension import is_date_dimension_name
from pipeline.stages.extract_tables.numbers import to_number
from pipeline.stages.extract_tables.prompts import SYSTEM_PROMPT_EXTRACT


def normalize_per_fact_records(
    record: dict[str, Any],
    schema: dict[str, Any],
    article_date: str | None = None,
) -> list[dict[str, Any]]:
    """Split one wide row into one slim record per fact with only relevant dimensions.

    Args:
        record: Raw row with multiple fact columns.
        schema: Validated OLAP schema.
        article_date: Publication date fallback for the date dimension.

    Returns:
        List of per-fact records suitable for charting.
    """
    all_dim_names = [d["name"] for d in (schema.get("dimensions") or [])]
    results: list[dict[str, Any]] = []

    for fact in schema.get("facts") or []:
        name = str(fact.get("name", "")).strip()
        if not name:
            continue
        value = to_number(record.get(name))
        if value is None:
            continue

        fact_dims: list[str] = fact.get("dimensions") or all_dim_names
        out: dict[str, Any] = {}
        for dim_name in fact_dims:
            if is_date_dimension_name(dim_name):
                out[dim_name] = record.get(dim_name) or article_date
            else:
                out[dim_name] = record.get(dim_name)
        out[name] = value
        results.append(out)

    return results


def extract_batch_llm(
    llm: LlmClient,
    schema: dict[str, Any],
    batch: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    """Extract normalized OLAP records for up to five articles sharing one schema.

    Args:
        llm: OpenAI client.
        schema: Subcluster OLAP schema.
        batch: Articles with table headers and rows.

    Returns:
        Map of article_id to list of per-fact records.
    """
    schema_json = {
        "table_description": schema.get("table_description", ""),
        "facts": schema.get("facts", []),
        "dimensions": schema.get("dimensions", []),
    }

    tables_block: list[dict[str, Any]] = []
    for article in batch:
        table = article.get("table", {})
        tables_block.append(
            {
                "article_id": article.get("article_id", ""),
                "title": article.get("title", ""),
                "date": article.get("date", ""),
                "headers": table.get("headers", []),
                "rows": table.get("rows", []),
            }
        )
    batch_date_by_article_id = {
        str(article.get("article_id", "")).strip(): str(article.get("date", "")).strip() or None
        for article in batch
    }

    user_prompt = (
        "Extract normalized OLAP records for each article table using this schema.\n"
        "Schema:\n"
        f"{schema_json}\n\n"
        "Tables:\n"
        f"{tables_block}\n\n"
        "Return JSON only with key 'articles'."
    )

    parsed = llm.json_chat(SYSTEM_PROMPT_EXTRACT, user_prompt)
    out: dict[str, list[dict[str, Any]]] = {}

    articles = parsed.get("articles", []) if isinstance(parsed, dict) else []
    if not isinstance(articles, list):
        return out

    for item in articles:
        if not isinstance(item, dict):
            continue
        article_id = str(item.get("article_id", "")).strip()
        if not article_id:
            continue
        records = item.get("records", [])
        if not isinstance(records, list):
            records = []
        normalized: list[dict[str, Any]] = []
        for rec in records:
            if isinstance(rec, dict):
                normalized.extend(
                    normalize_per_fact_records(
                        rec,
                        schema,
                        article_date=batch_date_by_article_id.get(article_id),
                    )
                )
        out[article_id] = normalized
    return out
