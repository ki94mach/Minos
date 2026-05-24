# run.py — WSGI entry point (run:app)
#
# Local development:  python run.py
# Production (I6):     gunicorn -c gunicorn.conf.py run:app
#                      or deploy/start-api.sh / systemd minos-api.service
import os
from dotenv import load_dotenv
from app_factory import create_app

load_dotenv()

app = create_app()

# Visible on startup so you know CSRF exempt is loaded (restart API after pulling changes).
from routes.api import api_blueprint as _api_bp
from utils.config_utils import csrf as _csrf

if _api_bp in _csrf._exempt_blueprints:
    print("Minos API: /api/* is exempt from CSRF (restart was successful)")
else:
    print("WARNING: /api/* CSRF exempt missing — POST /api/* will return 400")

if __name__ == "__main__":
    if os.environ.get("FLASK_ENV") == "production":
        raise SystemExit(
            "Do not use 'python run.py' in production. "
            "Use: gunicorn -c gunicorn.conf.py run:app"
        )
    app.run(
        debug=True,
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
    )
