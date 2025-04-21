# utils/business_rules.py

from bson import ObjectId
import logging
from typing import Optional

# Import your document models for lookups
from models.tables import Drug, Characteristic, Treatment

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
    drug_id = drug_data.get('_id')
    if not drug_id:
        raise ValueError("Drug data must include an '_id' field.")
    
    from models.tables import Drug
    from models.drug.driver import DrugDriver
    drug = DrugDriver.find(id=ObjectId(drug_id)).first()
    if not drug:
        raise ValueError(f"Drug with _id {drug_id} not found.")
    
    if 'name' in drug_data:
        drug_data['name'] = to_title_format(drug_data['name'])
    if 'unit' in drug_data:
        drug_data['unit'] = drug_data['unit'].lower()
    
    # Validate that the transformed data matches the database record
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
    
    from models.tables import Characteristic
    from models.characteristic.driver import CharacteristicDriver
    characteristic = CharacteristicDriver.find(id=ObjectId(char_id)).first()
    if not characteristic:
        raise ValueError(f"Characteristic with _id {char_id} not found.")
    
    if 'name' in characteristic_data:
        characteristic_data['name'] = to_title_format(characteristic_data['name'])
    if 'char_type' in characteristic_data:
        characteristic_data['char_type'] = to_title_format(characteristic_data['char_type'])
    
    # Validate that the transformed data matches the database record
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
    
    from models.tables import Treatment
    from models.treatment.driver import TreatmentDriver
    treatment = TreatmentDriver.find(id=ObjectId(treatment_id)).first()
    if not treatment:
        raise ValueError(f"Treatment with _id {treatment_id} not found.")
    
    if 'name' in treatment_data:
        treatment_data['name'] = to_title_format(treatment_data['name'])
    
    # Validate type if provided
    if 'type' in treatment_data:
        if treatment_data['type'] not in ['Treatment', 'Regimen', 'Alternative']:
            raise ValueError("Treatment type must be one of: Treatment, Regimen, Alternative")
    
    # Validate that the transformed data matches the database record
    if treatment_data.get('name') != treatment.name:
        raise ValueError("Name does not match the database record")
    if treatment_data.get('type') != treatment.type:
        raise ValueError("Type does not match the database record")
    
    # Handle regimen validation if present
    if 'regimen' in treatment_data:
        if treatment.type != 'Regimen':
            raise ValueError("Regimen can only be present for treatment type 'Regimen'")
        for drug_item in treatment_data['regimen'].get('drugs', []):
            if 'drug' in drug_item:
                drug_item['drug'] = validate_and_transform_drug(drug_item['drug'])
    
    # Handle alternatives validation if present
    if 'alternatives' in treatment_data:
        if treatment.type != 'Alternative':
            raise ValueError("Alternatives can only be present for treatment type 'Alternative'")
        for alt in treatment_data['alternatives']:
            if 'regimen' in alt:
                for drug_item in alt['regimen'].get('drugs', []):
                    if 'drug' in drug_item:
                        drug_item['drug'] = validate_and_transform_drug(drug_item['drug'])
    
    return treatment_data

def validate_and_transform_followup_embedded(followup_data: dict) -> dict:
    """
    Validate that the followup referenced by its _id exists.
    Transform the name field and validate overall_survival value.
    """
    followup_id = followup_data.get('_id')
    if not followup_id:
        raise ValueError("Followup data must include an '_id' field.")
    
    from models.tables import Followup
    from models.followup.driver import FollowupDriver
    followup = FollowupDriver.find(id=ObjectId(followup_id)).first()
    if not followup:
        raise ValueError(f"Followup with _id {followup_id} not found.")
    
    if 'name' in followup_data:
        followup_data['name'] = followup_data['name'].strip()
    
    # Validate overall_survival if provided
    if 'overall_survival' in followup_data:
        overall_survival = followup_data['overall_survival']
        if not isinstance(overall_survival, (int, float)) or not (0 <= overall_survival <= 1):
            raise ValueError("Overall survival must be a number between 0 and 1")
    
    # Validate that the transformed data matches the database record
    if followup_data.get('name') != followup.name:
        raise ValueError("Name does not match the database record")
    if followup_data.get('overall_survival') != followup.overall_survival:
        raise ValueError("Overall survival does not match the database record")
    
    return followup_data

def validate_regimen_consistency(regimen: dict) -> None:
    """
    Make sure every DrugSubItem embedded in *regimen* exists in the Drug collection
    and that its name, strength and unit match the authoritative record.

    Raises
    -------
    ValueError  – whenever a drug is missing or one of the attributes differs.
    """

    from models.drug.driver import DrugDriver
    for item in regimen.drugs:
        drug_id = ObjectId(item.drug.id)
        drug = DrugDriver.find(id=drug_id).first()
        if drug is None:
            raise ValueError(f"Drug with _id {drug_id} not found in the database")

        if item.drug.name != drug.name:
            raise ValueError(
                f"Embedded drug name '{item.drug.name}' "
                f"does not match DB value '{drug.name}'"
            )
        if item.drug.strength != drug.strength:
            raise ValueError(
                f"Embedded strength {item.drug.strength} "
                f"does not match DB value {drug.strength}"
            )
        if item.drug.unit.lower() != drug.unit.lower():
            raise ValueError(
                f"Embedded unit '{item.drug.unit}' "
                f"does not match DB value '{drug.unit}'"
            )

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

def process_node_payload(node_payload: dict) -> dict:
    """
    Process an incoming node payload and apply validations/transformations
    to its embedded data based on its node_type.
    
    Args:
        node_payload (dict): The node payload to process, containing node_type and corresponding data
        
    Returns:
        dict: The processed node payload with validated and transformed embedded data
        
    Raises:
        ValueError: If the node_type is invalid or required data is missing
    """
    if not isinstance(node_payload, dict):
        raise ValueError("Node payload must be a dictionary")

    node_type = node_payload.get('node_type')
    if not node_type:
        raise ValueError("Node payload must include node_type")
    
    if node_type not in ['characteristic', 'treatment', 'followup']:
        raise ValueError(f"Invalid node_type: {node_type}")

    # Validate and transform rate if present
    if 'rate' in node_payload:
        rate = node_payload['rate']
        if not isinstance(rate, (int, float)) or not (0 <= rate <= 1):
            raise ValueError("Rate must be a number between 0 and 1")
    
    # Validate and transform size if present
    if 'size' in node_payload:
        size = node_payload['size']
        if not isinstance(size, (int, float)) or size <= 0:
            raise ValueError("Size must be a positive number")

    # Process embedded data based on node type
    if node_type == "characteristic":
        if "characteristic_data" not in node_payload:
            raise ValueError("Characteristic node must include characteristic_data")
        node_payload["characteristic_data"] = validate_and_transform_characteristic(
            node_payload["characteristic_data"]
        )
    elif node_type == "treatment":
        if "treatment_data" not in node_payload:
            raise ValueError("Treatment node must include treatment_data")
        node_payload["treatment_data"] = validate_and_transform_treatment_embedded(
            node_payload["treatment_data"]
        )
    elif node_type == "followup":
        if "followup_data" not in node_payload:
            raise ValueError("Followup node must include followup_data")
        node_payload["followup_data"] = validate_and_transform_followup_embedded(
            node_payload["followup_data"]
        )

    # Process children recursively if present
    if "children" in node_payload:
        if not isinstance(node_payload["children"], list):
            raise ValueError("Children must be a list")
        node_payload["children"] = [
            process_node_payload(child) for child in node_payload["children"]
        ]

    return node_payload

def validate_patient_tree_structure(node: dict, parent_id: str = None) -> None:
    """
    Validate the structure of a patient tree node and its children.
    This includes validating parent-child relationships and embedded data.
    """
    # Validate node type
    node_type = node.get('node_type')
    if node_type not in ['characteristic', 'treatment', 'followup']:
        raise ValueError(f"Invalid node type: {node_type}")
    
    # Validate rate
    rate = node.get('rate')
    if rate is None or not (0 <= rate <= 1):
        raise ValueError("Rate must be between 0 and 1")
    
    # Validate size
    size = node.get('size')
    if size is None or size <= 0:
        raise ValueError("Size must be greater than 0")
    
    # Validate parent_id relationship
    node_parent_id = node.get('parent_id')
    if parent_id:
        if not node_parent_id or str(node_parent_id) != str(parent_id):
            raise ValueError("Invalid parent-child relationship")
    elif node_parent_id:
        raise ValueError("Root node cannot have a parent_id")
    
    # Validate embedded data based on node type
    if node_type == 'characteristic':
        if not node.get('characteristic_data'):
            raise ValueError("Characteristic node must have characteristic_data")
        validate_and_transform_characteristic(node['characteristic_data'])
    elif node_type == 'treatment':
        if not node.get('treatment_data'):
            raise ValueError("Treatment node must have treatment_data")
        validate_and_transform_treatment_embedded(node['treatment_data'])
    elif node_type == 'followup':
        if not node.get('followup_data'):
            raise ValueError("Followup node must have followup_data")
        validate_and_transform_followup_embedded(node['followup_data'])
        # Add followup validation here if needed
    
    # Recursively validate children
    for child in node.get('children', []):
        validate_patient_tree_structure(child, str(node.get('_id')))
