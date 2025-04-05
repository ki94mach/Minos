import logging
from models.tables import PasswordResetToken


class TokenDriver:
    @staticmethod
    def create_reset_token(user, expires_in_minutes=30):
        """Create a new password reset token"""
        try:
            token = PasswordResetToken.create_token(user, expires_in_minutes)
            logging.info(f"Created password reset token for user: {user.email}")
            return token
        except Exception as e:
            logging.error(f"Error creating password reset token: {e}")
            raise

    @staticmethod
    def validate_reset_token(token_string):
        """Validate a password reset token"""
        try:
            user = PasswordResetToken.validate_token(token_string)
            if user:
                logging.info(f"Valid password reset token used for user: {user.email}")
            else:
                logging.warning(f"Invalid or expired password reset token attempted")
            return user
        except Exception as e:
            logging.error(f"Error validating password reset token: {e}")
            return None

    @staticmethod
    def mark_token_as_used(token_string):
        """Mark a token as used after it has been used to reset a password"""
        try:
            token = PasswordResetToken.objects(token=token_string, is_used=False).first()
            if token:
                token.is_used = True
                token.save()
                logging.info(f"Password reset token marked as used for user: {token.user.email}")
                return True
            return False
        except Exception as e:
            logging.error(f"Error marking token as used: {e}")
            return False

    @staticmethod
    def delete_expired_tokens():
        """Delete all expired tokens"""
        try:
            from datetime import datetime
            result = PasswordResetToken.objects(expires_at__lt=datetime.utcnow()).delete()
            logging.info(f"Deleted {result} expired password reset tokens")
            return result
        except Exception as e:
            logging.error(f"Error deleting expired tokens: {e}")
            return 0 