
from __future__ import annotations

import argparse
import os

DEFAULT_LOG_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "pipeline.log",
)


def parse_args() -> argparse.Namespace:
    """Parse CLI flags for MongoDB, OpenAI, collections, and optional chart skip.

    Returns:
        Parsed argparse namespace; secrets may still come from environment variables.
    """
    parser = argparse.ArgumentParser(description="Run news processing pipeline")
    parser.add_argument("--mongo-uri", default=None, help="MongoDB connection string (or use MONGO_URI env var)")
    parser.add_argument("--openai-token", default=None, help="OpenAI API token (or use OPENAI_API_KEY env var)")
    parser.add_argument("--db-name", default="diploma", help="MongoDB database name")
    parser.add_argument(
        "--source-collection",
        default="news_with_tables",
        help="Source collection for raw news",
    )
    parser.add_argument("--batch-size", type=int, default=50, help="Mini-batch size for clustering")
    parser.add_argument(
        "--model-name",
        default=os.getenv("MODEL_NAME", "gpt-5.4-mini"),
        help="OpenAI model (or MODEL_NAME env var)",
    )
    parser.add_argument("--skip-charts", action="store_true", help="Skip chart config stage")
    parser.add_argument("--log-file", default=DEFAULT_LOG_FILE, help="Path to log file")
    return parser.parse_args()


def resolve_credentials(args: argparse.Namespace) -> tuple[str | None, str | None]:
    """Resolve MongoDB URI and OpenAI token from CLI or environment.

    Args:
        args: Parsed command-line arguments.

    Returns:
        Tuple of (mongo_uri, openai_token); either may be None if not configured.
    """
    mongo_uri = args.mongo_uri or os.getenv("MONGO_URI")
    openai_token = args.openai_token or os.getenv("OPENAI_API_KEY")
    return mongo_uri, openai_token


def resolve_backend_env() -> tuple[str | None, str | None, str | None]:
    """Read backend integration variables used for progress and completion webhooks.

    Returns:
        Tuple of (process_id, callback_endpoint, progress_endpoint).
    """
    process_id = os.getenv("PROCESS_ID")
    callback_endpoint = os.getenv("BACKEND_CALLBACK_ENDPOINT")
    progress_endpoint = os.getenv("BACKEND_PROGRESS_ENDPOINT")
    return process_id, callback_endpoint, progress_endpoint
