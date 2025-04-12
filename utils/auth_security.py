import re
import bcrypt
from flask import session, request, jsonify, redirect, url_for, current_app
from functools import wraps
import time
import secrets
import logging
from flask_mail import Message
import redis
from flask_wtf.csrf import generate_csrf

from validators.auth_validators import RegisterUserSchema

# Dictionary to track login attempts
login_attempts = {}
# Maximum number of failed login attempts before temporary lockout
MAX_FAILED_ATTEMPTS = 5
# Lockout duration in seconds
LOCKOUT_DURATION = 300  # 5 minutes

# Password reset configuration
PASSWORD_RESET_TIMEOUT_MINUTES = 30


def get_redis_connection():
    """
    Get a Redis connection from the Flask application configuration
    """
    try:
        from run import redis_client
        return redis_client
    except ImportError:
        # Fallback to config-based connection
        redis_url = current_app.config.get('SESSION_REDIS', 'redis://:MinosProject1234@10.20.52.20:6379/0')
        if isinstance(redis_url, str):
            return redis.from_url(redis_url)
        # If SESSION_REDIS is already a Redis instance
        return redis_url


def set_user_session(user_id, email, role, additional_data=None):
    """
    Create and store user session data in Redis
    """
    session['user_id'] = str(user_id)
    session['email'] = email
    session['role'] = role
    
    # Store additional user information if provided
    if additional_data and isinstance(additional_data, dict):
        for key, value in additional_data.items():
            session[key] = value
    
    # Generate new CSRF token on session creation using Flask-WTF
    generate_csrf()


def clear_user_session():
    """
    Clear the user session completely
    """
    session.clear()


def hash_password(password):
    """
    Creates a stronger password hash with bcrypt using higher work factor.
    """
    # Use a higher work factor (12) for bcrypt for better security
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(12)).decode('utf-8')


def verify_password(password, hashed):
    """
    Verifies a password against a hash in constant time to prevent timing attacks.
    """
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def track_login_attempt(email, success):
    """
    Tracks login attempts to prevent brute force attacks.
    Returns True if the account is locked due to too many failed attempts.
    """
    now = time.time()
    
    if email not in login_attempts:
        login_attempts[email] = {
            'attempts': 0,
            'last_attempt': now,
            'locked_until': 0
        }
    
    # Check if account is currently locked
    if login_attempts[email]['locked_until'] > now:
        return True  # Account is locked
    
    # If lockout has expired, reset the counter
    if login_attempts[email]['locked_until'] > 0 and login_attempts[email]['locked_until'] <= now:
        login_attempts[email]['attempts'] = 0
        login_attempts[email]['locked_until'] = 0
    
    # Reset counter after a successful login
    if success:
        login_attempts[email]['attempts'] = 0
        return False
    
    # Increment counter for failed attempt
    login_attempts[email]['attempts'] += 1
    login_attempts[email]['last_attempt'] = now
    
    # Lock account if too many failed attempts
    if login_attempts[email]['attempts'] >= MAX_FAILED_ATTEMPTS:
        login_attempts[email]['locked_until'] = now + LOCKOUT_DURATION
        return True
    
    return False


def login_required(f):
    """
    Decorator to protect routes that require authentication.
    Checks if the user is logged in by verifying the session data in Redis.
    Updates the session activity timestamp on each access.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Record session activity
        try:
            from utils.redis_utils import update_session_activity
            session_id = session.sid if hasattr(session, 'sid') else None
            if session_id:
                update_session_activity(session_id)
        except Exception as e:
            logging.warning(f"Could not update session activity: {e}")
            
        return f(*args, **kwargs)
    return decorated_function


def get_csrf_token():
    """
    Gets a CSRF token using Flask-WTF's generate_csrf function.
    This replaces the custom generate_csrf_token function.
    """
    return generate_csrf()


def generate_secure_token(length=64):
    """
    Generates a secure random token for password reset.
    """
    return secrets.token_urlsafe(length)


def send_password_reset_email(email, reset_url):
    """
    Sends a password reset email to the user using Flask-Mail.
    Will work in both development and production environments.
    """
    try:
        from flask import current_app
        # Get mail instance from current app context
        mail = current_app.extensions['mail']
        
        app_name = "Minos"  # You can customize this or fetch from config
        
        # Create message
        subject = f"{app_name} - Password Reset Request"
        
        body = f"""
Hello,

You have requested to reset your password. Please click the link below to reset your password:

{reset_url}

This link will expire in {PASSWORD_RESET_TIMEOUT_MINUTES} minutes.

If you did not request this reset, please ignore this email and your password will remain unchanged.

Regards,
The {app_name} Team
        """
        
        # Create and send the email message
        msg = Message(
            subject=subject,
            recipients=[email],
            body=body,
            sender=current_app.config.get('MAIL_DEFAULT_SENDER')
        )
        
        mail.send(msg)
        logging.info(f"Password reset email sent to {email}")
        return True
    except Exception as e:
        logging.error(f"Failed to send password reset email: {e}")
        
        # Still log the reset URL so it can be manually retrieved during development
        logging.info(f"Password reset URL for {email}: {reset_url}")
        
        return False


def secure_headers():
    """
    Returns a dictionary of secure headers that should be added to all responses.
    """
    return {
        'Content-Security-Policy': "default-src 'self'; script-src 'self' https://code.jquery.com; style-src 'self' 'unsafe-inline'",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    } 
