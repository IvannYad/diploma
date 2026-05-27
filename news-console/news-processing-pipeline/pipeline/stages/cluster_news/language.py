"""Language detection and label normalization for clustering."""

from __future__ import annotations

import re


def normalize_label(label: str) -> str:
    """Convert an LLM label to canonical snake_case for storage and comparison.

    Args:
        label: Raw label string from the model.

    Returns:
        Normalized label, or ``unclassified`` if empty after cleanup.
    """
    value = label.strip().lower()
    value = re.sub(r"\s+", "_", value)
    value = re.sub(r"[^\w\-а-яА-ЯіїєґІЇЄҐ]", "_", value)
    value = re.sub(r"_+", "_", value).strip("_")
    return value or "unclassified"


def detect_language(text: str) -> str:
    """Heuristically detect article language from character distributions.

    Args:
        text: Combined title and body text.

    Returns:
        Language code: ``en``, ``uk``, ``ru``, or ``unknown``.
    """
    sample = (text or "")[:4000].lower()
    if not sample.strip():
        return "unknown"

    latin_chars = re.findall(r"[a-z]", sample)
    cyrillic_chars = re.findall(r"[а-яёіїєґ]", sample)

    if len(latin_chars) > len(cyrillic_chars) * 1.3:
        return "en"

    uk_markers = len(re.findall(r"[іїєґ]", sample))
    ru_markers = len(re.findall(r"[ыэёъ]", sample))

    if len(cyrillic_chars) > 0:
        if uk_markers >= ru_markers:
            return "uk"
        return "ru"

    return "unknown"


def language_name(lang_code: str) -> str:
    """Map a language code to an English name for LLM prompts.

    Args:
        lang_code: Code from detect_language.

    Returns:
        Human-readable language name for prompt conditioning.
    """
    if lang_code == "uk":
        return "Ukrainian"
    if lang_code == "ru":
        return "Russian"
    if lang_code == "en":
        return "English"
    return "the same language as the text"
