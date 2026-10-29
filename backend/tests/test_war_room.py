"""
ROGVEDA — Unit & Integration Tests for Lead Optimization War Room (Phase 1)

Verifies:
- Deterministic parent/analog scoring
- Dynamic weight renormalization over eligible dimensions
- Proper orientation of activity (maximize) and risk (cardiac & mitochondrial safety)
- Explicit unavailability handling for metabolic stability (never treated as 0 or safe)
- Independent hard-constraint violation flagging
- Invalid SMILES and unknown profile handling
- Delta computation correctness against RDKit
- Backward compatibility of existing shortlist API
- API endpoints via FastAPI TestClient
"""

import pytest
from fastapi.testclient import TestClient
from rdkit import Chem
from rdkit.Chem import Descriptors

from app.main import app
from app.services import war_room_service
from app.services.analog_service import generate_shortlist

client = TestClient(app)

ASPIRIN = "CC(=O)Oc1ccccc1C(O)=O"
PARACETAMOL = "CC(=O)Nc1ccc(O)cc1"


# ── 1. Determinism Tests ───────────────────────────────────────────────────────

class TestWarRoomDeterminism:
    def test_parent_evaluation_is_deterministic(self):
        """Evaluating the same molecule multiple times produces identical scores and values."""
        res1 = war_room_service.evaluate_war_room(ASPIRIN, "anti_inflammatory_exploration_v1")
        res2 = war_room_service.evaluate_war_room(ASPIRIN, "anti_inflammatory_exploration_v1")

        assert res1["parent"]["smiles"] == res2["parent"]["smiles"]
        assert res1["parent"]["aggregate_score"] == res2["parent"]["aggregate_score"]
        assert res1["parent"]["coverage"] == res2["parent"]["coverage"]
        assert len(res1["shortlist"]) == len(res2["shortlist"])

        for cand1, cand2 in zip(res1["shortlist"], res2["shortlist"]):
            assert cand1["product_smiles"] == cand2["product_smiles"]
            assert cand1["aggregate_score"] == cand2["aggregate_score"]
            assert cand1["rank"] == cand2["rank"]


# ── 2. Weight Normalization Tests ──────────────────────────────────────────────

class TestWeightNormalization:
    def test_effective_weights_sum_to_one(self):
        """Effective weights of eligible dimensions must always sum to 1.0 (within rounding)."""
        res = war_room_service.evaluate_war_room(ASPIRIN, "anti_inflammatory_exploration_v1")
        parent_breakdown = res["parent"]["score_breakdown"]

        effective_sum = sum(b["effective_weight"] for b in parent_breakdown if b["available"])
        assert abs(effective_sum - 1.0) < 1e-3, f"Effective weights sum to {effective_sum}, expected ~1.0"

    def test_score_reproducible_from_breakdown(self):
        """The candidate aggregate score must equal the sum of weighted contributions in the breakdown."""
        res = war_room_service.evaluate_war_room(ASPIRIN, "balanced_lead_optimization_v1")
        for cand in res["shortlist"]:
            expected_score = sum(b["weighted_contribution"] for b in cand["score_breakdown"])
            assert abs(cand["aggregate_score"] - round(expected_score, 4)) < 1e-3

    def test_invalid_profile_raises_error(self):
        """Requesting an unknown optimization profile raises ValueError."""
        with pytest.raises(ValueError, match="Unknown optimization profile"):
            war_room_service.evaluate_war_room(ASPIRIN, "non_existent_profile_xyz")


# ── 3. Dimension Orientation & Safety Tests ────────────────────────────────────

class TestDimensionOrientation:
    def test_risk_dimensions_oriented_higher_is_safer(self):
        """hERG and Tox21 MMP must be oriented so that higher normalized score means lower risk."""
        mol = Chem.MolFromSmiles(ASPIRIN)
        dims = war_room_service.evaluate_molecule_dimensions(ASPIRIN, "antiinflammatory")

        herg_dim = dims[war_room_service.DIM_CARDIAC_SAFETY]
        assert herg_dim["available"] is True
        # Cardiac safety normalized score = 1.0 - raw_risk
        assert abs(herg_dim["normalized_score"] - (1.0 - herg_dim["raw_value"])) < 1e-3
        assert 0.0 <= herg_dim["normalized_score"] <= 1.0
        assert 0.0 <= herg_dim["raw_value"] <= 1.0

        mmp_dim = dims[war_room_service.DIM_MITOCHONDRIAL_SAFETY]
        assert mmp_dim["available"] is True
        assert abs(mmp_dim["normalized_score"] - (1.0 - mmp_dim["raw_value"])) < 1e-3
        assert 0.0 <= mmp_dim["normalized_score"] <= 1.0

    def test_activity_oriented_higher_is_better(self):
        """Activity dimension must directly correspond to probability active."""
        dims = war_room_service.evaluate_molecule_dimensions(ASPIRIN, "antiinflammatory")
        act_dim = dims[war_room_service.DIM_ACTIVITY]
        assert act_dim["available"] is True
        assert act_dim["normalized_score"] == act_dim["raw_value"]
        assert 0.0 <= act_dim["normalized_score"] <= 1.0


# ── 4. Missing Dimension & Metabolic Stability Tests ───────────────────────────

class TestUnavailableDimensions:
    def test_metabolic_stability_explicitly_unavailable(self):
        """Metabolic stability must be marked unavailable with reason and excluded from score."""
        dims = war_room_service.evaluate_molecule_dimensions(ASPIRIN, "antiinflammatory")
        metab_dim = dims[war_room_service.DIM_METABOLIC_STABILITY]

        assert metab_dim["available"] is False
        assert metab_dim["raw_value"] is None
        assert metab_dim["normalized_score"] is None
        assert "No validated local metabolic stability" in metab_dim["reason"]

    def test_unavailable_dimension_excluded_from_scoring_not_zero(self):
        """Unavailable dimensions must receive 0.0 effective weight rather than penalizing candidate as zero."""
        profile = war_room_service.get_profile("anti_inflammatory_exploration_v1")
        dims = war_room_service.evaluate_molecule_dimensions(ASPIRIN, "antiinflammatory")
        score, coverage, breakdown = war_room_service.calculate_candidate_score(dims, profile)

        metab_entry = next(b for b in breakdown if b["dimension_key"] == war_room_service.DIM_METABOLIC_STABILITY)
        assert metab_entry["available"] is False
        assert metab_entry["effective_weight"] == 0.0
        assert metab_entry["weighted_contribution"] == 0.0

        # Coverage should be 5/6 = 0.8333
        assert abs(coverage - 5 / 6) < 1e-2


# ── 5. Hard Constraint Tests ───────────────────────────────────────────────────

class TestHardConstraints:
    def test_hard_constraint_violation_tracked_independently(self):
        """A compound violating a hard constraint must have constraints_passed=False."""
        # Create a mock constraint that requires MW <= 150 (Aspirin is ~180 Da)
        strict_constraints = [
            {"dimension": "mw", "operator": "<=", "value": 150.0, "description": "MW <= 150"}
        ]
        dims = war_room_service.evaluate_molecule_dimensions(ASPIRIN, "antiinflammatory")
        props = {"molecular_weight": 180.16}

        passed, violations = war_room_service.evaluate_hard_constraints(dims, props, strict_constraints)
        assert passed is False
        assert len(violations) == 1
        assert violations[0]["dimension"] == "mw"
        assert violations[0]["actual_value"] == 180.16

    def test_candidate_violating_constraint_still_has_score(self):
        """Hard constraint violations do not corrupt score calculation, but remain visible."""
        res = war_room_service.evaluate_war_room(ASPIRIN, "safety_first_scrutiny_v1")
        for cand in res["shortlist"]:
            assert isinstance(cand["aggregate_score"], float)
            assert isinstance(cand["constraints_passed"], bool)
            assert isinstance(cand["constraint_violations"], list)


# ── 6. Property Deltas & Chemistry Correctness ─────────────────────────────────

class TestPropertyDeltasAndChemistry:
    def test_deltas_match_rdkit_computed_differences(self):
        """Property deltas must accurately match the difference between parent and analog."""
        res = war_room_service.evaluate_war_room(ASPIRIN, "anti_inflammatory_exploration_v1", top_n=3)
        parent_mw = res["parent"]["properties"]["molecular_weight"]

        for cand in res["shortlist"]:
            prod_mol = Chem.MolFromSmiles(cand["product_smiles"])
            expected_prod_mw = round(Descriptors.MolWt(prod_mol), 2)
            assert cand["properties"]["molecular_weight"] == expected_prod_mw

            mw_delta = cand["property_deltas"]["molecular_weight"]
            assert abs(mw_delta["delta"] - round(expected_prod_mw - parent_mw, 2)) < 1e-2

    def test_no_duplicate_analogs_in_shortlist(self):
        """All analog candidates in the shortlist must be distinct unique structures."""
        res = war_room_service.evaluate_war_room(ASPIRIN, "anti_inflammatory_exploration_v1", top_n=10)
        smiles_list = [c["product_smiles"] for c in res["shortlist"]]
        assert len(smiles_list) == len(set(smiles_list))

    def test_invalid_smiles_raises_value_error(self):
        """Invalid SMILES raises ValueError with clear message."""
        with pytest.raises(ValueError, match="Invalid SMILES"):
            war_room_service.evaluate_war_room("NOT_A_VALID_SMILES", "anti_inflammatory_exploration_v1")


# ── 7. Backward Compatibility Tests ───────────────────────────────────────────

class TestBackwardCompatibility:
    def test_original_shortlist_service_still_works(self):
        """Existing generate_shortlist function continues to work unchanged."""
        results = generate_shortlist(ASPIRIN, "antiinflammatory", top_n=3)
        assert len(results) > 0
        assert hasattr(results[0], "product_smiles")
        assert hasattr(results[0], "score")

    def test_original_shortlist_endpoint_still_works(self):
        """POST /api/modification/shortlist still returns original schema."""
        resp = client.post("/api/modification/shortlist", json={
            "smiles": ASPIRIN,
            "target_endpoint": "antiinflammatory",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "shortlist" in data
        assert len(data["shortlist"]) > 0
        assert "transform_name" in data["shortlist"][0]


# ── 8. API Integration Tests ──────────────────────────────────────────────────

class TestWarRoomApi:
    def test_get_profiles_endpoint(self):
        """GET /api/modification/profiles returns available profiles."""
        resp = client.get("/api/modification/profiles")
        assert resp.status_code == 200
        data = resp.json()
        assert "profiles" in data
        assert len(data["profiles"]) >= 3
        profile_ids = [p["id"] for p in data["profiles"]]
        assert "anti_inflammatory_exploration_v1" in profile_ids
        assert "balanced_lead_optimization_v1" in profile_ids
        assert "safety_first_scrutiny_v1" in profile_ids

    def test_post_war_room_endpoint_success(self):
        """POST /api/modification/war-room returns parent and ranked shortlist."""
        resp = client.post("/api/modification/war-room", json={
            "smiles": ASPIRIN,
            "profile_id": "anti_inflammatory_exploration_v1",
            "top_n": 3,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "parent" in data
        assert "profile" in data
        assert "shortlist" in data
        assert "disclaimer" in data
        assert len(data["shortlist"]) <= 3
        assert data["parent"]["smiles"] == Chem.MolToSmiles(Chem.MolFromSmiles(ASPIRIN), canonical=True)

    def test_post_war_room_invalid_smiles(self):
        """POST /api/modification/war-room with invalid SMILES returns 400."""
        resp = client.post("/api/modification/war-room", json={
            "smiles": "INVALID_STRUCTURE_XYZ",
            "profile_id": "anti_inflammatory_exploration_v1",
        })
        assert resp.status_code == 400
        assert "Invalid SMILES" in resp.json()["detail"]
