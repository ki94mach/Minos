# utils/decorators.py
from functools import wraps
from flask import request, jsonify
from pydantic import ValidationError

from utils.sso_auth import ADMIN, USER, get_request_role

# Re-export for callers that import ADMIN/USER from decorators.
__all__ = ["ADMIN", "USER", "validate_request", "require_role"]


def validate_request(pydantic_model):
    def decorator(view_callable):
        @wraps(view_callable)
        def wrapper(*args, **kwargs):
            try:
                data = request.get_json()
                # Use Pydantic to parse/validate the incoming JSON.
                # Adjust the method depending on your Pydantic version (model_validate for v2 or parse_obj for v1)
                validated_data = pydantic_model.model_validate(data)
                # Attach validated data to the request context if needed.
                request.validated_data = validated_data
                return view_callable(*args, **kwargs)
            except ValidationError as e:
                error_messages = [f"{err['msg'].replace('Value error,', '').strip()}" for err in e.errors()]
                return jsonify({'success': False, 'error': 'VALIDATION ERROR!', 'details': error_messages}), 400
            except Exception as e:
                return jsonify({'success': False, 'error': str(e)}), 500

        return wrapper

    return decorator


def require_role(allowed_roles):
    allowed = {r if isinstance(r, str) else r.value for r in allowed_roles}

    def decorator(view_callable):
        @wraps(view_callable)
        def wrapper(*args, **kwargs):
            user_role = get_request_role()
            if user_role not in allowed:
                return jsonify({'error': 'You do not have permission to access this resource.'}), 403
            return view_callable(*args, **kwargs)

        return wrapper

    return decorator
