# utils/business_rules.py
from bson import ObjectId
from typing import Optional


def to_title_format(value: str) -> str:
    """Convert a string to title case, handling None values."""
    if value is None:
        return None
    return value.strip().title()

def validate_non_empty(value: str, field_name: str) -> str:
    """Common validation for non-empty string fields."""
    if not value or not value.strip():
        raise ValueError(f"{field_name} must not be empty")
    return value.strip()

def validate_optional_string(value: Optional[str], field_name: str) -> Optional[str]:
    """Common validation for optional string fields."""
    if value is not None:
        return validate_non_empty(value, field_name)
    return value

def validate_rate(rate: float) -> float:
    """Validate that a rate is between 0 and 1."""
    if not isinstance(rate, (int, float)) or not (0 <= rate <= 1):
        raise ValueError("Rate must be a number between 0 and 1")
    return rate

def validate_size(size: float) -> float:
    """Validate that a size is positive."""
    if not isinstance(size, (int, float)) or size <= 0:
        raise ValueError("Size must be a positive number")
    return size

def validate_strength(strength: int) -> int:
    """Validate that a strength value is positive."""
    if not isinstance(strength, int) or strength <= 0:
        raise ValueError("Strength must be a positive integer")
    return strength

def validate_unit(unit: str, allowed_units: list) -> str:
    """Validate that a unit is in the allowed list."""
    if unit not in allowed_units:
        raise ValueError(f"Unit must be one of {allowed_units}")
    return unit.lower()

def validate_and_transform_drug(drug_data: dict) -> dict:
    """
    Validate that the drug referenced by its _id exists.
    Transform the 'name' to title format and normalize unit case.
    """
    drug_id = drug_data.get('_id') or drug_data.pop('id', None)
    if not drug_id:
        raise ValueError("Drug data must include an '_id' field.")
    
    from models.drug.driver import DrugDriver
    drug = DrugDriver.find(id=ObjectId(drug_id)).first()
    if not drug:
        raise ValueError(f"Drug with _id {drug_id} not found.")
    
    if 'name' in drug_data:
        drug_data['name'] = to_title_format(drug_data['name'])
    if 'unit' in drug_data:
        drug_data['unit'] = drug_data['unit'].lower()

    if drug_data.get('name') != drug.name:
        raise ValueError("Name does not match the database record")
    if drug_data.get('strength') != drug.strength:
        raise ValueError("Strength does not match the database record")
    if drug_data.get('unit') != drug.unit:
        raise ValueError("Unit does not match the database record")
    
    return drug_data

def validate_and_transform_characteristic(characteristic_data: dict) -> dict:
    """
    Validate that the characteristic referenced by its _id exists.
    Transform the 'name' and 'char_type' fields to title format.
    """
    char_id = characteristic_data.get('_id')
    if not char_id:
        raise ValueError("Characteristic data must include an '_id' field.")
    
    from models.characteristic.driver import CharacteristicDriver
    characteristic = CharacteristicDriver.find(id=ObjectId(char_id)).first()
    if not characteristic:
        raise ValueError(f"Characteristic with _id {char_id} not found.")
    
    if 'name' in characteristic_data:
        characteristic_data['name'] = to_title_format(characteristic_data['name'])
    if 'char_type' in characteristic_data:
        characteristic_data['char_type'] = to_title_format(characteristic_data['char_type'])

    if characteristic_data.get('name') != characteristic.name:
        raise ValueError("Name does not match the database record")
    if characteristic_data.get('char_type') != characteristic.char_type:
        raise ValueError("Type does not match the database record")
    
    return characteristic_data

def validate_and_transform_treatment_embedded(treatment_data: dict) -> dict:
    """
    Validate that the treatment referenced by its _id exists.
    Transform the 'name' to title format and validate type.
    """
    treatment_id = treatment_data.get('_id')
    if not treatment_id:
        raise ValueError("Treatment data must include an '_id' field.")
    
    from models.treatment.driver import TreatmentDriver
    treatment = TreatmentDriver.find(id=ObjectId(treatment_id)).first()
    if not treatment:
        raise ValueError(f"Treatment with _id {treatment_id} not found.")
    
    if 'name' in treatment_data:
        treatment_data['name'] = to_title_format(treatment_data['name'])
    
    if 'type' in treatment_data:
        if treatment_data['type'] not in ['Treatment', 'Regimen', 'Alternative']:
            raise ValueError("Treatment type must be one of: Treatment, Regimen, Alternative")
    
    if treatment_data.get('name') != treatment.name:
        raise ValueError("Name does not match the database record")
    if treatment_data.get('type') != treatment.type:
        raise ValueError("Type does not match the database record")
    
    if treatment_data.get('regimen'):
        if treatment.type != 'Regimen':
            raise ValueError("Regimen can only be present for treatment type 'Regimen'")
        db_map = {
            str(item.drug._id): item.annual_patient_con
            for item in treatment.regimen.drugs
        }

        if len(db_map) != len(treatment_data['regimen']["drugs"]):
            raise ValueError("Number of drugs in payload does not match database record")

        for item in treatment_data['regimen']["drugs"]:
            drug_id = str(item["drug"]["_id"])
            db_val = db_map.get(drug_id)
            if db_val is None:
                raise ValueError(f"Drug {drug_id} not found in treatment {treatment_id}")

            if item["annual_patient_con"] != db_val:
                raise ValueError(
                    f"annual_patient_con mismatch for drug {drug_id}: "
                    f"{item['annual_patient_con']} (payload) ≠ {db_val} (DB)"
                )
    
    if treatment_data['alternatives']:
        if treatment.type != 'Alternative':
            raise ValueError("Alternatives can only be present for treatment type 'Alternative'")
        db_map = { str(alt._id): alt.ratio for alt in treatment.alternatives }
        payload_map = { str(alt['_id']): alt['ratio'] for alt in treatment_data['alternatives'] }
        # compare IDs
        if set(db_map) != set(payload_map):
            raise ValueError(
                f"Alternatives mismatch: DB has {set(db_map)}, payload has {set(payload_map)}"
            )

        for alt_id in db_map:
            if payload_map[alt_id] != db_map[alt_id]:
                raise ValueError(
                    f"Ratio mismatch for alternative {alt_id}: "
                    f"{payload_map[alt_id]} (payload) ≠ {db_map[alt_id]} (DB)"
                )
    return treatment_data

def validate_and_transform_followup_embedded(followup_data: dict) -> dict:
    """
    Validate that the followup referenced by its _id exists.
    Transform the name field and validate overall_survival value.
    """
    followup_id = followup_data.get('_id')
    if not followup_id:
        raise ValueError("Followup data must include an '_id' field.")
    
    from models.followup.driver import FollowupDriver
    followup = FollowupDriver.find(id=ObjectId(followup_id)).first()
    if not followup:
        raise ValueError(f"Followup with _id {followup_id} not found.")
    
    if 'overall_survival' in followup_data:
        overall_survival = followup_data['overall_survival']
        if not isinstance(overall_survival, (int, float)) or not (0 <= overall_survival <= 1):
            raise ValueError("Overall survival must be a number between 0 and 1")
        if float(overall_survival) != float(followup.overall_survival):
            raise ValueError("Overall survival does not match the database record")

    if 'name' in followup_data:
        payload_name = followup_data['name'].strip()
        if payload_name != followup.name:
            raise ValueError("Name does not match the database record")

    return followup_data

def validate_and_transform_alternative(alternative_data: dict) -> dict:
    """
    Validate that the alternative treatment referenced by its _id exists.
    Transform the fields and validate against database record.
    """
    alt_id = alternative_data.get('_id')
    if not alt_id:
        raise ValueError("Alternative treatment data must include an '_id' field.")
    
    from models.treatment.driver import TreatmentDriver
    treatment = TreatmentDriver.find(id=ObjectId(alt_id)).first()
    if not treatment:
        raise ValueError(f"Treatment with _id {alt_id} not found.")
    
    ratio = alternative_data.get("ratio")
    if not isinstance(ratio, (int, float)):
        raise ValueError(f"Ratio must be a number, got {ratio!r}")
    
    if treatment.type != 'Regimen':
        raise ValueError(f"Referenced treatment must be of type 'Regimen', got {treatment.type}")
    
    if 'name' in alternative_data:
        alternative_data['name'] = to_title_format(alternative_data['name'])
    
    if alternative_data.get('name') != treatment.name:
        raise ValueError("Name does not match the database record")
    
    if 'regimen' in alternative_data:
        if not treatment.regimen:
            raise ValueError("Referenced treatment must have a regimen")
            
        regimen_data = alternative_data['regimen']
        db_map = {
            str(item.drug._id): item.annual_patient_con
            for item in treatment.regimen.drugs
        }

        if len(db_map) != len(regimen_data["drugs"]):
            raise ValueError("Number of drugs in payload does not match database record")

        for item in regimen_data["drugs"]:
            drug_id = str(item["drug"]["_id"])
            db_val = db_map.get(drug_id)
            if db_val is None:
                raise ValueError(f"Drug {drug_id} not found in treatment {alt_id}")

            if item["annual_patient_con"] != db_val:
                raise ValueError(
                    f"annual_patient_con mismatch for drug {drug_id}: "
                    f"{item['annual_patient_con']} (payload) ≠ {db_val} (DB)"
                )
        

        # for drug_item in alternative_data['regimen'].get('drugs', []):
        #     if 'drug' in drug_item:
        #         drug_item['drug'] = validate_and_transform_drug(drug_item['drug'])
    
    return alternative_data

def validate_regimen_consistency(
        regimen_data: dict,
        treatment_id: Optional[str] = None
) -> None:
    """
    • If *treatment_id* is supplied, compare the payload’s
      `annual_patient_con` values with the authoritative
      regimen that is stored inside that Treatment document.

    • If no *treatment_id* is given (e.g. you are creating a brand‑new
      Regimen treatment), we only make sure the numbers are positive.

    NOTE: Drug attributes (name, strength, unit) are **already**
          guaranteed by DrugSubItem, so we do **not** re‑check them here.
    """
    if treatment_id:
        from models.treatment.driver import TreatmentDriver

        treatment = TreatmentDriver.find(id=ObjectId(treatment_id)).first()
        if not treatment:
            raise ValueError(f"Treatment with _id {treatment_id} not found")

        if not treatment.regimen:
            raise ValueError("Referenced treatment does not contain a regimen")

        db_map = {
            str(item.drug._id): item.annual_patient_con
            for item in treatment.regimen.drugs
        }

        if len(db_map) != len(regimen_data["drugs"]):
            raise ValueError("Number of drugs in payload does not match database record")

        for item in regimen_data["drugs"]:
            drug_id = str(item["drug"]["_id"])
            db_val = db_map.get(drug_id)
            if db_val is None:
                raise ValueError(f"Drug {drug_id} not found in treatment {treatment_id}")

            if item["annual_patient_con"] != db_val:
                raise ValueError(
                    f"annual_patient_con mismatch for drug {drug_id}: "
                    f"{item['annual_patient_con']} (payload) ≠ {db_val} (DB)"
                )

        return
    
    for item in regimen_data["drugs"]:
        apc = item["annual_patient_con"]
        if not isinstance(apc, int) or apc <= 0:
            raise ValueError("annual_patient_con must be a positive integer")

FOLLOWUP_PARENT_ERROR = (
    "Follow-up nodes must be under a treatment node"
)


def validate_followup_treatment_parentage(root) -> None:
    """
    Ensure every followup node is a direct child of a treatment node.
    Raises ValueError with FOLLOWUP_PARENT_ERROR when the rule is violated.
    """
    def walk(parent):
        for child in getattr(parent, "children", []) or []:
            if getattr(child, "node_type", None) == "followup":
                if getattr(parent, "node_type", None) != "treatment":
                    raise ValueError(FOLLOWUP_PARENT_ERROR)
            walk(child)

    walk(root)


def remove_node(node, target_id) -> bool:
    """
    Remove a non-root node from an embedded patient tree by splicing.

    Locates the direct child whose _id matches target_id, promotes that child's
    children into node's children list, and sets each promoted child's parent_id
    to node._id. Recurses into descendants when the target is deeper.

    Args:
        node: Subtree root to search (typically the patient tree root).
        target_id: _id of the node to remove (ObjectId or str).

    Returns:
        True if the target was found and removed, False otherwise.
    """
    target_id = str(target_id)
    new_children = []
    removed = False
    for child in node.children:
        if str(child._id) == target_id:
            removed = True
            for grandchild in child.children:
                grandchild.parent_id = node._id
            new_children.extend(child.children)
        else:
            child_removed = remove_node(child, target_id)
            removed = removed or child_removed
            new_children.append(child)
    node.children = new_children
    return removed


def find_node(node, target_id):
    """
    Recursively find a node with the given target_id in the tree.
    Args:
        node: The root node to start searching from
        target_id: The id of the node to find (as string)
    Returns:
        The found node or None if not found
    """
    if str(node._id) == target_id:
        return node
    for child in node.children:
        found = find_node(child, target_id)
        if found:
            return found
    return None


# ---------------------------------------------------------------------------
# Self-test (PYTHONPATH=. python -m utils.business_rules)
# ---------------------------------------------------------------------------

class _TreeNode:
    """Minimal embedded-node stand-in for offline tree helper tests."""

    def __init__(self, node_id, node_type, children=None, parent_id=None):
        self._id = node_id
        self.node_type = node_type
        self.children = list(children or [])
        self.parent_id = parent_id


def _run_self_test() -> None:
    from bson import ObjectId

    root_id = ObjectId()
    mid_id = ObjectId()
    leaf_id = ObjectId()
    deep_id = ObjectId()
    treat_id = ObjectId()
    fu_id = ObjectId()

    root = _TreeNode(root_id, "characteristic")
    mid = _TreeNode(mid_id, "characteristic", parent_id=root_id)
    leaf = _TreeNode(leaf_id, "characteristic", parent_id=mid_id)
    deep = _TreeNode(deep_id, "characteristic", parent_id=mid_id)
    mid.children = [deep, leaf]
    root.children = [mid]

    assert find_node(root, str(leaf_id)) is leaf
    assert find_node(root, "507f1f77bcf86cd799439099") is None

    assert remove_node(root, str(mid_id)) is True
    assert find_node(root, str(mid_id)) is None
    assert find_node(root, str(deep_id)) is deep
    assert deep.parent_id == root_id
    assert find_node(root, str(leaf_id)) is leaf
    assert leaf.parent_id == root_id
    assert len(root.children) == 2

    assert remove_node(root, "507f1f77bcf86cd799439099") is False

    valid = _TreeNode(
        ObjectId(),
        "characteristic",
        children=[
            _TreeNode(
                treat_id,
                "treatment",
                children=[_TreeNode(fu_id, "followup", parent_id=treat_id)],
            )
        ],
    )
    validate_followup_treatment_parentage(valid)

    invalid = _TreeNode(
        ObjectId(),
        "characteristic",
        children=[_TreeNode(fu_id, "followup")],
    )
    try:
        validate_followup_treatment_parentage(invalid)
        raise AssertionError("expected ValueError for orphan followup")
    except ValueError as exc:
        assert str(exc) == FOLLOWUP_PARENT_ERROR

    print("business_rules self-test: ok")
    print("  find_node, remove_node (splice), validate_followup_treatment_parentage")


if __name__ == "__main__":
    import sys

    if __package__ is None:
        print(
            "Run from project root: PYTHONPATH=. python -m utils.business_rules",
            file=sys.stderr,
        )
        sys.exit(2)
    _run_self_test()
