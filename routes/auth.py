# routes/auth.py
from flask import Blueprint, request, session, jsonify, redirect, url_for, render_template
import logging
from utils.helpers import SecurityUtils
from models.tables import RoleEnum  # Ensure RoleEnum is defined in your models
from models.user.driver import UserDriver

auth_blueprint = Blueprint('auth', __name__)


@auth_blueprint.route('/login', methods=['GET'])
def login_get():
    if session.get('user_id'):
        # Redirect to a dashboard or home route after login
        return redirect(url_for('api.get_characteristics'))

    return render_template('login.html')


@auth_blueprint.route('/login', methods=['POST'])
def login_post():

    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    if not email or not password:
        return jsonify({'status': 'fail', 'error': 'Email and password are required.'}), 400

    try:
        # Retrieve the user from the database (using MongoEngine)
        user = UserDriver.get_user_by_email(email=email)
        if not user or not SecurityUtils.check_password(password, user.password_hash):
            return jsonify({'status': 'fail', 'error': 'Invalid credentials.'}), 401

        if not user.is_active:
            return jsonify({'status': 'fail', 'error': 'Your account is inactive. Please contact support.'}), 403

        # Set session data
        session['user_id'] = str(user.id)
        session['email'] = user.email
        session['role'] = user.role

        # Redirect or send a success response based on the user's role.
        if user.role == RoleEnum.USER.value:
            # (Optional) add additional department-related session data here.
            return jsonify({'message': 'Login successful', 'role': user.role}), 200

        # role ADMIN
        return jsonify({'message': 'Login successful', 'role': user.role}), 200

    except Exception as e:
        logging.error(f'Unexpected error during login: {e}')
        return jsonify({'status': 'fail', 'error': 'An unexpected error occurred. Please try again later.'}), 500


@auth_blueprint.route('/logout', methods=['GET'])
def logout():
    session.clear()
    return redirect(url_for('auth.login_get'))
