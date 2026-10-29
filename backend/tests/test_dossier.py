"""
ROGVEDA — Research Dossier Tests (Phase 3)

Validates the 12-section reproducible research dossier:
- Full section presence and accurate section hierarchy
- Honest missing-data handling (never defaulted to 0 or safe)
- Grounded deterministic fallback executive summary
- Long SMILES and XSS/HTML injection sanitization
- Offline WeasyPrint PDF generation produces valid binary PDF files
- Full API integration across /api/reports/dossier, /api/reports/dossier/pdf,
  and backward compatibility with /api/reports/generate and documents
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.report_service import (
    generate_comprehensive_report,
    generate_deterministic_dossier_summary,
    generate_research_dossier,
    render_pdf_from_html,
)

client = TestClient(app)

ASPIRIN_SMILES = "CC(=O)Oc1ccccc1C(=O)O"
TAXOL_SMILES = "CC1=C2C(C(=O)C3(C(CC4C(C3C(C(C2(C)C)(CC1OC(=O)C(C(C5=CC=CC=C5)NC(=O)C6=CC=CC=C6)O)O)OC(=O)C7=CC=CC=C7)(CO4)OC(=O)C)O)C)OC(=O)C"


class TestDossierCoreGeneration:
    def test_full_12_sections_present_in_html(self):
        """Verify that all 12 required scientific sections are cleanly generated."""
        result = generate_research_dossier(
            smiles=ASPIRIN_SMILES,
            canonical_smiles=ASPIRIN_SMILES,
            properties={
                "formula": "C9H8O4",
                "mw": 180.16,
                "exactMass": 180.042,
                "logP": 1.19,
                "tpsa": 63.6,
                "hbd": 1,
                "hba": 4,
                "rotBonds": 3,
                "totalRings": 1,
                "aromaticRings": 1,
                "heavyAtoms": 13,
            },
            predictions=[
                {
                    "endpoint_name": "Anti-inflammatory",
                    "available": True,
                    "status_label": "Active",
                    "confidence": 0.88,
                    "threshold": 0.5,
                },
                {
                    "endpoint_name": "hERG Cardiotoxicity",
                    "available": True,
                    "status_label": "Low Risk",
                    "confidence": 0.12,
                    "threshold": 0.2,
                },
                {
                    "endpoint_name": "Metabolic Stability",
                    "available": False,
                    "status_label": "Model not available",
                    "confidence": None,
                },
            ],
            drug_likeness={
                "Lipinski": {"passed": True, "violations": 0},
                "Veber": {"passed": True, "violations": 0},
            },
            conformer_3d={
                "has_conformer": True,
                "status_label": "Generated & Energy-Optimized",
                "atom_count": 13,
            },
            war_room={
                "is_available": True,
                "profile_name": "Balanced Lead Optimization",
                "profile_version": "v1",
                "candidate_score": 78.5,
                "hard_constraints_passed": True,
                "target_endpoint": "Anti-inflammatory",
                "dimensions": [
                    {
                        "name": "Activity",
                        "parent_raw": 0.82,
                        "analog_raw": 0.91,
                        "delta": 0.09,
                        "effective_weight": 0.25,
                        "score": 0.91,
                        "is_available": True,
                    },
                    {
                        "name": "Metabolic Stability",
                        "is_available": False,
                        "unavailability_reason": "No validated local metabolic stability predictor installed",
                    },
                ],
            },
            attribution={
                "is_available": True,
                "endpoint_name": "Anti-inflammatory",
                "method_name": "Morgan Substructure Perturbation",
                "top_positive_atoms": [
                    {"atom_index": 7, "atom_symbol": "O", "raw_contribution": 0.142, "has_collision": False}
                ],
                "top_negative_atoms": [
                    {"atom_index": 0, "atom_symbol": "C", "raw_contribution": -0.035, "has_collision": True}
                ],
            },
            structural_alerts=[
                {"alert_name": "Phenol Ester Substructure", "rule_set": "BRENK", "matched_atoms": [2, 3, 4]}
            ],
            synthesizability={
                "sa_score": 1.58,
                "difficulty_label": "easy",
                "reactive_group_flags": [],
            },
            similarity_hits=[
                {"name": "Aspirin Sodium", "canonical_smiles": "CC(=O)Oc1ccccc1C(=O)[O-].[Na+]", "tanimoto": 0.86}
            ],
            lineage={
                "experiment_id": "EXP-ASPIRIN-001",
                "parent_experiment_id": "EXP-ROOT",
                "modification_chain": ["Parent Lead", "Candidate Analog"],
            },
        )

        html = result["html"]
        assert "ROG-DOSSIER-" in result["dossier_id"]
        assert "ROGVEDA &mdash; Research Dossier" in html

        # Verify presence of all 12 required sections
        assert "1. Title Page" or "dossier-header" in html
        assert "2. Executive Summary" in html
        assert "3. Structure Depiction" in html
        assert "4. 3D Conformer Geometry" in html
        assert "5. Physicochemical Properties" in html
        assert "6. Calibrated ML Bioactivity" in html
        assert "7. Lead Optimization War Room" in html
        assert "8. Explainable Molecular Attribution" in html
        assert "9. Structural Alerts" in html
        assert "10. Curated Chemical Library Similarity Search" in html
        assert "11. Experiment Lineage" in html
        assert "12. Mandatory Evidence &amp; Regulatory Non-Claim Disclaimer" in html

    def test_missing_data_honestly_displayed(self):
        """Ensure unavailable features display explicit unavailable text rather than defaulting to zero or safe."""
        result = generate_research_dossier(
            smiles=None,
            properties=None,
            predictions=None,
            conformer_3d=None,
            war_room=None,
            attribution=None,
        )

        html = result["html"]
        assert "Data yet to be calculated" in html
        assert "Conformer not generated in workspace" in html
        assert "Lead optimization analysis not executed" in html
        assert "Molecular attribution not requested or unavailable" in html
        # Must not silently claim 0 violations or safe
        assert "0 violations" not in html

    def test_deterministic_fallback_summary(self):
        """Deterministic summary must synthesize structured facts when local LLM is offline."""
        summary = generate_deterministic_dossier_summary(
            smiles=ASPIRIN_SMILES,
            properties={"formula": "C9H8O4", "mw": 180.16, "logP": 1.19, "tpsa": 63.6},
            predictions=[
                {"endpoint_name": "Anti-inflammatory", "available": True, "status_label": "Active"},
                {"endpoint_name": "hERG", "available": True, "status_label": "Low Risk"},
            ],
            drug_likeness={"Lipinski": {"passed": True, "violations": 0}},
            war_room={"is_available": True, "profile_name": "Balanced Lead", "candidate_score": 75.0, "hard_constraints_passed": True},
            structural_alerts=[],
            synthesizability={"sa_score": 1.58, "difficulty_label": "easy"},
        )

        assert "C9H8O4" in summary
        assert "180.16" in summary
        assert "LogP of 1.19" in summary
        assert "Anti-inflammatory" in summary
        assert "Balanced Lead" in summary
        assert "SA score 1.58/10" in summary
        assert "in-silico computational estimates" in summary

    def test_xss_and_html_injection_prevention(self):
        """Ensure dangerous script tags or HTML tags in user notes, SMILES, or labels are escaped."""
        malicious_input = '<script>alert("XSS")</script>'
        result = generate_research_dossier(
            smiles=malicious_input,
            properties={"formula": "<img src=x onerror=alert(1)>"},
            ai_summary={"summary": "Potentially unsafe <script>doBadThings()</script> inside summary"},
            lineage={"experiment_id": "<script>evil()</script>"},
        )

        html = result["html"]
        assert "<script>alert" not in html
        assert "<script>doBadThings" not in html
        assert "&lt;script&gt;" in html or "doBadThings" in html

    def test_long_and_complex_smiles_handling(self):
        """Test with long natural product (Taxol)."""
        result = generate_research_dossier(
            smiles=TAXOL_SMILES,
            properties={"formula": "C47H51NO14", "mw": 853.9},
        )
        assert result["html"] is not None
        assert TAXOL_SMILES in result["html"]
        # Monospace block should contain word-break style
        assert "word-break: break-all" in result["html"]

    def test_weasyprint_pdf_export_produces_valid_pdf_bytes(self):
        """Verify that render_pdf_from_html produces genuine binary PDF content."""
        dossier = generate_research_dossier(
            smiles=ASPIRIN_SMILES,
            properties={"formula": "C9H8O4", "mw": 180.16},
        )
        pdf_bytes = render_pdf_from_html(dossier["html"])

        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 2000
        # Valid PDF header
        assert pdf_bytes.startswith(b"%PDF-")


class TestDossierApiEndpoints:
    def test_api_dossier_html_endpoint(self):
        """POST /api/reports/dossier returns valid HTML and metadata."""
        payload = {
            "smiles": ASPIRIN_SMILES,
            "properties": {"formula": "C9H8O4", "mw": 180.16},
            "report_format": "Research Dossier (HTML)",
        }
        res = client.post("/api/reports/dossier", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "dossier_id" in data
        assert "html" in data
        assert data["pdf_available"] is True
        assert "ROG-DOSSIER-" in data["dossier_id"]

    def test_api_dossier_pdf_endpoint(self):
        """POST /api/reports/dossier/pdf returns genuine application/pdf content."""
        payload = {
            "smiles": ASPIRIN_SMILES,
            "properties": {"formula": "C9H8O4", "mw": 180.16},
        }
        res = client.post("/api/reports/dossier/pdf", json=payload)
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"
        assert res.content.startswith(b"%PDF-")
        assert "attachment; filename=" in res.headers.get("content-disposition", "")

    def test_api_legacy_generate_backward_compatibility(self):
        """Ensure /api/reports/generate maintains full backward compatibility for legacy clients."""
        payload = {
            "smiles": ASPIRIN_SMILES,
            "properties": {"formula": "C9H8O4", "mw": 180.16},
            "report_format": "Comprehensive Report (PDF)",
        }
        res = client.post("/api/reports/generate", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "html" in data
        assert "name" in data
        assert "Molecular Analysis Report" in data["html"]

    def test_api_legacy_generate_delegates_to_dossier_when_requested(self):
        """When report_format specifies 'Research Dossier (PDF)', /api/reports/generate returns the 12-section dossier."""
        payload = {
            "smiles": ASPIRIN_SMILES,
            "properties": {"formula": "C9H8O4", "mw": 180.16},
            "report_format": "Research Dossier (PDF)",
        }
        res = client.post("/api/reports/generate", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "Research Dossier" in data["html"]
        assert "ROG-DOSSIER-" in data["html"]

    def test_api_dossier_pdf_with_war_room_dict_dimensions(self):
        """Verify War Room export succeeds when candidate dimensions are passed as dictionary."""
        payload = {
            "smiles": ASPIRIN_SMILES,
            "properties": {"formula": "C9H8O4", "mw": 180.16},
            "war_room": {
                "is_available": True,
                "profile_name": "CNS_LEAD_V1",
                "profile_version": "1.2.0",
                "candidate_score": 84.5,
                "hard_constraints_passed": True,
                "dimensions": {
                    "potency": {"parent_raw": 0.72, "analog_raw": 0.88, "delta": 0.16, "weight": 0.35, "score": 0.88, "available": True},
                    "cardiac_safety": {"parent_raw": 0.85, "analog_raw": 0.92, "delta": 0.07, "weight": 0.25, "score": 0.92, "available": True},
                    "metabolic_stability": {"available": False, "unavailability_reason": "No local model"},
                },
            },
        }
        res = client.post("/api/reports/dossier/pdf", json=payload)
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"
        assert res.content.startswith(b"%PDF-")
