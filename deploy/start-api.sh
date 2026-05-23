#!/usr/bin/env bash
# Start Minos API with Gunicorn (I6). Use from systemd or manual deploy.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${FLASK_ENV:-}" == "production" ]]; then
  python scripts/audit-production-env.py --env-file "${ENV_FILE:-.env}"
fi

exec gunicorn -c gunicorn.conf.py run:app
