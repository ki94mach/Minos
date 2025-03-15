# models/user/driver.py
import logging
from models.tables import User


class UserDriver:
    @staticmethod
    def insert(user: User):
        try:
            user.save()
            logging.info(f"Inserted User with id: {user.id}")
            return user.id
        except Exception as e:
            logging.error(f"Error inserting User: {e}")
            raise

    @staticmethod
    def find(**query):
        return User.objects(**query)

    @staticmethod
    def get_user_by_email(email: str):
        return User.objects(email=email).first()


    @staticmethod
    def update(user: User):
        try:
            user.save()
            logging.info(f"Updated User with id: {user.id}")
        except Exception as e:
            logging.error(f"Error updating User: {e}")
            raise

    @staticmethod
    def delete(user_id):
        result = User.objects(id=user_id).delete()
        if result:
            logging.info(f"Deleted User with id: {user_id}")
        else:
            logging.warning(f"User with id: {user_id} not found.")

    @staticmethod
    def get_user_by_email(email: str):
        try:
            user = User.objects(email=email).first()
            if user:
                logging.info(f"Found User with email: {email}")
            else:
                logging.warning(f"No user found with email: {email}")
            return user
        except Exception as e:
            logging.error(f"Error retrieving user by email {email}: {e}")
            raise
