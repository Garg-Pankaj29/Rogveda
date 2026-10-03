"""
ROGVEDA — Sanity Check: Verify Tox21 SR-MMP Model Against Known Molecules

Tests the trained calibrated model against reference compounds with
well-documented mitochondrial toxicity from published literature.
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
MODEL_PATH = PROJECT_ROOT / "models" / "tox21_mmp_model.pkl"
METADATA_PATH = PROJECT_ROOT / "models" / "tox21_mmp_model_metadata.json"

# ── Reference molecules with known mitotoxicity ──────────────────
# Sources: PubChem, literature on mitochondrial membrane potential disruptors
REFERENCE_MOLECULES = [
    {
        "name": "Rotenone",
        "smiles": "C=C(C)[C@H]1Cc2c(ccc3c2O[C@@H]2COc4cc(OC)c(OC)cc4[C@@H]2C3=O)O1",
        "expected_active": True,
        "note": "Complex I inhibitor, potent mitotoxin",
    },
    {
        "name": "Antimycin A",
        "smiles": "CC1OC(=O)C(NC(=O)c2c(O)c(NC=O)ccc2O)C(C)=CC(C(C)C)C(OC(=O)C(C)CC)C1CC",
        "expected_active": True,
        "note": "Complex III inhibitor, potent mitotoxin",
    },
    {
        "name": "Carbonyl cyanide m-chlorophenylhydrazone (CCCP)",
        "smiles": "N#CC(C#N)=NNc1cccc(Cl)c1",
        "expected_active": True,
        "note": "Potent mitochondrial uncoupler",
    },
    {
        "name": "Aspirin",
        "smiles": "CC(=O)Oc1ccccc1C(O)=O",
        "expected_active": False,
        "note": "NSAID, generally not a potent mitochondrial toxin at standard doses",
    },
    {
        "name": "Metformin",
        "smiles": "CN(C)C(=N)NC(N)=N",
        "expected_active": False,
        "note": "Antidiabetic, mild complex I inhibitor but doesn't depolarize MMP strongly at physiological doses",
    },
    {
        "name": "Caffeine",
        "smiles": "Cn1c(=O)c2c(ncn2C)n(C)c1=O",
        "expected_active": False,
        "note": "Stimulant, not mitotoxic",
    }
]


def smiles_to_fp(smiles: str) -> np.ndarray | None:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    fp = AllChem.GetMorganFingerprintAsBitVect(mol, radius=2, nBits=2048)
    return np.array(fp, dtype=np.int8)


def main() -> None:
    if not MODEL_PATH.exists():
        print(f"Error: Model not found at {MODEL_PATH}. Run train_model.py first.")
        sys.exit(1)

    model = joblib.load(MODEL_PATH)
    threshold = 0.5  # default
    if METADATA_PATH.exists():
        with open(METADATA_PATH) as f:
            meta = json.load(f)
        threshold = meta.get("chosen_threshold", 0.5)
    print(f"Loaded model from {MODEL_PATH.name}")
    print(f"Using decision threshold: {threshold}")

    print("\n" + "=" * 80)
    print(f"{'Molecule':<16} {'Expected':>10} {'Prob(active)':>14} {'Predicted':>11} {'Match':>7}")
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

        print(f"  {ref['name']:<16} {exp_label:>10} {prob_active:>13.4f} {pred_label:>11} {match:>6}")

    print("=" * 80 + "\n")

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
        print(f"    P(active) = {prob:.4f}, threshold = {threshold}, predicted = {'active' if predicted else 'inactive'} → {status}\n")

    if all_correct:
        print("All reference predictions match expected results.")
    else:
        print("WARNING: Some predictions did not match expected results.")
        print("This may indicate the model needs further tuning or the threshold should be adjusted.")


if __name__ == "__main__":
    main()
