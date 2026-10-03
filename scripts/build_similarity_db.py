"""
ROGVEDA — Build Similarity Reference Database

Reads a CSV of reference molecules (columns: name, smiles), canonicalizes
each SMILES with RDKit, computes Morgan fingerprints (radius=2, 2048 bits),
and stores them in an SQLite database for fast Tanimoto similarity lookups.

Usage:
    python scripts/build_similarity_db.py [path/to/molecules.csv]

Defaults to data/reference/reference_molecules.csv if no argument given.
"""

import csv
import sqlite3
import sys
from pathlib import Path

import numpy as np
from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem

RDLogger.logger().setLevel(RDLogger.ERROR)

# ── Paths ───────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CSV = PROJECT_ROOT / "data" / "reference" / "reference_molecules.csv"
DB_PATH = PROJECT_ROOT / "data" / "processed" / "similarity.db"


def smiles_to_fp_bytes(smiles: str) -> bytes | None:
    """Parse SMILES → canonical → Morgan FP → raw bytes."""
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    fp = AllChem.GetMorganFingerprintAsBitVect(mol, radius=2, nBits=2048)
    arr = np.zeros(2048, dtype=np.uint8)
    for bit in fp.GetOnBits():
        arr[bit] = 1
    return arr.tobytes()


def build_db(csv_path: Path) -> None:
    """Build the similarity SQLite database from a CSV file."""
    if not csv_path.exists():
        print(f"Error: CSV file not found: {csv_path}")
        sys.exit(1)

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Create/overwrite database
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()

    cur.execute("DROP TABLE IF EXISTS molecules")
    cur.execute("""
        CREATE TABLE molecules (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            canonical_smiles TEXT NOT NULL,
            fingerprint BLOB NOT NULL
        )
    """)
    cur.execute("CREATE INDEX idx_mol_name ON molecules(name)")

    # Read CSV and insert
    inserted = 0
    skipped = 0

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get("name", "").strip()
            smiles = row.get("smiles", "").strip()
            if not name or not smiles:
                skipped += 1
                continue

            mol = Chem.MolFromSmiles(smiles)
            if mol is None:
                print(f"  SKIP (unparseable): {name} → {smiles}")
                skipped += 1
                continue

            canonical = Chem.MolToSmiles(mol, canonical=True)
            fp_bytes = smiles_to_fp_bytes(canonical)
            if fp_bytes is None:
                skipped += 1
                continue

            cur.execute(
                "INSERT INTO molecules (name, canonical_smiles, fingerprint) VALUES (?, ?, ?)",
                (name, canonical, fp_bytes),
            )
            inserted += 1

    conn.commit()
    conn.close()

    print(f"Database built: {DB_PATH}")
    print(f"  Inserted: {inserted} molecules")
    print(f"  Skipped:  {skipped}")
    print(f"  Size:     {DB_PATH.stat().st_size / 1024:.1f} KB")


def main() -> None:
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CSV
    print(f"Reading reference molecules from: {csv_path}")
    build_db(csv_path)
    print("Done.")


if __name__ == "__main__":
    main()
