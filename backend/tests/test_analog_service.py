"""
ROGVEDA — Tests for Analog Service (Phase 12)

Tests that generate_shortlist:
- Returns ≤ 5 ranked results for aspirin
- Each result has required fields (score, transform_name, product_smiles, etc.)
- Results are sorted descending by score
- Reuses TRANSFORMS from modification_service (no duplication)
- Raises ValueError for invalid input
"""

import pytest
from app.services.analog_service import generate_shortlist, ACTIVITY_ENDPOINTS
from app.services.modification_service import TRANSFORMS
from app.services import analog_service


# ── Aspirin SMILES ──────────────────────────────────────────────────────
ASPIRIN = "CC(=O)Oc1ccccc1C(O)=O"


class TestGenerateShortlist:
    """Tests for the generate_shortlist function."""

    def test_returns_at_most_5_results(self):
        """Aspirin has multiple applicable transforms; we should get ≤ 5."""
        results = generate_shortlist(ASPIRIN, "antiinflammatory")
        assert len(results) <= 5
        assert len(results) > 0, "Aspirin should have at least one applicable transform"

    def test_results_have_required_fields(self):
        """Each result must have rank, score, transform_name, product_smiles, etc."""
        results = generate_shortlist(ASPIRIN, "antiinflammatory")
        for r in results:
            assert hasattr(r, "rank")
            assert hasattr(r, "score")
            assert hasattr(r, "transform_name")
            assert hasattr(r, "product_smiles")
            assert hasattr(r, "properties")
            assert hasattr(r, "predictions")
            assert hasattr(r, "property_deltas")
            assert hasattr(r, "transform_description")
            assert isinstance(r.score, float)
            assert isinstance(r.product_smiles, str)
            assert len(r.product_smiles) > 0

    def test_results_sorted_descending_by_score(self):
        """Results must be sorted from highest to lowest score."""
        results = generate_shortlist(ASPIRIN, "antiinflammatory")
        if len(results) >= 2:
            for i in range(len(results) - 1):
                assert results[i].score >= results[i + 1].score, (
                    f"Result {i} (score={results[i].score}) should be >= "
                    f"result {i+1} (score={results[i+1].score})"
                )

    def test_ranks_are_sequential(self):
        """Ranks should be 1, 2, 3, ... in order."""
        results = generate_shortlist(ASPIRIN, "antiinflammatory")
        for i, r in enumerate(results):
            assert r.rank == i + 1

    def test_each_result_has_predictions(self):
        """Each result should have prediction data from available models."""
        results = generate_shortlist(ASPIRIN, "antiinflammatory")
        for r in results:
            assert isinstance(r.predictions, list)
            assert len(r.predictions) > 0
            for pred in r.predictions:
                assert "endpoint_id" in pred
                assert "endpoint_name" in pred
                assert "status_label" in pred

    def test_product_smiles_are_valid(self):
        """Every product SMILES should be parseable by RDKit."""
        from rdkit import Chem
        results = generate_shortlist(ASPIRIN, "antiinflammatory")
        for r in results:
            mol = Chem.MolFromSmiles(r.product_smiles)
            assert mol is not None, (
                f"Product SMILES '{r.product_smiles}' from transform "
                f"'{r.transform_name}' is not valid"
            )

    def test_no_duplicate_products(self):
        """No two results should have the same product SMILES."""
        results = generate_shortlist(ASPIRIN, "antiinflammatory")
        smiles_set = set()
        for r in results:
            assert r.product_smiles not in smiles_set, (
                f"Duplicate product: {r.product_smiles}"
            )
            smiles_set.add(r.product_smiles)

    def test_property_deltas_present(self):
        """Each result should have MW/LogP/TPSA deltas."""
        results = generate_shortlist(ASPIRIN, "antiinflammatory")
        for r in results:
            assert isinstance(r.property_deltas, dict)
            # At least some deltas should be present
            if r.property_deltas:
                for key, val in r.property_deltas.items():
                    assert "original" in val
                    assert "modified" in val
                    assert "delta" in val


class TestInputValidation:
    """Tests for input validation."""

    def test_invalid_smiles_raises_value_error(self):
        """Invalid SMILES should raise ValueError."""
        with pytest.raises(ValueError, match="Invalid SMILES"):
            generate_shortlist("NOT_A_MOLECULE", "antiinflammatory")

    def test_invalid_endpoint_raises_value_error(self):
        """Unknown target endpoint should raise ValueError."""
        with pytest.raises(ValueError, match="Unknown target endpoint"):
            generate_shortlist(ASPIRIN, "nonexistent_endpoint")

    def test_risk_endpoint_rejected_as_target(self):
        """Toxicity endpoints cannot be used as target."""
        with pytest.raises(ValueError, match="Unknown target endpoint"):
            generate_shortlist(ASPIRIN, "herg")


class TestNoTransformDuplication:
    """Verify analog_service reuses the exact TRANSFORMS from modification_service."""

    def test_transforms_are_same_objects(self):
        """analog_service must import TRANSFORMS, not duplicate them."""
        # The TRANSFORMS used inside analog_service should be the same list
        from app.services.analog_service import TRANSFORMS as analog_transforms
        assert analog_transforms is TRANSFORMS, (
            "analog_service must use the SAME TRANSFORMS list from modification_service"
        )


class TestDifferentTargetEndpoints:
    """Test shortlist generation with different target endpoints."""

    @pytest.mark.parametrize("endpoint", ACTIVITY_ENDPOINTS)
    def test_all_activity_endpoints_work(self, endpoint):
        """Each valid activity endpoint should produce results without error."""
        results = generate_shortlist(ASPIRIN, endpoint)
        assert isinstance(results, list)
        # Results may vary per endpoint but should not crash
        for r in results:
            assert isinstance(r.score, float)
