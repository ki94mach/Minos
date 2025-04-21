# validators/api_validators.py
from pydantic import (
    BaseModel,
    Field,
    field_validator,
    model_validator,
    ConfigDict,
    ValidationInfo,
)
from typing import Optional, List, Any
from bson import ObjectId

# Drivers
from models.drug.driver import DrugDriver
from models.treatment.driver import TreatmentDriver
from models.characteristic.driver import CharacteristicDriver
from models.followup.driver import FollowupDriver

# Import business rules functions at the top
from utils.business_rules import (
    validate_non_empty,
    validate_optional_string,
    validate_rate,
    validate_size,
    validate_strength,
    validate_unit,
    validate_and_transform_drug,
    validate_and_transform_characteristic,
    validate_and_transform_treatment_embedded,
    validate_and_transform_followup_embedded,
    to_title_format,
    validate_regimen_consistency,
    validate_and_transform_alternative
)

# Constants for allowed values.
ALLOWED_UNITS = ['mg', 'g', 'ng', 'mcg', 'IU']
ALLOWED_TREATMENT_TYPES = ['Treatment', 'Regimen', 'Alternative']
ALLOWED_NODE_TYPES = ["characteristic", "treatment", "followup"]

# ------------------------------------------------------------------------------
# Utility for ObjectId Validation
# ------------------------------------------------------------------------------

class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v: Any, info: ValidationInfo) -> "PyObjectId":
        try:
            oid = ObjectId(v)
            return cls(str(oid))
        except Exception:
            raise ValueError('Not a valid ObjectId')

# ------------------------------------------------------------------------------
# CHARACTERISTIC VALIDATORS
# ------------------------------------------------------------------------------

class CharacteristicCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    type: str = Field(..., alias='type', min_length=1)
    name: str = Field(..., min_length=1)

    @field_validator('name', 'type', mode='after')
    @classmethod
    def validate_name(cls, v: str) -> str:
        return to_title_format(validate_non_empty(v, "Characteristic name"))

class CharacteristicUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    type: Optional[str] = Field(None, alias='type')
    name: Optional[str]

    @field_validator('type', 'name', mode='after')
    @classmethod
    def validate_optional_fields(cls, v: Optional[str]) -> Optional[str]:
        return to_title_format(validate_optional_string(v, "Field"))

# ------------------------------------------------------------------------------
# DRUG VALIDATORS
# ------------------------------------------------------------------------------

class DrugCreate(BaseModel):
    name: str = Field(..., min_length=1)
    strength: int = Field(..., gt=0)
    unit: str

    @field_validator('name', mode='after')
    @classmethod
    def validate_name(cls, v: str) -> str:
        return to_title_format(validate_non_empty(v, "Drug name"))

    @field_validator('strength', mode='after')
    @classmethod
    def validate_drug_strength(cls, v: int) -> int:
        return validate_strength(v)

    @field_validator('unit', mode='after')
    @classmethod
    def validate_drug_unit(cls, v: str) -> str:
        return validate_unit(v, ALLOWED_UNITS)

class DrugUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    strength: Optional[int] = Field(None, gt=0)
    unit: Optional[str] = None

    @field_validator('name', mode='after')
    @classmethod
    def validate_optional_name(cls, v: Optional[str]) -> Optional[str]:
        return validate_optional_string(v, "Drug name")

    @field_validator('strength', mode='after')
    @classmethod
    def validate_optional_strength(cls, v: Optional[int]) -> Optional[int]:
        if v is not None:
            return validate_strength(v)
        return v

    @field_validator('unit', mode='after')
    @classmethod
    def validate_unit(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_unit(v, ALLOWED_UNITS)
        return v

# ------------------------------------------------------------------------------
# TREATMENT VALIDATORS
# ------------------------------------------------------------------------------

# For nested models in Regimen treatments
class DrugSubItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: PyObjectId = Field(..., alias="_id")
    name: str
    strength: int
    unit: str

    @field_validator('unit', mode='after')
    @classmethod
    def validate_unit(cls, v: str) -> str:
        if v not in ALLOWED_UNITS:
            raise ValueError(f'Unit must be one of {ALLOWED_UNITS}')
        return v
    
    @model_validator(mode="after")
    def validate_against_database(self) -> "DrugSubItem":
        # Use the business rule function instead of duplicating logic
        drug_data = {
            '_id': str(self.id),
            'name': self.name,
            'strength': self.strength,
            'unit': self.unit
        }
        validate_and_transform_drug(drug_data)  # This will raise ValueError if validation fails
        return self
    
class TreatmentDrugItem(BaseModel):
    drug: DrugSubItem
    annual_patient_con: int

    @field_validator('annual_patient_con', mode='after')
    @classmethod
    def validate_consumtion_size(cls, v: float) -> float:
        return validate_size(v)

class Regimen(BaseModel):
    drugs: List[TreatmentDrugItem]
    
    def validate_drugs_consistency(self) -> None:
        validate_regimen_consistency(self)


# For nested models in Alternative treatments
class AlternativeTreatment(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: PyObjectId = Field(..., alias="_id")
    name: str
    regimen: Regimen
    ratio: float

    @model_validator(mode="after")
    def validate_against_database(self) -> "AlternativeTreatment":
        # First validate the regimen if present
        if self.regimen:
            self.regimen.validate_drugs_consistency()

        # Then use the business rule function to validate against database
        alternative_data = {
            '_id': str(self.id),
            'name': self.name,
            'regimen': self.regimen.model_dump() if self.regimen else None,
            'ratio': self.ratio
        }
        validate_and_transform_alternative(alternative_data)  # This will raise ValueError if validation fails
        return self

class TreatmentCreate(BaseModel):
    name: str = Field(..., min_length=1)
    type: str
    regimen: Optional[Regimen] = None
    alternatives: Optional[List[AlternativeTreatment]] = None

    @field_validator('name', mode='after')
    @classmethod
    def validate_name(cls, v: str) -> str:
        return validate_non_empty(v, "Treatment name")

    @field_validator('type', mode='after')
    @classmethod
    def validate_treatment_type(cls, v: str) -> str:
        if v not in ALLOWED_TREATMENT_TYPES:
            raise ValueError(f'Type must be one of {ALLOWED_TREATMENT_TYPES}')
        return v
    
    @field_validator('regimen', mode='after')
    @classmethod
    def validate_regimen_field(cls, v: Optional[Regimen], info: ValidationInfo) -> Optional[Regimen]:
        treatment_type = info.data.get('type')
        if treatment_type == 'Alternative' and v is not None:
            raise ValueError('For Alternative treatments, regimen must be empty')
        if treatment_type == 'Regimen' and v is None:
            raise ValueError('For Regimen type, regimen must be provided')
        if v is not None:
            v.validate_drugs_consistency()
        return v

    @field_validator('alternatives', mode='after')
    @classmethod
    def validate_alternatives_field(cls, v: Optional[List[AlternativeTreatment]], info: ValidationInfo) -> Optional[List[AlternativeTreatment]]:
        treatment_type = info.data.get('type')
        if treatment_type == 'Alternative' and not v:
            raise ValueError('For Alternative type, alternatives must be provided')
        if treatment_type != 'Alternative' and v:
            raise ValueError('Alternatives can only be present for Alternative type')
        if v:
            # Validate each alternative and check ratios
            alt_ids = []
            ratios_sum = 0.0
            for alt in v:
                alt_ids.append(str(alt.id))
                ratios_sum += alt.ratio
            
            # Check for duplicates
            if len(alt_ids) != len(set(alt_ids)):
                raise ValueError("Duplicate alternative treatments are not allowed")
            
            # Validate ratio sum
            if not (0.99 <= ratios_sum <= 1.01):
                raise ValueError("Alternative treatment ratios must sum to 1.0")
        return v

class TreatmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    type: Optional[str]
    regimen: Optional[Regimen] = None
    alternatives: Optional[List[AlternativeTreatment]] = None

    @field_validator('name', mode='after')
    @classmethod
    def validate_optional_name(cls, v: Optional[str]) -> Optional[str]:
        return validate_optional_string(v, "Treatment name")

    @field_validator('type', mode='after')
    @classmethod
    def validate_treatment_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if v not in ALLOWED_TREATMENT_TYPES:
                raise ValueError(f'Type must be one of {ALLOWED_TREATMENT_TYPES}')
        return v

    @field_validator('regimen', mode='after')
    @classmethod
    def validate_optional_regimen(cls, v: Optional[Regimen], info: ValidationInfo) -> Optional[Regimen]:
        if v is not None:
            treatment_type = info.data.get('type')
            if treatment_type == 'Alternative':
                raise ValueError('For Alternative treatments, regimen must be empty')
            v.validate_drugs_consistency()
        return v

    @field_validator('alternatives', mode='after')
    @classmethod
    def validate_optional_alternatives(cls, v: Optional[List[AlternativeTreatment]], info: ValidationInfo) -> Optional[List[AlternativeTreatment]]:
        if v is not None:
            treatment_type = info.data.get('type')
            if treatment_type and treatment_type != 'Alternative':
                raise ValueError('Alternatives can only be present for Alternative type')
            
            # Validate each alternative and check ratios
            alt_ids = []
            ratios_sum = 0.0
            for alt in v:
                alt.validate_against_database()  # This will validate the embedded regimen too
                alt_ids.append(str(alt.id))
                ratios_sum += alt.ratio
            
            # Check for duplicates
            if len(alt_ids) != len(set(alt_ids)):
                raise ValueError("Duplicate alternative treatments are not allowed")
            
            # Validate ratio sum
            if not (0.99 <= ratios_sum <= 1.01):
                raise ValueError("Alternative treatment ratios must sum to 1.0")
        return v

# ------------------------------------------------------------------------------
# FOLLOWUP VALIDATORS
# ------------------------------------------------------------------------------

class FollowupCreate(BaseModel):
    name: str = Field(..., min_length=1)
    overall_survival: float = Field(..., ge=0.0, le=1.0)
    patient_id: PyObjectId
    parent_id: PyObjectId

    @field_validator('name', mode='after')
    @classmethod
    def validate_name(cls, v: str) -> str:
        return validate_non_empty(v, "Followup name")

    @model_validator(mode="after")
    def validate_ids(self) -> "FollowupCreate":
        from models.patient.driver import PatientDriver
        # Validate that patient exists
        patient = PatientDriver.find(id=self.patient_id).first()
        if not patient:
            raise ValueError(f"Patient with id {self.patient_id} not found")
        # Validate that parent node exists in patient tree
        def find_node(node, target_id):
            if str(node._id) == str(self.parent_id):
                return True
            for child in node.children:
                if find_node(child, target_id):
                    return True
            return False
        if not find_node(patient.tree, self.parent_id):
            raise ValueError(f"Parent node {self.parent_id} not found in patient tree")
        return self

class FollowupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    overall_survival: Optional[float] = Field(None, ge=0.0, le=1.0)

    @field_validator('name', mode='after')
    @classmethod
    def validate_optional_name(cls, v: Optional[str]) -> Optional[str]:
        return validate_optional_string(v, "Followup name")

# ------------------------------------------------------------------------------
# EMBEDDED DATA FOR NODE PAYLOADS
# ------------------------------------------------------------------------------

class CharacteristicData(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: PyObjectId = Field(..., alias="_id")
    char_type: str
    name: str

    @model_validator(mode="after")
    def validate_against_database(self) -> "CharacteristicData":
        char_data = {
            '_id': str(self.id),
            'char_type': self.char_type,
            'name': self.name
        }
        validate_and_transform_characteristic(char_data)  # This will raise ValueError if validation fails
        return self

class TreatmentData(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: PyObjectId = Field(..., alias="_id")
    name: str = Field(..., min_length=1)
    type: str
    regimen: Optional[Regimen] = None
    alternatives: Optional[List[AlternativeTreatment]] = None

    @field_validator('name', mode='after')
    @classmethod
    def name_must_be_non_empty(cls, v: str) -> str:
        return validate_non_empty(v, "Treatment name")

    @field_validator('type', mode='after')
    @classmethod
    def validate_treatment_type(cls, v: str) -> str:
        if v not in ALLOWED_TREATMENT_TYPES:
            raise ValueError(f'Type must be one of {ALLOWED_TREATMENT_TYPES}')
        return v

    @field_validator('regimen', mode='after')
    @classmethod
    def validate_regimen_field(cls, v: Optional[Regimen], info: ValidationInfo) -> Optional[Regimen]:
        treatment_type = info.data.get('type')
        if treatment_type == 'Alternative' and v is not None:
            raise ValueError('For Alternative treatments, regimen must be empty')
        if treatment_type == 'Regimen' and v is None:
            raise ValueError('For Regimen type, regimen must be provided')
        if v is not None:
            v.validate_drugs_consistency()
        return v

    @field_validator('alternatives', mode='after')
    @classmethod
    def validate_alternatives_field(cls, v: Optional[List[AlternativeTreatment]], info: ValidationInfo) -> Optional[List[AlternativeTreatment]]:
        treatment_type = info.data.get('type')
        if treatment_type == 'Alternative' and not v:
            raise ValueError('For Alternative type, alternatives must be provided')
        if treatment_type != 'Alternative' and v:
            raise ValueError('Alternatives can only be present for Alternative type')
        if v:
            # Validate each alternative treatment
            alt_ids = []
            ratios_sum = 0.0
            for alt in v:
                alt.validate_against_database()
                alt_ids.append(str(alt.id))
                ratios_sum += alt.ratio
            
            # Check for duplicate alternatives
            if len(alt_ids) != len(set(alt_ids)):
                raise ValueError("Duplicate alternative treatments are not allowed")
            
            # Validate that ratios sum to 1
            if not (0.99 <= ratios_sum <= 1.01):  # Allow small floating point imprecision
                raise ValueError("Alternative treatment ratios must sum to 1.0")
        return v

    @model_validator(mode="after")
    def validate_against_database(self) -> "TreatmentData":
        # First validate embedded documents
        if self.regimen:
            self.regimen.validate_drugs_consistency()
        if self.alternatives:
            for alt in self.alternatives:
                alt.validate_against_database()

        # Then validate against database record
        treatment_data = {
            '_id': str(self.id),
            'name': self.name,
            'type': self.type,
            'regimen': self.regimen.model_dump() if self.regimen else None,
            'alternatives': [alt.model_dump() for alt in self.alternatives] if self.alternatives else None
        }
        validate_and_transform_treatment_embedded(treatment_data)
        return self

class FollowupData(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: PyObjectId = Field(..., alias="_id")
    overall_survival: float = Field(..., ge=0.0, le=1.0)

    @field_validator('overall_survival')
    @classmethod
    def validate_survival_rate(cls, v: float) -> float:
        return validate_rate(v)  # Reuse rate validation since it's the same constraint

    @model_validator(mode="after")
    def validate_against_database(self) -> "FollowupData":
        # First validate the overall survival rate
        self.validate_survival_rate(self.overall_survival)
        
        # Then validate against database record
        followup_data = {
            '_id': str(self.id),
            'overall_survival': self.overall_survival
        }
        validate_and_transform_followup_embedded(followup_data)
        return self

# ------------------------------------------------------------------------------
# PATIENT NODE AND PATIENT CREATE VALIDATORS
# ------------------------------------------------------------------------------

class PatientNode(BaseModel):
    node_type: str
    rate: float = Field(..., ge=0.0, le=1.0)
    size: float = Field(..., gt=0.0)
    parent_id: Optional[PyObjectId] = None
    characteristic_data: Optional[CharacteristicData] = None
    treatment_data: Optional[TreatmentData] = None
    followup_data: Optional[FollowupData] = None
    children: Optional[List["PatientNode"]] = None

    @field_validator('node_type', mode='after')
    @classmethod
    def validate_node_type(cls, v: str) -> str:
        if v not in ALLOWED_NODE_TYPES:
            raise ValueError(f"node_type must be one of {ALLOWED_NODE_TYPES}")
        return v

    @field_validator('rate', mode='after')
    @classmethod
    def validate_node_rate(cls, v: float) -> float:
        return validate_rate(v)

    @field_validator('size', mode='after')
    @classmethod
    def validate_node_size(cls, v: float) -> float:
        return validate_size(v)

    @field_validator('characteristic_data', mode='after')
    @classmethod
    def check_characteristic_data(cls, v: Optional[CharacteristicData], info: ValidationInfo) -> Optional[CharacteristicData]:
        if info.data.get('node_type') == "characteristic":
            if v is None:
                raise ValueError("characteristic_data is required for characteristic nodes")
        elif v is not None:
            raise ValueError("characteristic_data should only be present for characteristic nodes")
        return v

    @field_validator('treatment_data', mode='after')
    @classmethod
    def check_treatment_data(cls, v: Optional[TreatmentData], info: ValidationInfo) -> Optional[TreatmentData]:
        if info.data.get('node_type') == "treatment":
            if v is None:
                raise ValueError("treatment_data is required for treatment nodes")
        elif v is not None:
            raise ValueError("treatment_data should only be present for treatment nodes")
        return v

    @field_validator('followup_data', mode='after')
    @classmethod
    def check_followup_data(cls, v: Optional[FollowupData], info: ValidationInfo) -> Optional[FollowupData]:
        if info.data.get('node_type') == "followup":
            if v is None:
                raise ValueError("followup_data is required for followup nodes")
        elif v is not None:
            raise ValueError("followup_data should only be present for followup nodes")
        return v

    @model_validator(mode="after")
    def validate_tree_structure(self) -> "PatientNode":
        # Validate that children's parent_ids point to this node
        if self.children:
            my_id = str(self._id) if hasattr(self, '_id') else None
            for child in self.children:
                if child.parent_id and str(child.parent_id) != my_id:
                    raise ValueError("Child node's parent_id must match parent node's _id")
        return self

    class Config:
        arbitrary_types_allowed = True

class PatientCreate(BaseModel):
    node: PatientNode

    @model_validator(mode="after")
    def validate_root_node(self) -> "PatientCreate":
        if self.node.parent_id is not None:
            raise ValueError("Root node must not have a parent_id")
        return self

class PatientUpdate(BaseModel):
    size: Optional[float] = Field(None, gt=0.0)
    tree: Optional[PatientNode] = None

    @field_validator('size', mode='after')
    @classmethod
    def validate_optional_size(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            return validate_size(v)
        return v

    @model_validator(mode="after")
    def validate_tree_update(self) -> "PatientUpdate":
        if self.tree and self.tree.parent_id is not None:
            raise ValueError("Root node must not have a parent_id")
        return self

class AddNode(BaseModel):
    parent_node_id: Optional[PyObjectId] = None
    node: PatientNode
    children: Optional[List[PatientNode]] = None

    @model_validator(mode="after")
    def validate_parent_child_relationship(self) -> "AddNode":
        # Validate parent-child relationship
        if self.parent_node_id:
            if self.node.parent_id and str(self.node.parent_id) != str(self.parent_node_id):
                raise ValueError("Node's parent_id must match parent_node_id if both are provided")
            self.node.parent_id = self.parent_node_id

        # Validate the main node's embedded data based on type
        if self.node.node_type == "characteristic":
            if not self.node.characteristic_data:
                raise ValueError("characteristic_data is required for characteristic nodes")
            self.node.characteristic_data.validate_against_database()
        elif self.node.node_type == "treatment":
            if not self.node.treatment_data:
                raise ValueError("treatment_data is required for treatment nodes")
            self.node.treatment_data.validate_against_database()
        elif self.node.node_type == "followup":
            if not self.node.followup_data:
                raise ValueError("followup_data is required for followup nodes")
            self.node.followup_data.validate_against_database()

        # Recursively validate children if present
        if self.children:
            for child in self.children:
                # Set parent ID for children
                child.parent_id = self.node._id if hasattr(self.node, '_id') else None
                
                # Validate child's embedded data
                if child.node_type == "characteristic" and child.characteristic_data:
                    child.characteristic_data.validate_against_database()
                elif child.node_type == "treatment" and child.treatment_data:
                    child.treatment_data.validate_against_database()
                elif child.node_type == "followup" and child.followup_data:
                    child.followup_data.validate_against_database()

        return self

class UpdateNode(BaseModel):
    rate: Optional[float] = Field(None, ge=0.0, le=1.0)
    size: Optional[float] = Field(None, gt=0.0)
    node_type: Optional[str] = None
    parent_id: Optional[PyObjectId] = None
    characteristic_data: Optional[CharacteristicData] = None
    treatment_data: Optional[TreatmentData] = None
    followup_data: Optional[FollowupData] = None
    children: Optional[List[PatientNode]] = None

    @field_validator('node_type', mode='after')
    @classmethod
    def validate_optional_node_type(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in ALLOWED_NODE_TYPES:
            raise ValueError(f"node_type must be one of {ALLOWED_NODE_TYPES}")
        return v

    @field_validator('rate', mode='after')
    @classmethod
    def validate_optional_rate(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            return validate_rate(v)
        return v

    @field_validator('size', mode='after')
    @classmethod
    def validate_optional_size(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            return validate_size(v)
        return v

    @model_validator(mode="after")
    def validate_data_fields(self) -> "UpdateNode":
        # If node_type is changing, validate corresponding data field is provided
        if self.node_type == "characteristic" and not self.characteristic_data:
            raise ValueError("characteristic_data is required when changing node_type to characteristic")
        elif self.node_type == "treatment" and not self.treatment_data:
            raise ValueError("treatment_data is required when changing node_type to treatment")
        elif self.node_type == "followup" and not self.followup_data:
            raise ValueError("followup_data is required when changing node_type to followup")
        return self
