import logging
from ..tables import PatientTree as Patient


class PatientDriver:
    @staticmethod
    def insert(patient: Patient):
        try:
            patient.save()
            logging.info(f"Inserted Patient with id: {patient.id}")
            return patient.id
        except Exception as e:
            logging.error(f"Error inserting Patient: {e}")
            raise

    @staticmethod
    def find(**query):
        return Patient.objects(**query)

    @staticmethod
    def update(patient: Patient):
        try:
            patient.save()
            logging.info(f"Updated Patient with id: {patient.id}")
        except Exception as e:
            logging.error(f"Error updating Patient: {e}")
            raise

    @staticmethod
    def delete(patient_id):
        result = Patient.objects(id=patient_id).delete()
        if result:
            logging.info(f"Deleted Patient with id: {patient_id}")
        else:
            logging.warning(f"Patient with id: {patient_id} not found.")
