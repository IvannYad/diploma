"""LLM calls to infer OLAP schemas and check schema fit for new articles."""

from __future__ import annotations

from typing import Any

from pipeline.llm import LlmClient
from pipeline.stages.extract_tables.html_tables import table_preview
from pipeline.stages.extract_tables.prompts import SYSTEM_PROMPT_SCHEMA, SYSTEM_PROMPT_SCHEMA_FIT
from pipeline.stages.extract_tables.schema_infer import detect_target_language


def extract_schema_for_article_llm(
    llm: LlmClient,
    cluster_label: str,
    article: dict[str, Any],
) -> dict[str, Any]:
    """Request a full OLAP schema for one article table via LLM.

    Args:
        llm: OpenAI client.
        cluster_label: Parent cluster topic label.
        article: Article payload with table, title, date.

    Returns:
        Parsed JSON schema from the model.
    """
    target_language = detect_target_language([article])
    table = article.get("table", {})
    block = "\n".join(
        [
            "--- TABLE 1 ---",
            f"article_id: {article.get('article_id', '')}",
            f"title: {article.get('title', '')}",
            f"date: {article.get('date', '')}",
            table_preview(table, max_rows=15),
        ]
    )

    user_prompt = "\n\n".join(
        [
            f"Cluster label: {cluster_label}",
            f"Target language for names/descriptions: {target_language}",
            "Infer one OLAP schema for this article and its table.",
            "Output JSON only.",
            "",
            "Tables:",
            block,
        ]
    )
    return llm.json_chat(SYSTEM_PROMPT_SCHEMA, user_prompt)


def schema_fit_llm(
    llm: LlmClient,
    schema: dict[str, Any],
    article: dict[str, Any],
) -> tuple[bool, float, str]:
    """Ask whether an existing subcluster schema can represent another article's table.

    Args:
        llm: OpenAI client.
        schema: Candidate subcluster OLAP schema.
        article: New article with table to evaluate.

    Returns:
        Tuple of (suitable, confidence, reason).
    """
    table = article.get("table", {})
    user_prompt = "\n\n".join(
        [
            "Evaluate whether this article table fits the existing OLAP schema.",
            "Existing schema:",
            str(
                {
                    "table_description": schema.get("table_description", ""),
                    "facts": schema.get("facts", []),
                    "dimensions": schema.get("dimensions", []),
                }
            ),
            "Article table:",
            "\n".join(
                [
                    f"article_id: {article.get('article_id', '')}",
                    f"title: {article.get('title', '')}",
                    f"date: {article.get('date', '')}",
                    table_preview(table, max_rows=12),
                ]
            ),
            "Return JSON only.",
        ]
    )

    result = llm.json_chat(SYSTEM_PROMPT_SCHEMA_FIT, user_prompt)
    if not isinstance(result, dict):
        return False, 0.0, "Invalid fit-response shape"

    suitable = bool(result.get("suitable", False))
    confidence = float(result.get("confidence", 0.0) or 0.0)
    reason = str(result.get("reason", ""))
    return suitable, confidence, reason
