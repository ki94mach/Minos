# utils/business_rules.py

from bson import ObjectId
import logging

# Import your document models for lookups
from models.tables import Drug, Characteristic, Treatment

def to_title_format(value: str) -> str:
    """
    Converts a string to title case unless it is an abbreviation (i.e. all uppercase).
    """
    if not value:
        return value
    # If the string is already all uppercase, assume it is an abbreviation
    return value if value.isupper() else value.title()

def validate_and_transform_drug(drug_data: dict) -> dict:
    """
    Validate that the Drug referenced by its _id exists.
    Transform the 'name' field to title format.
    """
    drug_id = drug_data.get('_id')
    if not drug_id:
        raise ValueError("Drug data must include an '_id' field.")
    
    # Look up the drug in the database
    drug = Drug.objects(id=ObjectId(drug_id)).first()
    if not drug:
        raise ValueError(f"Drug with _id {drug_id} not found.")
    
    if 'name' in drug_data:
        drug_data['name'] = to_title_format(drug_data['name'])
    
    return drug_data

def validate_and_transform_characteristic(characteristic_data: dict) -> dict:
    """
    Validate that the characteristic referenced by its _id exists.
    Transform the 'name' and 'char_type' fields to title format.
    """
    char_id = characteristic_data.get('_id')
    if not char_id:
        raise ValueError("Characteristic data must include an '_id' field.")
    
    characteristic = Characteristic.objects(id=ObjectId(char_id)).first()
    if not characteristic:
        raise ValueError(f"Characteristic with _id {char_id} not found.")
    
    if 'name' in characteristic_data:
        characteristic_data['name'] = to_title_format(characteristic_data['name'])
    if 'char_type' in characteristic_data:
        characteristic_data['char_type'] = to_title_format(characteristic_data['char_type'])
    
    return characteristic_data

def validate_and_transform_treatment_embedded(treatment_data: dict) -> dict:
    """
    Validate that the treatment referenced by its _id exists.
    Transform the 'name' and 'type' fields to title format.
    """
    treatment_id = treatment_data.get('_id')
    if not treatment_id:
        raise ValueError("Treatment data must include an '_id' field.")
    
    treatment = Treatment.objects(id=ObjectId(treatment_id)).first()
    if not treatment:
        raise ValueError(f"Treatment with _id {treatment_id} not found.")
    
    if 'name' in treatment_data:
        treatment_data['name'] = to_title_format(treatment_data['name'])
    if 'type' in treatment_data:
        treatment_data['type'] = to_title_format(treatment_data['type'])
    
    return treatment_data

def process_node_payload(node_payload: dict) -> dict:
    """
    Process an incoming node payload and apply validations/transformations
    to its embedded data based on its node_type.
    """
    node_type = node_payload.get('node_type')
    if node_type == "characteristic" and "characteristic_data" in node_payload:
        node_payload["characteristic_data"] = validate_and_transform_characteristic(
            node_payload["characteristic_data"]
        )
    elif node_type == "treatment" and "treatment_data" in node_payload:
        node_payload["treatment_data"] = validate_and_transform_treatment_embedded(
            node_payload["treatment_data"]
        )
    # Add similar processing if you later need to handle followup data, etc.
    return node_payload
