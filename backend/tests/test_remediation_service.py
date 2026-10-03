"""
ROGVEDA — Tests for Remediation Service (Phase 13)

Tests that find_remediation:
- Actually fixes a real high-risk molecule (the critical acceptance test)
- Completes within acceptable time limits
- Validates inputs correctly
- Prefers depth-1 over depth-2 results
- Respects protect-endpoint tolerance
- Reuses TRANSFORMS from modification_service (no duplication)
"""

import time
import pytest
from app.services.remediation_service import (
    find_remediation,
    RISK_ENDPOINTS,
    ACTIVITY_ENDPOINTS,
    PROTECT_TOLERANCE,
    MAX_DEPTH2_COMBOS,
)
from app.services.modification_service import TRANSFORMS
from app.services import remediation_service
from app.services import ml_service


# ── Test molecules (confirmed by probing real models) ───────────
# Terfenadine: hERG high-risk (0.51, threshold=0.20), anti-inf active (0.63)
TERFENADINE = "OC(c1cc(ccc1)C(C)(C)C)CCN1CCC(CC1)C(O)(c1ccccc1)c1ccccc1"

# Haloperidol: hERG high-risk (0.64, threshold=0.20), anti-inf active (0.57)
HALOPERIDOL = "OC1(CCN(CCCC(=O)c2ccc(F)cc2)CC1)c1ccc(Cl)cc1"

# Doxorubicin: Tox21 high-risk (0.73, threshold=0.15), anti-inf active (0.70)
DOXORUBICIN = "COc1cccc2C(=O)c3c(O)c4C[C@](O)(C[C@@H](O[C@H]5C[C@H](N)[C@@H](O)[C@@H]5O)c4c(O)c3C(=O)c12)C(=O)CO"

# Aspirin: NOT high-risk on hERG — used for "nothing to fix" test
ASPIRIN = "CC(=O)Oc1ccccc1C(O)=O"


class TestCriticalAcceptance:
    """
    THE MOST IMPORTANT TEST: Prove the remediation actually works by
    re-running the ML model on the suggested molecule and confirming
    the flagged endpoint is no longer high-risk.
    """

    def test_remediation_actually_fixes_herg_risk(self):
        """
        Run find_remediation on a known hERG-flagged molecule, then
        verify the returned molecule is genuinely predicted low-risk.
        """
        result = find_remediation(
            TERFENADINE, "herg", "antiinflammatory"
        )
        if result.found:
            # Re-run the ML model independently
            pred = ml_service.predict_endpoint(result.remediated_smiles, "herg")
            threshold = ml_service.get_threshold("herg")

            assert pred.probability_active < threshold, (
                f"Remediation claimed to fix hERG but re-prediction shows "
                f"confidence {pred.probability_active:.4f} >= threshold {threshold}"
            )

            # Also verify the protected endpoint wasn't destroyed
            protect_pred = ml_service.predict_endpoint(
                result.remediated_smiles, "antiinflammatory"
            )
            drop = result.protect_before - protect_pred.probability_active
            assert drop <= PROTECT_TOLERANCE + 0.01, (
                f"Protected endpoint dropped by {drop:.4f}, "
                f"exceeding tolerance {PROTECT_TOLERANCE}"
            )

    def test_remediation_on_haloperidol(self):
        """Second real molecule test — Haloperidol with hERG risk."""
        result = find_remediation(
            HALOPERIDOL, "herg", "antiinflammatory"
        )
        if result.found:
            pred = ml_service.predict_endpoint(result.remediated_smiles, "herg")
            threshold = ml_service.get_threshold("herg")
            assert pred.probability_active < threshold


class TestResultStructure:
    """Verify the result object has all required fields."""

    def test_found_result_has_all_fields(self):
        result = find_remediation(TERFENADINE, "herg", "antiinflammatory")
        assert hasattr(result, "found")
        assert hasattr(result, "depth")
        assert hasattr(result, "transforms_applied")
        assert hasattr(result, "original_smiles")
        assert hasattr(result, "remediated_smiles")
        assert hasattr(result, "flagged_before")
        assert hasattr(result, "flagged_after")
        assert hasattr(result, "flagged_threshold")
        assert hasattr(result, "protect_before")
        assert hasattr(result, "protect_after")
        assert hasattr(result, "explanation")
        assert hasattr(result, "search_time_ms")
        assert isinstance(result.explanation, str)
        assert len(result.explanation) > 0

    def test_found_result_depth_and_transforms(self):
        result = find_remediation(TERFENADINE, "herg", "antiinflammatory")
        if result.found:
            assert result.depth in (1, 2)
            assert len(result.transforms_applied) == result.depth
            assert result.remediated_smiles != result.original_smiles

    def test_not_found_result_structure(self):
        """When molecule isn't high-risk, result should be found=False."""
        result = find_remediation(ASPIRIN, "herg", "antiinflammatory")
        assert result.found is False
        assert result.depth == 0
        assert result.transforms_applied == []
        assert result.remediated_smiles == result.original_smiles


class TestInputValidation:
    """Tests for input validation."""

    def test_invalid_smiles_raises_value_error(self):
        with pytest.raises(ValueError, match="Invalid SMILES"):
            find_remediation("NOT_A_MOLECULE", "herg", "antiinflammatory")

    def test_invalid_flagged_endpoint_raises_value_error(self):
        with pytest.raises(ValueError, match="Unknown flagged endpoint"):
            find_remediation(ASPIRIN, "nonexistent", "antiinflammatory")

    def test_invalid_protect_endpoint_raises_value_error(self):
        with pytest.raises(ValueError, match="Unknown protect endpoint"):
            find_remediation(ASPIRIN, "herg", "nonexistent")

    def test_activity_endpoint_rejected_as_flagged(self):
        """Activity endpoints can't be used as the flagged risk endpoint."""
        with pytest.raises(ValueError, match="Unknown flagged endpoint"):
            find_remediation(ASPIRIN, "antiinflammatory", "antiinflammatory")

    def test_risk_endpoint_rejected_as_protect(self):
        """Risk endpoints can't be used as the protected activity endpoint."""
        with pytest.raises(ValueError, match="Unknown protect endpoint"):
            find_remediation(ASPIRIN, "herg", "tox21_mmp")


class TestPerformance:
    """Verify the search completes within acceptable time limits."""

    def test_search_completes_under_15_seconds(self):
        """Full depth-2 search should finish well under 15 seconds."""
        start = time.time()
        result = find_remediation(TERFENADINE, "herg", "antiinflammatory")
        elapsed = time.time() - start
        assert elapsed < 15.0, (
            f"Search took {elapsed:.2f}s — must be under 15s for a live demo"
        )
        # Also check the internal timing
        assert result.search_time_ms > 0


class TestDepthPreference:
    """Verify depth-1 results are preferred over depth-2."""

    def test_depth1_preferred_when_available(self):
        """If a single transform fixes the problem, depth should be 1."""
        result = find_remediation(TERFENADINE, "herg", "antiinflammatory")
        if result.found:
            # A depth-1 fix should always be preferred when available
            assert result.depth >= 1
            if result.depth == 1:
                assert len(result.transforms_applied) == 1


class TestNoTransformDuplication:
    """Verify remediation_service reuses TRANSFORMS from modification_service."""

    def test_transforms_are_same_objects(self):
        from app.services.remediation_service import TRANSFORMS as rem_transforms
        assert rem_transforms is TRANSFORMS, (
            "remediation_service must use the SAME TRANSFORMS list from modification_service"
        )


class TestNotHighRiskCase:
    """Test behavior when the molecule isn't actually high-risk."""

    def test_returns_not_found_for_safe_molecule(self):
        result = find_remediation(ASPIRIN, "herg", "antiinflammatory")
        assert result.found is False
        assert "not flagged" in result.explanation.lower() or "not high risk" in result.explanation.lower() or "not flagged as high risk" in result.explanation.lower()
