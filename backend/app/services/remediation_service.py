"""
ROGVEDA — Remediation Service (Phase 13)

Given a molecule flagged as high-risk on a toxicity endpoint, this service
searches for a minimal structural modification that removes the risk flag
WITHOUT destroying a specified therapeutic activity.

Search strategy:
  Depth 1 — try every single predefined transform.
  Depth 2 — try combinations of two transforms (capped at MAX_DEPTH2_COMBOS).

The TRANSFORMS list is imported from modification_service — same single
source of truth used by the individual-transform UI and analog_service.
"""

import logging
import time
from dataclasses import dataclass, field
from typing import Optional

from rdkit import Chem, RDLogger

from app.services.modification_service import TRANSFORMS
from app.services import ml_service

# Suppress noisy RDKit warnings
RDLogger.logger().setLevel(RDLogger.ERROR)

logger = logging.getLogger(__name__)

# ── Constants ───────────────────────────────────────────────────
# Max allowed drop in the protected endpoint's confidence (10%).
PROTECT_TOLERANCE = 0.10

# Maximum number of depth-2 combinations to evaluate.
MAX_DEPTH2_COMBOS = 50

# Endpoints classified by role (same as analog_service, but we keep our
# own reference to avoid coupling to analog_service).
RISK_ENDPOINTS = ["herg", "tox21_mmp"]
ACTIVITY_ENDPOINTS = ["antiinflammatory", "antioxidant", "antimicrobial", "anticancer"]


# ── Result dataclass ────────────────────────────────────────────
@dataclass
class RemediationResult:
    """Result of a remediation search."""
    found: bool
    depth: int
    transforms_applied: list[str]
    original_smiles: str
    remediated_smiles: str
    flagged_endpoint: str
    flagged_before: float          # confidence on flagged endpoint (original)
    flagged_after: float           # confidence on flagged endpoint (remediated)
    flagged_threshold: float       # model threshold for the flagged endpoint
    protect_endpoint: str
    protect_before: float          # confidence on protect endpoint (original)
    protect_after: float           # confidence on protect endpoint (remediated)
    explanation: str
    search_time_ms: float = 0.0


# ── Helpers ─────────────────────────────────────────────────────

def _get_prediction_confidence(smiles: str, endpoint: str) -> Optional[float]:
    """Return probability_active for a molecule on an endpoint, or None."""
    try:
        pred = ml_service.predict_endpoint(smiles, endpoint)
        return pred.probability_active
    except Exception:
        return None


def _is_high_risk(confidence: float, endpoint: str) -> bool:
    """Check if a confidence value exceeds the model's chosen threshold."""
    threshold = ml_service.get_threshold(endpoint)
    return confidence >= threshold


def _heavy_atom_count(smiles: str) -> int:
    """Return heavy atom count for a SMILES, or 9999 on failure."""
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return 9999
    return mol.GetNumHeavyAtoms()


def _check_candidate(
    candidate_smiles: str,
    flagged_endpoint: str,
    protect_endpoint: str,
    baseline_protect: float,
    flagged_threshold: float,
) -> Optional[tuple[float, float]]:
    """
    Check if a candidate molecule passes the remediation criteria.

    Returns (flagged_conf, protect_conf) if the candidate passes, else None.
    Criteria:
      1. Flagged endpoint confidence drops BELOW its threshold.
      2. Protected endpoint confidence doesn't drop more than PROTECT_TOLERANCE.
    """
    flagged_conf = _get_prediction_confidence(candidate_smiles, flagged_endpoint)
    if flagged_conf is None:
        return None

    # Must no longer be high-risk
    if flagged_conf >= flagged_threshold:
        return None

    protect_conf = _get_prediction_confidence(candidate_smiles, protect_endpoint)
    if protect_conf is None:
        return None

    # Protected activity must not drop too much
    if baseline_protect - protect_conf > PROTECT_TOLERANCE:
        return None

    return (flagged_conf, protect_conf)


# ── Main search function ────────────────────────────────────────

def find_remediation(
    smiles: str,
    flagged_endpoint: str,
    protect_endpoint: str,
    max_depth: int = 2,
) -> RemediationResult:
    """
    Search for a minimal structural modification that removes a flagged
    high-risk prediction while preserving a protected therapeutic activity.

    Args:
        smiles: Input molecule as SMILES string.
        flagged_endpoint: The risk endpoint to fix (e.g. 'herg', 'tox21_mmp').
        protect_endpoint: The activity endpoint to preserve (e.g. 'antiinflammatory').
        max_depth: Maximum search depth (1 = single transforms, 2 = pairs).

    Returns:
        RemediationResult with found=True if a fix was discovered.

    Raises:
        ValueError: if inputs are invalid.
    """
    start_time = time.time()

    # ── Input validation ────────────────────────────────────────
    if flagged_endpoint not in RISK_ENDPOINTS:
        raise ValueError(
            f"Unknown flagged endpoint '{flagged_endpoint}'. "
            f"Valid risk endpoints: {RISK_ENDPOINTS}"
        )
    if protect_endpoint not in ACTIVITY_ENDPOINTS:
        raise ValueError(
            f"Unknown protect endpoint '{protect_endpoint}'. "
            f"Valid activity endpoints: {ACTIVITY_ENDPOINTS}"
        )

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: '{smiles}'")

    canonical = Chem.MolToSmiles(mol, canonical=True)

    # ── Baseline predictions ────────────────────────────────────
    baseline_flagged = _get_prediction_confidence(canonical, flagged_endpoint)
    if baseline_flagged is None:
        raise ValueError(f"Could not predict {flagged_endpoint} for input molecule.")

    flagged_threshold = ml_service.get_threshold(flagged_endpoint)

    baseline_protect = _get_prediction_confidence(canonical, protect_endpoint)
    if baseline_protect is None:
        raise ValueError(f"Could not predict {protect_endpoint} for input molecule.")

    def _make_no_fix_result(explanation: str) -> RemediationResult:
        elapsed_ms = round((time.time() - start_time) * 1000, 1)
        return RemediationResult(
            found=False,
            depth=0,
            transforms_applied=[],
            original_smiles=canonical,
            remediated_smiles=canonical,
            flagged_endpoint=flagged_endpoint,
            flagged_before=round(baseline_flagged, 4),
            flagged_after=round(baseline_flagged, 4),
            flagged_threshold=flagged_threshold,
            protect_endpoint=protect_endpoint,
            protect_before=round(baseline_protect, 4),
            protect_after=round(baseline_protect, 4),
            explanation=explanation,
            search_time_ms=elapsed_ms,
        )

    # If the molecule isn't actually high-risk, nothing to fix
    if not _is_high_risk(baseline_flagged, flagged_endpoint):
        return _make_no_fix_result(
            f"Molecule is not flagged as high risk on {flagged_endpoint} "
            f"(confidence {baseline_flagged:.2%} < threshold {flagged_threshold:.2%})."
        )

    # ── Depth 1: single transforms ──────────────────────────────
    depth1_candidates = []  # (smiles, transform_name, flagged_conf, protect_conf)
    depth1_intermediates = []  # (smiles, transform_name) — all valid products for depth 2

    for transform in TRANSFORMS:
        try:
            product = transform.fn(canonical)
        except Exception:
            continue

        if product is None:
            continue

        product_mol = Chem.MolFromSmiles(product)
        if product_mol is None:
            continue

        product_canonical = Chem.MolToSmiles(product_mol, canonical=True)

        # Skip if it's the same molecule
        if product_canonical == canonical:
            continue

        # Track as intermediate for potential depth-2 search
        depth1_intermediates.append((product_canonical, transform.name))

        # Check remediation criteria
        result = _check_candidate(
            product_canonical,
            flagged_endpoint,
            protect_endpoint,
            baseline_protect,
            flagged_threshold,
        )
        if result is not None:
            flagged_conf, protect_conf = result
            depth1_candidates.append((
                product_canonical,
                transform.name,
                flagged_conf,
                protect_conf,
            ))

    # If we found depth-1 fixes, return the best one (fewest atom changes)
    if depth1_candidates:
        original_ha = _heavy_atom_count(canonical)
        depth1_candidates.sort(key=lambda c: abs(_heavy_atom_count(c[0]) - original_ha))
        best = depth1_candidates[0]
        elapsed_ms = round((time.time() - start_time) * 1000, 1)
        return RemediationResult(
            found=True,
            depth=1,
            transforms_applied=[best[1]],
            original_smiles=canonical,
            remediated_smiles=best[0],
            flagged_endpoint=flagged_endpoint,
            flagged_before=round(baseline_flagged, 4),
            flagged_after=round(best[2], 4),
            flagged_threshold=flagged_threshold,
            protect_endpoint=protect_endpoint,
            protect_before=round(baseline_protect, 4),
            protect_after=round(best[3], 4),
            explanation=(
                f"Single transform '{best[1]}' reduced {flagged_endpoint} risk "
                f"from {baseline_flagged:.2%} to {best[2]:.2%} (below threshold "
                f"{flagged_threshold:.2%}) while maintaining {protect_endpoint} "
                f"activity at {best[3]:.2%}."
            ),
            search_time_ms=elapsed_ms,
        )

    # ── Depth 2: pairs of transforms (if allowed) ──────────────
    if max_depth < 2 or not depth1_intermediates:
        return _make_no_fix_result(
            "No single structural transform was found that removes the flagged "
            "risk while preserving the protected activity within tolerance."
        )

    depth2_candidates = []
    combo_count = 0

    for intermediate_smiles, first_transform in depth1_intermediates:
        if combo_count >= MAX_DEPTH2_COMBOS:
            break

        for transform in TRANSFORMS:
            if combo_count >= MAX_DEPTH2_COMBOS:
                break

            combo_count += 1

            try:
                product = transform.fn(intermediate_smiles)
            except Exception:
                continue

            if product is None:
                continue

            product_mol = Chem.MolFromSmiles(product)
            if product_mol is None:
                continue

            product_canonical = Chem.MolToSmiles(product_mol, canonical=True)

            # Skip if same as original or same as intermediate
            if product_canonical == canonical or product_canonical == intermediate_smiles:
                continue

            result = _check_candidate(
                product_canonical,
                flagged_endpoint,
                protect_endpoint,
                baseline_protect,
                flagged_threshold,
            )
            if result is not None:
                flagged_conf, protect_conf = result
                depth2_candidates.append((
                    product_canonical,
                    [first_transform, transform.name],
                    flagged_conf,
                    protect_conf,
                ))

    if depth2_candidates:
        original_ha = _heavy_atom_count(canonical)
        depth2_candidates.sort(key=lambda c: abs(_heavy_atom_count(c[0]) - original_ha))
        best = depth2_candidates[0]
        elapsed_ms = round((time.time() - start_time) * 1000, 1)
        return RemediationResult(
            found=True,
            depth=2,
            transforms_applied=best[1],
            original_smiles=canonical,
            remediated_smiles=best[0],
            flagged_endpoint=flagged_endpoint,
            flagged_before=round(baseline_flagged, 4),
            flagged_after=round(best[2], 4),
            flagged_threshold=flagged_threshold,
            protect_endpoint=protect_endpoint,
            protect_before=round(baseline_protect, 4),
            protect_after=round(best[3], 4),
            explanation=(
                f"Two-step transform ('{best[1][0]}' then '{best[1][1]}') reduced "
                f"{flagged_endpoint} risk from {baseline_flagged:.2%} to {best[2]:.2%} "
                f"(below threshold {flagged_threshold:.2%}) while maintaining "
                f"{protect_endpoint} activity at {best[3]:.2%}."
            ),
            search_time_ms=elapsed_ms,
        )

    return _make_no_fix_result(
        f"No remediation found within search limits "
        f"({len(TRANSFORMS)} single transforms + {combo_count} depth-2 combinations checked)."
    )
