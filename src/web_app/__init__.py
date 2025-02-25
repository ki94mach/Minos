
# app.py
from flask import Flask
from models.meta import connect_db  # Your connection helper from meta.py
from routes.api import api_blueprint


def create_app():
    app = Flask(__name__)

    app.config['SECRET_KEY'] = '579e4593ab7d119e814e5b1dcd48d26cfd4341802a89750f2324359a12db8a8e'

    # Load configuration (you can also use app.config.from_object(...))
    app.config['MONGO_DBNAME'] = 'minos_db'
    app.config['MONGO_URI'] = 'mongodb://localhost:27017/minos_db'

    # Connect to MongoDB using your helper
    connect_db(db_name=app.config['MONGO_DBNAME'], host=app.config['MONGO_URI'])

    # Register the blueprint for API endpoints
    app.register_blueprint(api_blueprint, url_prefix='/api')

    from .routes import main
    app.register_blueprint(main)

    return app