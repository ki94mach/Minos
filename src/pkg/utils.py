import transaction
import logging
from mongo_manager import MongoManager
from med_core import Patient

def commit(patient: Patient=None):
    try:
        transaction.commit()
        logging.info("Transaction committed successfully.")
        if patient:
            mongo_manager = MongoManager()
            patient_id = generate_patient_id(patient)
            patient_data = serialize_patient(patient)
            mongo_manager.insert_update_patient(patient_id, patient_data)
            mongo_manager.close()
    except Exception as e:
        transaction.abort()
        logging.error(f"Failed to commit transaction: {str(e)}")
        raise RuntimeError(f"Failed to commit transaction: {str(e)}")
    

def generate_patient_id(patient: Patient):
    """Generate a consistent patient ID based on patient chracteristics and size"""
    char_hash = tuple((char.type, char.name, size, rate) for char, size, rate in patient.chars)
    return hash((char_hash, patient.size))

def serialize_patient(patient: Patient):
    """Serialize patient data to a dictionary for MangoDB"""
    return {
        'chars': [
            {
                'type': char.type,
                'name': char.name,
                'size': size,
                'rate': rate,
                }
                for char, size, rate in patient.chars],
        'size': patient.size,
        'treatment': [
            {'name': t.name}
            for t in patient.treatment
        ]
    }