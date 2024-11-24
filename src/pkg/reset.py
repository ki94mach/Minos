from pkg.ZODB_manager import RegistryManager
from persistent.mapping import PersistentMapping
from utils import commit
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def reset_registry(registry_name):
    rm = RegistryManager()
    rm.root[registry_name] = PersistentMapping()
    commit()
    rm.close()
    logging.info(f"Registry '{registry_name}' has been reset.")

if __name__ == "__main__":
    # Example: Reset 'treatment_registry'
    reset_registry('treatment_registry')