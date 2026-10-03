"""
ROGVEDA — Task 2: Build ML Dataset from Raw hERG IC50 Data

Reads chembl_herg_raw.csv, canonicalizes SMILES via RDKit, drops
unparseable/duplicate molecules, adds a binary "active" label
(IC50 <= 1000 nM), computes Morgan fingerprints (radius=2, 2048 bits),
and performs a Murcko-scaffold split (80/20 train/test).

Outputs: data/processed/train.pkl, data/processed/test.pkl
"""

import argparse
import pickle
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem
from rdkit.Chem.Scaffolds import MurckoScaffold

# Suppress noisy RDKit warnings (e.g. kekulization failures)
RDLogger.logger().setLevel(RDLogger.ERROR)

# ── Paths ───────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "data" / "processed"


# ── Step 1: Load & clean SMILES ─────────────────────────────────
def load_and_clean(csv_path: Path) -> pd.DataFrame:
    """Load CSV, canonicalize SMILES, drop bad/duplicate molecules."""
    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} rows from {csv_path.name}")

    # Drop rows with missing SMILES or standard_value
    df = df.dropna(subset=["canonical_smiles", "standard_value"]).copy()
    print(f"  After dropping NaNs: {len(df)} rows")

    # Parse and canonicalize each SMILES
    canonical = []
    valid_mask = []
    for smi in df["canonical_smiles"]:
        mol = Chem.MolFromSmiles(smi)
        if mol is not None:
            canonical.append(Chem.MolToSmiles(mol, canonical=True))
            valid_mask.append(True)
        else:
            canonical.append(None)
            valid_mask.append(False)

    df["canonical_smiles"] = canonical
    n_bad = sum(1 for v in valid_mask if not v)
    df = df[valid_mask].copy()
    print(f"  Dropped {n_bad} unparseable SMILES → {len(df)} rows")

    # For duplicate SMILES keep the row with the median IC50
    df = (
        df.groupby("canonical_smiles", as_index=False)
        .agg({"standard_value": "median"})
    )
    print(f"  After dedup (median IC50 per molecule): {len(df)} rows")

    return df


# ── Step 2: Label & fingerprint ─────────────────────────────────
def add_labels_and_fps(df: pd.DataFrame, threshold: float = 1000) -> pd.DataFrame:
    """Add binary activity label and Morgan fingerprint column."""
    df = df.copy()

    # Binary label: active (1) if standard_value <= threshold
    df["active"] = (df["standard_value"] <= threshold).astype(int)
    n_active = df["active"].sum()
    n_inactive = len(df) - n_active
    print(f"  Labels — active: {n_active}, inactive: {n_inactive}")

    # Morgan fingerprint (radius 2, 2048 bits) → numpy array per row
    fps = []
    for smi in df["canonical_smiles"]:
        mol = Chem.MolFromSmiles(smi)
        fp = AllChem.GetMorganFingerprintAsBitVect(mol, radius=2, nBits=2048)
        fps.append(np.array(fp, dtype=np.int8))

    df["morgan_fp"] = fps
    print(f"  Computed {len(fps)} Morgan fingerprints (radius=2, 2048 bits)")

    return df


# ── Step 3: Scaffold split ──────────────────────────────────────
def scaffold_split(
    df: pd.DataFrame,
    train_frac: float = 0.80,
    seed: int = 42,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Murcko scaffold split — molecules sharing the same generic
    scaffold are kept in the same fold so the test set evaluates
    generalisation to *new* scaffolds, not just new decorations.
    """
    # Map each SMILES to its generic Murcko scaffold
    scaffold_to_indices: dict[str, list[int]] = defaultdict(list)
    for idx, smi in enumerate(df["canonical_smiles"]):
        try:
            mol = Chem.MolFromSmiles(smi)
            scaffold = MurckoScaffold.MurckoScaffoldSmiles(
                mol=mol, includeChirality=False
            )
            # Further reduce to generic (no side-chains) framework
            generic = MurckoScaffold.MakeScaffoldGeneric(
                Chem.MolFromSmiles(scaffold)
            )
            generic_smi = Chem.MolToSmiles(generic)
            scaffold_to_indices[generic_smi].append(idx)
        except Exception:
            # Fall back to using the SMILES itself as the "scaffold" for this molecule
            # This handles RDKit AtomValenceExceptions for weird molecules
            scaffold_to_indices[smi].append(idx)

    # Sort scaffolds largest-group-first for deterministic packing
    scaffolds_sorted = sorted(
        scaffold_to_indices.values(), key=len, reverse=True
    )

    n_total = len(df)
    n_train = int(n_total * train_frac)

    train_indices: list[int] = []
    test_indices: list[int] = []

    for group in scaffolds_sorted:
        if len(train_indices) + len(group) <= n_train:
            train_indices.extend(group)
        else:
            test_indices.extend(group)

    # Shuffle within each split for training stability
    rng = np.random.default_rng(seed)
    rng.shuffle(train_indices)
    rng.shuffle(test_indices)

    train_df = df.iloc[train_indices].reset_index(drop=True)
    test_df = df.iloc[test_indices].reset_index(drop=True)

    print(
        f"  Scaffold split — train: {len(train_df)} "
        f"({len(train_df)/n_total:.1%}), "
        f"test: {len(test_df)} ({len(test_df)/n_total:.1%})"
    )
    return train_df, test_df


# ── Main ────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(description="Build ML Dataset from Raw Data")
    parser.add_argument("--endpoint", type=str, required=True, help="Name of the endpoint (e.g., herg, antiinflammatory)")
    parser.add_argument("--threshold", type=float, default=10000, help="Activity threshold (nM). Default: 10000 (10 uM)")
    args = parser.parse_args()

    # For herg keep backward compatibility
    if args.endpoint == "herg":
        input_csv = OUTPUT_DIR / "chembl_herg_raw.csv"
    else:
        input_csv = OUTPUT_DIR / f"{args.endpoint}_raw.csv"

    if not input_csv.exists():
        print(f"Error: {input_csv} not found. Run extract.py first.")
        sys.exit(1)

    print("=" * 60)
    print("Step 1 — Load & canonicalize SMILES")
    print("=" * 60)
    df = load_and_clean(input_csv)

    print()
    print("=" * 60)
    print("Step 2 — Add activity labels & Morgan fingerprints")
    print("=" * 60)
    df = add_labels_and_fps(df, threshold=args.threshold)

    print()
    print("=" * 60)
    print("Step 3 — Scaffold split (80 / 20)")
    print("=" * 60)
    train_df, test_df = scaffold_split(df, train_frac=0.80)

    # Save
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    train_path = OUTPUT_DIR / f"train_{args.endpoint}.pkl"
    test_path = OUTPUT_DIR / f"test_{args.endpoint}.pkl"

    train_df.to_pickle(train_path)
    test_df.to_pickle(test_path)

    print()
    print(f"Saved {train_path} ({len(train_df)} rows)")
    print(f"Saved {test_path}  ({len(test_df)} rows)")
    print("Done.")


if __name__ == "__main__":
    main()
