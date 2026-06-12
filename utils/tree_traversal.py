# utils/tree_traversal.py
"""DFS traversal and catalog id extraction for patient Node trees (docs/CATALOG_SYNC.md)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterator, Optional, Sequence, Tuple

from bson import ObjectId

TreePath = Tuple[int, ...]


def normalize_object_id(value: Any) -> ObjectId:
    """Convert str or ObjectId to ObjectId for consistent catalog comparisons."""
    if isinstance(value, ObjectId):
        return value
    if isinstance(value, str):
        if not value:
            raise ValueError("ObjectId string cannot be empty")
        return ObjectId(value)
    if value is None:
        raise ValueError("ObjectId value cannot be None")
    try:
        return ObjectId(value)
    except Exception as exc:
        raise ValueError(f"Invalid ObjectId: {value!r}") from exc


def _get_field(obj: Any, name: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


@dataclass(frozen=True)
class TreeWalkItem:
    """One node visit during a depth-first walk."""

    node: Any
    node_id: ObjectId
    node_type: str
    path: TreePath


@dataclass(frozen=True)
class NodeCatalogIds:
    """Master catalog ids referenced by a single tree node."""

    characteristic_id: Optional[ObjectId] = None
    treatment_id: Optional[ObjectId] = None
    drug_ids: Tuple[ObjectId, ...] = ()


def drug_ids_from_regimen(regimen: Any) -> list[ObjectId]:
    """Collect drug._id from a Regimen embed (dict or MongoEngine)."""
    if regimen is None:
        return []
    ids: list[ObjectId] = []
    for item in _get_field(regimen, "drugs") or []:
        drug_embed = _get_field(item, "drug")
        if drug_embed is None:
            continue
        raw_id = _get_field(drug_embed, "_id")
        if raw_id is not None:
            ids.append(normalize_object_id(raw_id))
    return ids


def drug_ids_from_treatment_embedded(treatment_data: Any) -> list[ObjectId]:
    """
    All drug._id values under treatment_data.regimen and
    treatment_data.alternatives[].regimen (TreatmentEmbedded shape).
    """
    if treatment_data is None:
        return []
    ids = drug_ids_from_regimen(_get_field(treatment_data, "regimen"))
    for alt in _get_field(treatment_data, "alternatives") or []:
        ids.extend(drug_ids_from_regimen(_get_field(alt, "regimen")))
    return ids


def extract_node_catalog_ids(node: Any) -> NodeCatalogIds:
    """
    Catalog master ids carried by one Node:
    - characteristic: characteristic_data._id
    - treatment: treatment_data._id plus nested drug ids
    - followup: none (out of catalog sync v1)
    """
    node_type = _get_field(node, "node_type")
    characteristic_id: Optional[ObjectId] = None
    treatment_id: Optional[ObjectId] = None
    drug_ids: Tuple[ObjectId, ...] = ()

    if node_type == "characteristic":
        char_data = _get_field(node, "characteristic_data")
        if char_data is not None:
            characteristic_id = normalize_object_id(_get_field(char_data, "_id"))
    elif node_type == "treatment":
        treatment_data = _get_field(node, "treatment_data")
        if treatment_data is not None:
            treatment_id = normalize_object_id(_get_field(treatment_data, "_id"))
            drug_ids = tuple(drug_ids_from_treatment_embedded(treatment_data))

    return NodeCatalogIds(
        characteristic_id=characteristic_id,
        treatment_id=treatment_id,
        drug_ids=drug_ids,
    )


def walk_tree(node: Any, path: TreePath = ()) -> Iterator[TreeWalkItem]:
    """
    Depth-first traversal from a root Node (MongoEngine embed or dict-shaped).

    path is a tuple of child indices from the root, e.g. () for root, (0, 2) for
    the third child of the first child.
    """
    if node is None:
        return

    node_id = normalize_object_id(_get_field(node, "_id"))
    node_type = _get_field(node, "node_type")
    if node_type is None:
        raise ValueError("Node is missing node_type")

    yield TreeWalkItem(
        node=node,
        node_id=node_id,
        node_type=node_type,
        path=path,
    )

    for index, child in enumerate(_get_field(node, "children") or []):
        yield from walk_tree(child, path + (index,))


def _demo_tree() -> dict:
    drug_a = ObjectId()
    drug_b = ObjectId()
    char_master = ObjectId()
    treat_master = ObjectId()

    return {
        "_id": ObjectId(),
        "rate": 1.0,
        "size": 100.0,
        "node_type": "characteristic",
        "characteristic_data": {
            "_id": char_master,
            "type": "Population",
            "name": "Iran",
        },
        "children": [
            {
                "_id": ObjectId(),
                "rate": 0.5,
                "size": 50.0,
                "node_type": "treatment",
                "treatment_data": {
                    "_id": treat_master,
                    "name": "Line 1",
                    "type": "Regimen",
                    "regimen": {
                        "drugs": [
                            {
                                "drug": {
                                    "_id": drug_a,
                                    "name": "Carboplatin",
                                    "strength": 450,
                                    "unit": "mg",
                                },
                                "annual_patient_con": 10,
                            },
                            {
                                "drug": {
                                    "_id": drug_a,
                                    "name": "Carboplatin",
                                    "strength": 450,
                                    "unit": "mg",
                                },
                                "annual_patient_con": 5,
                            },
                        ]
                    },
                },
                "children": [
                    {
                        "_id": ObjectId(),
                        "rate": 1.0,
                        "size": 10.0,
                        "node_type": "treatment",
                        "treatment_data": {
                            "_id": ObjectId(),
                            "name": "Alt bundle",
                            "type": "Alternative",
                            "alternatives": [
                                {
                                    "_id": ObjectId(),
                                    "name": "Alt A",
                                    "priority": 1,
                                    "ratio": 0.5,
                                    "regimen": {
                                        "drugs": [
                                            {
                                                "drug": {
                                                    "_id": drug_b,
                                                    "name": "Gemcitabine",
                                                    "strength": 1,
                                                    "unit": "g",
                                                },
                                                "annual_patient_con": 3,
                                            }
                                        ]
                                    },
                                }
                            ],
                        },
                        "children": [],
                    }
                ],
            }
        ],
    }


def _run_self_test() -> None:
    tree = _demo_tree()
    visits = list(walk_tree(tree))
    assert len(visits) == 3, f"expected 3 nodes, got {len(visits)}"
    assert visits[0].path == ()
    assert visits[1].path == (0,)
    assert visits[2].path == (0, 0)

    root_ids = extract_node_catalog_ids(visits[0].node)
    assert root_ids.characteristic_id == normalize_object_id(
        tree["characteristic_data"]["_id"]
    )
    assert root_ids.treatment_id is None
    assert root_ids.drug_ids == ()

    regimen_ids = extract_node_catalog_ids(visits[1].node)
    assert len(regimen_ids.drug_ids) == 2
    assert regimen_ids.drug_ids[0] == regimen_ids.drug_ids[1]

    alt_ids = extract_node_catalog_ids(visits[2].node)
    assert len(alt_ids.drug_ids) == 1

    assert normalize_object_id(str(drug_a := regimen_ids.drug_ids[0])) == drug_a
    assert ObjectId("507f1f77bcf86cd799439011") == normalize_object_id(
        "507f1f77bcf86cd799439011"
    )

    print("tree_traversal self-test: ok")
    print(f"  nodes visited: {len(visits)}")
    for item in visits:
        ids = extract_node_catalog_ids(item.node)
        print(
            f"  path={item.path} type={item.node_type} "
            f"char={ids.characteristic_id} treat={ids.treatment_id} "
            f"drugs={len(ids.drug_ids)}"
        )


if __name__ == "__main__":
    _run_self_test()
