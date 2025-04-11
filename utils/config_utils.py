import os
import logging
import secrets
from datetime import timedelta
from flask_wtf.csrf import CSRFProtect, CSRFError
from flask_mail import Mail
from flask_session import Session
from models.meta import connect_db

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
    app.config['WTF_CSRF_TIME_LIMIT'] = 3600  # 1 hour in seconds
    app.config['WTF_CSRF_SSL_STRICT'] = os.environ.get('FLASK_ENV') == 'production'
    app.config['WTF_CSRF_METHODS'] = ['POST', 'PUT', 'PATCH', 'DELETE']
    app.config['WTF_CSRF_CHECK_DEFAULT'] = True
    
    # Initialize CSRF protection
    csrf.init_app(app)

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
    app.config['SESSION_USE_SIGNER'] = True
    app.config['SESSION_PERMANENT'] = True
    
    # Convert hours to seconds for session lifetime
    lifetime_hours = int(os.environ.get('SESSION_LIFETIME_HOURS', 24))
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=lifetime_hours)
    
    app.config['SESSION_KEY_PREFIX'] = os.environ.get('SESSION_KEY_PREFIX')
    
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