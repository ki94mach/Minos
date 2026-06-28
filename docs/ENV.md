# Environment files — which file when?

Minos uses **several env templates** for different workflows. Only **one runtime file** matters on a given machine: **`.env`** (gitignored). Everything else is documentation you copy from.

---

## Quick picker

| I want to… | Use this template | Runtime file |
|------------|-------------------|----------------|
| Develop on laptop (`python run.py` + `npm start`) | [`.env.example`](../.env.example) | `.env` |
| React dev server only | [`.env.development`](../.env.development) (already in repo) | auto-loaded by `npm start` |
| **Docker deploy** (dev/test server, single port 80) | [`.env.docker.example`](../.env.docker.example) | `.env` on server |
| Build SPA manually (`npm run build`) for SSO production | [`.env.production.example`](../.env.production.example) | `.env.production` |
| Build SPA for SSO staging | [`.env.staging.example`](../.env.staging.example) | `.env.staging` |
| Future production API **without** Docker dev bypass | [`deploy/production.env.example`](../deploy/production.env.example) | `.env` on API host |

**Docker deploy guide + checklist:** [DEPLOY-DOCKER.md](DEPLOY-DOCKER.md)

---

## File reference

### `.env` (you create — never commit)

- **API (Flask/Gunicorn)** reads this via `python-dotenv` / `docker compose env_file`.
- **Docker Compose** also reads it for `${MINOS_PUBLIC_ORIGIN}` when building the `web` image.
- One `.env` per machine (laptop or server).

### `.env.example`

- Template for **native local development** (no Docker).
- API on `:5000`, CRA dev server on `:3000`.
- Set `AUTH_DISABLED=true`, `FRONTEND_ORIGIN=http://localhost:3000`, `MONGO_URI=mongodb://localhost:27017/`.

### `.env.development`

- Committed; safe defaults for **`npm start` only**.
- `REACT_APP_API_URL=http://localhost:5000`, `REACT_APP_USE_MINOS_AUTH=false`.
- Not used by Docker or Gunicorn.

### `.env.docker.example`

- Template for **Docker Compose** on a server (or Fedora Docker test).
- Includes `MINOS_PUBLIC_ORIGIN`, `GUNICORN_BIND=127.0.0.1`, host Mongo/Redis on `127.0.0.1`.
- Copy values into server `.env`; see [DEPLOY-DOCKER.md](DEPLOY-DOCKER.md).

### `.env.production.example` / `.env.staging.example`

- For **`npm run build`** when the SPA is built **outside** the Docker `web` image (CI or manual).
- SSO URLs + `REACT_APP_API_URL` baked into static JS.
- **Docker dev deploy** does not use these — it passes build args from `MINOS_PUBLIC_ORIGIN` in `.env` instead.

### `deploy/production.env.example`

- API-only template for **real production** (`FLASK_ENV=production`, SSO, no `AUTH_DISABLED`).
- Use when moving off the dev/test Docker setup to corporate SSO.

---

## Variables by workflow

### Native dev (`.env` from `.env.example`)

| Variable | Typical value |
|----------|----------------|
| `FLASK_ENV` | `development` |
| `AUTH_DISABLED` | `true` |
| `FRONTEND_ORIGIN` | `http://localhost:3000` |
| `MONGO_URI` | `mongodb://localhost:27017/` |
| `REDIS_HOST` | `localhost` |

Frontend: `.env.development` → `REACT_APP_API_URL=http://localhost:5000`

### Docker dev/test server (`.env` from `.env.docker.example`)

| Variable | Typical value |
|----------|----------------|
| `MINOS_PUBLIC_ORIGIN` | `http://SERVER_IP` (no `:80`, no trailing slash) |
| `FRONTEND_ORIGIN` | same as `MINOS_PUBLIC_ORIGIN` |
| `REACT_APP_ALLOW_LOCALHOST_API` | `true` only if `MINOS_PUBLIC_ORIGIN=http://localhost` |
| `FLASK_ENV` | `development` |
| `AUTH_DISABLED` | `true` |
| `MONGO_URI` / `REDIS_HOST` | `127.0.0.1` (Mongo/Redis on VM host) |
| `GUNICORN_BIND` | `0.0.0.0` (web container proxy; block LAN :5000 with ufw) |
| `MAIL_*` | Required placeholders — see `.env.docker.example` |
| `BEHIND_PROXY` | `true` |

Users open **`http://SERVER_IP/home`**. API is proxied at **`http://SERVER_IP/api/...`**.

### Production SSO (later)

| Layer | File |
|-------|------|
| API | `deploy/production.env.example` → `.env` |
| SPA build | `.env.production.example` → `.env.production` |

---

## Common mistakes

| Mistake | Symptom |
|---------|---------|
| Using `.env.example` on Docker server without `MINOS_PUBLIC_ORIGIN` | SPA calls wrong API host |
| `FRONTEND_ORIGIN=http://localhost:3000` with Docker web on port 80 | CORS errors |
| `MONGO_URI=mongodb://localhost/...` inside API container without host network | Mongo connection refused |
| Changing `MINOS_PUBLIC_ORIGIN` without rebuilding `web` | Browser still hits old API URL |
| `AUTH_DISABLED=true` with `FLASK_ENV=production` | API refuses to start |

---

## Related docs

- [DEVELOPMENT.md](DEVELOPMENT.md) — native local run
- [DEPLOY-DOCKER.md](DEPLOY-DOCKER.md) — Docker server deploy + checklist
- [DEV_SMOKE.md](DEV_SMOKE.md) — smoke tests without SSO
