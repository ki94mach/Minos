import transaction
import logging
from mongo_manager import MongoManager
from ZODB_manager import RegistryManager
from med_core import Patient, Characteristic, Drug, Treatment, FollowUp, MedicalTreatment, AlternativeTreatments

def commit(*instances):
    try:
        transaction.commit()
        logging.info("Transaction committed successfully.")
        mongo_manager = MongoManager()
        for instance in instances:
            colloction_name = get_collection_name(instance)
            instance_id = generate_hash(instance)
            mongo_manager.insert_update(instance_id, colloction_name, instance.to_dict())
        mongo_manager.close()

    except Exception as e:
        transaction.abort()
        logging.error(f"Failed to commit transaction: {str(e)}")
        raise RuntimeError(f"Failed to commit transaction: {str(e)}")
    

def generate_hash(instance):
    """Generate a consistent hash for the given instance"""
    import hashlib
    import json

    instance_data = json.dump(instance.to_dict())
    return hashlib.sha256(instance_data.encode('utf-8')).hexdigest()

def get_collection_name(instance):
    """Return the collection name based on the instance's class type."""
    if isinstance(instance, Characteristic):
        return 'characteristics'
    elif isinstance(instance, Drug):
        return 'drugs'
    elif isinstance(instance, (Treatment, MedicalTreatment, AlternativeTreatments)):
        return 'treatments'
    elif isinstance(instance, Patient):
        return 'patients'
    elif isinstance(instance, FollowUp):
        return 'followups'
    else:
        raise ValueError(f"Unknown instance type: {type(instance)}")


def sync_patients():
    """Synchronize all registries in the ZODB to MongoDB"""
    try:
        with RegistryManager() as rm:
            mongo_manager = MongoManager()
            registries = {
                'characteristic_registry': 'characteristics',
                'drug_registry': 'drugs',
                'treatment_registry': 'treatments',
                'patient_registry': 'patients',
                'followup_registry': 'followups'
            }
            for registry_name, collection_name in registries.items():
                registry = rm.get_registry(registry_name)
                for instance in registry.values():
                    instance_id = generate_hash(instance)
                    mongo_manager.insert_update(instance_id, collection_name, instance.to_dict())

            mongo_manager.close()
            logging.info('All registries synchronized to MongoDB successfully.')
    except Exception as e:
        logging.error(f'Failed to synchronize registries: {str(e)}')
        raise RuntimeError(f'Failed to synchronize registries: {str(e)}')
    