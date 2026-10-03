"""
ROGVEDA — Build Chemical Space Map (UMAP 2D Projection)

Reads all reference compounds from data/processed/similarity.db,
fits a UMAP reducer on their 2048-bit Morgan fingerprints, and saves:
  1. data/chemical_space_map.pkl  — reference FPs + 2D coords (compact)
  2. chemical_space_coords table  — (molecule_id, map_x, map_y) in similarity.db

This is a one-time, offline script.  It is NOT called at runtime.
Runtime projection uses weighted KNN interpolation from saved coordinates.

Usage:
    python ml/build_chemical_space_map.py
"""

import sqlite3
import sys
from pathlib import Path

import joblib
import numpy as np
import umap
from rdkit import RDLogger

RDLogger.logger().setLevel(RDLogger.ERROR)

# ── Paths ───────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
SIMILARITY_DB = PROJECT_ROOT / "data" / "processed" / "similarity.db"
OUTPUT_PKL = PROJECT_ROOT / "data" / "chemical_space_map.pkl"


def load_fingerprints() -> tuple[list[int], list[str], np.ndarray]:
    """Load molecule IDs, names, and fingerprint arrays from similarity.db."""
    if not SIMILARITY_DB.exists():
        print(f"Error: similarity.db not found at {SIMILARITY_DB}")
        print("Run scripts/build_similarity_db.py first.")
        sys.exit(1)

    conn = sqlite3.connect(str(SIMILARITY_DB))
    cur = conn.cursor()
    cur.execute("SELECT id, name, fingerprint FROM molecules ORDER BY id")
    rows = cur.fetchall()
    conn.close()

    if not rows:
        print("Error: molecules table is empty.")
        sys.exit(1)

    ids = []
    names = []
    fps = []
    for mol_id, name, fp_blob in rows:
        arr = np.frombuffer(fp_blob, dtype=np.uint8).copy()
        ids.append(mol_id)
        names.append(name)
        fps.append(arr)

    fp_matrix = np.vstack(fps)
    print(f"Loaded {len(ids)} molecules, fingerprint shape: {fp_matrix.shape}")
    return ids, names, fp_matrix


def fit_umap(fp_matrix: np.ndarray) -> np.ndarray:
    """Fit UMAP on the fingerprint matrix and return 2D coordinates."""
    print("Fitting UMAP (this may take 1-3 minutes for ~10k molecules)...")
    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=15,
        min_dist=0.1,
        metric="jaccard",
        random_state=42,
        n_jobs=1,  # deterministic
    )
    coords = reducer.fit_transform(fp_matrix)
    print(f"UMAP fit complete. Embedding shape: {coords.shape}")
    print(f"  x range: [{coords[:, 0].min():.2f}, {coords[:, 0].max():.2f}]")
    print(f"  y range: [{coords[:, 1].min():.2f}, {coords[:, 1].max():.2f}]")
    return coords


def save_compact_map(fp_matrix: np.ndarray, coords: np.ndarray) -> None:
    """
    Save a compact map file containing:
      - ref_fps: (N, 2048) uint8 fingerprint matrix
      - ref_coords: (N, 2) float32 UMAP coordinates
    
    This is ~20MB instead of 264MB (no UMAP model object needed).
    Runtime uses weighted KNN interpolation from these saved arrays.
    """
    OUTPUT_PKL.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "ref_fps": fp_matrix,  # uint8, already compact
        "ref_coords": coords.astype(np.float32),
    }
    joblib.dump(data, str(OUTPUT_PKL), compress=3)
    size_mb = OUTPUT_PKL.stat().st_size / (1024 * 1024)
    print(f"Saved compact map: {OUTPUT_PKL} ({size_mb:.1f} MB)")


def save_coords_to_db(ids: list[int], coords: np.ndarray) -> None:
    """Write (molecule_id, map_x, map_y) into a new table in similarity.db."""
    conn = sqlite3.connect(str(SIMILARITY_DB))
    cur = conn.cursor()

    # Create new table (drop if re-running)
    cur.execute("DROP TABLE IF EXISTS chemical_space_coords")
    cur.execute("""
        CREATE TABLE chemical_space_coords (
            molecule_id  INTEGER PRIMARY KEY,
            map_x        REAL NOT NULL,
            map_y        REAL NOT NULL,
            FOREIGN KEY (molecule_id) REFERENCES molecules(id)
        )
    """)

    # Bulk insert
    data = [(int(mol_id), float(coords[i, 0]), float(coords[i, 1]))
            for i, mol_id in enumerate(ids)]
    cur.executemany(
        "INSERT INTO chemical_space_coords (molecule_id, map_x, map_y) VALUES (?, ?, ?)",
        data,
    )

    conn.commit()
    conn.close()
    print(f"Saved {len(data)} coordinate rows to chemical_space_coords table.")


def main() -> None:
    print("=" * 60)
    print("ROGVEDA — Chemical Space Map Builder")
    print("=" * 60)

    ids, names, fp_matrix = load_fingerprints()
    coords = fit_umap(fp_matrix)
    save_compact_map(fp_matrix, coords)
    save_coords_to_db(ids, coords)

    # Quick sanity check
    print("\nSanity check — first 5 compounds:")
    for i in range(min(5, len(ids))):
        print(f"  {names[i]:30s}  →  ({coords[i, 0]:8.4f}, {coords[i, 1]:8.4f})")

    print("\nDone. Chemical space map is ready.")
    print(f"  Map file:   {OUTPUT_PKL}")
    print(f"  Coords DB:  {SIMILARITY_DB} (table: chemical_space_coords)")


if __name__ == "__main__":
    main()
