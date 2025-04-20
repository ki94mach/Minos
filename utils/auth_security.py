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
from typing import Optional, Dict, Any
import json

from validators.auth_validators import RegisterUserSchema, validate_strong_password, validate_email

# Constants for security settings
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION = 300  # 5 minutes
PASSWORD_RESET_TIMEOUT_MINUTES = 30
SESSION_TIMEOUT_MINUTES = 30
TOKEN_LENGTH = 64

# Dictionary to track login attempts with type hints
login_attempts: Dict[str, Dict[str, Any]] = {}


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


def set_user_session(user_id: str, email: str, role: str, additional_data: Optional[Dict] = None) -> None:
    """
    Create and store user session data with enhanced security.
    """
    session['user_id'] = user_id
    session['email'] = email
    session['role'] = role
    session['created_at'] = time.time()
    
    # Store additional session data
    if additional_data:
        for key, value in additional_data.items():
            if isinstance(value, (str, int, float, bool)):
                session[key] = value
            else:
                # Safely serialize complex objects
                try:
                    session[key] = json.dumps(value)
                except (TypeError, ValueError) as e:
                    logging.warning(f"Could not serialize session data for key {key}: {e}")

    # Set session expiry
    session.permanent = True
    
    # Log session creation
    logging.info(f"Session created for user {email} with role {role}")


def clear_user_session() -> None:
    """
    Securely clear the user session.
    """
    user_email = session.get('email')
    
    # Clear all session data
    session.clear()
    
    # Log session clearing
    if user_email:
        logging.info(f"Session cleared for user {user_email}")


def hash_password(password: str) -> str:
    """
    Creates a stronger password hash with bcrypt using higher work factor.
    """
    if not password:
        raise ValueError("Password cannot be empty")
    
    # Use a higher work factor (12) for better security
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """
    Verifies a password against a hash in constant time to prevent timing attacks.
    """
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception as e:
        logging.error(f"Error verifying password: {e}")
        return False


def track_login_attempt(email: str, success: bool) -> bool:
    """
    Track login attempts and implement account lockout.
    Returns True if account is locked, False otherwise.
    """
    now = time.time()
    
    # Initialize tracking for new email
    if email not in login_attempts:
        login_attempts[email] = {
            'attempts': 0,
            'last_attempt': now,
            'locked_until': None
        }
    
    # Check if account is locked
    if login_attempts[email].get('locked_until'):
        if now < login_attempts[email]['locked_until']:
            return True
        # Reset counter after lockout period
        login_attempts[email] = {
            'attempts': 0,
            'last_attempt': now,
            'locked_until': None
        }
    
    if success:
        # Reset counter on successful login
        login_attempts[email]['attempts'] = 0
    else:
        # Increment counter on failed attempt
        login_attempts[email]['attempts'] += 1
        
    login_attempts[email]['last_attempt'] = now
    
    # Lock account if too many failed attempts
    if login_attempts[email]['attempts'] >= MAX_FAILED_ATTEMPTS:
        login_attempts[email]['locked_until'] = now + LOCKOUT_DURATION
        logging.warning(f"Account locked for {email} due to too many failed attempts")
        return True
    
    return False


def login_required(f):
    """
    Decorator to protect routes that require authentication.
    Includes session timeout check and activity tracking.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Check session timeout
        created_at = session.get('created_at', 0)
        if time.time() - created_at > (SESSION_TIMEOUT_MINUTES * 60):
            clear_user_session()
            return jsonify({'error': 'Session expired'}), 401
        
        # Update session activity timestamp
        try:
            session['last_activity'] = time.time()
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


def generate_secure_token(length: int = TOKEN_LENGTH) -> str:
    """
    Generate a cryptographically secure token.
    """
    if length < 32:
        raise ValueError("Token length must be at least 32 characters")
    return secrets.token_urlsafe(length)


def send_password_reset_email(email: str, reset_url: str) -> bool:
    """
    Send password reset email with enhanced security measures.
    Returns True if email was sent successfully.
    """
    try:
        # Validate email
        validate_email(email)
        
        msg = Message('Password Reset Request',
                     sender=current_app.config['MAIL_DEFAULT_SENDER'],
                     recipients=[email])
        
        msg.body = f"""To reset your password, visit the following link:
{reset_url}

This link will expire in {PASSWORD_RESET_TIMEOUT_MINUTES} minutes.

If you did not make this request then simply ignore this email and no changes will be made.
"""
        
        msg.html = f"""
<p>To reset your password, click the link below:</p>
<p><a href="{reset_url}">Reset Password</a></p>
<p>This link will expire in {PASSWORD_RESET_TIMEOUT_MINUTES} minutes.</p>
<p>If you did not make this request then simply ignore this email and no changes will be made.</p>
"""
        
        current_app.mail.send(msg)
        logging.info(f"Password reset email sent to {email}")
        return True
        
    except Exception as e:
        logging.error(f"Error sending password reset email to {email}: {e}")
        return False


def secure_headers() -> Dict[str, str]:
    """
    Returns security headers with strict CSP and other protections.
    """
    return {
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
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
    }
