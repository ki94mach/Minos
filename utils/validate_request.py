#utils/validate_requests.py
from functools import wraps
from flask import request, jsonify

def validate_request(model_class, location='json'):
    """
    A decorator to validate incoming request data against a specified model class.
    This decorator extracts data from the request based on the specified location 
    ('json', 'query', or 'form'), validates it by instantiating the provided model class, 
    and passes the validated data to the decorated function.
    Args:
        model_class (type): The class used to validate the incoming request data. 
                            It should accept keyword arguments corresponding to the request data.
        location (str, optional): The location of the request data. 
                                  Options are:
                                  - 'json': Extracts data from the JSON body of the request.
                                  - 'query': Extracts data from the query parameters of the request.
                                  - 'form': Extracts data from the form-encoded body of the request.
                                  Defaults to 'json'.
    Returns:
        function: A decorator that wraps the target function, providing it with validated data.
    Raises:
        Exception: If the data cannot be validated (e.g., missing or invalid fields), 
                   an error message is returned in the response with a 400 status code.
    Example:
        @validate_request(MyModel, location='json')
        def my_view_function(validated_data):
            # Use the validated_data object here
            pass
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                if location == 'json':
                    data = request.get_json()
                elif location == 'query':
                    data = request.args.to_dict()
                elif location == 'form':
                    data = request.form.to_dict()
                else:
                    return jsonify({'error': 'Invalid location'}), 400
                
              
                validated_data = model_class(**data)
                return func(*args, validated_data=validated_data, **kwargs)
            
            except Exception as e:
                return jsonify({'error': str(e)}), 400
        
        return wrapper
    return decorator