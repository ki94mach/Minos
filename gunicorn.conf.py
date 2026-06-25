"""
Gunicorn configuration for production (I6).
Override via environment: PORT, GUNICORN_BIND, GUNICORN_WORKERS, GUNICORN_THREADS, GUNICORN_TIMEOUT.

GUNICORN_BIND=127.0.0.1 when nginx proxies /api on port 80 (Docker single-port deploy).
"""
import os

_bind_host = os.environ.get("GUNICORN_BIND", "0.0.0.0")
bind = f"{_bind_host}:{os.environ.get('PORT', '5000')}"
workers = int(os.environ.get("GUNICORN_WORKERS", "4"))
threads = int(os.environ.get("GUNICORN_THREADS", "2"))
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "120"))
worker_class = "gthread"
wsgi_app = "run:app"

accesslog = "-"
errorlog = "-"
loglevel = os.environ.get("GUNICORN_LOG_LEVEL", "info")
capture_output = True
preload_app = True
