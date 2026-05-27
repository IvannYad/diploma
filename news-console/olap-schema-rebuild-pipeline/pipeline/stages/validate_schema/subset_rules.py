"""Deterministic rules and schema diffs for OLAP rebuild validation."""

from __future__ import annotations

from typing import Any

from pipeline.stages.validate_schema.formatting import is_date_dimension, strip_date_dimensions


def _fact_names(schema: dict[str, Any]) -> set[str]:
    return {
        str(f.get("name", "")).strip()
        for f in (schema.get("facts") or [])
        if str(f.get("name", "")).strip()
    }


def _dimension_map(schema: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(d.get("name", "")).strip(): d
        for d in (schema.get("dimensions") or [])
        if str(d.get("name", "")).strip() and not is_date_dimension(d)
    }


def _fact_dimension_refs(schema: dict[str, Any]) -> dict[str, set[str]]:
    result: dict[str, set[str]] = {}
    for fact in schema.get("facts") or []:
        name = str(fact.get("name", "")).strip()
        if not name:
            continue
        refs = fact.get("dimensions") or []
        if isinstance(refs, list):
            result[name] = {str(d).strip() for d in refs if str(d).strip()}
        else:
            result[name] = set()
    return result


def _normalize_values(values: list[Any]) -> set[str]:
    result: set[str] = set()
    for value in values:
        text = str(value).strip()
        if text and text.lower() not in {"none", "null", ""}:
            result.add(text)
    return result


def list_schema_changes(
    original: dict[str, Any] | None,
    proposed: dict[str, Any],
) -> list[str]:
    """Enumerate each structural difference between original and proposed schemas.

    One human-readable line per change (removals and additions). Date/temporal
    dimensions are excluded from comparison.

    Args:
        original: Baseline schema, or None when validating without a prior schema.
        proposed: User-edited schema (date dimensions should already be stripped).

    Returns:
        Ordered list of change descriptions; empty when schemas match.
    """
    if original is None:
        return ["No original schema on record — treat the proposed schema as a new baseline."]

    changes: list[str] = []

    original_facts = _fact_names(original)
    proposed_facts = _fact_names(proposed)
    for name in sorted(original_facts - proposed_facts):
        changes.append(f"Removed fact: {name}")
    for name in sorted(proposed_facts - original_facts):
        changes.append(f"Added fact: {name}")

    original_dims = _dimension_map(original)
    proposed_dims = _dimension_map(proposed)
    for name in sorted(set(original_dims) - set(proposed_dims)):
        changes.append(f"Removed dimension: {name}")
    for name in sorted(set(proposed_dims) - set(original_dims)):
        changes.append(f"Added dimension: {name}")

    for name in sorted(set(original_dims) & set(proposed_dims)):
        original_values = _normalize_values(original_dims[name].get("possible_values") or [])
        proposed_values = _normalize_values(proposed_dims[name].get("possible_values") or [])
        for value in sorted(original_values - proposed_values):
            changes.append(f"Dimension '{name}' - removed possible_value: {value}")
        for value in sorted(proposed_values - original_values):
            changes.append(f"Dimension '{name}' - added possible_value: {value}")

    original_fact_dims = _fact_dimension_refs(original)
    proposed_fact_dims = _fact_dimension_refs(proposed)
    all_fact_names = set(original_fact_dims) | set(proposed_fact_dims)
    for fact_name in sorted(all_fact_names):
        original_refs = original_fact_dims.get(fact_name, set())
        proposed_refs = proposed_fact_dims.get(fact_name, set())
        for dim_name in sorted(original_refs - proposed_refs):
            changes.append(f"Fact '{fact_name}' - unlinked dimension: {dim_name}")
        for dim_name in sorted(proposed_refs - original_refs):
            changes.append(f"Fact '{fact_name}' - linked dimension: {dim_name}")

    if not changes:
        changes.append("No structural changes (facts, dimensions, values, and fact links match).")

    return changes


def is_pure_subset_schema(
    original: dict[str, Any],
    proposed: dict[str, Any],
) -> tuple[bool, str]:
    """Return True when proposed only removes facts, dimensions, values, or fact links.

    Args:
        original: Baseline schema (date dimensions stripped).
        proposed: User-edited schema (date dimensions stripped).

    Returns:
        Tuple of (is_subset, short reason).
    """
    original_facts = _fact_names(original)
    proposed_facts = _fact_names(proposed)
    if not proposed_facts.issubset(original_facts):
        new_facts = sorted(proposed_facts - original_facts)
        return False, f"New facts not in original schema: {', '.join(new_facts)}"

    original_dims = _dimension_map(original)
    proposed_dims = _dimension_map(proposed)
    if not set(proposed_dims).issubset(set(original_dims)):
        new_dims = sorted(set(proposed_dims) - set(original_dims))
        return False, f"New dimensions not in original schema: {', '.join(new_dims)}"

    for name, proposed_dim in proposed_dims.items():
        proposed_values = _normalize_values(proposed_dim.get("possible_values") or [])
        if not proposed_values:
            continue
        original_values = _normalize_values(original_dims[name].get("possible_values") or [])
        if original_values and not proposed_values.issubset(original_values):
            extra = sorted(proposed_values - original_values)[:5]
            return (
                False,
                f"Dimension '{name}' has values not in original schema: {', '.join(extra)}",
            )

    original_fact_dims = _fact_dimension_refs(original)
    proposed_fact_dims = _fact_dimension_refs(proposed)
    for fact_name, proposed_refs in proposed_fact_dims.items():
        original_refs = original_fact_dims.get(fact_name, set())
        if not proposed_refs.issubset(original_refs):
            added = sorted(proposed_refs - original_refs)
            return (
                False,
                f"Fact '{fact_name}' links dimensions not in the original fact: {', '.join(added)}",
            )

    return True, "Proposed schema is a valid subset of the original (narrowed facts/dimensions/values)."


def has_schema_extensions(original: dict[str, Any], proposed: dict[str, Any]) -> bool:
    """Return True if proposed introduces facts, dimensions, values, or fact links beyond original."""
    is_subset, _ = is_pure_subset_schema(original, proposed)
    return not is_subset


def prepare_schemas_for_comparison(
    original: dict[str, Any] | None,
    proposed: dict[str, Any],
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    """Strip date dimensions from both schemas before subset or LLM checks."""
    proposed_stripped = strip_date_dimensions(proposed)
    if original is None:
        return None, proposed_stripped
    return strip_date_dimensions(original), proposed_stripped
