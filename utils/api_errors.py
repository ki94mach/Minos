"""
Consistent JSON error responses for Minos API (C5).

4xx/5xx shape: { "error": "<message>", "details"?: ["...", ...] }
"""

from __future__ import annotations

from typing import Any, Optional, Sequence, Tuple

from flask import jsonify
from pydantic import ValidationError


def error_body(error: str, details: Optional[Sequence[str]] = None) -> dict[str, Any]:
    body: dict[str, Any] = {"error": error}
    if details:
        body["details"] = list(details)
    return body


def error_response(
    error: str,
    status_code: int,
    details: Optional[Sequence[str]] = None,
) -> Tuple[Any, int]:
    return jsonify(error_body(error, details)), status_code


def pydantic_error_details(exc: ValidationError) -> list[str]:
    messages = []
    for err in exc.errors():
        loc = " -> ".join(str(part) for part in err.get("loc", ()))
        msg = str(err.get("msg", "")).replace("Value error,", "").strip()
        if loc:
            messages.append(f"{loc}: {msg}")
        else:
            messages.append(msg)
    return messages
