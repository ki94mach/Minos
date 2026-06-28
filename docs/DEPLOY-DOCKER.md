# Docker deploy — dev/test server

Single public port: **nginx on :80** serves the SPA and proxies `/api`, `/auth`, and `/health` to Gunicorn on the **host** at **:5000**. MongoDB and Redis run on the **VM host** (not in Compose).

On-prem builds use **Orchid Nexus** mirrors baked into `docker/api/Dockerfile` and `docker/web/Dockerfile` (PyPI + npm). Docker Hub pulls use **`docker.orchidpharmed.com`** in `/etc/docker/daemon.json`.

Env file guide: [ENV.md](ENV.md)

---

## Prerequisites (server)

- [ ] Docker Engine + Compose plugin
- [ ] Docker Hub mirror in `/etc/docker/daemon.json` (`registry-mirrors`)
- [ ] `git` clone of Minos (e.g. `/opt/app/Minos`)
- [ ] MongoDB listening on **`127.0.0.1:27017`** (not `0.0.0.0`)
- [ ] Redis listening on **`127.0.0.1:6379`**, no password for dev
- [ ] **Host nginx stopped** so Minos `web` can bind port 80
- [ ] Firewall allows inbound **80/tcp** from office LAN; **not** 5000 from LAN

Verify on host:

```bash
ss -tlnp | grep -E '27017|6379'
mongosh --eval "db.adminCommand('ping')"
redis-cli ping
sudo ss -tlnp | grep ':80 '   # should be empty before first compose up
```

---

## First-time setup

```bash
cd /opt/app/Minos
git pull

cp .env.docker.example .env
# Edit .env: MINOS_PUBLIC_ORIGIN + FRONTEND_ORIGIN = http://YOUR_SERVER_IP
openssl rand -hex 32   # paste as SECRET_KEY

sudo systemctl stop nginx    # free port 80 for Minos web container

sudo docker compose build --no-cache
sudo docker compose up -d
```

### `.env` essentials (Orchid LAN example)

Copy from [`.env.docker.example`](../.env.docker.example). Key values:

```env
MINOS_PUBLIC_ORIGIN=http://10.20.52.20
FRONTEND_ORIGIN=http://10.20.52.20

AUTH_DISABLED=true
SECRET_KEY=<openssl rand -hex 32>

MONGO_URI=mongodb://127.0.0.1:27017/
REDIS_HOST=127.0.0.1

# Required placeholders (app startup; mail unused in AUTH_DISABLED dev)
MAIL_SERVER=localhost
MAIL_PORT=587
MAIL_MAX_EMAILS=10
# … see .env.docker.example for full MAIL_* block

# Web container reaches API via host.docker.internal — bind all interfaces on host
GUNICORN_BIND=0.0.0.0
PORT=5000
BEHIND_PROXY=true
```

### Ubuntu firewall (ufw)

After `ufw enable`, allow HTTP and **Docker → API** (not LAN → API):

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp

# Docker bridge → Gunicorn (subnet from: docker network inspect minos_default …)
sudo ufw allow from 172.253.0.0/16 to any port 5000 proto tcp comment 'Minos web to API'

sudo ufw enable
sudo ufw status
```

Do **not** expose Mongo (`27017`) or Redis (`6379`) to `Anywhere`.

---

## Post-deploy checklist

Run on the **server** after `docker compose up -d`.

### 1. Containers running

```bash
sudo docker compose ps
```

- [ ] `api` — **Up**
- [ ] `web` — **Up** (`0.0.0.0:80->80/tcp`)

### 2. API health (via nginx — public path)

```bash
curl -s http://localhost/health
```

- [ ] JSON with `"status":"ok"` and `"mongo":"ok"`
- [ ] HTTP **200** (not 502, 504, 503)

### 3. API data (auth bypass)

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/api/characteristics
```

- [ ] **200**

### 4. API not exposed on LAN directly

```bash
ss -tlnp | grep 5000
```

- [ ] Gunicorn listening (often `0.0.0.0:5000` with `GUNICORN_BIND=0.0.0.0`)

From another machine (should **fail** or timeout — ufw blocks LAN :5000):

```bash
curl --connect-timeout 3 http://SERVER_IP:5000/health
```

- [ ] Connection refused or timeout

### 5. SPA serves

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/
```

- [ ] **200** (HTML)

### 6. Browser (from your PC on LAN)

Open: **`http://SERVER_IP/home`**

- [ ] Home page loads (no “SSO is not configured”)
- [ ] DevTools → Network → API calls go to **`http://SERVER_IP/api/...`**
- [ ] No CORS errors
- [ ] Characteristics / Patients load data

### 7. Logs (no crash loop)

```bash
sudo docker compose logs --tail 50 api
sudo docker compose logs --tail 20 web
```

- [ ] Gunicorn workers booted; no `MAIL_PORT` / Mongo / Redis tracebacks

### 8. Security (dev/test only)

- [ ] `AUTH_DISABLED=true` — internal test only
- [ ] Mongo/Redis on **`127.0.0.1` only**
- [ ] `.env` not committed to git

---

## Update after `git pull`

```bash
cd /opt/app/Minos
git pull

# If MINOS_PUBLIC_ORIGIN changed, rebuild web:
sudo docker compose build web --no-cache

sudo docker compose up -d --build
```

Re-run checklist items **1–3** and **6**.

---

## Open-internet build (not Orchid Nexus)

Comment out the `ENV PIP_*` / `ENV NPM_CONFIG_REGISTRY` lines in:

- `docker/api/Dockerfile`
- `docker/web/Dockerfile`

Remove `click` / `idna` pins from `requirements.txt` if using public PyPI directly.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Port 80 bind error | `sudo systemctl stop nginx`; `ss -tlnp \| grep :80` |
| `/health` **502** | API not up; `docker compose logs api`; `curl 127.0.0.1:5000/health` |
| `/health` **504** | **ufw** blocking Docker → host :5000; add `ufw allow from 172.253.0.0/16 to any port 5000` |
| API restart loop `MAIL_PORT` | Add `MAIL_*` block from `.env.docker.example` |
| `react-scripts: not found` | `ENV NODE_ENV=development` before `npm ci` in web Dockerfile |
| npm **404** on packages | Use **`npm-proxy`**, not `npx-proxy` |
| pip **404** on transitive deps | Pin cached versions (`click==8.4.0`, `idna==3.10` in `requirements.txt`) |
| Browser “SSO is not configured” | API unreachable (502/504) or rebuild `web` with `REACT_APP_USE_MINOS_AUTH=false` |
| `/health` 503 | Mongo on host; `MONGO_URI=mongodb://127.0.0.1:27017/` |
| CORS in browser | `FRONTEND_ORIGIN` matches exact browser URL |
| SPA wrong API host | Rebuild `web` after changing `MINOS_PUBLIC_ORIGIN` |

---

## Architecture

```text
Browser → http://SERVER:80 (web container / nginx)
            ├─ /, /home, …     → React static files
            └─ /api/*, /health → host.docker.internal:5000 → Gunicorn (host :5000)

MongoDB, Redis → 127.0.0.1 on VM (outside Docker)
ufw            → allow 80 from LAN; allow Docker subnet → 5000; deny LAN → 5000
```
