#!/usr/bin/env python3
"""
Dev-path API smoke tests (no SSO) — maps to MVP T3–T6, T9–T11, partial T12.

Requires API running with AUTH_DISABLED=true (see docs/DEV_SMOKE.md).

Usage:
  python scripts/smoke_dev_api.py
  SMOKE_API_URL=http://127.0.0.1:5000 python scripts/smoke_dev_api.py
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Optional

BASE = os.environ.get("SMOKE_API_URL", "http://localhost:5000").rstrip("/")
PREFIX = f"smoke-{int(time.time())}"


class SmokeFailure(Exception):
    pass


def request(
    method: str,
    path: str,
    body: Optional[dict] = None,
    *,
    auth: bool = True,
) -> tuple[int, Any]:
    url = f"{BASE}{path}"
    data = None
    headers = {"Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            payload = json.loads(raw) if raw else None
            return resp.status, payload
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = raw
        return exc.code, payload


def ok(name: str, cond: bool, detail: str = "") -> None:
    if cond:
        print(f"  OK  {name}")
    else:
        raise SmokeFailure(f"{name} failed{': ' + detail if detail else ''}")


def main() -> int:
    print(f"Dev API smoke against {BASE}\n")

    # Health
    code, body = request("GET", "/health", auth=False)
    ok("health", code == 200 and body.get("mongo") == "ok", str(body))

    # T12 (inverted for dev): with AUTH_DISABLED, unauthenticated API works
    code, _ = request("GET", "/api/characteristics", auth=False)
    ok("dev bypass (no 401)", code == 200, f"got {code}")

    # T3 — characteristic CRUD
    code, created = request(
        "POST",
        "/api/characteristics",
        {"type": "Population", "name": f"{PREFIX}-Pop"},
    )
    ok("T3 create characteristic", code == 201, str(created))
    char_id = (created or {}).get("id") if isinstance(created, dict) else None
    ok("T3 characteristic id", bool(char_id))

    code, _ = request(
        "PUT",
        f"/api/characteristics/{char_id}",
        {"type": "Population", "name": f"{PREFIX}-Pop-Updated"},
    )
    ok("T3 update characteristic", code == 200, str(_))

    # T4 — drug CRUD
    code, drug = request(
        "POST",
        "/api/drugs",
        {"name": f"{PREFIX}-Drug", "strength": 100, "unit": "mg"},
    )
    ok("T4 create drug", code == 201, str(drug))
    drug_id = (drug or {}).get("id") if isinstance(drug, dict) else None

    code, _ = request(
        "PUT",
        f"/api/drugs/{drug_id}",
        {"name": f"{PREFIX}-Drug", "strength": 120, "unit": "mg"},
    )
    ok("T4 update drug", code == 200, str(_))

    # T6 — patient tree (uses catalog characteristic)
    code, patient_resp = request(
        "POST",
        "/api/patients",
        {
            "node": {
                "node_type": "characteristic",
                "rate": 1.0,
                "size": 1000.0,
                "parent_id": None,
                "characteristic_data": {
                    "_id": char_id,
                    "char_type": "Population",
                    "name": f"{PREFIX}-Pop-Updated",
                },
                "children": [],
            }
        },
    )
    ok("T6 create patient", code == 201, str(patient_resp))
    patient_id = patient_resp.get("id") if isinstance(patient_resp, dict) else None
    ok("T6 patient id", bool(patient_id))

    code, patients = request("GET", "/api/patients")
    ok("T7 list patients", code == 200 and isinstance(patients, list))

    # find our patient in list
    match = next(
        (p for p in (patients or []) if str(p.get("_id")) == str(patient_id)),
        None,
    )
    ok("T7 patient in list", match is not None)
    root_id = str(match["tree"]["_id"]) if match else None
    ok("T8 root node id", bool(root_id))

    # T9 — add child node
    code, add_resp = request(
        "POST",
        f"/api/patients/{patient_id}/add_node",
        {
            "parent_node_id": root_id,
            "node": {
                "node_type": "characteristic",
                "rate": 0.5,
                "size": 500.0,
                "characteristic_data": {
                    "_id": char_id,
                    "char_type": "Population",
                    "name": f"{PREFIX}-Pop-Updated",
                },
            },
        },
    )
    ok("T9 add node", code == 200, str(add_resp))

    # Refresh patient to get child id
    code, patients = request("GET", "/api/patients")
    match = next(
        (p for p in (patients or []) if str(p.get("_id")) == str(patient_id)),
        None,
    )
    children = (match or {}).get("tree", {}).get("children", [])
    ok("T9 child exists", len(children) >= 1)
    child_id = str(children[0]["_id"])

    # T10 — update node rate
    code, upd = request(
        "PUT",
        f"/api/patients/{patient_id}/node/{child_id}",
        {"rate": 0.75},
    )
    ok("T10 update node", code == 200, str(upd))

    # T11 — delete child node (splice children)
    code, del_resp = request(
        "DELETE",
        f"/api/patients/{patient_id}/node/{child_id}",
    )
    ok("T11 delete node", code == 200, str(del_resp))

    # Cleanup catalog (ADMIN mock)
    code, _ = request("DELETE", f"/api/drugs/{drug_id}")
    ok("cleanup drug", code == 200, str(_))
    code, _ = request("DELETE", f"/api/characteristics/{char_id}")
    ok("cleanup characteristic", code == 200, str(_))
    code, _ = request("DELETE", f"/api/patients/{patient_id}")
    ok("cleanup patient", code == 200, str(_))

    print("\nAll dev API smoke checks passed.")
    print("Next: manual UI at http://localhost:3000/home (see docs/DEV_SMOKE.md)")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SmokeFailure as exc:
        print(f"\nFAILED: {exc}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as exc:
        print(f"\nCannot reach API at {BASE}: {exc}", file=sys.stderr)
        print("Start API: AUTH_DISABLED=true python run.py", file=sys.stderr)
        sys.exit(1)
