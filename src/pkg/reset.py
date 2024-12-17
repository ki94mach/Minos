from ZODB_manager import RegistryManager
from persistent.mapping import PersistentMapping
from utils import commit
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def reset_registry(registry_name, rm):
    rm.root[registry_name] = PersistentMapping()
    commit()
    logging.info(f"Registry '{registry_name}' has been reset.")

if __name__ == "__main__":
    # Example: Reset 'treatment_registry'
    registries = [
        'characteristic_registry',
        'drug_registry',
        'patient_registry',
        'treatment_registry',
        'followup_registry'
    ]
    with RegistryManager() as rm:
        for registry in registries:
            reset_registry(registry, rm)
        