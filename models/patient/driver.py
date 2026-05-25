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
    def get_by_id(drug_id):
        """Retrieve a Drug document by its id using MongoEngine’s objects call."""
        return Patient.objects(id=drug_id).first()
    
    @staticmethod
    def update(patient: Patient):
        """
        Persist in-memory patient tree mutations.

        Marks ``tree`` changed so MongoEngine saves in-place edits to the
        nested ``Node`` embed (splice, field updates, catalog sync patches).
        Top-level ``tree_hash`` updates are tracked automatically on assign.
        """
        try:
            patient._mark_as_changed('tree')
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
