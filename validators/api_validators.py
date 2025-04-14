from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from bson import ObjectId

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
    def validate(cls, v):
        try:
            ObjectId(v)
            return v
        except Exception as e:
            raise ValueError('Not a valid ObjectId') from e

# ------------------------------------------------------------------------------
# CHARACTERISTIC VALIDATORS
# ------------------------------------------------------------------------------

class CharacteristicCreate(BaseModel):
    type: str = Field(..., alias='type')
    name: str

class CharacteristicUpdate(BaseModel):
    type: Optional[str] = Field(None, alias='type')
    name: Optional[str]

# ------------------------------------------------------------------------------
# DRUG VALIDATORS
# ------------------------------------------------------------------------------

class DrugCreate(BaseModel):
    name: str
    strength: int
    unit: str
    
    @field_validator('unit')
    def validate_unit(cls, v):
        if v not in ALLOWED_UNITS:
            raise ValueError(f'Unit must be one of {ALLOWED_UNITS}')
        return v
    
class DrugUpdate(BaseModel):
    name: Optional[str]
    strength: Optional[int]
    unit: Optional[str]

    @field_validator('unit')
    def validate_unit(cls, v):
        if v is None:
            return v
        if v not in ALLOWED_UNITS:
            raise ValueError(f'Unit must be one of {ALLOWED_UNITS}')
        return v

# ------------------------------------------------------------------------------
# TREATMENT VALIDATORS
# ------------------------------------------------------------------------------

# For nested models in Regimen treatments
class DrugSubItem(BaseModel):
    _id: PyObjectId
    name: str
    strength: int
    unit: str

    @field_validator('unit')
    def validate_unit(cls, v):
        if v not in ALLOWED_UNITS:
            raise ValueError(f'Unit must be one of {ALLOWED_UNITS}')
        return v
    
class TreatmentDrugItem(BaseModel):
    drug: DrugSubItem
    annual_patient_con: int

class Regimen(BaseModel):
    drugs: List[TreatmentDrugItem]

# For nested models in Regimen treatments
class AlternativeTreatment(BaseModel):
    _id: Optional[PyObjectId]
    name: str
    regimen: Regimen
    ratio: float

class TreatmentCreate(BaseModel):
    name: str
    type: str
    regimen: Optional[Regimen] = None
    alternatives: Optional[List[AlternativeTreatment]] = None

    @field_validator('type')
    def validate_treatment_type(cls, v):
        if v not in ALLOWED_TREATMENT_TYPES:
            raise ValueError(f'Type must be one of {ALLOWED_TREATMENT_TYPES}')
        return v
    
    @field_validator('regimen', always=True)
    def validate_regimen_field(cls, v, values):
        treatment_type = values.get('type')
        if treatment_type == 'Alternative' and v is not None:
            raise ValueError('For Alternative treatments, regimen must be empty')
        if treatment_type == 'Regimen' and v is None:
            raise ValueError('For Regimen type, regimen must be provided')
        return v

class TreatmentUpdate(BaseModel):
    name: Optional[str]
    type: Optional[str]
    regimen: Optional[Regimen] = None
    alternatives: Optional[List[AlternativeTreatment]] = None

    @field_validator('type')
    def validate_treatment_type(cls, v):
        if v is None:
            return v
        if v not in ALLOWED_TREATMENT_TYPES:
            raise ValueError(f'Type must be one of {ALLOWED_TREATMENT_TYPES}')
        return v

# ------------------------------------------------------------------------------
# FOLLOWUP VALIDATORS
# ------------------------------------------------------------------------------

class FollowupCreate(BaseModel):
    name: str
    overall_survival: float
    patient_id: PyObjectId
    parent_id: PyObjectId

class FollowupUpdate(BaseModel):
    name: Optional[str]
    overall_survival: Optional[float]

# ------------------------------------------------------------------------------
# EMBEDDED DATA FOR NODE PAYLOADS
# ------------------------------------------------------------------------------

class CharacteristicData(BaseModel):
    _id: PyObjectId
    char_type: str
    name: str

class TreatmentData(BaseModel):
    _id: PyObjectId
    name: str = Field(..., min_length=1)
    
    @field_validator("name")
    def name_must_be_non_empty(cls, v):
        if not v.strip():
            raise ValueError("Treatment name must not be empty")
        return v

class FollowupData(BaseModel):
    _id: PyObjectId
    overall_survival: float = Field(..., ge=0.0, le=1.0)

# ------------------------------------------------------------------------------
# PATIENT NODE AND PATIENT CREATE VALIDATORS
# ------------------------------------------------------------------------------

class PatientNode(BaseModel):
    node_type: str
    rate: float
    size: float
    parent_id: Optional[PyObjectId] = None
    characteristic_data: Optional[CharacteristicData] = None
    treatment_data: Optional[TreatmentData] = None
    followup_data: Optional[FollowupData] = None
    children: Optional[List["PatientNode"]] = None

    @field_validator('node_type')
    def validate_node_type(cls, v):
        if v not in ALLOWED_NODE_TYPES:
            raise ValueError(f"node_type must be one of {ALLOWED_NODE_TYPES}")
        return v

    @field_validator('characteristic_data', mode='after', always=True)
    def check_characteristic_data(cls, v, info):
        if info.data.get('node_type') == "characteristic" and v is None:
            raise ValueError("characteristic_data is required for characteristic nodes")
        return v

    @field_validator('treatment_data', mode='after', always=True)
    def check_treatment_data(cls, v, info):
        if info.data.get('node_type') == "treatment" and v is None:
            raise ValueError("treatment_data is required for treatment nodes")
        return v

    @field_validator('followup_data', mode='after', always=True)
    def check_followup_data(cls, v, info):
        if info.data.get('node_type') == "followup" and v is None:
            raise ValueError("followup_data is required for followup nodes")
        return v

    class Config:
        # Allow arbitrary types (such as ObjectId strings) in nested models.
        arbitrary_types_allowed = True

class PatientCreate(BaseModel):
    node: PatientNode
