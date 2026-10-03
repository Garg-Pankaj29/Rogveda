"""
ROGVEDA — Chemistry Service

Deterministic chemistry operations using RDKit (Python).
Per docs/04_RULES.md §2: if it can be computed deterministically
(RDKit, math, a lookup), it must never be answered by the LLM.
"""

import logging

from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem, Descriptors

# Suppress noisy RDKit warnings in server logs
RDLogger.logger().setLevel(RDLogger.ERROR)

logger = logging.getLogger(__name__)


def generate_3d_sdf(smiles: str) -> str:
    """
    Takes a SMILES string, embeds a 3D conformer using ETKDG,
    optimises with MMFF94, and returns the structure as an SDF block.

    Raises:
        ValueError: if SMILES cannot be parsed or 3D embedding fails.
    """
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: '{smiles}' — RDKit could not parse it.")

    # Add explicit hydrogens for proper 3D geometry
    mol = Chem.AddHs(mol)

    # Embed 3D coordinates using ETKDG (the best general-purpose method)
    params = AllChem.ETKDGv3()
    params.randomSeed = 42  # reproducibility
    result = AllChem.EmbedMolecule(mol, params)
    if result == -1:
        raise ValueError(
            f"3D embedding failed for '{smiles}'. "
            "The molecule may be too constrained for ETKDG."
        )

    # Optimise geometry with MMFF94 force field
    try:
        AllChem.MMFFOptimizeMolecule(mol, maxIters=500)
    except Exception:
        # If MMFF fails, fall back to UFF
        try:
            AllChem.UFFOptimizeMolecule(mol, maxIters=500)
        except Exception:
            logger.warning("Force-field optimisation failed for %s — using raw ETKDG coords", smiles)

    # Generate canonical SMILES for reference (from the heavy-atom graph)
    canonical = Chem.MolToSmiles(Chem.RemoveHs(mol), canonical=True)

    # Write SDF block (includes 3D coordinates)
    sdf_block = Chem.MolToMolBlock(mol)

    return sdf_block


def calculate_properties(smiles: str) -> dict:
    """
    Calculate deterministic molecular properties (MW, LogP, TPSA) using RDKit.
    """
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: '{smiles}'")

    return {
        "molecular_weight": round(Descriptors.MolWt(mol), 2),
        "logp": round(Descriptors.MolLogP(mol), 2),
        "tpsa": round(Descriptors.TPSA(mol), 2)
    }


# ── Similarity Search ──────────────────────────────────────────

from typing import Optional
import sqlite3
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from app.core.config import PROJECT_ROOT

SIMILARITY_DB = PROJECT_ROOT / "data" / "processed" / "similarity.db"


@dataclass
class SimilarityHit:
    name: str
    canonical_smiles: str
    tanimoto: float
    svg: Optional[str] = None


def _smiles_to_fp_array(smiles: str) -> np.ndarray:
    """Parse SMILES → Morgan FP (ECFP4) as uint8 numpy array."""
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: '{smiles}'")
    fp = AllChem.GetMorganFingerprintAsBitVect(mol, radius=2, nBits=2048)
    arr = np.zeros(2048, dtype=np.uint8)
    for bit in fp.GetOnBits():
        arr[bit] = 1
    return arr


def _smiles_to_ecfp6_array(smiles: str) -> np.ndarray:
    """Parse SMILES → Morgan FP (ECFP6) as uint8 numpy array."""
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: '{smiles}'")
    fp = AllChem.GetMorganFingerprintAsBitVect(mol, radius=3, nBits=2048)
    arr = np.zeros(2048, dtype=np.uint8)
    for bit in fp.GetOnBits():
        arr[bit] = 1
    return arr


def _tanimoto(a: np.ndarray, b: np.ndarray) -> float:
    """Compute Tanimoto coefficient between two binary fingerprint arrays."""
    intersection = int(np.sum(a & b))
    union = int(np.sum(a | b))
    if union == 0:
        return 0.0
    return intersection / union


def _smiles_to_maccs_array(smiles: str) -> np.ndarray:
    """Parse SMILES → MACCS keys as uint8 numpy array."""
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: '{smiles}'")
    fp = Chem.rdMolDescriptors.GetMACCSKeysFingerprint(mol)
    arr = np.zeros(167, dtype=np.uint8)
    for bit in fp.GetOnBits():
        arr[bit] = 1
    return arr


def _dice(a: np.ndarray, b: np.ndarray) -> float:
    intersection = int(np.sum(a & b))
    sum_a = int(np.sum(a))
    sum_b = int(np.sum(b))
    if sum_a + sum_b == 0:
        return 0.0
    return 2.0 * intersection / (sum_a + sum_b)


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    intersection = int(np.sum(a & b))
    sum_a = int(np.sum(a))
    sum_b = int(np.sum(b))
    if sum_a == 0 or sum_b == 0:
        return 0.0
    return intersection / (np.sqrt(sum_a) * np.sqrt(sum_b))


def find_similar(smiles: str, top_n: int = 10, threshold: float = 0.0, metric: str = "tanimoto_ecfp4") -> list[SimilarityHit]:
    """
    Find the top_n most similar molecules from the reference database.

    Args:
        smiles: Query molecule as SMILES string
        top_n: Maximum number of results to return
        threshold: Minimum similarity score (0.0–1.0)
        metric: Similarity metric (tanimoto_ecfp4, tanimoto_ecfp6, dice_ecfp4, tanimoto_maccs)

    Raises:
        ValueError: if SMILES is invalid
        FileNotFoundError: if similarity.db doesn't exist
    """
    if not SIMILARITY_DB.exists():
        raise FileNotFoundError(
            f"Similarity database not found at {SIMILARITY_DB}. "
            "Run scripts/build_similarity_db.py first."
        )

    is_maccs = metric == "tanimoto_maccs"
    is_ecfp6 = metric == "tanimoto_ecfp6"

    if is_maccs:
        query_fp = _smiles_to_maccs_array(smiles)
    elif is_ecfp6:
        query_fp = _smiles_to_ecfp6_array(smiles)
    else:
        query_fp = _smiles_to_fp_array(smiles)

    conn = sqlite3.connect(str(SIMILARITY_DB))
    cur = conn.cursor()
    cur.execute("SELECT name, canonical_smiles, fingerprint FROM molecules")

    hits: list[SimilarityHit] = []
    for name, canonical, fp_blob in cur.fetchall():
        if is_maccs:
            try:
                ref_fp = _smiles_to_maccs_array(canonical)
                score = _tanimoto(query_fp, ref_fp)
            except ValueError:
                continue
        elif is_ecfp6:
            try:
                ref_fp = _smiles_to_ecfp6_array(canonical)
                score = _tanimoto(query_fp, ref_fp)
            except ValueError:
                continue
        else:
            ref_fp = np.frombuffer(fp_blob, dtype=np.uint8)
            if metric == "dice_ecfp4":
                score = _dice(query_fp, ref_fp)
            elif metric == "cosine_ecfp4":
                score = _cosine(query_fp, ref_fp)
            else:
                score = _tanimoto(query_fp, ref_fp)

        if score >= threshold:
            hits.append(SimilarityHit(name=name, canonical_smiles=canonical, tanimoto=round(score, 4)))

    conn.close()

    # Sort by score descending, return top N
    hits.sort(key=lambda h: h.tanimoto, reverse=True)
    return hits[:top_n]


def find_substructure(smiles: str, max_results: int = 50) -> list[SimilarityHit]:
    """
    Find molecules in the reference database that contain the given SMILES as a substructure.
    """
    from rdkit.Chem import Draw
    if not SIMILARITY_DB.exists():
        raise FileNotFoundError(
            f"Similarity database not found at {SIMILARITY_DB}. "
            "Run scripts/build_similarity_db.py first."
        )

    query_mol = Chem.MolFromSmiles(smiles)
    if query_mol is None:
        raise ValueError(f"Invalid SMILES: '{smiles}'")

    conn = sqlite3.connect(str(SIMILARITY_DB))
    cur = conn.cursor()
    cur.execute("SELECT name, canonical_smiles FROM molecules")

    hits = []
    for name, canonical in cur.fetchall():
        ref_mol = Chem.MolFromSmiles(canonical)
        if ref_mol is not None:
            match = ref_mol.GetSubstructMatch(query_mol)
            if match:
                d2d = Draw.MolDraw2DSVG(150, 120)
                opts = d2d.drawOptions()
                opts.clearBackground = False
                opts.bondLineWidth = 2.0
                opts.minFontSize = 14
                d2d.DrawMolecule(ref_mol, highlightAtoms=match)
                d2d.FinishDrawing()
                svg = d2d.GetDrawingText()
                hits.append(SimilarityHit(name=name, canonical_smiles=canonical, tanimoto=1.0, svg=svg))
                if len(hits) >= max_results:
                    break
    conn.close()
    return hits

