# utils/decorators.py
from functools import wraps
from flask import request
from pydantic import ValidationError

from utils.api_errors import error_response, pydantic_error_details
from utils.sso_auth import ADMIN, USER, get_request_role

__all__ = ["ADMIN", "USER", "validate_request", "require_role"]


def validate_request(pydantic_model):
    """Legacy decorator; prefer utils.validate_request.validate_request."""

    def decorator(view_callable):
        @wraps(view_callable)
        def wrapper(*args, **kwargs):
            try:
                data = request.get_json()
                validated_data = pydantic_model.model_validate(data)
                request.validated_data = validated_data
                return view_callable(*args, **kwargs)
            except ValidationError as e:
                return error_response(
                    "Validation failed",
                    422,
                    pydantic_error_details(e),
                )
            except Exception as e:
                return error_response(str(e), 500)

        return wrapper

    return decorator


def require_role(allowed_roles):
    allowed = {r if isinstance(r, str) else r.value for r in allowed_roles}

    def decorator(view_callable):
        @wraps(view_callable)
        def wrapper(*args, **kwargs):
            user_role = get_request_role()
            if user_role not in allowed:
                return error_response(
                    "You do not have permission to access this resource.",
                    403,
                )
            return view_callable(*args, **kwargs)

        return wrapper

    return decorator
