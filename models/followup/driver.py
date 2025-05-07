import logging
from ..tables import Followup


class FollowupDriver:
    @staticmethod
    def insert(followup: Followup):
        try:
            followup.save()
            logging.info(f"Inserted Followup with id: {followup.id}")
            return followup.id
        except Exception as e:
            logging.error(f"Error inserting Followup: {e}")
            raise

    @staticmethod
    def find(**query):
        return Followup.objects(**query)
    
    @staticmethod
    def get_by_id(drug_id):
        """Retrieve a Drug document by its id using MongoEngine’s objects call."""
        return Followup.objects(id=drug_id).first()
    
    @staticmethod
    def update(followup: Followup):
        try:
            followup.save()
            logging.info(f"Updated Followup with id: {followup.id}")
        except Exception as e:
            logging.error(f"Error updating Followup: {e}")
            raise

    @staticmethod
    def delete(followup_id):
        result = Followup.objects(id=followup_id).delete()
        if result:
            logging.info(f"Deleted Followup with id: {followup_id}")
        else:
            logging.warning(f"Followup with id: {followup_id} not found.")
