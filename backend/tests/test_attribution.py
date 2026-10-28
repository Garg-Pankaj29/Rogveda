"""
ROGVEDA — Phase 2: Explainable Molecular Attribution Tests
Unit and API integration tests for atomic environment perturbation attribution,
bit collision tracking, structural alerts, and endpoint compatibility.
"""

import pytest
from fastapi.testclient import TestClient
from rdkit import Chem

from app.main import app
from app.services import ml_service
from app.services.attribution_service import explain_prediction, detect_structural_alerts

client = TestClient(app)

ASPIRIN = "CC(=O)Oc1ccccc1C(=O)O"
NON_CANONICAL_ASPIRIN = "O=C(C)Oc1ccccc1C(=O)O"
IBUPROFEN = "CC(C)Cc1ccc(cc1)C(C)C(=O)O"
CAFFEINE = "Cn1c(=O)c2c(ncn2C)n(C)c1=O"


class TestAttributionConsistencyAndBounds:
    def test_atom_indices_within_valid_range(self):
        """All atom attribution indices must fall strictly within [0, NumAtoms - 1]."""
        mol = Chem.MolFromSmiles(ASPIRIN)
        num_atoms = mol.GetNumAtoms()
        res = explain_prediction(ASPIRIN, "herg")

        assert res.is_available is True
        assert len(res.atom_attributions) == num_atoms
        for attr in res.atom_attributions:
            assert 0 <= attr.atom_index < num_atoms
            assert attr.atom_symbol == mol.GetAtomWithIdx(attr.atom_index).GetSymbol()

    def test_bond_indices_within_valid_range(self):
        """All bond attribution indices and connected atom indices must be valid."""
        mol = Chem.MolFromSmiles(ASPIRIN)
        num_bonds = mol.GetNumBonds()
        res = explain_prediction(ASPIRIN, "herg")

        assert len(res.bond_attributions) == num_bonds
        for b_attr in res.bond_attributions:
            assert 0 <= b_attr.bond_index < num_bonds
            assert 0 <= b_attr.begin_atom_index < mol.GetNumAtoms()
            assert 0 <= b_attr.end_atom_index < mol.GetNumAtoms()

    def test_canonical_smiles_mapping_consistency(self):
        """Explanation outputs must be identical regardless of input SMILES atom ordering."""
        res_canon = explain_prediction(ASPIRIN, "herg")
        res_non_canon = explain_prediction(NON_CANONICAL_ASPIRIN, "herg")

        assert res_canon.canonical_smiles == res_non_canon.canonical_smiles
        assert res_canon.probability == res_non_canon.probability
        assert len(res_canon.atom_attributions) == len(res_non_canon.atom_attributions)
        for a1, a2 in zip(res_canon.atom_attributions, res_non_canon.atom_attributions):
            assert a1.atom_index == a2.atom_index
            assert a1.raw_contribution == a2.raw_contribution

    def test_agreement_with_original_ml_prediction(self):
        """Attribution response probability and label must exactly match ml_service."""
        orig_pred = ml_service.predict_endpoint(ASPIRIN, "herg")
        res = explain_prediction(ASPIRIN, "herg")

        assert res.probability == orig_pred.probability_active
        assert res.label == orig_pred.label
        assert res.confidence == orig_pred.confidence
        assert res.model_version == orig_pred.model_version

    def test_normalized_intensity_bounded(self):
        """Normalized intensity must strictly lie within [-1.0, 1.0]."""
        res = explain_prediction(ASPIRIN, "antiinflammatory")
        for attr in res.atom_attributions:
            assert -1.0 <= attr.normalized_intensity <= 1.0

        for b_attr in res.bond_attributions:
            assert -1.0 <= b_attr.normalized_intensity <= 1.0

    def test_signed_score_direction_interpretation(self):
        """Direction ('positive', 'negative', 'neutral') must match raw_contribution sign."""
        res = explain_prediction(ASPIRIN, "herg")
        for attr in res.atom_attributions:
            if attr.direction == "positive":
                assert attr.raw_contribution > 0
                assert attr.normalized_intensity > 0
            elif attr.direction == "negative":
                assert attr.raw_contribution < 0
                assert attr.normalized_intensity < 0
            else:
                assert abs(attr.raw_contribution) < 1e-4


class TestStructuralAlertsAndCollisions:
    def test_structural_alerts_detected_and_kept_separate(self):
        """Structural alerts are detected via FilterCatalog and kept separate from model weights."""
        mol = Chem.MolFromSmiles(ASPIRIN)
        alerts = detect_structural_alerts(mol)
        
        # Aspirin contains a phenol ester moiety recognized by BRENK
        assert len(alerts) >= 1
        assert any("ester" in a.alert_name.lower() or "phenol" in a.alert_name.lower() for a in alerts)
        for alert in alerts:
            assert alert.rule_set in ("PAINS", "BRENK", "NIH")
            assert len(alert.matched_atoms) > 0
            for atom_idx in alert.matched_atoms:
                assert 0 <= atom_idx < mol.GetNumAtoms()

    def test_bit_collisions_tracked_accurately(self):
        """Overlapping bits with multiple atom environments are flagged as has_collision=True."""
        res = explain_prediction(ASPIRIN, "herg")
        # In a symmetric aromatic ring or repeating motifs, collisions occur in 2048-bit Morgan FP
        collisions_present = any(attr.has_collision for attr in res.atom_attributions)
        assert collisions_present is True
        for attr in res.atom_attributions:
            assert attr.bit_count == len(attr.bit_ids)


class TestUnsupportedAndEdgeCases:
    def test_unavailable_model_returns_structured_unavailable_state(self):
        """Unsupported/unavailable endpoint (e.g., metabolic_stability) produces explicit state."""
        res = explain_prediction(ASPIRIN, "metabolic_stability")
        assert res.is_available is False
        assert "metabolic_stability" in res.unavailability_reason
        assert res.probability is None
        assert len(res.atom_attributions) == 0
        assert len(res.bond_attributions) == 0
        # Structural alerts can still be computed independently
        assert len(res.structural_alerts) >= 1

    def test_invalid_smiles_raises_value_error(self):
        """Invalid SMILES string raises ValueError."""
        with pytest.raises(ValueError) as excinfo:
            explain_prediction("INVALID_NOT_A_SMILES_999", "herg")
        assert "Invalid SMILES" in str(excinfo.value)

    def test_different_endpoint_categories_work(self):
        """Both liability endpoints (herg, tox21_mmp) and efficacy endpoints work."""
        res_herg = explain_prediction(IBUPROFEN, "herg")
        assert res_herg.is_available is True
        assert res_herg.endpoint == "herg"

        res_anti = explain_prediction(IBUPROFEN, "antiinflammatory")
        assert res_anti.is_available is True
        assert res_anti.endpoint == "antiinflammatory"

    def test_highlighted_svg_is_valid_xml(self):
        """Generated SVG string is non-empty and contains valid SVG structure."""
        res = explain_prediction(ASPIRIN, "herg")
        assert res.highlighted_svg is not None
        assert "<svg" in res.highlighted_svg
        assert "</svg>" in res.highlighted_svg


class TestAttributionApi:
    def test_api_attribution_success(self):
        """POST /api/molecule/attribution returns 200 and valid schema."""
        resp = client.post(
            "/api/molecule/attribution",
            json={"smiles": ASPIRIN, "endpoint": "herg"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["canonical_smiles"] == Chem.MolToSmiles(Chem.MolFromSmiles(ASPIRIN), canonical=True)
        assert data["endpoint"] == "herg"
        assert data["is_available"] is True
        assert len(data["atom_attributions"]) == 13
        assert "highlighted_svg" in data
        assert data["attribution_method"].startswith("Morgan")

    def test_api_attribution_unavailable_model(self):
        """POST /api/molecule/attribution with unavailable endpoint returns is_available=False."""
        resp = client.post(
            "/api/molecule/attribution",
            json={"smiles": ASPIRIN, "endpoint": "unknown_future_endpoint"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_available"] is False
        assert "unknown_future_endpoint" in data["unavailability_reason"]

    def test_api_attribution_invalid_smiles(self):
        """POST /api/molecule/attribution with invalid SMILES returns 400."""
        resp = client.post(
            "/api/molecule/attribution",
            json={"smiles": "XYZZY_NOT_SMILES", "endpoint": "herg"},
        )
        assert resp.status_code == 400
        assert "Invalid SMILES" in resp.json()["detail"]
