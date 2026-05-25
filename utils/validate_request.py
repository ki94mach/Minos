# utils/validate_request.py
from functools import wraps
from flask import request
from pydantic import ValidationError
import logging
from typing import Type, TypeVar, Callable
from pydantic import BaseModel

from utils.api_errors import error_response, pydantic_error_details

T = TypeVar('T', bound=BaseModel)


def validate_request(model: Type[T], location: str = 'json'):
    """
    A decorator that validates incoming request data against a Pydantic model.
    """
    def decorator(f: Callable):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                if location == 'json':
                    data = request.get_json()
                elif location == 'form':
                    data = request.form.to_dict()
                else:
                    return error_response(f'Invalid location: {location}', 400)

                if data is None:
                    return error_response('No data provided', 400)

                try:
                    validated = model(**data)
                except ValidationError as e:
                    details = pydantic_error_details(e)
                    logging.error("Validation error for %s: %s", model.__name__, details)
                    return error_response('Validation failed', 422, details)

                logging.debug("Successfully validated %s", model.__name__)
                return f(validated, *args, **kwargs)

            except Exception as e:
                logging.error("Unexpected error in validate_request: %s", e)
                return error_response('An unexpected error occurred during validation', 500)

        return decorated_function
    return decorator
