#!/usr/bin/env python3
"""
Dev-path API smoke tests (no SSO) — maps to MVP T3–T6, T9–T11, partial T12,
plus catalog reference endpoints (docs/CATALOG_SYNC.md).

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

    renamed = f"{PREFIX}-Pop-Renamed"
    code, sync_put = request(
        "PUT",
        f"/api/characteristics/{char_id}",
        {"type": "Population", "name": renamed},
    )
    ok("catalog characteristic propagate PUT", code == 200, str(sync_put))
    ok(
        "catalog sync patients_updated",
        isinstance(sync_put, dict) and sync_put.get("patients_updated", 0) >= 1,
        str(sync_put),
    )
    ok(
        "catalog sync node_count",
        isinstance(sync_put, dict) and sync_put.get("node_count", 0) >= 1,
        str(sync_put),
    )

    code, patients_after_sync = request("GET", "/api/patients")
    ok("GET patients after characteristic sync", code == 200)
    synced = next(
        (p for p in (patients_after_sync or []) if str(p.get("_id")) == str(patient_id)),
        None,
    )
    ok("patient found after sync", synced is not None)
    root_char = ((synced or {}).get("tree") or {}).get("characteristic_data") or {}
    ok(
        "embedded characteristic name matches master",
        root_char.get("name") == renamed,
        str(root_char),
    )

    code, char_refs = request("GET", f"/api/characteristics/{char_id}/references")
    ok("catalog char references", code == 200, str(char_refs))
    ok(
        "char references patient_count",
        isinstance(char_refs, dict) and char_refs.get("patient_count", 0) >= 1,
        str(char_refs),
    )
    char_patient_ids = (char_refs or {}).get("patient_ids") or []
    ok(
        "char references lists patient",
        str(patient_id) in [str(pid) for pid in char_patient_ids],
        str(char_refs),
    )

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

    treatment_id = None
    drug_regimen = {
        "drugs": [
            {
                "drug": {
                    "_id": drug_id,
                    "name": f"{PREFIX}-Drug",
                    "strength": 120,
                    "unit": "mg",
                },
                "annual_patient_con": 10,
            }
        ]
    }
    code, treat_resp = request(
        "POST",
        "/api/treatments",
        {
            "name": f"{PREFIX}-Regimen",
            "type": "Regimen",
            "regimen": drug_regimen,
        },
    )
    ok("catalog create treatment (drug regimen)", code == 201, str(treat_resp))
    treatment_id = (treat_resp or {}).get("id") if isinstance(treat_resp, dict) else None
    ok("catalog treatment id", bool(treatment_id))

    code, _ = request(
        "POST",
        f"/api/patients/{patient_id}/add_node",
        {
            "parent_node_id": root_id,
            "node": {
                "node_type": "treatment",
                "rate": 0.25,
                "size": 250.0,
                "treatment_data": {
                    "_id": treatment_id,
                    "name": f"{PREFIX}-Regimen",
                    "type": "Regimen",
                    "regimen": drug_regimen,
                },
            },
        },
    )
    ok("catalog add treatment node", code == 200, str(_))

    synced_strength = 150
    code, drug_put = request(
        "PUT",
        f"/api/drugs/{drug_id}",
        {"name": f"{PREFIX}-Drug", "strength": synced_strength, "unit": "mg"},
    )
    ok("catalog drug propagate PUT", code == 200, str(drug_put))
    ok(
        "drug sync patients_updated",
        isinstance(drug_put, dict) and drug_put.get("patients_updated", 0) >= 1,
        str(drug_put),
    )
    ok(
        "drug sync node_count",
        isinstance(drug_put, dict) and drug_put.get("node_count", 0) >= 1,
        str(drug_put),
    )
    ok(
        "drug sync treatments_updated",
        isinstance(drug_put, dict) and drug_put.get("treatments_updated", 0) >= 1,
        str(drug_put),
    )

    code, patients_drug_sync = request("GET", "/api/patients")
    ok("GET patients after drug sync", code == 200)
    patient_row = next(
        (p for p in (patients_drug_sync or []) if str(p.get("_id")) == str(patient_id)),
        None,
    )
    treat_child = next(
        (
            c
            for c in ((patient_row or {}).get("tree") or {}).get("children", [])
            if c.get("node_type") == "treatment"
        ),
        None,
    )
    ok("patient treatment child after drug sync", treat_child is not None)
    patient_drug = (
        ((treat_child or {}).get("treatment_data") or {}).get("regimen") or {}
    ).get("drugs", [{}])[0].get("drug", {})
    ok(
        "patient embedded drug strength matches master",
        patient_drug.get("strength") == synced_strength,
        str(patient_drug),
    )

    code, treatments_list = request("GET", "/api/treatments")
    ok("GET treatments after drug sync", code == 200)
    master_treat = next(
        (t for t in (treatments_list or []) if str(t.get("_id")) == str(treatment_id)),
        None,
    )
    master_drug = (
        ((master_treat or {}).get("regimen") or {}).get("drugs", [{}])[0].get("drug", {})
    )
    ok(
        "master treatment drug strength matches",
        master_drug.get("strength") == synced_strength,
        str(master_drug),
    )

    drug_regimen["drugs"][0]["drug"]["strength"] = synced_strength

    code, drug_refs = request("GET", f"/api/drugs/{drug_id}/references")
    ok("catalog drug references", code == 200, str(drug_refs))
    ok(
        "drug references patient_count",
        isinstance(drug_refs, dict) and drug_refs.get("patient_count", 0) >= 1,
        str(drug_refs),
    )
    ok(
        "drug references treatment_count",
        isinstance(drug_refs, dict) and drug_refs.get("treatment_count", 0) >= 1,
        str(drug_refs),
    )

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
    if treatment_id:
        code, _ = request("DELETE", f"/api/treatments/{treatment_id}")
        ok("cleanup treatment", code == 200, str(_))
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
