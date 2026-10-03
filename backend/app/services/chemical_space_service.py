"""
ROGVEDA — Chemical Space Service

Projects a query molecule into a pre-computed 2D UMAP chemical space map.

The map data (reference fingerprints + their 2D coordinates) is loaded once
from data/chemical_space_map.pkl (~20 MB).  New molecules are projected via
**weighted KNN interpolation**: compute Tanimoto similarity to all reference
compounds, take the K nearest, and weight-average their known (x, y) positions.

This is fast (~50ms), requires no UMAP import at runtime, and produces
positions consistent with the original UMAP embedding.
"""

import sqlite3
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem

from app.core.config import PROJECT_ROOT

RDLogger.logger().setLevel(RDLogger.ERROR)

# ── Paths ───────────────────────────────────────────────────────
MAP_PKL = PROJECT_ROOT / "data" / "chemical_space_map.pkl"
SIMILARITY_DB = PROJECT_ROOT / "data" / "processed" / "similarity.db"

# ── Module-level cache ──────────────────────────────────────────
_map_data: Optional[dict] = None
_reference_coords: Optional[list[dict]] = None

# Number of nearest neighbors for interpolation
_K = 10


def _load_map_data() -> dict:
    """Load the compact map file (ref_fps + ref_coords). Cached after first call."""
    global _map_data
    if _map_data is not None:
        return _map_data
    if not MAP_PKL.exists():
        raise FileNotFoundError(
            f"Chemical space map not found at {MAP_PKL}. "
            "Run ml/build_chemical_space_map.py first."
        )
    _map_data = joblib.load(str(MAP_PKL))
    return _map_data


def _load_reference_coords() -> list[dict]:
    """Load all reference compound coordinates from the DB (cached)."""
    global _reference_coords
    if _reference_coords is not None:
        return _reference_coords
    if not SIMILARITY_DB.exists():
        raise FileNotFoundError(
            f"Similarity database not found at {SIMILARITY_DB}. "
            "Run scripts/build_similarity_db.py first."
        )

    conn = sqlite3.connect(str(SIMILARITY_DB))
    cur = conn.cursor()

    # Check if the coords table exists
    cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='chemical_space_coords'"
    )
    if not cur.fetchone():
        conn.close()
        raise FileNotFoundError(
            "chemical_space_coords table not found in similarity.db. "
            "Run ml/build_chemical_space_map.py first."
        )

    cur.execute("""
        SELECT m.name, m.canonical_smiles, c.map_x, c.map_y
        FROM chemical_space_coords c
        JOIN molecules m ON m.id = c.molecule_id
        ORDER BY m.id
    """)

    _reference_coords = [
        {"name": name, "smiles": smiles, "x": round(x, 4), "y": round(y, 4)}
        for name, smiles, x, y in cur.fetchall()
    ]
    conn.close()
    return _reference_coords


def _smiles_to_fp_array(smiles: str) -> np.ndarray:
    """Parse SMILES → Morgan FP (ECFP4, radius=2, 2048 bits) as uint8 array."""
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: '{smiles}'")
    fp = AllChem.GetMorganFingerprintAsBitVect(mol, radius=2, nBits=2048)
    arr = np.zeros(2048, dtype=np.uint8)
    for bit in fp.GetOnBits():
        arr[bit] = 1
    return arr


def _project_knn(query_fp: np.ndarray, ref_fps: np.ndarray, ref_coords: np.ndarray, k: int = _K) -> tuple[float, float]:
    """
    Project a query fingerprint into 2D via weighted KNN interpolation.
    
    Computes Tanimoto similarity to all reference fingerprints,
    selects the K most similar, and returns a similarity-weighted
    average of their 2D coordinates.
    """
    # Vectorized Tanimoto: intersection / union for binary vectors
    # query_fp: (2048,)  ref_fps: (N, 2048)
    intersection = np.sum(query_fp & ref_fps, axis=1).astype(np.float64)
    union = np.sum(query_fp | ref_fps, axis=1).astype(np.float64)
    
    # Avoid division by zero
    similarities = np.divide(intersection, union, out=np.zeros_like(intersection), where=union > 0)
    
    # Get top-K indices
    top_k_idx = np.argpartition(similarities, -k)[-k:]
    top_k_sims = similarities[top_k_idx]
    top_k_coords = ref_coords[top_k_idx]
    
    # Weighted average (use similarity as weight; add small epsilon to avoid zero-weight)
    weights = top_k_sims + 1e-8
    weight_sum = weights.sum()
    
    x = float(np.dot(weights, top_k_coords[:, 0]) / weight_sum)
    y = float(np.dot(weights, top_k_coords[:, 1]) / weight_sum)
    
    return x, y


def project_molecule(smiles: str) -> dict:
    """
    Project a query molecule into the pre-computed 2D chemical space map.

    Args:
        smiles: Query molecule as SMILES string

    Returns:
        dict with:
          - query: {x, y, smiles}
          - references: [{name, smiles, x, y}, ...]

    Raises:
        ValueError: if SMILES is invalid
        FileNotFoundError: if map or DB files are missing
    """
    map_data = _load_map_data()
    refs = _load_reference_coords()

    # Compute fingerprint and project via KNN interpolation
    fp = _smiles_to_fp_array(smiles)
    qx, qy = _project_knn(
        fp,
        map_data["ref_fps"],
        map_data["ref_coords"],
    )

    return {
        "query": {
            "x": round(qx, 4),
            "y": round(qy, 4),
            "smiles": smiles,
        },
        "references": refs,
    }
