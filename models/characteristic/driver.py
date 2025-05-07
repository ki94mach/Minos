import logging
from ..tables import Characteristic

class CharacteristicDriver:
    @staticmethod
    def insert(characteristic: Characteristic):
        try:
            characteristic.save()
            logging.info(f"Inserted Characteristic with id: {characteristic.id}")
            return characteristic.id
        except Exception as e:
            logging.error(f"Error inserting Characteristic: {e}")
            raise

    @staticmethod
    def find(**query):
        return Characteristic.objects(**query)
    
    @staticmethod
    def get_by_id(drug_id):
        """Retrieve a Drug document by its id using MongoEngine’s objects call."""
        return Characteristic.objects(id=drug_id).first()
    
    @staticmethod
    def update(characteristic: Characteristic):
        try:
            characteristic.save()
            logging.info(f"Updated Characteristic with id: {characteristic.id}")
        except Exception as e:
            logging.error(f"Error updating Characteristic: {e}")
            raise

    @staticmethod
    def delete(characteristic_id):
        result = Characteristic.objects(id=characteristic_id).delete()
        if result:
            logging.info(f"Deleted Characteristic with id: {characteristic_id}")
        else:
            logging.warning(f"Characteristic with id: {characteristic_id} not found.")
