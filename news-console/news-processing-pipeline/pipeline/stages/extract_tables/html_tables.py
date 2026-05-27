
from __future__ import annotations

import re
from typing import Any

from bs4 import BeautifulSoup

from pipeline.stages.extract_tables.numbers import to_number


def parse_tables(html_body: str) -> list[dict[str, Any]]:
    """Extract all HTML tables from article HTML as header/row structures.

    Args:
        html_body: Raw full_body HTML from source news.

    Returns:
        List of tables with headers, rows, num_columns, and num_rows.
    """
    soup = BeautifulSoup(html_body or "", "html.parser")
    tables = soup.find_all("table")
    parsed: list[dict[str, Any]] = []

    for table in tables:
        rows = table.find_all("tr")
        matrix: list[list[str]] = []
        for row in rows:
            cells = row.find_all(["th", "td"])
            values = [cell.get_text(" ", strip=True) for cell in cells]
            if any(values):
                matrix.append(values)

        if len(matrix) < 2:
            continue

        headers = matrix[0]
        body_rows = matrix[1:]
        parsed.append(
            {
                "headers": headers,
                "rows": body_rows,
                "num_columns": max(len(r) for r in matrix),
                "num_rows": len(body_rows),
            }
        )

    return parsed


def build_records(table: dict[str, Any]) -> list[dict[str, Any]]:
    """Convert a parsed table matrix into flat row dicts (fallback when LLM extraction fails).

    Args:
        table: Parsed table with headers and rows.

    Returns:
        One dict per data row with snake_case keys from headers.
    """
    headers = table["headers"]
    records: list[dict[str, Any]] = []

    for row in table["rows"]:
        record: dict[str, Any] = {}
        for idx, value in enumerate(row):
            header = headers[idx] if idx < len(headers) else f"column_{idx + 1}"
            key = re.sub(r"\W+", "_", header.lower()).strip("_") or f"column_{idx + 1}"
            number = to_number(value)
            record[key] = number if number is not None else value
        if record:
            records.append(record)

    return records


def table_preview(table: dict[str, Any], max_rows: int = 10) -> str:
    """Format a table as plain text for LLM schema and fit prompts.

    Args:
        table: Parsed table dict.
        max_rows: Maximum data rows to include.

    Returns:
        Multi-line string with headers and sample rows.
    """
    headers = table.get("headers", []) or []
    rows = table.get("rows", []) or []
    headers_line = " | ".join(str(h) for h in headers)
    row_lines = [" | ".join(str(c) for c in row) for row in rows[:max_rows]]
    return f"Headers: {headers_line}\nRows:\n" + "\n".join(row_lines)
