#utils/validate_requests.py
from functools import wraps
from flask import request, jsonify
from pydantic import ValidationError
import logging
from typing import Type, TypeVar, Callable
from pydantic import BaseModel

T = TypeVar('T', bound=BaseModel)

def validate_request(model: Type[T], location: str = 'json'):
    """
    A decorator that validates incoming request data against a Pydantic model.
    
    Args:
        model: The Pydantic model class to validate against
        location: Where to look for data ('json' or 'form')
    
    Returns:
        The decorated function
        
    Raises:
        ValidationError: If the request data fails validation
    """
    def decorator(f: Callable):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # Get request data based on location
                if location == 'json':
                    data = request.get_json()
                elif location == 'form':
                    data = request.form.to_dict()
                else:
                    return jsonify({'error': f'Invalid location: {location}'}), 400

                if not data:
                    return jsonify({'error': 'No data provided'}), 400

                # Validate data against the model
                try:
                    validated = model(**data)
                except ValidationError as e:
                    # Enhanced error handling with detailed validation errors
                    errors = []
                    for error in e.errors():
                        loc = ' -> '.join(str(x) for x in error['loc'])
                        msg = error['msg']
                        errors.append(f"Field '{loc}': {msg}")
                    
                    error_msg = {
                        'error': 'Validation failed',
                        'details': errors
                    }
                    logging.error(f"Validation error for {model.__name__}: {errors}")
                    return jsonify(error_msg), 422

                # Log successful validation for debugging
                logging.debug(f"Successfully validated {model.__name__}")
                
                # Pass the validated model instance to the wrapped function
                return f(validated, *args, **kwargs)
                
            except Exception as e:
                logging.error(f"Unexpected error in validate_request: {str(e)}")
                return jsonify({'error': 'An unexpected error occurred during validation'}), 500
                
        return decorated_function
    return decorator