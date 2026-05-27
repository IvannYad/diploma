
from __future__ import annotations

import json
from typing import Any

from pipeline.llm import LlmClient
from pipeline.stages.chart_configs.prompts import SYSTEM_PROMPT_CHART


def build_chart_user_prompt(
    schema: dict[str, Any],
    x_axis: dict[str, str],
    rule_chart_type: str,
    rule_justification: str,
    sample_records: list[dict[str, Any]],
) -> str:
    """Compose the user message for chart LLM including schema, X-axis strategy, and samples.

    Args:
        schema: OLAP schema.
        x_axis: Pre-detected X-axis strategy.
        rule_chart_type: Heuristic chart type suggestion.
        rule_justification: Heuristic explanation.
        sample_records: Example OLAP rows for context.

    Returns:
        User prompt string.
    """
    facts_json = json.dumps(schema.get("facts", []), ensure_ascii=False, indent=2)
    dims_json = json.dumps(schema.get("dimensions", []), ensure_ascii=False, indent=2)
    sample_json = json.dumps(sample_records[:5], ensure_ascii=False, indent=2)

    if x_axis["strategy"] == "temporal_dimension":
        x_block = (
            f"x_axis_strategy: temporal_dimension\n"
            f"x_field: {x_axis['x_field']}\n"
            f"x_label: {x_axis['x_label']}\n"
            "granularity: per_record"
        )
    else:
        x_block = (
            "x_axis_strategy: article_date\n"
            "x_field: date\n"
            "x_label: Дата публікації\n"
            "granularity: per_article"
        )

    return "\n\n".join(
        [
            "Build a single chart configuration for this OLAP schema.",
            "OLAP schema:",
            f"table_description: {schema.get('table_description', '')}",
            f"facts:\n{facts_json}",
            f"dimensions:\n{dims_json}",
            "Pre-detected x-axis strategy:",
            x_block,
            f"Rule-based suggested chart_type: {rule_chart_type}",
            f"Rule-based justification: {rule_justification}",
            f"Sample records:\n{sample_json}",
            "Return JSON only.",
        ]
    )


def generate_chart_with_llm(
    llm: LlmClient,
    schema: dict[str, Any],
    x_axis: dict[str, str],
    rule_chart_type: str,
    rule_justification: str,
    sample_records: list[dict[str, Any]],
) -> dict[str, Any]:
    """Call the LLM to produce one chart configuration JSON for a subcluster.

    Args:
        llm: OpenAI client.
        schema: OLAP schema.
        x_axis: X-axis strategy metadata.
        rule_chart_type: Suggested chart type from rules.
        rule_justification: Suggested justification from rules.
        sample_records: Sample extracted records.

    Returns:
        Parsed chart configuration dict from the model.
    """
    user_prompt = build_chart_user_prompt(
        schema=schema,
        x_axis=x_axis,
        rule_chart_type=rule_chart_type,
        rule_justification=rule_justification,
        sample_records=sample_records,
    )
    return llm.json_chat(SYSTEM_PROMPT_CHART, user_prompt)
