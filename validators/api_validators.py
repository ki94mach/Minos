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
    type: str = Field(..., alias='type')
    name: str

class CharacteristicUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    type: Optional[str] = Field(None, alias='type')
    name: Optional[str]

# ------------------------------------------------------------------------------
# DRUG VALIDATORS
# ------------------------------------------------------------------------------

class DrugCreate(BaseModel):
    name: str
    strength: int
    unit: str

    @field_validator('unit', mode='after')
    @classmethod
    def validate_unit(cls, v: str) -> str:
        if v not in ALLOWED_UNITS:
            raise ValueError(f'Unit must be one of {ALLOWED_UNITS}')
        return v

class DrugUpdate(BaseModel):
    name: Optional[str]
    strength: Optional[int]
    unit: Optional[str]

    @field_validator('unit', mode='after')
    @classmethod
    def validate_unit(cls, v: Optional[str]) -> Optional[str]:
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
        db_drug = DrugDriver.get_by_id(self.id)
        if db_drug is None:
            raise ValueError(f"Drug with id {self.id} not found in the database")
        if self.name != db_drug.name:
            raise ValueError("Embedded drug: 'name' does not match the database record")
        if self.strength != db_drug.strength:
            raise ValueError("Embedded drug: 'strength' does not match the database record")
        if self.unit != db_drug.unit:
            raise ValueError("Embedded drug: 'unit' does not match the database record")
        return self
    
class TreatmentDrugItem(BaseModel):
    drug: DrugSubItem
    annual_patient_con: int

class Regimen(BaseModel):
    drugs: List[TreatmentDrugItem]

# For nested models in Alternative treatments
class AlternativeTreatment(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: PyObjectId = Field(..., alias="_id")
    name: str
    regimen: Regimen
    ratio: float

    @model_validator(mode="after")
    def validate_against_database(self) -> "AlternativeTreatment":
        db_treatment = TreatmentDriver.get_by_id(self.id)
        if db_treatment is None:
            raise ValueError(f"Treatment with id {self.id} not found in the database")
        if self.name != db_treatment.name:
            raise ValueError("Embedded Treatment: 'name' does not match the database record")
        if self.regimen.model_dump() != db_treatment.regimen.model_dump():
            raise ValueError("Embedded Treatment: 'regimen' does not match the database record")
        if self.ratio != db_treatment.ratio:
            raise ValueError("Embedded Treatment: 'ratio' does not match the database record")
        return self

class TreatmentCreate(BaseModel):
    name: str
    type: str
    regimen: Optional[Regimen] = None
    alternatives: Optional[List[AlternativeTreatment]] = None

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
        return v

class TreatmentUpdate(BaseModel):
    name: Optional[str]
    type: Optional[str]
    regimen: Optional[Regimen] = None
    alternatives: Optional[List[AlternativeTreatment]] = None

    @field_validator('type', mode='after')
    @classmethod
    def validate_treatment_type(cls, v: Optional[str]) -> Optional[str]:
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
    model_config = ConfigDict(populate_by_name=True)
    id: PyObjectId = Field(..., alias="_id")
    char_type: str
    name: str

    @model_validator(mode="after")
    def validate_against_database(self) -> "CharacteristicData":
        db_char = CharacteristicDriver.find(id=self.id).first()
        if db_char is None:
            raise ValueError(f"Characteristic with id {self.id} not found in the database")
        if self.char_type != db_char.char_type:
            raise ValueError("Embedded characteristic: 'char_type' does not match the database record")
        if self.name != db_char.name:
            raise ValueError("Embedded characteristic: 'name' does not match the database record")
        return self

class TreatmentData(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: PyObjectId = Field(..., alias="_id")
    name: str = Field(..., min_length=1)
   
    @field_validator("name", mode='after')
    @classmethod
    def name_must_be_non_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Treatment name must not be empty")
        return v

    @model_validator(mode="after")
    def validate_against_database(self) -> "TreatmentData":
        db_treatment = TreatmentDriver.find(id=self.id).first()
        if db_treatment is None:
            raise ValueError(f"Treatment with id {self.id} not found in the database")
        if self.name != db_treatment.name:
            raise ValueError("Embedded Treatment: 'name' does not match the database record")
        return self

class FollowupData(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: PyObjectId = Field(..., alias="_id")
    overall_survival: float = Field(..., ge=0.0, le=1.0)

    @model_validator(mode="after")
    def validate_against_database(self) -> "FollowupData":
        db_followup = FollowupDriver.find(id=self.id).first()
        if db_followup is None:
            raise ValueError(f"Followup with id {self.id} not found in the database")
        if self.overall_survival != db_followup.overall_survival:
            raise ValueError("Embedded Followup: 'overall_survival' does not match the database record")
        return self

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

    @field_validator('node_type', mode='after')
    @classmethod
    def validate_node_type(cls, v: str) -> str:
        if v not in ALLOWED_NODE_TYPES:
            raise ValueError(f"node_type must be one of {ALLOWED_NODE_TYPES}")
        return v

    @field_validator('characteristic_data', mode='after')
    @classmethod
    def check_characteristic_data(cls, v: Optional[CharacteristicData], info: ValidationInfo) -> Optional[CharacteristicData]:
        if info.data.get('node_type') == "characteristic" and v is None:
            raise ValueError("characteristic_data is required for characteristic nodes")
        return v

    @field_validator('treatment_data', mode='after')
    @classmethod
    def check_treatment_data(cls, v: Optional[TreatmentData], info: ValidationInfo) -> Optional[TreatmentData]:
        if info.data.get('node_type') == "treatment" and v is None:
            raise ValueError("treatment_data is required for treatment nodes")
        return v

    @field_validator('followup_data', mode='after')
    @classmethod
    def check_followup_data(cls, v: Optional[FollowupData], info: ValidationInfo) -> Optional[FollowupData]:
        if info.data.get('node_type') == "followup" and v is None:
            raise ValueError("followup_data is required for followup nodes")
        return v

    class Config:
        arbitrary_types_allowed = True

class PatientCreate(BaseModel):
    node: PatientNode

class PatientUpdate(BaseModel):
    size: Optional[float] = None
    tree: Optional[PatientNode] = None

class AddNode(BaseModel):
    parent_node_id: Optional[PyObjectId] = None
    node: PatientNode
    children: Optional[List[PatientNode]] = None

class UpdateNode(BaseModel):
    rate: Optional[float] = None
    size: Optional[float] = None
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
