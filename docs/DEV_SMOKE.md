

# Dev smoke tests (no SSO)

Use this when the **SSO team is not available**. It exercises the same MVP behaviors as section 6 (T3–T12) via **`AUTH_DISABLED`** and optional UI without Minos login pages.

**Not a substitute for staging SSO tests (T1–T2)** before production.

---

## How dev bypass works

| Layer | Setting | Effect |
|-------|---------|--------|
| API | `AUTH_DISABLED=true` | Every `/api/*` request gets a fake `DEV_MOCK_*` user (**S4**) |
| API | `FLASK_ENV=development` | Required for bypass (blocked in production **I5**) |
| SPA (recommended) | `REACT_APP_USE_MINOS_AUTH=false` in `.env.development` | Skip `/auth/login`; go straight to `/home` |
| SPA | `REACT_APP_API_URL=http://localhost:5000` | Already in `.env.development` |

With bypass, **T12 is inverted**: unauthenticated API calls return **200**, not 401. That is expected locally.

---

## 1. API `.env`

Copy and edit root `.env`:

```env
FLASK_ENV=development
AUTH_DISABLED=true
DEV_MOCK_ROLE=ADMIN
MONGO_URI=mongodb://localhost:27017/
MONGO_DBNAME=minos_db
FRONTEND_ORIGIN=http://localhost:3000
```

Use your real `MONGO_URI` if Mongo is not on localhost. Redis is optional when `AUTH_DISABLED=true`.

---

## 2. SPA env

In `.env.development` (already in repo), ensure:

```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_USE_MINOS_AUTH=false
```

Restart `npm start` after changing env files.

---

## 3. Start stack

**Terminal 1 — API**

```bash
pip install -r requirements.txt
python run.py
```

**Terminal 2 — SPA**

```bash
npm install
npm start
```

Open **http://localhost:3000/home** (or `/` → redirects to `/home`).

You should **not** need Minos login or corporate SSO.

---

## 4. Automated API smoke (T3–T11)

With the API running:

```bash
python scripts/smoke_dev_api.py
```

Optional: `SMOKE_API_URL=http://127.0.0.1:5000 python scripts/smoke_dev_api.py`

Covers: health, catalog CRUD (characteristic + drug + treatment), patient create/list, add/update/delete node (leaf splice, grandchildren splice, unknown node 404, treatment+follow-up delete 400), root delete (`DELETE /api/patients/<id>` only; `DELETE .../node/<root_id>` → 400), catalog `GET .../references`, PUT propagation, DELETE 409 when catalog entities are still referenced. Cleans up created rows.

Whole patient trees are removed only with `DELETE /api/patients/<patient_id>` (**ADMIN**). `DELETE /api/patients/<patient_id>/node/<node_id>` splices out a single non-root node.

---

## 5. Manual UI checklist (same session)

| ID | Dev action | Pass? |
|----|------------|-------|
| — | `/home` loads without SSO / Minos login | [ ] |
| T3 | Characteristics: create, edit, delete | [ ] |
| T4 | Drugs: create, edit, delete | [ ] |
| T5 | Treatments: create, edit, delete | [ ] |
| T6 | Patients: create tree (overview root flow) | [ ] |
| T7 | Patients overview graph | [ ] |
| T8 | Open `/patients/<rootId>` | [ ] |
| T9 | Right-click → add characteristic/treatment child | [ ] |
| T10 | Edit node rate | [ ] |
| T11 | Delete non-root node (children spliced to parent) | [ ] |
| — | Delete entire tree: root context menu → `DELETE /api/patients/<id>` (ADMIN) | [ ] |
| T12 | N/A in dev — API allows anonymous calls when bypass on | — |

Seed a **Population / Iran** (or your `REACT_APP_DEFAULT_CHAR_*`) characteristic for overview patient create (**F6**).

---

## 6. Test as non-admin (optional)

```env
DEV_MOCK_ROLE=USER
```

Restart API. DELETE on catalog/patients should return **403** (**B9**); other writes should still work.

---

## Related docs

- [DEVELOPMENT.md](DEVELOPMENT.md) — full local runbook  
- [MVP_CHECKLIST.md](MVP_CHECKLIST.md) — staging SSO tests T1–T2  
