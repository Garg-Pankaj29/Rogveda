"""
ROGVEDA — Synthesizability Service Tests (Phase 16)

Tests SA_Score scoring, reactive group flagging, and the combined
assess_synthesizability() wrapper.

Reference SA_Score values obtained from RDKit's Contrib/SA_Score module
on the golden-molecule test set (Ertl & Schuffenhauer, J. Cheminform.
2009).  These simple, well-known drugs are expected to score in the
1–3 "easy" range.
"""

import pytest
from rdkit import Chem

from app.services.synthesizability_service import (
    score_synthesizability,
    flag_reactive_groups,
    assess_synthesizability,
    SA_EASY_THRESHOLD,
    SA_MODERATE_THRESHOLD,
)


# ── Golden molecules (all known drugs, easy to synthesize) ──────
ASPIRIN = "CC(=O)Oc1ccccc1C(O)=O"           # SA_Score ≈ 1.58
CAFFEINE = "Cn1c(=O)c2c(ncn2C)n(C)c1=O"     # SA_Score ≈ 2.30
PARACETAMOL = "CC(=O)Nc1ccc(O)cc1"           # SA_Score ≈ 1.41
IBUPROFEN = "CC(C)Cc1ccc(cc1)C(C)C(O)=O"    # SA_Score ≈ 2.19

# Difficult molecule: Taxol (paclitaxel) — famously hard to synthesize
# SA_Score ≈ 5.69  (well above the "difficult" threshold of 5.0)
TAXOL = (
    "CC1=C2[C@@]([C@]([C@H]([C@@H]3[C@]4([C@H](OC4)C[C@@H]"
    "([C@]3(C(=O)[C@@H]2OC(=O)C)C)O)OC(=O)C)OC(=O)c5ccccc5)"
    "(C[C@@H]1OC(=O)[C@@H](O)c6ccccc6)O)(C)C"
)

# Reactive group test molecules
ACYL_CHLORIDE = "CC(=O)Cl"          # Contains an acyl halide
ETHYLENE_OXIDE = "C1CO1"            # Contains an epoxide
BENZENE = "c1ccccc1"                # No reactive groups


class TestGoldenMolecules:
    """
    Confirm SA_Scores for well-known drugs fall within the expected range.

    Reference: Ertl & Schuffenhauer, J. Cheminform. 2009, 1:8.
    Known drugs typically score between 1 and 4. Our golden molecules
    are simple, well-known drugs and should score ≤ 3.0 (easy).
    The ±0.5 tolerance accounts for minor RDKit version differences.
    """

    @pytest.mark.parametrize("name,smiles,expected", [
        ("aspirin", ASPIRIN, 1.58),
        ("caffeine", CAFFEINE, 2.30),
        ("paracetamol", PARACETAMOL, 1.41),
        ("ibuprofen", IBUPROFEN, 2.19),
    ])
    def test_golden_molecule_sa_scores(self, name, smiles, expected):
        mol = Chem.MolFromSmiles(smiles)
        result = score_synthesizability(mol)
        assert abs(result["sa_score"] - expected) <= 0.5, (
            f"{name}: SA_Score {result['sa_score']} deviates >0.5 from "
            f"expected {expected}"
        )
        assert result["difficulty_label"] == "easy", (
            f"{name} should be classified as 'easy', got '{result['difficulty_label']}'"
        )


class TestDiscrimination:
    """
    Prove the SA_Score actually discriminates between easy and hard
    molecules, rather than returning a near-constant value.
    """

    def test_taxol_harder_than_aspirin(self):
        """Taxol (paclitaxel) should score meaningfully higher than aspirin."""
        aspirin_mol = Chem.MolFromSmiles(ASPIRIN)
        taxol_mol = Chem.MolFromSmiles(TAXOL)

        aspirin_result = score_synthesizability(aspirin_mol)
        taxol_result = score_synthesizability(taxol_mol)

        assert taxol_result["sa_score"] > aspirin_result["sa_score"] + 2.0, (
            f"Taxol ({taxol_result['sa_score']}) should score at least 2 "
            f"points higher than Aspirin ({aspirin_result['sa_score']})"
        )
        assert taxol_result["difficulty_label"] == "difficult", (
            f"Taxol should be 'difficult', got '{taxol_result['difficulty_label']}'"
        )


class TestReactiveGroupFlags:
    """
    Verify that the reactive group SMARTS table correctly identifies
    hazardous-to-handle functional groups.
    """

    def test_acyl_chloride_flagged(self):
        """Acyl chloride (CC(=O)Cl) must be caught by the Acyl Halide pattern."""
        mol = Chem.MolFromSmiles(ACYL_CHLORIDE)
        flags = flag_reactive_groups(mol)
        flag_names = [f["name"] for f in flags]
        assert "Acyl Halide" in flag_names, (
            f"Expected 'Acyl Halide' flag for {ACYL_CHLORIDE}, got {flag_names}"
        )

    def test_epoxide_flagged(self):
        """Ethylene oxide (C1CO1) must be caught by the Epoxide pattern."""
        mol = Chem.MolFromSmiles(ETHYLENE_OXIDE)
        flags = flag_reactive_groups(mol)
        flag_names = [f["name"] for f in flags]
        assert "Epoxide" in flag_names, (
            f"Expected 'Epoxide' flag for {ETHYLENE_OXIDE}, got {flag_names}"
        )

    def test_clean_molecule_no_flags(self):
        """Aspirin should have no reactive group flags."""
        mol = Chem.MolFromSmiles(ASPIRIN)
        flags = flag_reactive_groups(mol)
        assert flags == [], (
            f"Expected no reactive flags for aspirin, got {flags}"
        )

    def test_benzene_no_flags(self):
        """Benzene should have no reactive group flags."""
        mol = Chem.MolFromSmiles(BENZENE)
        flags = flag_reactive_groups(mol)
        assert flags == [], (
            f"Expected no reactive flags for benzene, got {flags}"
        )


class TestAssessSynthesizability:
    """
    Test the combined assess_synthesizability() convenience wrapper.
    """

    def test_returns_correct_dict_shape(self):
        result = assess_synthesizability(ASPIRIN)
        assert "sa_score" in result
        assert "difficulty_label" in result
        assert "reactive_group_flags" in result
        assert isinstance(result["sa_score"], float)
        assert result["difficulty_label"] in ("easy", "moderate", "difficult")
        assert isinstance(result["reactive_group_flags"], list)

    def test_invalid_smiles_raises(self):
        with pytest.raises(ValueError, match="Invalid SMILES"):
            assess_synthesizability("NOT_A_VALID_SMILES")

    def test_acyl_chloride_combined(self):
        """Acyl chloride should return both a score and reactive flags."""
        result = assess_synthesizability(ACYL_CHLORIDE)
        assert result["sa_score"] > 0
        flag_names = [f["name"] for f in result["reactive_group_flags"]]
        assert "Acyl Halide" in flag_names


class TestThresholds:
    """
    Verify the threshold bucketing logic.
    """

    def test_easy_threshold(self):
        """Aspirin (SA ≈ 1.58) should be 'easy'."""
        result = assess_synthesizability(ASPIRIN)
        assert result["difficulty_label"] == "easy"

    def test_difficult_threshold(self):
        """Taxol (SA ≈ 5.69) should be 'difficult'."""
        result = assess_synthesizability(TAXOL)
        assert result["difficulty_label"] == "difficult"
