"""
ROGVEDA — Analog Scoring Service (Phase 12)

Applies every predefined transform from modification_service to a molecule,
scores the results using ML predictions, and returns the top-ranked analogs.

Score = target_endpoint_confidence − Σ(risk_endpoint_confidence where > threshold)

The TRANSFORMS list is imported from modification_service — no duplication.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

from app.services.modification_service import TRANSFORMS
from app.services import chemistry_service
from app.services import ml_service

logger = logging.getLogger(__name__)

# Endpoints classified by role
RISK_ENDPOINTS = ["herg", "tox21_mmp"]
ACTIVITY_ENDPOINTS = ["antiinflammatory", "antioxidant", "antimicrobial", "anticancer"]
ALL_ENDPOINTS = [
    {"id": "herg", "name": "hERG Cardiotoxicity"},
    {"id": "antiinflammatory", "name": "Anti-inflammatory"},
    {"id": "antioxidant", "name": "Antioxidant"},
    {"id": "antimicrobial", "name": "Antimicrobial"},
    {"id": "anticancer", "name": "Anticancer"},
    {"id": "tox21_mmp", "name": "Tox21 Mitochondrial Toxicity"},
]

# Risk confidence threshold — only penalize risk endpoints above this
RISK_THRESHOLD = 0.5


@dataclass
class AnalogResult:
    """A single ranked analog suggestion."""
    rank: int
    transform_name: str
    transform_description: str
    product_smiles: str
    score: float
    properties: dict
    property_deltas: dict
    predictions: list[dict]


def _compute_property_deltas(original: dict, modified: dict) -> dict:
    """Compute deltas for key molecular properties."""
    keys = [
        ("molecular_weight", "MW", 2),
        ("logp", "LogP", 2),
        ("tpsa", "TPSA", 2),
    ]
    deltas = {}
    for key, label, decimals in keys:
        orig_val = original.get(key)
        mod_val = modified.get(key)
        if orig_val is not None and mod_val is not None:
            try:
                delta = round(float(mod_val) - float(orig_val), decimals)
                deltas[label] = {
                    "original": round(float(orig_val), decimals),
                    "modified": round(float(mod_val), decimals),
                    "delta": delta,
                }
            except (TypeError, ValueError):
                pass
    return deltas


def _score_analog(
    predictions: list[dict],
    target_endpoint: str,
) -> float:
    """
    Score = target_confidence − Σ(risk_confidence where > threshold).

    If the target endpoint prediction is missing, score = -999.
    """
    target_confidence = None
    risk_penalty = 0.0

    for pred in predictions:
        ep_id = pred.get("endpoint_id", "")
        confidence = pred.get("confidence")
        if confidence is None:
            continue

        if ep_id == target_endpoint:
            target_confidence = confidence

        if ep_id in RISK_ENDPOINTS and confidence > RISK_THRESHOLD:
            risk_penalty += confidence

    if target_confidence is None:
        return -999.0

    return round(target_confidence - risk_penalty, 4)


def generate_shortlist(
    smiles: str,
    target_endpoint: str,
    top_n: int = 5,
) -> list[AnalogResult]:
    """
    Apply every predefined transform to *smiles*, score, and return the top N.

    Args:
        smiles: Input molecule as SMILES string.
        target_endpoint: Which activity endpoint to optimize for
                         (e.g. 'antiinflammatory', 'anticancer').
        top_n: Max number of results to return.

    Returns:
        List of AnalogResult sorted descending by score.

    Raises:
        ValueError: if smiles is invalid or target_endpoint is not recognized.
    """
    from rdkit import Chem

    if target_endpoint not in ACTIVITY_ENDPOINTS:
        raise ValueError(
            f"Unknown target endpoint '{target_endpoint}'. "
            f"Valid options: {ACTIVITY_ENDPOINTS}"
        )

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: '{smiles}'")

    # Compute original properties for delta computation
    original_props = chemistry_service.calculate_properties(smiles)

    # Apply every transform, collect valid results
    candidates = []

    for transform in TRANSFORMS:
        try:
            product = transform.fn(smiles)
        except Exception as e:
            logger.debug("Transform '%s' raised: %s", transform.name, e)
            continue

        if product is None:
            continue

        # Validate the product
        product_mol = Chem.MolFromSmiles(product)
        if product_mol is None:
            continue

        # Skip duplicates
        canonical_product = Chem.MolToSmiles(product_mol, canonical=True)
        if any(c["smiles"] == canonical_product for c in candidates):
            continue

        # Compute properties
        try:
            props = chemistry_service.calculate_properties(canonical_product)
        except Exception:
            continue

        # Run predictions on all endpoints
        predictions = []
        for ep in ALL_ENDPOINTS:
            try:
                pred = ml_service.predict_endpoint(canonical_product, ep["id"])
                if ep["id"] in RISK_ENDPOINTS:
                    status = "High Risk" if "likely active" in pred.label else "Low Risk"
                else:
                    status = "Active" if "likely active" in pred.label else "Inactive"

                predictions.append({
                    "endpoint_id": ep["id"],
                    "endpoint_name": ep["name"],
                    "status_label": status,
                    "confidence": round(pred.probability_active, 4),
                    "available": True,
                })
            except FileNotFoundError:
                predictions.append({
                    "endpoint_id": ep["id"],
                    "endpoint_name": ep["name"],
                    "status_label": "Model not available",
                    "confidence": None,
                    "available": False,
                })
            except Exception:
                predictions.append({
                    "endpoint_id": ep["id"],
                    "endpoint_name": ep["name"],
                    "status_label": "Error",
                    "confidence": None,
                    "available": False,
                })

        # Score
        score = _score_analog(predictions, target_endpoint)

        # Property deltas
        deltas = _compute_property_deltas(original_props, props)

        candidates.append({
            "smiles": canonical_product,
            "transform_name": transform.name,
            "transform_description": transform.description,
            "properties": props,
            "predictions": predictions,
            "score": score,
            "deltas": deltas,
        })

    # Sort by score descending
    candidates.sort(key=lambda c: c["score"], reverse=True)

    # Take top N and assign ranks
    results = []
    for i, c in enumerate(candidates[:top_n]):
        results.append(AnalogResult(
            rank=i + 1,
            transform_name=c["transform_name"],
            transform_description=c["transform_description"],
            product_smiles=c["smiles"],
            score=c["score"],
            properties=c["properties"],
            property_deltas=c["deltas"],
            predictions=c["predictions"],
        ))

    return results
