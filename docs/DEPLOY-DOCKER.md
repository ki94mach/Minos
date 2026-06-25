# Docker deploy — dev/test server

Single public port: **nginx on :80** serves the SPA and proxies `/api`, `/auth`, and `/health` to Gunicorn on **127.0.0.1:5000**. MongoDB and Redis run on the **VM host** (not in Compose).

Env file guide: [ENV.md](ENV.md)

---

## Prerequisites (server)

- [ ] Docker Engine + Compose plugin
- [ ] `git` clone of Minos (e.g. `/opt/minos`)
- [ ] MongoDB listening on `127.0.0.1:27017`
- [ ] Redis listening on `127.0.0.1:6379`
- [ ] Firewall allows inbound **80/tcp** from office LAN (not 5000)

Verify on host:

```bash
ss -tlnp | grep -E '27017|6379'
mongosh --eval "db.adminCommand('ping')"
redis-cli ping
```

---

## First-time setup

```bash
cd /opt/minos
git pull

# Create runtime env from template
cp .env.docker.example .env
# Edit .env: set MINOS_PUBLIC_ORIGIN and FRONTEND_ORIGIN to http://YOUR_SERVER_IP

sudo docker compose build --no-cache
sudo docker compose up -d
```

### `.env` must include (server LAN example)

```env
MINOS_PUBLIC_ORIGIN=http://192.168.10.42
FRONTEND_ORIGIN=http://192.168.10.42

FLASK_ENV=development
AUTH_DISABLED=true
DEV_MOCK_ROLE=ADMIN
SECRET_KEY=<openssl rand -hex 32>

MONGO_URI=mongodb://127.0.0.1:27017/
MONGO_DBNAME=minos_db
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0

GUNICORN_BIND=127.0.0.1
PORT=5000
BEHIND_PROXY=true
```

---

## Post-deploy checklist

Run on the **server** after `docker compose up -d`.

### 1. Containers running

```bash
sudo docker compose ps
```

- [ ] `api` — **Up**
- [ ] `web` — **Up**

### 2. API health (via nginx — public path)

```bash
curl -s http://localhost/health
```

- [ ] JSON with `"status":"ok"` and `"mongo":"ok"`
- [ ] HTTP **200** (not 503 or 500)

### 3. API data (auth bypass)

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/api/characteristics
```

- [ ] **200**

### 4. API not exposed on LAN directly

```bash
ss -tlnp | grep 5000
```

- [ ] Shows **`127.0.0.1:5000`** only (not `0.0.0.0:5000`)

From another machine (should **fail** or refuse):

```bash
curl --connect-timeout 3 http://SERVER_IP:5000/health
```

- [ ] Connection refused or timeout

### 5. SPA serves

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/
```

- [ ] **200** (HTML)

### 6. Firewall

```bash
sudo firewall-cmd --list-ports    # after reload
```

- [ ] **80/tcp** allowed for office subnet (or explicitly added)
- [ ] **5000** not required on firewall for users

### 7. Browser (from your PC on corporate Wi‑Fi)

Open: **`http://SERVER_IP/home`**

- [ ] Home page loads (no SSO / login loop)
- [ ] DevTools → Network → API calls go to **`http://SERVER_IP/api/...`** (same host, **no :5000**)
- [ ] No CORS errors
- [ ] Open Characteristics or Patients — data loads

### 8. Logs (no crash loop)

```bash
sudo docker compose logs --tail 50 api
sudo docker compose logs --tail 20 web
```

- [ ] No repeated Mongo/Redis connection errors
- [ ] Gunicorn workers booted

### 9. Security (dev/test only)

- [ ] `AUTH_DISABLED=true` — confirm team treats this as **internal test only**
- [ ] Mongo/Redis **not** listening on `0.0.0.0` toward the internet
- [ ] `.env` not committed to git

---

## Update after `git pull`

```bash
cd /opt/minos
git pull

# If MINOS_PUBLIC_ORIGIN changed, rebuild web:
sudo docker compose build web --no-cache

sudo docker compose up -d --build
```

Re-run checklist items **1–3** and **7**.

---

## Local Fedora Docker test (optional)

In `.env`:

```env
MINOS_PUBLIC_ORIGIN=http://localhost
FRONTEND_ORIGIN=http://localhost
REACT_APP_ALLOW_LOCALHOST_API=true
```

```bash
sudo docker compose build web --no-cache
sudo docker compose up -d
```

Open `http://localhost/home`. Close port 80 on firewall when done; `sudo docker compose down`.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `/health` 503 | Mongo on host; `MONGO_URI=mongodb://127.0.0.1:27017/` |
| `/health` 500, Redis errors | Redis on host; `REDIS_HOST=127.0.0.1` |
| CORS in browser | `FRONTEND_ORIGIN` matches exact browser URL |
| API calls to `localhost` from colleague PC | Rebuild `web` with server `MINOS_PUBLIC_ORIGIN` |
| SPA 404 on refresh | `docker/web/nginx.conf` `try_files` |
| Port 80 permission denied | `sudo docker compose` or map `8080:80` |

---

## Architecture

```text
Browser → http://SERVER:80 (web container / nginx)
            ├─ /, /home, …     → React static files
            └─ /api/*, /health → host.docker.internal:5000 → Gunicorn (127.0.0.1)

MongoDB, Redis → 127.0.0.1 on VM (outside Docker)
```
