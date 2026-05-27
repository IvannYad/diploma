
from __future__ import annotations

import logging
import math

from pipeline.llm import LlmClient
from pipeline.stages.cluster_news.language import language_name, normalize_label
from pipeline.stages.cluster_news.prompts import (
    SYSTEM_PROMPT_CLASSIFY,
    SYSTEM_PROMPT_GENERATE,
    SYSTEM_PROMPT_MERGE,
)

logger = logging.getLogger(__name__)

ASSIGN_BATCH_SIZE = 10
MAX_ASSIGN_WORKERS = 20


def generate_labels(
    llm: LlmClient,
    texts: list[str],
    languages: list[str],
    batch_size: int,
) -> dict[str, list[str]]:
    """Ask the LLM for candidate topic labels per language, batched by batch_size.

    Args:
        llm: OpenAI client.
        texts: Prepared article texts aligned with languages.
        languages: Per-article language codes.
        batch_size: Max articles per LLM generate call.

    Returns:
        Map of language code to deduplicated label list (fallback ``unclassified``).
    """
    labels_by_lang: dict[str, list[str]] = {}
    if not texts:
        return labels_by_lang

    for lang in sorted(set(languages)):
        indices = [idx for idx, code in enumerate(languages) if code == lang]
        if not indices:
            continue

        lang_texts = [texts[idx] for idx in indices]
        labels: list[str] = []
        batches = math.ceil(len(lang_texts) / batch_size)
        for i in range(batches):
            batch = lang_texts[i * batch_size : (i + 1) * batch_size]
            numbered = "\n".join(f"{idx + 1}. {txt[:400]}" for idx, txt in enumerate(batch))
            user_prompt = (
                f"Generate topic labels for these {len(batch)} news articles. "
                f"The labels must be in { language_name(lang) }.\n"
                f"Articles:\n{numbered}\n"
                'Return JSON object: {"labels": ["label_1", "label_2"]}'
            )
            try:
                response = llm.json_chat(SYSTEM_PROMPT_GENERATE, user_prompt)
                for label in response.get("labels", []):
                    labels.append(normalize_label(str(label)))
            except Exception:
                logger.exception("generate_labels: LLM call failed for lang=%s batch=%d", lang, i)

        deduped = list(dict.fromkeys(labels))
        labels_by_lang[lang] = deduped or ["unclassified"]

    return labels_by_lang


def merge_labels(llm: LlmClient, labels: list[str], language: str) -> list[str]:
    """Consolidate synonymous labels via LLM merge prompt.

    Args:
        llm: OpenAI client.
        labels: Candidate labels for one language.
        language: Language code (for logging).

    Returns:
        Merged label list, or original labels if the LLM call fails.
    """
    if len(labels) <= 1:
        return labels

    user_prompt = (
        "Merge labels that mean the same topic and keep concise labels.\n"
        f"Labels: {labels}\n"
        'Return JSON object: {"merged_labels": ["label_1", "label_2"]}'
    )
    try:
        result = llm.json_chat(SYSTEM_PROMPT_MERGE, user_prompt)
    except Exception:
        logger.exception("merge_labels: LLM call failed for language=%s", language)
        return labels
    merged = [normalize_label(str(x)) for x in result.get("merged_labels", [])]
    merged = list(dict.fromkeys(merged))
    return merged or labels


def assign_label(llm: LlmClient, text: str, merged_labels: list[str], language: str) -> str:
    """Pick exactly one cluster label for an article from the allowed list.

    Args:
        llm: OpenAI client.
        text: Article text snippet.
        merged_labels: Allowed labels for this article's language.
        language: Language code (for logging).

    Returns:
        Assigned label, or ``unclassified`` if LLM fails or picks an invalid label.
    """
    user_prompt = (
        f"Labels: {merged_labels}\n"
        f"Article: {text[:1500]}\n"
        'Return JSON object: {"label": "selected_label"}'
    )
    try:
        result = llm.json_chat(SYSTEM_PROMPT_CLASSIFY, user_prompt)
    except Exception:
        logger.exception("assign_label: LLM call failed")
        return "unclassified"
    selected = normalize_label(str(result.get("label", "unclassified")))
    if selected not in merged_labels:
        return "unclassified"
    return selected


def assign_labels_batch(
    llm: LlmClient,
    texts: list[str],
    merged_labels: list[str],
    language: str,
) -> list[str]:
    """Classify a batch of articles into topic labels with a single LLM call.

    All articles in the batch share the same ``merged_labels`` pool (i.e. they
    belong to the same language group). The model is asked to return one
    1-based ``index → label`` mapping per article; any entry that is missing,
    malformed, or outside the allowed pool falls back to ``"unclassified"``.

    Falls back to :func:`assign_label` when the batch contains only one article
    so the single-article prompt format is reused without change.

    Args:
        llm: OpenAI client (thread-safe).
        texts: Article text snippets, each truncated to 1 500 chars by the caller.
        merged_labels: Allowed labels for this language group.
        language: Language code (for logging).

    Returns:
        List of assigned labels aligned with ``texts``.
    """
    if not texts:
        return []
    if len(texts) == 1:
        return [assign_label(llm, texts[0], merged_labels, language)]

    numbered = "\n".join(f"{i + 1}. {text[:1500]}" for i, text in enumerate(texts))
    user_prompt = (
        f"Labels: {merged_labels}\n"
        f"Articles ({len(texts)} total, numbered 1\u2013{len(texts)}):\n{numbered}\n"
        'Return JSON: {"assignments": [{"index": 1, "label": "selected_label"}, ...]}'
        " \u2014 one entry per article using its 1-based index."
    )
    try:
        result = llm.json_chat(SYSTEM_PROMPT_CLASSIFY, user_prompt)
    except Exception:
        logger.exception(
            "assign_labels_batch: LLM call failed for lang=%s count=%d",
            language,
            len(texts),
        )
        return ["unclassified"] * len(texts)

    raw = result.get("assignments", []) if isinstance(result, dict) else []
    label_by_idx: dict[int, str] = {}
    for entry in raw if isinstance(raw, list) else []:
        if not isinstance(entry, dict):
            continue
        try:
            idx = int(entry.get("index", 0))
        except (TypeError, ValueError):
            continue
        label = normalize_label(str(entry.get("label", "unclassified")))
        if label not in merged_labels:
            label = "unclassified"
        label_by_idx[idx] = label

    return [label_by_idx.get(i + 1, "unclassified") for i in range(len(texts))]
