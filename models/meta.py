# meta.py
import logging
import os
from typing import Any
from urllib.parse import urlparse

import mongoengine as me


def connect_db(db_name="minos_db", host="mongodb://localhost:27017/"):
    """
    Connect to MongoDB using MongoEngine.
    Called at app startup from utils.config_utils.configure_database.
    """
    timeout_ms = int(os.environ.get("MONGO_CONNECT_TIMEOUT_MS", "10000"))
    me.connect(
        db=db_name,
        host=host,
        serverSelectionTimeoutMS=timeout_ms,
    )
    logging.info("Connected to MongoDB database: %s", db_name)


def _safe_mongo_host(host_uri: str) -> str:
    """Return host:port for health JSON without credentials."""
    try:
        parsed = urlparse(host_uri)
        if parsed.hostname:
            port = parsed.port or 27017
            return f"{parsed.hostname}:{port}"
    except Exception:
        pass
    return "unknown"


def check_mongo_health() -> tuple[bool, dict[str, Any]]:
    """
    Ping MongoDB for GET /health (I1).
    Returns (ok, details) — details are safe to expose to load balancers.
    """
    from mongoengine.connection import get_db

    db_name = os.environ.get("MONGO_DBNAME", "minos_db").strip()
    host_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017/").strip()
    details: dict[str, Any] = {
        "mongo": "unreachable",
        "database": db_name,
        "host": _safe_mongo_host(host_uri),
    }

    try:
        client = get_db().client
        # Honor MONGO_HEALTH_TIMEOUT_MS via a short server selection window on this check.
        timeout_ms = int(os.environ.get("MONGO_HEALTH_TIMEOUT_MS", "5000"))
        client = client.with_options(serverSelectionTimeoutMS=timeout_ms)
        client.admin.command("ping")
        details["mongo"] = "ok"
        return True, details
    except Exception as exc:
        logging.warning("MongoDB health check failed: %s", exc)
        details["error"] = str(exc)
        return False, details
