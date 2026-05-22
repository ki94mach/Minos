# Minos

Flask API + React SPA for maintaining characteristics, drugs, treatments, and patient trees.

## Development

See **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** for how to run the API, SPA, and MongoDB locally (recommended: `AUTH_DISABLED` dev bypass).

SSO integration contract: **[docs/SSO_INTEGRATION.md](docs/SSO_INTEGRATION.md)**.

MVP checklist: **[docs/MVP_CHECKLIST.md](docs/MVP_CHECKLIST.md)**.

## Quick start

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
