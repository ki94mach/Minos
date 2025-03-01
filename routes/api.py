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
      "name": "First-line Treatment",
      "type": "Treatment",   // or "Regimen" or "Alternative"
      "regimen": {
         "name": "Regimen A",
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
              "name": "Regimen B",
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

        # Generate treatment hash based on name, regimen, and alternatives.
        hash_input = name + str(data.get('regimen', '')) + str(data.get('alternatives', ''))
        treatment_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()

        treatment = Treatment(
            name=name,
            type=_type,
            regimen=data.get('regimen'),
            alternatives=data.get('alternatives'),
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
        if 'regimen' in data:
            treatment.regimen = data['regimen']
        if 'alternatives' in data:
            treatment.alternatives = data['alternatives']

        # Recompute the treatment hash
        hash_input = treatment.name + str(treatment.regimen or '') + str(treatment.alternatives or '')
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
    Expected JSON body:
    {
      "size": 90000000,
      "characteristic": {
         "type": "Population",
         "name": "Iran"
      }
    }
    This endpoint:
      1. Creates a Characteristic.
      2. Builds a tree with a single root Node of type "characteristic".
      3. Auto-generates a tree_hash.
    """
    try:
        data = request.get_json()
        size = data.get('size')
        char_data = data.get('characteristic')
        if not size or not char_data:
            return jsonify({'error': 'Missing required fields: size and characteristic'}), 400

        # Create the master Characteristic document.
        char = Characteristic(char_type=char_data.get('type'), name=char_data.get('name'))
        CharacteristicDriver.insert(char)

        # Build a node for the patient tree.
        node = {
            "_id": ObjectId(),  # Generate a new ObjectId for the node
            "node_type": "characteristic",
            "parent_id": char.id,  # You may adjust this as needed
            "rate": 1.0,
            "characteristic_data": {
                "_id": ObjectId(),  # New _id for the embedded characteristic payload
                "char_type": char.char_type,
                "name": char.name
            },
            "children": []
        }
        # Generate a unique tree hash based on patient size and node structure.
        hash_input = f"{size}{node}".encode('utf-8')
        tree_hash = hashlib.sha256(hash_input).hexdigest()

        patient = PatientTree(size=size, tree=[node], tree_hash=tree_hash)
        patient_id = PatientDriver.insert(patient)
        return jsonify({'id': str(patient_id)}), 201
    except NotUniqueError:
        logging.error("Duplicate patient tree detected.")
        return jsonify({'error': "A patient with a similar tree structure already exists."}), 409
    except Exception as e:
        logging.error(f"Error creating patient: {e}")
        return jsonify({'error': "An unexpected error occurred while creating the patient."}), 500


@api_blueprint.route('/patients/<patient_id>', methods=['PUT'])
def update_patient(patient_id):
    """
    Expected JSON body (any subset):
    {
      "size": 1200
      // Additional updates to the tree can be added here.
    }
    """
    try:
        data = request.get_json()
        patient = PatientDriver.find(id=patient_id).first()
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404

        if 'size' in data:
            patient.size = data['size']
        # Updating the tree structure would require more complex logic.
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
