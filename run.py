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
