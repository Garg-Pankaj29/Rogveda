"""
ROGVEDA — ML Prediction Service

Loads the trained ML models and metadata, exposing a predict_endpoint() 
function used by the molecule API router.

Per project rules (docs/04_RULES.md §4):
  - Every prediction ships with a calibrated confidence score.
  - Never claim "safe" or "effective" — use "likely active" / "low risk" etc.
  - The chosen_threshold from metadata is used instead of default 0.5.

Per project rules (docs/04_RULES.md §3):
  - ML logic stays in its own service module, separate from chemistry/LLM.
  - Must fail gracefully without crashing the rest of the app.
"""

import json
import logging
from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem

from app.core.config import PROJECT_ROOT

# Suppress noisy RDKit warnings in server logs
RDLogger.logger().setLevel(RDLogger.ERROR)

logger = logging.getLogger(__name__)

# ── Paths ───────────────────────────────────────────────────────
MODELS_DIR = PROJECT_ROOT / "models"

# ── Data classes ────────────────────────────────────────────────
@dataclass
class PredictionResult:
    """Result of a single molecule prediction."""
    canonical_smiles: str
    probability_active: float
    label: str              # "likely active" or "likely inactive"
    confidence: str         # "high", "moderate", "low"
    threshold_used: float
    model_version: int


# ── Model loader (singleton dictionary) ────────────────────────
_models = {}
_metadatas = {}


def _load_metadata(endpoint: str) -> None:
    """Load only the JSON metadata without loading the heavy .pkl model."""
    metadata_path = MODELS_DIR / f"{endpoint}_model_metadata.json"
    if metadata_path.exists():
        with open(metadata_path) as f:
            _metadatas[endpoint] = json.load(f)
        logger.info(
            "Loaded %s model metadata (v%s, threshold=%s)",
            endpoint,
            _metadatas[endpoint].get("version"),
            _metadatas[endpoint].get("chosen_threshold"),
        )
    else:
        _metadatas[endpoint] = {"chosen_threshold": 0.5, "version": 0}
        logger.warning("No metadata file found for %s — using default threshold 0.5", endpoint)


def _load_model(endpoint: str) -> None:
    """Load heavy .pkl model from disk for a specific endpoint."""
    model_path = MODELS_DIR / f"{endpoint}_model.pkl"
    
    if not model_path.exists():
        raise FileNotFoundError(
            f"{endpoint} model not found at {model_path}. Run scripts/train_model.py first."
        )
    
    logger.info("Loading heavy %s model from disk...", endpoint)
    _models[endpoint] = joblib.load(model_path)
    logger.info("Loaded %s model from %s", endpoint, model_path)

    if endpoint not in _metadatas:
        _load_metadata(endpoint)


def get_threshold(endpoint: str) -> float:
    """Return the chosen decision threshold from metadata."""
    if endpoint not in _metadatas:
        _load_metadata(endpoint)
    return _metadatas[endpoint].get("chosen_threshold", 0.5)


def get_model_info(endpoint: str) -> dict:
    """Return model metadata for /api/molecule/model-info and cache fingerprinting."""
    if endpoint not in _metadatas:
        _load_metadata(endpoint)
        
    model_path = MODELS_DIR / f"{endpoint}_model.pkl"
    if not model_path.exists():
        return {"error": "Model not available"}
            
    return {
        "model_name": _metadatas[endpoint].get("model_name", f"{endpoint}_model"),
        "version": _metadatas[endpoint].get("version", 0),
        "target": _metadatas[endpoint].get("target", endpoint),
        "chosen_threshold": _metadatas[endpoint].get("chosen_threshold", 0.5),
        "fingerprint": _metadatas[endpoint].get("fingerprint", "Morgan radius=2, 2048 bits"),
        "dataset_source": _metadatas[endpoint].get("dataset_source", "ChEMBL 37"),
        "split_method": _metadatas[endpoint].get("split_method", "scaffold split"),
    }


def _smiles_to_fp(smiles: str) -> np.ndarray | None:
    """Parse SMILES → canonical → Morgan FP (radius=2, 2048 bits)."""
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    fp = AllChem.GetMorganFingerprintAsBitVect(mol, radius=2, nBits=2048)
    return np.array(fp, dtype=np.int8)


def _confidence_label(prob: float, threshold: float) -> str:
    """
    Assign a human-readable confidence label.
    Confidence is how far the probability is from the decision boundary.
    """
    distance = abs(prob - threshold)
    if distance >= 0.30:
        return "high"
    elif distance >= 0.15:
        return "moderate"
    else:
        return "low"


def predict_endpoint(smiles: str, endpoint: str) -> PredictionResult:
    """
    Predict activity for a single SMILES string for a specific endpoint.

    Returns a PredictionResult with calibrated probability, a label
    (never "safe"/"toxic" — per rules §4), and a confidence level.

    Raises:
        FileNotFoundError: if model file is missing
        ValueError: if SMILES cannot be parsed by RDKit
    """
    # Lazy-load on first call
    if endpoint not in _models:
        _load_model(endpoint)

    # Canonicalize SMILES (per rules §3 — all parsing through RDKit)
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(
            f"Invalid SMILES: '{smiles}' — RDKit could not parse this structure."
        )
    canonical = Chem.MolToSmiles(mol, canonical=True)

    # Compute fingerprint
    fp = _smiles_to_fp(canonical)
    if fp is None:
        raise ValueError(f"Could not compute fingerprint for: '{canonical}'")

    # Predict
    prob_active = float(_models[endpoint].predict_proba(fp.reshape(1, -1))[0, 1])
    threshold = get_threshold(endpoint)

    is_active = prob_active >= threshold
    
    # Custom label based on endpoint
    if endpoint == "herg":
        label = "likely active (predicted hERG risk)" if is_active else "likely inactive (low predicted hERG risk)"
    else:
        label = "likely active" if is_active else "likely inactive"
        
    confidence = _confidence_label(prob_active, threshold)

    return PredictionResult(
        canonical_smiles=canonical,
        probability_active=round(prob_active, 4),
        label=label,
        confidence=confidence,
        threshold_used=threshold,
        model_version=_metadatas[endpoint].get("version", 0),
    )

def predict(smiles: str) -> PredictionResult:
    """Backward compatibility for existing code that expects a predict() function"""
    return predict_endpoint(smiles, "herg")


def preload_all_models() -> None:
    """
    Preload all models into memory in the background.
    This eliminates the ~15s cold-start latency when the user requests predictions
    for the first time after a server restart.
    """
    endpoints = ["herg", "antiinflammatory", "antioxidant", "antimicrobial", "anticancer", "tox21_mmp"]
    logger.info("Preloading all ML models in the background to prevent cold-start latency...")
    for ep in endpoints:
        if ep not in _models:
            try:
                _load_model(ep)
            except Exception as e:
                logger.error("Failed to preload %s model: %s", ep, e)
    logger.info("Successfully preloaded all models!")
