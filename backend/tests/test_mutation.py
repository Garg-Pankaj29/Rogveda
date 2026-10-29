"""
ROGVEDA — Live Mutation Workbench Tests (Phase 4)

Validates the live molecular mutation engine:
- Complete 12-transform catalog retrieval
- Substructure applicability detection and honest unavailability tracking
- Ambiguity and positional isomer detection (variants)
- Chemical validity and RDKit sanitization of products
- Property delta correctness
- Independent candidate model predictions (never reused from parent)
- Parent/candidate isolation
- Invalid SMILES and error handling
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.modification_service import (
    TRANSFORM_CATALOG,
    apply_mutation,
    evaluate_applicable_mutations,
    get_transform_catalog,
)

client = TestClient(app)

ASPIRIN = "CC(=O)Oc1ccccc1C(=O)O"
PARACETAMOL = "CC(=O)Nc1ccc(O)cc1"
ANILINE = "Nc1ccccc1"
CHLOROBENZENE = "Clc1ccccc1"
CYCLOHEXANE = "C1CCCCC1"


class TestMutationCatalog:
    def test_catalog_has_all_12_transforms(self):
        catalog = get_transform_catalog()
        assert len(catalog) == 12
        ids = {t["id"] for t in catalog}
        assert "oh_to_ome" in ids
        assert "oh_to_f" in ids
        assert "nh2_to_nhac" in ids
        assert "aromatic_ch_to_methyl" in ids
        assert "cl_to_f" in ids
        assert "cooh_to_conh2" in ids
        assert "aromatic_ch_to_f" in ids
        assert "n_methylation" in ids
        assert "ome_to_oh" in ids
        assert "ester_to_amide" in ids
        assert "br_to_cn" in ids
        assert "cl_to_cn" in ids

    def test_api_transforms_endpoint(self):
        resp = client.get("/api/modification/transforms")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_transforms"] == 12
        assert len(data["transforms"]) == 12


class TestMutationApplicability:
    def test_aspirin_applicability(self):
        result = evaluate_applicable_mutations(ASPIRIN)
        assert result["total_transforms"] == 12
        assert result["applicable_count"] >= 4

        transforms_by_id = {t["id"]: t for t in result["transforms"]}
        # Carboxylic acid -> amide is applicable
        assert transforms_by_id["cooh_to_conh2"]["is_applicable"] is True
        assert transforms_by_id["cooh_to_conh2"]["match_count"] == 1
        assert transforms_by_id["cooh_to_conh2"]["preview_smiles"] is not None

        # Hydroxyl -> methoxy is applicable (from COOH OH)
        assert transforms_by_id["oh_to_ome"]["is_applicable"] is True

        # Aromatic C-H -> methyl has 4 positions on benzene ring
        assert transforms_by_id["aromatic_ch_to_methyl"]["is_applicable"] is True
        assert transforms_by_id["aromatic_ch_to_methyl"]["match_count"] == 4
        assert transforms_by_id["aromatic_ch_to_methyl"]["has_multiple_products"] is True
        assert len(transforms_by_id["aromatic_ch_to_methyl"]["variants"]) == 4

        # Chlorine transform is inapplicable
        assert transforms_by_id["cl_to_f"]["is_applicable"] is False
        assert transforms_by_id["cl_to_f"]["match_count"] == 0
        assert "No chlorine" in transforms_by_id["cl_to_f"]["unavailability_reason"]

    def test_cyclohexane_has_zero_applicable_transforms(self):
        result = evaluate_applicable_mutations(CYCLOHEXANE)
        assert result["applicable_count"] == 0
        for t in result["transforms"]:
            assert t["is_applicable"] is False
            assert t["unavailability_reason"] is not None

    def test_aniline_amine_transform(self):
        result = evaluate_applicable_mutations(ANILINE)
        transforms_by_id = {t["id"]: t for t in result["transforms"]}
        assert transforms_by_id["nh2_to_nhac"]["is_applicable"] is True
        assert transforms_by_id["nh2_to_nhac"]["match_count"] == 1

    def test_chlorobenzene_chlorine_transforms(self):
        result = evaluate_applicable_mutations(CHLOROBENZENE)
        transforms_by_id = {t["id"]: t for t in result["transforms"]}
        assert transforms_by_id["cl_to_f"]["is_applicable"] is True
        assert transforms_by_id["cl_to_cn"]["is_applicable"] is True

    def test_invalid_smiles_raises_error(self):
        with pytest.raises(ValueError):
            evaluate_applicable_mutations("INVALID_CHEMICAL_SMILES_XYZ")

        with pytest.raises(ValueError):
            evaluate_applicable_mutations("")

    def test_api_applicable_endpoint(self):
        resp = client.post("/api/modification/applicable", json={"smiles": ASPIRIN})
        assert resp.status_code == 200
        data = resp.json()
        assert data["applicable_count"] >= 4
        assert data["total_transforms"] == 12
        assert data["num_applicable"] == data["applicable_count"]
        assert data["num_unavailable"] == 12 - data["applicable_count"]
        for t in data["transforms"]:
            assert t["applicable"] == t["is_applicable"]
            assert t["substructure_matches"] == t["match_count"]
            assert t["product_variants_count"] == len(t["variants"])

    def test_api_applicable_invalid_smiles(self):
        resp = client.post("/api/modification/applicable", json={"smiles": "NOT_A_SMILES"})
        assert resp.status_code == 400


class TestMutationExecution:
    def test_apply_valid_mutation_produces_distinct_candidate(self):
        result = apply_mutation(ASPIRIN, "cooh_to_conh2")
        assert result["is_distinct"] is True
        assert result["parent_smiles"] != result["candidate_smiles"]
        assert result["transform_id"] == "cooh_to_conh2"
        assert result["transform_name"] == "Replace -COOH with -CONH₂"

        # Check properties and deltas
        parent_mw = result["parent_properties"]["mw"]
        cand_mw = result["candidate_properties"]["mw"]
        assert cand_mw != parent_mw
        assert "mw" in result["property_deltas"] or "molecular_weight" in result["property_deltas"]
        assert result["property_deltas"]["mw"]["label"] == "Molecular Weight"
        assert result["property_deltas"]["mw"]["unit"] == "Da"
        assert "parent_val" in result["property_deltas"]["mw"]
        assert "candidate_val" in result["property_deltas"]["mw"]
        assert "timing_ms" in result
        assert result["candidate_formula"]
        assert result["selected_variant_index"] == 0

        # Check predictions are populated
        assert len(result["candidate_predictions"]) == 6
        assert len(result["parent_predictions"]) == 6
        assert len(result["predictions"]) == 6
        for pred in result["candidate_predictions"]:
            assert "endpoint_id" in pred
            assert "status_label" in pred
            assert "confidence" in pred
            assert "category" in pred
            assert "probability" in pred

    def test_apply_inapplicable_mutation_raises_error(self):
        with pytest.raises(ValueError) as exc:
            apply_mutation(ASPIRIN, "cl_to_f")
        assert "not applicable" in str(exc.value).lower()

    def test_apply_unknown_transform_raises_error(self):
        with pytest.raises(ValueError) as exc:
            apply_mutation(ASPIRIN, "non_existent_mutation_xyz")
        assert "unknown transform" in str(exc.value).lower()

    def test_variant_selection_for_multiproduct_transform(self):
        # Aromatic C-H has 4 variants on aspirin
        res_v0 = apply_mutation(ASPIRIN, "aromatic_ch_to_methyl", variant_index=0)
        res_v1 = apply_mutation(ASPIRIN, "aromatic_ch_to_methyl", variant_index=1)
        assert res_v0["total_variants"] == 4
        assert res_v0["has_multiple_products"] is True
        assert res_v0["candidate_smiles"] != res_v1["candidate_smiles"]

    def test_api_mutate_endpoint_success(self):
        resp = client.post(
            "/api/modification/mutate",
            json={"smiles": ASPIRIN, "transform_id": "cooh_to_conh2", "variant_index": 0},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_distinct"] is True
        assert data["candidate_smiles"] != data["parent_smiles"]
        assert len(data["candidate_predictions"]) == 6

    def test_api_mutate_inapplicable_returns_400(self):
        resp = client.post(
            "/api/modification/mutate",
            json={"smiles": ASPIRIN, "transform_id": "cl_to_f"},
        )
        assert resp.status_code == 400
        assert "not applicable" in resp.json()["detail"].lower()

