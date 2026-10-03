"""
ROGVEDA — Sanity Check: Verify hERG Model Against Known Molecules

Tests the trained calibrated model against reference compounds with
well-documented hERG activity from published literature.

Per docs/04_RULES.md §7: produce a verifiable artifact for anything
chemistry- or ML-related that can be eyeball-checked against known values.
"""

import json
import sys
from pathlib import Path

import joblib
import numpy as np
from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem

RDLogger.logger().setLevel(RDLogger.ERROR)

# ── Paths ───────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = PROJECT_ROOT / "models" / "herg_model.pkl"
METADATA_PATH = PROJECT_ROOT / "models" / "herg_model_metadata.json"

# ── Reference molecules with known hERG status ──────────────────
# Sources: ChEMBL, PubChem, published IC50 literature
REFERENCE_MOLECULES = [
    {
        "name": "Haloperidol",
        "smiles": "O=C(CCCN1CCC(O)(c2ccc(Cl)cc2)CC1)c1ccc(F)cc1",
        "expected_active": True,
        "note": "Antipsychotic, known potent hERG blocker (IC50 ~27 nM)",
    },
    {
        "name": "Terfenadine",
        "smiles": "OC(c1ccccc1)(c1ccccc1)CCCCN1CCC(O)(c2ccc(C(C)(C)C)cc2)CC1",
        "expected_active": True,
        "note": "Antihistamine withdrawn for hERG liability (IC50 ~200 nM)",
    },
    {
        "name": "Amiodarone",
        "smiles": "CCCCc1oc2ccccc2c1C(=O)c1cc(I)c(OCCN(CC)CC)c(I)c1",
        "expected_active": True,
        "note": "Antiarrhythmic, potent hERG blocker (IC50 ~70 nM)",
    },
    {
        "name": "Aspirin",
        "smiles": "CC(=O)Oc1ccccc1C(O)=O",
        "expected_active": False,
        "note": "NSAID, no significant hERG activity (IC50 >> 100 µM)",
    },
    {
        "name": "Metformin",
        "smiles": "CN(C)C(=N)NC(N)=N",
        "expected_active": False,
        "note": "Antidiabetic, no hERG activity (IC50 >> 100 µM)",
    },
]


def smiles_to_fp(smiles: str) -> np.ndarray | None:
    """Parse SMILES → canonical → Morgan FP (radius=2, 2048 bits)."""
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    fp = AllChem.GetMorganFingerprintAsBitVect(mol, radius=2, nBits=2048)
    return np.array(fp, dtype=np.int8)


def main() -> None:
    if not MODEL_PATH.exists():
        print(f"Error: Model not found at {MODEL_PATH}. Run train_model.py first.")
        sys.exit(1)

    # Load model and threshold
    model = joblib.load(MODEL_PATH)
    threshold = 0.5  # default
    if METADATA_PATH.exists():
        with open(METADATA_PATH) as f:
            meta = json.load(f)
        threshold = meta.get("chosen_threshold", 0.5)
    print(f"Loaded model from {MODEL_PATH.name}")
    print(f"Using decision threshold: {threshold}")

    print()
    print("=" * 80)
    print(f"{'Molecule':<16} {'Expected':>10} {'Prob(active)':>14} "
          f"{'Predicted':>11} {'Match':>7}")
    print("=" * 80)

    all_correct = True
    for ref in REFERENCE_MOLECULES:
        fp = smiles_to_fp(ref["smiles"])
        if fp is None:
            print(f"  {ref['name']:<16}  *** UNPARSEABLE SMILES ***")
            continue

        prob_active = model.predict_proba(fp.reshape(1, -1))[0, 1]
        predicted_active = prob_active >= threshold
        expected = ref["expected_active"]
        match = "✓" if predicted_active == expected else "✗"
        if predicted_active != expected:
            all_correct = False

        exp_label = "ACTIVE" if expected else "INACTIVE"
        pred_label = "ACTIVE" if predicted_active else "INACTIVE"

        print(f"  {ref['name']:<16} {exp_label:>10} {prob_active:>13.4f} "
              f"{pred_label:>11} {match:>6}")

    print("=" * 80)
    print()

    # Detailed breakdown
    for ref in REFERENCE_MOLECULES:
        fp = smiles_to_fp(ref["smiles"])
        if fp is None:
            continue
        prob = model.predict_proba(fp.reshape(1, -1))[0, 1]
        predicted = prob >= threshold
        expected = ref["expected_active"]
        status = "CORRECT" if predicted == expected else "MISMATCH"
        print(f"  {ref['name']}: {ref['note']}")
        print(f"    SMILES: {ref['smiles']}")
        print(f"    P(active) = {prob:.4f}, threshold = {threshold}, "
              f"predicted = {'active' if predicted else 'inactive'} → {status}")
        print()

    if all_correct:
        print("All reference predictions match expected results.")
    else:
        print("WARNING: Some predictions did not match expected results.")
        print("This may indicate the model needs further tuning or the")
        print("threshold should be adjusted.")


if __name__ == "__main__":
    main()
