# routes/api.py
from models.tables import (
    Regimen, AlternativeTreatment
)

from flask import Blueprint, jsonify, request
import logging
import hashlib
from bson import ObjectId
from mongoengine.errors import NotUniqueError

from models.characteristic.driver import CharacteristicDriver
from models.drug.driver import DrugDriver
from models.followup.driver import FollowupDriver
from models.patient.driver import PatientDriver
from models.treatment.driver import TreatmentDriver

from models.tables import (Characteristic, Drug, Followup, PatientTree)
from models.tables import (Node, CharacteristicEmbedded,
                           TreatmentEmbedded, FollowupEmbedded)

from validators.api_validators import (CharacteristicCreate, CharacteristicUpdate,
                                       DrugCreate, DrugUpdate, TreatmentUpdate,
                                       TreatmentCreate, PatientCreate, PatientUpdate,
                                       AddNode, UpdateNode, FollowupUpdate, FollowupCreate)
from utils.validate_request import validate_request
from utils.sso_auth import sso_required
from utils.decorators import require_role, ADMIN
from utils.serialize import serialize_documents
from utils.api_errors import error_response
from utils.utils import Utils

from utils.business_rules import (
    find_node,
    remove_node,
    remove_node_subtree,
    validate_followup_treatment_parentage,
)
from utils.catalog_references import (
    find_characteristic_refs,
    find_drug_refs,
    find_treatment_refs,
)
from services.catalog_sync import (
    CatalogSyncError,
    catalog_put_after_master_update,
    catalog_sync_failure_details,
    log_catalog_delete_blocked,
    sync_characteristic,
    sync_drug,
    sync_treatment,
)

api_blueprint = Blueprint('api', __name__)


# --------------------------------------------------
# Characteristic Endpoints
# --------------------------------------------------
@api_blueprint.route('/characteristics', methods=['GET'])
@sso_required
def get_characteristics():
    try:
        characteristics = CharacteristicDriver.find()
        return jsonify(serialize_documents(characteristics)), 200
    except Exception as e:
        logging.error(f"Error fetching characteristics: {e}")
        return error_response("Failed to retrieve characteristics.", 500)
@api_blueprint.route('/characteristics', methods=['POST'])
@sso_required
@validate_request(CharacteristicCreate, location='json')
def create_characteristic(validated_data):
    """
    Expected JSON body:
    {
      "type": "Primary Indication",
      "name": "Lung Cancer"
    }
    Names and types will be automatically converted to title case.
    """
    try:
        # Data is already validated and transformed by Pydantic
        char_type = validated_data.type
        name = validated_data.name

        # Create the characteristic document
        char = Characteristic(char_type=char_type, name=name)
        char_id = CharacteristicDriver.insert(char)
        return jsonify({'id': str(char_id)}), 201
    except NotUniqueError:
        logging.error("Duplicate characteristic detected.")
        return error_response(f"A characteristic with type '{char_type}' and name '{name}' already exists.", 409)
    except Exception as e:
        logging.error(f"Error creating characteristic: {e}")
        return error_response("An unexpected error occurred while creating the characteristic.", 500)
@api_blueprint.route('/characteristics/<char_id>', methods=['PUT'])
@sso_required
@validate_request(CharacteristicUpdate, location='json')
def update_characteristic(validated_data, char_id):
    """
    Expected JSON body (any subset):
    {
      "type": "Updated Type",
      "name": "Updated Name"
    }
    Names and types will be automatically converted to title case.
    """
    try:
        char = CharacteristicDriver.find(id=char_id).first()
        if not char:
            return error_response('Characteristic not found', 404)
        # Update only provided fields, data is already validated and transformed
        updates = {}
        if validated_data.type is not None:
            updates['char_type'] = validated_data.type
        if validated_data.name is not None:
            updates['name'] = validated_data.name

        if not updates:
            return jsonify({
                'message': 'Characteristic updated',
                'patients_updated': 0,
                'node_count': 0,
            }), 200

        prev_name = char.name
        prev_type = char.char_type

        def apply_master() -> None:
            for key, value in updates.items():
                setattr(char, key, value)
            CharacteristicDriver.update(char)

        def restore_master() -> None:
            char.name = prev_name
            char.char_type = prev_type
            CharacteristicDriver.update(char)

        try:
            sync_result = catalog_put_after_master_update(
                entity_type="characteristic",
                entity_id=char_id,
                persist_master=apply_master,
                restore_master=restore_master,
                run_sync=lambda: sync_characteristic(
                    char_id,
                    name=char.name,
                    char_type=char.char_type,
                ),
                user_error=(
                    "Characteristic was not updated: failed to sync patient trees."
                ),
            )
        except CatalogSyncError as sync_exc:
            return error_response(
                sync_exc.message,
                500,
                details=catalog_sync_failure_details(sync_exc) or None,
            )

        return jsonify({
            'message': 'Characteristic updated',
            'patients_updated': sync_result.patients_updated,
            'node_count': sync_result.nodes_updated,
        }), 200
    except NotUniqueError:
        logging.error("Duplicate characteristic detected during update.")
        return error_response(
            "Update failed: A characteristic with the provided type and name already exists.",
            409,
        )
    except Exception as e:
        logging.error(f"Error updating characteristic: {e}")
        return error_response("An unexpected error occurred while updating the characteristic.", 500)
@api_blueprint.route('/characteristics/<char_id>/references', methods=['GET'])
@sso_required
def get_characteristic_references(char_id):
    try:
        char = CharacteristicDriver.find(id=char_id).first()
        if not char:
            return error_response('Characteristic not found', 404)
        return jsonify(find_characteristic_refs(char_id).to_api_dict()), 200
    except ValueError as ve:
        return error_response(str(ve), 400)
    except Exception as e:
        logging.error(f"Error fetching characteristic references: {e}")
        return error_response(
            "An unexpected error occurred while fetching references.",
            500,
        )
@api_blueprint.route('/characteristics/<char_id>', methods=['DELETE'])
@sso_required
@require_role([ADMIN])
def delete_characteristic(char_id):
    try:
        char = CharacteristicDriver.find(id=char_id).first()
        if not char:
            return error_response('Characteristic not found', 404)
        refs = find_characteristic_refs(char_id)
        if refs.has_references():
            log_catalog_delete_blocked("characteristic", char_id, refs)
            return jsonify({
                'error': 'Cannot delete characteristic: still referenced in patient trees.',
                'references': refs.to_delete_references(),
            }), 409
        CharacteristicDriver.delete(char_id)
        return jsonify({'message': 'Characteristic deleted'}), 200
    except ValueError as ve:
        return error_response(str(ve), 400)
    except Exception as e:
        logging.error(f"Error deleting characteristic: {e}")
        return error_response("An unexpected error occurred while deleting the characteristic.", 500)
# --------------------------------------------------
# Drug Endpoints
# --------------------------------------------------
@api_blueprint.route('/drugs', methods=['GET'])
@sso_required
def get_drugs():
    try:
        drugs = DrugDriver.find()
        return jsonify(serialize_documents(drugs)), 200
    except Exception as e:
        logging.error(f"Error fetching drugs: {e}")
        return error_response("Failed to retrieve drugs.", 500)
@api_blueprint.route('/drugs', methods=['POST'])
@sso_required
@validate_request(DrugCreate, location='json')
def create_drug(validated_data):
    """
    Expected JSON body:
    {
      "name": "Carboplatin",
      "strength": 450,
      "unit": "mg"
    }
    Name will be automatically converted to title case and unit to lowercase.
    """
    try:
        # Data is already validated and transformed by Pydantic
        name = validated_data.name
        strength = validated_data.strength
        unit = validated_data.unit

        drug = Drug(name=name, strength=strength, unit=unit)
        drug_id = DrugDriver.insert(drug)
        return jsonify({'id': str(drug_id)}), 201
    except NotUniqueError:
        logging.error("Duplicate drug detected.")
        return error_response(
            f"Drug with name '{name}', strength '{strength}', and unit '{unit}' already exists.",
            409,
        )
    except Exception as e:
        logging.error(f"Error creating drug: {e}")
        return error_response("An unexpected error occurred while creating the drug.", 500)
@api_blueprint.route('/drugs/<drug_id>', methods=['PUT'])
@sso_required
@validate_request(DrugUpdate, location='json')
def update_drug(validated_data, drug_id):
    """
    Expected JSON body (any subset):
    {
      "name": "Updated name",
      "strength": 450,
      "unit": "mg"
    }
    Name will be automatically converted to title case and unit to lowercase if provided.
    """
    try:
        drug = DrugDriver.find(id=drug_id).first()
        if not drug:
            return error_response('Drug not found', 404)
        # Update only provided fields, data is already validated and transformed
        provided = validated_data.model_dump(exclude_unset=True)
        updates = {}
        if 'name' in provided:
            updates['name'] = provided['name']
        if 'strength' in provided:
            updates['strength'] = provided['strength']
        if 'unit' in provided:
            updates['unit'] = provided['unit']

        if not updates:
            return jsonify({
                'message': 'Drug updated',
                'patients_updated': 0,
                'node_count': 0,
                'treatments_updated': 0,
            }), 200

        prev_name = drug.name
        prev_strength = drug.strength
        prev_unit = drug.unit

        def apply_master() -> None:
            for key, value in updates.items():
                setattr(drug, key, value)
            DrugDriver.update(drug)

        def restore_master() -> None:
            drug.name = prev_name
            drug.strength = prev_strength
            drug.unit = prev_unit
            DrugDriver.update(drug)

        try:
            sync_result = catalog_put_after_master_update(
                entity_type="drug",
                entity_id=drug_id,
                persist_master=apply_master,
                restore_master=restore_master,
                run_sync=lambda: sync_drug(
                    drug_id,
                    name=drug.name,
                    strength=drug.strength,
                    unit=drug.unit,
                ),
                user_error=(
                    "Drug was not updated: failed to sync patient trees and treatments."
                ),
            )
        except CatalogSyncError as sync_exc:
            return error_response(
                sync_exc.message,
                500,
                details=catalog_sync_failure_details(sync_exc) or None,
            )

        return jsonify({
            'message': 'Drug updated',
            'patients_updated': sync_result.patients_updated,
            'node_count': sync_result.nodes_updated,
            'treatments_updated': sync_result.treatments_updated,
        }), 200
    except NotUniqueError:
        logging.error("Duplicate drug detected during update.")
        return error_response(
            "Update failed: A drug with the provided name, strength, and unit already exists.",
            409,
        )
    except Exception as e:
        logging.error(f"Error updating drug: {e}")
        return error_response("An unexpected error occurred while updating the drug.", 500)
@api_blueprint.route('/drugs/<drug_id>/references', methods=['GET'])
@sso_required
def get_drug_references(drug_id):
    try:
        drug = DrugDriver.find(id=drug_id).first()
        if not drug:
            return error_response('Drug not found', 404)
        return jsonify(find_drug_refs(drug_id).to_api_dict()), 200
    except ValueError as ve:
        return error_response(str(ve), 400)
    except Exception as e:
        logging.error(f"Error fetching drug references: {e}")
        return error_response(
            "An unexpected error occurred while fetching references.",
            500,
        )
@api_blueprint.route('/drugs/<drug_id>', methods=['DELETE'])
@sso_required
@require_role([ADMIN])
def delete_drug(drug_id):
    try:
        drug = DrugDriver.find(id=drug_id).first()
        if not drug:
            return error_response('Drug not found', 404)
        refs = find_drug_refs(drug_id)
        if refs.has_references():
            log_catalog_delete_blocked("drug", drug_id, refs)
            return jsonify({
                'error': 'Cannot delete drug: still referenced in patient trees or treatments.',
                'references': refs.to_delete_references(),
            }), 409
        DrugDriver.delete(drug_id)
        return jsonify({'message': 'Drug deleted'}), 200
    except ValueError as ve:
        return error_response(str(ve), 400)
    except Exception as e:
        logging.error(f"Error deleting drug: {e}")
        return error_response("An unexpected error occurred while deleting the drug.", 500)
# --------------------------------------------------
# Treatment Endpoints
# --------------------------------------------------
@api_blueprint.route('/treatments', methods=['GET'])
@sso_required
def get_treatments():
    try:
        treatments = TreatmentDriver.find()
        return jsonify(serialize_documents(treatments)), 200
    except Exception as e:
        print(e)
        logging.error(f"Error fetching treatments: {e}")
        return error_response("Failed to retrieve treatments.", 500)
@api_blueprint.route('/treatments', methods=['POST'])
@sso_required
@validate_request(TreatmentCreate, location='json')
def create_treatment(validated_data: TreatmentCreate):
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
        payload = validated_data.model_dump(by_alias=True)
        
        treatment_type = payload["type"]
        raw_regimen = payload.get("regimen")
        raw_alts = payload.get("alternatives", [])

        from models.tables import Treatment as TreatmentDoc
        from models.tables import Regimen as RegimenDoc
        from models.tables import AlternativeTreatment as AltTreatDoc

        regimen_doc = None
        alts_docs = []

        if treatment_type == "Regimen":
            if not raw_regimen:
                return error_response('Regimen is required for treatment type "Regimen"', 400)
            regimen_doc = RegimenDoc(**raw_regimen)
        
        elif treatment_type == "Alternative":
            if not raw_alts:
                return error_response('Alternatives are required for treatment type "Alternative"', 400)
            for alt in raw_alts:
                alt_regimen = alt["regimen"]
                alt_regimen_doc = RegimenDoc(**alt_regimen)
                alts_docs.append(
                    AltTreatDoc(
                        _id=alt["_id"],
                        name=alt["name"],
                        regimen=alt_regimen_doc,
                        ratio=alt["ratio"]
                    )
                )

        hash_input = payload["name"] + treatment_type + str(raw_regimen) + str(raw_alts)
        treatment_hash = hashlib.sha256(hash_input.encode()).hexdigest()

        treatment = TreatmentDoc(
            name=payload["name"],
            type=treatment_type,
            regimen=regimen_doc,
            alternatives=alts_docs,
            treatment_hash=treatment_hash
        )

        treatment_id = TreatmentDriver.insert(treatment)
        return jsonify({"id": str(treatment_id)}), 201

    except NotUniqueError:
        logging.error("Duplicate treatment detected.")
        return error_response("A treatment with similar properties already exists", 409)
    except Exception as e:
        logging.error(f"Error creating treatment: {e}")
        return error_response(str(e), 500)
@api_blueprint.route('/treatments/<treatment_id>', methods=['PUT'])
@sso_required
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
            return error_response('Treatment not found', 404)

        had_update = (
            validated_data.name is not None
            or validated_data.type is not None
            or validated_data.regimen is not None
            or validated_data.alternatives is not None
        )
        if not had_update:
            return jsonify({
                'message': 'Treatment updated',
                'patients_updated': 0,
                'node_count': 0,
            }), 200

        snapshot = treatment.to_mongo()

        def apply_master() -> None:
            payload = validated_data.model_dump(by_alias=True, exclude_none=True)
            if validated_data.name is not None:
                treatment.name = payload["name"]
            if validated_data.type is not None:
                treatment.type = payload["type"]
            if validated_data.regimen is not None:
                treatment.regimen = Regimen(**payload["regimen"])
                treatment.alternatives = []
            elif validated_data.alternatives is not None:
                treatment.alternatives = [
                    AlternativeTreatment(**alt)
                    for alt in payload["alternatives"]
                ]
                treatment.regimen = None
            hash_input = (
                treatment.name
                + treatment.type
                + str(treatment.regimen or '')
                + str(treatment.alternatives or '')
            )
            treatment.treatment_hash = hashlib.sha256(
                hash_input.encode('utf-8')
            ).hexdigest()
            TreatmentDriver.update(treatment)

        def restore_master() -> None:
            treatment.name = snapshot['name']
            treatment.type = snapshot['type']
            if snapshot.get('regimen'):
                treatment.regimen = Regimen(**snapshot['regimen'])
            else:
                treatment.regimen = None
            if snapshot.get('alternatives'):
                treatment.alternatives = [
                    AlternativeTreatment(**alt) for alt in snapshot['alternatives']
                ]
            else:
                treatment.alternatives = []
            treatment.treatment_hash = snapshot['treatment_hash']
            TreatmentDriver.update(treatment)

        try:
            sync_result = catalog_put_after_master_update(
                entity_type="treatment",
                entity_id=treatment_id,
                persist_master=apply_master,
                restore_master=restore_master,
                run_sync=lambda: sync_treatment(treatment_id),
                user_error=(
                    "Treatment was not updated: failed to sync patient trees."
                ),
            )
        except CatalogSyncError as sync_exc:
            return error_response(
                sync_exc.message,
                500,
                details=catalog_sync_failure_details(sync_exc) or None,
            )

        return jsonify({
            'message': 'Treatment updated',
            'patients_updated': sync_result.patients_updated,
            'node_count': sync_result.nodes_updated,
        }), 200
    except NotUniqueError:
        logging.error("Duplicate treatment detected during update.")
        return error_response("Update failed: A treatment with similar properties already exists.", 409)
    except Exception as e:
        logging.error(f"Error updating treatment: {e}")
        return error_response("An unexpected error occurred while updating the treatment.", 500)
@api_blueprint.route('/treatments/<treatment_id>/references', methods=['GET'])
@sso_required
def get_treatment_references(treatment_id):
    try:
        treatment = TreatmentDriver.find(id=treatment_id).first()
        if not treatment:
            return error_response('Treatment not found', 404)
        return jsonify(find_treatment_refs(treatment_id).to_api_dict()), 200
    except ValueError as ve:
        return error_response(str(ve), 400)
    except Exception as e:
        logging.error(f"Error fetching treatment references: {e}")
        return error_response(
            "An unexpected error occurred while fetching references.",
            500,
        )
@api_blueprint.route('/treatments/<treatment_id>', methods=['DELETE'])
@sso_required
@require_role([ADMIN])
def delete_treatment(treatment_id):
    try:
        treatment = TreatmentDriver.find(id=treatment_id).first()
        if not treatment:
            return error_response('Treatment not found', 404)
        refs = find_treatment_refs(treatment_id)
        if refs.has_references():
            log_catalog_delete_blocked("treatment", treatment_id, refs)
            return jsonify({
                'error': 'Cannot delete treatment: still referenced in patient trees.',
                'references': refs.to_delete_references(),
            }), 409
        TreatmentDriver.delete(treatment_id)
        return jsonify({'message': 'Treatment deleted'}), 200
    except ValueError as ve:
        return error_response(str(ve), 400)
    except Exception as e:
        logging.error(f"Error deleting treatment: {e}")
        return error_response("An unexpected error occurred while deleting the treatment.", 500)
# --------------------------------------------------
# Patient Endpoints
# --------------------------------------------------
@api_blueprint.route('/patients', methods=['GET'])
@sso_required
def get_patients():
    try:
        patients = PatientDriver.find()
        return jsonify(serialize_documents(patients)), 200
    except Exception as e:
        print(e)
        logging.error(f"Error fetching patients: {e}")
        return error_response("Failed to retrieve patients.", 500)
@api_blueprint.route('/patients', methods=['POST'])
@sso_required
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
        # Get the validated node data
        node_data = validated_data.node.model_dump(by_alias=True)
        
        # Process and validate the entire node payload including embedded data
        if '_id' not in node_data:
            node_data['_id'] = ObjectId()

        def convert_ids_recursively(node):
             if isinstance(node, dict):
                # Assign _id if missing
                if '_id' not in node:
                    node['_id'] = ObjectId()
                elif isinstance(node['_id'], str):
                    try:
                        node['_id'] = ObjectId(node['_id'])
                    except Exception:
                        pass  # Let MongoEngine raise a validation error if invalid

                # Convert parent_id if needed
                if 'parent_id' in node and isinstance(node['parent_id'], str):
                    try:
                        node['parent_id'] = ObjectId(node['parent_id'])
                    except Exception:
                        pass

                # Recurse for children
                if 'children' in node and isinstance(node['children'], list):
                    for child in node['children']:
                        convert_ids_recursively(child)

        # use this just before instantiating the Node
        convert_ids_recursively(node_data)

        new_node = Node(**node_data)
        
        tree_hash = Utils.compute_tree_hash(new_node)

        # Create and save the PatientTree
        patient_tree = PatientTree(
            tree=new_node,
            tree_hash=tree_hash
        )
        patient_id = PatientDriver.insert(patient_tree)
        
        return jsonify({'id': str(patient_id)}), 201

    except ValueError as ve:
        logging.error(f"Validation error creating patient: {ve}")
        return error_response(str(ve), 400)
    except NotUniqueError:
        logging.error("Duplicate patient tree detected.")
        return error_response("A patient with a similar tree structure already exists.", 409)
    except Exception as e:
        logging.error(f"Error creating patient: {e}")
        return error_response("An unexpected error occurred while creating the patient.", 500)
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
            followup_id = followup_data.get('_id')
            if not followup_id:
                raise ValueError("followup_data must include '_id'")
            master = FollowupDriver.find(id=ObjectId(followup_id)).first()
            if not master:
                raise ValueError(f"Followup with _id {followup_id} not found")
            new_node.followup_data = FollowupEmbedded(
                _id=ObjectId(master.id),
                patient_id=master.patient_id,
                node_parent_id=master.parent_id,
                overall_survival=master.overall_survival,
            )

    # Recursively process any children.
    for child_dict in node_dict.get('children', []):
        child_node = create_node_from_dict(child_dict, parent_id=node_id)
        new_node.children.append(child_node)

    return new_node

# -------------------------------------------------------------------
@api_blueprint.route('/patients/<patient_id>/add_node', methods=['POST'])
@sso_required
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
    ]
}
    This endpoint:
      1. Fetches the PatientTree document.
      2. Locates the parent node (if provided) by recursively traversing the tree.
      3. Appends the new node (with processed children) to the parent's children list (or as a child of the root if no parent_node_id is provided).
      4. Recomputes the tree_hash over the entire tree.
      5. Persists via PatientDriver.update.
    """
    try:
        # Get the validated node data
        new_node_data = validated_data.node.model_dump(by_alias=True)
        parent_node_id = validated_data.parent_node_id
        
        # # Add children to node data if provided
        # if validated_data.children:
        #     new_node_data['children'] = [
        #         child.model_dump(by_alias=True) for child in validated_data.children
        #     ]
        
        patient_tree = PatientDriver.find(id=patient_id).first()
        if not patient_tree:
            return error_response('Patient not found', 404)
        if '_id' not in new_node_data:
            new_node_data['_id'] = ObjectId()
        if parent_node_id:
            new_node_data['parent_id'] = ObjectId(str(parent_node_id))

        # new_node = Node(**new_node_data)
        
        wrapper = {
            'node': validated_data.node.model_dump(
                by_alias=True,
                exclude_none=True
            )
        }

        if validated_data.children:
            wrapper['node']['children'] = [
                c.model_dump(by_alias=True, exclude_none=True) for c in validated_data.children
            ]
        new_node = create_node_from_dict(wrapper,
                                parent_id=ObjectId(parent_node_id)
                                if parent_node_id else None)
        
        if parent_node_id:
            parent_node = find_node(patient_tree.tree, str(parent_node_id))
            if not parent_node:
                return error_response('Parent node not found', 404)
            parent_node.children.append(new_node)
        else:
            patient_tree.tree.children.append(new_node)

        validate_followup_treatment_parentage(patient_tree.tree)

        patient_tree.tree_hash = Utils.compute_tree_hash(patient_tree.tree)
        def fix_tree_node(node):
            # Fix characteristic_data.char_type
            if getattr(node, 'node_type', None) == 'characteristic':
                char_data = getattr(node, 'characteristic_data', None)
                if char_data:
                    if not char_data or not getattr(char_data, 'char_type', None):
                        raise ValueError(f"Missing required 'char_type' for characteristic node {getattr(node, '_id', 'unknown')}")


            # Recursively fix children
            for child in getattr(node, 'children', []):
                fix_tree_node(child)

        fix_tree_node(patient_tree.tree)
        PatientDriver.update(patient_tree)
        
        return jsonify({
            'message': 'Node added successfully',
            'tree_hash': patient_tree.tree_hash
        }), 200

    except ValueError as ve:
        logging.error(f"Validation error adding node: {ve}")
        return error_response(str(ve), 400)
    except Exception as e:
        logging.error(f"Error adding node: {e}")
        return error_response("An unexpected error occurred while adding the node.", 500)
@api_blueprint.route('/patients/<patient_id>', methods=['PUT'])
@sso_required
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
    Updates the patient tree and recomputes tree_hash. Root node size lives on tree.size.
    """
    try:
        patient = PatientDriver.find(id=patient_id).first()
        if not patient:
            return error_response('Patient not found', 404)

        try:
            new_tree = create_node_from_dict(
                validated_data.tree.model_dump(by_alias=True, exclude_none=True)
            )
            validate_followup_treatment_parentage(new_tree)
            patient.tree = new_tree
            patient.tree_hash = Utils.compute_tree_hash(new_tree)
        except ValueError as ve:
            logging.error(f"Validation error updating patient tree: {ve}")
            return error_response(str(ve), 400)
        except Exception as e:
            logging.error(f"Error updating patient tree: {e}")
            return error_response("Invalid tree structure provided.", 400)

        PatientDriver.update(patient)

        return jsonify({'message': 'Patient updated'}), 200
    except Exception as e:
        logging.error(f"Error updating patient: {e}")
        return error_response("An unexpected error occurred while updating the patient.", 500)
@api_blueprint.route('/patients/<patient_id>/node/<node_id>', methods=['PUT'])
@sso_required
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
      4. Validates follow-up parentage, recomputes tree_hash, and persists.
    """
    try:
        if not validated_data:
            return error_response('No update data provided.', 400)
        # Fetch the PatientTree document.
        patient_tree = PatientDriver.find(id=patient_id).first()
        if not patient_tree:
            return error_response('Patient not found.', 404)

        target_node = find_node(patient_tree.tree, node_id)
        if not target_node:
            return error_response('Node not found in patient tree.', 404)
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

        # Optionally, update children if provided (convert Pydantic → MongoEngine embeds).
        if validated_data.children is not None:
            target_node.children = [
                create_node_from_dict(
                    child.model_dump(by_alias=True, exclude_none=True),
                    parent_id=target_node._id,
                )
                for child in validated_data.children
            ]

        validate_followup_treatment_parentage(patient_tree.tree)

        patient_tree.tree_hash = Utils.compute_tree_hash(patient_tree.tree)
        PatientDriver.update(patient_tree)

        return jsonify({'message': 'Node updated successfully', 'tree_hash': patient_tree.tree_hash}), 200

    except ValueError as ve:
        logging.error(f"Validation error updating node: {ve}")
        return error_response(str(ve), 400)
    except Exception as e:
        logging.error(f"Error updating node: {e}")
        return error_response("An unexpected error occurred while updating the node.", 500)
@api_blueprint.route('/patients/<patient_id>', methods=['DELETE'])
@sso_required
@require_role([ADMIN])
def delete_patient(patient_id):
    """
    Deletes the entire PatientTree document.
    """
    try:
        PatientDriver.delete(patient_id)
        return jsonify({'message': 'Patient deleted'}), 200
    except Exception as e:
        logging.error(f"Error deleting patient: {e}")
        return error_response("An unexpected error occurred while deleting the patient.", 500)
@api_blueprint.route('/patients/<patient_id>/node/<node_id>', methods=['DELETE'])
@sso_required
def delete_node(patient_id, node_id):
    """
    Deletes a single non-root node from the PatientTree.

    Query ``cascade`` (optional): when ``true``, ``1``, or ``yes``, removes the node
    and its entire descendant subtree. Otherwise (default), children are spliced into
    the parent's children list and their parent_id fields are updated.

    To delete an entire patient tree, use DELETE /api/patients/<patient_id> (ADMIN).

    Expected URL parameters:
      - patient_id: The PatientTree document's id.
      - node_id: The _id of the node to delete (as a string).

    This endpoint:
      1. Fetches the PatientTree document.
      2. Rejects node_id equal to the embedded tree root (400).
      3. Removes the target node (splice or cascade per query).
      4. Validates follow-up parentage, recomputes tree_hash, and persists.
    """
    try:
        cascade = request.args.get('cascade', '').lower() in ('1', 'true', 'yes')

        # Fetch the PatientTree document.
        patient_tree = PatientDriver.find(id=patient_id).first()
        if not patient_tree:
            return error_response('Patient not found', 404)
        if str(patient_tree.tree._id) == str(node_id):
            return error_response(
                'Cannot delete the patient tree root via this endpoint; '
                'use DELETE /api/patients/<patient_id> instead.',
                400,
            )

        remove_fn = remove_node_subtree if cascade else remove_node
        removed = remove_fn(patient_tree.tree, node_id)
        if not removed:
            return error_response('Node not found in patient tree', 404)

        validate_followup_treatment_parentage(patient_tree.tree)

        patient_tree.tree_hash = Utils.compute_tree_hash(patient_tree.tree)
        PatientDriver.update(patient_tree)

        message = (
            'Node and descendants deleted successfully'
            if cascade
            else 'Node deleted successfully'
        )
        return jsonify({'message': message, 'tree_hash': patient_tree.tree_hash}), 200

    except ValueError as ve:
        logging.error(f"Validation error deleting node: {ve}")
        return error_response(str(ve), 400)
    except Exception as e:
        logging.error(f"Error deleting node: {e}")
        return error_response("An unexpected error occurred while deleting the node.", 500)
# --------------------------------------------------
# Followup Endpoints
# --------------------------------------------------
@api_blueprint.route('/followups', methods=['GET'])
@sso_required
def get_followups():
    """
    Retrieve all followups.
    Legacy: Followups were created using names like "Followup for Patient X" along with overall_survival.
    """
    try:
        followups = FollowupDriver.find()
        return jsonify(serialize_documents(followups)), 200
    except Exception as e:
        logging.error(f"Error fetching followups: {e}")
        return error_response("Failed to retrieve followups.", 500)
@api_blueprint.route('/followups', methods=['POST'])
@sso_required
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
        # Data is already validated by Pydantic including patient and parent node existence
        name = validated_data.name
        overall_survival = validated_data.overall_survival
        patient_id = validated_data.patient_id
        parent_id = validated_data.parent_id

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
        return error_response(
            "A followup with the given name, overall survival, patient, and parent already exists.",
            409,
        )
    except Exception as e:
        logging.error(f"Error creating followup: {e}")
        return error_response(str(e), 500)
@api_blueprint.route('/followups/<followup_id>', methods=['PUT'])
@sso_required
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
            return error_response('Followup not found', 404)
        # Update only provided fields, data is already validated
        updates = {}
        if validated_data.name is not None:
            updates['name'] = validated_data.name
        if validated_data.overall_survival is not None:
            updates['overall_survival'] = validated_data.overall_survival

        if updates:
            for key, value in updates.items():
                setattr(followup, key, value)
            FollowupDriver.update(followup)

        return jsonify({'message': 'Followup updated'}), 200
    except NotUniqueError:
        logging.error("Duplicate followup detected during update.")
        return error_response("Update failed: A followup with similar properties already exists.", 409)
    except Exception as e:
        logging.error(f"Error updating followup: {e}")
        return error_response("An unexpected error occurred while updating the followup.", 500)
@api_blueprint.route('/followups/<followup_id>', methods=['DELETE'])
@sso_required
@require_role([ADMIN])
def delete_followup(followup_id):
    try:
        FollowupDriver.delete(followup_id)
        return jsonify({'message': 'Followup deleted'}), 200
    except Exception as e:
        logging.error(f"Error deleting followup: {e}")
        return error_response("An unexpected error occurred while deleting the followup.", 500)