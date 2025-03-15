import sys
import os
from flask import Flask
from models.meta import connect_db  # Your connection helper from meta.py
from routes.api import api_blueprint
from routes.auth import auth_blueprint
from datetime import timedelta

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


# app.py
def create_app():
    app = Flask(__name__)

    # Secret key for signing session cookies. Replace with a secure value.
    app.config['SECRET_KEY'] = '579e4593ab7d119e814e5b1dcd48d26cfd4341802a89750f2324359a12db8a8e'

    # Common session settings:
    app.config['SESSION_COOKIE_NAME'] = 'session'  # Default cookie name.
    app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production if using HTTPS.
    app.config['SESSION_COOKIE_HTTPONLY'] = True  # Helps protect against XSS.
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # Can be 'Lax', 'Strict', or 'None' depending on your requirements.
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)  # Lifetime of a permanent session.

    # Load configuration (you can also use app.config.from_object(...))
    app.config['MONGO_DBNAME'] = 'minos_db'
    app.config['MONGO_URI'] = 'mongodb://10.20.52.20:27017/minos_db'

    # Connect to MongoDB using your helper
    connect_db(db_name=app.config['MONGO_DBNAME'], host=app.config['MONGO_URI'])

    # Register the blueprint for API endpoints
    app.register_blueprint(api_blueprint, url_prefix='/api')
    app.register_blueprint(auth_blueprint, url_prefix='/auth')

    return app


app = create_app()

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)
