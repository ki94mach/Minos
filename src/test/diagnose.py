from pkg.ZODB_manager import RegistryManager
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def diagnose_registries():
    with RegistryManager() as rm:
        registries = [
            'characteristic_registry',
            'drug_registry',
            'patient_registry',
            'treatment_registry',
            'followup_registry'
        ]
        for registry_name in registries:
            try:
                registry = rm.get_registry(registry_name)
                print(f"\nRegistry: {registry_name}")
                print(f"Contents: {list(registry.values())}")
            except Exception as e:
                logging.error(f"Error accessing registry '{registry_name}': {e}")


if __name__ == "__main__":
    diagnose_registries()
    