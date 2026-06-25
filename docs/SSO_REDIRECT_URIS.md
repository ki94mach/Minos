# Minos — SSO redirect URIs (I4)

**Owner:** SSO / IdP team registers these in the OIDC client.  
**Minos team:** Fill in the tables below per environment and send to SSO before staging/prod cutover.

Related: [SSO_INTEGRATION.md](SSO_INTEGRATION.md), [DEPLOY.md](DEPLOY.md) (I3 HTTPS).

---

## OIDC client (SPA)

Use a **public** OIDC client (PKCE / authorization code) for the React SPA. The API (`https://api.<domain>`) is a separate **resource** validated via JWT (`SSO_AUDIENCE`), not a redirect target.

| Setting | Production | Staging |
|---------|------------|---------|
| Client ID | `________________` | `________________` |
| SPA origin (HTTPS) | `https://minos.example.com` | `https://minos-staging.example.com` |
| API audience (`SSO_AUDIENCE`) | `minos-api` | `minos-api-staging` (or shared) |

---

## Redirect URIs (authorize callback)

Register **exact** HTTPS URLs (no trailing slash unless your IdP requires it). Minos reads the access token from the landing URL query or hash after redirect (**F3** `captureAccessTokenFromUrl`).

### Required (recommended)

| Purpose | Production URI | Staging URI |
|---------|----------------|-------------|
| Post-login landing | `https://minos.example.com/home` | `https://minos-staging.example.com/home` |

This must match `redirect_uri` embedded in `REACT_APP_SSO_LOGIN_URL` in `.env.production` / staging env.

### Optional (if IdP allows multiple)

| Purpose | URI pattern |
|---------|-------------|
| Root redirect | `https://<spa-host>/` |
| Deep link return | `https://<spa-host>/patients` |
| Local dev (optional) | `http://localhost:3000/home` |

React Router paths (`/characteristics`, `/drugs`, `/patients`, `/treatments`, `/follow-ups`) do **not** need separate IdP entries unless you use them as `redirect_uri` values.

---

## Logout / end-session

| Env var | What SSO team provides |
|---------|-------------------------|
| `REACT_APP_SSO_LOGOUT_URL` | IdP end-session endpoint (may include `post_logout_redirect_uri`) |
| Post-logout return (optional) | `https://<spa-host>/` or back to login |

Minos calls this URL from `performLogout()` (**F8**); no Minos `/auth/logout` in production.

---

## CORS (API — not redirect URIs)

SSO team does **not** register these in the OIDC client; Minos API ops set on Flask:

| Variable | Example |
|----------|---------|
| `FRONTEND_ORIGIN` | `https://minos.example.com` |

Comma-separated if multiple SPA origins. Must be **HTTPS** in production (**I2**, **I3**).

---

## Environment wiring

### Production (`.env.production`)

```env
REACT_APP_SSO_LOGIN_URL=https://idp.example.com/oauth2/authorize?client_id=<CLIENT_ID>&redirect_uri=https://minos.example.com/home&response_type=code&scope=openid
REACT_APP_SSO_LOGOUT_URL=https://idp.example.com/oauth2/logout?client_id=<CLIENT_ID>&post_logout_redirect_uri=https://minos.example.com/
REACT_APP_API_URL=https://api.minos.example.com
```

### Staging (`.env.staging.example` → copy for staging build)

```env
REACT_APP_SSO_LOGIN_URL=https://idp.example.com/oauth2/authorize?client_id=<STAGING_CLIENT_ID>&redirect_uri=https://minos-staging.example.com/home&response_type=code&scope=openid
REACT_APP_SSO_LOGOUT_URL=https://idp.example.com/oauth2/logout?client_id=<STAGING_CLIENT_ID>
REACT_APP_API_URL=https://api-staging.minos.example.com
```

**Rule:** Every `redirect_uri` query parameter must appear **verbatim** in the IdP allow list.

---

## Smoke test (after SSO registration)

1. Open `https://<spa-host>/` in a private window → redirect to IdP (**F1**, **F2**).
2. Sign in → land on `https://<spa-host>/home` with no IdP `redirect_uri` error.
3. DevTools → Network → `/api/*` returns **200** with Bearer token (**F3**).
4. Logout → IdP end-session (**F8**).

---

## Sign-off (SSO team)

| Environment | Redirect URIs registered | Client ID shared | JWT / JWKS validated on API |
|-------------|--------------------------|------------------|-----------------------------|
| Staging | [ ] | [ ] | [ ] |
| Production | [ ] | [ ] | [ ] |

| Role | Name | Date |
|------|------|------|
| SSO | | |
| Minos | | |

---

*I4 — Minos delivers this URI list; IdP registration is completed by the SSO team.*
