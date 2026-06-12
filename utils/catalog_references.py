# utils/catalog_references.py
"""Find catalog master id references across patients and treatments (doc/CATALOG_SYNC.md)."""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

_root = Path(__file__).resolve().parents[1]
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from bson import ObjectId

from models.tables import PatientTree, Treatment
from utils.catalog_usage_context import UsageContext, resolve_usage_context
from utils.tree_traversal import (
    TreeWalkItem,
    _get_field,
    drug_ids_from_treatment_embedded,
    drug_ids_from_treatment_with_master_fallback,
    extract_node_catalog_ids,
    normalize_object_id,
    walk_tree,
)


@dataclass(frozen=True)
class CatalogUsage:
    node_id: str
    node_type: str
    label: str
    path_label: str


@dataclass(frozen=True)
class CatalogUsageGroup:
    patient_id: str
    population_catalog_id: str
    population_name: str
    pi_catalog_id: Optional[str]
    pi_name: Optional[str]
    usage_count: int
    usages: Tuple[CatalogUsage, ...]


@dataclass
class CatalogReferenceResult:
    """Aggregate counts for GET .../references and DELETE 409 payloads."""

    patient_ids: List[str]
    patient_count: int
    node_count: int
    treatment_count: int = 0
    groups: List[CatalogUsageGroup] = field(default_factory=list)

    def to_api_dict(self) -> dict:
        body = {
            "patient_ids": self.patient_ids,
            "patient_count": self.patient_count,
            "node_count": self.node_count,
            "groups": [_group_to_dict(group) for group in self.groups],
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


def _usage_to_dict(usage: CatalogUsage) -> dict:
    return {
        "node_id": usage.node_id,
        "node_type": usage.node_type,
        "label": usage.label,
        "path_label": usage.path_label,
    }


def _group_to_dict(group: CatalogUsageGroup) -> dict:
    body: dict = {
        "patient_id": group.patient_id,
        "population_catalog_id": group.population_catalog_id,
        "population_name": group.population_name,
        "usage_count": group.usage_count,
        "usages": [_usage_to_dict(usage) for usage in group.usages],
    }
    if group.pi_catalog_id is not None:
        body["pi_catalog_id"] = group.pi_catalog_id
    if group.pi_name is not None:
        body["pi_name"] = group.pi_name
    return body


def _make_usage(visit: TreeWalkItem, ctx: UsageContext) -> CatalogUsage:
    return CatalogUsage(
        node_id=str(visit.node_id),
        node_type=visit.node_type,
        label=ctx.node_label,
        path_label=ctx.path_label,
    )


def _group_key(patient_id: str, ctx: UsageContext) -> Tuple[str, Optional[str]]:
    return patient_id, ctx.pi_catalog_id


def _group_usages(
    pending: Dict[Tuple[str, Optional[str]], List[Tuple[UsageContext, CatalogUsage]]],
) -> List[CatalogUsageGroup]:
    groups: List[CatalogUsageGroup] = []
    for (patient_id, _pi_id), entries in pending.items():
        ctx0 = entries[0][0]
        usages = tuple(usage for _ctx, usage in entries)
        groups.append(
            CatalogUsageGroup(
                patient_id=patient_id,
                population_catalog_id=ctx0.population_catalog_id,
                population_name=ctx0.population_name,
                pi_catalog_id=ctx0.pi_catalog_id,
                pi_name=ctx0.pi_name,
                usage_count=len(usages),
                usages=usages,
            )
        )
    groups.sort(key=lambda g: (g.population_name, g.pi_name or "", g.patient_id))
    return groups


def _scan_patient_trees(
    count_hits: Callable[[Any], int],
    collect_usages: Callable[[Any, str], None],
) -> Tuple[List[str], int, List[CatalogUsageGroup]]:
    patient_ids: List[str] = []
    node_count = 0
    pending: Dict[Tuple[str, Optional[str]], List[Tuple[UsageContext, CatalogUsage]]] = {}

    for patient in PatientTree.objects.only("id", "tree"):
        tree = patient.tree
        if tree is None:
            continue
        hits = count_hits(tree)
        if hits:
            patient_ids.append(str(patient.id))
            node_count += hits
            collect_usages(tree, str(patient.id), pending)

    return patient_ids, node_count, _group_usages(pending)


def _count_characteristic_hits(tree: Any, char_id: ObjectId) -> int:
    hits = 0
    for visit in walk_tree(tree):
        ids = extract_node_catalog_ids(visit.node)
        if ids.characteristic_id == char_id:
            hits += 1
    return hits


def _collect_characteristic_usages(
    tree: Any,
    patient_id: str,
    char_id: ObjectId,
    pending: Dict[Tuple[str, Optional[str]], List[Tuple[UsageContext, CatalogUsage]]],
) -> None:
    for visit in walk_tree(tree):
        ids = extract_node_catalog_ids(visit.node)
        if ids.characteristic_id != char_id:
            continue
        ctx = resolve_usage_context(tree, visit.node, visit.path)
        key = _group_key(patient_id, ctx)
        pending.setdefault(key, []).append((ctx, _make_usage(visit, ctx)))


def _count_treatment_hits(tree: Any, treatment_id: ObjectId) -> int:
    hits = 0
    for visit in walk_tree(tree):
        ids = extract_node_catalog_ids(visit.node)
        if ids.treatment_id == treatment_id:
            hits += 1
    return hits


def _collect_treatment_usages(
    tree: Any,
    patient_id: str,
    treatment_id: ObjectId,
    pending: Dict[Tuple[str, Optional[str]], List[Tuple[UsageContext, CatalogUsage]]],
) -> None:
    for visit in walk_tree(tree):
        ids = extract_node_catalog_ids(visit.node)
        if ids.treatment_id != treatment_id:
            continue
        ctx = resolve_usage_context(tree, visit.node, visit.path)
        key = _group_key(patient_id, ctx)
        pending.setdefault(key, []).append((ctx, _make_usage(visit, ctx)))


def _master_treatment_cached(
    treatment_id: ObjectId,
    cache: Dict[str, Any],
) -> Any:
    key = str(treatment_id)
    if key not in cache:
        cache[key] = Treatment.objects.only("id", "regimen", "alternatives").filter(
            id=treatment_id
        ).first()
    return cache[key]


def _treatment_embed_needs_master_drug_lookup(treatment_data: Any) -> bool:
    """True when regimen/alternative drugs are not on the patient embed."""
    treat_type = _get_field(treatment_data, "type")
    alternatives = _get_field(treatment_data, "alternatives")
    if treat_type == "Alternative" and not alternatives:
        return True
    return len(drug_ids_from_treatment_embedded(treatment_data)) == 0


def _drug_ids_on_treatment_node(
    node: Any,
    master_cache: Dict[str, Any],
) -> Tuple[ObjectId, ...]:
    if _get_field(node, "node_type") != "treatment":
        return ()
    treatment_data = _get_field(node, "treatment_data")
    if treatment_data is None:
        return ()
    if not _treatment_embed_needs_master_drug_lookup(treatment_data):
        return tuple(drug_ids_from_treatment_embedded(treatment_data))

    raw_treat_id = _get_field(treatment_data, "_id")
    if raw_treat_id is None:
        return tuple(drug_ids_from_treatment_embedded(treatment_data))

    treat_oid = normalize_object_id(raw_treat_id)
    master = _master_treatment_cached(treat_oid, master_cache)
    return tuple(
        drug_ids_from_treatment_with_master_fallback(treatment_data, master)
    )


def _count_drug_hits_in_tree(
    tree: Any,
    drug_id: ObjectId,
    master_cache: Optional[Dict[str, Any]] = None,
) -> int:
    cache: Dict[str, Any] = master_cache if master_cache is not None else {}
    hits = 0
    for visit in walk_tree(tree):
        drug_ids = _drug_ids_on_treatment_node(visit.node, cache)
        hits += sum(1 for did in drug_ids if did == drug_id)
    return hits


def _collect_drug_usages(
    tree: Any,
    patient_id: str,
    drug_id: ObjectId,
    pending: Dict[Tuple[str, Optional[str]], List[Tuple[UsageContext, CatalogUsage]]],
    master_cache: Dict[str, Any],
) -> None:
    seen_nodes: set[str] = set()
    for visit in walk_tree(tree):
        drug_ids = _drug_ids_on_treatment_node(visit.node, master_cache)
        if not any(did == drug_id for did in drug_ids):
            continue
        node_id_str = str(visit.node_id)
        if node_id_str in seen_nodes:
            continue
        seen_nodes.add(node_id_str)
        ctx = resolve_usage_context(tree, visit.node, visit.path)
        key = _group_key(patient_id, ctx)
        pending.setdefault(key, []).append((ctx, _make_usage(visit, ctx)))


def find_characteristic_refs(char_id: Any) -> CatalogReferenceResult:
    """All patient tree nodes whose characteristic_data._id matches char_id."""
    char_oid = normalize_object_id(char_id)
    patient_ids, node_count, groups = _scan_patient_trees(
        lambda tree: _count_characteristic_hits(tree, char_oid),
        lambda tree, patient_id, bag: _collect_characteristic_usages(
            tree, patient_id, char_oid, bag
        ),
    )
    return CatalogReferenceResult(
        patient_ids=patient_ids,
        patient_count=len(patient_ids),
        node_count=node_count,
        groups=groups,
    )


def find_treatment_refs(treatment_id: Any) -> CatalogReferenceResult:
    """Patient tree nodes whose treatment_data._id matches treatment_id."""
    treat_oid = normalize_object_id(treatment_id)
    patient_ids, node_count, groups = _scan_patient_trees(
        lambda tree: _count_treatment_hits(tree, treat_oid),
        lambda tree, patient_id, bag: _collect_treatment_usages(
            tree, patient_id, treat_oid, bag
        ),
    )
    return CatalogReferenceResult(
        patient_ids=patient_ids,
        patient_count=len(patient_ids),
        node_count=node_count,
        groups=groups,
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

    Alternative patient nodes may omit alternatives[] on the embed; regimen drugs
  under each alternative option are resolved from the master Treatment document.
    """
    drug_oid = normalize_object_id(drug_id)
    master_cache: Dict[str, Any] = {}
    patient_ids, node_count, groups = _scan_patient_trees(
        lambda tree: _count_drug_hits_in_tree(tree, drug_oid, master_cache),
        lambda tree, patient_id, bag: _collect_drug_usages(
            tree, patient_id, drug_oid, bag, master_cache
        ),
    )
    treatment_count = _count_master_treatments_with_drug(drug_oid)
    return CatalogReferenceResult(
        patient_ids=patient_ids,
        patient_count=len(patient_ids),
        node_count=node_count,
        treatment_count=treatment_count,
        groups=groups,
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

    pending: Dict[Tuple[str, Optional[str]], List[Tuple[UsageContext, CatalogUsage]]] = {}
    _collect_drug_usages(tree, "patient-1", normalize_object_id(drug_a), pending, {})
    drug_groups = _group_usages(pending)
    assert len(drug_groups) == 1
    assert drug_groups[0].usage_count == 1
    assert "Iran" in drug_groups[0].usages[0].path_label
    assert "Line 1" in drug_groups[0].usages[0].path_label

    pop_ctx = resolve_usage_context(tree, tree, ())
    assert pop_ctx.path_label == "Iran"
    assert pop_ctx.pi_catalog_id is None

    treat_node = tree["children"][0]
    treat_ctx = resolve_usage_context(tree, treat_node, (0,))
    assert treat_ctx.path_label == "Iran → Line 1"

    pending_b: Dict[Tuple[str, Optional[str]], List[Tuple[UsageContext, CatalogUsage]]] = {}
    _collect_drug_usages(tree, "patient-1", normalize_object_id(drug_b), pending_b, {})
    drug_b_groups = _group_usages(pending_b)
    assert len(drug_b_groups) == 1
    assert "Alt bundle" in drug_b_groups[0].usages[0].path_label

    sparse_tree = {
        "_id": ObjectId(),
        "rate": 1.0,
        "size": 100.0,
        "node_type": "characteristic",
        "characteristic_data": {
            "_id": ObjectId(),
            "type": "Population",
            "name": "Iran",
        },
        "children": [
            {
                "_id": ObjectId(),
                "rate": 1.0,
                "size": 10.0,
                "node_type": "treatment",
                "treatment_data": {
                    "_id": tree["children"][0]["children"][0]["treatment_data"]["_id"],
                    "name": "Alt bundle",
                    "type": "Alternative",
                },
                "children": [],
            }
        ],
    }
    master_cache = {
        str(sparse_tree["children"][0]["treatment_data"]["_id"]): tree["children"][0][
            "children"
        ][0]["treatment_data"],
    }
    assert _count_drug_hits_in_tree(
        sparse_tree, normalize_object_id(drug_b), master_cache
    ) == 1

    print("catalog_references self-test: ok")
    print(f"  char hits in demo tree: 1")
    print(f"  drug_a embed hits: 2, navigation usages: 1")


if __name__ == "__main__":
    if __package__ is None:
        print(
            "Run from project root: PYTHONPATH=. python -m utils.catalog_references",
            file=sys.stderr,
        )
        sys.exit(2)
    _run_self_test()
