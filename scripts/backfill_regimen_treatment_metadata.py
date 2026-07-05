#!/usr/bin/env python3
"""
Optional backfill for Regimen/Treatment catalog metadata.

Existing Regimen and Treatment documents without `priority` or `evidence_level`
are left unchanged. Use --set-default-priority to assign priority=1 where missing.

Usage:
  python scripts/backfill_regimen_treatment_metadata.py
  python scripts/backfill_regimen_treatment_metadata.py --dry-run
  python scripts/backfill_regimen_treatment_metadata.py --set-default-priority

Environment:
  MONGO_URI, MONGO_DBNAME (same as the API — see models/meta.py).
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from models.meta import connect_db
from models.patient.driver import PatientDriver
from models.treatment.driver import TreatmentDriver
from utils.tree_traversal import walk_tree
from utils.utils import Utils


def _backfill_treatment_metadata(treatment, set_default_priority: bool) -> bool:
    changed = False
    if set_default_priority and getattr(treatment, "priority", None) is None:
        if treatment.type in ("Regimen", "Treatment"):
            treatment.priority = 1
            changed = True
    return changed


def backfill_master_catalog(dry_run: bool, set_default_priority: bool) -> int:
    updated = 0
    for treatment in TreatmentDriver.find(type__in=["Regimen", "Treatment"]):
        if _backfill_treatment_metadata(treatment, set_default_priority):
            updated += 1
            if not dry_run:
                TreatmentDriver.update(treatment)
    return updated


def backfill_patients(dry_run: bool, set_default_priority: bool) -> int:
    updated = 0
    for patient in PatientDriver.find():
        if not patient.tree:
            continue
        patient_changed = False
        for visit in walk_tree(patient.tree):
            treatment_data = getattr(visit.node, "treatment_data", None)
            if not treatment_data:
                continue
            if treatment_data.type not in ("Regimen", "Treatment"):
                continue
            if set_default_priority and getattr(treatment_data, "priority", None) is None:
                treatment_data.priority = 1
                patient_changed = True
        if patient_changed:
            updated += 1
            if not dry_run:
                patient.tree_hash = Utils.compute_tree_hash(patient.tree)
                PatientDriver.update(patient)
    return updated


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Backfill optional priority/evidence_level on Regimen/Treatment catalog items."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report counts without writing to MongoDB.",
    )
    parser.add_argument(
        "--set-default-priority",
        action="store_true",
        help="Assign priority=1 to Regimen/Treatment items that have no priority.",
    )
    args = parser.parse_args()

    db_name = os.environ.get("MONGO_DBNAME", "minos_db").strip()
    host = os.environ.get("MONGO_URI", "mongodb://localhost:27017/").strip()
    connect_db(db_name=db_name, host=host)

    if not args.set_default_priority:
        print(
            "No changes by default. Pass --set-default-priority to assign priority=1 "
            "where missing."
        )
        return 0

    master_updated = backfill_master_catalog(args.dry_run, args.set_default_priority)
    patients_updated = backfill_patients(args.dry_run, args.set_default_priority)

    mode = "DRY RUN" if args.dry_run else "APPLIED"
    print(f"[{mode}] Master Regimen/Treatment docs updated: {master_updated}")
    print(f"[{mode}] Patient trees updated: {patients_updated}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
