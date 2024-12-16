from persistent.list import PersistentList
from ZODB_manager import RegistryManager
from persistent import Persistent
import re
import hashlib

class Characteristic(Persistent):
    """Represents a patient characteristic with a unique name and type.

    Attributes:
        type (str): The type of characteristic (e.g., Primary Indicatio, Biomarker).
        name (str): The name of the characteristic (e.g., Lung Cancer, KRAS G12C).
    """
    def __new__(cls, type: str=None, name: str=None):
        """Creates a unique instance of Characteristic.

        Args:
            type (str): The type of characteristic.
            name (str): The name of the characteristic.

        Returns:
            Characteristic: A unique instance of Characteristic based on type and name.
        """
        if type is None or name is None:
            return super().__new__(cls)
        registry = RegistryManager().get_registry('characteristic_registry')
        type_t = cls._title_with_exception(type)
        name_t = cls._title_with_exception(name)
        key = (type_t, name_t)
        if key in registry:
            print(registry[key])
            return registry[key]
        else:
            instance = super().__new__(cls)
            registry[key] = instance
            return instance
        
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
    
    def __repr__(self):
        return f"\nCharacteristic('type: {self.type}, name: {self.name}')"

class Drug(Persistent):
    """Represents a drug with a specific strength.

    Attributes:
        name (str): The name of the drug (e.g., Carboplatin, Gemcitabine).
        strength (str): The strength of the drug with unit (e.g., 450 mg, 1 g).
    """


    def __new__(cls, name: str=None, strength: str=None):
        """Creates a unique instance of Drug.

        Args:
            name (str): The name of the drug.
            strength (str): The strength of the drug.

        Returns:
            Drug: A unique instance of Drug based on name and strength.
        """
        if name is None or strength is None:
            return super().__new__(cls)
        registry = RegistryManager().get_registry('drug_registry')
        name_t = cls._title_with_exception(name)
        cls._validate_strength(strength)
        key = (name_t, strength)
        if key in registry:
            print(f'{name_t} with {strength} strength was defined before.')
            return registry[key]
        else:
            instance = super(Drug, cls).__new__(cls)
            registry[key] = instance
            return instance

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
    
    def __repr__(self):
        return f"Drug('{self.name}', strength='{self.strength}')"

class Treatment(Persistent):
    """Represents a treatment that may have alternatives.

    Attributes:
        name (str): The name of the treatment.
        alts (list): A list of alternative treatments represented as tuples (Treatment, rate).
    """
    @classmethod
    def get_or_create(cls, name:str):
        registry = RegistryManager().get_registry('treatment_registry')
        key = (cls.__name__, name)
        if key in registry:
            return registry[key]
        else:
            instance = cls(name)
            registry[key] = instance
            return instance
            
    def __init__(self, name: str):
        self.name = name
        self.alts = PersistentList() # List of tuples (Treatment, rate)
            
    def add_alt(self, treatment, rate: float=1.0):
        """Adds an alternative treatment.

        Args:
            treatment (Treatment): An alternative treatment.
            rate (float): The rate at which the alternative is used.
        """
        self.alts.append((treatment, rate))

    def to_dict(self):
        return {
            'name': self.name,
        }
    
    def __repr__(self):
        return f"Treatment('{self.name}')"

class MedicalTreatment(Treatment):
    """Represents a medical treatment consisting of multiple drugs.

    Attributes:
        drugs (list): A list of drugs included in the treatment, represented as tuples (Drug, annual_patient_con).
    """
    @classmethod
    def get_or_create(cls, name: str):
        registry = RegistryManager().get_registry('treatment_registry')
        key = (cls.__name__, name)
        if key in registry:
            return registry[key]
        else:
            instance = cls(name)
            registry[key] = instance
            return instance
    
    def __init__(self, name: str):
        super().__init__(name)
        self.drugs = PersistentList()

    def add_drug(self, drug: Drug, annual_patient_con: int):
        """Adds a drug to the treatment.

        Args:
            drug (Drug): The drug to be added.
            annual_patient_con (int): The annual consumption of the drug per patient.
        """
        self.drugs.append((drug, annual_patient_con))

    def to_dict(self):
        return {
            'name': self.name,
            'drugs': [{
                'drug': drug.to_dict(),
                'annual_patient_con': annual_patient_con,
            } for drug, annual_patient_con in self.drugs]
        }
    
    def __repr__(self):
        return f"\nMedicalTreatment('{self.name}')"

class AlternativeTreatments(Treatment):
    """Represents a combined treatment consisting of multiple alternative treatments.

    Attributes:
        alternatives (list): A list of treatments considered as alternatives.
        rates (list): A list of rates corresponding to the treatments.
    """
    @classmethod
    def get_or_create(cls, *alternatives: Treatment, rates: list=None):
        combined_name = " / ".join(treatment.name for treatment in alternatives)
        registry = RegistryManager().get_registry('treatment_registry')
        key = (cls.__name__, combined_name)
        if key in registry:
            return registry[key]
        else:
            instance = cls(*alternatives, rates=rates)
            registry[key] = instance
            return instance

    def __init__(self, *alternatives: Treatment, rates: list=None):
        """Initializes an instance of AlternativeTreatments with multiple alternative treatments.

        Args:
            *alternatives (Treatment): One or more treatments that are considered as alternatives.
            rates (list, optional): A list of rates corresponding to the alternative treatments. If not provided,
                                    each treatment is assigned a default rate of 1.0.

        Raises:
            ValueError: If no alternatives are provided.
            ValueError: If the length of rates does not match the number of provided alternatives.
        """
        if hasattr(self, '_initialized') and self._initialized:
            return  # Avoid re-initialization if already initialized
        self._initialized = True
        if alternatives is None:
            raise ValueError('At least one treatment must be provided for a AlternativeTreatments.')
        
        if rates is None:
            rates = [1.0] * len(alternatives)
        for alt in alternatives:
            if isinstance(alt, AlternativeTreatments):
                raise ValueError("Cannot add AlternativeTreatments as an alternative to another AlternativeTreatments.")
        
        if len(rates) != len(alternatives):
            raise ValueError('The number of rates must match the number of treatments.')
        
        self.alternatives = PersistentList(zip(alternatives, rates))
        self.name = " / ".join(treatment.name for treatment in alternatives)
        super().__init__(self.name)
    
    def to_dict(self):
        return {
            'name': self.name,
            'alternatives': [alt.to_dict() for alt in self.alternatives]
        }
    
    def __repr__(self):
        return f"\nAlternative Treatments('{self.name}')"
    
class Patient(Persistent):
    """Represents a patient group with characteristics, treatments, and relationships to other patient groups.

    Attributes:
        chars (list): A list of characteristics of the patient group.
        size (float): The number of patients in this group.
        treatments (list): A list of treatments applied to the patient group.
        next_groups (list): A list of child patient groups representing evolution from this group.
    """
    def __init__(self,size: float, char: Characteristic=None, chars: list=None, treatments: list=None):
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

        self.chars = PersistentList()
        self.size = size
        if chars:
            self.chars.extend(chars)
        elif char:
            self.chars.append((char, self.size, 1)) # List of a tuple (char, size, rate)
        else:
            raise ValueError("Either 'char' or 'chars' must be provided")
        self.treatments = PersistentList(treatments) if treatments else PersistentList()

    def register_patient(self):
        registry = RegistryManager().get_registry('patient_registry')
        existing_patient = self._find_patient(registry)
        if existing_patient:
            print(f"A patient group with characteristics {self.get_char_names()} already exists.")
            print("Please consider changing the characteristic or editing the rate/size of the patient group.")
        else:
            registry[self._get_hash()] = self
        
    def _get_hash(self):
        """Generates a hash based on patient characteristics and size.

        Returns:
            int: A unique hash representing the patient.
        """

        chars_tuple = tuple((char.name, size, rate) for char, size, rate in self.chars)
        data = f'{chars_tuple}-{round(self.size, 2)}'
        hash_obj = hashlib.sha256(data.encode('utf-8'))
        return hash_obj.hexdigest()

    def _find_patient(self, registry):
        """Finds an existing patient group with the same characteristics and size.

        Returns:
            Patient or None: The existing patient group if found, otherwise None.
        """
        return registry.get(self._get_hash(), None)

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
        new_char = Characteristic('Medication', f'Received: {treatment.name}')
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
        
    def _new_patient(self, new_char: Characteristic, 
                     rate: float, branch_point: Characteristic=None):
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
        med_count = sum(1 for char, *_ in new_chars if char.type == 'Medication')
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
    
    def __repr__(self):
        return f"\nPatient(chars={self.get_char_names()}, Size={self.size}"

class FollowUp(Persistent):
    """Represents follow-up data for a patient group after receiving treatment.

    Attributes:
        patient (Patient): The patient group being followed up.
        treatment (Treatment): The treatment given to the patient group.
        os (float): The overall survival rate after treatment.
        new_patient (Patient): The new patient group after adding the follow-up characteristic.
    """
    def __new__(cls, patient: Patient=None, overall_survival: float=None):
        if patient is None or overall_survival is None:
            return super().__new__(cls)
        registry = RegistryManager().get_registry('followup_registry')
        key = (patient._get_hash(), overall_survival)
        if key in registry:
            return registry[key]
        else:
            instance = super().__new__(cls)
            registry[key] = instance
            return instance
        
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
        if not patient.chars or not patient.chars[-1][0].type == 'Medication':
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
    
    def __repr__(self):
        """Provides a string representation of the FollowUp instance.

        Returns:
            str: A string representation of the follow-up data.
        """
        return (
            f"\nFollowUp(patient={self._patient.get_char_names()}, "
            f"OS={self.os}, "
        )
