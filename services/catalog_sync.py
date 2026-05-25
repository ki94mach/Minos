# services/catalog_sync.py
"""Propagate catalog master updates into patient embeds (docs/CATALOG_SYNC.md)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from bson import ObjectId

from models.characteristic.driver import CharacteristicDriver
from models.tables import PatientTree
from utils.tree_traversal import extract_node_catalog_ids, normalize_object_id, walk_tree
from utils.utils import Utils


@dataclass(frozen=True)
class SyncResult:
    patients_updated: int
    nodes_updated: int
    treatments_updated: int = 0


def _persist_patient_tree(patient: PatientTree) -> None:
    """Full document replace + tree_hash, matching routes/api.py update_patient."""
    patient.tree_hash = Utils.compute_tree_hash(patient.tree)
    from mongoengine.connection import get_db

    db = get_db()
    db["patients"].replace_one({"_id": patient.id}, patient.to_mongo().to_dict())


def _sync_characteristic_in_tree(
    tree: Any,
    char_id: ObjectId,
    name: str,
    char_type: str,
) -> int:
    """Patch matching characteristic embeds; return number of nodes updated."""
    updated = 0
    for visit in walk_tree(tree):
        if visit.node_type != "characteristic":
            continue
        ids = extract_node_catalog_ids(visit.node)
        if ids.characteristic_id != char_id:
            continue
        char_data = visit.node.characteristic_data
        if char_data is None:
            continue
        char_data.name = name
        char_data.char_type = char_type
        updated += 1
    return updated


def sync_characteristic(
    char_id: Any,
    *,
    name: Optional[str] = None,
    char_type: Optional[str] = None,
) -> SyncResult:
    """
    Copy master characteristic name and type into every matching
    characteristic_data embed, then recompute tree_hash and replace_one each
    affected PatientTree.
    """
    char_oid = normalize_object_id(char_id)
    master = CharacteristicDriver.find(id=char_oid).first()
    if master is None:
        raise ValueError(f"Characteristic not found: {char_id}")

    sync_name = name if name is not None else master.name
    sync_type = char_type if char_type is not None else master.char_type

    patients_updated = 0
    nodes_updated = 0

    for patient in PatientTree.objects.only("id", "tree"):
        tree = patient.tree
        if tree is None:
            continue
        patched = _sync_characteristic_in_tree(tree, char_oid, sync_name, sync_type)
        if not patched:
            continue
        nodes_updated += patched
        _persist_patient_tree(patient)
        patients_updated += 1

    return SyncResult(
        patients_updated=patients_updated,
        nodes_updated=nodes_updated,
    )
