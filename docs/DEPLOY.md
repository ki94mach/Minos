# Minos — infrastructure & deploy

Operational checklist for staging and production. MVP task IDs from [MVP_CHECKLIST.md](MVP_CHECKLIST.md).

---

## I1 — MongoDB reachable

The API validates MongoDB on **`GET /health`** (no authentication). Use this for load balancers, Kubernetes probes, and deploy smoke tests.

### Response

| HTTP | Meaning |
|------|---------|
| **200** | `mongo: ok` — application can reach the configured database |
| **503** | `mongo: unreachable` — check `MONGO_URI`, network, and MongoDB service |

Example (success):

```json
{
  "status": "ok",
  "mongo": "ok",
  "database": "minos_db",
  "host": "mongo.internal:27017"
}
```

Example (failure):

```json
{
  "status": "degraded",
  "mongo": "unreachable",
  "database": "minos_db",
  "host": "10.20.52.20:27017",
  "error": "..."
}
```

`host` is derived from `MONGO_URI` **without** username or password.

### API environment

Set on the **Flask** host (see [.env.example](../.env.example)):

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | Yes | Mongo connection string, e.g. `mongodb://user:pass@mongo-host:27017/` |
| `MONGO_DBNAME` | Yes | Database name, e.g. `minos_db` |
| `MONGO_CONNECT_TIMEOUT_MS` | No | Startup connection timeout (default `10000`) |
| `MONGO_HEALTH_TIMEOUT_MS` | No | `/health` ping timeout (default `5000`) |

Connection is established at startup in `models/meta.py` via `configure_database()` in `utils/config_utils.py`.

### Network / firewall

From the **API server** (not the SPA host), ensure outbound access to MongoDB:

- Default port **27017** (or your managed service endpoint)
- Security group / firewall allows the API host → Mongo host
- If MongoDB Atlas or cloud: whitelist the API server egress IP (or use VPC peering / private endpoint)

The React SPA does **not** connect to MongoDB; only the Flask API does.

### Smoke test (deploy environment)

```bash
# Replace with your public or internal API base URL
curl -sS -o /tmp/health.json -w "%{http_code}" https://api.minos.example.com/health
cat /tmp/health.json
# Expect HTTP 200 and "mongo":"ok"
```

From inside the same network as the API (e.g. jump host):

```bash
curl -sS http://localhost:5000/health
```

### Kubernetes (example)

```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 5000
  initialDelaySeconds: 10
  periodSeconds: 15
  failureThreshold: 3
livenessProbe:
  httpGet:
    path: /health
    port: 5000
  initialDelaySeconds: 30
  periodSeconds: 30
```

Use **readiness** so traffic is not routed until `mongo: ok`.

### Troubleshooting

| Symptom | Check |
|---------|--------|
| API won't start | `MONGO_URI` correct; Mongo listening; `MONGO_CONNECT_TIMEOUT_MS` |
| `/health` → 503 | Firewall; credentials in URI; replica set / TLS params in URI |
| Works locally, fails in deploy | Deploy env uses different `MONGO_URI`; private IP not reachable from API VM |
| Slow health failures | Lower `MONGO_HEALTH_TIMEOUT_MS` for faster probe failure |

---

## I2 — API HTTPS

Production must expose the Flask API on **HTTPS** only. TLS is usually terminated at a reverse proxy, ingress, or load balancer; the app trusts `X-Forwarded-Proto` when configured.

### Checklist

| Item | Action |
|------|--------|
| Public URL | `https://api.<domain>` (no plain HTTP for browsers) |
| SPA env | `REACT_APP_API_URL=https://api.<domain>` at `npm run build` (**F10**) |
| CORS | `FRONTEND_ORIGIN=https://<spa-domain>` (HTTPS, no trailing slash) |
| Flask | `FLASK_ENV=production` on the API host |
| Behind proxy | `BEHIND_PROXY=true` so `ProxyFix` reads `X-Forwarded-Proto` |
| Cookies (legacy `/auth/*`) | `SESSION_COOKIE_SECURE=true` automatically in production |
| Bearer SSO (MVP default) | No session cookie required; `Authorization: Bearer` over HTTPS |

### API environment

| Variable | When | Purpose |
|----------|------|---------|
| `FLASK_ENV` | Production | Enables secure session cookies, HSTS header, CSRF SSL strict |
| `BEHIND_PROXY` | TLS at LB/ingress | `ProxyFix` for `X-Forwarded-Proto`, `X-Forwarded-For` |
| `FORCE_HTTPS` | Staging tests | Secure cookies without `FLASK_ENV=production` |
| `SESSION_COOKIE_SAMESITE` | Optional | Default `Lax`; use `None` for cross-origin credentialed legacy auth (requires Secure) |
| `FRONTEND_ORIGIN` | Required | Must be `https://…` in production |

Implemented in `utils/config_utils.py` (`configure_https`, `cookie_secure_enabled`) and `routes/auth.py` (CSRF cookie `secure` flag).

### Reverse proxy (example)

Terminate TLS at nginx and forward HTTP to gunicorn on localhost:

```nginx
server {
    listen 443 ssl;
    server_name api.minos.example.com;
  ssl_certificate     /path/to/fullchain.pem;
  ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

API `.env` on that host:

```env
FLASK_ENV=production
BEHIND_PROXY=true
FRONTEND_ORIGIN=https://minos.example.com
```

### Smoke test

```bash
curl -sSI https://api.minos.example.com/health | head -5
# HTTP/2 200 (or HTTP/1.1 200)
# Strict-Transport-Security: max-age=31536000; includeSubDomains

curl -sS https://api.minos.example.com/health
```

Reject deployments that only answer on `http://` for public clients.

### Cookie-based SSO note

If the organization uses **HttpOnly session cookies** across origins (not Bearer JWT), set:

```env
SESSION_COOKIE_SAMESITE=None
```

`Secure` is set automatically when `FLASK_ENV=production`. Ensure `CORS_SUPPORTS_CREDENTIALS=true` and `FRONTEND_ORIGIN` matches the SPA exactly. See [SSO_INTEGRATION.md](SSO_INTEGRATION.md).

---

## I3 — SPA HTTPS

The React app is a static **`build/`** folder produced by `npm run build` (**F10**). Production must serve it **only over HTTPS** at the public SPA URL (e.g. `https://minos.example.com`).

### Checklist

| Item | Action |
|------|--------|
| Build | `cp .env.production.example .env.production` → set `REACT_APP_*` → `npm run build` |
| Deploy artifact | Upload contents of `build/` to the static host (not the repo root) |
| TLS | Certificate on CDN, load balancer, or web server (Let's Encrypt, corporate PKI, etc.) |
| HTTP → HTTPS | Redirect port 80 to 443 |
| IdP | `REACT_APP_SSO_LOGIN_URL` / logout URLs must use `https://` and match this host (**I4**) |
| API CORS | API `FRONTEND_ORIGIN=https://minos.example.com` (**I2**) |

### Build-time URLs (must be HTTPS)

In `.env.production` before `npm run build`:

```env
REACT_APP_API_URL=https://api.minos.example.com
REACT_APP_SSO_LOGIN_URL=https://idp.example.com/...&redirect_uri=https://minos.example.com/home
REACT_APP_SSO_LOGOUT_URL=https://idp.example.com/.../logout
```

### Hosting options

| Platform | Config in repo |
|----------|----------------|
| **nginx** | [deploy/nginx-spa.example.conf](../deploy/nginx-spa.example.conf) |
| **Netlify / similar** | [public/_redirects](../public/_redirects) → copied into `build/` |
| **Azure Static Web Apps** | [staticwebapp.config.json](../staticwebapp.config.json) at repo root |
| **IIS** | [public/web.config](../public/web.config) → copied into `build/` |

See **I7** for route list and [scripts/smoke-spa-routes.sh](../scripts/smoke-spa-routes.sh).

### nginx (summary)

```bash
npm run build
sudo mkdir -p /var/www/minos
sudo rsync -a build/ /var/www/minos/build/
# Install deploy/nginx-spa.example.conf → enable site → reload nginx
```

See full sample: [deploy/nginx-spa.example.conf](../deploy/nginx-spa.example.conf).

### Smoke test

```bash
curl -sSI https://minos.example.com/ | head -5
# HTTP/2 200
# Strict-Transport-Security: ...

curl -sSI https://minos.example.com/patients | head -3
# 200 — index.html (SPA), not 404 from the server

# Browser: DevTools → Network → any /api/* call goes to REACT_APP_API_URL host
```

Do not expose the SPA to users on `http://` except local `npx serve` testing.

### SSO redirect URIs (**I4**)

Before first staging/prod login, the **SSO team** must allow the SPA callback URLs in the OIDC client. Minos provides the exact list in **[SSO_REDIRECT_URIS.md](SSO_REDIRECT_URIS.md)** (production + staging tables and sign-off).

Ensure `redirect_uri` in `REACT_APP_SSO_LOGIN_URL` matches IdP registration exactly.

### Local HTTPS test (optional)

```bash
npm run build
npx serve -s build -l 3000
# HTTP only — acceptable for local smoke; production requires TLS (I3)
```

---

## I5 — `AUTH_DISABLED` off in production

The dev auth bypass (**S4**) must **never** run in production. Minos enforces this at **startup** and via a deploy audit script.

### Runtime guard (S4 / I5)

If `FLASK_ENV=production` and `AUTH_DISABLED=true`, the API **refuses to start**:

```text
RuntimeError: AUTH_DISABLED=true is not allowed when FLASK_ENV=production.
```

Even if someone sets the variable at runtime, `auth_disabled_for_dev()` is always `False` when `FLASK_ENV=production`.

### Production API `.env`

- **Do not** set `AUTH_DISABLED` (omit it entirely).
- **Do** set `SSO_ISSUER`, `SSO_AUDIENCE`, `SSO_JWKS_URL` (see [deploy/production.env.example](../deploy/production.env.example)).

Template without bypass: [deploy/production.env.example](../deploy/production.env.example).

### Pre-deploy audit

On the deploy host or in CI, before starting the API:

```bash
# Using the same .env the API will load
python scripts/audit-production-env.py --env-file .env
# Expect: Production environment audit OK
```

Simulate production locally (must fail if AUTH_DISABLED is on):

```bash
# PowerShell
$env:FLASK_ENV="production"; $env:AUTH_DISABLED="true"; python -c "from app_factory import create_app; create_app()"
# Expect: RuntimeError
```

### Staging

Treat staging like production: **no `AUTH_DISABLED`**. Use real SSO with staging IdP client (**I4**) or a dedicated staging JWT issuer.

### Checklist (ops sign-off)

| Check | Staging | Production |
|-------|---------|------------|
| `AUTH_DISABLED` unset or `false` | [ ] | [ ] |
| `FLASK_ENV=production` (or org standard for prod) | [ ] | [ ] |
| `SSO_*` variables set | [ ] | [ ] |
| `python scripts/audit-production-env.py` passes | [ ] | [ ] |
| API starts without `AUTH_DISABLED` warning in logs | [ ] | [ ] |

---

## I6 — API process manager

Do **not** use `python run.py` or `flask run` in production. Use a WSGI server so the API **restarts on crash** and handles concurrent requests.

| Environment | Command |
|-------------|---------|
| **Linux production** | `gunicorn -c gunicorn.conf.py run:app` |
| **systemd** | [deploy/minos-api.service.example](../deploy/minos-api.service.example) |
| **Shell script** | [deploy/start-api.sh](../deploy/start-api.sh) (runs I5 audit when `FLASK_ENV=production`) |
| **Windows / local prod test** | `python scripts/run_waitress.py` |

Dependencies: `gunicorn`, `waitress` in [requirements.txt](../requirements.txt).

### Gunicorn (recommended)

```bash
cd /opt/minos
source .venv/bin/activate
pip install -r requirements.txt
export FLASK_ENV=production
# load .env (dotenv also runs when run:app is imported)
gunicorn -c gunicorn.conf.py run:app
```

Config: [gunicorn.conf.py](../gunicorn.conf.py) — override with env:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `5000` | Bind port (behind nginx **I2**) |
| `GUNICORN_WORKERS` | `4` | Worker processes |
| `GUNICORN_THREADS` | `2` | Threads per worker (`gthread`) |
| `GUNICORN_TIMEOUT` | `120` | Worker timeout (seconds) |

Put nginx in front on `127.0.0.1:5000` (see **I2**).

### systemd

`Restart=on-failure` in [deploy/minos-api.service.example](../deploy/minos-api.service.example) restarts the API after crashes.

```bash
sudo systemctl status minos-api
sudo journalctl -u minos-api -f
```

### Smoke test

```bash
curl -sS http://127.0.0.1:5000/health
# After kill -9 of a worker, service should recover (systemd or process manager)
```

### Development

`python run.py` remains for local dev only (`FLASK_ENV` must not be `production`).

---

## I7 — SPA static hosting

Deploy the **`build/`** output of `npm run build` (**F10**). The host must serve real files when they exist (JS/CSS under `/static/`) and **fallback to `index.html`** for all other paths so React Router works on refresh and deep links.

### Client routes (must not 404 at the server)

| Path | Page |
|------|------|
| `/` | Redirect → `/home` or login |
| `/home` | Home |
| `/characteristics` | Characteristics |
| `/drugs` | Drugs |
| `/patients` | Patients overview |
| `/patients/:rootId` | Patient tree drill-down |
| `/treatments` | Treatments |
| `/follow-ups` | Follow-ups |

### Deploy artifact

```bash
npm run build
./deploy/sync-spa.sh /var/www/minos/build
# or: rsync -a --delete build/ user@host:/var/www/minos/build/
```

Only upload **`build/`** contents — not `src/`, `public/`, or the git repo.

### Fallback config by platform

| Platform | File (in repo) |
|----------|----------------|
| **nginx** | [deploy/nginx-spa.example.conf](../deploy/nginx-spa.example.conf) — `try_files $uri $uri/ /index.html` |
| **Netlify / Cloudflare Pages** | [public/_redirects](../public/_redirects) — `/* /index.html 200` |
| **Azure Static Web Apps** | [staticwebapp.config.json](../staticwebapp.config.json) |
| **IIS / Azure App Service** | [public/web.config](../public/web.config) |
| **Local smoke** | `npx serve -s build` (`-s` = SPA mode) |

CRA copies `public/*` into `build/` on each build, so `_redirects` and `web.config` land in the deploy folder automatically.

### Smoke test (I7)

```bash
chmod +x scripts/smoke-spa-routes.sh
./scripts/smoke-spa-routes.sh https://minos.example.com
# Every listed route should print OK 200
```

Manual check: open `https://<spa>/patients`, refresh the browser — the app must load (not nginx/404 HTML).

HTTPS for the SPA is **I3**; this section is routing + `build/` deployment only.

---

## Related deploy tasks

| ID | Topic | Notes |
|----|--------|--------|
| **I2** | API HTTPS | API origin TLS |
| **I3** | SPA HTTPS | TLS for static host |
| **I4** | SSO redirect URIs | [SSO_REDIRECT_URIS.md](SSO_REDIRECT_URIS.md) — IdP registration (SSO team) |
| **I5** | `AUTH_DISABLED` | This section + `scripts/audit-production-env.py` |
| **I6** | API process manager | Gunicorn + systemd |
| **I7** | SPA static hosting | This section |
| **B8** | Health endpoint | Implemented at `GET /health` |
| **F10** | SPA API URL | `REACT_APP_API_URL` at `npm run build` |

See also [DEVELOPMENT.md](DEVELOPMENT.md) (local runbook) and [SSO_INTEGRATION.md](SSO_INTEGRATION.md).

---

*Last updated: I1–I7 — full infrastructure deploy runbook.*
