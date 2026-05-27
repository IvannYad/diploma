
from __future__ import annotations

import re
from typing import Any

from pipeline.stages.regenerate_configs.chart_rules import display_name

_MAX_LABEL_WORDS = 5
_MAX_LABEL_CHARS = 48
_MAX_TITLE_WORDS = 6
_MAX_DESCRIPTION_WORDS = 18
_MAX_DESCRIPTION_CHARS = 140
_MAX_JUSTIFICATION_WORDS = 12

# Long schema phrases → compact UI labels (substring match, lowercased).
_LABEL_REPLACEMENTS: tuple[tuple[str, str], ...] = (
    ("publication date of the source article", "Date"),
    ("дата публікації джерельної статті", "Дата"),
    ("дата спостереження / дата з таблиці", "Дата"),
    ("observation or table date", "Date"),
    ("numeric metric for", ""),
    ("categorical dimension for", ""),
)


def detect_schema_language(schema: dict[str, Any]) -> str:
    """Guess ukrainian vs english from schema names and descriptions.

    Args:
        schema: OLAP schema with table_description, facts, dimensions.

    Returns:
        ``ukrainian`` or ``english``.
    """
    chunks: list[str] = [str(schema.get("table_description", ""))]
    for fact in schema.get("facts") or []:
        chunks.append(str(fact.get("name", "")))
        chunks.append(str(fact.get("description", "")))
    for dim in schema.get("dimensions") or []:
        chunks.append(str(dim.get("name", "")))
        chunks.append(str(dim.get("description", "")))
    text = " ".join(chunks)
    cyrillic = len(re.findall(r"[А-Яа-яІіЇїЄєҐґ]", text))
    latin = len(re.findall(r"[A-Za-z]", text))
    return "ukrainian" if cyrillic > latin else "english"


def _collapse_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip())


def _first_clause(text: str) -> str:
    """Keep the first sentence or clause before punctuation."""
    text = _collapse_whitespace(text)
    if not text:
        return ""
    for sep in (". ", "; ", " — ", " – ", ", "):
        if sep in text:
            return text.split(sep, 1)[0].strip()
    return text


def shorten_text(
    text: str,
    *,
    max_chars: int = _MAX_LABEL_CHARS,
    max_words: int | None = _MAX_LABEL_WORDS,
) -> str:
    """Trim text to a short label while keeping the leading semantic content.

    Args:
        text: Source phrase.
        max_chars: Hard character limit.
        max_words: Optional word limit applied before char cap.

    Returns:
        Shortened string.
    """
    text = _first_clause(text)
    if not text:
        return ""

    lowered = text.lower()
    for needle, replacement in _LABEL_REPLACEMENTS:
        if needle in lowered:
            if replacement:
                return replacement
            text = re.sub(re.compile(re.escape(needle), re.I), "", text).strip()
            text = _collapse_whitespace(text)

    if max_words is not None:
        words = text.split()
        if len(words) > max_words:
            text = " ".join(words[:max_words])

    if len(text) > max_chars:
        text = text[: max_chars - 1].rsplit(" ", 1)[0].strip()
        if text.endswith(","):
            text = text[:-1].strip()

    return text


def field_label(name: str, description: str = "") -> str:
    """Compact label for a fact or dimension (prefer short description, else display name).

    Args:
        name: snake_case field name.
        description: Optional schema description.

    Returns:
        Short human-readable label.
    """
    name = str(name or "").strip()
    desc = _collapse_whitespace(str(description or ""))
    if desc:
        short = shorten_text(desc, max_chars=_MAX_LABEL_CHARS, max_words=_MAX_LABEL_WORDS)
        if short:
            return short
    return display_name(name)


def short_table_topic(table_description: str, *, language: str) -> str:
    """Extract a brief chart topic phrase from the table description.

    Args:
        table_description: OLAP table_description field.
        language: ``ukrainian`` or ``english``.

    Returns:
        Short topic string, or empty if none.
    """
    text = shorten_text(
        _first_clause(table_description),
        max_chars=60,
        max_words=_MAX_TITLE_WORDS,
    )
    if text:
        return text
    return "Дані" if language == "ukrainian" else "Data"


def chart_title(schema: dict[str, Any], *, language: str) -> str:
    """Build a minimal chart title with the selected-fact placeholder.

    Args:
        schema: OLAP schema.
        language: Article language code.

    Returns:
        Title template string.
    """
    topic = short_table_topic(str(schema.get("table_description", "")), language=language)
    if language == "ukrainian":
        return f"{topic} — {{{{selected_fact_label}}}}"
    return f"{{{{selected_fact_label}}}} — {topic}"


def chart_description(schema: dict[str, Any], *, language: str) -> str:
    """One short sentence describing what the chart shows.

    Args:
        schema: OLAP schema.
        language: Article language code.

    Returns:
        Brief description for the chart config.
    """
    raw = _collapse_whitespace(str(schema.get("table_description", "")))
    if raw:
        text = shorten_text(
            raw,
            max_chars=_MAX_DESCRIPTION_CHARS,
            max_words=_MAX_DESCRIPTION_WORDS,
        )
        if text:
            return text
    if language == "ukrainian":
        return "Динаміка показника за обраним фільтром."
    return "Metric trend for the active filters."


def short_justification(text: str) -> str:
    """Compress chart-type justification to one brief phrase.

    Args:
        text: Rule-based justification string.

    Returns:
        Short justification.
    """
    return shorten_text(text, max_chars=90, max_words=_MAX_JUSTIFICATION_WORDS)


def x_axis_label(x_label: str, x_field: str, *, language: str) -> str:
    """Short X-axis label.

    Args:
        x_label: Label from detect_x_axis_strategy.
        x_field: Field name.
        language: Article language code.

    Returns:
        Compact axis label.
    """
    if x_field in ("date", "дата") or "date" in x_field.lower() or x_field.lower() == "дата":
        return "Дата" if language == "ukrainian" else "Date"
    return field_label(x_field, x_label)


def data_model_note(strategy: str, *, language: str) -> str:
    """Short note on what each point represents.

    Args:
        strategy: ``temporal_dimension`` or ``article_date``.
        language: Article language code.

    Returns:
        One short phrase.
    """
    if strategy == "temporal_dimension":
        return "Один рядок таблиці" if language == "ukrainian" else "One table row"
    return "Одна стаття" if language == "ukrainian" else "One article"


def aggregation_explanation(method: str, *, language: str) -> str:
    """Short aggregation explanation for the data model.

    Args:
        method: Aggregation method name.
        language: Article language code.

    Returns:
        Brief explanation.
    """
    if language == "ukrainian":
        return {
            "last": "Останнє значення в групі",
            "avg": "Середнє в групі",
            "sum": "Сума в групі",
            "first": "Перше значення в групі",
        }.get(method, "Агрегація в групі")
    return {
        "last": "Last value in group",
        "avg": "Average in group",
        "sum": "Sum in group",
        "first": "First value in group",
    }.get(method, "Grouped aggregation")
