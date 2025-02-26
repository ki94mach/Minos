# routes/api.py
from flask import Blueprint, jsonify, request
import logging
import hashlib
from bson import ObjectId

# Import driver classes from the appropriate directories
from models.characteristic.driver import CharacteristicDriver
from models.drug.driver import DrugDriver
from models.followup.driver import FollowupDriver
from models.patient.driver import PatientDriver
from models.treatment.driver import TreatmentDriver

# Import model classes from tables for creating new instances.
from models.tables import Characteristic, Drug, Followup, Treatment, PatientTree

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
        return jsonify({'error': str(e)}), 500

@api_blueprint.route('/characteristics', methods=['POST'])
def create_characteristic():
    """
    Expected JSON body:
    {
      "type": "biomarker",
      "name": "KRAS G12C"
    }
    """
    try:
        data = request.get_json()
        char_type = data.get('type')
        name = data.get('name')
        if not char_type or not name:
            return jsonify({'error': 'Missing required fields: type and name'}), 400

        char = Characteristic(char_type=char_type, name=name)
        char_id = CharacteristicDriver.insert(char)
        return jsonify({'id': str(char_id)}), 201
    except Exception as e:
        logging.error(f"Error creating characteristic: {e}")
        return jsonify({'error': str(e)}), 500

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
    except Exception as e:
        logging.error(f"Error updating characteristic: {e}")
        return jsonify({'error': str(e)}), 500

@api_blueprint.route('/characteristics/<char_id>', methods=['DELETE'])
def delete_characteristic(char_id):
    try:
        CharacteristicDriver.delete(char_id)
        return jsonify({'message': 'Characteristic deleted'}), 200
    except Exception as e:
        logging.error(f"Error deleting characteristic: {e}")
        return jsonify({'error': str(e)}), 500

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
        return jsonify({'error': str(e)}), 500

@api_blueprint.route('/drugs', methods=['POST'])
def create_drug():
    """
    Expected JSON body:
    {
      "name": "Carboplatin",
      "strength": "450 mg"
    }
    """
    try:
        data = request.get_json()
        name = data.get('name')
        strength = data.get('strength')
        if not name or not strength:
            return jsonify({'error': 'Missing required fields: name and strength'}), 400

        drug = Drug(name=name, strength=strength)
        drug_id = DrugDriver.insert(drug)
        return jsonify({'id': str(drug_id)}), 201
    except Exception as e:
        logging.error(f"Error creating drug: {e}")
        return jsonify({'error': str(e)}), 500

@api_blueprint.route('/drugs/<drug_id>', methods=['PUT'])
def update_drug(drug_id):
    """
    Expected JSON body (any subset):
    {
      "name": "Updated name",
      "strength": "Updated strength"
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
        DrugDriver.update(drug)
        return jsonify({'message': 'Drug updated'}), 200
    except Exception as e:
        logging.error(f"Error updating drug: {e}")
        return jsonify({'error': str(e)}), 500

@api_blueprint.route('/drugs/<drug_id>', methods=['DELETE'])
def delete_drug(drug_id):
    try:
        DrugDriver.delete(drug_id)
        return jsonify({'message': 'Drug deleted'}), 200
    except Exception as e:
        logging.error(f"Error deleting drug: {e}")
        return jsonify({'error': str(e)}), 500

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
        return jsonify({'error': str(e)}), 500

@api_blueprint.route('/treatments', methods=['POST'])
def create_treatment():
    """
    Expected JSON body:
    {
      "name": "First-line Treatment",
      "regimen": {
         "_id": "60a7eac89c8e4b0015d8a123",       // provided by client or generated
         "name": "Regimen A",
         "drugs": [
            {
              "_id": "60a7eb239c8e4b0015d8a124",
              "drug": {
                  "_id": "60a7eb5a9c8e4b0015d8a125",
                  "name": "Carboplatin",
                  "strength": "450 mg"
              },
              "annual_patient_con": 100
            }
         ]
      },
      "alternatives": [
         {
           "_id": "60a7ec089c8e4b0015d8a126",
           "regimen": {
              "_id": "60a7ec2e9c8e4b0015d8a127",
              "name": "Regimen B",
              "drugs": [
                  // Similar structure as above.
              ]
           },
           "ratio": 0.75
         }
      ]
    }
    ---
    Note: The field "treatment_hash" is required by the model.
    It will be auto-generated here using the treatment name (and optionally other fields).
    """
    try:
        data = request.get_json()
        name = data.get('name')
        if not name:
            return jsonify({'error': 'Missing required field: name'}), 400

        # Generate a treatment hash based on the name and (optionally) other JSON content.
        hash_input = name + str(data.get('regimen', '')) + str(data.get('alternatives', ''))
        treatment_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()

        # Create the Treatment instance; regimen and alternatives are optional.
        treatment = Treatment(
            name=name,
            regimen=data.get('regimen'),
            alternatives=data.get('alternatives'),
            treatment_hash=treatment_hash
        )
        treatment_id = TreatmentDriver.insert(treatment)
        return jsonify({'id': str(treatment_id)}), 201
    except Exception as e:
        logging.error(f"Error creating treatment: {e}")
        return jsonify({'error': str(e)}), 500

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
        if 'regimen' in data:
            treatment.regimen = data['regimen']
        if 'alternatives' in data:
            treatment.alternatives = data['alternatives']

        # Recompute the treatment hash if needed.
        hash_input = treatment.name + str(treatment.regimen or '') + str(treatment.alternatives or '')
        treatment.treatment_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()

        TreatmentDriver.update(treatment)
        return jsonify({'message': 'Treatment updated'}), 200
    except Exception as e:
        logging.error(f"Error updating treatment: {e}")
        return jsonify({'error': str(e)}), 500

@api_blueprint.route('/treatments/<treatment_id>', methods=['DELETE'])
def delete_treatment(treatment_id):
    try:
        TreatmentDriver.delete(treatment_id)
        return jsonify({'message': 'Treatment deleted'}), 200
    except Exception as e:
        logging.error(f"Error deleting treatment: {e}")
        return jsonify({'error': str(e)}), 500

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
        return jsonify({'error': str(e)}), 500

@api_blueprint.route('/patients', methods=['POST'])
def create_patient():
    """
    Expected JSON body:
    {
      "size": 1000,
      "characteristic": {
         "type": "biomarker",
         "name": "KRAS G12C"
      }
    }
    ---
    This endpoint creates a patient by:
      1. Creating a Characteristic using the provided characteristic data.
      2. Building a tree with a single root Node of type "characteristic" whose payload is the characteristic.
      3. Auto-generating a tree_hash.
    """
    try:
        data = request.get_json()
        size = data.get('size')
        char_data = data.get('characteristic')
        if not size or not char_data:
            return jsonify({'error': 'Missing required fields: size and characteristic'}), 400

        # Create a characteristic document.
        char = Characteristic(char_type=char_data.get('type'), name=char_data.get('name'))
        CharacteristicDriver.insert(char)

        # Build a node for the patient tree.
        node = {
            "node_type": "characteristic",
            "ref_id": char.id,
            "rate": 1.0,
            "characteristic_data": {
                "type": char.char_type,
                "name": char.name,
                "size": size,
                "rate": 1.0
            },
            "children": []
        }
        # Generate a unique tree hash based on the patient size and node.
        hash_input = f"{size}{node}".encode('utf-8')
        tree_hash = hashlib.sha256(hash_input).hexdigest()

        patient = PatientTree(size=size, tree=[node], tree_hash=tree_hash)
        patient_id = PatientDriver.insert(patient)
        return jsonify({'id': str(patient_id)}), 201
    except Exception as e:
        logging.error(f"Error creating patient: {e}")
        return jsonify({'error': str(e)}), 500

@api_blueprint.route('/patients/<patient_id>', methods=['PUT'])
def update_patient(patient_id):
    """
    Expected JSON body (any subset):
    {
      "size": 1200
      // Additional logic could be added to update the tree as needed.
    }
    """
    try:
        data = request.get_json()
        patient = PatientDriver.find(id=patient_id).first()
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404

        if 'size' in data:
            patient.size = data['size']
        # Note: Updating the tree structure would require more complex logic.
        PatientDriver.update(patient)
        return jsonify({'message': 'Patient updated'}), 200
    except Exception as e:
        logging.error(f"Error updating patient: {e}")
        return jsonify({'error': str(e)}), 500

@api_blueprint.route('/patients/<patient_id>', methods=['DELETE'])
def delete_patient(patient_id):
    try:
        PatientDriver.delete(patient_id)
        return jsonify({'message': 'Patient deleted'}), 200
    except Exception as e:
        logging.error(f"Error deleting patient: {e}")
        return jsonify({'error': str(e)}), 500

# --------------------------------------------------
# Followup Endpoints
# --------------------------------------------------
@api_blueprint.route('/followups', methods=['GET'])
def get_followups():
    try:
        followups = FollowupDriver.find()
        data = [followup.to_json() for followup in followups]
        return jsonify(data), 200
    except Exception as e:
        logging.error(f"Error fetching followups: {e}")
        return jsonify({'error': str(e)}), 500

@api_blueprint.route('/followups', methods=['POST'])
def create_followup():
    """
    Expected JSON body:
    {
      "name": "Followup for Patient X",
      "overall_survival": 0.75
    }
    ---
    Note: Although your model includes 'name' and 'overall_survival', you may adjust this schema as needed.
    """
    try:
        data = request.get_json()
        name = data.get('name')
        overall_survival = data.get('overall_survival')
        if not name or overall_survival is None:
            return jsonify({'error': 'Missing required fields: name and overall_survival'}), 400

        followup = Followup(name=name, overall_survival=overall_survival)
        followup_id = FollowupDriver.insert(followup)
        return jsonify({'id': str(followup_id)}), 201
    except Exception as e:
        logging.error(f"Error creating followup: {e}")
        return jsonify({'error': str(e)}), 500

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
    except Exception as e:
        logging.error(f"Error updating followup: {e}")
        return jsonify({'error': str(e)}), 500

@api_blueprint.route('/followups/<followup_id>', methods=['DELETE'])
def delete_followup(followup_id):
    try:
        FollowupDriver.delete(followup_id)
        return jsonify({'message': 'Followup deleted'}), 200
    except Exception as e:
        logging.error(f"Error deleting followup: {e}")
        return jsonify({'error': str(e)}), 500
