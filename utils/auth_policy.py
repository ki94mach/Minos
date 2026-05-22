"""
Auth policy helpers (B2): gate legacy Minos registration routes.
"""

from __future__ import annotations

import os
from functools import wraps

from utils.api_errors import error_response


def is_production() -> bool:
    return os.environ.get("FLASK_ENV", "").strip().lower() == "production"


def registration_allowed() -> bool:
    """
    Whether POST/GET /auth/register are enabled.

    - Production: disabled unless ALLOW_REGISTRATION=true (not recommended).
    - Non-production: enabled unless ALLOW_REGISTRATION=false.
    """
    flag = os.environ.get("ALLOW_REGISTRATION", "").strip().lower()
    if flag in ("1", "true", "yes"):
        return True
    if flag in ("0", "false", "no"):
        return False
    return not is_production()


def registration_required(view_callable):
    """Return 404 when public registration is disabled (B2)."""

    @wraps(view_callable)
    def wrapper(*args, **kwargs):
        if not registration_allowed():
            return error_response("Registration is not available.", 404)
        return view_callable(*args, **kwargs)

    return wrapper
