# services/catalog_sync.py
"""Propagate catalog master updates into patient embeds (docs/CATALOG_SYNC.md)."""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from typing import Any, Callable, Optional

from bson import ObjectId

from models.characteristic.driver import CharacteristicDriver
from models.drug.driver import DrugDriver
from models.patient.driver import PatientDriver
from models.tables import (
    AlternativeTreatment,
    DrugEmbedded,
    PatientTree,
    Regimen,
    Treatment,
    TreatmentDrug,
    TreatmentEmbedded,
)
from models.treatment.driver import TreatmentDriver
from utils.tree_traversal import (
    _get_field,
    extract_node_catalog_ids,
    normalize_object_id,
    walk_tree,
)
from utils.utils import Utils

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SyncResult:
    patients_updated: int
    nodes_updated: int
    treatments_updated: int = 0


class CatalogSyncError(Exception):
    """Propagation failed; may include partial progress before the failing persist."""

    def __init__(
        self,
        message: str,
        *,
        partial: Optional[SyncResult] = None,
        revert_failed: bool = False,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.partial = partial
        self.revert_failed = revert_failed


def _sync_log(event: str, level: int = logging.INFO, **fields: Any) -> None:
    extra = {"catalog_sync_event": event, **fields}
    logger.log(level, "catalog_sync.%s", event, extra=extra)


def _result_fields(result: Optional[SyncResult]) -> dict[str, Any]:
    if result is None:
        return {}
    return {
        "patients_updated": result.patients_updated,
        "nodes_updated": result.nodes_updated,
        "treatments_updated": result.treatments_updated,
    }


def catalog_put_after_master_update(
    *,
    entity_type: str,
    entity_id: Any,
    persist_master: Callable[[], None],
    restore_master: Callable[[], None],
    run_sync: Callable[[], SyncResult],
    user_error: str,
) -> SyncResult:
    """
    Master-first PUT policy (docs/CATALOG_SYNC.md): save master, sync embeds, on
    failure roll back master and re-run sync to revert partial embed updates.
    """
    catalog_id = str(entity_id)
    _sync_log(
        "sync_start",
        catalog_entity=entity_type,
        catalog_id=catalog_id,
    )
    persist_master()
    try:
        result = run_sync()
    except CatalogSyncError as exc:
        _sync_log(
            "sync_failed",
            level=logging.ERROR,
            catalog_entity=entity_type,
            catalog_id=catalog_id,
            error=str(exc),
            **_result_fields(exc.partial),
        )
        restore_master()
        _sync_log(
            "sync_revert_start",
            catalog_entity=entity_type,
            catalog_id=catalog_id,
        )
        try:
            revert_result = run_sync()
        except Exception as revert_exc:
            _sync_log(
                "sync_revert_failed",
                level=logging.ERROR,
                catalog_entity=entity_type,
                catalog_id=catalog_id,
                error=str(revert_exc),
                **_result_fields(
                    revert_exc.partial
                    if isinstance(revert_exc, CatalogSyncError)
                    else None
                ),
            )
            raise CatalogSyncError(
                f"{user_error} (master rolled back; embed revert failed)",
                partial=exc.partial,
                revert_failed=True,
            ) from revert_exc
        _sync_log(
            "sync_revert_complete",
            catalog_entity=entity_type,
            catalog_id=catalog_id,
            **_result_fields(revert_result),
        )
        raise CatalogSyncError(user_error, partial=exc.partial) from exc
    except Exception as exc:
        wrapped = CatalogSyncError(
            f"{user_error} ({exc})",
            partial=getattr(exc, "partial", None),
        )
        _sync_log(
            "sync_failed",
            level=logging.ERROR,
            catalog_entity=entity_type,
            catalog_id=catalog_id,
            error=str(exc),
            **_result_fields(wrapped.partial),
        )
        restore_master()
        _sync_log(
            "sync_revert_start",
            catalog_entity=entity_type,
            catalog_id=catalog_id,
        )
        try:
            revert_result = run_sync()
            _sync_log(
                "sync_revert_complete",
                catalog_entity=entity_type,
                catalog_id=catalog_id,
                **_result_fields(revert_result),
            )
        except Exception as revert_exc:
            _sync_log(
                "sync_revert_failed",
                level=logging.ERROR,
                catalog_entity=entity_type,
                catalog_id=catalog_id,
                error=str(revert_exc),
            )
            raise CatalogSyncError(
                f"{user_error} (master rolled back; embed revert failed)",
                revert_failed=True,
            ) from revert_exc
        raise wrapped from exc

    _sync_log(
        "sync_complete",
        catalog_entity=entity_type,
        catalog_id=catalog_id,
        **_result_fields(result),
    )
    return result


def log_catalog_delete_blocked(
    entity_type: str,
    entity_id: Any,
    refs: Any,
) -> None:
    """Structured log when DELETE is rejected due to references."""
    _sync_log(
        "delete_blocked",
        catalog_entity=entity_type,
        catalog_id=str(entity_id),
        patients=refs.patient_count,
        nodes=refs.node_count,
        treatments=refs.treatment_count,
    )


def catalog_sync_failure_details(exc: CatalogSyncError) -> list[str]:
    details: list[str] = []
    if exc.partial is not None:
        p = exc.partial
        details.append(
            "partial_sync "
            f"patients_updated={p.patients_updated} "
            f"nodes_updated={p.nodes_updated} "
            f"treatments_updated={p.treatments_updated}"
        )
    if exc.revert_failed:
        details.append(
            "embed_revert_failed after master rollback; "
            "some patient/treatment embeds may still reflect the attempted update"
        )
    return details


def _persist_patient_tree(
    patient: PatientTree,
    *,
    entity_type: str,
    catalog_id: str,
) -> None:
    """Recompute tree_hash and persist embed patches via PatientDriver.update."""
    try:
        patient.tree_hash = Utils.compute_tree_hash(patient.tree)
        PatientDriver.update(patient)
    except Exception as exc:
        raise CatalogSyncError(
            f"Failed to persist patient tree {patient.id}: {exc}",
        ) from exc
    _sync_log(
        "sync_patient_persisted",
        catalog_entity=entity_type,
        catalog_id=catalog_id,
        patient_id=str(patient.id),
    )


def _persist_master_treatment(
    treatment: Treatment,
    *,
    catalog_id: str,
) -> None:
    try:
        _recompute_treatment_hash(treatment)
        TreatmentDriver.update(treatment)
    except Exception as exc:
        raise CatalogSyncError(
            f"Failed to persist master treatment {treatment.id}: {exc}",
        ) from exc
    _sync_log(
        "sync_treatment_master_persisted",
        catalog_entity="drug",
        catalog_id=catalog_id,
        treatment_id=str(treatment.id),
    )


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
    characteristic_data embed, then recompute tree_hash and PatientDriver.update each
    affected PatientTree.
    """
    char_oid = normalize_object_id(char_id)
    catalog_id = str(char_oid)
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
        partial = SyncResult(
            patients_updated=patients_updated,
            nodes_updated=nodes_updated,
        )
        try:
            _persist_patient_tree(
                patient,
                entity_type="characteristic",
                catalog_id=catalog_id,
            )
        except CatalogSyncError as exc:
            raise CatalogSyncError(exc.message, partial=partial) from exc
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
    catalog_id = str(drug_oid)
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
        partial = SyncResult(
            patients_updated=patients_updated,
            nodes_updated=nodes_updated,
            treatments_updated=treatments_updated,
        )
        try:
            _persist_patient_tree(
                patient,
                entity_type="drug",
                catalog_id=catalog_id,
            )
        except CatalogSyncError as exc:
            raise CatalogSyncError(exc.message, partial=partial) from exc
        patients_updated += 1

    for treatment in Treatment.objects.only(
        "id", "name", "type", "regimen", "alternatives"
    ):
        patched = _sync_drug_in_treatment_body(
            treatment, drug_oid, sync_name, sync_strength, sync_unit
        )
        if not patched:
            continue
        nodes_updated += patched
        partial = SyncResult(
            patients_updated=patients_updated,
            nodes_updated=nodes_updated,
            treatments_updated=treatments_updated,
        )
        try:
            _persist_master_treatment(treatment, catalog_id=catalog_id)
        except CatalogSyncError as exc:
            raise CatalogSyncError(exc.message, partial=partial) from exc
        treatments_updated += 1

    return SyncResult(
        patients_updated=patients_updated,
        nodes_updated=nodes_updated,
        treatments_updated=treatments_updated,
    )


def _copy_regimen(regimen: Any) -> Optional[Regimen]:
    if regimen is None:
        return None
    drugs = []
    for item in _get_field(regimen, "drugs") or []:
        drug_embed = _get_field(item, "drug")
        drugs.append(
            TreatmentDrug(
                drug=DrugEmbedded(
                    _id=_get_field(drug_embed, "_id"),
                    name=_get_field(drug_embed, "name"),
                    strength=_get_field(drug_embed, "strength"),
                    unit=_get_field(drug_embed, "unit"),
                ),
                annual_patient_con=_get_field(item, "annual_patient_con"),
            )
        )
    return Regimen(drugs=drugs)


def _copy_alternatives(alternatives: Any) -> Optional[list]:
    if not alternatives:
        return None
    copied = []
    for alt in alternatives:
        copied.append(
            AlternativeTreatment(
                _id=_get_field(alt, "_id"),
                name=_get_field(alt, "name"),
                regimen=_copy_regimen(_get_field(alt, "regimen")),
                ratio=_get_field(alt, "ratio"),
            )
        )
    return copied


def treatment_embedded_from_master(master: Treatment) -> TreatmentEmbedded:
    """Full TreatmentEmbedded snapshot from a master Treatment document."""
    return TreatmentEmbedded(
        _id=master.id,
        name=master.name,
        type=master.type,
        regimen=_copy_regimen(master.regimen),
        alternatives=_copy_alternatives(master.alternatives),
    )


def _sync_treatment_in_tree(tree: Any, treatment_id: ObjectId, master: Treatment) -> int:
    updated = 0
    for visit in walk_tree(tree):
        if visit.node_type != "treatment":
            continue
        ids = extract_node_catalog_ids(visit.node)
        if ids.treatment_id != treatment_id:
            continue
        visit.node.treatment_data = treatment_embedded_from_master(master)
        updated += 1
    return updated


def sync_treatment(treatment_id: Any) -> SyncResult:
    """
    Replace treatment_data embeds that reference the master Treatment _id with a
    fresh snapshot from the master document; recompute tree_hash per patient.
    """
    treat_oid = normalize_object_id(treatment_id)
    catalog_id = str(treat_oid)
    master = TreatmentDriver.find(id=treat_oid).first()
    if master is None:
        raise ValueError(f"Treatment not found: {treatment_id}")

    patients_updated = 0
    nodes_updated = 0

    for patient in PatientTree.objects.only("id", "tree"):
        tree = patient.tree
        if tree is None:
            continue
        patched = _sync_treatment_in_tree(tree, treat_oid, master)
        if not patched:
            continue
        nodes_updated += patched
        partial = SyncResult(
            patients_updated=patients_updated,
            nodes_updated=nodes_updated,
        )
        try:
            _persist_patient_tree(
                patient,
                entity_type="treatment",
                catalog_id=catalog_id,
            )
        except CatalogSyncError as exc:
            raise CatalogSyncError(exc.message, partial=partial) from exc
        patients_updated += 1

    return SyncResult(
        patients_updated=patients_updated,
        nodes_updated=nodes_updated,
    )
