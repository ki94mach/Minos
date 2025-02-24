# reset.py
import logging
from pkg.mongo_manager import MongoManager

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def reset_collection(collection_name, mongo_manager):
    """Drops the specified collection from MongoDB."""
    collection = mongo_manager.get_collection(collection_name)
    collection.drop()
    logging.info(f"Collection '{collection_name}' has been reset (dropped).")

if __name__ == "__main__":
    # List the collections to reset (matching your BaseModel collection naming convention)
    collections = [
        'characteristics',
        'drugs',
        'patients',
        'treatments',
        'followups'
    ]
    
    mongo_manager = MongoManager()
    try:
        for col in collections:
            reset_collection(col, mongo_manager)
        logging.info("All specified collections have been reset successfully.")
    except Exception as e:
        logging.error(f"An error occurred during reset: {e}")
    finally:
        mongo_manager.close()
