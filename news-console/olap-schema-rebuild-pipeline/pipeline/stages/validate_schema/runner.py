
from __future__ import annotations

import logging
from typing import Any

from pymongo.database import Database

from pipeline.config import RebuildConfig
from pipeline.llm import LlmClient
from pipeline.progress import PipelineProgress
from pipeline.stages.validate_schema.formatting import (
    format_records_as_text,
    is_date_dimension,
    strip_date_keys_from_records,
)
from pipeline.stages.validate_schema.prompts import (
    MAX_VALIDATION_ARTICLES,
    VALIDATION_SYSTEM_PROMPT,
    build_validation_user_prompt,
)
from pipeline.stages.validate_schema.subset_rules import (
    is_pure_subset_schema,
    prepare_schemas_for_comparison,
)

logger = logging.getLogger(__name__)


def _collect_date_dim_names(schema: dict[str, Any]) -> set[str]:
    """Return the set of date/temporal dimension field names from a schema.

    Args:
        schema: OLAP schema with a dimensions list.

    Returns:
        Set of dimension name strings identified as date/temporal.
    """
    return {
        str(d.get("name", ""))
        for d in (schema.get("dimensions") or [])
        if is_date_dimension(d)
    }


def _extract_schema_body(doc: dict[str, Any] | None) -> dict[str, Any] | None:
    """Pull facts/dimensions/table_description from a flat or nested MongoDB document.

    Args:
        doc: Raw MongoDB document.

    Returns:
        Schema body dict, or None if the document has no schema fields.
    """
    if not doc:
        return None
    if doc.get("facts") or doc.get("dimensions"):
        return {
            "table_description": doc.get("table_description", ""),
            "facts": doc.get("facts", []),
            "dimensions": doc.get("dimensions", []),
        }
    nested = doc.get("olap_schema")
    if isinstance(nested, dict) and (nested.get("facts") or nested.get("dimensions")):
        return {
            "table_description": nested.get("table_description", ""),
            "facts": nested.get("facts", []),
            "dimensions": nested.get("dimensions", []),
        }
    return None


def _fetch_original_schema(
    db: Database,
    config: RebuildConfig,
    cluster_name: str,
    subcluster_name: str,
) -> dict[str, Any] | None:
    """Load the current OLAP schema for the subcluster from the main database.

    Tries flat per-subcluster documents first, then chart_configs.olap_schema,
    then the nested olap_schemas index document.

    Args:
        db: Main MongoDB database.
        config: Rebuild configuration.
        cluster_name: Target cluster_label.
        subcluster_name: Target sc_id.

    Returns:
        Schema body dict, or None if not found.
    """
    flat = db[config.schemas_collection].find_one(
        {"cluster_label": cluster_name, "sc_id": subcluster_name},
        {"_id": 0, "facts": 1, "dimensions": 1, "table_description": 1, "olap_schema": 1},
    )
    body = _extract_schema_body(flat)
    if body:
        return body

    chart = db[config.chart_configs_collection].find_one(
        {"cluster_label": cluster_name, "sc_id": subcluster_name},
        {"_id": 0, "olap_schema": 1},
    )
    body = _extract_schema_body(chart)
    if body:
        return body

    index_doc = db[config.schemas_collection].find_one(
        {"source": "olap_schemas"},
        {"_id": 0, "schemas": 1},
    )
    if isinstance(index_doc, dict):
        schemas = index_doc.get("schemas", {})
        if isinstance(schemas, dict):
            cluster = schemas.get(cluster_name, {})
            if isinstance(cluster, dict):
                nested = cluster.get(subcluster_name)
                if isinstance(nested, dict):
                    return _extract_schema_body(nested)
    return None


def run_validate_schema(
    db: Database,
    config: RebuildConfig,
    llm: LlmClient,
    progress: PipelineProgress,
    cluster_name: str,
    subcluster_name: str,
    proposed_schema: dict[str, Any],
) -> tuple[bool, str | None]:
    """Check whether the proposed schema is a valid (sub)set of the existing schema.

    Loads sample records from extracted_news, strips auto-generated date dimensions from
    both schemas and from the sample records, then asks the LLM whether the proposed
    schema can extract data without semantic breakage.

    A schema with fewer dimensions or narrower possible_values is always valid — it means
    the user intentionally narrowed the scope. Only structurally impossible schemas
    (fact names absent from sample data) are rejected.

    Args:
        db: Main MongoDB database.
        config: Rebuild configuration (collections, sample_size).
        llm: OpenAI client for JSON validation response.
        progress: Progress tracker for stage 0.
        cluster_name: Target cluster_label.
        subcluster_name: Target sc_id.
        proposed_schema: User-edited schema (facts, dimensions).

    Returns:
        Tuple of (is_valid, error_reason). error_reason is None when valid.

    Raises:
        Exception: Re-raised after logging on unexpected failures.
    """
    progress.start_stage(0, "Validate Schema", 1)

    try:
        extracted_doc = db[config.extracted_collection].find_one(
            {"cluster_label": cluster_name, "sc_id": subcluster_name},
            {"articles": 1},
        )

        if not extracted_doc:
            progress.info(f"No extracted_news document for {cluster_name}/{subcluster_name}")
            progress.complete_stage({"status": "no_data"})
            return False, f"No articles found in subcluster {cluster_name}/{subcluster_name}"

        raw_articles: list[dict] = extracted_doc.get("articles", []) or []
        article_limit = min(config.sample_size, MAX_VALIDATION_ARTICLES)
        sample_articles = raw_articles[:article_limit]

        if not sample_articles:
            progress.info("No articles found in subcluster for validation")
            progress.complete_stage({"status": "no_data"})
            return False, f"No articles found in subcluster {cluster_name}/{subcluster_name}"

        progress.update(message=f"Found {len(sample_articles)} sample articles")

        # Collect date dimension names from the proposed schema so we can strip them
        # from both the schemas and sample records before handing to the LLM.
        date_dim_names = _collect_date_dim_names(proposed_schema)

        table_samples = []
        for article in sample_articles:
            records = article.get("records", [])
            if not records:
                continue
            cleaned_records = strip_date_keys_from_records(records[:10], date_dim_names)
            table_samples.append({
                "title": article.get("title", ""),
                "table_html": format_records_as_text(cleaned_records),
            })

        if not table_samples:
            progress.complete_stage({"status": "no_tables"})
            return False, "No extracted records found in sample articles"

        original_schema = _fetch_original_schema(db, config, cluster_name, subcluster_name)
        original_for_llm, proposed_for_llm = prepare_schemas_for_comparison(
            original_schema,
            proposed_schema,
        )

        if original_for_llm:
            is_subset, subset_reason = is_pure_subset_schema(original_for_llm, proposed_for_llm)
            if is_subset:
                progress.info(f"Schema validation passed (subset): {subset_reason}")
                progress.complete_stage({"status": "valid", "mode": "subset", "reason": subset_reason})
                return True, None

        user_prompt = build_validation_user_prompt(
            original_schema=original_for_llm,
            proposed_schema=proposed_for_llm,
            table_samples=table_samples,
            cluster_name=cluster_name,
            subcluster_name=subcluster_name,
            max_articles=article_limit,
        )

        result = llm.json_chat(VALIDATION_SYSTEM_PROMPT, user_prompt)

        is_valid = result.get("valid", False)
        reason = result.get("reason", "")
        issues = result.get("issues", [])

        if not is_valid:
            reason_str = f"{reason}. Issues: {', '.join(issues)}" if issues else reason
            progress.info(f"Schema validation failed: {reason_str}")
            progress.complete_stage({"status": "invalid", "reason": reason_str})
            return False, reason_str

        progress.info(f"Schema validation passed (confidence: {result.get('confidence', 0.0)})")
        progress.complete_stage({"status": "valid", "confidence": result.get("confidence", 0.0)})
        return True, None

    except Exception as exc:
        logger.exception("Schema validation error")
        progress.pipeline_error(str(exc))
        raise
