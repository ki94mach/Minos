import transaction
import logging
from mongo_manager import MongoManager
from ZODB_manager import RegistryManager
from med_core import Patient, Characteristic, Drug, Treatment, FollowUp

def commit(*instances):
    try:
        transaction.commit()
        logging.info("Transaction committed successfully.")
        mongo_manager = MongoManager()
        for instance in instances:
            instance_id = generate_hash(instance)
            mongo_manager.insert_update(instance_id, instance.to_dict())
        mongo_manager.close()
        
    except Exception as e:
        transaction.abort()
        logging.error(f"Failed to commit transaction: {str(e)}")
        raise RuntimeError(f"Failed to commit transaction: {str(e)}")
    

def generate_hash(instance):
    """Generate a consistent ID"""
    import hashlib
    import json

    instance_data = json.dump(instance.to_dict())
    return hashlib.sha256(instance_data.encode('utf-8')).hexdigest()

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

def sync_patients():
    """Synchronize all patients in the ZODB to MongoDB"""
    try:
        with RegistryManager() as rm:
            patient_registry = rm.get_registry('patient_registry')
            mongo_manager = MongoManager()
            for patient in patient_registry.values():
                patient_id = generate_patient_id(patient)
                patient_data = serialize_patient(patient)
                mongo_manager.insert_update_patient(patient_id, patient_data)

            mongo_manager.close()
            logging.info('All patients synchronized to MongoDB successfully.')
    except Exception as e:
        logging.error(f'Failed to synchronize patients to MongoDB: {str(e)}')
        raise RuntimeError(f'Failed to synchronize patients: {str(e)}')