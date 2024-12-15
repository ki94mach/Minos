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
            patient_id = hash(patient)
            patient_data = {
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
            mongo_manager.insert_update_patient(patient_id, patient_data)
            mongo_manager.close()
            
    except Exception as e:
        transaction.abort()
        logging.error(f"Failed to commit transaction: {str(e)}")
        raise RuntimeError(f"Failed to commit transaction: {str(e)}")
    