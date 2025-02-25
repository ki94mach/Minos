# routes/api.py
from flask import Blueprint, jsonify, request
import logging
from models.patient.driver import PatientDriver
from models.characteristic.driver import Characteristic
from models.drug.driver import DrugDriver
from models.treatment.driver import TreatmentDriver
from models.followup.driver import FollowupDriver


api_blueprint = Blueprint('api', __name__)


@api_blueprint.route('/patients', methods=['GET'])
def get_patients():
    try:
        # Retrieve all patients using the driver
        patients = PatientDriver.find()
        # MongoEngine documents have a built-in to_json method
        data = [patient.to_json() for patient in patients]
        return jsonify(data), 200
    except Exception as e:
        logging.error(f"Error fetching patients: {e}")
        return jsonify({'error': str(e)}), 500


@api_blueprint.route('/patients', methods=['POST'])
def create_patient():
    try:
        # Parse JSON payload from the client
        data = request.get_json()
        size = data.get('size')
        char_data = data.get('characteristic')  # Expected to be a dict with 'type' and 'name'
        if not size or not char_data:
            return jsonify({'error': 'Missing required fields: size and characteristic'}), 400

        # Create a characteristic document first
        char = Characteristic(char_type=char_data.get('type'), name=char_data.get('name'))
        char.save()

        # Create the patient document. For simplicity, we embed the characteristic
        # Note: In your MongoEngine models for Patient, you defined an EmbeddedDocument for characteristics.
        # Here we build a minimal embedded document dictionary.
        patient = Patient(
            size=size,
            chars=[{'embedded': {'char_type': char.char_type, 'name': char.name, 'size': size, 'rate': 1.0}}]
        )
        PatientDriver.insert(patient)
        return jsonify({'id': str(patient.id)}), 201
    except Exception as e:
        logging.error(f"Error creating patient: {e}")
        return jsonify({'error': str(e)}), 500


@api_blueprint.route('/patients/<patient_id>', methods=['PUT'])
def update_patient(patient_id):
    try:
        data = request.get_json()
        # Retrieve the existing patient
        patient = PatientDriver.find(id=patient_id).first()
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404

        # Update fields as needed; for example, update size.
        if 'size' in data:
            patient.size = data['size']
        # If you need to update embedded characteristics or treatments, add additional logic here.

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
