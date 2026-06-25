# Minos

Flask API + React SPA for maintaining characteristics, drugs, treatments, and patient trees.

## Development

See **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** for how to run the API, SPA, and MongoDB locally (recommended: `AUTH_DISABLED` dev bypass).

**Environment files (which `.env` when):** **[docs/ENV.md](docs/ENV.md)**

**Docker deploy (dev/test server):** **[docs/DEPLOY-DOCKER.md](docs/DEPLOY-DOCKER.md)** — includes post-deploy checklist.

SSO integration contract: **[docs/SSO_INTEGRATION.md](docs/SSO_INTEGRATION.md)**.

MVP checklist: **[docs/MVP_CHECKLIST.md](docs/MVP_CHECKLIST.md)**.

Catalog sync (master ↔ patient embeds): **[docs/CATALOG_SYNC.md](docs/CATALOG_SYNC.md)**.

## Quick start (native — no Docker)

```bash
cp .env.example .env
# Set AUTH_DISABLED=true, MONGO_URI, FRONTEND_ORIGIN — see DEVELOPMENT.md

pip install -r requirements.txt
pip install python-dotenv
python run.py

# separate terminal
npm install
npm start
```

API: `http://localhost:5000` · SPA: `http://localhost:3000`

## Quick start (Docker — server or Fedora test)

```bash
cp .env.docker.example .env
# Edit MINOS_PUBLIC_ORIGIN, FRONTEND_ORIGIN — see docs/DEPLOY-DOCKER.md

sudo docker compose build --no-cache
sudo docker compose up -d
```

App: `http://SERVER_IP/home` · health: `http://SERVER_IP/health`
