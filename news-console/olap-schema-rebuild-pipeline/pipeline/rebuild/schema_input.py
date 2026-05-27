
from __future__ import annotations

import json
from typing import Any


def parse_proposed_schema(schema_json: str) -> dict[str, Any]:
    """Deserialize the proposed schema from the CLI --schema argument.

    Args:
        schema_json: Raw JSON string (facts, dimensions, table_description).

    Returns:
        Parsed schema dictionary.

    Raises:
        json.JSONDecodeError: If the string is not valid JSON.
    """
    return json.loads(schema_json)
