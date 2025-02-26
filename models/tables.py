from mongoengine import (
    Document,
    EmbeddedDocument,
    StringField,
    FloatField,
    IntField,
    LongField,
    ListField,
    EmbeddedDocumentField,
    ObjectIdField
)


# =============================================================================
# Embedded Payloads for Node Data (used for tree assembly)
# =============================================================================

# Embedded version of a characteristic node
class CharacteristicEmbedded(EmbeddedDocument):
    char_type = StringField(required=True, db_field="type")
    name = StringField(required=True)
    size = FloatField(required=False)
    rate = FloatField(required=False)


# Embedded version of a drug (used within treatments)
class DrugEmbedded(EmbeddedDocument):
    _id = ObjectIdField(required=True)
    name = StringField(required=True)
    strength = StringField(required=True)


class TreatmentDrug(EmbeddedDocument):
    _id = ObjectIdField(required=True)
    drug = EmbeddedDocumentField(DrugEmbedded, required=True)
    annual_patient_con = IntField(required=True)


class Regimen(EmbeddedDocument):
    _id = ObjectIdField(required=True)
    name = StringField(required=True)
    drugs = ListField(EmbeddedDocumentField(TreatmentDrug), required=True)


class AlternativeTreatment(EmbeddedDocument):
    _id = ObjectIdField(required=True)
    regimen = EmbeddedDocumentField(Regimen, required=True)
    ratio = FloatField(required=True)


# Embedded version of a treatment node
class TreatmentEmbedded(EmbeddedDocument):
    name = StringField(required=True)
    regimen = EmbeddedDocumentField(Regimen, required=False)
    alternatives = ListField(EmbeddedDocumentField(AlternativeTreatment), required=False)


# Embedded version of a followup node
class FollowupEmbedded(EmbeddedDocument):
    patient_id = LongField(required=True)
    overall_survival = FloatField(required=True)


# =============================================================================
# Master Node Collections (Nodes created independently)
# =============================================================================

class Characteristic(Document):
    char_type = StringField(required=True, db_field="type")
    name = StringField(required=True)
    meta = {
        'collection': 'characteristics',
        'indexes': [{'fields': ['char_type', 'name'], 'unique': True}]
    }


class Drug(Document):
    name = StringField(required=True)
    strength = StringField(required=True)
    meta = {
        'collection': 'drugs',
        'indexes': [{'fields': ['name', 'strength'], 'unique': True}]
    }


class Treatment(Document):
    name = StringField(required=True)
    regimen = EmbeddedDocumentField(Regimen, required=False)
    alternatives = ListField(EmbeddedDocumentField(AlternativeTreatment), required=False)
    # Field to store computed hash value.
    treatment_hash = StringField(required=True, unique=True)

    meta = {
        'collection': 'treatments',
        'indexes': [{'fields': ['treatment_hash'], 'unique': True}]
    }


class Followup(Document):
    name = StringField(required=True)
    overall_survival = FloatField(required=True)
    meta = {
        'collection': 'followups',
        'indexes': [{'fields': ['name', 'overall_survival'], 'unique': True}]
    }


# =============================================================================
# Tree Node Embedded Document (for building a heterogeneous tree)
# =============================================================================

class Node(EmbeddedDocument):
    # Node type indicates which master node is represented:
    # 'treatment', 'followup', or 'characteristic'
    node_type = StringField(required=True, choices=['treatment', 'followup', 'characteristic'])
    # Reference to the master node's ObjectId (created independently)
    ref_id = ObjectIdField(required=True)
    rate = FloatField(required=True)

    # Embedded payload: one of these should be populated based on node_type.
    treatment_data = EmbeddedDocumentField(TreatmentEmbedded, required=False)
    followup_data = EmbeddedDocumentField(FollowupEmbedded, required=False)
    characteristic_data = EmbeddedDocumentField(CharacteristicEmbedded, required=False)

    # Allow a node to have children to form a recursive tree.
    children = ListField(EmbeddedDocumentField('TreeNode'))


# =============================================================================
# Patient Document (Assembly of a Tree from Selected Nodes)
# =============================================================================

class PatientTree(Document):
    size = FloatField(required=True)
    # The 'tree' field holds the entire heterogeneous tree (a list of root TreeNodes).
    tree = ListField(EmbeddedDocumentField(Node))
    tree_hash = StringField(required=True, unique=True)

    meta = {'collection': 'patients'}
