# driver.py
import logging
from ..tables import (
    Characteristic,
    Drug,
    Followup,
    Treatment,
    Patient
)


# Driver for Treatment collection
class TreatmentDriver:
    @staticmethod
    def insert(treatment: Treatment):
        try:
            treatment.save()
            logging.info(f"Inserted Treatment with id: {treatment.id}")
            return treatment.id
        except Exception as e:
            logging.error(f"Error inserting Treatment: {e}")
            raise

    @staticmethod
    def find(**query):
        return Treatment.objects(**query)

    @staticmethod
    def update(treatment: Treatment):
        try:
            treatment.save()
            logging.info(f"Updated Treatment with id: {treatment.id}")
        except Exception as e:
            logging.error(f"Error updating Treatment: {e}")
            raise

    @staticmethod
    def delete(treatment_id):
        result = Treatment.objects(id=treatment_id).delete()
        if result:
            logging.info(f"Deleted Treatment with id: {treatment_id}")
        else:
            logging.warning(f"Treatment with id: {treatment_id} not found.")
