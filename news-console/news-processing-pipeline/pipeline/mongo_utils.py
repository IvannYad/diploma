
from __future__ import annotations

import os

from pymongo import MongoClient
from pymongo.uri_parser import parse_uri

DEFAULT_DATABASE_NAME = "diploma"


def resolve_database_name(mongo_uri: str, default: str = DEFAULT_DATABASE_NAME) -> str:
    """Resolve the MongoDB database name from a connection string.

    Uses the path segment of the URI when present (e.g. ``mongodb://host:27018/e2e_news_only``).
    Falls back to *default* (``diploma``) when the URI is host-only
    (e.g. ``mongodb://host:27018`` or ``mongodb://host:27018/``).

    Args:
        mongo_uri: MongoDB connection string.
        default: Database name when the URI does not specify one.

    Returns:
        Resolved database name.
    """
    env_db = os.getenv("MONGO_DB", "").strip()
    if env_db:
        return env_db

    if not mongo_uri or not mongo_uri.strip():
        return default

    try:
        parsed = parse_uri(mongo_uri.strip())
    except Exception:
        return default

    database = parsed.get("database")
    if database:
        return str(database)
    return default


def create_client(mongo_uri: str) -> MongoClient:
    """Create a MongoDB client with a bounded server-selection timeout.

    Args:
        mongo_uri: MongoDB connection string.

    Returns:
        Connected MongoClient instance (caller should ping and close).
    """
    return MongoClient(mongo_uri, serverSelectionTimeoutMS=15_000)
