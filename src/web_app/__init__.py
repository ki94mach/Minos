from flask import Flask

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = '579e4593ab7d119e814e5b1dcd48d26cfd4341802a89750f2324359a12db8a8e'
    
    from .routes import main
    app.register_blueprint(main)

    from pkg.ZODB_manager import RegistryManager

    return app