# tables.py
from mongoengine import (
    Document,
    EmbeddedDocument,
    StringField,
    FloatField,
    IntField,
    LongField,
    ListField,
    EmbeddedDocumentField
)


# -------------------------------
# Collection: characteristic
# -------------------------------
class Characteristic(Document):
    char_type = StringField(required=True, db_field="type")
    name = StringField(required=True)

    meta = {'collection': 'characteristics'}

    def __str__(self):
        return f"Characteristic(type='{self.char_type}', name='{self.name}')"


# -------------------------------
# Collection: drugs
# -------------------------------
class Drug(Document):
    name = StringField(required=True)
    strength = StringField(required=True)

    meta = {'collection': 'drugs'}

    def __str__(self):
        return f"Drug(name='{self.name}', strength='{self.strength}')"


# -------------------------------
# Collection: followups
# -------------------------------
class Followup(Document):
    patient_id = LongField(required=True)
    overall_survival = FloatField(required=True)

    meta = {'collection': 'followups'}

    def __str__(self):
        return f"Followup(patient_id={self.patient_id}, overall_survival={self.overall_survival})"


# -------------------------------
# Embedded Documents for Treatments
# -------------------------------
class DrugEmbedded(EmbeddedDocument):
    name = StringField(required=True)
    strength = StringField(required=True)

    def __str__(self):
        return f"DrugEmbedded(name='{self.name}', strength='{self.strength}')"


class TreatmentDrug(EmbeddedDocument):
    drug = EmbeddedDocumentField(DrugEmbedded, required=True)
    annual_patient_con = IntField(required=True)

    def __str__(self):
        return f"TreatmentDrug(drug={self.drug}, annual_patient_con={self.annual_patient_con})"


class SubTreatment(EmbeddedDocument):
    name = StringField(required=True)
    drugs = ListField(EmbeddedDocumentField(TreatmentDrug), required=True)

    def __str__(self):
        return f"SubTreatment(name='{self.name}', drugs={self.drugs})"


class AlternativeTreatment(EmbeddedDocument):
    treatment = EmbeddedDocumentField(SubTreatment, required=True)
    rate = FloatField(required=True)

    def __str__(self):
        return f"AlternativeTreatment(treatment={self.treatment}, rate={self.rate})"


# -------------------------------
# Collection: treatments
# -------------------------------
class Treatment(Document):
    name = StringField(required=True)
    drugs = ListField(EmbeddedDocumentField(TreatmentDrug), required=False)
    alternatives = ListField(EmbeddedDocumentField(AlternativeTreatment), required=False)

    meta = {'collection': 'treatments'}

    def __str__(self):
        return f"Treatment(name='{self.name}', drugs={self.drugs}, alternatives={self.alternatives})"


# -------------------------------
# Embedded Documents for Patients
# -------------------------------
class CharacteristicEmbedded(EmbeddedDocument):
    char_type = StringField(required=True, db_field="type")
    name = StringField(required=True)
    size = FloatField(required=False)
    rate = FloatField(required=False)

    def __str__(self):
        return f"CharacteristicEmbedded(type='{self.char_type}', name='{self.name}', size={self.size}, rate={self.rate})"


class PatientCharacteristic(EmbeddedDocument):
    characteristic = EmbeddedDocumentField(CharacteristicEmbedded, required=True)

    def __str__(self):
        return f"PatientCharacteristic({self.characteristic})"


# -------------------------------
# Collection: patients
# -------------------------------
class Patient(Document):
    size = FloatField(required=True)
    chars = ListField(EmbeddedDocumentField(PatientCharacteristic), required=True)

    meta = {'collection': 'patients'}

    def __str__(self):
        return f"Patient(size={self.size}, chars={self.chars})"
