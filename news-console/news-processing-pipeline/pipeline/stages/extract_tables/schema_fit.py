"""Schema-fit orchestration: header pre-filter, parallel LLM checks, same winner selection."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from pipeline.llm import LlmClient
from pipeline.stages.extract_tables.schema_llm import schema_fit_llm
from pipeline.stages.extract_tables.table_similarity import header_overlap_ratio

logger = logging.getLogger(__name__)

# Below this Jaccard header overlap, skip the LLM call (extremely unlikely to be a fit).
HEADER_SKIP_LLM_THRESHOLD = 0.25

# At or above this overlap the table structures are near-identical; assign without LLM.
HEADER_AUTO_ASSIGN_THRESHOLD = 0.90

MAX_FIT_WORKERS = 4


def _reference_table(candidate: dict[str, Any]) -> dict[str, Any]:
    articles = candidate.get("articles") or []
    if not articles:
        return {}
    return articles[0].get("table") or {}


def _run_single_fit(
    llm: LlmClient,
    candidate: dict[str, Any],
    article: dict[str, Any],
) -> tuple[dict[str, Any], bool, float, str, bool]:
    """Call schema_fit_llm for one candidate subcluster.

    Returns:
        Tuple of (candidate, suitable, confidence, reason, llm_was_called).
    """
    try:
        suitable, confidence, reason = schema_fit_llm(llm, candidate["schema"], article)
        return candidate, suitable, confidence, reason, True
    except Exception:
        logger.exception(
            "schema_fit_llm failed for sc_id=%s article=%s",
            candidate.get("sc_id", ""),
            article.get("article_id", ""),
        )
        return candidate, False, 0.0, "fit-evaluation error", True


def find_best_subcluster_for_article(
    llm: LlmClient,
    subclusters: list[dict[str, Any]],
    article: dict[str, Any],
) -> tuple[dict[str, Any] | None, int, int]:
    """Pick the suitable subcluster with highest confidence.

    Two-stage gating:
    1. Overlap >= HEADER_AUTO_ASSIGN_THRESHOLD → assign immediately, no LLM call.
       Among multiple auto-assign candidates, the one with the highest overlap wins.
    2. HEADER_SKIP_LLM_THRESHOLD <= overlap < HEADER_AUTO_ASSIGN_THRESHOLD → LLM fit check.
    3. Overlap < HEADER_SKIP_LLM_THRESHOLD → skip entirely.

    Args:
        llm: OpenAI client.
        subclusters: Existing subclusters in the cluster.
        article: Article being assigned.

    Returns:
        Tuple of (assigned subcluster or None, fit_llm_calls, fit_skips).
    """
    article_table = article.get("table") or {}
    llm_candidates: list[dict[str, Any]] = []
    fit_skips = 0

    best_auto: dict[str, Any] | None = None
    best_auto_overlap = -1.0

    for candidate in reversed(subclusters):
        overlap = header_overlap_ratio(article_table, _reference_table(candidate))

        if overlap >= HEADER_AUTO_ASSIGN_THRESHOLD:
            if overlap > best_auto_overlap:
                best_auto = candidate
                best_auto_overlap = overlap
            continue

        if overlap < HEADER_SKIP_LLM_THRESHOLD:
            fit_skips += 1
            logger.debug(
                "Skipped schema fit sc_id=%s article=%s overlap=%.2f",
                candidate.get("sc_id", ""),
                article.get("article_id", ""),
                overlap,
            )
            continue

        llm_candidates.append(candidate)

    if best_auto is not None:
        logger.info(
            "Auto-assigned sc_id=%s article=%s overlap=%.2f (>= auto-assign threshold)",
            best_auto.get("sc_id", ""),
            article.get("article_id", ""),
            best_auto_overlap,
        )
        return best_auto, 0, fit_skips

    if not llm_candidates:
        return None, 0, fit_skips

    assigned: dict[str, Any] | None = None
    best_confidence = -1.0
    fit_calls = 0

    def apply_result(candidate: dict[str, Any], suitable: bool, confidence: float, reason: str) -> None:
        nonlocal assigned, best_confidence
        logger.info(
            "Schema fit check sc_id=%s article=%s suitable=%s confidence=%.2f reason=%s",
            candidate.get("sc_id", ""),
            article.get("article_id", ""),
            suitable,
            confidence,
            reason,
        )
        if suitable and confidence > best_confidence:
            assigned = candidate
            best_confidence = confidence

    if len(llm_candidates) == 1:
        candidate, suitable, confidence, reason, _ = _run_single_fit(llm, llm_candidates[0], article)
        fit_calls += 1
        apply_result(candidate, suitable, confidence, reason)
        return assigned, fit_calls, fit_skips

    workers = min(MAX_FIT_WORKERS, len(llm_candidates))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(_run_single_fit, llm, candidate, article): candidate
            for candidate in llm_candidates
        }
        for future in as_completed(futures):
            candidate, suitable, confidence, reason, _ = future.result()
            fit_calls += 1
            apply_result(candidate, suitable, confidence, reason)

    return assigned, fit_calls, fit_skips
