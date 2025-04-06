# routes/auth.py
from flask import Blueprint, request, session, jsonify, redirect, url_for, render_template, make_response, current_app
import logging
from utils.helpers import SecurityUtils
from utils.auth_security import (
    track_login_attempt, is_strong_password, 
    hash_password, verify_password, 
    generate_csrf_token, validate_csrf_token,
    secure_headers, login_required,
    send_password_reset_email, generate_secure_token,
    PASSWORD_RESET_TIMEOUT_MINUTES,
    set_user_session, clear_user_session
)
from models.tables import RoleEnum, User
from models.user.driver import UserDriver
from models.token.driver import TokenDriver
from datetime import datetime

auth_blueprint = Blueprint('auth', __name__)


@auth_blueprint.route('/login', methods=['GET'])
def login_get():
    if session.get('user_id'):
        # Redirect to a dashboard or home route after login
        return redirect(url_for('api.get_characteristics'))

    # Generate CSRF token
    csrf_token = generate_csrf_token()
    
    # Render login template with CSRF token
    return render_template('login.html', csrf_token=csrf_token)


@auth_blueprint.route('/login', methods=['POST'])
def login_post():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    csrf_token = data.get('csrf_token')
    
    # Validate required fields
    if not email or not password:
        return jsonify({'status': 'fail', 'error': 'Email and password are required.'}), 400
    
    # Validate CSRF token
    if not validate_csrf_token(csrf_token):
        logging.warning(f'Invalid CSRF token during login attempt for email: {email}')
        return jsonify({'status': 'fail', 'error': 'Invalid CSRF token.'}), 400

    try:
        # Check if account is locked due to too many failed attempts
        if track_login_attempt(email, False):  # Initially mark as failed
            return jsonify({
                'status': 'fail', 
                'error': 'Account temporarily locked due to too many failed login attempts. Please try again later.'
            }), 429
        
        # Retrieve the user from the database
        user = UserDriver.get_user_by_email(email=email)
        
        if not user or not verify_password(password, user.password_hash):
            logging.warning(f'Failed login attempt for email: {email}')
            return jsonify({'status': 'fail', 'error': 'Invalid credentials.'}), 401

        if not user.is_active:
            return jsonify({'status': 'fail', 'error': 'Your account is inactive. Please contact support.'}), 403

        # Login successful - reset failed login counter
        track_login_attempt(email, True)
        
        # Set session data using Redis helper
        set_user_session(
            user_id=str(user.id),
            email=user.email,
            role=user.role,
            additional_data={
                'last_login': str(datetime.utcnow())
            }
        )

        # Return success response with user role
        response = jsonify({'message': 'Login successful', 'role': user.role})
        
        # Add security headers
        for header, value in secure_headers().items():
            response.headers[header] = value
        
        return response, 200

    except Exception as e:
        logging.error(f'Unexpected error during login: {e}')
        return jsonify({'status': 'fail', 'error': 'An unexpected error occurred. Please try again later.'}), 500


@auth_blueprint.route('/logout', methods=['GET'])
def logout():
    clear_user_session()
    return redirect(url_for('auth.login_get'))


@auth_blueprint.route('/register', methods=['GET'])
def register_get():
    if session.get('user_id'):
        # Redirect to dashboard if already logged in
        return redirect(url_for('api.get_characteristics'))
    
    # Generate CSRF token
    csrf_token = generate_csrf_token()
    
    return render_template('register.html', csrf_token=csrf_token)


@auth_blueprint.route('/register', methods=['POST'])
def register_post():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    csrf_token = data.get('csrf_token')
    
    # Validate required fields
    if not email or not password:
        return jsonify({'status': 'fail', 'error': 'Email and password are required.'}), 400
    
    # Validate CSRF token
    if not validate_csrf_token(csrf_token):
        return jsonify({'status': 'fail', 'error': 'Invalid CSRF token.'}), 400
    
    # Validate password strength
    if not is_strong_password(password):
        return jsonify({
            'status': 'fail', 
            'error': 'Password must meet at least 3 of these 4 criteria: 12+ characters, mix of upper/lowercase, contains digits, contains special characters. Minimum length: 8 characters.'
        }), 400
    
    try:
        # Check if user already exists
        existing_user = UserDriver.get_user_by_email(email=email)
        if existing_user:
            return jsonify({'status': 'fail', 'error': 'Email already registered.'}), 409
        
        # Create new user with default USER role
        new_user = User(
            email=email,
            password_hash=hash_password(password),
            role=RoleEnum.USER.value,
            is_active=True
        )
        
        # Save user
        user_id = UserDriver.insert(new_user)
        
        # Auto-login the user after registration using Redis helper
        set_user_session(
            user_id=str(user_id),
            email=email,
            role=RoleEnum.USER.value,
            additional_data={
                'registered_at': str(datetime.utcnow())
            }
        )
        
        # Return success
        response = jsonify({'message': 'Registration successful', 'role': RoleEnum.USER.value})
        
        # Add security headers
        for header, value in secure_headers().items():
            response.headers[header] = value
            
        return response, 201
        
    except Exception as e:
        logging.error(f'Error during registration: {e}')
        return jsonify({'status': 'fail', 'error': 'An unexpected error occurred. Please try again later.'}), 500


@auth_blueprint.route('/change-password', methods=['GET'])
@login_required
def change_password_get():
    # Generate CSRF token
    csrf_token = generate_csrf_token()
    
    return render_template('change_password.html', csrf_token=csrf_token)


@auth_blueprint.route('/change-password', methods=['POST'])
@login_required
def change_password():
    data = request.get_json()
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    csrf_token = data.get('csrf_token')
    
    # Validate required fields
    if not current_password or not new_password:
        return jsonify({'status': 'fail', 'error': 'Current and new passwords are required.'}), 400
    
    # Validate CSRF token
    if not validate_csrf_token(csrf_token):
        return jsonify({'status': 'fail', 'error': 'Invalid CSRF token.'}), 400
    
    # Validate password strength
    if not is_strong_password(new_password):
        return jsonify({
            'status': 'fail', 
            'error': 'Password must meet at least 3 of these 4 criteria: 12+ characters, mix of upper/lowercase, contains digits, contains special characters. Minimum length: 8 characters.'
        }), 400
    
    try:
        # Get current user
        user_email = session.get('email')
        user = UserDriver.get_user_by_email(email=user_email)
        
        # Verify current password
        if not verify_password(current_password, user.password_hash):
            return jsonify({'status': 'fail', 'error': 'Current password is incorrect.'}), 401
        
        # Update password
        user.password_hash = hash_password(new_password)
        UserDriver.update(user)
        
        # Generate new CSRF token after password change
        generate_csrf_token()
        
        return jsonify({'message': 'Password changed successfully'}), 200
        
    except Exception as e:
        logging.error(f'Error changing password: {e}')
        return jsonify({'status': 'fail', 'error': 'An unexpected error occurred. Please try again later.'}), 500


@auth_blueprint.route('/forgot-password', methods=['GET'])
def forgot_password_get():
    if session.get('user_id'):
        # If already logged in, redirect to dashboard
        return redirect(url_for('api.get_characteristics'))
    
    # Generate CSRF token
    csrf_token = generate_csrf_token()
    
    # Render forgot password template
    return render_template('forgot_password.html', csrf_token=csrf_token)


@auth_blueprint.route('/forgot-password', methods=['POST'])
def forgot_password_post():
    data = request.get_json()
    email = data.get('email')
    csrf_token = data.get('csrf_token')
    
    # Validate email
    if not email:
        return jsonify({'status': 'fail', 'error': 'Email is required.'}), 400
    
    # Validate CSRF token
    if not validate_csrf_token(csrf_token):
        logging.warning(f'Invalid CSRF token during forgot password attempt for email: {email}')
        return jsonify({'status': 'fail', 'error': 'Invalid CSRF token.'}), 400
    
    try:
        # Find user by email
        user = UserDriver.get_user_by_email(email=email)
        
        # Important security note: Don't reveal if the email exists or not
        # Always return a success message to prevent email enumeration attacks
        if not user:
            logging.info(f"Password reset requested for non-existent email: {email}")
            return jsonify({'message': 'If your email is registered, you will receive password reset instructions.'}), 200
        
        # Create reset token
        reset_token = TokenDriver.create_reset_token(user, expires_in_minutes=PASSWORD_RESET_TIMEOUT_MINUTES)
        
        # Generate reset URL
        reset_url = url_for('auth.reset_password_get', token=reset_token.token, _external=True)
        
        # Send password reset email
        send_password_reset_email(email, reset_url)
        
        return jsonify({'message': 'If your email is registered, you will receive password reset instructions.'}), 200
        
    except Exception as e:
        logging.error(f'Error during forgot password process: {e}')
        # Return generic message to prevent information disclosure
        return jsonify({'status': 'fail', 'error': 'An unexpected error occurred. Please try again later.'}), 500


@auth_blueprint.route('/reset-password/<token>', methods=['GET'])
def reset_password_get(token):
    if not token:
        return redirect(url_for('auth.login_get'))
    
    # Validate token before showing the form
    user = TokenDriver.validate_reset_token(token)
    if not user:
        # Invalid or expired token
        return render_template('error.html', 
                              error_title='Invalid Reset Link',
                              error_message='The password reset link is invalid or has expired. Please request a new one.')
    
    # Generate CSRF token
    csrf_token = generate_csrf_token()
    
    # Render reset password form
    return render_template('reset_password.html', token=token, csrf_token=csrf_token)


@auth_blueprint.route('/reset-password', methods=['POST'])
def reset_password_post():
    data = request.get_json()
    password = data.get('password')
    token = data.get('token')
    csrf_token = data.get('csrf_token')
    
    # Validate data
    if not password or not token:
        return jsonify({'status': 'fail', 'error': 'Password and token are required.'}), 400
    
    # Validate CSRF token
    if not validate_csrf_token(csrf_token):
        return jsonify({'status': 'fail', 'error': 'Invalid CSRF token.'}), 400
    
    # Validate password strength
    if not is_strong_password(password):
        return jsonify({
            'status': 'fail', 
            'error': 'Password must meet at least 3 of these 4 criteria: 12+ characters, mix of upper/lowercase, contains digits, contains special characters. Minimum length: 8 characters.'
        }), 400
    
    try:
        # Validate token and get user
        user = TokenDriver.validate_reset_token(token)
        if not user:
            logging.warning(f"Invalid or expired password reset token used")
            return jsonify({'status': 'fail', 'error': 'The password reset link is invalid or has expired.'}), 400
        
        # Update user's password
        user.password_hash = hash_password(password)
        UserDriver.update(user)
        
        # Mark token as used
        TokenDriver.mark_token_as_used(token)
        
        # Return success message
        return jsonify({'message': 'Your password has been reset successfully. You can now log in with your new password.'}), 200
        
    except Exception as e:
        logging.error(f'Error during password reset: {e}')
        return jsonify({'status': 'fail', 'error': 'An unexpected error occurred. Please try again later.'}), 500
