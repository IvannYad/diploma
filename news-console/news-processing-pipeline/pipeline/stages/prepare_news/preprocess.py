
from __future__ import annotations

import re


def preprocess_text(text: str) -> str:
    """Normalize raw text for clustering: strip HTML noise, lowercase, keep Cyrillic/Latin words.

    Args:
        text: Raw title or body fragment.

    Returns:
        Cleaned single-line string suitable for storage in prepared_news.
    """
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.lower()
    text = re.sub(r"http\S+|www\S+", "", text)
    text = re.sub(r"\d+", "", text)
    text = re.sub(r"[^\w\s\-а-яА-ЯіїєґІЇЄҐ]", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text).strip()
    return text
