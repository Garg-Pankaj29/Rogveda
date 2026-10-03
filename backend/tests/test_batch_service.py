"""
ROGVEDA — Batch Screening Service Tests (Phase 17)

Tests CSV parsing, single-molecule screening, batch orchestration,
and consistency with existing single-molecule pipeline outputs.
"""

import pytest
from pathlib import Path

from app.services.batch_service import (
    parse_csv,
    screen_single_molecule,
    screen_batch,
    MAX_ROWS,
)
from app.services import chemistry_service


# ── Test Data ─────────────────────────────────────────────────

TEST_CSV_PATH = Path(__file__).parent / "test_batch.csv"

# Golden molecule expected molecular weights (from RDKit, to 2 decimal places)
GOLDEN_MW = {
    "Aspirin": 180.16,
    "Caffeine": 194.19,
    "Paracetamol": 151.16,
    "Ibuprofen": 206.28,
}


# ── CSV Parsing Tests ─────────────────────────────────────────

class TestParseCsv:
    """Tests for parse_csv()."""

    def test_parse_valid_csv(self):
        """Golden test CSV should parse into 7 rows (including blank)."""
        file_bytes = TEST_CSV_PATH.read_bytes()
        rows = parse_csv(file_bytes)
        assert len(rows) == 7
        # First row should be Aspirin
        assert rows[0] == (1, "Aspirin", "CC(=O)Oc1ccccc1C(O)=O")
        # Row 5 should be the invalid SMILES
        assert rows[4] == (5, "InvalidMol", "INVALID_NOT_A_MOLECULE")
        # Row 7 is the blank row — smiles should be empty string
        assert rows[6][2] == ""

    def test_parse_csv_missing_smiles_column(self):
        """CSV without a 'smiles' column should raise ValueError."""
        csv_bytes = b"name,formula\nAspirin,C9H8O4\n"
        with pytest.raises(ValueError, match="smiles"):
            parse_csv(csv_bytes)

    def test_parse_csv_exceeds_row_cap(self):
        """CSV with more than MAX_ROWS rows should raise ValueError."""
        header = "smiles\n"
        rows = "C\n" * (MAX_ROWS + 1)
        csv_bytes = (header + rows).encode("utf-8")
        with pytest.raises(ValueError, match=str(MAX_ROWS)):
            parse_csv(csv_bytes)

    def test_parse_csv_empty_file(self):
        """Empty CSV should raise ValueError."""
        with pytest.raises(ValueError):
            parse_csv(b"")

    def test_parse_csv_header_only(self):
        """CSV with only a header row should raise ValueError."""
        csv_bytes = b"smiles,name\n"
        with pytest.raises(ValueError, match="no data rows"):
            parse_csv(csv_bytes)

    def test_parse_csv_case_insensitive_header(self):
        """Column headers should be matched case-insensitively."""
        csv_bytes = b"SMILES,Name\nCCO,Ethanol\n"
        rows = parse_csv(csv_bytes)
        assert len(rows) == 1
        assert rows[0] == (1, "Ethanol", "CCO")


# ── Single-Molecule Screening Tests ──────────────────────────

class TestScreenSingleMolecule:
    """Tests for screen_single_molecule()."""

    def test_aspirin_properties(self):
        """Aspirin MW should match the known golden value."""
        result = screen_single_molecule("CC(=O)Oc1ccccc1C(O)=O")
        assert result["molecular_weight"] == pytest.approx(GOLDEN_MW["Aspirin"], abs=0.1)
        assert result["logp"] is not None
        assert result["tpsa"] is not None
        assert result["sa_score"] is not None

    def test_caffeine_properties(self):
        """Caffeine MW should match the known golden value."""
        result = screen_single_molecule("Cn1c(=O)c2c(ncn2C)n(C)c1=O")
        assert result["molecular_weight"] == pytest.approx(GOLDEN_MW["Caffeine"], abs=0.1)

    def test_invalid_smiles_raises(self):
        """Invalid SMILES should raise ValueError."""
        with pytest.raises(ValueError, match="invalid SMILES"):
            screen_single_molecule("INVALID_NOT_A_MOLECULE")

    def test_result_has_prediction_fields(self):
        """Result dict should contain all 6 prediction fields."""
        result = screen_single_molecule("CCO")  # ethanol — simple
        for ep_id in ["herg", "antiinflammatory", "antioxidant", "antimicrobial", "anticancer", "tox21_mmp"]:
            assert f"pred_{ep_id}_status" in result
            assert f"pred_{ep_id}_confidence" in result

    def test_result_has_synth_fields(self):
        """Result dict should contain synthesizability fields."""
        result = screen_single_molecule("CCO")
        assert "sa_score" in result
        assert "sa_difficulty" in result


# ── Batch Orchestration Tests ─────────────────────────────────

class TestScreenBatch:
    """Tests for screen_batch()."""

    def test_golden_csv_batch(self):
        """The golden test CSV should produce 5 successes and 2 errors."""
        file_bytes = TEST_CSV_PATH.read_bytes()
        rows = parse_csv(file_bytes)
        result = screen_batch(rows)

        assert result["summary"]["total"] == 7
        assert result["summary"]["succeeded"] == 5  # 4 golden + 1 duplicate
        assert result["summary"]["failed"] == 2     # 1 invalid + 1 blank

    def test_invalid_smiles_in_errors(self):
        """InvalidMol row should appear in errors with a clear reason."""
        file_bytes = TEST_CSV_PATH.read_bytes()
        rows = parse_csv(file_bytes)
        result = screen_batch(rows)

        invalid_errors = [e for e in result["errors"] if e["smiles"] == "INVALID_NOT_A_MOLECULE"]
        assert len(invalid_errors) == 1
        assert "invalid SMILES" in invalid_errors[0]["reason"].lower() or "could not parse" in invalid_errors[0]["reason"].lower()

    def test_blank_row_in_errors(self):
        """Blank SMILES row should appear in errors, not crash."""
        file_bytes = TEST_CSV_PATH.read_bytes()
        rows = parse_csv(file_bytes)
        result = screen_batch(rows)

        blank_errors = [e for e in result["errors"] if "blank" in e["reason"].lower() or "empty" in e["reason"].lower()]
        assert len(blank_errors) >= 1

    def test_duplicate_processed_separately(self):
        """Duplicate aspirin should be processed as its own row, not deduplicated."""
        file_bytes = TEST_CSV_PATH.read_bytes()
        rows = parse_csv(file_bytes)
        result = screen_batch(rows)

        # Both aspirin rows should be in results
        aspirin_results = [
            r for r in result["results"]
            if r.get("canonical_smiles") and "CC(=O)Oc1ccccc1C" in r["canonical_smiles"]
        ]
        assert len(aspirin_results) == 2, (
            f"Expected 2 aspirin results (original + duplicate), got {len(aspirin_results)}"
        )

    def test_golden_molecule_mw_consistency(self):
        """Cross-check batch MW values against direct chemistry_service calls."""
        file_bytes = TEST_CSV_PATH.read_bytes()
        rows = parse_csv(file_bytes)
        result = screen_batch(rows)

        for r in result["results"]:
            name = r.get("name")
            if name in GOLDEN_MW:
                # Cross-check against chemistry_service
                direct_props = chemistry_service.calculate_properties(r["canonical_smiles"])
                assert r["molecular_weight"] == direct_props["molecular_weight"], (
                    f"MW mismatch for {name}: batch={r['molecular_weight']} vs direct={direct_props['molecular_weight']}"
                )

    def test_elapsed_time_reported(self):
        """Summary should include elapsed_seconds."""
        rows = [(1, "Ethanol", "CCO")]
        result = screen_batch(rows)
        assert "elapsed_seconds" in result["summary"]
        assert isinstance(result["summary"]["elapsed_seconds"], float)

    def test_progress_callback(self):
        """Progress callback should be called for each row."""
        rows = [(1, "Ethanol", "CCO"), (2, None, "")]
        progress_calls = []
        result = screen_batch(rows, progress_callback=lambda c, t: progress_calls.append((c, t)))
        assert len(progress_calls) == 2
        assert progress_calls[0] == (1, 2)
        assert progress_calls[1] == (2, 2)
