
from __future__ import annotations

import argparse
import os

DEFAULT_LOG_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "rebuild.log",
)


def parse_args() -> argparse.Namespace:
    """Parse rebuild pipeline CLI flags and required cluster/subcluster/schema inputs.

    Returns:
        Namespace with mongo_uri, openai_token, process_id, cluster, subcluster,
        schema JSON string, callback endpoint, log file path, and model name.
    """
    parser = argparse.ArgumentParser(description="OLAP Schema Rebuild Pipeline")
    parser.add_argument("--mongo-uri", required=True, help="MongoDB URI")
    parser.add_argument("--openai-token", required=True, help="OpenAI API token")
    parser.add_argument("--process-id", required=True, help="Unique rebuild process ID")
    parser.add_argument("--cluster", required=True, help="Cluster name")
    parser.add_argument("--subcluster", required=True, help="Subcluster name")
    parser.add_argument("--schema", required=True, help="JSON schema payload")
    parser.add_argument("--callback-endpoint", help="Callback endpoint for completion")
    parser.add_argument("--log-file", default=DEFAULT_LOG_FILE, help="Log file path")
    parser.add_argument("--model", default="gpt-5.4-mini", help="LLM model name")
    return parser.parse_args()
