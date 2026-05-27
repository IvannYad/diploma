"""MongoDB connection helpers for the rebuild pipeline."""

from __future__ import annotations

import logging
import os

from pymongo import MongoClient
from pymongo.uri_parser import parse_uri

logger = logging.getLogger(__name__)

DEFAULT_DATABASE_NAME = "diploma"


def resolve_database_name(mongo_uri: str, default: str = DEFAULT_DATABASE_NAME) -> str:
    """Resolve the MongoDB database name from a connection string.

    Uses the path segment of the URI when present. Falls back to *default* (``diploma``)
    when the URI contains only a server address.

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
    """Create a MongoDB client and verify connectivity with a ping.

    Args:
        mongo_uri: MongoDB connection string.

    Returns:
        Connected MongoClient instance.

    Raises:
        Exception: If the server does not respond to ping.
    """
    logger.info("Connecting to MongoDB: %s", mongo_uri.replace(mongo_uri.split("://")[1].split("@")[0], "***"))
    client = MongoClient(mongo_uri)
    client.admin.command("ping")
    logger.info("MongoDB connection successful")
    return client
