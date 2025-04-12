# validators/auth_validators.py

import re
from pydantic import BaseModel, validator, EmailStr

class RegisterUserSchema(BaseModel):
    email: EmailStr
    password: str

    @validator("password")
    def validate_password(cls, value):
        # Always require a minimum length of 8 characters
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long.")

        # Count the number of strength criteria met:
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
