# meta.py
import mongoengine as me
import logging


def connect_db(db_name='minos_db', host='mongodb://localhost:27017/'):
    """
    Connect to MongoDB using MongoEngine.
    """
    me.connect(db=db_name, host=host)
    logging.info(f"Connected to MongoDB database: {db_name}")
