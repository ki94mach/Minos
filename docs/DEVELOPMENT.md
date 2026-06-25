# Minos — development runbook

How to run the **Flask API**, **React SPA**, and **MongoDB** locally for MVP work. Authentication in production is **corporate SSO** — see [SSO_INTEGRATION.md](SSO_INTEGRATION.md). Task tracking: [MVP_CHECKLIST.md](MVP_CHECKLIST.md).

**Which `.env` file to use:** [ENV.md](ENV.md) · **Docker server deploy:** [DEPLOY-DOCKER.md](DEPLOY-DOCKER.md)

---

## Architecture (local)

| Component | Port (default) | Role |
|-----------|----------------|------|
| React SPA (CRA) | 3000 | UI — `npm start` |
| Flask API | 5000 | REST `/api/*` — `python run.py` |
| MongoDB | 27017 | Data store |
| Redis | 6379 | Session store (only if legacy `/auth/*` paths are used in dev) |

The SPA calls the API using `REACT_APP_API_URL` (see [API base URL](#api-base-url-c2)). The API allows the SPA origin via `FRONTEND_ORIGIN` (CORS).

---

## Prerequisites

- **Python 3.10+** (3.10–3.13 recommended; **3.14** needs `pydantic>=2.11` from `requirements.txt` — older pins lack cp314 wheels and may try to compile Rust without a C toolchain)
- **Node.js 18+** and npm (Create React App)
- **MongoDB** running and reachable
- **Redis** — required only when **not** using `AUTH_DISABLED` and hitting `/auth/*` session routes

Install Python dependencies:

```bash
pip install -r requirements.txt
pip install python-dotenv
```

`run.py` loads a root `.env` file via `python-dotenv`.

Install frontend dependencies:

```bash
npm install
```

---

## First-time setup

### 1. API environment

```bash
cp .env.example .env
```

**Secrets (C7):** Never commit `.env` (gitignored). Only placeholder templates are safe in git: `.env.example`, `.env.development`, `.env.production.example`. Do not put real passwords, Redis credentials, or internal hostnames in committed files.

Edit `.env` for your machine. Minimum for local catalog/patient work:

```env
FLASK_ENV=development
MONGO_URI=mongodb://localhost:27017/
MONGO_DBNAME=minos_db
FRONTEND_ORIGIN=http://localhost:3000

# Recommended for local API work without IdP:
AUTH_DISABLED=true
DEV_MOCK_ROLE=ADMIN
```

### 2. Frontend environment

CRA loads env files automatically:

| File | When |
|------|------|
| `.env.development` | `npm start` — already sets `REACT_APP_API_URL=http://localhost:5000` |
| `.env.production` | `npm run build` — copy from [.env.production.example](../.env.production.example) |

No extra copy step is needed for day-to-day dev if `.env.development` is present.

### 3. MongoDB

Ensure MongoDB is listening on the host in `MONGO_URI`.

```bash
# Example: local mongod already running on 27017
# Windows service, Docker, or: mongod --dbpath ./data/db
```

The API connects on startup through `models/meta.py` (`MONGO_DBNAME` + `MONGO_URI`). Defaults if unset: `minos_db` @ `mongodb://localhost:27017/`.

### 4. Redis (optional for recommended dev path)

If you use **`AUTH_DISABLED=true`**, you can skip Redis for `/api/*` work.

Redis is needed when the API must persist Flask sessions (SSO not configured and legacy auth routes, or testing `/auth/*`). Start Redis on `REDIS_HOST` / `REDIS_PORT` from `.env` (default `localhost:6379`).

---

## Recommended local workflow (no IdP)

Use the dev auth bypass so `/api/*` works without SSO tokens or Minos password login.

**API `.env`:**

```env
FLASK_ENV=development
AUTH_DISABLED=true
DEV_MOCK_ROLE=ADMIN
MONGO_URI=mongodb://localhost:27017/
MONGO_DBNAME=minos_db
FRONTEND_ORIGIN=http://localhost:3000
```

**Run API** (terminal 1):

```bash
python run.py
```

Listens on `http://localhost:5000` (override with `PORT`).  
Production deploy uses **Gunicorn**, not `python run.py` — see [DEPLOY.md](DEPLOY.md) (**I6**).

**Run SPA** (terminal 2):

```bash
npm start
```

Opens `http://localhost:3000`. Use the app; API calls go to `REACT_APP_API_URL` (port 5000).

**Smoke test:**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/characteristics
# expect 200
```

### Dev bypass guards

- `AUTH_DISABLED=true` is **ignored** when `FLASK_ENV=production`.
- Setting both `AUTH_DISABLED=true` and `FLASK_ENV=production` causes **startup failure**.
- Never enable `AUTH_DISABLED` in staging or production.

| Variable | Default | Purpose |
|----------|---------|---------|
| `DEV_MOCK_SUB` | `dev-user` | Fake principal id |
| `DEV_MOCK_EMAIL` | `dev@local` | Fake email |
| `DEV_MOCK_ROLE` | `ADMIN` | `ADMIN` or `USER` |

---

## SSO (staging / production)

Minos does **not** own login UI or passwords in production. The SSO team provides the IdP; this repo validates **Bearer JWTs** on `/api/*`.

**Read:** [SSO_INTEGRATION.md](SSO_INTEGRATION.md) — mechanism, role claims, env vars, and SSO team checklist.

**API** (when `AUTH_DISABLED` is off):

```env
SSO_ISSUER=https://idp.example.com/realms/minos
SSO_AUDIENCE=minos-api
SSO_JWKS_URL=https://idp.example.com/.../certs
SSO_ROLES_CLAIM=roles
SSO_ROLE_ADMIN=minos-admin
SSO_ROLE_USER=minos-user
```

**SPA** (production build):

```env
REACT_APP_SSO_LOGIN_URL=https://idp.example.com/oauth2/authorize?...
REACT_APP_API_URL=https://api.minos.example.com
```

Build with `.env.production` before `npm run build`. Unauthenticated users are sent to `REACT_APP_SSO_LOGIN_URL`, not Minos `/auth/login` (**S5**).

Wire the SPA to attach `Authorization: Bearer <access_token>` after the IdP flow (**F3** — pending). Until then, use `AUTH_DISABLED` for local UI/API integration.

---

## API environment reference

| Variable | Required | Description |
|----------|----------|-------------|
| `FLASK_ENV` | Yes | `development` locally; `production` in deploy |
| `SECRET_KEY` | Prod | Flask secret; generated in dev if missing |
| `MONGO_URI` | Yes* | Mongo connection string |
| `MONGO_DBNAME` | Yes* | Database name |
| `FRONTEND_ORIGIN` | Yes | CORS origin(s), comma-separated — usually `http://localhost:3000` |
| `AUTH_DISABLED` | Dev only | Skip SSO; inject `DEV_MOCK_*` principal |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_DB` | If sessions | Legacy `/auth/*` sessions |
| `SSO_ISSUER` / `SSO_AUDIENCE` / `SSO_JWKS_URL` | With SSO | JWT validation |
| `MAIL_*` | If email features | Password reset, etc. — placeholders in `.env.example` |
| `ALLOW_REGISTRATION` | Dev only | `true`/`false` override; **off by default in production** (**B2**) |

\*Defaults exist (`localhost:27017`, `minos_db`) but explicit `.env` values are recommended.

Full template: [.env.example](../.env.example).

---

## API base URL (C2)

Axios reads `REACT_APP_API_URL` from `src/api/config.ts`.

| Environment | Config file | Example |
|-------------|-------------|---------|
| `npm start` | `.env.development` | `http://localhost:5000` |
| `npm run build` | `.env.production` | `https://api.minos.example.com` |

Values are **baked in at build time** for production static files.

---

## CORS (S6)

Set on the **API** `.env`:

```env
FRONTEND_ORIGIN=http://localhost:3000
```

Allows browser calls from the CRA dev server. Production: set to the deployed SPA origin (e.g. `https://minos.example.com`).

Bearer SSO tokens use the `Authorization` header. `CORS_SUPPORTS_CREDENTIALS=true` (default) remains for transitional cookie-based dev only.

---

## Production build (SPA) — F10

`REACT_APP_API_URL` is **embedded at compile time** by Create React App. It is not read at runtime from the server.

```bash
cp .env.production.example .env.production
# Set REACT_APP_API_URL, REACT_APP_SSO_LOGIN_URL, REACT_APP_SSO_LOGOUT_URL
npm run build
```

`npm run build` runs `scripts/verify-production-env.js` first and **fails** if `REACT_APP_API_URL` is missing or still `localhost` (unless `REACT_APP_ALLOW_LOCALHOST_API=true`).

| Script | Use |
|--------|-----|
| `npm run build` | Staging/production — requires real API URL in `.env.production` or env |
| `npm run build:local` | Test production bundle against `http://localhost:5000` |

**Verify after deploy:**

```bash
npx serve -s build -l 3000
# Open app → DevTools Network → API calls must hit your REACT_APP_API_URL host, not :3000
```

**CI:** See [.github/workflows/spa-build.example.yml](../.github/workflows/spa-build.example.yml) — set repository variables `REACT_APP_API_URL`, `REACT_APP_SSO_LOGIN_URL`, etc.

---

## API environment modes (summary)

| Mode | API env | SPA | Use case |
|------|---------|-----|----------|
| **Local bypass** (recommended) | `AUTH_DISABLED=true` | `npm start` | UI + API without IdP |
| **SSO** | `SSO_*` + no `AUTH_DISABLED` | Bearer token (**F3**) | Staging / production |
| Legacy Minos session | No `AUTH_DISABLED`, Redis up | `npm start` → `/auth/*` | Deprecated dev path; not documented for MVP |

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `pip install` fails building `pydantic-core` on Python 3.14 | Upgrade deps (`pip install -U -r requirements.txt`) or use Python 3.12/3.13; avoid source builds by not pinning `pydantic~=2.10` |
| API won’t start: Mongo error | `MONGO_URI`, MongoDB running |
| API won’t start: Redis error | Start Redis, or use `AUTH_DISABLED=true` |
| API won’t start: `AUTH_DISABLED` + production | Unset `AUTH_DISABLED` or use `FLASK_ENV=development` |
| SPA API calls hit port 3000 | Use `src/api.ts` / `REACT_APP_API_URL`, not raw `fetch('/api/...')` (**C6**) |
| CORS error in browser | `FRONTEND_ORIGIN` matches SPA URL (scheme + host + port) |
| `/api/*` returns 401 | Enable `AUTH_DISABLED` locally, or send Bearer JWT / SSO config |
| `npm run build` wrong API host | Rebuild after changing `.env.production` |

---

## API error responses (**C5**)

4xx/5xx JSON from the API uses:

```json
{ "error": "Human-readable message", "details": ["optional field-level messages"] }
```

Validation failures from `@validate_request` return **422** with `details` listing field errors. Global Flask error handlers use the same shape (no `status: "fail"` or `message` keys).

---

## Dev smoke tests (no SSO team)

When IdP is unavailable, use **[DEV_SMOKE.md](DEV_SMOKE.md)** — `AUTH_DISABLED=true`, `REACT_APP_USE_MINOS_AUTH=false`, and `python scripts/smoke_dev_api.py`.

---

## Related documentation

- [DEV_SMOKE.md](DEV_SMOKE.md) — local smoke without SSO (T3–T11 API script + UI checklist)
- [DEPLOY.md](DEPLOY.md) — production infrastructure (Mongo **I1**, HTTPS, probes)
- [SSO_INTEGRATION.md](SSO_INTEGRATION.md) — auth contract, JWT, roles, env vars
- [SSO_REDIRECT_URIS.md](SSO_REDIRECT_URIS.md) — IdP callback URLs for staging/prod (**I4**)
- [MVP_CHECKLIST.md](MVP_CHECKLIST.md) — MVP task list and smoke tests
- [.env.example](../.env.example) — API env template
- [.env.production.example](../.env.production.example) — SPA production env template

---

*Last updated: 2026-05-20 — C3 full runbook.*
