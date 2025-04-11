# utils/helpers.py
import bcrypt


class SecurityUtils:

    @staticmethod
    def hash_password(password):
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    @staticmethod
    def check_password(password, hashed):
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

# hashed_pwd = SecurityUtils.hash_password("kian")
# print(hashed_pwd)
# print(SecurityUtils.check_password("kian", hashed_pwd))
