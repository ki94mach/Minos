# Standard library imports
import os
import sys

# Third-party imports
from flask import Flask
import redis

# Local application imports
from routes.api import api_blueprint
from routes.auth import auth_blueprint
from utils.config_utils import (
    configure_secret_key,
    configure_security,
    configure_email,
    configure_session,
    configure_database,
    register_routes,
    register_error_handlers,
    configure_security_headers
)

# Initialize Redis client
def get_redis_client():
    host = os.environ.get('REDIS_HOST', 'localhost')
    port = int(os.environ.get('REDIS_PORT', 6379))
    password = os.environ.get('REDIS_PASSWORD')
    db = int(os.environ.get('REDIS_DB', 0))

    print("Connecting to Redis at:", host, port, "DB:", db)

    return redis.Redis(
        host=host,
        port=port,
        password=password,
        db=db,
        decode_responses=False
    )

def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__, template_folder='templates')
    
    # Ensure the parent directory is in the Python path
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    
    # Get Redis client
    redis_client = get_redis_client()
    
    # Configure application
    configure_secret_key(app)
    configure_security(app)
    configure_email(app)
    configure_session(app, redis_client)
    configure_database(app)
    
    # Register routes and error handlers
    register_routes(app, api_blueprint, auth_blueprint)
    register_error_handlers(app)
    configure_security_headers(app)

    return app 