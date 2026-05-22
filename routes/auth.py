# routes/auth.py

from flask import Blueprint, session, jsonify, redirect, url_for, render_template
import logging
from datetime import datetime
from flask_wtf.csrf import generate_csrf

from utils.auth_security import (
    track_login_attempt, hash_password, verify_password, 
    login_required, send_password_reset_email,
    PASSWORD_RESET_TIMEOUT_MINUTES,
    set_user_session, clear_user_session, secure_headers
)
from models.tables import RoleEnum, User
from models.user.driver import UserDriver
from models.token.driver import TokenDriver

from utils.validate_request import validate_request
from utils.api_errors import error_response
from utils.auth_policy import registration_required
from validators.auth_validators import (
    LoginUserSchema,
    RegisterUserSchema,
    ChangePasswordSchema,
    ForgotPasswordSchema,
    ResetPasswordSchema
)

auth_blueprint = Blueprint('auth', __name__)


# ----------------- LOGIN -----------------

@auth_blueprint.route("/csrf-token", methods=["GET"])
def get_csrf_token():
    token = generate_csrf()
    resp  = jsonify({"csrf_token": token})
    resp.set_cookie(
        "csrf_token", token,
        secure=False,
        samesite="None",
        httponly=False
    )
    return resp

@auth_blueprint.route('/login', methods=['GET'])
def login_get():
    return render_template('index.html')


@auth_blueprint.route('/login', methods=['POST'])
@validate_request(LoginUserSchema, location='json')
def login_post(validated_data):
    email = validated_data.email
    password = validated_data.password

    try:
        if track_login_attempt(email, False):
            return error_response(
                'Account temporarily locked due to too many failed login attempts. Please try again later.',
                429,
            )

        user = UserDriver.get_user_by_email(email=email)
        if not user or not verify_password(password, user.password_hash):
            logging.warning(f'Failed login attempt for email: {email}')
            return error_response('Invalid credentials.', 401)

        if not user.is_active:
            return error_response('Your account is inactive. Please contact support.', 403)

        track_login_attempt(email, True)

        set_user_session(
            user_id=str(user.id),
            email=user.email,
            role=user.role,
            additional_data={'last_login': str(datetime.utcnow())}
        )

        response = jsonify({'message': 'Login successful', 'role': user.role})
        for header, value in secure_headers().items():
            response.headers[header] = value
        return response, 200

    except Exception as e:
        logging.error(f'Unexpected error during login: {e}')
        return error_response('An unexpected error occurred. Please try again later.', 500)


@auth_blueprint.route('/logout', methods=['GET'])
@login_required
def logout():
    clear_user_session()
    return redirect(url_for('auth.login_get'))


# ----------------- REGISTER -----------------

@auth_blueprint.route('/register', methods=['GET'])
@registration_required
def register_get():
    if session.get('user_id'):
        return redirect(url_for('api.get_characteristics'))
    return render_template('register.html')


@auth_blueprint.route('/register', methods=['POST'])
@registration_required
@validate_request(RegisterUserSchema, location='json')
def register_post(validated_data):
    email = validated_data.email
    password = validated_data.password

    try:
        existing_user = UserDriver.get_user_by_email(email=email)
        if existing_user:
            return error_response('Email already registered.', 409)

        new_user = User(
            email=email,
            password_hash=hash_password(password),
            role=RoleEnum.USER.value,
            is_active=True
        )

        user_id = UserDriver.insert(new_user)

        set_user_session(
            user_id=str(user_id),
            email=email,
            role=RoleEnum.USER.value,
            additional_data={'registered_at': str(datetime.utcnow())}
        )

        response = jsonify({'message': 'Registration successful', 'role': RoleEnum.USER.value})
        for header, value in secure_headers().items():
            response.headers[header] = value
        return response, 201

    except Exception as e:
        logging.error(f'Error during registration: {e}')
        return error_response('An unexpected error occurred. Please try again later.', 500)


# ----------------- CHANGE PASSWORD -----------------

@auth_blueprint.route('/change-password', methods=['GET'])
@login_required
def change_password_get():
    return redirect("http://localhost:3000/auth/change-password")  


@auth_blueprint.route('/change-password', methods=['POST'])
@login_required
@validate_request(ChangePasswordSchema, location='json')
def change_password(validated_data):
    current_password = validated_data.current_password
    new_password = validated_data.new_password

    try:
        user_email = session.get('email')
        user = UserDriver.get_user_by_email(email=user_email)

        if not verify_password(current_password, user.password_hash):
            return error_response('Current password is incorrect.', 401)

        user.password_hash = hash_password(new_password)
        UserDriver.update(user)
        return jsonify({'message': 'Password changed successfully'}), 200

    except Exception as e:
        logging.error(f'Error changing password: {e}')
        return error_response('An unexpected error occurred. Please try again later.', 500)


# ----------------- FORGOT PASSWORD -----------------

@auth_blueprint.route('/forgot-password', methods=['GET'])
def forgot_password_get():
    if session.get('user_id'):
        return redirect(url_for('api.get_characteristics'))
    return render_template('forgot_password.html')


@auth_blueprint.route('/forgot-password', methods=['POST'])
@validate_request(ForgotPasswordSchema, location='json')
def forgot_password_post(validated_data):
    email = validated_data.email

    try:
        user = UserDriver.get_user_by_email(email=email)

        if not user:
            logging.info(f"Password reset requested for non-existent email: {email}")
            return jsonify({'message': 'If your email is registered, you will receive password reset instructions.'}), 200

        reset_token = TokenDriver.create_reset_token(user, expires_in_minutes=PASSWORD_RESET_TIMEOUT_MINUTES)
        reset_url = url_for('auth.reset_password_get', token=reset_token.token, _external=True)

        send_password_reset_email(email, reset_url)
        return jsonify({'message': 'If your email is registered, you will receive password reset instructions.'}), 200

    except Exception as e:
        logging.error(f'Error during forgot password process: {e}')
        return error_response('An unexpected error occurred. Please try again later.', 500)


# ----------------- RESET PASSWORD -----------------

@auth_blueprint.route('/reset-password/<token>', methods=['GET'])
def reset_password_get(token):
    if not token:
        return redirect(url_for('auth.login_get'))
    
    user = TokenDriver.validate_reset_token(token)
    if not user:
        return render_template('error.html', 
                              error_title='Invalid Reset Link',
                              error_message='The password reset link is invalid or has expired. Please request a new one.')
    return render_template('reset_password.html', token=token)


@auth_blueprint.route('/reset-password', methods=['POST'])
@validate_request(ResetPasswordSchema, location='json')
def reset_password_post(validated_data):
    token = validated_data.token
    password = validated_data.password

    try:
        user = TokenDriver.validate_reset_token(token)
        if not user:
            logging.warning("Invalid or expired password reset token used")
            return error_response('The password reset link is invalid or has expired.', 400)

        user.password_hash = hash_password(password)
        UserDriver.update(user)
        TokenDriver.mark_token_as_used(token)
        return jsonify({'message': 'Your password has been reset successfully. You can now log in with your new password.'}), 200

    except Exception as e:
        logging.error(f'Error during password reset: {e}')
        return error_response('An unexpected error occurred. Please try again later.', 500)
