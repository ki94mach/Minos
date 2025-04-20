# validators/auth_validators.py

import re
from pydantic import (
    BaseModel, 
    field_validator, 
    EmailStr, 
    Field,
    ValidationInfo
)
from typing import Optional
import logging

def validate_strong_password(value: str) -> str:
    """
    Helper function to ensure a password is strong enough.
    Requirements:
      - Minimum length: 8 characters.
      - Must meet at least 3 of the following 4 criteria:
           1. At least 12 characters long.
           2. Contains both lowercase and uppercase letters.
           3. Contains at least one digit.
           4. Contains at least one special character.
    """
    if not value or not isinstance(value, str):
        raise ValueError("Password must be a non-empty string")

    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters long")

    criteria_met = 0
    criteria_details = []

    # Criterion 1: At least 12 characters long
    if len(value) >= 12:
        criteria_met += 1
        criteria_details.append("Length >= 12")

    # Criterion 2: Contains both lowercase and uppercase letters
    if bool(re.search(r"[a-z]", value)) and bool(re.search(r"[A-Z]", value)):
        criteria_met += 1
        criteria_details.append("Mixed case")

    # Criterion 3: Contains at least one digit
    if bool(re.search(r"\d", value)):
        criteria_met += 1
        criteria_details.append("Contains number")

    # Criterion 4: Contains at least one special character
    if bool(re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=[\]\\;\'/]', value)):
        criteria_met += 1
        criteria_details.append("Contains special character")

    if criteria_met < 3:
        met_str = ", ".join(criteria_details)
        raise ValueError(
            f"Password must meet at least 3 of the 4 strength criteria. "
            f"Currently met ({criteria_met}): {met_str}"
        )

    return value

def validate_email(value: str) -> str:
    """
    Additional email validation beyond Pydantic's EmailStr.
    - Checks for common disposable email domains
    - Validates length
    - Checks for common patterns
    """
    if not value or not isinstance(value, str):
        raise ValueError("Email must be a non-empty string")

    if len(value) > 254:  # Maximum length for email addresses
        raise ValueError("Email address is too long")

    # Check for suspicious patterns
    if '..' in value or value.startswith('.') or value.endswith('.'):
        raise ValueError("Invalid email format")

    # List of commonly abused disposable email domains
    disposable_domains = {
        'tempmail.com', 'throwawaymail.com', 'mailinator.com', 
        'guerrillamail.com', 'dropmail.me'
    }
    
    domain = value.split('@')[-1].lower()
    if domain in disposable_domains:
        raise ValueError("Disposable email addresses are not allowed")

    return value

class RegisterUserSchema(BaseModel):
    email: EmailStr = Field(..., description="User's email address")
    password: str = Field(..., description="User's password")
    confirm_password: str = Field(..., description="Password confirmation")

    @field_validator("email")
    def validate_email_field(cls, v: str) -> str:
        return validate_email(v)

    @field_validator("password")
    def validate_password(cls, v: str) -> str:
        return validate_strong_password(v)
    
    @field_validator('confirm_password')
    def passwords_match(cls, v: str, info: ValidationInfo) -> str:
        if 'password' in info.data and v != info.data['password']:
            raise ValueError('Passwords do not match')
        return v

class LoginUserSchema(BaseModel):
    email: EmailStr = Field(..., description="User's email address")
    password: str = Field(..., min_length=1, description="User's password")
    remember_me: Optional[bool] = Field(False, description="Remember login session")

    @field_validator("email")
    def validate_email_field(cls, v: str) -> str:
        return validate_email(v)

class ChangePasswordSchema(BaseModel):
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., description="New password")
    confirm_password: str = Field(..., description="New password confirmation")

    @field_validator("new_password")
    def validate_new_password(cls, v: str) -> str:
        return validate_strong_password(v)
    
    @field_validator('confirm_password')
    def passwords_match(cls, v: str, info: ValidationInfo) -> str:
        if 'new_password' in info.data and v != info.data['new_password']:
            raise ValueError('New passwords do not match')
        return v

class ForgotPasswordSchema(BaseModel):
    email: EmailStr = Field(..., description="User's email address")

    @field_validator("email")
    def validate_email_field(cls, v: str) -> str:
        return validate_email(v)

class ResetPasswordSchema(BaseModel):
    token: str = Field(..., min_length=32, description="Password reset token")
    password: str = Field(..., description="New password")
    confirm_password: str = Field(..., description="New password confirmation")

    @field_validator("password")
    def validate_password(cls, v: str) -> str:
        return validate_strong_password(v)
    
    @field_validator('confirm_password')
    def passwords_match(cls, v: str, info: ValidationInfo) -> str:
        if 'password' in info.data and v != info.data['password']:
            raise ValueError('Passwords do not match')
        return v
