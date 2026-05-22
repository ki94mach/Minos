"""
Serialize MongoEngine documents for Flask jsonify (C4).

List endpoints return [{ "_id": "<string>", ... }, ...] instead of JSON strings.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Iterable

from mongoengine.base import BaseDocument


def normalize_extended_json(value: Any) -> Any:
    """Convert Mongo extended JSON ($oid, $date) to plain JSON types."""
    if isinstance(value, dict):
        if len(value) == 1 and "$oid" in value:
            return str(value["$oid"])
        if len(value) == 1 and "$date" in value:
            raw = value["$date"]
            if isinstance(raw, (int, float)):
                return datetime.utcfromtimestamp(raw / 1000).isoformat() + "Z"
            return raw
        return {key: normalize_extended_json(item) for key, item in value.items()}
    if isinstance(value, list):
        return [normalize_extended_json(item) for item in value]
    return value


def document_to_dict(document: BaseDocument) -> dict[str, Any]:
    """MongoEngine document → dict suitable for jsonify."""
    return normalize_extended_json(json.loads(document.to_json()))


def serialize_documents(documents: Iterable[BaseDocument]) -> list[dict[str, Any]]:
    """Serialize a list of MongoEngine documents for API list responses."""
    return [document_to_dict(doc) for doc in documents]
