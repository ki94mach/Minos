import re
import hashlib
from pkg.base_model import BaseModel

class Characteristic(BaseModel):
    """Represents a patient characteristic with a unique name and type.

    Attributes:
        type (str): The type of characteristic (e.g., Primary Indicatio, Biomarker).
        name (str): The name of the characteristic (e.g., Lung Cancer, KRAS G12C).
    """
    unique_fields = ['type', 'name']
        
    def __init__(self, type: str, name: str):
        self._type = self._title_with_exception(type)
        self._name = self._title_with_exception(name)
    
    @staticmethod
    def _title_with_exception(value: str) -> str:
        """Converts to title case, but keeps fully uppercase values unchanged.

        Args:
            value (str): The string to be converted.

        Returns:
            str: The title-cased value, or the original if all uppercase.
        """
        return value if value.isupper() else value.title()
    
    @property
    def type(self):
        return self._type
    
    @type.setter
    def type(self, value: str):
        self._type = self._title_with_exception(value)

    @property
    def name(self):
        return self._name
    
    @name.setter
    def name(self, value:str):
        self._name = self._title_with_exception(value)

    
    def to_dict(self):
        return {
            'type': self._type,
            'name': self._name,
        }
    
    @classmethod
    def from_dict(cls, document: dict):
        instance = cls.__new__(cls)
        instance._type = document.get('type')
        instance._name = document.get('name')
        return instance
    
    def __repr__(self):
        return f"\nCharacteristic('type: {self.type}, name: {self.name}')"

class Drug(BaseModel):
    """Represents a drug with a specific strength.

    Attributes:
        name (str): The name of the drug (e.g., Carboplatin, Gemcitabine).
        strength (str): The strength of the drug with unit (e.g., 450 mg, 1 g).
    """

    unique_fields = ['name', 'strength']

    def __init__(self, name: str, strength: str):
        self._name = self._title_with_exception(name)
        self._strength = strength
    
    
    @staticmethod
    def _title_with_exception(value: str) -> str:
        """Converts to title case, but keeps fully uppercase values unchanged.

        Args:
            value (str): The string to be converted.

        Returns:
            str: The title-cased value, or the original if all uppercase.
        """
        return value if value.isupper() else value.title()
    
    @property
    def name(self):
        return self._name
    
    @name.setter
    def name(self, value: str):
        self._name = self._title_with_exception(value)

    @property
    def strength(self):
        return self._strength
    
    @strength.setter
    def strength(self, value: str):
        self._validate_strength(value)
        self._strength = value

    @staticmethod
    def _validate_strength(value: str):
        pattern = r'^\d+\s[a-zA-Z]+$'
        if not re.match(pattern, value):
            raise ValueError(
                """Please Provide a valid strength.
                Strength must be in the format: 'Number + Space + Unit'
                (e.g. '450 mg', '1 g', '10 IU')
            """
            )
    
    def to_dict(self):
        return{
            'name': self._name,
            'strength': self._strength,
        }
    
    @classmethod
    def from_dict(cls, document: dict):
        instance = cls.__new__(cls)
        instance._name = document.get('name')
        instance._strength = document.get('strength')
        return instance
    
    def __repr__(self):
        return f"Drug('{self.name}', strength='{self.strength}')"

class Treatment(BaseModel):
    """Represents a treatment that may have alternatives.

    Attributes:
        name (str): The name of the treatment.
        alts (list): A list of alternative treatments represented as tuples (Treatment, rate).
    """
    unique_fields = ['name']

    def __init__(self, name: str):
        self.name = name

    def to_dict(self):
        return {
            'name': self.name,
        }
    
    def __repr__(self):
        return f"Treatment('{self.name}')"

class MedicationRegimen(Treatment):
    """Represents a medical treatment consisting of multiple drugs.

    Attributes:
        drugs (list): A list of drugs included in the treatment, represented as tuples (Drug, annual_patient_con).
    """
    def __init__(self, name: str, drugs=None, **kwargs):
        super().__init__(name)
        self.drugs = drugs if drugs is not None else []

    
    def add_drug(self, drug: Drug, annual_patient_con: int):
        """Adds a drug to the treatment.

        Args:
            drug (Drug): The drug to be added.
            annual_patient_con (int): The annual consumption of the drug per patient.
        """
        self.drugs.append((drug, annual_patient_con))

    def to_dict(self):
        base = super().to_dict()
        base.update({
            'drugs': [{
                'drug': drug.to_dict(),
                'annual_patient_con': annual_patient_con,
            } for drug, annual_patient_con in self.drugs]
        })
        return base
    
    @classmethod
    def from_dict(cls, document: dict):
        instance = super(MedicationRegimen, cls).from_dict(document)
        drugs_list = document.get('drugs', [])
        new_drugs = []
        for item in drugs_list:
            drug_dict = item.get('drug')
            annual_patient_con = item.get('annual_patient_con')
            drug_obj = Drug.from_dict(drug_dict)
            new_drugs.append((drug_obj, annual_patient_con))
        instance.drugs = new_drugs
        return instance
    
    def __repr__(self):
        return f"\nMedicationRegimen('{self.name}')"

class AlternativeTreatments(Treatment):
    """Represents a combined treatment consisting of multiple alternative treatments.

    Attributes:
        alternatives (list): A list of treatments considered as alternatives.
        rates (list): A list of rates corresponding to the treatments.
    """
    unique_fields = ['combined_name']
    @classmethod
    def generate_id(cls, **kwargs):
        alternatives = kwargs.get('alternatives', [])
        combined_name = " / ".join(treatment.name for treatment in alternatives)
        return hashlib.sha256(combined_name.encode('utf-8')).hexdigest()

    def __init__(self, alternatives: Treatment, rates: list=None):
        """Initializes an instance of AlternativeTreatments with multiple alternative treatments.

        Args:
            *alternatives (Treatment): One or more treatments that are considered as alternatives.
            rates (list, optional): A list of rates corresponding to the alternative treatments. If not provided,
                                    each treatment is assigned a default rate of 1.0.

        Raises:
            ValueError: If no alternatives are provided.
            ValueError: If the length of rates does not match the number of provided alternatives.
        """
        if alternatives is None:
            raise ValueError('At least one treatment must be provided for a AlternativeTreatments.')
        
        if rates is None:
            rates = [1.0] * len(alternatives)
        for alt in alternatives:
            if isinstance(alt, AlternativeTreatments):
                raise ValueError("Cannot add AlternativeTreatments as an alternative to another AlternativeTreatments.")
        
        if len(rates) != len(alternatives):
            raise ValueError('The number of rates must match the number of treatments.')
        
        self.alternatives = list(zip(alternatives, rates))
        combined_name = " / ".join(treatment.name for treatment in alternatives)
        super().__init__(combined_name)
    
    def to_dict(self):
        base = super().to_dict()
        base.update({
            'alternatives': [
                {
                    'treatment': t.to_dict(),
                    'rate': rate,
                }
                for t, rate in self.alternatives
            ]
        })
        return base
    
    @classmethod
    def from_dict(cls, document):
        instance = super(AlternativeTreatments, cls).from_dict(document)
        alts_list = document.get('a;ternatives', [])
        new_alts = []
        for item in alts_list:
            treatment_dict = item.get('treatment')
            rate = item.get('rate')
            treatment_obj = Treatment.from_dict(treatment_dict)
            new_alts.append((treatment_obj, rate))
        instance.alternatives = new_alts
        return instance
    
    def __repr__(self):
        return f"\nAlternative Treatments('{self.name}')"
    
class Patient(BaseModel):
    """Represents a patient group with characteristics, treatments, and relationships to other patient groups.

    Attributes:
        chars (list): A list of characteristics of the patient group.
        size (float): The number of patients in this group.
        treatments (list): A list of treatments applied to the patient group.
        next_groups (list): A list of child patient groups representing evolution from this group.
    """
    @classmethod
    def unique_key_from_kwargs(cls, size, chars, **kwargs):
        char_list = [(char.name, s, r) for char, s, r in chars]
        return f"{char_list}-{round(size, 2)}"
    
    _instances = []
    def __init__(
            self,
            size: float,
            char: Characteristic=None,
            chars: list=None,
            treatments: list=None
            ):
        """Initializes a Patient group.

         Args:
            size (float): The number of patients in the group.
            char (Characteristic, optional): The initial characteristic.
            chars (list, optional): A list of characteristic tuples to initialize the patient with.
            treatments (list, optional): A list of treatments to initialize the patient with.

        Raises:
            ValueError: If size is not greater than zero.
        """
        if size <= 0:
            raise ValueError("Size must be greater than zero.")

        self.size = size
        if chars:
            self.chars = chars
        elif char:
            self.chars = [(char, size, 1)] # List of a tuple (char, size, rate)
        else:
            raise ValueError("Either 'char' or 'chars' must be provided")
        self.treatments = treatments if treatments is not None else []
        self._id = None

    def add_characteristic(self, char: Characteristic, rate: float=1.0):
        """Adds one or more characteristics to the patient group, creating a new group.

        Args:
            *new_chars (Characteristic): One or more characteristics to add.
            rate (float): The rate of patients having these characteristics.

        Returns:
            Patient: The new patient group with the added characteristic(s).
        """
        if not (0 < rate <= 1):
            raise ValueError('Rate must be between 0 and 1')
        self.size *= rate
        self.chars.append((char, self.size, rate))
        self._p_changed = True

    def has_characteristic(self, char: Characteristic) -> bool:
        """Checks if the patient group has a given characteristic.

        Args:
            char (Characteristic): The characteristic to check.

        Returns:
            bool: True if the characteristic exists, False otherwise.
        """
        return any(char_entry[0] == char for char_entry, _, _ in self.chars)
    
    def get_char_names(self) -> list:
        """Gets the names of all characteristics of the patient group.

        Returns:
            list: A list of names of characteristics.
        """
        return [char.name for char, *_ in self.chars]

    def add_treatment(self, treatment: Treatment, rate: float = 1.0):
        """Adds a treatment to the patient group.

        Args:
            treatment (Treatment): The treatment to apply.
            rate (float, optional): The rate of patients receiving the treatment. Defaults to 1.0.

        Returns:
            Patient: The new patient group after the treatment.
        """
        new_char = Characteristic(treatment.__class__.__name__, f'Received: {treatment.name}')
        self.add_characteristic(new_char, rate)
        self.treatments.append(treatment)

    def add_branch(self, char: Characteristic, rate: float, branch_point: Characteristic=None):
        """Creates a new patient group as a branch with the added characteristic from a specific characteristic.

        Args:
            char (Characteristic): The characteristic for branching.
            rate (float): The rate of patients moving to the new branch (between 0 and 1).
            branch_point (Characteristic): The characteristic at which to branch.
                If None, branches from the end of the characteristic list.
        Returns:
            Patient: The new patient group.
        """
        if not (0 < rate <= 1):
            raise ValueError('Rate must be between 0 and 1')
        new_patient = self._new_patient(char, rate, branch_point)
        return new_patient
        
    def _new_patient(
            self,
            new_char: Characteristic, 
            rate: float,
            branch_point: Characteristic=None
            ):
        if branch_point is not None:
            try:
                branch_index = next(
                    i for i, (char, *_) in enumerate(self.chars) if char == branch_point
                )
            except StopIteration:
                raise ValueError("The specified branch_point is not found in the patient's characteristic.")
        else:
            branch_index = len(self.chars) - 1
        new_chars = list(self.chars[:branch_index + 1])
        new_size = new_chars[-1][1] * rate
        new_chars.append((new_char, new_size, rate))
        med_count = sum(1 for char, *_ in new_chars if char.type == 'MedicationRegimen')
        new_treatments = list(self.treatments[:med_count])
        new_patient = Patient(size=new_size, chars=new_chars, treatments=new_treatments)
        return new_patient
    
    def to_dict(self):
        return {
            'size': self.size,
            'chars': [{
                'characteristic': char.to_dict(),
                'size': size,
                'rate': rate,
            }for char, size, rate in self.chars],
            'treatments': [t.to_dict() for t in self.treatments]
        }
    
    @classmethod
    def from_dict(cls, document):
        instance = cls.__new__(cls)
        instance.size = document.get('size')
        chars_list = document.get('chars', [])
        new_chars = []
        for item in chars_list:
            char_data = item.get('characteristic')
            size = item.get('size')
            rate = item.get('rate')
            char_obj = Characteristic.from_dict(char_data)
            new_chars.append((char_obj, size, rate))
        instance.chars = new_chars
        treatments_list = document.get('treatments', [])
        new_treatments = []
        for t in treatments_list:
            t_obj = Treatment.from_dict(t)
            new_treatments.append(t_obj)
        instance.treatments = new_treatments
        instance._id = document.get('_id')
        return instance

    def __repr__(self):
        return f"\nPatient(chars={self.get_char_names()}, Size={self.size}"

class FollowUp(BaseModel):
    """Represents follow-up data for a patient group after receiving treatment.

    Attributes:
        patient (Patient): The patient group being followed up.
        treatment (Treatment): The treatment given to the patient group.
        os (float): The overall survival rate after treatment.
        new_patient (Patient): The new patient group after adding the follow-up characteristic.
    """
    @classmethod
    def unique_key_from_kwargs(cls, patient, overall_survival, **kwargs):
        patient_id = (
            patient._id 
            if hasattr(patient, '_id') and patient._id
            else patient.to_dict().get('id', 'unknown')
        )
        return f"{patient_id}-{overall_survival}"
        
    def __init__(self, patient: Patient, overall_survival: float):
        """Initializes a FollowUp instance.

        Args:
            patient (Patient): The patient group being followed up.
            overall_survival (float): The overall survival rate after treatment.
        """
        FollowUp._validate_patient(patient)
        self._patient = patient
        self.treatment = FollowUp._get_latest_treatment(self._patient)
        self.os = overall_survival

    @property
    def patient(self):
        return self._patient
    
    @patient.setter
    def patient(self, value: Patient):
        FollowUp._validate_patient(value)
        self._patient = value

    @staticmethod
    def _get_latest_treatment(patient: Patient):
        """Fetches the latest treatment given to the patient group.

        Args:
            patient (Patient): The patient group.

        Returns:
            Treatment or None: The latest treatment applied to the patient group if available.
        """
        if patient.treatments:
            return patient.treatments[-1]
        else:
            raise ValueError('No treatment found for the given patient group.')
        
    @staticmethod
    def _validate_patient(patient: Patient):
        """Ensures that the latest characteristic is a received treatment.

        Args:
            patient (Patient): The patient group.

        Raises:
            ValueError: If the latest characteristic is not a treatment.
        """
        treatments_list = ['Treatment', 'MedicationRegimen', 'Alternativetreatments']
        if not patient.chars or patient.chars[-1][0].type not in treatments_list:
            raise ValueError('Follow Up can only be created for a patient who has received a treatment immediately.')
        
    def add_to_patient(self):
        """Adds the follow-up as a new characteristic to the patient group, creating a new patient group.

        Creates a new characteristic named 'Follow Up: {treatment}' and adds it to the patient group.

        Returns:
            Patient: The new patient group with the follow-up characteristic added.
        """
        new_name = f'Follow up received: {self.treatment.name}'
        new_char = Characteristic('Follow Up', new_name)
        self._patient.add_characteristic(new_char, rate=self.os)
    
    def to_dict(self):
        return {
            'patient': self.patient.to_dict(),
            'overall_survival': self.os,
        }
    
    @classmethod
    def from_dict(cls, document):
        instance = cls.__new__(cls)
        patient_data = document.get('patient')
        instance._patient = Patient.from_dict(patient_data)
        instance.os = document.get('overall_survival')
        instance.treatment = FollowUp._get_latest_treatment(instance._patient)
        instance._id = document.get('_id')
        return instance
    
    def __repr__(self):
        """Provides a string representation of the FollowUp instance.

        Returns:
            str: A string representation of the follow-up data.
        """
        return (
            f"\nFollowUp(patient={self._patient.get_char_names()}, "
            f"OS={self.os}, "
        )
