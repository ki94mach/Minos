#!/usr/bin/env python3
"""
Dev-path API smoke tests (no SSO) — maps to MVP T3–T6, T9–T11, partial T12,
plus catalog reference endpoints (doc/CATALOG_SYNC.md).

Requires API running with AUTH_DISABLED=true (see doc/DEV_SMOKE.md).

Usage:
  python scripts/smoke_dev_api.py
  SMOKE_API_URL=http://127.0.0.1:5000 python scripts/smoke_dev_api.py

Cleanup:
  Resources created during the run are deleted in a finally block (even on failure).
  On start, removes leftover rows whose catalog names start with "Smoke-" (smoke runs).
  Set SMOKE_PURGE_ORPHANS=false to skip orphan purge. DELETE requires ADMIN (default
  with AUTH_DISABLED via DEV_MOCK_ROLE).
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

# Project root on path so we share API name normalization with validators.
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from utils.business_rules import to_title_format as catalog_name

BASE = os.environ.get("SMOKE_API_URL", "http://localhost:5000").rstrip("/")
PREFIX = f"smoke-{int(time.time())}"
SMOKE_NAME_PREFIX = catalog_name("smoke-")  # "Smoke-"
PURGE_ORPHANS = os.environ.get("SMOKE_PURGE_ORPHANS", "true").lower() not in (
    "0",
    "false",
    "no",
)


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


@dataclass
class SmokeRunResources:
    characteristic_ids: list[str] = field(default_factory=list)
    drug_ids: list[str] = field(default_factory=list)
    treatment_ids: list[str] = field(default_factory=list)
    patient_ids: list[str] = field(default_factory=list)


def is_smoke_catalog_name(name: Any) -> bool:
    return isinstance(name, str) and name.startswith(SMOKE_NAME_PREFIX)


def tree_has_smoke_catalog_name(node: Any) -> bool:
    if not isinstance(node, dict):
        return False
    char_data = node.get("characteristic_data") or {}
    if is_smoke_catalog_name(char_data.get("name")):
        return True
    treat_data = node.get("treatment_data") or {}
    if is_smoke_catalog_name(treat_data.get("name")):
        return True
    for child in node.get("children") or []:
        if tree_has_smoke_catalog_name(child):
            return True
    return False


def _cleanup_warn(label: str, resource_id: str, code: int, body: Any) -> None:
    if code == 200:
        print(f"  OK  cleanup {label} {resource_id}")
        return
    print(
        f"  WARN cleanup {label} {resource_id}: HTTP {code} {body!r}",
        file=sys.stderr,
    )


def cleanup_smoke_resources(resources: SmokeRunResources) -> None:
    """Best-effort delete of resources created during this run (order matters)."""
    if not any(
        (
            resources.patient_ids,
            resources.treatment_ids,
            resources.drug_ids,
            resources.characteristic_ids,
        )
    ):
        return
    print("\nCleaning up smoke resources...")
    for patient_id in resources.patient_ids:
        code, body = request("DELETE", f"/api/patients/{patient_id}")
        _cleanup_warn("patient", patient_id, code, body)
    for treatment_id in resources.treatment_ids:
        code, body = request("DELETE", f"/api/treatments/{treatment_id}")
        _cleanup_warn("treatment", treatment_id, code, body)
    for drug_id in resources.drug_ids:
        code, body = request("DELETE", f"/api/drugs/{drug_id}")
        _cleanup_warn("drug", drug_id, code, body)
    for char_id in resources.characteristic_ids:
        code, body = request("DELETE", f"/api/characteristics/{char_id}")
        _cleanup_warn("characteristic", char_id, code, body)


def purge_orphan_smoke_artifacts() -> None:
    """Remove smoke-tagged rows left by earlier failed runs."""
    print("Checking for leftover smoke artifacts...")
    code, patients = request("GET", "/api/patients")
    if code == 200 and isinstance(patients, list):
        for patient in patients:
            pid = patient.get("_id")
            if pid is None:
                continue
            if tree_has_smoke_catalog_name(patient.get("tree")):
                c, b = request("DELETE", f"/api/patients/{pid}")
                _cleanup_warn("orphan patient", str(pid), c, b)

    code, treatments = request("GET", "/api/treatments")
    if code == 200 and isinstance(treatments, list):
        for treatment in treatments:
            tid = treatment.get("_id")
            if tid is None:
                continue
            if is_smoke_catalog_name(treatment.get("name")):
                c, b = request("DELETE", f"/api/treatments/{tid}")
                _cleanup_warn("orphan treatment", str(tid), c, b)

    code, drugs = request("GET", "/api/drugs")
    if code == 200 and isinstance(drugs, list):
        for drug in drugs:
            did = drug.get("_id")
            if did is None:
                continue
            if is_smoke_catalog_name(drug.get("name")):
                c, b = request("DELETE", f"/api/drugs/{did}")
                _cleanup_warn("orphan drug", str(did), c, b)

    code, characteristics = request("GET", "/api/characteristics")
    if code == 200 and isinstance(characteristics, list):
        for characteristic in characteristics:
            cid = characteristic.get("_id")
            if cid is None:
                continue
            if is_smoke_catalog_name(characteristic.get("name")):
                c, b = request("DELETE", f"/api/characteristics/{cid}")
                _cleanup_warn("orphan characteristic", str(cid), c, b)


def _run_smoke_tests(resources: SmokeRunResources) -> None:
    pop_name = catalog_name(f"{PREFIX}-Pop")
    pop_updated = catalog_name(f"{PREFIX}-Pop-Updated")
    drug_name = catalog_name(f"{PREFIX}-Drug")
    regimen_name = catalog_name(f"{PREFIX}-Regimen")

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
        {"type": "Population", "name": pop_name},
    )
    ok("T3 create characteristic", code == 201, str(created))
    char_id = (created or {}).get("id") if isinstance(created, dict) else None
    ok("T3 characteristic id", bool(char_id))
    if char_id:
        resources.characteristic_ids.append(str(char_id))

    code, t3_put = request(
        "PUT",
        f"/api/characteristics/{char_id}",
        {"type": "Population", "name": pop_updated},
    )
    ok("T3 update characteristic", code == 200, str(t3_put))
    ok(
        "T3 update before patient (no sync fan-out)",
        isinstance(t3_put, dict)
        and t3_put.get("patients_updated", -1) == 0
        and t3_put.get("node_count", -1) == 0,
        str(t3_put),
    )

    # T4 — drug CRUD
    code, drug = request(
        "POST",
        "/api/drugs",
        {"name": drug_name, "strength": 100, "unit": "mg"},
    )
    ok("T4 create drug", code == 201, str(drug))
    drug_id = (drug or {}).get("id") if isinstance(drug, dict) else None
    if drug_id:
        resources.drug_ids.append(str(drug_id))

    code, _ = request(
        "PUT",
        f"/api/drugs/{drug_id}",
        {"name": drug_name, "strength": 120, "unit": "mg"},
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
                    "name": pop_updated,
                },
                "children": [],
            }
        },
    )
    ok("T6 create patient", code == 201, str(patient_resp))
    patient_id = patient_resp.get("id") if isinstance(patient_resp, dict) else None
    ok("T6 patient id", bool(patient_id))
    if patient_id:
        resources.patient_ids.append(str(patient_id))

    renamed = catalog_name(f"{PREFIX}-Pop-Renamed")
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
                    "name": drug_name,
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
            "name": regimen_name,
            "type": "Regimen",
            "regimen": drug_regimen,
        },
    )
    ok("catalog create treatment (drug regimen)", code == 201, str(treat_resp))
    treatment_id = (treat_resp or {}).get("id") if isinstance(treat_resp, dict) else None
    ok("catalog treatment id", bool(treatment_id))
    if treatment_id:
        resources.treatment_ids.append(str(treatment_id))

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
                    "name": regimen_name,
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
        {"name": drug_name, "strength": synced_strength, "unit": "mg"},
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

    code, drug_noop_put = request("PUT", f"/api/drugs/{drug_id}", {})
    ok("catalog drug noop PUT", code == 200, str(drug_noop_put))
    ok(
        "drug noop PUT zero sync",
        isinstance(drug_noop_put, dict)
        and drug_noop_put.get("patients_updated", -1) == 0
        and drug_noop_put.get("node_count", -1) == 0
        and drug_noop_put.get("treatments_updated", -1) == 0,
        str(drug_noop_put),
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
    ok(
        "patient embedded drug name matches master",
        patient_drug.get("name") == drug_name,
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

    renamed_treatment = catalog_name(f"{PREFIX}-Regimen-Renamed")
    code, treat_put = request(
        "PUT",
        f"/api/treatments/{treatment_id}",
        {"name": renamed_treatment, "type": "Regimen"},
    )
    ok("catalog treatment propagate PUT", code == 200, str(treat_put))
    ok(
        "treatment sync patients_updated",
        isinstance(treat_put, dict) and treat_put.get("patients_updated", 0) >= 1,
        str(treat_put),
    )
    ok(
        "treatment sync node_count",
        isinstance(treat_put, dict) and treat_put.get("node_count", 0) >= 1,
        str(treat_put),
    )

    code, patients_treat_sync = request("GET", "/api/patients")
    ok("GET patients after treatment sync", code == 200)
    patient_treat_row = next(
        (p for p in (patients_treat_sync or []) if str(p.get("_id")) == str(patient_id)),
        None,
    )
    treat_child_sync = next(
        (
            c
            for c in ((patient_treat_row or {}).get("tree") or {}).get("children", [])
            if c.get("node_type") == "treatment"
        ),
        None,
    )
    ok(
        "embedded treatment name matches master",
        ((treat_child_sync or {}).get("treatment_data") or {}).get("name")
        == renamed_treatment,
        str((treat_child_sync or {}).get("treatment_data")),
    )

    treatment_node_id = str(treat_child_sync["_id"])
    followup_os = 0.5
    followup_name = catalog_name(f"{PREFIX}-Followup")
    code, fu_master = request(
        "POST",
        "/api/followups",
        {
            "name": followup_name,
            "overall_survival": followup_os,
            "patient_id": patient_id,
            "parent_id": treatment_node_id,
        },
    )
    ok("create followup master for delete guard", code == 201, str(fu_master))
    followup_master_id = (fu_master or {}).get("id") if isinstance(fu_master, dict) else None
    ok("followup master id", bool(followup_master_id))

    treat_size = float(treat_child_sync.get("size") or 250.0)
    code, _ = request(
        "POST",
        f"/api/patients/{patient_id}/add_node",
        {
            "parent_node_id": treatment_node_id,
            "node": {
                "node_type": "followup",
                "rate": followup_os,
                "size": round(treat_size * followup_os),
                "followup_data": {
                    "_id": followup_master_id,
                    "overall_survival": followup_os,
                },
            },
        },
    )
    ok("add followup node under treatment", code == 200, str(_))

    code, del_treat_blocked = request(
        "DELETE",
        f"/api/patients/{patient_id}/node/{treatment_node_id}",
    )
    ok(
        "DELETE treatment blocked when followups would orphan",
        code == 400,
        str(del_treat_blocked),
    )
    ok(
        "DELETE treatment followup parent error",
        isinstance(del_treat_blocked, dict)
        and "follow-up" in (del_treat_blocked.get("error") or "").lower()
        and "treatment" in (del_treat_blocked.get("error") or "").lower(),
        str(del_treat_blocked),
    )

    code, patients_after_blocked_del = request("GET", "/api/patients")
    ok("GET patients after blocked treatment delete", code == 200)
    patient_after_blocked = next(
        (
            p
            for p in (patients_after_blocked_del or [])
            if str(p.get("_id")) == str(patient_id)
        ),
        None,
    )
    treat_still = next(
        (
            c
            for c in ((patient_after_blocked or {}).get("tree") or {}).get("children", [])
            if c.get("node_type") == "treatment"
        ),
        None,
    )
    ok(
        "treatment node still present after blocked delete",
        treat_still is not None
        and str(treat_still.get("_id")) == treatment_node_id,
        str((patient_after_blocked or {}).get("tree")),
    )

    code, treatments_after_sync = request("GET", "/api/treatments")
    master_after = next(
        (
            t
            for t in (treatments_after_sync or [])
            if str(t.get("_id")) == str(treatment_id)
        ),
        None,
    )
    ok(
        "master treatment name matches after sync PUT",
        (master_after or {}).get("name") == renamed_treatment,
        str(master_after),
    )

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

    code, treat_refs = request("GET", f"/api/treatments/{treatment_id}/references")
    ok("catalog treatment references", code == 200, str(treat_refs))
    ok(
        "treatment references patient_count",
        isinstance(treat_refs, dict) and treat_refs.get("patient_count", 0) >= 1,
        str(treat_refs),
    )
    treat_patient_ids = (treat_refs or {}).get("patient_ids") or []
    ok(
        "treatment references lists patient",
        str(patient_id) in [str(pid) for pid in treat_patient_ids],
        str(treat_refs),
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
                    "name": renamed,
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
    char_children = [
        c for c in children if c.get("node_type") == "characteristic"
    ]
    ok("T9 characteristic child exists", len(char_children) >= 1)
    child_id = str(char_children[-1]["_id"])

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

    # DELETE blocked while referenced (409)
    code, del_char = request("DELETE", f"/api/characteristics/{char_id}")
    ok("DELETE characteristic blocked when referenced", code == 409, str(del_char))
    ok(
        "DELETE char references payload",
        isinstance(del_char, dict)
        and "references" in del_char
        and del_char["references"].get("nodes", 0) >= 1,
        str(del_char),
    )

    code, del_drug = request("DELETE", f"/api/drugs/{drug_id}")
    ok("DELETE drug blocked when referenced", code == 409, str(del_drug))
    drug_del_refs = (del_drug or {}).get("references") if isinstance(del_drug, dict) else {}
    ok(
        "DELETE drug references payload",
        drug_del_refs.get("nodes", 0) >= 1
        and drug_del_refs.get("treatment_count", 0) >= 1,
        str(del_drug),
    )

    if treatment_id:
        code, del_treat = request("DELETE", f"/api/treatments/{treatment_id}")
        ok("DELETE treatment blocked when referenced", code == 409, str(del_treat))
        ok(
            "DELETE treatment references payload",
            isinstance(del_treat, dict)
            and del_treat.get("references", {}).get("nodes", 0) >= 1,
            str(del_treat),
        )

    print("\nAll dev API smoke checks passed.")


def main() -> int:
    print(f"Dev API smoke against {BASE}\n")
    resources = SmokeRunResources()
    if PURGE_ORPHANS:
        purge_orphan_smoke_artifacts()
    try:
        _run_smoke_tests(resources)
    finally:
        cleanup_smoke_resources(resources)
    print("Next: manual UI at http://localhost:3000/home (see doc/DEV_SMOKE.md)")
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
