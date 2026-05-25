# utils/catalog_references.py
"""Find catalog master id references across patients and treatments (doc/CATALOG_SYNC.md)."""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, List

_root = Path(__file__).resolve().parents[1]
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from bson import ObjectId

from models.tables import PatientTree, Treatment
from utils.tree_traversal import (
    drug_ids_from_treatment_embedded,
    extract_node_catalog_ids,
    normalize_object_id,
    walk_tree,
)


@dataclass(frozen=True)
class CatalogReferenceResult:
    """Aggregate counts for GET .../references and DELETE 409 payloads."""

    patient_ids: List[str]
    patient_count: int
    node_count: int
    treatment_count: int = 0

    def to_api_dict(self) -> dict:
        body = {
            "patient_ids": self.patient_ids,
            "patient_count": self.patient_count,
            "node_count": self.node_count,
        }
        if self.treatment_count:
            body["treatment_count"] = self.treatment_count
        return body

    def has_references(self) -> bool:
        return self.node_count > 0 or self.treatment_count > 0

    def to_delete_references(self) -> dict:
        """Shape for 409 DELETE payloads: { patients, nodes, treatment_count? }."""
        body: dict = {
            "patients": self.patient_ids,
            "nodes": self.node_count,
        }
        if self.treatment_count:
            body["treatment_count"] = self.treatment_count
        return body


def _count_characteristic_hits(tree: Any, char_id: ObjectId) -> int:
    hits = 0
    for visit in walk_tree(tree):
        ids = extract_node_catalog_ids(visit.node)
        if ids.characteristic_id == char_id:
            hits += 1
    return hits


def _count_treatment_hits(tree: Any, treatment_id: ObjectId) -> int:
    hits = 0
    for visit in walk_tree(tree):
        ids = extract_node_catalog_ids(visit.node)
        if ids.treatment_id == treatment_id:
            hits += 1
    return hits


def _count_drug_hits_in_tree(tree: Any, drug_id: ObjectId) -> int:
    hits = 0
    for visit in walk_tree(tree):
        ids = extract_node_catalog_ids(visit.node)
        hits += sum(1 for did in ids.drug_ids if did == drug_id)
    return hits


def _scan_patient_trees(
    count_hits,
) -> tuple[List[str], int]:
    patient_ids: List[str] = []
    node_count = 0

    for patient in PatientTree.objects.only("id", "tree"):
        tree = patient.tree
        if tree is None:
            continue
        hits = count_hits(tree)
        if hits:
            patient_ids.append(str(patient.id))
            node_count += hits

    return patient_ids, node_count


def find_characteristic_refs(char_id: Any) -> CatalogReferenceResult:
    """All patient tree nodes whose characteristic_data._id matches char_id."""
    char_oid = normalize_object_id(char_id)
    patient_ids, node_count = _scan_patient_trees(
        lambda tree: _count_characteristic_hits(tree, char_oid),
    )
    return CatalogReferenceResult(
        patient_ids=patient_ids,
        patient_count=len(patient_ids),
        node_count=node_count,
    )


def find_treatment_refs(treatment_id: Any) -> CatalogReferenceResult:
    """Patient tree nodes whose treatment_data._id matches treatment_id."""
    treat_oid = normalize_object_id(treatment_id)
    patient_ids, node_count = _scan_patient_trees(
        lambda tree: _count_treatment_hits(tree, treat_oid),
    )
    return CatalogReferenceResult(
        patient_ids=patient_ids,
        patient_count=len(patient_ids),
        node_count=node_count,
    )


def _count_master_treatments_with_drug(drug_id: ObjectId) -> int:
    count = 0
    for treatment in Treatment.objects.only("id", "regimen", "alternatives"):
        drug_ids = drug_ids_from_treatment_embedded(treatment)
        if any(did == drug_id for did in drug_ids):
            count += 1
    return count


def find_drug_refs(drug_id: Any) -> CatalogReferenceResult:
    """
    Drug embeds in patient treatment nodes (regimen + alternatives) and in master
    Treatment documents. treatment_count is the number of master Treatment docs.
    """
    drug_oid = normalize_object_id(drug_id)
    patient_ids, node_count = _scan_patient_trees(
        lambda tree: _count_drug_hits_in_tree(tree, drug_oid),
    )
    treatment_count = _count_master_treatments_with_drug(drug_oid)
    return CatalogReferenceResult(
        patient_ids=patient_ids,
        patient_count=len(patient_ids),
        node_count=node_count,
        treatment_count=treatment_count,
    )


def _run_self_test() -> None:
    from utils.tree_traversal import _demo_tree

    tree = _demo_tree()
    char_id = tree["characteristic_data"]["_id"]
    treat_id = tree["children"][0]["treatment_data"]["_id"]
    drug_a = tree["children"][0]["treatment_data"]["regimen"]["drugs"][0]["drug"]["_id"]
    drug_b = tree["children"][0]["children"][0]["treatment_data"]["alternatives"][0][
        "regimen"
    ]["drugs"][0]["drug"]["_id"]

    assert _count_characteristic_hits(tree, normalize_object_id(char_id)) == 1
    assert _count_treatment_hits(tree, normalize_object_id(treat_id)) == 1
    assert _count_drug_hits_in_tree(tree, normalize_object_id(drug_a)) == 2
    assert _count_drug_hits_in_tree(tree, normalize_object_id(drug_b)) == 1
    assert _count_drug_hits_in_tree(tree, ObjectId()) == 0

    assert normalize_object_id(char_id) == normalize_object_id(str(char_id))

    print("catalog_references self-test: ok")
    print(f"  char hits in demo tree: 1")
    print(f"  drug_a embed hits: 2")


if __name__ == "__main__":
    if __package__ is None:
        print(
            "Run from project root: PYTHONPATH=. python -m utils.catalog_references",
            file=sys.stderr,
        )
        sys.exit(2)
    _run_self_test()
