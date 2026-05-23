import os
import logging
import secrets
from datetime import timedelta
from flask_wtf.csrf import CSRFProtect, CSRFError
from flask_mail import Mail
from flask_session import Session
from models.meta import connect_db
from flask import Flask, jsonify, session
from typing import Dict, Any, Optional
from werkzeug.exceptions import HTTPException

from utils.api_errors import error_body

# Initialize extensions
mail = Mail()
csrf = CSRFProtect()


def cookie_secure_enabled() -> bool:
    """True when session/CSRF cookies must be Secure (HTTPS only) — I2."""
    if os.environ.get("FLASK_ENV") == "production":
        return True
    return os.environ.get("FORCE_HTTPS", "").lower() in ("1", "true", "yes")


def configure_https(app: Flask) -> None:
    """
    Production HTTPS: secure cookies, CSRF SSL strict, optional reverse-proxy trust (I2).
    TLS termination is expected at the load balancer / ingress; set BEHIND_PROXY=true
    when the app receives X-Forwarded-Proto: https.
    """
    secure_cookies = cookie_secure_enabled()

    app.config["SESSION_COOKIE_SECURE"] = secure_cookies
    app.config["WTF_CSRF_SSL_STRICT"] = secure_cookies

    if secure_cookies:
        app.config["PREFERRED_URL_SCHEME"] = "https"

    behind_proxy = os.environ.get("BEHIND_PROXY", "").lower() in (
        "1",
        "true",
        "yes",
    )
    if behind_proxy:
        from werkzeug.middleware.proxy_fix import ProxyFix

        app.wsgi_app = ProxyFix(
            app.wsgi_app,
            x_for=1,
            x_proto=1,
            x_host=1,
            x_prefix=1,
        )
        logging.info(
            "ProxyFix enabled (X-Forwarded-Proto); use HTTPS on the public URL"
        )

    if secure_cookies:
        logging.info("Secure cookies enabled (SESSION_COOKIE_SECURE, CSRF SSL strict)")


def configure_secret_key(app):
    """Configure the application secret key."""
    secret_key = os.environ.get('SECRET_KEY')
    if not secret_key:
        secret_key = secrets.token_hex(32)
        logging.warning("Using a generated SECRET_KEY. In production, set this as an environment variable.")
    
    app.config['SECRET_KEY'] = secret_key

def get_frontend_origins() -> list[str]:
    """Origins allowed to call the API from the browser (comma-separated FRONTEND_ORIGIN)."""
    raw = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def configure_cors(app: Flask) -> None:
    """
    Cross-origin access for the React SPA (S6 / B10).

    Allows Authorization (Bearer SSO) and, when enabled, credentialed requests
    for legacy Minos session + CSRF in local development.
    """
    from flask_cors import CORS

    origins = get_frontend_origins()
    supports_credentials = os.environ.get("CORS_SUPPORTS_CREDENTIALS", "true").lower() in (
        "1",
        "true",
        "yes",
    )

    CORS(
        app,
        resources={
            r"/api/*": {"origins": origins},
            r"/auth/*": {"origins": origins},
        },
        supports_credentials=supports_credentials,
        allow_headers=[
            "Content-Type",
            "Authorization",
            "X-CSRFToken",
            "X-CSRF-Token",
        ],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        expose_headers=["Content-Type"],
    )

    logging.info("CORS enabled for origins: %s (credentials=%s)", origins, supports_credentials)


def configure_security(app):
    """Configure security settings including CSRF protection."""
    # CSRF Protection configuration
    app.config['WTF_CSRF_ENABLED'] = True
    app.config['WTF_CSRF_TIME_LIMIT'] = 7200  # 1 hour in seconds
    app.config['WTF_CSRF_SSL_STRICT'] = cookie_secure_enabled()
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
    app.config['SESSION_COOKIE_SECURE'] = cookie_secure_enabled()
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = os.environ.get(
        'SESSION_COOKIE_SAMESITE', 'Lax'
    )
    app.config['SESSION_REFRESH_EACH_REQUEST'] = True
    
    # Initialize Flask-Session
    Session(app)

def configure_database(app):
    """
    Configure MongoDB from MONGO_URI + MONGO_DBNAME (see .env.example).

    Defaults match models/meta.py for local MongoDB without a .env file.
    """
    db_name = os.environ.get("MONGO_DBNAME", "minos_db").strip()
    db_host = os.environ.get("MONGO_URI", "mongodb://localhost:27017/").strip()

    if not db_name or not db_host:
        raise RuntimeError(
            "MONGO_DBNAME and MONGO_URI must be non-empty. "
            "Copy .env.example to .env and set both variables."
        )

    app.config["MONGO_DBNAME"] = db_name
    app.config["MONGO_URI"] = db_host
    connect_db(db_name=db_name, host=db_host)
    logging.info("MongoDB configured: db=%s host=%s", db_name, db_host)

def register_routes(app, api_blueprint, auth_blueprint):
    """Register application routes and blueprints."""
    # Add root route that redirects to login
    @app.route('/')
    def home():
        from flask import redirect
        return redirect('/auth/login')

    @app.route('/health', methods=['GET'])
    def health():
        """Liveness/readiness for deploy and load balancers (I1 / B8, no auth)."""
        from models.meta import check_mongo_health

        mongo_ok, mongo_details = check_mongo_health()
        body = {'status': 'ok' if mongo_ok else 'degraded', **mongo_details}
        if not mongo_ok:
            return jsonify(body), 503
        return jsonify(body), 200

    # Register blueprints
    app.register_blueprint(api_blueprint, url_prefix='/api')
    app.register_blueprint(auth_blueprint, url_prefix='/auth')

def register_error_handlers(app):
    """Register error handlers."""
    @app.errorhandler(CSRFError)
    def handle_csrf_error(e):
        return error_body('CSRF token validation failed', [str(e.description)]), 400

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
         WTF_CSRF_HEADERS=["X-CSRFToken", "X-CSRF-Token"],
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
    """Register error handlers for common scenarios (C5)."""

    @app.errorhandler(400)
    def handle_bad_request(e):
        logging.warning("Bad request: %s", e)
        details = [str(e)] if str(e) else None
        return error_body("Bad Request", details), 400

    @app.errorhandler(401)
    def handle_unauthorized(e):
        return error_body("Authentication required"), 401

    @app.errorhandler(403)
    def handle_forbidden(e):
        return error_body("You do not have permission to access this resource."), 403

    @app.errorhandler(404)
    def handle_not_found(e):
        return error_body("The requested resource was not found."), 404

    @app.errorhandler(405)
    def handle_method_not_allowed(e):
        return error_body("The method is not allowed for this endpoint."), 405

    @app.errorhandler(429)
    def handle_too_many_requests(e):
        return error_body("Please try again later."), 429

    @app.errorhandler(500)
    def handle_server_error(e):
        logging.error("Internal server error: %s", e)
        return error_body("An unexpected error occurred."), 500

    @app.errorhandler(CSRFError)
    def handle_csrf_error(e):
        logging.warning("CSRF validation failed: %s", e)
        return error_body("CSRF token validation failed", [str(e.description)]), 400

    @app.errorhandler(Exception)
    def handle_unhandled_exception(e):
        if isinstance(e, HTTPException):
            return error_body(e.description or e.name), e.code

        logging.error("Unhandled exception: %s", e, exc_info=True)
        return error_body("An unexpected error occurred."), 500

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