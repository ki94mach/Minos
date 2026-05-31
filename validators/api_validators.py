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


# Import business rules functions at the top
from utils.business_rules import (
    validate_non_empty,
    validate_optional_string,
    validate_rate,
    validate_size,
    normalize_drug_unit,
    validate_and_transform_drug,
    validate_and_transform_characteristic,
    validate_and_transform_treatment_embedded,
    validate_and_transform_followup_embedded,
    validate_and_transform_alternative,
    validate_alternative_ratios_sum,
)

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
    def validate(
        cls, v: Any, info: ValidationInfo
        ) -> "PyObjectId":
        try:
            oid = ObjectId(v)
            return cls(str(oid))
        except Exception:
            raise ValueError('Not a valid ObjectId')

# ------------------------------------------------------------------------------
# CHARACTERISTIC VALIDATORS
# ------------------------------------------------------------------------------

class CharacteristicCreate(BaseModel):
    model_config = ConfigDict(
        validate_by_name = True,
        validate_by_alias = True
    )
    type: str = Field(..., alias='type', min_length=1)
    name: str = Field(..., min_length=1)

    @field_validator('name', 'type', mode='after')
    @classmethod
    def validate_name(cls, v: str) -> str:
        return validate_non_empty(v, "Characteristic name")

class CharacteristicUpdate(BaseModel):
    model_config = ConfigDict(
        validate_by_name = True,
        validate_by_alias = True
    )
    type: Optional[str] = Field(None, alias='type')
    name: Optional[str]

    @field_validator('type', 'name', mode='after')
    @classmethod
    def validate_optional_fields(
        cls, v: Optional[str]
        ) -> Optional[str]:
        return validate_optional_string(v, "Field")

# ------------------------------------------------------------------------------
# DRUG VALIDATORS
# ------------------------------------------------------------------------------

class DrugCreate(BaseModel):
    name: str = Field(..., min_length=1)
    strength: Optional[int] = None
    unit: Optional[str] = None

    @field_validator('name', mode='after')
    @classmethod
    def validate_name(cls, v: str) -> str:
        return validate_non_empty(v, "Drug name")

    @field_validator('unit', mode='after')
    @classmethod
    def normalize_unit(cls, v: Optional[str]) -> Optional[str]:
        return normalize_drug_unit(v)

class DrugUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    strength: Optional[int] = None
    unit: Optional[str] = None

    @field_validator('name', mode='after')
    @classmethod
    def validate_optional_name(
        cls, v: Optional[str]
        ) -> Optional[str]:
        return validate_optional_string(v, "Drug name")

    @field_validator('unit', mode='after')
    @classmethod
    def normalize_unit(cls, v: Optional[str]) -> Optional[str]:
        return normalize_drug_unit(v)

# ------------------------------------------------------------------------------
# TREATMENT VALIDATORS
# ------------------------------------------------------------------------------

# For nested models in Regimen treatments
class DrugSubItem(BaseModel):
    model_config = ConfigDict(
        validate_by_name = True,
        validate_by_alias = True
    )
    id: PyObjectId = Field(..., alias="_id")
    name: str
    strength: Optional[int] = None
    unit: Optional[str] = None

    @field_validator('name', mode='after')
    @classmethod
    def validate_name(cls, v: str) -> str:
        return validate_non_empty(v, "Regimen name")

    @model_validator(mode="after")
    def validate_against_database(self) -> "DrugSubItem":
        drug_data = {
            '_id': str(self.id),
            'name': self.name,
            'strength': self.strength,
            'unit': self.unit
        }
        validate_and_transform_drug(drug_data)
        return self
    
class TreatmentDrugItem(BaseModel):
    drug: DrugSubItem
    annual_patient_con: Optional[int] = None

class Regimen(BaseModel):
    drugs: List[TreatmentDrugItem]
    

# For nested models in Alternative treatments
class AlternativeTreatment(BaseModel):
    model_config = ConfigDict(
        validate_by_name = True,
        validate_by_alias = True
    )
    id: PyObjectId = Field(..., alias="_id")
    name: str
    regimen: Regimen
    ratio: float

    @field_validator('name', mode='after')
    @classmethod
    def validate_name(cls, v: str) -> str:
        return validate_non_empty(v, "Alternative name")

    @model_validator(mode="after")
    def validate_against_database(self) -> "AlternativeTreatment":
        # First validate the regimen if present
        # if self.regimen:
        #     self.regimen.validate_against_database(str(self.id))

        regimen_data = (
            self.regimen.model_dump(by_alias=True)
            if self.regimen else None
        )
        alternative_data = {
            '_id': str(self.id),
            'name': self.name,
            'regimen': regimen_data,
            'ratio': self.ratio
        }
        validate_and_transform_alternative(alternative_data)
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
    def validate_regimen_field(
        cls, v: Optional[Regimen], info: ValidationInfo
        ) -> Optional[Regimen]:

        treatment_type = info.data.get('type')
        if treatment_type == 'Alternative' and v is not None:
            raise ValueError(
                'For Alternative treatments, regimen must be empty'
                )
        if treatment_type == 'Regimen' and v is None:
            raise ValueError(
                'For Regimen type, regimen must be provided'
                )
        return v

    @field_validator('alternatives', mode='after')
    @classmethod
    def validate_alternatives_field(
        cls, v: Optional[List[AlternativeTreatment]],
        info: ValidationInfo
        ) -> Optional[List[AlternativeTreatment]]:

        treatment_type = info.data.get('type')
        if treatment_type == 'Alternative' and not v:
            raise ValueError(
                'For Alternative type, alternatives must be provided'
                )
        if treatment_type != 'Alternative' and v:
            raise ValueError(
                'Alternatives can only be present for Alternative type'
                )
        if v:
            # Validate each alternative and check ratios
            alt_ids = []
            for alt in v:
                alt_ids.append(str(alt.id))
            
            # Check for duplicates
            if len(alt_ids) != len(set(alt_ids)):
                raise ValueError(
                    "Duplicate alternative treatments are not allowed"
                    )
            
            validate_alternative_ratios_sum([alt.ratio for alt in v])
        return v

class TreatmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    type: Optional[str]
    regimen: Optional[Regimen] = None
    alternatives: Optional[List[AlternativeTreatment]] = None

    @field_validator('name', mode='after')
    @classmethod
    def validate_optional_name(
        cls, v: Optional[str]
        ) -> Optional[str]:

        return validate_optional_string(v, "Treatment name")

    @field_validator('type', mode='after')
    @classmethod
    def validate_treatment_type(
        cls, v: Optional[str]
        ) -> Optional[str]:

        if v is not None:
            if v not in ALLOWED_TREATMENT_TYPES:
                raise ValueError(f'Type must be one of {ALLOWED_TREATMENT_TYPES}')
        return v

    @field_validator('regimen', mode='after')
    @classmethod
    def validate_optional_regimen(
        cls, v: Optional[Regimen], info: ValidationInfo
        ) -> Optional[Regimen]:

        if v is not None:
            treatment_type = info.data.get('type')
            if treatment_type == 'Alternative':
                raise ValueError(
                    'For Alternative treatments, regimen must be empty'
                    )
        return v

    @field_validator('alternatives', mode='after')
    @classmethod
    def validate_optional_alternatives(
        cls, v: Optional[List[AlternativeTreatment]],
        info: ValidationInfo
        ) -> Optional[List[AlternativeTreatment]]:

        if v is not None:
            treatment_type = info.data.get('type')
            if treatment_type and treatment_type != 'Alternative':
                raise ValueError(
                    'Alternatives can only be present for Alternative type'
                    )

            alt_ids = []
            for alt in v:
                alt.validate_against_database()
                alt_ids.append(str(alt.id))

            if len(alt_ids) != len(set(alt_ids)):
                raise ValueError(
                    "Duplicate alternative treatments are not allowed"
                    )

            validate_alternative_ratios_sum([alt.ratio for alt in v])
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
        patient = PatientDriver.find(id=self.patient_id).first()
        if not patient:
            raise ValueError(
                f"Patient with id {self.patient_id} not found"
                )
        def find_node(node, target_id):
            if str(node._id) == str(self.parent_id):
                return True
            for child in node.children:
                if find_node(child, target_id):
                    return True
            return False
        if not find_node(patient.tree, self.parent_id):
            raise ValueError(
                f"Parent node {self.parent_id} not found in patient tree"
                )
        return self

class FollowupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    overall_survival: Optional[float] = Field(None, ge=0.0, le=1.0)

    @field_validator('name', mode='after')
    @classmethod
    def validate_optional_name(
        cls, v: Optional[str]
        ) -> Optional[str]:

        return validate_optional_string(v, "Followup name")

# ------------------------------------------------------------------------------
# EMBEDDED DATA FOR NODE PAYLOADS
# ------------------------------------------------------------------------------

class CharacteristicData(BaseModel):
    model_config = ConfigDict(
        validate_by_name = True,
        validate_by_alias = True
    )
    id: PyObjectId = Field(..., alias="_id")
    char_type: str
    name: str

    @field_validator('name', 'char_type', mode='after')
    @classmethod
    def validate_name(cls, v: str) -> str:
        return validate_non_empty(v, "Characteristic name")
    @model_validator(mode="after")
    def validate_against_database(self) -> "CharacteristicData":
        char_data = {
            '_id': str(self.id),
            'char_type': self.char_type,
            'name': self.name
        }
        validate_and_transform_characteristic(char_data)
        return self

class TreatmentData(BaseModel):
    model_config = ConfigDict(
        validate_by_name = True,
        validate_by_alias = True
    )
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
            raise ValueError(
                f'Type must be one of {ALLOWED_TREATMENT_TYPES}'
                )
        return v

    # @field_validator('regimen', mode='after')
    # @classmethod
    # def validate_regimen_field(cls, v: Optional[Regimen], info: ValidationInfo) -> Optional[Regimen]:
    #     treatment_type = info.data.get('type')
    #     if treatment_type == 'Alternative' and v is not None:
    #         raise ValueError('For Alternative treatments, regimen must be empty')
    #     if treatment_type == 'Regimen' and v is None:
    #         raise ValueError('For Regimen type, regimen must be provided')
    #     # if v is not None:
    #     #     v.validate_against_database(info.data.get('id'))
    #     return v

    # @field_validator('alternatives', mode='after')
    # @classmethod
    # def validate_alternatives_field(cls, v: Optional[List[AlternativeTreatment]], info: ValidationInfo) -> Optional[List[AlternativeTreatment]]:
    #     treatment_type = info.data.get('type')
    #     if treatment_type == 'Alternative' and not v:
    #         raise ValueError('For Alternative type, alternatives must be provided')
    #     if treatment_type != 'Alternative' and v:
    #         raise ValueError('Alternatives can only be present for Alternative type')
    #     if v:
    #         # Validate each alternative treatment
    #         alt_ids = []
    #         ratios_sum = 0.0
    #         for alt in v:
    #             # alt.validate_against_database()
    #             alt_ids.append(str(alt.id))
    #             ratios_sum += alt.ratio
            
    #         # Check for duplicate alternatives
    #         if len(alt_ids) != len(set(alt_ids)):
    #             raise ValueError("Duplicate alternative treatments are not allowed")
            
    #         # Validate that ratios sum to 1
    #         if not (0.99 <= ratios_sum <= 1.01):  # Allow small floating point imprecision
    #             raise ValueError("Alternative treatment ratios must sum to 1.0")
    #     return v

    @model_validator(mode="after")
    def validate_against_database(self) -> "TreatmentData":
        if self.regimen:
            for item in self.regimen.drugs:
                item.drug.validate_against_database()
        if self.alternatives:
            for alt in self.alternatives:
                alt.validate_against_database()

        treatment_data = {
            '_id': str(self.id),
            'name': self.name,
            'type': self.type,
            'regimen': self.regimen.model_dump(by_alias=True) if self.regimen else None,
            'alternatives': [
                alt.model_dump(by_alias=True)
                for alt in self.alternatives]
                if self.alternatives else None
        }
        validate_and_transform_treatment_embedded(treatment_data)
        return self

class FollowupData(BaseModel):
    model_config = ConfigDict(
        validate_by_name = True,
        validate_by_alias = True
    )
    id: PyObjectId = Field(..., alias="_id")
    overall_survival: float = Field(..., ge=0.0, le=1.0)

    @field_validator('overall_survival')
    @classmethod
    def validate_survival_rate(cls, v: float) -> float:
        return validate_rate(v)

    @model_validator(mode="after")
    def validate_against_database(self) -> "FollowupData":
        self.validate_survival_rate(self.overall_survival)

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
            raise ValueError(
                f"node_type must be one of {ALLOWED_NODE_TYPES}"
                )
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
    def check_characteristic_data(
        cls, v: Optional[CharacteristicData],
        info: ValidationInfo
        ) -> Optional[CharacteristicData]:

        if info.data.get('node_type') == "characteristic":
            if v is None:
                raise ValueError("characteristic_data is required for characteristic nodes")
        elif v is not None:
            raise ValueError("characteristic_data should only be present for characteristic nodes")
        return v

    @field_validator('treatment_data', mode='after')
    @classmethod
    def check_treatment_data(
        cls, v: Optional[TreatmentData],
        info: ValidationInfo
        ) -> Optional[TreatmentData]:

        if info.data.get('node_type') == "treatment":
            if v is None:
                raise ValueError(
                    "treatment_data is required for treatment nodes"
                    )
        elif v is not None:
            raise ValueError(
                "treatment_data should only be present for treatment nodes"
                )
        return v

    @field_validator('followup_data', mode='after')
    @classmethod
    def check_followup_data(
        cls, v: Optional[FollowupData],
        info: ValidationInfo
        ) -> Optional[FollowupData]:

        if info.data.get('node_type') == "followup":
            if v is None:
                raise ValueError(
                    "followup_data is required for followup nodes"
                    )
        elif v is not None:
            raise ValueError(
                "followup_data should only be present for followup nodes"
                )
        return v

    @model_validator(mode="after")
    def validate_tree_structure(self) -> "PatientNode":
        # Validate that children's parent_ids point to this node
        if self.children:
            my_id = str(self._id) if hasattr(self, '_id') else None
            for child in self.children:
                if child.parent_id and str(child.parent_id) != my_id:
                    raise ValueError(
                        "Child node's parent_id must match parent node's _id"
                        )
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
    tree: PatientNode

    @model_validator(mode="after")
    def validate_tree_update(self) -> "PatientUpdate":
        if self.tree.parent_id is not None:
            raise ValueError("Root node must not have a parent_id")
        return self

def _validate_patient_node_embedded_data(node: PatientNode) -> None:
    """Ensure embedded catalog/followup copies match MongoDB master records (B3)."""
    if node.node_type == "characteristic":
        if not node.characteristic_data:
            raise ValueError("characteristic_data is required for characteristic nodes")
        node.characteristic_data.validate_against_database()
    elif node.node_type == "treatment":
        if not node.treatment_data:
            raise ValueError("treatment_data is required for treatment nodes")
        node.treatment_data.validate_against_database()
    elif node.node_type == "followup":
        if not node.followup_data:
            raise ValueError("followup_data is required for followup nodes")
        node.followup_data.validate_against_database()


class AddNode(BaseModel):
    parent_node_id: Optional[PyObjectId] = None
    node: PatientNode
    children: Optional[List[PatientNode]] = None

    @model_validator(mode="after")
    def validate_parent_child_relationship(self) -> "AddNode":
        if self.parent_node_id:
            if self.node.parent_id and str(self.node.parent_id) != str(self.parent_node_id):
                raise ValueError(
                    "Node's parent_id must match parent_node_id if both are provided"
                    )
            self.node.parent_id = self.parent_node_id

        _validate_patient_node_embedded_data(self.node)

        if self.children:
            for child in self.children:
                _validate_patient_node_embedded_data(child)

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
    def validate_optional_node_type(
        cls, v: Optional[str]
        ) -> Optional[str]:

        if v and v not in ALLOWED_NODE_TYPES:
            raise ValueError(f"node_type must be one of {ALLOWED_NODE_TYPES}")
        return v

    @field_validator('rate', mode='after')
    @classmethod
    def validate_optional_rate(
        cls, v: Optional[float]
        ) -> Optional[float]:

        if v is not None:
            return validate_rate(v)
        return v

    @field_validator('size', mode='after')
    @classmethod
    def validate_optional_size(
        cls, v: Optional[float]
        ) -> Optional[float]:

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
