"""
ROGVEDA — Build ML Dataset from Tox21 (SR-MMP endpoint)

Downloads Tox21 data, canonicalizes SMILES, extracts the SR-MMP column,
computes Morgan fingerprints, and does a scaffold split.

Outputs: data/processed/train_tox21_mmp.pkl, data/processed/test_tox21_mmp.pkl
"""

import argparse
import os
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem
from rdkit.Chem.Scaffolds import MurckoScaffold

RDLogger.logger().setLevel(RDLogger.ERROR)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
OUTPUT_DIR = DATA_DIR / "processed"

TOX21_URL = "https://deepchemdata.s3-us-west-1.amazonaws.com/datasets/tox21.csv.gz"
TOX21_PATH = RAW_DIR / "tox21.csv.gz"


def download_tox21() -> pd.DataFrame:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    if not TOX21_PATH.exists():
        print(f"Downloading Tox21 dataset to {TOX21_PATH}...")
        urllib.request.urlretrieve(TOX21_URL, TOX21_PATH)
        print("Download complete.")
    
    df = pd.read_csv(TOX21_PATH)
    print(f"Loaded Tox21 dataset: {len(df)} rows")
    return df


def load_and_clean(df: pd.DataFrame, endpoint: str) -> pd.DataFrame:
    # Keep only rows where our endpoint is not null
    df = df.dropna(subset=[endpoint, "smiles"]).copy()
    print(f"  After dropping NaNs for {endpoint}: {len(df)} rows")

    canonical = []
    valid_mask = []
    for smi in df["smiles"]:
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

    # Dedup by taking max activity (if conflicting, assume active)
    df = df.groupby("canonical_smiles", as_index=False).agg({endpoint: "max"})
    print(f"  After dedup: {len(df)} rows")

    # Standardize column name
    df = df.rename(columns={endpoint: "active"})
    df["active"] = df["active"].astype(int)
    
    n_active = df["active"].sum()
    n_inactive = len(df) - n_active
    print(f"  Labels — active: {n_active}, inactive: {n_inactive}")
    
    return df


def add_fps(df: pd.DataFrame) -> pd.DataFrame:
    fps = []
    for smi in df["canonical_smiles"]:
        mol = Chem.MolFromSmiles(smi)
        fp = AllChem.GetMorganFingerprintAsBitVect(mol, radius=2, nBits=2048)
        fps.append(np.array(fp, dtype=np.int8))

    df["morgan_fp"] = fps
    print(f"  Computed {len(fps)} Morgan fingerprints (radius=2, 2048 bits)")
    return df


def scaffold_split(df: pd.DataFrame, train_frac: float = 0.80, seed: int = 42) -> tuple[pd.DataFrame, pd.DataFrame]:
    scaffold_to_indices = defaultdict(list)
    for idx, smi in enumerate(df["canonical_smiles"]):
        try:
            mol = Chem.MolFromSmiles(smi)
            scaffold = MurckoScaffold.MurckoScaffoldSmiles(mol=mol, includeChirality=False)
            generic = MurckoScaffold.MakeScaffoldGeneric(Chem.MolFromSmiles(scaffold))
            generic_smi = Chem.MolToSmiles(generic)
            scaffold_to_indices[generic_smi].append(idx)
        except Exception:
            scaffold_to_indices[smi].append(idx)

    scaffolds_sorted = sorted(scaffold_to_indices.values(), key=len, reverse=True)
    n_total = len(df)
    n_train = int(n_total * train_frac)

    train_indices = []
    test_indices = []

    for group in scaffolds_sorted:
        if len(train_indices) + len(group) <= n_train:
            train_indices.extend(group)
        else:
            test_indices.extend(group)

    rng = np.random.default_rng(seed)
    rng.shuffle(train_indices)
    rng.shuffle(test_indices)

    train_df = df.iloc[train_indices].reset_index(drop=True)
    test_df = df.iloc[test_indices].reset_index(drop=True)

    print(f"  Scaffold split — train: {len(train_df)} ({len(train_df)/n_total:.1%}), "
          f"test: {len(test_df)} ({len(test_df)/n_total:.1%})")
    return train_df, test_df


def main():
    parser = argparse.ArgumentParser(description="Build ML Dataset from Tox21")
    parser.add_argument("--endpoint", type=str, default="SR-MMP", help="Tox21 endpoint to extract")
    parser.add_argument("--out-suffix", type=str, default="tox21_mmp", help="Suffix for output files")
    args = parser.parse_args()

    print("=" * 60)
    print("Step 1 — Download & clean")
    print("=" * 60)
    df_raw = download_tox21()
    if args.endpoint not in df_raw.columns:
        print(f"Error: {args.endpoint} not found in Tox21 columns: {list(df_raw.columns)}")
        sys.exit(1)
        
    df = load_and_clean(df_raw, args.endpoint)

    print("\n" + "=" * 60)
    print("Step 2 — Add Morgan fingerprints")
    print("=" * 60)
    df = add_fps(df)

    print("\n" + "=" * 60)
    print("Step 3 — Scaffold split (80 / 20)")
    print("=" * 60)
    train_df, test_df = scaffold_split(df, train_frac=0.80)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    train_path = OUTPUT_DIR / f"train_{args.out_suffix}.pkl"
    test_path = OUTPUT_DIR / f"test_{args.out_suffix}.pkl"

    train_df.to_pickle(train_path)
    test_df.to_pickle(test_path)

    print(f"\nSaved {train_path} ({len(train_df)} rows)")
    print(f"Saved {test_path}  ({len(test_df)} rows)")
    print("Done.")


if __name__ == "__main__":
    main()
