#!/usr/bin/env python3
"""
Production-style WSGI server for Windows or dev (I6).
Linux deploy should use gunicorn instead (see docs/DEPLOY.md).
"""
import os

from dotenv import load_dotenv

load_dotenv()

from waitress import serve  # noqa: E402

from run import app  # noqa: E402

if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "5000"))
    threads = int(os.environ.get("WAITRESS_THREADS", "4"))
    print(f"Waitress serving on {host}:{port} (threads={threads})")
    serve(app, host=host, port=port, threads=threads)
