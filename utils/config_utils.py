import os
import logging
import secrets
from datetime import timedelta
from flask_wtf.csrf import CSRFProtect, CSRFError
from flask_mail import Mail
from flask_session import Session
from models.meta import connect_db
from flask import Flask, session
from typing import Dict, Any, Optional
from werkzeug.exceptions import HTTPException

# Initialize extensions
mail = Mail()
csrf = CSRFProtect()

def configure_secret_key(app):
    """Configure the application secret key."""
    secret_key = os.environ.get('SECRET_KEY')
    if not secret_key:
        secret_key = secrets.token_hex(32)
        logging.warning("Using a generated SECRET_KEY. In production, set this as an environment variable.")
    
    app.config['SECRET_KEY'] = secret_key

def configure_security(app):
    """Configure security settings including CSRF protection."""
    # CSRF Protection configuration
    app.config['WTF_CSRF_ENABLED'] = True
    app.config['WTF_CSRF_TIME_LIMIT'] = 7200  # 1 hour in seconds
    app.config['WTF_CSRF_SSL_STRICT'] = os.environ.get('FLASK_ENV') == 'production'
    app.config['WTF_CSRF_METHODS'] = ['POST', 'PUT', 'PATCH', 'DELETE']
    app.config['WTF_CSRF_CHECK_DEFAULT'] = True
    
    # Initialize CSRF protection
    csrf.init_app(app)

    from routes.api import api_blueprint

def configure_email(app):
    """Configure email settings."""
    app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER')
    app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT'))
    app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'True').lower() in ('true', 'yes', '1')
    app.config['MAIL_USE_SSL'] = os.environ.get('MAIL_USE_SSL', 'False').lower() in ('true', 'yes', '1')
    app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
    app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
    app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER')
    app.config['MAIL_MAX_EMAILS'] = int(os.environ.get('MAIL_MAX_EMAILS'))
    app.config['MAIL_ASCII_ATTACHMENTS'] = os.environ.get('MAIL_ASCII_ATTACHMENTS', 'False').lower() in ('true', 'yes', '1')
    app.config['MAIL_SUPPRESS_SEND'] = os.environ.get('FLASK_ENV') != 'production'
    
    # Initialize the mail extension
    mail.init_app(app)

def configure_session(app, redis_client):
    """Configure session handling with Redis."""
    # Redis Session Configuration
    app.config['SESSION_TYPE'] = 'redis'
    app.config['SESSION_REDIS'] = redis_client
    # app.config['SESSION_USE_SIGNER'] = True
    app.config['SESSION_PERMANENT'] = True
    
    # Convert hours to seconds for session lifetime
    lifetime_hours = int(os.environ.get('SESSION_LIFETIME_HOURS', 24))
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=lifetime_hours)
    
    app.config['SESSION_KEY_PREFIX'] = os.environ.get('SESSION_KEY_PREFIX', 'session:')
    
    # Common session settings
    app.config['SESSION_COOKIE_NAME'] = 'session'
    app.config['SESSION_COOKIE_SECURE'] = os.environ.get('FLASK_ENV') == 'production'
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['SESSION_REFRESH_EACH_REQUEST'] = True
    
    # Initialize Flask-Session
    Session(app)

def configure_database(app):
    """Configure database connection."""
    db_name = os.environ.get('MONGO_DBNAME')
    db_host = os.environ.get('MONGO_URI')
    
    app.config['MONGO_DBNAME'] = db_name
    app.config['MONGO_URI'] = db_host

    # Connect to MongoDB
    connect_db(db_name=app.config['MONGO_DBNAME'], host=app.config['MONGO_URI'])

def register_routes(app, api_blueprint, auth_blueprint):
    """Register application routes and blueprints."""
    # Add root route that redirects to login
    @app.route('/')
    def home():
        from flask import redirect
        return redirect('/auth/login')

    # Register blueprints
    app.register_blueprint(api_blueprint, url_prefix='/api')
    app.register_blueprint(auth_blueprint, url_prefix='/auth')

def register_error_handlers(app):
    """Register error handlers."""
    @app.errorhandler(CSRFError)
    def handle_csrf_error(e):
        return {
            'error': 'CSRF token validation failed',
            'message': e.description
        }, 400

def configure_security_headers(app):
    """Configure security headers for responses."""
    @app.after_request
    def add_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        
        if os.environ.get('FLASK_ENV') == 'production':
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        
        return response

def configure_app(app: Flask, config: Optional[Dict[str, Any]] = None) -> None:
    """Configure Flask application with security-focused settings."""
    
    # Generate a random secret key if not provided
    if not app.secret_key:
        app.secret_key = secrets.token_hex(32)

    # Basic Configuration
    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SECURE=True if not app.debug else False,
        SESSION_COOKIE_SAMESITE='Lax',
        PERMANENT_SESSION_LIFETIME=timedelta(minutes=30),
        WTF_CSRF_TIME_LIMIT=3600,  # 1 hour
        WTF_CSRF_SSL_STRICT=True,
        MAX_CONTENT_LENGTH=10 * 1024 * 1024,  # 10MB max file size
    )

    # Update with any provided config
    if config:
        app.config.update(config)

    # Configure logging
    configure_logging(app)

    # Register error handlers
    register_error_handlers(app)

def configure_logging(app: Flask) -> None:
    """Configure application logging with secure defaults."""
    
    logging.basicConfig(
        level=logging.INFO if not app.debug else logging.DEBUG,
        format='%(asctime)s [%(levelname)s] %(module)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
        handlers=[
            logging.FileHandler('app.log'),
            logging.StreamHandler()
        ]
    )

    # Specific logging configuration for production
    if not app.debug:
        # Add secure file handler with proper permissions
        file_handler = logging.FileHandler('app.log')
        file_handler.setLevel(logging.INFO)
        formatter = logging.Formatter(
            '%(asctime)s [%(levelname)s] %(module)s: %(message)s'
        )
        file_handler.setFormatter(formatter)
        app.logger.addHandler(file_handler)

        # Ensure sensitive data is not logged
        class SensitiveDataFilter(logging.Filter):
            def filter(self, record):
                sensitive_fields = {'password', 'token', 'secret', 'key', 'auth'}
                message = record.getMessage().lower()
                return not any(field in message for field in sensitive_fields)

        app.logger.addFilter(SensitiveDataFilter())

def register_error_handlers(app: Flask) -> None:
    """Register error handlers for common scenarios."""
    
    @app.errorhandler(400)
    def handle_bad_request(e):
        logging.warning(f"Bad request: {e}")
        return {
            'error': 'Bad Request',
            'message': str(e)
        }, 400

    @app.errorhandler(401)
    def handle_unauthorized(e):
        return {
            'error': 'Unauthorized',
            'message': 'Authentication required'
        }, 401

    @app.errorhandler(403)
    def handle_forbidden(e):
        return {
            'error': 'Forbidden',
            'message': 'You do not have permission to access this resource'
        }, 403

    @app.errorhandler(404)
    def handle_not_found(e):
        return {
            'error': 'Not Found',
            'message': 'The requested resource was not found'
        }, 404

    @app.errorhandler(405)
    def handle_method_not_allowed(e):
        return {
            'error': 'Method Not Allowed',
            'message': 'The method is not allowed for this endpoint'
        }, 405

    @app.errorhandler(429)
    def handle_too_many_requests(e):
        return {
            'error': 'Too Many Requests',
            'message': 'Please try again later'
        }, 429

    @app.errorhandler(500)
    def handle_server_error(e):
        logging.error(f"Internal server error: {e}")
        return {
            'error': 'Internal Server Error',
            'message': 'An unexpected error occurred'
        }, 500

    @app.errorhandler(CSRFError)
    def handle_csrf_error(e):
        logging.warning(f"CSRF validation failed: {e}")
        return {
            'error': 'CSRF token validation failed',
            'message': str(e)
        }, 400

    @app.errorhandler(Exception)
    def handle_unhandled_exception(e):
        if isinstance(e, HTTPException):
            return {
                'error': e.name,
                'message': e.description
            }, e.code
        
        logging.error(f"Unhandled exception: {e}", exc_info=True)
        return {
            'error': 'Internal Server Error',
            'message': 'An unexpected error occurred'
        }, 500

def configure_security_headers(app: Flask) -> None:
    """Configure security headers for responses."""
    @app.after_request
    def add_security_headers(response):
        default_headers = {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Content-Security-Policy': (
                "default-src 'self'; "
                "script-src 'self' https://code.jquery.com; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data:; "
                "font-src 'self'; "
                "object-src 'none'; "
                "base-uri 'self'; "
                "form-action 'self'; "
                "frame-ancestors 'none'"
            ),
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
        }
        
        # Add HSTS in production
        if not app.debug:
            default_headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        
        for header, value in default_headers.items():
            if header not in response.headers:
                response.headers[header] = value
        
        return response

def init_security_modules(app: Flask) -> None:
    """Initialize security-related modules."""
    
    # Initialize CSRF protection
    csrf = CSRFProtect()
    csrf.init_app(app)
    
    # Configure session security
    app.config.update(
        SESSION_COOKIE_SECURE=True if not app.debug else False,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE='Lax',
        PERMANENT_SESSION_LIFETIME=timedelta(minutes=30),
        SESSION_REFRESH_EACH_REQUEST=True
    )
    
    # Enable secure headers
    configure_security_headers(app)