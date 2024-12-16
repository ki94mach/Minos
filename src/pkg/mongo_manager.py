from pymongo import MongoClient
import logging


class MongoManager:
    def __init__(self, db_name: str='minos_db', uri='mongodb://localhost:27017/'):
        'Initialize MongoDB connection.'
        self.client = MongoClient(uri)
        self.db = self.client[db_name]
        logging.info('Connected to MongoDB.')
    
    def get_collection(self, collection_name):
        """Collect a MongoDB collection."""
        return self.db[collection_name]    
    
    def insert_update(self, instance_id, collection_name, instance_data):
        """Insert or update instnace data in MongoDB"""
        collection = self.get_collection(collection_name)
        try:
            collection.replace_one({'_id': instance_id}, instance_data, upsert=True)
            logging.info(f'Instance {instance_id} synchronized to {collection_name} in MongoDB.')
        
        except Exception as e:
            logging.error(f'Error synchronizing instance {instance_id} to MongoDB: {str(e)}')
            raise
    
    def find_patient(self, query={}):
        """Find patients matching a query"""
        collection = self.get_collection('patients')
        return list(collection.find(query))    

    def delete_patient(self, patient_id):
        """Delete a patient by ID"""
        collection = self.get_collection('patients')
        result = collection.delete_one({'_id': patient_id})
        if result.deleted_count:
            logging.info(f'Patient {patient_id} deleted from MongoDB.')
        else:
            logging.warning(f'Patient {patient_id} not found in MongoDB.')    

    def close(self):
        """Close MOngoDB connection."""
        self.client.close()
        logging.info('MongoDB connection closed.')
