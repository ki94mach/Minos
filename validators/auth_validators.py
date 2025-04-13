# validators/auth_validators.py

import re
from pydantic import BaseModel, field_validator, EmailStr

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
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters long.")

    criteria_met = 0

    # Criterion 1: At least 12 characters long
    if len(value) >= 12:
        criteria_met += 1

    # Criterion 2: Contains both lowercase and uppercase letters
    if bool(re.search(r"[a-z]", value)) and bool(re.search(r"[A-Z]", value)):
        criteria_met += 1

    # Criterion 3: Contains at least one digit
    if bool(re.search(r"\d", value)):
        criteria_met += 1

    # Criterion 4: Contains at least one special character
    if bool(re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=[\]\\;\'/]', value)):
        criteria_met += 1

    if criteria_met < 3:
        raise ValueError("Password must meet at least 3 of the 4 strength criteria.")

    return value


# Schema for user registration (POST /register)
class RegisterUserSchema(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    def validate_password(cls, value: str) -> str:
        return validate_strong_password(value)


# Schema for login (POST /login)
class LoginUserSchema(BaseModel):
    email: EmailStr
    password: str


# Schema for changing password (POST /change-password)
class ChangePasswordSchema(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    def validate_new_password(cls, value: str) -> str:
        return validate_strong_password(value)


# Schema for forgot-password (POST /forgot-password)
class ForgotPasswordSchema(BaseModel):
    email: EmailStr


# Schema for resetting password (POST /reset-password)
class ResetPasswordSchema(BaseModel):
    token: str
    password: str

    @field_validator("password")
    def validate_password(cls, value: str) -> str:
        return validate_strong_password(value)
