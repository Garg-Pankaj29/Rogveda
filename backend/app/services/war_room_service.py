"""
ROGVEDA — Lead Optimization War Room Service (Phase 1)

Implements multi-dimensional evaluation of parent molecules and their generated analogs
across six research-relevant dimensions:
1. Predicted Activity (from trained activity models: antiinflammatory, antioxidant, etc.)
2. Predicted Cardiac Liability (hERG risk; display oriented higher is safer)
3. Predicted Mitochondrial Liability (Tox21 MMP; display oriented higher is safer)
4. Oral-Property Heuristic (physicochemical proxy based on MW, LogP, TPSA, RotB, HBD, HBA)
5. Synthetic Accessibility (RDKit SA_Score transformed to higher is easier)
6. Metabolic Stability (honestly marked unavailable until a validated local predictor exists)

Provides versioned, transparent optimization profiles, dynamic weight renormalization for
eligible dimensions, independent hard-constraint checking, and explainable score contributions.
"""

import copy
import logging
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional, Tuple

from rdkit import Chem, RDLogger
from rdkit.Chem import Descriptors

from app.services import chemistry_service, ml_service, synthesizability_service
from app.services.modification_service import TRANSFORMS

# Suppress noisy RDKit logs
RDLogger.logger().setLevel(RDLogger.ERROR)

logger = logging.getLogger(__name__)

# ── Scientific Disclaimers ───────────────────────────────────────────────────
SCIENTIFIC_DISCLAIMER = (
    "ROGVEDA Lead Optimization War Room produces computational estimates and heuristic scores "
    "for in-silico hypothesis generation. These scores do not establish clinical safety, "
    "in-vivo efficacy, human bioavailability, or readiness for regulatory submission."
)

ORAL_HEURISTIC_DISCLAIMER = (
    "Physicochemical proxy heuristic (MW, LogP, TPSA, RotB, HBD, HBA) based on Lipinski and "
    "Veber rules. This is a heuristic proxy, not a measured or validated human oral bioavailability prediction."
)

MITO_DISCLAIMER = (
    "MMP (mitochondrial membrane potential) disruption prediction from Tox21 data. Higher displayed "
    "safety preference indicates lower predicted probability of MMP disruption, not calibrated clinical safety."
)

# ── Dimension Identifiers ─────────────────────────────────────────────────────
DIM_ACTIVITY = "activity"
DIM_CARDIAC_SAFETY = "cardiac_safety"
DIM_MITOCHONDRIAL_SAFETY = "mitochondrial_safety"
DIM_ORAL_HEURISTIC = "oral_heuristic"
DIM_SYNTHETIC_EASE = "synthetic_accessibility"
DIM_METABOLIC_STABILITY = "metabolic_stability"

ALL_DIMENSIONS = [
    DIM_ACTIVITY,
    DIM_CARDIAC_SAFETY,
    DIM_MITOCHONDRIAL_SAFETY,
    DIM_ORAL_HEURISTIC,
    DIM_SYNTHETIC_EASE,
    DIM_METABOLIC_STABILITY,
]

DIMENSION_LABELS = {
    DIM_ACTIVITY: "Predicted Activity",
    DIM_CARDIAC_SAFETY: "Cardiac Safety (hERG)",
    DIM_MITOCHONDRIAL_SAFETY: "Mitochondrial Safety (MMP)",
    DIM_ORAL_HEURISTIC: "Oral-Property Heuristic",
    DIM_SYNTHETIC_EASE: "Synthetic Accessibility",
    DIM_METABOLIC_STABILITY: "Metabolic Stability",
}

# ── Versioned Optimization Profiles ──────────────────────────────────────────
# Weights represent relative importance. They must be non-negative and sum > 0.
# Hard constraints are evaluated on raw measurements independently of aggregate score.

OPTIMIZATION_PROFILES: Dict[str, dict] = {
    "anti_inflammatory_exploration_v1": {
        "id": "anti_inflammatory_exploration_v1",
        "name": "Anti-inflammatory Exploration",
        "version": 1,
        "target_endpoint": "antiinflammatory",
        "target_endpoint_name": "Anti-inflammatory",
        "description": "Explores anti-inflammatory potency while penalizing cardiac and mitochondrial liability, requiring acceptable synthetic ease and oral druglikeness.",
        "rationale": "Prioritizes anti-inflammatory activity as primary therapeutic objective with robust off-target liability filtering.",
        "weights": {
            DIM_ACTIVITY: 0.35,
            DIM_CARDIAC_SAFETY: 0.20,
            DIM_MITOCHONDRIAL_SAFETY: 0.15,
            DIM_ORAL_HEURISTIC: 0.15,
            DIM_SYNTHETIC_EASE: 0.15,
            DIM_METABOLIC_STABILITY: 0.00,
        },
        "hard_constraints": [
            {
                "dimension": "herg_risk",
                "label": "Cardiac Risk (hERG)",
                "operator": "<=",
                "value": 0.35,
                "description": "Predicted hERG risk probability must not exceed 0.35",
            },
            {
                "dimension": "mw",
                "label": "Molecular Weight",
                "operator": "<=",
                "value": 550.0,
                "description": "Molecular weight must not exceed 550 Da",
            },
        ],
    },
    "balanced_lead_optimization_v1": {
        "id": "balanced_lead_optimization_v1",
        "name": "Balanced Safety & Property Optimization",
        "version": 1,
        "target_endpoint": "antiinflammatory",
        "target_endpoint_name": "Anti-inflammatory",
        "description": "Multi-parameter optimization balancing therapeutic activity, stringent safety margins, drug-likeness heuristics, and synthetic accessibility.",
        "rationale": "Equalized multi-parameter scoring ensuring no candidate advances with severe liability or poor synthetic feasibility.",
        "weights": {
            DIM_ACTIVITY: 0.20,
            DIM_CARDIAC_SAFETY: 0.25,
            DIM_MITOCHONDRIAL_SAFETY: 0.20,
            DIM_ORAL_HEURISTIC: 0.15,
            DIM_SYNTHETIC_EASE: 0.20,
            DIM_METABOLIC_STABILITY: 0.00,
        },
        "hard_constraints": [
            {
                "dimension": "herg_risk",
                "label": "Cardiac Risk (hERG)",
                "operator": "<=",
                "value": 0.20,
                "description": "Predicted hERG risk must remain below standard threshold 0.20",
            },
            {
                "dimension": "tox21_mmp_risk",
                "label": "Mitochondrial Risk (MMP)",
                "operator": "<=",
                "value": 0.25,
                "description": "Predicted Tox21 MMP risk must not exceed 0.25",
            },
            {
                "dimension": "sa_score",
                "label": "Synthetic Accessibility Score",
                "operator": "<=",
                "value": 5.0,
                "description": "SA_Score must not exceed 5.0 (exclude difficult synthesis targets)",
            },
        ],
    },
    "safety_first_scrutiny_v1": {
        "id": "safety_first_scrutiny_v1",
        "name": "Safety-First Scrutiny",
        "version": 1,
        "target_endpoint": "antiinflammatory",
        "target_endpoint_name": "Anti-inflammatory",
        "description": "Stringent toxicology-first profile with heavy emphasis on cardiac and mitochondrial safety margins.",
        "rationale": "Designed for lead triage where candidate liabilities are disqualifying.",
        "weights": {
            DIM_ACTIVITY: 0.15,
            DIM_CARDIAC_SAFETY: 0.35,
            DIM_MITOCHONDRIAL_SAFETY: 0.25,
            DIM_ORAL_HEURISTIC: 0.10,
            DIM_SYNTHETIC_EASE: 0.15,
            DIM_METABOLIC_STABILITY: 0.00,
        },
        "hard_constraints": [
            {
                "dimension": "herg_risk",
                "label": "Cardiac Risk (hERG)",
                "operator": "<=",
                "value": 0.20,
                "description": "Strict hERG threshold of 0.20",
            },
            {
                "dimension": "tox21_mmp_risk",
                "label": "Mitochondrial Risk (MMP)",
                "operator": "<=",
                "value": 0.15,
                "description": "Strict Tox21 MMP threshold of 0.15",
            },
            {
                "dimension": "sa_score",
                "label": "Synthetic Accessibility Score",
                "operator": "<=",
                "value": 4.5,
                "description": "SA_Score must be <= 4.5",
            },
        ],
    },
}


def get_available_profiles() -> List[dict]:
    """Return a list of available optimization profiles without mutating the store."""
    return [copy.deepcopy(p) for p in OPTIMIZATION_PROFILES.values()]


def get_profile(profile_id: str) -> dict:
    """Retrieve an optimization profile by ID."""
    if profile_id not in OPTIMIZATION_PROFILES:
        valid = list(OPTIMIZATION_PROFILES.keys())
        raise ValueError(f"Unknown optimization profile '{profile_id}'. Valid options: {valid}")
    return copy.deepcopy(OPTIMIZATION_PROFILES[profile_id])


# ── Dimension Calculators ─────────────────────────────────────────────────────

def compute_oral_property_heuristic(mol: Chem.Mol) -> Tuple[float, dict]:
    """
    Computes an oral-property heuristic proxy score in [0.0, 1.0].
    Evaluates adherence to Lipinski's Rule of 5 and Veber guidelines:
    - Molecular Weight: optimal 160 - 500 Da
    - LogP: optimal -0.4 - 5.0
    - TPSA: optimal 20 - 140 Å²
    - Rotatable bonds: optimal <= 10
    - HBD: optimal <= 5
    - HBA: optimal <= 10

    Returns:
        (heuristic_score_0_to_1, raw_parameters_dict)
    """
    mw = Descriptors.MolWt(mol)
    logp = Descriptors.MolLogP(mol)
    tpsa = Descriptors.TPSA(mol)
    rotb = Descriptors.NumRotatableBonds(mol)
    hbd = Descriptors.NumHDonors(mol)
    hba = Descriptors.NumHAcceptors(mol)

    # Sub-scores: 1.0 within range, ramping down smoothly outside range
    # 1. MW: 160..500
    if mw <= 500:
        mw_score = 1.0 if mw >= 160 else max(0.5, mw / 160.0)
    else:
        mw_score = max(0.0, 1.0 - (mw - 500) / 250.0)

    # 2. LogP: -0.4..5.0
    if -0.4 <= logp <= 5.0:
        logp_score = 1.0
    elif logp < -0.4:
        logp_score = max(0.0, 1.0 - abs(logp - (-0.4)) / 3.0)
    else:
        logp_score = max(0.0, 1.0 - (logp - 5.0) / 3.0)

    # 3. TPSA: 20..140
    if 20.0 <= tpsa <= 140.0:
        tpsa_score = 1.0
    elif tpsa < 20.0:
        tpsa_score = max(0.4, tpsa / 20.0)
    else:
        tpsa_score = max(0.0, 1.0 - (tpsa - 140.0) / 80.0)

    # 4. Rotatable bonds: <= 10
    rotb_score = 1.0 if rotb <= 10 else max(0.0, 1.0 - (rotb - 10) / 10.0)

    # 5. HBD: <= 5
    hbd_score = 1.0 if hbd <= 5 else max(0.0, 1.0 - (hbd - 5) / 5.0)

    # 6. HBA: <= 10
    hba_score = 1.0 if hba <= 10 else max(0.0, 1.0 - (hba - 10) / 10.0)

    score = round(
        (mw_score * 0.25)
        + (logp_score * 0.25)
        + (tpsa_score * 0.20)
        + (rotb_score * 0.10)
        + (hbd_score * 0.10)
        + (hba_score * 0.10),
        4,
    )

    raw_props = {
        "molecular_weight": round(float(mw), 2),
        "logp": round(float(logp), 2),
        "tpsa": round(float(tpsa), 2),
        "rotatable_bonds": int(rotb),
        "hbd": int(hbd),
        "hba": int(hba),
        "lipinski_violations": sum([
            mw > 500,
            logp > 5.0,
            hbd > 5,
            hba > 10,
        ]),
        "veber_violations": sum([
            rotb > 10,
            tpsa > 140.0,
        ]),
    }

    return score, raw_props


def compute_synthetic_accessibility(mol: Chem.Mol) -> Tuple[float, float, str]:
    """
    Computes synthetic accessibility score using RDKit's SA_Score.
    Scale:
        Raw SA_Score: 1.0 (trivial) to 10.0 (very difficult).
        Normalized score: (10.0 - raw_sa) / 9.0 in [0.0, 1.0] (higher is easier to synthesize).

    Returns:
        (normalized_ease, raw_sa_score, difficulty_label)
    """
    sa_dict = synthesizability_service.score_synthesizability(mol)
    raw_sa = float(sa_dict["sa_score"])
    difficulty = sa_dict["difficulty_label"]

    # Transform 1..10 to 1..0 (higher is easier)
    normalized = round(max(0.0, min(1.0, (10.0 - raw_sa) / 9.0)), 4)
    return normalized, raw_sa, difficulty


def evaluate_molecule_dimensions(
    smiles: str,
    target_endpoint: str,
) -> Dict[str, dict]:
    """
    Evaluates all 6 dimensions for a molecule using real chemistry & ML models.
    Preserves raw measurements, units, availability, and normalized [0.0, 1.0] scores.
    """
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: '{smiles}'")

    canonical_smiles = Chem.MolToSmiles(mol, canonical=True)
    dims: Dict[str, dict] = {}

    # 1. Predicted Activity
    try:
        act_pred = ml_service.predict_endpoint(canonical_smiles, target_endpoint)
        dims[DIM_ACTIVITY] = {
            "name": DIMENSION_LABELS[DIM_ACTIVITY],
            "available": True,
            "raw_value": act_pred.probability_active,
            "raw_label": act_pred.label,
            "normalized_score": round(act_pred.probability_active, 4),
            "model_version": act_pred.model_version,
            "threshold": act_pred.threshold_used,
            "direction": "maximize",
            "notes": f"Calibrated probability from {target_endpoint} model (threshold={act_pred.threshold_used})",
        }
    except FileNotFoundError:
        dims[DIM_ACTIVITY] = {
            "name": DIMENSION_LABELS[DIM_ACTIVITY],
            "available": False,
            "raw_value": None,
            "raw_label": "Model not available",
            "normalized_score": None,
            "model_version": None,
            "threshold": None,
            "direction": "maximize",
            "reason": f"Activity model for '{target_endpoint}' is not installed in models/ directory.",
        }
    except Exception as e:
        logger.warning("Activity prediction failed for %s: %s", target_endpoint, e)
        dims[DIM_ACTIVITY] = {
            "name": DIMENSION_LABELS[DIM_ACTIVITY],
            "available": False,
            "raw_value": None,
            "raw_label": "Error",
            "normalized_score": None,
            "model_version": None,
            "threshold": None,
            "direction": "maximize",
            "reason": f"Prediction error: {str(e)}",
        }

    # 2. Predicted Cardiac Liability (hERG)
    # Original probability is risk (active = cardiotoxicity risk).
    # Normalized score is cardiac safety: 1.0 - prob_active.
    try:
        herg_pred = ml_service.predict_endpoint(canonical_smiles, "herg")
        herg_risk = herg_pred.probability_active
        safety_score = round(max(0.0, min(1.0, 1.0 - herg_risk)), 4)
        is_risk = herg_risk >= herg_pred.threshold_used

        dims[DIM_CARDIAC_SAFETY] = {
            "name": DIMENSION_LABELS[DIM_CARDIAC_SAFETY],
            "available": True,
            "raw_value": herg_risk,
            "raw_label": "High Risk" if is_risk else "Low Risk",
            "normalized_score": safety_score,
            "model_version": herg_pred.model_version,
            "threshold": herg_pred.threshold_used,
            "direction": "minimize_risk_display_safety",
            "notes": (
                f"Raw hERG inhibition risk probability: {herg_risk:.4f} (threshold={herg_pred.threshold_used}). "
                f"Display normalized as Cardiac Safety = {safety_score:.4f} (higher is safer)."
            ),
        }
    except FileNotFoundError:
        dims[DIM_CARDIAC_SAFETY] = {
            "name": DIMENSION_LABELS[DIM_CARDIAC_SAFETY],
            "available": False,
            "raw_value": None,
            "raw_label": "Model not available",
            "normalized_score": None,
            "model_version": None,
            "threshold": None,
            "direction": "minimize_risk_display_safety",
            "reason": "hERG cardiotoxicity model artifact is missing from models/ directory.",
        }
    except Exception as e:
        dims[DIM_CARDIAC_SAFETY] = {
            "name": DIMENSION_LABELS[DIM_CARDIAC_SAFETY],
            "available": False,
            "raw_value": None,
            "raw_label": "Error",
            "normalized_score": None,
            "model_version": None,
            "threshold": None,
            "direction": "minimize_risk_display_safety",
            "reason": f"Prediction error: {str(e)}",
        }

    # 3. Predicted Mitochondrial Liability (Tox21 MMP)
    # Original probability is risk of MMP disruption.
    # Normalized score is mitochondrial safety: 1.0 - prob_active.
    try:
        mmp_pred = ml_service.predict_endpoint(canonical_smiles, "tox21_mmp")
        mmp_risk = mmp_pred.probability_active
        mito_safety = round(max(0.0, min(1.0, 1.0 - mmp_risk)), 4)
        is_risk = mmp_risk >= mmp_pred.threshold_used

        dims[DIM_MITOCHONDRIAL_SAFETY] = {
            "name": DIMENSION_LABELS[DIM_MITOCHONDRIAL_SAFETY],
            "available": True,
            "raw_value": mmp_risk,
            "raw_label": "High Risk" if is_risk else "Low Risk",
            "normalized_score": mito_safety,
            "model_version": mmp_pred.model_version,
            "threshold": mmp_pred.threshold_used,
            "direction": "minimize_risk_display_safety",
            "notes": (
                f"Raw Tox21 MMP disruption risk probability: {mmp_risk:.4f} (threshold={mmp_pred.threshold_used}). "
                f"Display normalized as Mitochondrial Safety = {mito_safety:.4f} (higher is safer)."
            ),
            "disclaimer": MITO_DISCLAIMER,
        }
    except FileNotFoundError:
        dims[DIM_MITOCHONDRIAL_SAFETY] = {
            "name": DIMENSION_LABELS[DIM_MITOCHONDRIAL_SAFETY],
            "available": False,
            "raw_value": None,
            "raw_label": "Model not available",
            "normalized_score": None,
            "model_version": None,
            "threshold": None,
            "direction": "minimize_risk_display_safety",
            "reason": "Tox21 MMP model artifact is missing from models/ directory.",
        }
    except Exception as e:
        dims[DIM_MITOCHONDRIAL_SAFETY] = {
            "name": DIMENSION_LABELS[DIM_MITOCHONDRIAL_SAFETY],
            "available": False,
            "raw_value": None,
            "raw_label": "Error",
            "normalized_score": None,
            "model_version": None,
            "threshold": None,
            "direction": "minimize_risk_display_safety",
            "reason": f"Prediction error: {str(e)}",
        }

    # 4. Oral-Property Heuristic
    oral_score, raw_oral = compute_oral_property_heuristic(mol)
    dims[DIM_ORAL_HEURISTIC] = {
        "name": DIMENSION_LABELS[DIM_ORAL_HEURISTIC],
        "available": True,
        "raw_value": oral_score,
        "raw_label": "Favorable" if oral_score >= 0.75 else ("Moderate" if oral_score >= 0.50 else "Poor"),
        "normalized_score": oral_score,
        "direction": "maximize",
        "parameters": raw_oral,
        "notes": "Deterministic physicochemical proxy score based on Lipinski & Veber druglikeness criteria.",
        "disclaimer": ORAL_HEURISTIC_DISCLAIMER,
    }

    # 5. Synthetic Accessibility
    norm_sa, raw_sa, sa_difficulty = compute_synthetic_accessibility(mol)
    dims[DIM_SYNTHETIC_EASE] = {
        "name": DIMENSION_LABELS[DIM_SYNTHETIC_EASE],
        "available": True,
        "raw_value": raw_sa,
        "raw_label": sa_difficulty,
        "normalized_score": norm_sa,
        "direction": "maximize_ease",
        "notes": f"Raw SA_Score = {raw_sa:.2f} (1=trivial, 10=difficult). Transformed to higher-is-easier score = {norm_sa:.4f}.",
    }

    # 6. Metabolic Stability
    # Honestly marked unavailable per Step C
    dims[DIM_METABOLIC_STABILITY] = {
        "name": DIMENSION_LABELS[DIM_METABOLIC_STABILITY],
        "available": False,
        "raw_value": None,
        "raw_label": "Unavailable",
        "normalized_score": None,
        "direction": "maximize",
        "reason": (
            "No validated local metabolic stability (e.g., microsomal clearance / CYP stability) "
            "predictor is installed in the offline model bundle. Never fabricated or inferred from LogP."
        ),
    }

    return dims


def evaluate_hard_constraints(
    raw_dims: Dict[str, dict],
    properties: dict,
    constraints: List[dict],
) -> Tuple[bool, List[dict]]:
    """
    Evaluates hard constraints against actual values.
    Returns:
        (all_passed: bool, violation_details: List[dict])
    """
    violations = []

    for c in constraints:
        dim_key = c.get("dimension")
        op = c.get("operator", "<=")
        threshold = c.get("value")
        desc = c.get("description", "")
        label = c.get("label", dim_key)

        actual_val = None

        if dim_key == "herg_risk":
            cardiac = raw_dims.get(DIM_CARDIAC_SAFETY, {})
            if cardiac.get("available"):
                actual_val = cardiac.get("raw_value")
        elif dim_key == "tox21_mmp_risk":
            mito = raw_dims.get(DIM_MITOCHONDRIAL_SAFETY, {})
            if mito.get("available"):
                actual_val = mito.get("raw_value")
        elif dim_key == "sa_score":
            sa = raw_dims.get(DIM_SYNTHETIC_EASE, {})
            if sa.get("available"):
                actual_val = sa.get("raw_value")
        elif dim_key == "mw":
            actual_val = properties.get("molecular_weight")
        elif dim_key == "logp":
            actual_val = properties.get("logp")
        elif dim_key == "tpsa":
            actual_val = properties.get("tpsa")

        if actual_val is None:
            # If the measurement is unavailable, constraint cannot be evaluated
            continue

        violated = False
        if op == "<=" and actual_val > threshold:
            violated = True
        elif op == "<" and actual_val >= threshold:
            violated = True
        elif op == ">=" and actual_val < threshold:
            violated = True
        elif op == ">" and actual_val <= threshold:
            violated = True
        elif op == "==" and actual_val != threshold:
            violated = True

        if violated:
            violations.append({
                "dimension": dim_key,
                "label": label,
                "operator": op,
                "threshold": threshold,
                "actual_value": round(float(actual_val), 4) if isinstance(actual_val, float) else actual_val,
                "description": desc,
            })

    all_passed = len(violations) == 0
    return all_passed, violations


def calculate_candidate_score(
    dimensions: Dict[str, dict],
    profile: dict,
) -> Tuple[float, float, List[dict]]:
    """
    Calculates the aggregate score by dynamically renormalizing weights over
    AVAILABLE dimensions only.

    Formula:
        eligible_dimensions = [d for d in dimensions if d.available and d.normalized_score is not None]
        sum_eligible_weights = sum(raw_weights of eligible_dimensions)
        effective_weight_i = raw_weight_i / sum_eligible_weights
        aggregate_score = sum(effective_weight_i * normalized_score_i)

    Returns:
        (aggregate_score, coverage_ratio, score_breakdown_list)
    """
    raw_weights = profile.get("weights", {})
    breakdown = []
    eligible_weights_sum = 0.0

    # 1. Identify eligible dimensions and sum weights
    for dim_key in ALL_DIMENSIONS:
        dim_info = dimensions.get(dim_key, {})
        is_avail = dim_info.get("available", False)
        norm_score = dim_info.get("normalized_score")
        nominal_w = float(raw_weights.get(dim_key, 0.0))

        if is_avail and norm_score is not None:
            eligible_weights_sum += nominal_w

    if eligible_weights_sum <= 0.0:
        logger.warning("No eligible dimensions with positive weights found for profile '%s'", profile.get("id"))
        return 0.0, 0.0, []

    # 2. Compute effective weights and contributions
    aggregate = 0.0
    for dim_key in ALL_DIMENSIONS:
        dim_info = dimensions.get(dim_key, {})
        is_avail = dim_info.get("available", False)
        norm_score = dim_info.get("normalized_score")
        nominal_w = float(raw_weights.get(dim_key, 0.0))

        if is_avail and norm_score is not None:
            effective_w = nominal_w / eligible_weights_sum
            contribution = effective_w * norm_score
            aggregate += contribution

            breakdown.append({
                "dimension_key": dim_key,
                "dimension_name": DIMENSION_LABELS.get(dim_key, dim_key),
                "available": True,
                "nominal_weight": round(nominal_w, 4),
                "effective_weight": round(effective_w, 4),
                "raw_value": dim_info.get("raw_value"),
                "raw_label": dim_info.get("raw_label"),
                "normalized_score": round(norm_score, 4),
                "weighted_contribution": round(contribution, 4),
            })
        else:
            breakdown.append({
                "dimension_key": dim_key,
                "dimension_name": DIMENSION_LABELS.get(dim_key, dim_key),
                "available": False,
                "nominal_weight": round(nominal_w, 4),
                "effective_weight": 0.0,
                "raw_value": None,
                "raw_label": "Unavailable",
                "normalized_score": None,
                "weighted_contribution": 0.0,
                "reason": dim_info.get("reason", "Model or predictor unavailable"),
            })

    total_dimensions = len(ALL_DIMENSIONS)
    available_dimensions = sum(1 for b in breakdown if b["available"])
    coverage = round(available_dimensions / total_dimensions, 4)

    return round(aggregate, 4), coverage, breakdown


def compute_property_deltas(parent_props: dict, analog_props: dict) -> dict:
    """Computes transparent deltas between parent and analog molecular properties."""
    keys = [
        ("molecular_weight", "MW", "Da", 2),
        ("logp", "LogP", "", 2),
        ("tpsa", "TPSA", "Å²", 2),
        ("rotatable_bonds", "RotB", "", 0),
        ("hbd", "HBD", "", 0),
        ("hba", "HBA", "", 0),
    ]
    deltas = {}
    for key, label, unit, decimals in keys:
        p_val = parent_props.get(key)
        a_val = analog_props.get(key)
        if p_val is not None and a_val is not None:
            try:
                diff = round(float(a_val) - float(p_val), decimals) if decimals > 0 else int(a_val) - int(p_val)
                deltas[key] = {
                    "label": label,
                    "unit": unit,
                    "parent": round(float(p_val), decimals) if decimals > 0 else int(p_val),
                    "analog": round(float(a_val), decimals) if decimals > 0 else int(a_val),
                    "delta": diff,
                }
            except (TypeError, ValueError):
                pass
    return deltas


# ── War Room Evaluation Orchestrator ──────────────────────────────────────────

def evaluate_war_room(
    smiles: str,
    profile_id: str = "anti_inflammatory_exploration_v1",
    top_n: int = 5,
) -> dict:
    """
    Main orchestrator for the Lead Optimization War Room:
    1. Parses & canonicalizes the parent molecule.
    2. Retrieves & validates the selected optimization profile.
    3. Evaluates all 6 dimensions on the parent molecule.
    4. Generates unique chemical analogs via predefined transforms.
    5. Evaluates all 6 dimensions on each analog candidate.
    6. Calculates dynamically renormalized scores, coverage, and hard constraints.
    7. Ranks candidates descending by aggregate score.
    8. Assembles radar chart data and parent-to-analog property deltas.

    Returns structured, explainable, and reproducible response dictionary.
    """
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES string: '{smiles}'")

    canonical_parent = Chem.MolToSmiles(mol, canonical=True)
    profile = get_profile(profile_id)
    target_endpoint = profile["target_endpoint"]

    # 1. Parent properties & dimensions
    parent_props = chemistry_service.calculate_properties(canonical_parent)
    # Enrich with additional Lipinski/Veber properties
    oral_score, oral_params = compute_oral_property_heuristic(mol)
    parent_props.update({
        "rotatable_bonds": oral_params["rotatable_bonds"],
        "hbd": oral_params["hbd"],
        "hba": oral_params["hba"],
        "lipinski_violations": oral_params["lipinski_violations"],
        "veber_violations": oral_params["veber_violations"],
    })

    parent_dims = evaluate_molecule_dimensions(canonical_parent, target_endpoint)
    parent_score, parent_cov, parent_breakdown = calculate_candidate_score(parent_dims, profile)
    parent_passed, parent_violations = evaluate_hard_constraints(
        parent_dims, parent_props, profile.get("hard_constraints", [])
    )

    # 2. Generate analog candidates from transforms
    candidates = []
    seen_smiles = {canonical_parent}

    for transform in TRANSFORMS:
        try:
            prod_smiles = transform.fn(canonical_parent)
        except Exception as e:
            logger.debug("Transform '%s' error: %s", transform.name, e)
            continue

        if not prod_smiles:
            continue

        prod_mol = Chem.MolFromSmiles(prod_smiles)
        if prod_mol is None:
            continue

        can_prod = Chem.MolToSmiles(prod_mol, canonical=True)
        if can_prod in seen_smiles:
            continue
        seen_smiles.add(can_prod)

        # Candidate properties
        try:
            cand_props = chemistry_service.calculate_properties(can_prod)
            _, cand_oral_params = compute_oral_property_heuristic(prod_mol)
            cand_props.update({
                "rotatable_bonds": cand_oral_params["rotatable_bonds"],
                "hbd": cand_oral_params["hbd"],
                "hba": cand_oral_params["hba"],
                "lipinski_violations": cand_oral_params["lipinski_violations"],
                "veber_violations": cand_oral_params["veber_violations"],
            })
        except Exception:
            continue

        # Candidate dimensions
        cand_dims = evaluate_molecule_dimensions(can_prod, target_endpoint)
        score, coverage, breakdown = calculate_candidate_score(cand_dims, profile)
        passed_constraints, violations = evaluate_hard_constraints(
            cand_dims, cand_props, profile.get("hard_constraints", [])
        )
        deltas = compute_property_deltas(parent_props, cand_props)

        candidates.append({
            "transform_name": transform.name,
            "transform_description": transform.description,
            "product_smiles": can_prod,
            "aggregate_score": score,
            "coverage": coverage,
            "constraints_passed": passed_constraints,
            "constraint_violations": violations,
            "properties": cand_props,
            "property_deltas": deltas,
            "dimensions": cand_dims,
            "score_breakdown": breakdown,
        })

    # Sort descending by aggregate score
    candidates.sort(key=lambda c: c["aggregate_score"], reverse=True)

    # Assign sequential ranks to top N
    shortlist = []
    for rank_idx, cand in enumerate(candidates[:top_n], start=1):
        cand["rank"] = rank_idx
        # Build 6-axis radar comparison for parent vs this analog
        radar_data = []
        for dim_key in ALL_DIMENSIONS:
            p_dim = parent_dims.get(dim_key, {})
            a_dim = cand["dimensions"].get(dim_key, {})
            is_avail = p_dim.get("available", False) and a_dim.get("available", False)

            radar_data.append({
                "dimension_key": dim_key,
                "dimension_name": DIMENSION_LABELS.get(dim_key, dim_key),
                "available": is_avail,
                "parent_normalized": p_dim.get("normalized_score") if is_avail else None,
                "analog_normalized": a_dim.get("normalized_score") if is_avail else None,
                "parent_raw": p_dim.get("raw_value"),
                "analog_raw": a_dim.get("raw_value"),
                "reason": a_dim.get("reason") if not is_avail else None,
            })
        cand["radar_data"] = radar_data
        shortlist.append(cand)

    return {
        "parent": {
            "smiles": canonical_parent,
            "properties": parent_props,
            "dimensions": parent_dims,
            "aggregate_score": parent_score,
            "coverage": parent_cov,
            "constraints_passed": parent_passed,
            "constraint_violations": parent_violations,
            "score_breakdown": parent_breakdown,
        },
        "profile": {
            "id": profile["id"],
            "name": profile["name"],
            "version": profile["version"],
            "target_endpoint": profile["target_endpoint"],
            "target_endpoint_name": profile["target_endpoint_name"],
            "description": profile["description"],
            "rationale": profile["rationale"],
            "weights": profile["weights"],
            "hard_constraints": profile["hard_constraints"],
        },
        "shortlist": shortlist,
        "total_evaluated_analogs": len(candidates),
        "disclaimer": SCIENTIFIC_DISCLAIMER,
    }
