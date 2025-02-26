# routes/api.py
from flask import Blueprint, jsonify, request
import logging

# Import driver classes from their directories
from models.characteristic.driver import CharacteristicDriver
from models.drug.driver import DrugDriver
from models.followup.driver import FollowupDriver
from models.patient.driver import PatientDriver
from models.treatment.driver import TreatmentDriver

# Import model classes from tables for instance creation.
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
    try:
        data = request.get_json()
        name = data.get('name')
        if not name:
            return jsonify({'error': 'Missing required field: name'}), 400

        # For demo purposes, we assign the treatment hash as the name.
        # In production, compute a proper hash based on treatment details.
        treatment = Treatment(name=name, treatment_hash=name)
        treatment_id = TreatmentDriver.insert(treatment)
        return jsonify({'id': str(treatment_id)}), 201
    except Exception as e:
        logging.error(f"Error creating treatment: {e}")
        return jsonify({'error': str(e)}), 500


@api_blueprint.route('/treatments/<treatment_id>', methods=['PUT'])
def update_treatment(treatment_id):
    try:
        data = request.get_json()
        treatment = TreatmentDriver.find(id=treatment_id).first()
        if not treatment:
            return jsonify({'error': 'Treatment not found'}), 404

        if 'name' in data:
            treatment.name = data['name']
        # Additional fields (e.g., regimen or alternatives) can be handled here.
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
# Patient Endpoints (using PatientTree)
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
    try:
        data = request.get_json()
        size = data.get('size')
        # Expect a characteristic as a dict with "type" and "name" for the initial node.
        char_data = data.get('characteristic')
        if not size or not char_data:
            return jsonify({'error': 'Missing required fields: size and characteristic'}), 400

        # Create the characteristic using its driver
        char = Characteristic(char_type=char_data.get('type'), name=char_data.get('name'))
        char_id = CharacteristicDriver.insert(char)

        # Build the patient (PatientTree) document.
        # The tree is constructed as a list of nodes; here we create a simple node for the characteristic.
        patient = PatientTree(
            size=size,
            tree=[{
                'node_type': 'characteristic',
                'ref_id': char_id,
                'rate': 1.0,
                'characteristic_data': {
                    'char_type': char.char_type,
                    'name': char.name,
                    'size': size,
                    'rate': 1.0
                },
                'children': []
            }],
            tree_hash=str(size)  # For demonstration, using the size as the hash; replace with a real hash computation.
        )
        patient_id = PatientDriver.insert(patient)
        return jsonify({'id': str(patient_id)}), 201
    except Exception as e:
        logging.error(f"Error creating patient: {e}")
        return jsonify({'error': str(e)}), 500


@api_blueprint.route('/patients/<patient_id>', methods=['PUT'])
def update_patient(patient_id):
    try:
        data = request.get_json()
        patient = PatientDriver.find(id=patient_id).first()
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404

        if 'size' in data:
            patient.size = data['size']
        # Additional logic to update the tree can be added here.
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
    try:
        data = request.get_json()
        patient_id = data.get('patient_id')
        overall_survival = data.get('overall_survival')
        if patient_id is None or overall_survival is None:
            return jsonify({'error': 'Missing required fields: patient_id and overall_survival'}), 400

        followup = Followup(patient_id=patient_id, overall_survival=overall_survival)
        followup_id = FollowupDriver.insert(followup)
        return jsonify({'id': str(followup_id)}), 201
    except Exception as e:
        logging.error(f"Error creating followup: {e}")
        return jsonify({'error': str(e)}), 500


@api_blueprint.route('/followups/<followup_id>', methods=['PUT'])
def update_followup(followup_id):
    try:
        data = request.get_json()
        followup = FollowupDriver.find(id=followup_id).first()
        if not followup:
            return jsonify({'error': 'Followup not found'}), 404

        if 'patient_id' in data:
            followup.patient_id = data['patient_id']
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
