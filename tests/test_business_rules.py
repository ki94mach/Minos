"""Unit tests for pure helpers in utils.business_rules."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from bson import ObjectId

from utils.business_rules import (
    FOLLOWUP_PARENT_ERROR,
    find_node,
    normalize_drug_unit,
    normalize_evidence_level,
    remove_node_subtree,
    validate_alternative_priorities,
    validate_alternative_ratios_sum,
    validate_and_transform_treatment_embedded,
    validate_followup_treatment_parentage,
    validate_non_empty,
    validate_optional_string,
    validate_rate,
    validate_size,
)


def _node(
    node_id: ObjectId | None = None,
    *,
    children: list | None = None,
    parent_id: ObjectId | None = None,
    node_type: str = "characteristic",
) -> SimpleNamespace:
    return SimpleNamespace(
        _id=node_id or ObjectId(),
        children=list(children or []),
        parent_id=parent_id,
        node_type=node_type,
    )


class TestValidateNonEmpty:
    def test_strips_and_returns(self) -> None:
        assert validate_non_empty("  hello  ", "name") == "hello"

    def test_raises_on_empty(self) -> None:
        with pytest.raises(ValueError, match="name must not be empty"):
            validate_non_empty("   ", "name")


class TestValidateOptionalString:
    def test_none_passthrough(self) -> None:
        assert validate_optional_string(None, "name") is None

    def test_delegates_to_non_empty(self) -> None:
        assert validate_optional_string("  x  ", "name") == "x"


class TestValidateRate:
    def test_accepts_valid_rate(self) -> None:
        assert validate_rate(0.5) == 0.5
        assert validate_rate(0) == 0
        assert validate_rate(1) == 1

    @pytest.mark.parametrize("value", [-0.1, 1.1, "0.5"])
    def test_rejects_invalid_rate(self, value) -> None:
        with pytest.raises(ValueError, match="Rate must be a number between 0 and 1"):
            validate_rate(value)


class TestValidateSize:
    def test_accepts_positive(self) -> None:
        assert validate_size(1.5) == 1.5

    @pytest.mark.parametrize("value", [0, -1, "1"])
    def test_rejects_invalid_size(self, value) -> None:
        with pytest.raises(ValueError, match="Size must be a positive number"):
            validate_size(value)


class TestValidateAlternativeRatiosSum:
    def test_empty_list_ok(self) -> None:
        validate_alternative_ratios_sum([])

    def test_sum_to_one_ok(self) -> None:
        validate_alternative_ratios_sum([0.4, 0.6])

    def test_all_one_ok(self) -> None:
        validate_alternative_ratios_sum([1.0, 1.0])

    def test_invalid_sum_raises(self) -> None:
        with pytest.raises(ValueError, match="must sum to 1.0"):
            validate_alternative_ratios_sum([0.3, 0.3])


class TestValidateAlternativePriorities:
    def test_empty_list_ok(self) -> None:
        validate_alternative_priorities([])

    def test_valid_priorities(self) -> None:
        validate_alternative_priorities([1, 2, 2])

    def test_invalid_priority_raises(self) -> None:
        with pytest.raises(ValueError, match="Priority must be a positive integer"):
            validate_alternative_priorities([0])


class TestNormalizeEvidenceLevel:
    def test_none_returns_none(self) -> None:
        assert normalize_evidence_level(None) is None

    def test_strips_and_empty_to_none(self) -> None:
        assert normalize_evidence_level("  Ia  ") == "Ia"
        assert normalize_evidence_level("   ") is None

    def test_coerces_non_string(self) -> None:
        assert normalize_evidence_level(42) == "42"


class TestNormalizeDrugUnit:
    def test_none_or_blank_returns_none(self) -> None:
        assert normalize_drug_unit(None) is None
        assert normalize_drug_unit("  ") is None

    def test_iu_uppercase(self) -> None:
        assert normalize_drug_unit("iu") == "IU"
        assert normalize_drug_unit(" IU ") == "IU"

    def test_other_units_lowercase(self) -> None:
        assert normalize_drug_unit("MG") == "mg"


class TestValidateFollowupTreatmentParentage:
    def test_valid_tree(self) -> None:
        treat_id = ObjectId()
        fu_id = ObjectId()
        root = _node(
            children=[
                _node(
                    treat_id,
                    node_type="treatment",
                    children=[_node(fu_id, node_type="followup", parent_id=treat_id)],
                )
            ]
        )
        validate_followup_treatment_parentage(root)

    def test_orphan_followup_raises(self) -> None:
        fu_id = ObjectId()
        root = _node(children=[_node(fu_id, node_type="followup")])
        with pytest.raises(ValueError, match=FOLLOWUP_PARENT_ERROR):
            validate_followup_treatment_parentage(root)


class TestFindNode:
    def test_finds_nested_node(self) -> None:
        leaf = _node()
        inner = _node(children=[leaf])
        root = _node(children=[inner])
        assert find_node(root, str(leaf._id)) is leaf

    def test_returns_none_when_missing(self) -> None:
        root = _node(children=[_node()])
        assert find_node(root, str(ObjectId())) is None


class TestRemoveNodeSubtree:
    def test_removes_target_and_descendants(self) -> None:
        deep = _node()
        mid = _node(children=[deep])
        sibling = _node()
        root = _node(children=[mid, sibling])

        assert remove_node_subtree(root, mid._id) is True
        assert [c._id for c in root.children] == [sibling._id]
        assert find_node(root, str(deep._id)) is None

    def test_returns_false_when_not_found(self) -> None:
        root = _node(children=[_node()])
        assert remove_node_subtree(root, ObjectId()) is False


class TestValidateAndTransformTreatmentEmbeddedMetadata:
    def _mock_treatment(self, **overrides):
        defaults = {
            "id": ObjectId(),
            "name": "Test Regimen",
            "type": "Regimen",
            "priority": None,
            "evidence_level": None,
            "regimen": None,
            "alternatives": None,
        }
        defaults.update(overrides)
        return SimpleNamespace(**defaults)

    @patch("models.treatment.driver.TreatmentDriver")
    def test_legacy_regimen_without_metadata_ok(self, mock_driver) -> None:
        treatment = self._mock_treatment()
        mock_driver.find.return_value.first.return_value = treatment

        result = validate_and_transform_treatment_embedded(
            {
                "_id": str(treatment.id),
                "name": treatment.name,
                "type": treatment.type,
            }
        )
        assert result["name"] == treatment.name

    @patch("models.treatment.driver.TreatmentDriver")
    def test_regimen_metadata_must_match_catalog(self, mock_driver) -> None:
        treatment = self._mock_treatment(priority=1, evidence_level="Ia")
        mock_driver.find.return_value.first.return_value = treatment

        validate_and_transform_treatment_embedded(
            {
                "_id": str(treatment.id),
                "name": treatment.name,
                "type": treatment.type,
                "priority": 1,
                "evidence_level": "Ia",
            }
        )

    @patch("models.treatment.driver.TreatmentDriver")
    def test_regimen_priority_mismatch_raises(self, mock_driver) -> None:
        treatment = self._mock_treatment(priority=1)
        mock_driver.find.return_value.first.return_value = treatment

        with pytest.raises(ValueError, match="Priority mismatch"):
            validate_and_transform_treatment_embedded(
                {
                    "_id": str(treatment.id),
                    "name": treatment.name,
                    "type": treatment.type,
                    "priority": 2,
                }
            )

    @patch("models.treatment.driver.TreatmentDriver")
    def test_regimen_evidence_mismatch_raises(self, mock_driver) -> None:
        treatment = self._mock_treatment(evidence_level="Ia")
        mock_driver.find.return_value.first.return_value = treatment

        with pytest.raises(ValueError, match="Evidence level mismatch"):
            validate_and_transform_treatment_embedded(
                {
                    "_id": str(treatment.id),
                    "name": treatment.name,
                    "type": treatment.type,
                    "evidence_level": "IIb",
                }
            )
