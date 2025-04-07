import sys
import os
from flask import Flask, request, g, redirect
from models.meta import connect_db  # Your connection helper from meta.py
from routes.api import api_blueprint
from routes.auth import auth_blueprint
from datetime import timedelta
import secrets
import logging
from flask_mail import Mail
from dotenv import load_dotenv
from flask_session import Session
import redis
from flask_wtf.csrf import CSRFProtect, CSRFError  # Add CSRFError

# Load environment variables from .env file
load_dotenv()

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Create a Mail instance that we'll attach to our app
mail = Mail()

# Create CSRF protection instance
csrf = CSRFProtect()

# Create Redis instance
redis_client = redis.Redis(
    host=os.environ.get('REDIS_HOST', '10.20.52.20'),
    port=int(os.environ.get('REDIS_PORT', 6379)),
    password=os.environ.get('REDIS_PASSWORD', 'MinosProject1234'),
    db=int(os.environ.get('REDIS_DB', 0)),
    decode_responses=False
)

# app.py
def create_app():
    app = Flask(__name__, template_folder='templates')

    # Get secret key from environment variable or generate a secure one
    # In production, ALWAYS set this as an environment variable
    secret_key = os.environ.get('SECRET_KEY')
    if not secret_key:
        # Only for development - in production, always use an environment variable
        secret_key = secrets.token_hex(32)
        logging.warning("Using a generated SECRET_KEY. In production, set this as an environment variable.")
    
    app.config['SECRET_KEY'] = secret_key
    
    # CSRF Protection configuration
    app.config['WTF_CSRF_ENABLED'] = True
    app.config['WTF_CSRF_TIME_LIMIT'] = 3600  # 1 hour in seconds
    app.config['WTF_CSRF_SSL_STRICT'] = False  # Set to True in production with HTTPS
    app.config['WTF_CSRF_METHODS'] = ['POST', 'PUT', 'PATCH', 'DELETE']  # Explicitly define methods
    app.config['WTF_CSRF_CHECK_DEFAULT'] = True  # Ensure CSRF checking is enabled by default

    # Email Configuration
    app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
    app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
    app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'True').lower() in ('true', 'yes', '1')
    app.config['MAIL_USE_SSL'] = os.environ.get('MAIL_USE_SSL', 'False').lower() in ('true', 'yes', '1')
    app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME', None)
    app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD', None)
    app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@example.com')
    app.config['MAIL_MAX_EMAILS'] = int(os.environ.get('MAIL_MAX_EMAILS', 100))
    app.config['MAIL_ASCII_ATTACHMENTS'] = os.environ.get('MAIL_ASCII_ATTACHMENTS', 'False').lower() in ('true', 'yes', '1')
    app.config['MAIL_SUPPRESS_SEND'] = os.environ.get('FLASK_ENV', 'development') != 'production'
    
    # Initialize the mail extension
    mail.init_app(app)
    
    # Initialize CSRF protection
    csrf.init_app(app)
    
    # Handle CSRF errors
    @app.errorhandler(CSRFError)
    def handle_csrf_error(e):
        return {
            'error': 'CSRF token validation failed',
            'message': e.description
        }, 400

    # Redis Session Configuration
    app.config['SESSION_TYPE'] = 'redis'
    app.config['SESSION_REDIS'] = redis_client
    app.config['SESSION_USE_SIGNER'] = True
    app.config['SESSION_PERMANENT'] = True
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)  # Session lifetime for security
    app.config['SESSION_KEY_PREFIX'] = 'minos_session:'
    
    # Common session settings
    app.config['SESSION_COOKIE_NAME'] = 'session'
    app.config['SESSION_COOKIE_SECURE'] = os.environ.get('FLASK_ENV') == 'production'  # Only True in production
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['SESSION_REFRESH_EACH_REQUEST'] = True  # Refresh session on each request
    
    # Initialize Flask-Session
    Session(app)

    # Load database configuration
    db_name = os.environ.get('MONGO_DBNAME', 'minos_db')
    db_host = os.environ.get('MONGO_URI', 'mongodb://10.20.52.20:27017/minos_db')
    
    app.config['MONGO_DBNAME'] = db_name
    app.config['MONGO_URI'] = db_host

    # Connect to MongoDB using your helper
    connect_db(db_name=app.config['MONGO_DBNAME'], host=app.config['MONGO_URI'])
    
    # Add root route that redirects to login
    @app.route('/')
    def home():
        return redirect('/auth/login')

    # Register the blueprint for API endpoints
    app.register_blueprint(api_blueprint, url_prefix='/api')
    app.register_blueprint(auth_blueprint, url_prefix='/auth')

    @app.after_request
    def add_security_headers(response):
        # Add security headers to all responses
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        
        # Only in production
        if os.environ.get('FLASK_ENV') == 'production':
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        
        return response

    return app


app = create_app()

if __name__ == '__main__':
    app.run(debug=os.environ.get('FLASK_ENV') != 'production', 
            host='0.0.0.0', 
            port=int(os.environ.get('PORT', 5000)))
