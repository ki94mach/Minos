import json
import hashlib
from pkg.mongo_manager import MongoManager
class BaseModel:
    unique_fields = []

    @classmethod
    def generate_id(cls, **kwargs):
        """
        Generates a unique_id based on the values of the unique_fields.
        """
        if hasattr(cls, 'unique_key_from_kwargs'):
            unique_str = cls.unique_key_from_kwargs(**kwargs)
        else:
            key_data = {
                field: kwargs[field]
                for field in cls.unique_fields if field in kwargs
            }
            unique_str = json.dumps(key_data)
        return hashlib.sha256(unique_str.encode('utf-8')).hexdigest()
    
    @classmethod
    def get_collection_name(cls):
        """
        Returns the collection name. By defauls, it uses the lowecase class name plus an 's'
        """
        return cls.__name__.lower() + 's'
    
    @classmethod
    def get_or_create(cls, **kwargs):
        """
        Checks if an instance exists in MongoDB based on its unique key.
        If it exists, returns an instance created from the document.
        If not, creates a new instance, saves it, and returns it.
        """
        instance_id = cls.generate_id(**kwargs)
        mongo_manager = MongoManager()
        collection = mongo_manager.get_collection(cls.get_collection_name)
        document = collection.find_one({'id': instance_id})
        if document:
            document.pop('_id', None)
            instance = cls(**document)
            instance._id = instance_id
            return instance
        else:
            instance = cls(**kwargs)
            instance._id = instance_id
            doc = instance.to_dict()
            doc['_id'] = instance_id
            collection.insert_one(doc)
            return instance