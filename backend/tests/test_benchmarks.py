"""
ROGVEDA — Benchmark Drug Gallery Test Suite

Verifies:
  1. Every benchmark structure parses, sanitizes, and canonicalizes cleanly using RDKit.
  2. Every benchmark has non-empty traceable source provenance and citations.
  3. No model prediction or probability is hard-coded into catalog data.
  4. SMILES-based identification is invariant to atom ordering / alternate SMILES syntax.
  5. API endpoints (/api/benchmarks, /api/benchmarks/{id}, /api/benchmarks/identify).
  6. Predictions for benchmarks originate from the genuine model service.
"""

import pytest
from fastapi.testclient import TestClient
from rdkit import Chem
from rdkit.Chem import Descriptors

from app.main import app
from app.services import benchmark_service, ml_service


@pytest.fixture
def client():
    return TestClient(app)


class TestBenchmarkCatalogIntegrity:
    """Tests catalog chemistry correctness and provenance invariants."""

    def test_all_catalog_compounds_present(self):
        catalog = benchmark_service.get_benchmark_catalog()
        ids = {b.id for b in catalog}
        expected = {"terfenadine", "fexofenadine", "aspirin", "ibuprofen", "celecoxib"}
        assert expected.issubset(ids), f"Missing expected benchmarks: {expected - ids}"
        assert len(catalog) == 5

    def test_rdkit_canonicalization_and_descriptors(self):
        """Verify each SMILES parses in RDKit, formula and MW match calculated."""
        for b_id in ["terfenadine", "fexofenadine", "aspirin", "ibuprofen", "celecoxib"]:
            detail = benchmark_service.get_benchmark_by_id(b_id)
            assert detail is not None, f"Detail missing for {b_id}"

            mol = Chem.MolFromSmiles(detail.canonical_smiles)
            assert mol is not None, f"SMILES invalid in RDKit: {detail.canonical_smiles}"
            
            # Recalculate canonical SMILES
            recomputed = Chem.MolToSmiles(mol, canonical=True)
            assert recomputed == detail.canonical_smiles

            # Recalculate MW
            calc_mw = round(Descriptors.MolWt(mol), 2)
            assert abs(calc_mw - detail.molecular_weight) < 0.1

    def test_traceable_provenance_and_citations(self):
        """Ensure all benchmarks contain verifiable sources, IDs, and retrieval dates."""
        catalog = benchmark_service.get_benchmark_catalog()
        for summary in catalog:
            detail = benchmark_service.get_benchmark_by_id(summary.id)
            assert detail is not None
            assert len(detail.provenance_sources) >= 3, f"{detail.id} has insufficient provenance sources"
            
            for src in detail.provenance_sources:
                assert src.source_type, f"Missing source_type in {detail.id}"
                assert src.identifier, f"Missing identifier in {detail.id}"
                assert src.citation_title, f"Missing citation_title in {detail.id}"
                assert src.retrieval_date, f"Missing retrieval_date in {detail.id}"

            assert detail.attribution_license
            assert detail.historical_context
            assert detail.mechanism_of_action

    def test_no_hardcoded_probabilities_in_catalog(self):
        """Protected invariant: catalog metadata must NEVER hard-code model probability numbers."""
        for b_id in ["terfenadine", "fexofenadine", "aspirin", "ibuprofen", "celecoxib"]:
            detail = benchmark_service.get_benchmark_by_id(b_id)
            d_dict = detail.dict()
            # Confirm no numeric predictions are embedded in top-level fields
            assert "probability" not in d_dict
            assert "predicted_probability" not in d_dict
            assert "calibrated_score" not in d_dict

    def test_case_study_pairings(self):
        """Verify paired case studies exist with correct bidirectional or linked references."""
        case_studies = benchmark_service.get_benchmark_case_studies()
        assert len(case_studies) >= 2
        
        study_ids = {cs["id"] for cs in case_studies}
        assert "herg_optimization" in study_ids
        assert "nsaid_mechanisms" in study_ids

        herg_study = next(cs for cs in case_studies if cs["id"] == "herg_optimization")
        assert herg_study["compound_a"]["id"] == "terfenadine"
        assert herg_study["compound_b"]["id"] == "fexofenadine"


class TestBenchmarkIdentification:
    """Tests matching active molecules against benchmark records."""

    def test_exact_smiles_match(self):
        aspirin_smi = "CC(=O)Oc1ccccc1C(=O)O"
        match = benchmark_service.find_benchmark_by_smiles(aspirin_smi)
        assert match is not None
        assert match.id == "aspirin"

    def test_permuted_atom_order_smiles_match(self):
        """Non-canonical equivalent SMILES must still match via RDKit canonicalization."""
        # Non-canonical SMILES for Aspirin (starting from carboxylic acid carbon)
        alt_aspirin = "O=C(O)c1ccccc1OC(=O)C"
        match = benchmark_service.find_benchmark_by_smiles(alt_aspirin)
        assert match is not None
        assert match.id == "aspirin"

    def test_unrelated_molecule_returns_none(self):
        caffeine = "CN1C=NC2=C1C(=O)N(C(=O)N2C)C"
        match = benchmark_service.find_benchmark_by_smiles(caffeine)
        assert match is None

    def test_invalid_smiles_returns_none(self):
        assert benchmark_service.find_benchmark_by_smiles("INVALID_CHEMISTRY_XYZ") is None
        assert benchmark_service.find_benchmark_by_smiles("") is None


class TestBenchmarkAPIEndpoints:
    """Tests FastAPI router endpoints."""

    def test_api_get_catalog(self, client):
        res = client.get("/api/benchmarks")
        assert res.status_code == 200
        data = res.json()
        assert data["total_benchmarks"] == 5
        assert len(data["benchmarks"]) == 5
        assert len(data["categories"]) >= 2
        assert len(data["case_studies"]) >= 2

    def test_api_get_detail_valid(self, client):
        res = client.get("/api/benchmarks/terfenadine")
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == "terfenadine"
        assert data["formula"] == "C32H41NO2"
        assert "1997" in data["regulatory_status"]
        assert len(data["provenance_sources"]) >= 3

    def test_api_get_detail_not_found(self, client):
        res = client.get("/api/benchmarks/nonexistent_drug")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

    def test_api_get_case_studies(self, client):
        res = client.get("/api/benchmarks/case-studies")
        assert res.status_code == 200
        studies = res.json()
        assert isinstance(studies, list)
        assert any(s["id"] == "herg_optimization" for s in studies)

    def test_api_identify_benchmark_hit(self, client):
        res = client.post(
            "/api/benchmarks/identify",
            json={"smiles": "Cc1ccc(-c2cc(C(F)(F)F)nn2-c2ccc(S(N)(=O)=O)cc2)cc1"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["is_benchmark"] is True
        assert data["benchmark"]["id"] == "celecoxib"

    def test_api_identify_benchmark_miss(self, client):
        res = client.post(
            "/api/benchmarks/identify",
            json={"smiles": "CCCCCC"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["is_benchmark"] is False
        assert data["benchmark"] is None


class TestGenuineModelPredictionsOnBenchmarks:
    """Verifies that model predictions are live, genuine, and separate from historical context."""

    def test_live_prediction_pipeline_execution(self):
        """Predictions must execute through real ml_service without overrides."""
        terfenadine = benchmark_service.get_benchmark_by_id("terfenadine")
        assert terfenadine is not None

        # Call real prediction service
        herg_pred = ml_service.predict_endpoint(terfenadine.canonical_smiles, "herg")
        assert herg_pred.canonical_smiles == terfenadine.canonical_smiles
        assert 0.0 <= herg_pred.probability_active <= 1.0
        # High cardiotoxic risk expected from genuine model
        assert "likely active" in herg_pred.label.lower()
        assert herg_pred.probability_active > 0.8

