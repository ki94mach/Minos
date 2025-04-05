import unittest
import time
import pytest
from flask import session, Blueprint, jsonify
from run import create_app
from models.user.driver import UserDriver
from models.tables import User, RoleEnum
from utils.helpers import SecurityUtils
from utils.auth_security import (
    track_login_attempt, login_attempts, MAX_FAILED_ATTEMPTS, 
    LOCKOUT_DURATION, is_strong_password, login_required
)
import bcrypt
import re


class TestAuthSecurity(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.app.config['WTF_CSRF_ENABLED'] = False
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        
        # Create test user
        test_email = "test@example.com"
        test_password = "StrongPassword123!"
        
        # Check if user already exists
        existing_user = UserDriver.get_user_by_email(test_email)
        if existing_user:
            UserDriver.delete(existing_user.id)
        
        # Create a new test user
        password_hash = SecurityUtils.hash_password(test_password)
        self.test_user = User(
            email=test_email,
            password_hash=password_hash,
            role=RoleEnum.USER.value,
            is_active=True
        )
        UserDriver.insert(self.test_user)
        
        self.test_email = test_email
        self.test_password = test_password
        
    def tearDown(self):
        # Clean up test user
        user = UserDriver.get_user_by_email(self.test_email)
        if user:
            UserDriver.delete(user.id)
        self.app_context.pop()
        
        # Clear login attempts
        login_attempts.clear()
    
    def test_password_storage_security(self):
        """Test that passwords are stored securely as salted hashes"""
        user = UserDriver.get_user_by_email(self.test_email)
        self.assertIsNotNone(user)
        
        # Verify password is hashed
        self.assertNotEqual(user.password_hash, self.test_password)
        
        # Verify hashing algorithm (bcrypt hash starts with $2b$ or $2a$)
        self.assertTrue(user.password_hash.startswith('$2'))
        
        # Verify correct password validation works
        self.assertTrue(SecurityUtils.check_password(self.test_password, user.password_hash))
        
        # Verify incorrect password validation fails
        self.assertFalse(SecurityUtils.check_password("WrongPassword", user.password_hash))
    
    def test_brute_force_protection(self):
        """Test protection against brute force attacks"""
        email = self.test_email
        
        # First failed login attempt should not lock account
        is_locked = track_login_attempt(email, False)
        self.assertFalse(is_locked)
        self.assertEqual(login_attempts[email]['attempts'], 1)
        
        # Simulate MAX_FAILED_ATTEMPTS-1 more failed login attempts
        for i in range(MAX_FAILED_ATTEMPTS - 2):
            is_locked = track_login_attempt(email, False)
            self.assertFalse(is_locked)
        
        # The next attempt (MAX_FAILED_ATTEMPTS total) should lock the account
        is_locked = track_login_attempt(email, False)
        self.assertTrue(is_locked)
        self.assertEqual(login_attempts[email]['attempts'], MAX_FAILED_ATTEMPTS)
        
        # Verify account remains locked for subsequent attempts
        is_locked = track_login_attempt(email, False)
        self.assertTrue(is_locked)
        
        # Simulate passage of lockout time
        original_locked_until = login_attempts[email]['locked_until']
        login_attempts[email]['locked_until'] = time.time() - 1
        
        # Verify account is unlocked after lockout period
        is_locked = track_login_attempt(email, False)
        self.assertFalse(is_locked)
        self.assertEqual(login_attempts[email]['attempts'], 1)  # Counter resets
        
        # Successful login should reset counter
        login_attempts[email]['attempts'] = 3
        is_locked = track_login_attempt(email, True)
        self.assertFalse(is_locked)
        self.assertEqual(login_attempts[email]['attempts'], 0)
    
    def test_login_success(self):
        """Test successful login"""
        response = self.client.post('/auth/login', 
            json={"email": self.test_email, "password": self.test_password})
        self.assertEqual(response.status_code, 200)
        
        # Check response data 
        data = response.get_json()
        self.assertEqual(data.get('message'), 'Login successful')
        
        # Test session is set correctly
        with self.client.session_transaction() as sess:
            self.assertIsNotNone(sess.get('user_id'))
            self.assertEqual(sess.get('email'), self.test_email)
            self.assertEqual(sess.get('role'), RoleEnum.USER.value)
    
    def test_login_failure_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = self.client.post('/auth/login', 
            json={"email": self.test_email, "password": "WrongPassword"})
        self.assertEqual(response.status_code, 401)
        
        # Check error message
        data = response.get_json()
        self.assertEqual(data.get('error'), 'Invalid credentials.')
        
        # Ensure session wasn't set
        with self.client.session_transaction() as sess:
            self.assertIsNone(sess.get('user_id'))
    
    def test_session_security(self):
        """Test session security settings"""
        with self.app.test_request_context():
            self.assertTrue(self.app.config.get('SESSION_COOKIE_HTTPONLY'))
            # In production, this should be True (for HTTPS)
            # self.assertTrue(self.app.config.get('SESSION_COOKIE_SECURE'))
    
    def test_logout(self):
        """Test logout functionality clears the session"""
        # Login first
        self.client.post('/auth/login', 
            json={"email": self.test_email, "password": self.test_password})
        
        # Now logout
        response = self.client.get('/auth/logout')
        self.assertEqual(response.status_code, 302)  # Redirects to login page
        
        # Verify session is cleared
        with self.client.session_transaction() as sess:
            self.assertIsNone(sess.get('user_id'))
            self.assertIsNone(sess.get('email'))
            self.assertIsNone(sess.get('role'))
    
    def test_login_required_decorator(self):
        """Test unauthorized access is restricted"""
        # Create a test route with the login_required decorator
        test_blueprint = Blueprint('test', __name__)
        
        @test_blueprint.route('/protected')
        @login_required
        def protected_route():
            return jsonify({'message': 'Access granted'}), 200
        
        # Register the blueprint with a url_prefix
        self.app.register_blueprint(test_blueprint, url_prefix='/test')
        
        # Test access without login
        response = self.client.get('/test/protected')
        self.assertEqual(response.status_code, 401)
        data = response.get_json()
        self.assertEqual(data.get('error'), 'Authentication required')
        
        # Login the user
        self.client.post('/auth/login', 
            json={"email": self.test_email, "password": self.test_password})
        
        # Test access with login
        response = self.client.get('/test/protected')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data.get('message'), 'Access granted')
    
    def test_password_complexity(self):
        """Test that password complexity requirements are enforced"""
        # Valid passwords (meeting at least 3 of 4 criteria)
        self.assertTrue(is_strong_password("StrongP@ssw0rd"))  # Meets all criteria
        self.assertTrue(is_strong_password("UPPERCASE123!"))   # Meets 3 criteria (no lowercase)
        self.assertTrue(is_strong_password("LongPassword123WithUpper"))  # Meets 3 criteria (length, upper+lower, digits)
        
        # Invalid passwords
        self.assertFalse(is_strong_password("short"))  # Too short, missing criteria
        self.assertFalse(is_strong_password("Short1!"))  # Too short
        self.assertFalse(is_strong_password("lowercase123"))  # Only 2 criteria met
        
        # Browser-generated passwords should pass
        self.assertTrue(is_strong_password("X5t8#PQ2@ZmLvK"))
        self.assertTrue(is_strong_password("87^%NK3qpRrS2!"))
        self.assertTrue(is_strong_password("uV5%2qWzX9@pA7"))


if __name__ == '__main__':
    unittest.main() 