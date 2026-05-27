
from __future__ import annotations

from typing import Any


def build_article_text(article: dict[str, Any]) -> str:
    """Build a single string from prepared title and body for clustering and LLM labeling.

    Args:
        article: Document containing a ``prepared`` subdocument with title and body_text.

    Returns:
        Combined text used as input for language detection and label assignment.
    """
    prepared = article.get("prepared", {})
    title = str(prepared.get("title", ""))
    body = str(prepared.get("body_text", ""))
    return f"{title}. {body}".strip(". ")


def build_article_text_for_metrics(article: dict[str, Any]) -> str:
    """Build article text for embedding-based clustering metrics (stricter empty-field handling).

    Args:
        article: Clustered article document with optional ``prepared`` fields.

    Returns:
        Non-empty title, body, or title+body string suitable for sentence embeddings.
    """
    prepared = article.get("prepared", {}) if isinstance(article, dict) else {}
    title = str(prepared.get("title", "")).strip()
    body = str(prepared.get("body_text", "")).strip()
    if title and body:
        return f"{title}. {body}"
    return title or body
