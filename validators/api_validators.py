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
    type: str = Field(..., alias='type', min_length=1)
    name: str = Field(..., min_length=1)

    @field_validator('type', 'name', mode='after')
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Field must not be empty")
        return v.strip().title()  # Convert to title case for consistency

class CharacteristicUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    type: Optional[str] = Field(None, alias='type')
    name: Optional[str]

    @field_validator('type', 'name', mode='after')
    @classmethod
    def validate_optional_fields(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                raise ValueError("If provided, field must not be empty")
            return v.strip().title()  # Convert to title case for consistency
        return v

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
        if not v.strip():
            raise ValueError("Drug name must not be empty")
        return v.strip().title()

    @field_validator('unit', mode='after')
    @classmethod
    def validate_unit(cls, v: str) -> str:
        if v not in ALLOWED_UNITS:
            raise ValueError(f'Unit must be one of {ALLOWED_UNITS}')
        return v.lower()  # Normalize unit to lowercase

class DrugUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    strength: Optional[int] = Field(None, gt=0)
    unit: Optional[str] = None

    @field_validator('name', mode='after')
    @classmethod
    def validate_optional_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                raise ValueError("If provided, drug name must not be empty")
            return v.strip().title()
        return v

    @field_validator('unit', mode='after')
    @classmethod
    def validate_unit(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if v not in ALLOWED_UNITS:
                raise ValueError(f'Unit must be one of {ALLOWED_UNITS}')
            return v.lower()  # Normalize unit to lowercase
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
    name: str = Field(..., min_length=1)
    overall_survival: float = Field(..., ge=0.0, le=1.0)
    patient_id: PyObjectId
    parent_id: PyObjectId

    @field_validator('name', mode='after')
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Followup name must not be empty")
        return v.strip()

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
        if v is not None:
            if not v.strip():
                raise ValueError("If provided, followup name must not be empty")
            return v.strip()
        return v

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
    type: str
    regimen: Optional[Regimen] = None
    alternatives: Optional[List[AlternativeTreatment]] = None

    @field_validator("name", mode='after')
    @classmethod
    def name_must_be_non_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Treatment name must not be empty")
        return v

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

    @model_validator(mode="after")
    def validate_against_database(self) -> "TreatmentData":
        db_treatment = TreatmentDriver.find(id=self.id).first()
        if db_treatment is None:
            raise ValueError(f"Treatment with id {self.id} not found in the database")
        if self.name != db_treatment.name:
            raise ValueError("Embedded Treatment: 'name' does not match the database record")
        if self.type != db_treatment.type:
            raise ValueError("Embedded Treatment: 'type' does not match the database record")
        
        # Validate regimen/alternatives based on type
        if self.type == 'Regimen':
            if not self.regimen or self.regimen.model_dump() != db_treatment.regimen.model_dump():
                raise ValueError("Embedded Treatment: 'regimen' does not match the database record")
        elif self.type == 'Alternative':
            if not self.alternatives:
                raise ValueError("Alternatives are required for Alternative type treatments")
            # Compare alternatives
            if len(self.alternatives) != len(db_treatment.alternatives):
                raise ValueError("Embedded Treatment: 'alternatives' count does not match the database record")
            for alt, db_alt in zip(self.alternatives, db_treatment.alternatives):
                if alt.model_dump() != db_alt.model_dump():
                    raise ValueError("Embedded Treatment: 'alternatives' content does not match the database record")
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
        if self.parent_node_id:
            if self.node.parent_id and str(self.node.parent_id) != str(self.parent_node_id):
                raise ValueError("Node's parent_id must match parent_node_id if both are provided")
            self.node.parent_id = self.parent_node_id
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
