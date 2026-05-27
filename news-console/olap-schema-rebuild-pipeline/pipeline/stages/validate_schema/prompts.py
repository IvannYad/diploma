"""LLM prompts for the OLAP schema validation stage during rebuild."""

from __future__ import annotations

from typing import Any

from pipeline.stages.validate_schema.formatting import format_samples, format_schema
from pipeline.stages.validate_schema.subset_rules import list_schema_changes

VALIDATION_SYSTEM_PROMPT = """You are an expert OLAP schema validator for a news analytics rebuild pipeline.

Read the user message in order: context, both schemas, the numbered change list, rules,
sample articles, and the required JSON output. Apply the rules exactly."""

MAX_VALIDATION_ARTICLES = 3

_VALIDATION_RULES = """\
- **Narrowing (removals in the change list)** — Always valid. Do not validate removals against
  sample articles. Fewer facts, dimensions, possible_values, or fact-dimension links only shrink
  chart filters and metrics; that is an intentional user choice.
- **Extensions (additions in the change list)** — Must be validated against the sample articles:
  - **Extractability**: each added fact, dimension, possible_value, or fact-dimension link must
    map to a column, decomposable header, or field visible in the sample records.
  - **Chart filters**: each added or newly linked categorical dimension must have distinct,
    meaningful values in the samples suitable for UI filters (not empty, not only placeholders
    like "—", "n/a", "*").
  - **Coherence**: fact dimension lists must reference defined dimensions; types must match the data.
  - Reject an extension only when extraction or usable filters would be impossible.
- **No structural changes** — If the change list says schemas match, return valid=true.
- **Date / temporal dimensions** — Excluded from this comparison. Never flag date nulls or edits.
- **Validate additions only** — Never reject a proposal because something was removed."""

_OUTPUT_FORMAT = """\
Respond with JSON only (no markdown):
{
  "valid": true | false,
  "confidence": 0.0 - 1.0,
  "reason": "One concise sentence. Mention subset narrowing, extensions, or unchanged.",
  "issues": []
}

- Set valid=true when there are no extensions, or every extension passes the rules.
- Set issues to extraction- or filter-blocking problems only when valid=false."""


def build_validation_user_prompt(
    *,
    original_schema: dict[str, Any] | None,
    proposed_schema: dict[str, Any],
    table_samples: list[dict[str, Any]],
    cluster_name: str,
    subcluster_name: str,
    max_articles: int = MAX_VALIDATION_ARTICLES,
) -> str:
    """Assemble the seven-section validation prompt for the LLM user message.

    Args:
        original_schema: Baseline schema (date dims stripped), or None if missing.
        proposed_schema: User-edited schema (date dims stripped).
        table_samples: Dicts with title and table_html keys.
        cluster_name: Cluster label for context.
        subcluster_name: Subcluster id for context.
        max_articles: Cap on sample articles (default 3).

    Returns:
        Full user prompt with sections 1–7 in order.
    """
    capped_samples = table_samples[:max_articles]
    changes = list_schema_changes(original_schema, proposed_schema)
    numbered_changes = "\n".join(f"{i}. {line}" for i, line in enumerate(changes, start=1))

    original_block = (
        format_schema(original_schema)
        if original_schema
        else "(none — no prior schema stored for this subcluster)"
    )

    article_block = (
        format_samples(capped_samples)
        if capped_samples
        else "(no sample tables available)"
    )

    return f"""## 1. You are given

- Cluster: {cluster_name}
- Subcluster: {subcluster_name}
- The **original OLAP schema** auto-generated from extracted news tables in this subcluster.
- The **proposed OLAP schema** edited by the user for rebuild.
- A **numbered list of structural changes** between the two schemas.
- Up to **{max_articles} sample articles** with extracted table records from this subcluster
  (date/temporal columns excluded).

Your task: decide whether the proposed schema is valid for rebuild — especially whether
any **additions** in the change list can be extracted from the samples and used as chart filters.

## 2. Original schema

{original_block}

## 3. Proposed schema

{format_schema(proposed_schema)}

## 4. Changes between schemas

{numbered_changes}

## 5. Validation rules

{_VALIDATION_RULES}

## 6. Sample articles from this subcluster (max {max_articles})

{article_block}

## 7. Output

{_OUTPUT_FORMAT}"""
