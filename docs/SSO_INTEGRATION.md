# Minos — SSO integration contract

**Status:** Agreed for MVP implementation (task **S1**).  
**Owners:** SSO team (IdP, login/logout URLs, token issuance); Minos team (API validation, SPA wiring per **S2–S6**).

Minos does **not** implement login UI, registration, or password flows in production. Those exist today only for local development (`src/pages/Login/*`, `routes/auth.py`) and will be gated or removed (**S5**, **B2**).

---

## 1. Authentication mechanism (decision)

| Aspect | MVP choice |
|--------|------------|
| **How the SPA proves identity to the API** | `Authorization: Bearer <access_token>` on every `/api/*` request |
| **How the API validates identity** | Verify an **OIDC access token** (JWT) issued by the corporate IdP |
| **Flask session + Redis** | **Not** used for `/api/*` in production after **S3**; legacy Minos login session remains dev-only |
| **CSRF (`X-CSRFToken`, `csrf_token` cookie)** | **Not** required for Bearer-authenticated API calls; remove SPA bootstrap when SSO is live (**F3**) |

### Why Bearer (not browser session cookies) for MVP

- The React SPA and Flask API run on **different origins** in dev (`http://localhost:3000` → `http://localhost:5000`) and typically in staging/prod as well. Cookie-based SSO across origins needs a gateway, shared parent domain, or `SameSite=None` + careful `Secure` setup (**S6**).
- The SSO team owns the IdP; the SPA obtains an access token via the standard OIDC authorization-code (or PKCE) flow and attaches it to API calls—no Minos-owned password session.
- `require_role` and future `sso_required` read identity from the **validated token claims**, not from `flask.session` (**S2**, **S3**).

### Alternative (only if SSO team requires it)

If the organization mandates **HttpOnly session cookies** set by an API gateway or BFF in front of Minos:

1. Document the cookie name, domain, and `Path` from the SSO team.
2. Enable **Flask-CORS** with `supports_credentials=True` and an explicit `FRONTEND_ORIGIN` (**S6**, **B10**).
3. Set `withCredentials: true` on the Axios instance in `src/api.ts` (**F3**).
4. Update this section and **S1** checklist note—Bearer remains the default until that change is signed off.

Until that alternative is signed off, all implementation tasks (**S3**, **F3**, **B1**) assume **Bearer JWT**.

---

## 2. Request flow

```
  User          Minos SPA              IdP                 Minos API
    |               |                   |                      |
    |  open app     |                   |                      |
    |-------------->|                   |                      |
    |               |  redirect login   |                      |
    |               |------------------>|                      |
    |               |  auth code        |                      |
    |               |<------------------|                      |
    |               |  token exchange   |                      |
    |               |------------------>|                      |
    |               |  store access_token                      |
    |               |  GET/POST /api/* + Bearer              |
    |               |----------------------------------------->|
    |               |                   |     validate JWT   |
    |               |  200 JSON or 401  |                      |
    |               |<-----------------------------------------|
```

### SPA (`src/api.ts`)

- Set default header on the shared Axios instance (after SSO login completes):

  ```http
  Authorization: Bearer <access_token>
  ```

- Do **not** send Minos `csrf_token` for `/api/*` once SSO is enabled.
- `withCredentials: false` for API calls when using Bearer-only (CORS still required for browser preflight, **S6**).

### Backend (`utils/sso_auth.py`) — **S3 implemented**

All `/api/*` handlers use `@sso_required` (replaces `@login_required`).

| Step | Behavior |
|------|----------|
| 1 | `AUTH_DISABLED=true` (non-production) → dev principal (**S2**) |
| 2 | `Authorization: Bearer …` → validate JWT via `SSO_JWKS_URL`, `SSO_ISSUER`, `SSO_AUDIENCE` |
| 3 | Non-production only: Flask session from legacy Minos login if no Bearer header |
| 4 | Otherwise → **401** `{ "error": "Authentication required" }` |

- Invalid or expired Bearer tokens do **not** fall back to session.
- `/auth/*` routes still use `@login_required` (Minos session) until retired.

### Unauthenticated API access

- Any `/api/*` request without a valid Bearer token → **401** with `{ "error": "Authentication required" }`.
- No HTML redirects from JSON API routes.

---

## 3. Roles (how they are passed) — **S2 implemented**

Minos has two application roles (`models/tables.py` — `RoleEnum`):

| Minos role | Meaning (MVP) |
|------------|----------------|
| `ADMIN` | Required for `DELETE` on catalog and patient trees (**B9**); all other `/api/*` mutations allowed |
| `USER` | Standard read/write (including patient tree edits); cannot delete catalog rows or whole patients |

### Source of truth

Roles come from the **access token JWT claims** after validation—not from the Minos `users` collection in production.

| Item | MVP contract |
|------|----------------|
| **Claim carrying roles** | Env `SSO_ROLES_CLAIM` (default: `roles`). Supports dotted paths (e.g. `realm_access.roles`). |
| **Claim shape** | JSON array of strings, a single string, or comma-separated string |
| **Default if claim missing or empty** | `USER` |
| **Backend enforcement** | `require_role` in `utils/decorators.py` uses `get_request_role()` → `g.current_user.role` from `utils/sso_auth.py` |
| **Implementation** | `map_claims_to_minos_role()`, `build_principal_from_claims()`, `sso_required` (used on routes in **S3**) |

### Claim → Minos role mapping (configured via env)

| IdP value in roles claim | Env variable | Default | Minos `role` |
|--------------------------|--------------|---------|--------------|
| Admin group/role string | `SSO_ROLE_ADMIN` | `minos-admin` | `ADMIN` |
| User group/role string | `SSO_ROLE_USER` | `minos-user` | (informational; not required for `USER`) |
| Claim missing, empty, or any other value | — | — | `USER` |

**Rule:** If any token role value equals `SSO_ROLE_ADMIN` (case-insensitive), Minos role is `ADMIN`; otherwise `USER`.

**SSO team:** Override defaults with production claim name and role strings via environment variables.

### Local dev mock principal (**S2** / **S4 implemented**)

When `AUTH_DISABLED=true` and `FLASK_ENV` is not `production`:

- Startup: `validate_auth_disabled_config()` raises if `AUTH_DISABLED` is set with `FLASK_ENV=production`.
- Runtime: `auth_disabled_for_dev()` is always `False` in production; `@sso_required` never applies the bypass.

| Env | Default | Purpose |
|-----|---------|---------|
| `DEV_MOCK_SUB` | `dev-user` | Fake JWT `sub` |
| `DEV_MOCK_EMAIL` | `dev@local` | Fake email |
| `DEV_MOCK_ROLE` | `ADMIN` | `ADMIN` or `USER` — set `USER` to test non-admin |

`register_dev_auth_bypass()` sets `g.current_user` on every request so API routes work without Bearer or Minos login.

Example — mock admin:

```env
AUTH_DISABLED=true
FLASK_ENV=development
DEV_MOCK_ROLE=ADMIN
```

Example — mock standard user:

```env
AUTH_DISABLED=true
DEV_MOCK_ROLE=USER
```

---

## 4. Environment variables

| Variable | Used by | Purpose |
|----------|---------|---------|
| `REACT_APP_SSO_LOGIN_URL` | SPA | IdP authorize URL; unauthenticated users redirect here (**S5**, **F2**, **F4**) |
| `REACT_APP_SSO_LOGOUT_URL` | SPA | IdP end-session URL (**F8**) |
| `REACT_APP_API_URL` | SPA | Flask API base URL — `src/api/config.ts`, set in `.env.development` / `.env.production` (**C2**) |
| `SSO_ISSUER` | API | Expected JWT `iss` |
| `SSO_AUDIENCE` | API | Expected JWT `aud` (API resource identifier) |
| `SSO_JWKS_URL` | API | JWKS endpoint for signature verification |
| `SSO_ROLES_CLAIM` | API | Claim name for roles (default: `roles`) |
| `SSO_ROLE_ADMIN` | API | Token value mapped to `ADMIN` (default: `minos-admin`) |
| `SSO_ROLE_USER` | API | Token value mapped to `USER` (default: `minos-user`) |
| `FRONTEND_ORIGIN` | API | CORS allowed origin(s), comma-separated (**S6** implemented) |
| `CORS_SUPPORTS_CREDENTIALS` | API | Default `true` — session cookies + CSRF in dev; Bearer does not require it |
| `AUTH_DISABLED` | API | Dev-only bypass (**S4**, must be off in prod **I5**) |

Placeholders belong in `.env.example` as tasks **C1**, **S4**, **S6** land—not real secrets.

---

## 5. What we are replacing (current state)

| Layer | Today | After SSO (MVP) |
|-------|--------|------------------|
| SPA entry | `/auth/login` Minos form | Redirect to `REACT_APP_SSO_LOGIN_URL` |
| API auth | `@login_required` → Flask `session['user_id']` | `@sso_required` → Bearer JWT |
| Role | `session['role']` from Minos `User` document | JWT claim → `ADMIN` / `USER` |
| Axios | `withCredentials: true` + CSRF | `Authorization: Bearer …` |
| Logout | `GET /auth/logout` | `performLogout()` → `REACT_APP_SSO_LOGOUT_URL` (**F8**) |

---

## 6. SSO team checklist (external)

Use **[SSO_REDIRECT_URIS.md](SSO_REDIRECT_URIS.md)** for staging + production callback URLs (**I4**).

- [ ] OIDC client for Minos SPA — register redirect URIs from SSO_REDIRECT_URIS.md (**I4**)
- [ ] Staging: `https://<staging-spa>/home` (and logout post-redirect if used)
- [ ] Production: `https://<prod-spa>/home`
- [ ] Access token is a JWT Minos can validate offline via JWKS
- [ ] Confirm `roles` (or agreed claim) and admin/user string values
- [ ] Provide login and logout URLs for `REACT_APP_SSO_*`
- [ ] Confirm token lifetime and refresh strategy (SPA SDK)

---

## 7. Minos implementation map

| Task | Depends on S1 |
|------|----------------|
| **S2** | Role claim mapping in code + doc update |
| **S3** / **B1** | `sso_required` on `/api/*` |
| **S4** | `AUTH_DISABLED` dev bypass |
| **S5** / **F1** | Prod routes → SSO, not `/auth/login` (`src/auth/ssoConfig.ts`, `SsoRedirect`) |
| **S6** / **B10** | `configure_cors()` — `FRONTEND_ORIGIN`, `Authorization`, credentials (**done**) |
| **F3** | Axios Bearer + `accessToken` storage (**done**) |
| **F4** | 401 → SSO login (**done**) |
| **F8** | `performLogout()` → IdP end-session (**done**) |
| **I4** | Redirect URI register — [SSO_REDIRECT_URIS.md](SSO_REDIRECT_URIS.md) |

---

## 8. References

- MVP tasks: `docs/MVP_CHECKLIST.md` (section 1 — SSO)
- Legacy auth (dev): `utils/auth_security.py`, `routes/auth.py`
- Roles: `models/tables.py` (`RoleEnum`), `utils/decorators.py` (`require_role`)

*Last updated: 2026-05-20 — S1 sign-off: Bearer JWT + `roles` claim mapping documented.*
