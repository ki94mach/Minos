import re
import bcrypt
from flask import session, request, jsonify, redirect, url_for, current_app
from functools import wraps
import time
import hashlib
import secrets
from datetime import datetime
import logging
from flask_mail import Message

# Dictionary to track login attempts
login_attempts = {}
# Maximum number of failed login attempts before temporary lockout
MAX_FAILED_ATTEMPTS = 5
# Lockout duration in seconds
LOCKOUT_DURATION = 300  # 5 minutes

# Password reset configuration
PASSWORD_RESET_TIMEOUT_MINUTES = 30


def is_strong_password(password):
    """
    Validates password strength.
    Must meet at least 3 of these 4 criteria:
    - At least 12 characters long
    - Contains lowercase and uppercase letters
    - Contains at least one digit
    - Contains at least one special character
    
    Browser auto-generated passwords are typically very strong but might not
    meet every specific requirement.
    """
    # Initialize criteria counter
    criteria_met = 0
    
    # Check password length - browsers usually generate long passwords
    if len(password) >= 12:
        criteria_met += 1
    
    # Check for mix of upper and lowercase
    if bool(re.search(r'[a-z]', password)) and bool(re.search(r'[A-Z]', password)):
        criteria_met += 1
    
    # Check for digits
    if bool(re.search(r'\d', password)):
        criteria_met += 1
    
    # Check for special characters
    if bool(re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=[\]\\;\'/]', password)):
        criteria_met += 1
    
    # Always require minimum length for security
    if len(password) < 8:
        return False
        
    # Password is strong if it meets at least 3 of the 4 criteria
    return criteria_met >= 3


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
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('user_id'):
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function


def generate_csrf_token():
    """
    Generates a CSRF token for form protection.
    """
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    return session['csrf_token']


def validate_csrf_token(token):
    """
    Validates a CSRF token.
    """
    return token == session.get('csrf_token')


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