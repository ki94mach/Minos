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
from models.tables import (
    Characteristic, Drug, Followup, Treatment, PatientTree,
    Regimen, AlternativeTreatment
)

api_blueprint = Blueprint('api', __name__)


# --------------------------------------------------
# Characteristic Endpoints
# --------------------------------------------------
@api_blueprint.route('/characteristics', methods=['GET'])
def get_characteristics():
    try:
        characteristics = CharacteristicDriver.find()
        data = [char.to_json() for char in characteristics]
        return jsonify(data), 200
    except Exception as e:
        logging.error(f"Error fetching characteristics: {e}")
        return jsonify({'error': "Failed to retrieve characteristics."}), 500


@api_blueprint.route('/characteristics', methods=['POST'])
def create_characteristic():
    """
    Expected JSON body:
    {
      "type": "Primary Indication",
      "name": "Lung Cancer"
    }
    """
    try:
        data = request.get_json()
        char_type = data.get('type')
        name = data.get('name')
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
def update_characteristic(char_id):
    """
    Expected JSON body (any subset):
    {
      "type": "updated type",
      "name": "updated name"
    }
    """
    try:
        data = request.get_json()
        char = CharacteristicDriver.find(id=char_id).first()
        if not char:
            return jsonify({'error': 'Characteristic not found'}), 404

        if 'type' in data:
            char.char_type = data['type']
        if 'name' in data:
            char.name = data['name']
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
def get_drugs():
    try:
        drugs = DrugDriver.find()
        data = [drug.to_json() for drug in drugs]
        return jsonify(data), 200
    except Exception as e:
        logging.error(f"Error fetching drugs: {e}")
        return jsonify({'error': "Failed to retrieve drugs."}), 500


@api_blueprint.route('/drugs', methods=['POST'])
def create_drug():
    """
    Expected JSON body:
    {
      "name": "Carboplatin",
      "strength": 450,
      "unit": "mg"
    }
    """
    try:
        data = request.get_json()
        name = data.get('name')
        strength = data.get('strength')
        unit = data.get('unit')
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
def update_drug(drug_id):
    """
    Expected JSON body (any subset):
    {
      "name": "Updated name",
      "strength": 450,
      "unit": "mg"
    }
    """
    try:
        data = request.get_json()
        drug = DrugDriver.find(id=drug_id).first()
        if not drug:
            return jsonify({'error': 'Drug not found'}), 404

        if 'name' in data:
            drug.name = data['name']
        if 'strength' in data:
            drug.strength = data['strength']
        if 'unit' in data:
            drug.unit = data['unit']
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
def get_treatments():
    try:
        treatments = TreatmentDriver.find()
        data = [treatment.to_json() for treatment in treatments]
        return jsonify(data), 200
    except Exception as e:
        logging.error(f"Error fetching treatments: {e}")
        return jsonify({'error': "Failed to retrieve treatments."}), 500


@api_blueprint.route('/treatments', methods=['POST'])
def create_treatment():
    """
    Expected JSON body:
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
           "regimen": {
              "drugs": [
                  // Similar structure as above.
              ]
           },
           "ratio": 0.75
         }
      ]
    }
    Note: "treatment_hash" is auto-generated.
    """
    try:
        data = request.get_json()
        name = data.get('name')
        _type = data.get('type')
        if not name or not _type:
            return jsonify({'error': 'Missing required fields: name and type'}), 400

        regimen = data.get('regimen', {})
        alternatives = data.get('alternatives', [])
        if regimen:
            alternatives = []
        else:
            regimen = {}

        hash_input = name + _type + str(regimen) + str(alternatives)
        treatment_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()

        treatment = Treatment(
            name=name,
            type=_type,
            regimen=regimen,            # Note: We assume the JSON matches the structure for Regimen.
            alternatives=alternatives,  # Similarly, JSON for alternatives must match the structure.
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
def update_treatment(treatment_id):
    """
    Expected JSON body (any subset):
    {
      "name": "Updated treatment name",
      "regimen": { ... },
      "alternatives": [ ... ]
    }
    """
    try:
        data = request.get_json()
        treatment = TreatmentDriver.find(id=treatment_id).first()
        if not treatment:
            return jsonify({'error': 'Treatment not found'}), 404

        if 'name' in data:
            treatment.name = data['name']
        if 'type' in data:
            treatment.type = data['type']
        if 'regimen' in data:
            # Convert the provided dictionary to a Regimen instance.
            regimen_data = data['regimen']
            treatment.regimen = Regimen(**regimen_data)
            treatment.alternatives = []  # Clear alternatives if regimen is provided.
        elif 'alternatives' in data:
            alternatives_data = data['alternatives']
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
def get_patients():
    try:
        patients = PatientDriver.find()
        data = [patient.to_json() for patient in patients]
        return jsonify(data), 200
    except Exception as e:
        logging.error(f"Error fetching patients: {e}")
        return jsonify({'error': "Failed to retrieve patients."}), 500


@api_blueprint.route('/patients', methods=['POST'])
def create_patient():
    """
    Expected JSON body (legacy style):
    {
      "size": 90000000,
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
        data = request.get_json()
        size = data.get('size')
        node_data = data.get('node')
        if not size or not node_data:
            return jsonify({'error': 'Missing required fields: size and node'}), 400

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
            existing_char = CharacteristicDriver.find(id=char_id_str).first()
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
        hash_input = f"{size}{new_node.to_mongo().to_dict()}".encode('utf-8')
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


@api_blueprint.route('/patients/<patient_id>/add_node', methods=['POST'])
def add_node(patient_id):
    """
    Expected JSON body:
    {
      "parent_node_id": "<parent node ObjectId as string>",  // For the root node, can be null or omitted.
      "node": {
         "node_type": "characteristic",   // or "treatment" or "followup"
         "rate": 0.8,
         "size": 50000,
         // Embedded payload, based on node_type:
         "characteristic_data": {
             "_id": "<existing characteristic ObjectId>",
             "char_type": "Population",
             "name": "Iran"
         }
         // For treatment or followup nodes, provide "treatment_data" or "followup_data" respectively.
      }
    }
    ---
    This endpoint:
      1. Fetches the PatientTree document.
      2. Locates the parent node (if provided); if not provided, the new node is added as a sibling to the root.
      3. Appends the new node to the parent's children list.
      4. Updates the PatientTree document.
    """
    try:
        data = request.get_json()
        new_node_data = data.get('node')
        parent_node_id = data.get('parent_node_id')  # May be None for root-level addition.

        if not new_node_data:
            return jsonify({'error': 'Missing node data'}), 400

        # Create the new node instance.
        from models.tables import Node, CharacteristicEmbedded, TreatmentEmbedded, FollowupEmbedded
        new_node = Node(
            _id=ObjectId(),
            rate=new_node_data.get('rate'),
            size=new_node_data.get('size'),
            node_type=new_node_data.get('node_type'),
            parent_id=ObjectId(parent_node_id) if parent_node_id else None,
            children=new_node_data.get('children', [])
        )

        # Depending on node_type, assign the embedded payload.
        if new_node.node_type == 'characteristic':
            char_data = new_node_data.get('characteristic_data')
            if not char_data:
                return jsonify({'error': 'Missing characteristic_data for characteristic node'}), 400
            new_node.characteristic_data = CharacteristicEmbedded(
                _id=ObjectId(char_data.get('_id')),
                char_type=char_data.get('char_type'),
                name=char_data.get('name')
            )
        elif new_node.node_type == 'treatment':
            treatment_data = new_node_data.get('treatment_data')
            if not treatment_data:
                return jsonify({'error': 'Missing treatment_data for treatment node'}), 400
            new_node.treatment_data = TreatmentEmbedded(**treatment_data)
        elif new_node.node_type == 'followup':
            followup_data = new_node_data.get('followup_data')
            if not followup_data:
                return jsonify({'error': 'Missing followup_data for followup node'}), 400
            new_node.followup_data = FollowupEmbedded(**followup_data)
        else:
            return jsonify({'error': 'Invalid node_type'}), 400

        # Fetch the PatientTree document.
        patient_tree = PatientDriver.find(id=patient_id).first()
        if not patient_tree:
            return jsonify({'error': 'Patient not found'}), 404

        # Define a recursive function to locate the parent node.
        def find_node(node, target_id):
            if str(node._id) == target_id:
                return node
            for child in node.children:
                result = find_node(child, target_id)
                if result:
                    return result
            return None

        if parent_node_id:
            # Traverse the tree to find the parent node.
            parent_node = find_node(patient_tree.tree, parent_node_id)
            if not parent_node:
                return jsonify({'error': 'Parent node not found'}), 404
            # Append the new node to the parent's children.
            parent_node.children.append(new_node)
        else:
            # If no parent_node_id is provided, we assume the new node becomes the root.
            # Alternatively, you may choose to add it as a child of the existing root.
            # For this example, we replace the root.
            patient_tree.tree = new_node

        # Update the tree_hash
        hash_input = f"{patient_tree.tree.to_mongo().to_dict()}".encode('utf-8')
        patient_tree.tree_hash = hashlib.sha256(hash_input).hexdigest()

        PatientDriver.update(patient_tree)
        return jsonify({'message': 'Node added successfully', 'tree_hash': patient_tree.tree_hash}), 200

    except Exception as e:
        logging.error(f"Error adding node: {e}")
        return jsonify({'error': "An unexpected error occurred while adding the node."}), 500


@api_blueprint.route('/patients/<patient_id>', methods=['PUT'])
def update_patient(patient_id):
    """
    Expected JSON body (any subset, legacy style):
    {
      "size": 1200,
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
          "children": []                // Optional: list of child nodes (must follow same structure)
      }
    }
    If "tree" is provided, the endpoint will attempt to update the patient tree and recompute the tree_hash.
    Otherwise, only the "size" field will be updated.
    """
    try:
        data = request.get_json()
        patient = PatientDriver.find(id=patient_id).first()
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404

        # Update patient size if provided.
        if 'size' in data:
            patient.size = data['size']

        # Optionally update the tree if provided.
        if 'tree' in data:
            from models.tables import Node
            try:
                # Convert the incoming JSON to a Node instance.
                # Note: The JSON must have all required fields (e.g. _id, rate, size, node_type).
                new_tree = Node(**data['tree'])
                patient.tree = new_tree
                # Recompute tree_hash based on the updated tree.
                hash_input = f"{new_tree.to_mongo().to_dict()}".encode('utf-8')
                patient.tree_hash = hashlib.sha256(hash_input).hexdigest()
            except Exception as e:
                logging.error(f"Error updating patient tree: {e}")
                return jsonify({'error': "Invalid tree structure provided."}), 400

        PatientDriver.update(patient)
        return jsonify({'message': 'Patient updated'}), 200
    except Exception as e:
        logging.error(f"Error updating patient: {e}")
        return jsonify({'error': "An unexpected error occurred while updating the patient."}), 500

@api_blueprint.route('/patients/<patient_id>', methods=['DELETE'])
def delete_patient(patient_id):
    try:
        PatientDriver.delete(patient_id)
        return jsonify({'message': 'Patient deleted'}), 200
    except Exception as e:
        logging.error(f"Error deleting patient: {e}")
        return jsonify({'error': "An unexpected error occurred while deleting the patient."}), 500


# --------------------------------------------------
# Followup Endpoints
# --------------------------------------------------
@api_blueprint.route('/followups', methods=['GET'])
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
def create_followup():
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
        data = request.get_json()
        name = data.get('name')
        overall_survival = data.get('overall_survival')
        patient_id = data.get('patient_id')
        parent_id = data.get('parent_id')
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
def update_followup(followup_id):
    """
    Expected JSON body (any subset):
    {
      "name": "Updated Followup Name",
      "overall_survival": 0.8
    }
    """
    try:
        data = request.get_json()
        followup = FollowupDriver.find(id=followup_id).first()
        if not followup:
            return jsonify({'error': 'Followup not found'}), 404

        if 'name' in data:
            followup.name = data['name']
        if 'overall_survival' in data:
            followup.overall_survival = data['overall_survival']
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
def delete_followup(followup_id):
    try:
        FollowupDriver.delete(followup_id)
        return jsonify({'message': 'Followup deleted'}), 200
    except Exception as e:
        logging.error(f"Error deleting followup: {e}")
        return jsonify({'error': "An unexpected error occurred while deleting the followup."}), 500
