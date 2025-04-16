# routes/api.py
# Import model classes from tables for creating new instances.
from models.tables import (
    Regimen, AlternativeTreatment
)

from flask import Blueprint, jsonify, request
import logging
import hashlib
from bson import ObjectId
from mongoengine.errors import NotUniqueError

# Import driver classes from the appropriate directories
from models.characteristic.driver import CharacteristicDriver
from models.drug.driver import DrugDriver
from models.followup.driver import FollowupDriver
from models.patient.driver import PatientDriver
from models.treatment.driver import TreatmentDriver

# Import model classes from tables for creating new instances.
from models.tables import (Characteristic, Drug, Followup,
                           Treatment, PatientTree)
from models.tables import (Node, CharacteristicEmbedded,
                           TreatmentEmbedded, FollowupEmbedded)

# Import validators and required decorators
from validators.api_validators import (CharacteristicCreate, CharacteristicUpdate,
                                       DrugCreate, DrugUpdate, TreatmentUpdate,
                                       TreatmentCreate, PatientCreate, PatientUpdate,
                                       AddNode, UpdateNode, FollowupUpdate, FollowupCreate)
from utils.validate_request import validate_request
from utils.auth_security import login_required

api_blueprint = Blueprint('api', __name__)


# --------------------------------------------------
# Characteristic Endpoints
# --------------------------------------------------
@api_blueprint.route('/characteristics', methods=['GET'])
@login_required
def get_characteristics():
    try:
        characteristics = CharacteristicDriver.find()
        data = [char.to_json() for char in characteristics]
        return jsonify(data), 200
    except Exception as e:
        logging.error(f"Error fetching characteristics: {e}")
        return jsonify({'error': "Failed to retrieve characteristics."}), 500


@api_blueprint.route('/characteristics', methods=['POST'])
@login_required
@validate_request(CharacteristicCreate, location='json')
def create_characteristic(validated_data):
    """
    Expected JSON body:
    {
      "type": "Primary Indication",
      "name": "Lung Cancer"
    }
    """
    try:
        char_type = validated_data.type
        name = validated_data.name
        if not char_type or not name:
            return jsonify({'error': 'Missing required fields: type and name'}), 400

        # Create the master Characteristic document using the same field names as before.
        char = Characteristic(char_type=char_type, name=name)
        char_id = CharacteristicDriver.insert(char)
        return jsonify({'id': str(char_id)}), 201
    except NotUniqueError:
        logging.error("Duplicate characteristic detected.")
        return jsonify({'error': f"A characteristic with type '{char_type}' and name '{name}' already exists."}), 409
    except Exception as e:
        logging.error(f"Error creating characteristic: {e}")
        return jsonify({'error': "An unexpected error occurred while creating the characteristic."}), 500


@api_blueprint.route('/characteristics/<char_id>', methods=['PUT'])
@login_required
@validate_request(CharacteristicUpdate, location='json')
def update_characteristic(validated_data, char_id):
    """
    Expected JSON body (any subset):
    {
      "type": "updated type",
      "name": "updated name"
    }
    """
    try:
        char = CharacteristicDriver.find(id=char_id).first()
        if not char:
            return jsonify({'error': 'Characteristic not found'}), 404

        if validated_data.type is not None:
            char.char_type = validated_data.type
        if validated_data.name is not None:
            char.name = validated_data.name
        CharacteristicDriver.update(char)
        return jsonify({'message': 'Characteristic updated'}), 200
    except NotUniqueError:
        logging.error("Duplicate characteristic detected during update.")
        return jsonify(
            {'error': "Update failed: A characteristic with the provided type and name already exists."}), 409
    except Exception as e:
        logging.error(f"Error updating characteristic: {e}")
        return jsonify({'error': "An unexpected error occurred while updating the characteristic."}), 500


@api_blueprint.route('/characteristics/<char_id>', methods=['DELETE'])
@login_required
def delete_characteristic(char_id):
    try:
        CharacteristicDriver.delete(char_id)
        return jsonify({'message': 'Characteristic deleted'}), 200
    except Exception as e:
        logging.error(f"Error deleting characteristic: {e}")
        return jsonify({'error': "An unexpected error occurred while deleting the characteristic."}), 500


# --------------------------------------------------
# Drug Endpoints
# --------------------------------------------------
@api_blueprint.route('/drugs', methods=['GET'])
@login_required
def get_drugs():
    try:
        drugs = DrugDriver.find()
        data = [drug.to_json() for drug in drugs]
        return jsonify(data), 200
    except Exception as e:
        logging.error(f"Error fetching drugs: {e}")
        return jsonify({'error': "Failed to retrieve drugs."}), 500


@api_blueprint.route('/drugs', methods=['POST'])
@login_required
@validate_request(DrugCreate, location='json')
def create_drug(validated_data):
    """
    Expected JSON body:
    {
      "name": "Carboplatin",
      "strength": 450,
      "unit": "mg"
    }
    """
    try:
        name = validated_data.name
        strength = validated_data.strength
        unit = validated_data.unit
        if not name or strength is None or not unit:
            return jsonify({'error': 'Missing required fields: name, strength, and unit'}), 400

        drug = Drug(name=name, strength=strength, unit=unit)
        drug_id = DrugDriver.insert(drug)
        return jsonify({'id': str(drug_id)}), 201
    except NotUniqueError:
        logging.error("Duplicate drug detected.")
        return jsonify(
            {'error': f"Drug with name '{name}', strength '{strength}', and unit '{unit}' already exists."}), 409
    except Exception as e:
        logging.error(f"Error creating drug: {e}")
        return jsonify({'error': "An unexpected error occurred while creating the drug."}), 500


@api_blueprint.route('/drugs/<drug_id>', methods=['PUT'])
@login_required
@validate_request(DrugUpdate, location='json')
def update_drug(validated_data, drug_id):
    """
    Expected JSON body (any subset):
    {
      "name": "Updated name",
      "strength": 450,
      "unit": "mg"
    }
    """
    try:
        drug = DrugDriver.find(id=drug_id).first()
        if not drug:
            return jsonify({'error': 'Drug not found'}), 404

        if validated_data.name is not None:
            drug.name = validated_data.name
        if validated_data.strength is not None:
            drug.strength = validated_data.strength
        if validated_data is not None:
            drug.unit = validated_data.unit
        DrugDriver.update(drug)
        return jsonify({'message': 'Drug updated'}), 200
    except NotUniqueError:
        logging.error("Duplicate drug detected during update.")
        return jsonify(
            {'error': "Update failed: A drug with the provided name, strength, and unit already exists."}), 409
    except Exception as e:
        logging.error(f"Error updating drug: {e}")
        return jsonify({'error': "An unexpected error occurred while updating the drug."}), 500


@api_blueprint.route('/drugs/<drug_id>', methods=['DELETE'])
@login_required
def delete_drug(drug_id):
    try:
        DrugDriver.delete(drug_id)
        return jsonify({'message': 'Drug deleted'}), 200
    except Exception as e:
        logging.error(f"Error deleting drug: {e}")
        return jsonify({'error': "An unexpected error occurred while deleting the drug."}), 500


# --------------------------------------------------
# Treatment Endpoints
# --------------------------------------------------
@api_blueprint.route('/treatments', methods=['GET'])
@login_required
def get_treatments():
    try:
        treatments = TreatmentDriver.find()
        data = [treatment.to_json() for treatment in treatments]
        return jsonify(data), 200
    except Exception as e:
        print(e)
        logging.error(f"Error fetching treatments: {e}")
        return jsonify({'error': "Failed to retrieve treatments."}), 500


@api_blueprint.route('/treatments', methods=['POST'])
@login_required
@validate_request(TreatmentCreate, location='json')
def create_treatment(validated_data):
    """
    Expected JSON body:
    E.g 1:
    {
      "name": "First-line 1 Treatment",
      "type": "Regimen",    // Valid values: "Treatment", "Regimen", "Alternative"
      "regimen": { 
         "drugs": [
            {
              "drug": {
                  "_id": "60a7eb5a9c8e4b0015d8a125",
                  "name": "Carboplatin",
                  "strength": 450,
                  "unit": "mg"
              },
              "annual_patient_con": 100
            }
         ]
      },
      "alternatives": [
         {
            "_id": //regimen id
            "name": "regimen name"
           "regimen": {
              "drugs": [
                  // Similar structure as above.
              ]
           },
           "ratio": 0.75
         }
      ]
    }
    E.g 2:
    {
        "name": "Combined Alternative Treatment",
        "type": "Alternative",
        "alternatives": [
            {
            "_id": "67d022c49e8a82122fb0332d",
            "name": "Carboplatin with Gemcitabine",
            "regimen": {
                "drugs": [
                {
                    "drug": {
                    "_id": "67d0207b9e8a82122fb03327",
                    "name": "Carboplatin",
                    "strength": 450,
                    "unit": "mg"
                    },
                    "annual_patient_con": 13
                },
                {
                    "drug": {
                    "_id": "67d020809e8a82122fb03328",
                    "name": "Gemcitabine",
                    "strength": 1,
                    "unit": "g"
                    },
                    "annual_patient_con": 13
                }
                ]
            },
            "ratio": 0.5
            },
            {
            "_id": "67d023479e8a82122fb0332f",
            "name": "Carboplatin with Paclitaxel",
            "regimen": {
                "drugs": [
                {
                    "drug": {
                    "_id": "67d0207b9e8a82122fb03327",
                    "name": "Carboplatin",
                    "strength": 450,
                    "unit": "mg"
                    },
                    "annual_patient_con": 15
                },
                {
                    "drug": {
                    "_id": "67d020869e8a82122fb03329",
                    "name": "Paclitaxel",
                    "strength": 100,
                    "unit": "mg"
                    },
                    "annual_patient_con": 20
                }
                ]
            },
            "ratio": 0.5
            }
        ]
        }

    Note: "treatment_hash" is auto-generated.
    """
    try:
        name = validated_data.name
        _type = validated_data.type
        if not name or not _type:
            return jsonify({'error': 'Missing required fields: name and type'}), 400

        # Get the regimen and alternatives from the request
        regimen_data = validated_data.get('regimen')
        alternatives_data = validated_data.get('alternatives', [])

        # For an Alternative type treatment, we don't expect a top-level regimen.
        if _type == "Alternative":
            regimen_data = None
        elif regimen_data:
            # If regimen is provided for Regimen type, ignore alternatives.
            alternatives_data = []

        hash_input = name + _type + str(regimen_data) + str(alternatives_data)
        treatment_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()

        treatment = Treatment(
            name=name,
            type=_type,
            regimen=regimen_data,         # Will be None if not applicable
            alternatives=alternatives_data,
            treatment_hash=treatment_hash
        )
        treatment_id = TreatmentDriver.insert(treatment)

        return jsonify({'id': str(treatment_id)}), 201
    except NotUniqueError:
        logging.error("Duplicate treatment detected.")
        return jsonify({'error': "A treatment with similar properties already exists."}), 409
    except Exception as e:
        logging.error(f"Error creating treatment: {e}")
        return jsonify({'error': "An unexpected error occurred while creating the treatment."}), 500


@api_blueprint.route('/treatments/<treatment_id>', methods=['PUT'])
@login_required
@validate_request(TreatmentUpdate, location='json')
def update_treatment(validated_data, treatment_id):
    """
    Expected JSON body (any subset):
    {
      "name": "Updated treatment name",
      "regimen": { ... },
      "alternatives": [ ... ]
    }
    """
    try:
        treatment = TreatmentDriver.find(id=treatment_id).first()
        if not treatment:
            return jsonify({'error': 'Treatment not found'}), 404

        if validated_data.name is not None:
            treatment.name = validated_data.name
        if validated_data.type is not None:
            treatment.type = validated_data.type
        if validated_data.regimen is not None:
            # Convert the provided dictionary to a Regimen instance.
            regimen_data = validated_data.regimen
            treatment.regimen = Regimen(**regimen_data)
            treatment.alternatives = []  # Clear alternatives if regimen is provided.
        elif validated_data.alternatives is not None:
            alternatives_data = validated_data.alternatives
            # Convert each alternative dictionary to an AlternativeTreatment instance.
            treatment.alternatives = [AlternativeTreatment(**alt) for alt in alternatives_data]
            treatment.regimen = None  # Clear regimen if alternatives are provided.

        # Recompute the treatment hash.
        hash_input = treatment.name + treatment.type + str(treatment.regimen or '') + str(treatment.alternatives or '')
        treatment.treatment_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()

        TreatmentDriver.update(treatment)
        return jsonify({'message': 'Treatment updated'}), 200
    except NotUniqueError:
        logging.error("Duplicate treatment detected during update.")
        return jsonify({'error': "Update failed: A treatment with similar properties already exists."}), 409
    except Exception as e:
        logging.error(f"Error updating treatment: {e}")
        return jsonify({'error': "An unexpected error occurred while updating the treatment."}), 500


@api_blueprint.route('/treatments/<treatment_id>', methods=['DELETE'])
@login_required
def delete_treatment(treatment_id):
    try:
        TreatmentDriver.delete(treatment_id)
        return jsonify({'message': 'Treatment deleted'}), 200
    except Exception as e:
        logging.error(f"Error deleting treatment: {e}")
        return jsonify({'error': "An unexpected error occurred while deleting the treatment."}), 500


# --------------------------------------------------
# Patient Endpoints
# --------------------------------------------------
@api_blueprint.route('/patients', methods=['GET'])
@login_required
def get_patients():
    try:
        patients = PatientDriver.find()
        data = [patient.to_json() for patient in patients]
        return jsonify(data), 200
    except Exception as e:
        print(e)
        logging.error(f"Error fetching patients: {e}")
        return jsonify({'error': "Failed to retrieve patients."}), 500


@api_blueprint.route('/patients', methods=['POST'])
@login_required
@validate_request(PatientCreate, location='json')
def create_patient(validated_data):
    """
    Expected JSON body (legacy style):
    {

      "node": {
         "node_type": "characteristic",      // Allowed: "characteristic", "treatment", "followup"
         "rate": 1.0,
         "size": 90000000,
         "parent_id": null,                    // For a root node, use null (or omit)
         "characteristic_data": {              // Required if node_type is "characteristic"
              "_id": "60abc...",              // The master Characteristic's _id (must exist)
              "char_type": "Population",
              "name": "Iran"
         },
         "children": []                        // Optional list of child nodes
      }
    }

    This endpoint performs the following steps:
      1. Validates that the node JSON is complete.
      2. For a "characteristic" node, it verifies that the referenced master Characteristic exists.
         (Similarly, you can add validations for "treatment" or "followup".)
      3. Creates a new Node instance (generating new ObjectIds for the node and its embedded payload as needed).
      4. Generates a unique tree_hash based on the patient size and node content.
      5. Creates a PatientTree document with the single root node.
    """
    try:
        node_data = validated_data.node

        # Validate common node fields.
        node_type = node_data.get('node_type')
        rate = node_data.get('rate')
        node_size = node_data.get('size')
        if node_type not in ['characteristic', 'treatment', 'followup']:
            return jsonify(
                {'error': 'Invalid node_type. Must be one of "characteristic", "treatment", or "followup".'}), 400
        if rate is None or node_size is None:
            return jsonify({'error': 'Missing required node fields: rate and size'}), 400

        # Import embedded classes for node payload.
        from models.tables import Node, CharacteristicEmbedded
        # Validate embedded payloads based on node_type.
        if node_type == 'characteristic':
            char_payload = node_data.get('characteristic_data')
            if not char_payload:
                return jsonify({'error': 'Missing characteristic_data for a characteristic node'}), 400
            char_id_str = char_payload.get('_id')
            if not char_id_str:
                return jsonify({'error': 'Missing _id in characteristic_data'}), 400

            # Validate that the referenced master Characteristic exists.
            existing_char = CharacteristicDriver.find(id=ObjectId(char_id_str)).first()
            if not existing_char:
                return jsonify({'error': 'Referenced characteristic does not exist.'}), 400

            # Create a CharacteristicEmbedded instance.
            embedded_char = CharacteristicEmbedded(
                _id=ObjectId(char_id_str),
                char_type=char_payload.get('char_type'),
                name=char_payload.get('name')
            )
            node_data['characteristic_data'] = embedded_char

        elif node_type == 'treatment':
            treatment_payload = node_data.get('treatment_data')
            if not treatment_payload:
                return jsonify({'error': 'Missing treatment_data for a treatment node'}), 400
            treatment_id_str = treatment_payload.get('_id')
            if not treatment_id_str:
                return jsonify({'error': 'Missing _id in treatment_data'}), 400
            # Validate existence using TreatmentDriver.
            from models.treatment.driver import TreatmentDriver
            existing_treatment = TreatmentDriver.find(id=treatment_id_str).first()
            if not existing_treatment:
                return jsonify({'error': 'Referenced treatment does not exist.'}), 400
            # (Assume treatment_data is valid; conversion to TreatmentEmbedded can be added if needed.)

        elif node_type == 'followup':
            followup_payload = node_data.get('followup_data')
            if not followup_payload:
                return jsonify({'error': 'Missing followup_data for a followup node'}), 400
            followup_id_str = followup_payload.get('_id')
            if not followup_id_str:
                return jsonify({'error': 'Missing _id in followup_data'}), 400
            from models.followup.driver import FollowupDriver
            existing_followup = FollowupDriver.find(id=followup_id_str).first()
            if not existing_followup:
                return jsonify({'error': 'Referenced followup does not exist.'}), 400
            # (Conversion to FollowupEmbedded can be added if needed.)

        # Process parent_id: for a root node, parent_id is set to None.
        parent_id = node_data.get('parent_id')
        if parent_id:
            node_data['parent_id'] = ObjectId(parent_id)
        else:
            node_data['parent_id'] = None

        # Create a new Node instance.
        new_node = Node(
            _id=ObjectId(),
            rate=rate,
            size=node_size,
            node_type=node_type,
            parent_id=node_data.get('parent_id'),
            children=node_data.get('children', [])
        )
        if node_type == 'characteristic':
            new_node.characteristic_data = node_data.get('characteristic_data')
        elif node_type == 'treatment':
            new_node.treatment_data = node_data.get('treatment_data')
        elif node_type == 'followup':
            new_node.followup_data = node_data.get('followup_data')

        # Generate a unique tree_hash using the patient size and the node’s Mongo representation.
        hash_input = f"{node_size}{new_node.to_mongo().to_dict()}".encode('utf-8')
        tree_hash = hashlib.sha256(hash_input).hexdigest()

        # Create the PatientTree document with the single root node.
        patient_tree = PatientTree(
            tree=new_node,
            tree_hash=tree_hash
        )
        patient_id = PatientDriver.insert(patient_tree)
        return jsonify({'id': str(patient_id)}), 201

    except NotUniqueError:
        logging.error("Duplicate patient tree detected.")
        return jsonify({'error': "A patient with a similar tree structure already exists."}), 409
    except Exception as e:
        logging.error(f"Error creating patient: {e}")
        return jsonify({'error': "An unexpected error occurred while creating the patient."}), 500


def create_node_from_dict(node_dict, parent_id=None):
    """
    Recursively convert a dictionary (representing a node) into a Node instance.
    If a node (or any of its children) does not have an _id, one is generated.
    The parent_id is set appropriately for all child nodes.
    """
    # If the dictionary is wrapped in a "node" key, unwrap it.
    if 'node' in node_dict:
        node_dict = node_dict['node']

    # Get or generate the node's _id.
    node_id = ObjectId(node_dict.get('_id')) if node_dict.get('_id') else ObjectId()
    # Use the node's provided parent_id if available; otherwise, use the passed-in parent_id.
    node_parent_id = ObjectId(node_dict.get('parent_id')) if node_dict.get('parent_id') else parent_id

    # Create the Node instance.
    new_node = Node(
        _id=node_id,
        rate=node_dict.get('rate'),
        size=node_dict.get('size'),
        node_type=node_dict.get('node_type'),
        parent_id=node_parent_id,
        children=[]  # We'll fill this in below.
    )

    # Process the embedded payload based on the node type.
    if new_node.node_type == 'characteristic':
        char_data = node_dict.get('characteristic_data')
        if char_data:
            new_node.characteristic_data = CharacteristicEmbedded(
                _id=ObjectId(char_data.get('_id')) if char_data.get('_id') else ObjectId(),
                char_type=char_data.get('char_type'),
                name=char_data.get('name')
            )
    elif new_node.node_type == 'treatment':
        treatment_data = node_dict.get('treatment_data')
        if treatment_data:
            new_node.treatment_data = TreatmentEmbedded(**treatment_data)
    elif new_node.node_type == 'followup':
        followup_data = node_dict.get('followup_data')
        if followup_data:
            new_node.followup_data = FollowupEmbedded(**followup_data)

    # Recursively process any children.
    for child_dict in node_dict.get('children', []):
        child_node = create_node_from_dict(child_dict, parent_id=node_id)
        new_node.children.append(child_node)

    return new_node

# -------------------------------------------------------------------
@api_blueprint.route('/patients/<patient_id>/add_node', methods=['POST'])
@login_required
@validate_request(AddNode, location='json')
def add_node(validated_data, patient_id):
    """
    Expected JSON body example:
    {
      "parent_node_id": "67c44e28e0ff95ef4bd2a2a4", // Optional for root-level addition.
      "node": {
          "node_type": "characteristic",
          "rate": 0.343,
          "characteristic_data": {
              "_id": "67d01f899e8a82122fb0331d",
              "char_type": "Metastasis",
              "name": "Bone Metastasis"
          }
      },
      "children": [
          {
              "node": {
                  "node_type": "treatment",
                  "rate": 1,
                  "treatment_data": {
                      "_id": "67d05523af3304f08c7e9fb1",
                      "name": "Denosumab Treatment",
                      "type": "Regimen",
                      "regimen": {
                          "drugs": [
                              {
                                  "drug": {
                                      "_id": "67d020989e8a82122fb0332b",
                                      "name": "Denosumab",
                                      "strength": 120,
                                      "unit": "mg"
                                  },
                                  "annual_patient_con": 13
                              }
                          ]
                      }
                  }
              }
          }
      ]
    }
    This endpoint:
      1. Fetches the PatientTree document.
      2. Locates the parent node (if provided) by recursively traversing the tree.
      3. Appends the new node (with processed children) to the parent's children list (or as a child of the root if no parent_node_id is provided).
      4. Recomputes the tree_hash over the entire tree.
      5. Replaces the entire PatientTree document in the database.
    """
    try:
        new_node_data = validated_data.get('node')
        # Merge top-level "children" into the node dictionary if provided.
        if validated_data.children is not None:
            new_node_data['children'] = validated_data.get('children')
        
        parent_node_id = validated_data.get('parent_node_id')  # May be None for root-level addition.
        if not new_node_data:
            return jsonify({'error': 'Missing node data'}), 400

        # Recursively create the new node (and its children) from the provided dictionary.
        new_node = create_node_from_dict(new_node_data, parent_id=ObjectId(parent_node_id) if parent_node_id else None)

        # Fetch the PatientTree document.
        patient_tree = PatientDriver.find(id=patient_id).first()
        if not patient_tree:
            return jsonify({'error': 'Patient not found'}), 404

        # Recursive function to find the parent node in the tree.
        def find_node(node, target_id):
            if str(node._id) == target_id:
                return node
            for child in node.children:
                result = find_node(child, target_id)
                if result:
                    return result
            return None

        if parent_node_id:
            parent_node = find_node(patient_tree.tree, parent_node_id)
            if not parent_node:
                return jsonify({'error': 'Parent node not found'}), 404
            parent_node.children.append(new_node)
        else:
            # If no parent_node_id is provided, add the new node as a child of the root.
            patient_tree.tree.children.append(new_node)

        # Recompute the tree_hash over the entire tree.
        hash_input = f"{patient_tree.tree.to_mongo().to_dict()}".encode('utf-8')
        patient_tree.tree_hash = hashlib.sha256(hash_input).hexdigest()

        # Replace the entire document in the database.
        from mongoengine.connection import get_db
        db = get_db()
        db['patients'].replace_one({'_id': patient_tree.id}, patient_tree.to_mongo().to_dict())

        return jsonify({'message': 'Node added successfully', 'tree_hash': patient_tree.tree_hash}), 200

    except Exception as e:
        logging.error(f"Error adding node: {e}")
        return jsonify({'error': "An unexpected error occurred while adding the node."}), 500


@api_blueprint.route('/patients/<patient_id>', methods=['PUT'])
@login_required
@validate_request(PatientUpdate, location='json')
def update_patient(validated_data, patient_id):
    """
    Expected JSON body (any subset, legacy style):
    {

      // Optionally, to update the entire tree structure:
      "tree": {
          "_id": "60abc...",            // Required: new ObjectId as string for the root node
          "rate": 1.0,
          "size": 90000000,
          "node_type": "characteristic",  // Must be one of "characteristic", "treatment", or "followup"
          "parent_id": null,             // For root node, can be null
          "characteristic_data": {       // Required if node_type is "characteristic"
              "_id": "60def...",         // The master Characteristic's _id as string
              "char_type": "Population",
              "name": "Iran"
          },
          "children": [ ... ]           // Optional: list of child nodes (must follow the same structure)
      }
    }
    If "tree" is provided, the endpoint will update the patient tree and recompute the tree_hash.
    Otherwise, only the "size" field will be updated.
    """
    try:
        patient = PatientDriver.find(id=patient_id).first()
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404

        # Update patient size if provided.
        if validated_data.size is not None:
            patient.size = validated_data.size

        # Optionally update the entire tree.
        if validated_data.tree is not None:
            from models.tables import Node
            try:
                # Convert the incoming JSON to a Node instance.
                new_tree = Node(**validated_data.tree)
                patient.tree = new_tree
                # Recompute tree_hash based on the full tree.
                hash_input = f"{new_tree.to_mongo().to_dict()}".encode('utf-8')
                patient.tree_hash = hashlib.sha256(hash_input).hexdigest()
            except Exception as e:
                logging.error(f"Error updating patient tree: {e}")
                return jsonify({'error': "Invalid tree structure provided."}), 400

        # Replace the entire document using a full document replacement.
        from mongoengine.connection import get_db
        db = get_db()
        db['patients'].replace_one({'_id': patient.id}, patient.to_mongo().to_dict())

        return jsonify({'message': 'Patient updated'}), 200
    except Exception as e:
        logging.error(f"Error updating patient: {e}")
        return jsonify({'error': "An unexpected error occurred while updating the patient."}), 500


@api_blueprint.route('/patients/<patient_id>/node/<node_id>', methods=['PUT'])
@login_required
@validate_request(UpdateNode, location='json')
def update_node(validated_data, patient_id, node_id):
    """
    Expected JSON body (any subset, legacy style):
    eg 1:
    {
        "rate": 0.9,
        "size": 60000,
        "node_type": "characteristic",  // Optional if not changing.
        "parent_id": "<new parent ObjectId as string, if updating>",
        // Optionally, update the embedded payload:
        "characteristic_data": {
            "_id": "67c4540de5e465927f4c0288",
            "char_type": "Biomarker",
            "name": "KRAS"
        }
        // Alternatively, for treatment or followup nodes:
        // "treatment_data": { ... }
        // "followup_data": { ... }
        // "children": [ ... ] (optional)
    }

    This endpoint:
      1. Fetches the PatientTree document.
      2. Recursively locates the node with _id equal to node_id.
      3. Updates the node's fields with the provided values.
      4. Recomputes the tree_hash over the entire tree.
      5. Replaces the entire PatientTree document in the database.
    """
    try:
        if not validated_data:
            return jsonify({'error': 'No update data provided.'}), 400

        # Fetch the PatientTree document.
        patient_tree = PatientDriver.find(id=patient_id).first()
        if not patient_tree:
            return jsonify({'error': 'Patient not found.'}), 404

        # Recursive function to find the node with the given _id.
        def find_node(node, target_id):
            if str(node._id) == target_id:
                return node
            for child in node.children:
                found = find_node(child, target_id)
                if found:
                    return found
            return None

        target_node = find_node(patient_tree.tree, node_id)
        if not target_node:
            return jsonify({'error': 'Node not found in patient tree.'}), 404

        # Update node fields if provided.
        if validated_data.rate is not None:
            target_node.rate = validated_data.rate
        if validated_data.size is not None:
            target_node.size = validated_data.size
        if validated_data.node_type is not None:
            target_node.node_type = validated_data.node_type
        if validated_data.parent_id is not None:
            parent = validated_data.parent_id
            target_node.parent_id = ObjectId(parent) if parent else None

        # Update the embedded payload based on node_type.
        if target_node.node_type == 'characteristic' and validated_data.characteristic_data:
            char_data = validated_data.characteristic_data
            target_node.characteristic_data = CharacteristicEmbedded(
                _id=ObjectId(char_data.get('_id')),
                char_type=char_data.get('char_type'),
                name=char_data.get('name')
            )
        elif target_node.node_type == 'treatment' and validated_data.treatment_data:
            target_node.treatment_data = TreatmentEmbedded(**validated_data.treatment_data)
        elif target_node.node_type == 'followup' and validated_data.followup_data:
            target_node.followup_data = FollowupEmbedded(**validated_data.followup_data)

        # Optionally, update children if provided.
        if validated_data.children:
            target_node.children = validated_data.children

        # Recompute the tree_hash over the entire tree.
        hash_input = f"{patient_tree.tree.to_mongo().to_dict()}".encode('utf-8')
        patient_tree.tree_hash = hashlib.sha256(hash_input).hexdigest()

        # Replace the entire document using full document replacement.
        from mongoengine.connection import get_db
        db = get_db()
        db['patients'].replace_one({'_id': patient_tree.id}, patient_tree.to_mongo().to_dict())

        return jsonify({'message': 'Node updated successfully', 'tree_hash': patient_tree.tree_hash}), 200

    except Exception as e:
        logging.error(f"Error updating node: {e}")
        return jsonify({'error': "An unexpected error occurred while updating the node."}), 500


@api_blueprint.route('/patients/<patient_id>', methods=['DELETE'])
@login_required
def delete_patient(patient_id):
    """
    Deletes the entire PatientTree document.
    """
    try:
        PatientDriver.delete(patient_id)
        return jsonify({'message': 'Patient deleted'}), 200
    except Exception as e:
        logging.error(f"Error deleting patient: {e}")
        return jsonify({'error': "An unexpected error occurred while deleting the patient."}), 500


@api_blueprint.route('/patients/<patient_id>/node/<node_id>', methods=['DELETE'])
@login_required
def delete_node(patient_id, node_id):
    """
    Deletes a single node from the PatientTree without discarding its children.
    The children of the deleted node are spliced into the parent's children list,
    and their parent_id fields are updated accordingly.

    Expected URL parameters:
      - patient_id: The PatientTree document's id.
      - node_id: The _id of the node to delete (as a string).

    This endpoint:
      1. Fetches the PatientTree document.
      2. Recursively finds and removes the node with _id equal to node_id,
         splicing its children into the parent's children list and updating their parent_id.
      3. Recomputes the tree_hash based on the updated tree.
      4. Replaces the entire PatientTree document in the database.
    """
    try:
        # Fetch the PatientTree document.
        patient_tree = PatientDriver.find(id=patient_id).first()
        if not patient_tree:
            return jsonify({'error': 'Patient not found'}), 404

        # Recursive function to remove a node and splice its children into the parent's list.
        def remove_node(node, target_id):
            new_children = []
            removed = False
            for child in node.children:
                if str(child._id) == target_id:
                    removed = True
                    # Before splicing, update each grandchild's parent_id to the current node's _id.
                    for grandchild in child.children:
                        grandchild.parent_id = node._id
                    # Splice the removed node's children into the parent's children list.
                    new_children.extend(child.children)
                else:
                    # Recurse into the child.
                    child_removed = remove_node(child, target_id)
                    removed = removed or child_removed
                    new_children.append(child)
            node.children = new_children
            return removed

        # Remove the target node from the tree starting at the root.
        removed = remove_node(patient_tree.tree, node_id)
        if not removed:
            return jsonify({'error': 'Node not found in patient tree'}), 404

        # Recompute the tree_hash over the updated tree.
        hash_input = f"{patient_tree.tree.to_mongo().to_dict()}".encode('utf-8')
        patient_tree.tree_hash = hashlib.sha256(hash_input).hexdigest()

        # Replace the entire document using full document replacement.
        from mongoengine.connection import get_db
        db = get_db()
        db['patients'].replace_one({'_id': patient_tree.id}, patient_tree.to_mongo().to_dict())

        return jsonify({'message': 'Node deleted successfully', 'tree_hash': patient_tree.tree_hash}), 200

    except Exception as e:
        logging.error(f"Error deleting node: {e}")
        return jsonify({'error': "An unexpected error occurred while deleting the node."}), 500


# --------------------------------------------------
# Followup Endpoints
# --------------------------------------------------
@api_blueprint.route('/followups', methods=['GET'])
@login_required
def get_followups():
    """
    Retrieve all followups.

    Legacy:
      Followups were created using names like "Followup for Patient X" along with overall_survival.
    """
    try:
        followups = FollowupDriver.find()
        data = [followup.to_json() for followup in followups]
        return jsonify(data), 200
    except Exception as e:
        logging.error(f"Error fetching followups: {e}")
        return jsonify({'error': "Failed to retrieve followups."}), 500


@api_blueprint.route('/followups', methods=['POST'])
@login_required
@validate_request(FollowupCreate, location='json')
def create_followup(validated_data):
    """
    Expected JSON body:
    {
      "name": "Followup for Patient X",
      "overall_survival": 0.75,
      "patient_id": "<patient ObjectId>",
      "parent_id": "<parent ObjectId>"
    }
    """
    try:
        name = validated_data.name
        overall_survival = validated_data.overall_survival
        patient_id = validated_data.patient_id
        parent_id = validated_data.parent_id
        if not name or overall_survival is None or not patient_id or not parent_id:
            return jsonify({'error': 'Missing required fields: name, overall_survival, patient_id, and parent_id'}), 400

        followup = Followup(
            name=name,
            overall_survival=overall_survival,
            patient_id=ObjectId(patient_id),
            parent_id=ObjectId(parent_id)
        )
        followup_id = FollowupDriver.insert(followup)
        return jsonify({'id': str(followup_id)}), 201
    except NotUniqueError:
        logging.error("Duplicate followup detected.")
        return jsonify(
            {'error': "A followup with the given name, overall survival, patient, and parent already exists."}), 409
    except Exception as e:
        logging.error(f"Error creating followup: {e}")
        return jsonify({'error': "An unexpected error occurred while creating the followup."}), 500


@api_blueprint.route('/followups/<followup_id>', methods=['PUT'])
@login_required
@validate_request(FollowupUpdate, location='json')
def update_followup(validated_data, followup_id):
    """
    Expected JSON body (any subset):
    {
      "name": "Updated Followup Name",
      "overall_survival": 0.8
    }
    """
    try:
        followup = FollowupDriver.find(id=followup_id).first()
        if not followup:
            return jsonify({'error': 'Followup not found'}), 404

        if validated_data.name is not None:
            followup.name = validated_data.name
        if validated_data.overall_survival is not None:
            followup.overall_survival = validated_data.overall_survival
        FollowupDriver.update(followup)
        return jsonify({'message': 'Followup updated'}), 200
    except NotUniqueError:
        logging.error("Duplicate followup detected during update.")
        return jsonify(
            {'error': "Update failed: A followup with the given name and overall survival already exists."}), 409
    except Exception as e:
        logging.error(f"Error updating followup: {e}")
        return jsonify({'error': "An unexpected error occurred while updating the followup."}), 500


@api_blueprint.route('/followups/<followup_id>', methods=['DELETE'])
@login_required
def delete_followup(followup_id):
    try:
        FollowupDriver.delete(followup_id)
        return jsonify({'message': 'Followup deleted'}), 200
    except Exception as e:
        logging.error(f"Error deleting followup: {e}")
        return jsonify({'error': "An unexpected error occurred while deleting the followup."}), 500
