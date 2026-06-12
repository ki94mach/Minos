#!/usr/bin/env python3
"""
Backfill missing `priority` on AlternativeTreatment embeds.

Existing alternatives without `priority` are assigned `index + 1` in stored list
order. This is a best-effort default and may not reflect true clinical preference;
review and edit priorities in the catalog after migration.

Usage:
  python scripts/backfill_alternative_priority.py
  python scripts/backfill_alternative_priority.py --dry-run

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


def _backfill_alternatives(alternatives) -> int:
    if not alternatives:
        return 0
    updated = 0
    for index, alt in enumerate(alternatives):
        current = getattr(alt, "priority", None)
        if current is None:
            alt.priority = index + 1
            updated += 1
    return updated


def backfill_treatments(dry_run: bool) -> tuple[int, int]:
    treatments_updated = 0
    alternatives_updated = 0

    for treatment in TreatmentDriver.find(type="Alternative"):
        if not treatment.alternatives:
            continue
        count = _backfill_alternatives(treatment.alternatives)
        if count:
            alternatives_updated += count
            treatments_updated += 1
            if not dry_run:
                TreatmentDriver.update(treatment)

    return treatments_updated, alternatives_updated


def backfill_patients(dry_run: bool) -> tuple[int, int]:
    patients_updated = 0
    alternatives_updated = 0

    for patient in PatientDriver.find():
        if not patient.tree:
            continue
        patient_changed = False
        for visit in walk_tree(patient.tree):
            treatment_data = getattr(visit.node, "treatment_data", None)
            if not treatment_data or not treatment_data.alternatives:
                continue
            count = _backfill_alternatives(treatment_data.alternatives)
            if count:
                alternatives_updated += count
                patient_changed = True

        if patient_changed:
            patients_updated += 1
            if not dry_run:
                patient.tree_hash = Utils.compute_tree_hash(patient.tree)
                PatientDriver.update(patient)

    return patients_updated, alternatives_updated


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Backfill alternative treatment priority fields."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report counts without writing to MongoDB.",
    )
    args = parser.parse_args()

    db_name = os.environ.get("MONGO_DBNAME", "minos_db").strip()
    host = os.environ.get("MONGO_URI", "mongodb://localhost:27017/").strip()
    connect_db(db_name=db_name, host=host)

    treat_docs, treat_alts = backfill_treatments(args.dry_run)
    patient_docs, patient_alts = backfill_patients(args.dry_run)

    mode = "DRY RUN" if args.dry_run else "APPLIED"
    print(f"[{mode}] Master treatments updated: {treat_docs} ({treat_alts} alternatives)")
    print(f"[{mode}] Patient trees updated: {patient_docs} ({patient_alts} alternatives)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
