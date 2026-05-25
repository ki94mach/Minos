# services/catalog_sync.py
"""Propagate catalog master updates into patient embeds (docs/CATALOG_SYNC.md)."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any, Optional

from bson import ObjectId

from models.characteristic.driver import CharacteristicDriver
from models.drug.driver import DrugDriver
from models.tables import PatientTree, Treatment
from models.treatment.driver import TreatmentDriver
from utils.tree_traversal import (
    _get_field,
    extract_node_catalog_ids,
    normalize_object_id,
    walk_tree,
)
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


def _recompute_treatment_hash(treatment: Treatment) -> None:
    hash_input = (
        treatment.name
        + treatment.type
        + str(treatment.regimen or "")
        + str(treatment.alternatives or "")
    )
    treatment.treatment_hash = hashlib.sha256(
        hash_input.encode("utf-8")
    ).hexdigest()


def _patch_drug_embed(
    drug_embed: Any,
    drug_id: ObjectId,
    name: str,
    strength: int,
    unit: str,
) -> bool:
    if drug_embed is None:
        return False
    raw_id = _get_field(drug_embed, "_id")
    if raw_id is None or normalize_object_id(raw_id) != drug_id:
        return False
    if isinstance(drug_embed, dict):
        drug_embed["name"] = name
        drug_embed["strength"] = strength
        drug_embed["unit"] = unit
    else:
        drug_embed.name = name
        drug_embed.strength = strength
        drug_embed.unit = unit
    return True


def _sync_drug_in_regimen(
    regimen: Any,
    drug_id: ObjectId,
    name: str,
    strength: int,
    unit: str,
) -> int:
    if regimen is None:
        return 0
    updated = 0
    for item in _get_field(regimen, "drugs") or []:
        drug_embed = _get_field(item, "drug")
        if _patch_drug_embed(drug_embed, drug_id, name, strength, unit):
            updated += 1
    return updated


def _sync_drug_in_treatment_body(
    body: Any,
    drug_id: ObjectId,
    name: str,
    strength: int,
    unit: str,
) -> int:
    """Regimen + alternative regimens on TreatmentEmbedded or master Treatment."""
    updated = _sync_drug_in_regimen(
        _get_field(body, "regimen"), drug_id, name, strength, unit
    )
    for alt in _get_field(body, "alternatives") or []:
        updated += _sync_drug_in_regimen(
            _get_field(alt, "regimen"), drug_id, name, strength, unit
        )
    return updated


def _sync_drug_in_tree(
    tree: Any,
    drug_id: ObjectId,
    name: str,
    strength: int,
    unit: str,
) -> int:
    """Patch DrugEmbedded slots in treatment nodes only; return embed patch count."""
    updated = 0
    for visit in walk_tree(tree):
        if visit.node_type != "treatment":
            continue
        treatment_data = visit.node.treatment_data
        if treatment_data is None:
            continue
        updated += _sync_drug_in_treatment_body(
            treatment_data, drug_id, name, strength, unit
        )
    return updated


def sync_drug(
    drug_id: Any,
    *,
    name: Optional[str] = None,
    strength: Optional[int] = None,
    unit: Optional[str] = None,
) -> SyncResult:
    """
    Copy master drug fields into every matching DrugEmbedded in patient treatment
    trees and master Treatment documents; recompute treatment_hash and tree_hash.
    """
    drug_oid = normalize_object_id(drug_id)
    master = DrugDriver.find(id=drug_oid).first()
    if master is None:
        raise ValueError(f"Drug not found: {drug_id}")

    sync_name = name if name is not None else master.name
    sync_strength = strength if strength is not None else master.strength
    sync_unit = unit if unit is not None else master.unit

    patients_updated = 0
    nodes_updated = 0
    treatments_updated = 0

    for patient in PatientTree.objects.only("id", "tree"):
        tree = patient.tree
        if tree is None:
            continue
        patched = _sync_drug_in_tree(
            tree, drug_oid, sync_name, sync_strength, sync_unit
        )
        if not patched:
            continue
        nodes_updated += patched
        _persist_patient_tree(patient)
        patients_updated += 1

    for treatment in Treatment.objects.only(
        "id", "name", "type", "regimen", "alternatives"
    ):
        patched = _sync_drug_in_treatment_body(
            treatment, drug_oid, sync_name, sync_strength, sync_unit
        )
        if not patched:
            continue
        _recompute_treatment_hash(treatment)
        TreatmentDriver.update(treatment)
        treatments_updated += 1

    return SyncResult(
        patients_updated=patients_updated,
        nodes_updated=nodes_updated,
        treatments_updated=treatments_updated,
    )
