from persistent.mapping import PersistentMapping
import ZODB, ZODB.FileStorage
from utils import commit
import logging

class RegistryManager:
    _instance = None

    def __new__(cls, db_path='C:/Users/Mohajeri.K/MyProjects/Minos/src/data/minos_data.fs'):
        if cls._instance is None:
            cls._instance = super(RegistryManager, cls).__new__(cls)
            cls._instance._initialize(db_path)
        elif not hasattr(cls._instance, 'connection') or cls._instance.connection is None:
            cls._instance._initialize(db_path)
        return cls._instance
    
    # def __init__(self, db_path='C:/Users/Mohajeri.K/MyProjects/Minos/src/data/minos_data.fs'):
    #     self._initialize(db_path)

    def _initialize(self, db_path):
        self.storage = ZODB.FileStorage.FileStorage(db_path)
        self.db = ZODB.DB(self.storage)
        self.connection = self.db.open()
        self.root = self.connection.root()

        self._initialize_registry('characteristic_registry')
        self._initialize_registry('drug_registry')
        self._initialize_registry('patient_registry')
        self._initialize_registry('treatment_registry')
        self._initialize_registry('followup_registry')

        commit()


    def _initialize_registry(self, registry_name):
        """Safely initialize a PersistentMapping registry if not already present."""
        try:
            if registry_name not in self.root:
                self.root[registry_name] = PersistentMapping()
                logging.info(f"Registry '{registry_name}' initialized.")
                self.root._p_changed = True
                commit()
        except (KeyError, AttributeError) as e:
            # Handle corrupted registry by resetting it
            logging.error(f"Error initializing '{registry_name}': {str(e)}. Resetting registry.")
            self.root[registry_name] = PersistentMapping()
            commit()
            logging.info(f"Registry '{registry_name}' has been reset.")

    def get_registry(self, registry_name):
        """Retrieve a registry by name, initializing it if necessary."""
        if registry_name not in self.root:
            self._initialize_registry(registry_name)
            commit()
        registry = self.root[registry_name]
        return registry

    def close(self):
        """Close all connections to the ZODB database."""
        commit()
        self.connection.close()
        self.db.close()
        self.storage.close()
        ## RegistryManager._instance = None

    def open(self, db_path='C:/Users/Mohajeri.K/MyProjects/Minos/src/data/minos_data.fs'):
        """Open a connection to the ZODB database if it is closed."""
        if not hasattr(self, 'connection') or self.connection is None:
            self._initialize(db_path)
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_value, traceback):
        self.close()
