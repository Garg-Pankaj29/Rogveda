"""
ROGVEDA — Contradiction Detection Service

Hardcoded rule table that flags potentially problematic combinations
of computed molecular properties and ML prediction results.

Each rule returns a dict with:
  - flag_name: machine-readable identifier
  - explanation_facts: dict of the specific values that triggered the flag
"""

from typing import Any


def _get_prediction(predictions: Any, endpoint_keyword: str) -> dict | None:
    """
    Look up a prediction entry by keyword match on endpoint_name.
    `predictions` can be a list of dicts (from /ai-summary) or a dict
    keyed by endpoint id.
    """
    if isinstance(predictions, list):
        for p in predictions:
            name = p.get("endpoint_name", "").lower()
            if endpoint_keyword in name:
                return p
        return None
    elif isinstance(predictions, dict):
        # dict keyed by endpoint id, e.g. {"herg": {...}, "antiinflammatory": {...}}
        for key, val in predictions.items():
            if endpoint_keyword in key.lower():
                return val if isinstance(val, dict) else {"status_label": str(val)}
        return None
    return None


def detect_contradictions(properties: dict, predictions: Any) -> list[dict]:
    """
    Scan properties + predictions for known tradeoff patterns.

    Args:
        properties: dict with keys like 'logP'/'logp', 'tpsa'/'TPSA', etc.
        predictions: list[dict] with 'endpoint_name', 'status_label',
                     'confidence', 'available' — or dict keyed by endpoint id.

    Returns:
        List of {flag_name: str, explanation_facts: dict}.
        Empty list means no contradictions detected.
    """
    flags: list[dict] = []

    # ── Rule 1: Efficacy vs Cardiotoxicity Tradeoff ────────────────────
    # IF anti-inflammatory == likely active (confidence > 0.6)
    # AND hERG == high risk
    anti_inf = _get_prediction(predictions, "anti-inflammatory") or \
               _get_prediction(predictions, "antiinflammatory")
    herg = _get_prediction(predictions, "herg") or \
           _get_prediction(predictions, "cardiotox")

    if anti_inf and herg:
        anti_inf_status = str(anti_inf.get("status_label", "")).lower()
        anti_inf_conf = anti_inf.get("confidence")
        herg_status = str(herg.get("status_label", "")).lower()

        anti_inf_active = "active" in anti_inf_status and anti_inf_status != "inactive"
        herg_risky = "high" in herg_status and "risk" in herg_status

        if anti_inf_active and anti_inf_conf is not None and float(anti_inf_conf) > 0.6 and herg_risky:
            flags.append({
                "flag_name": "efficacy_vs_cardiotoxicity_tradeoff",
                "explanation_facts": {
                    "anti_inflammatory_status": anti_inf.get("status_label"),
                    "anti_inflammatory_confidence": anti_inf_conf,
                    "herg_status": herg.get("status_label"),
                    "herg_confidence": herg.get("confidence"),
                    "explanation": (
                        "This molecule is predicted to be anti-inflammatory "
                        "but also shows high hERG cardiotoxicity risk. "
                        "This efficacy-vs-safety tradeoff is a common challenge "
                        "in drug development and warrants careful evaluation."
                    ),
                },
            })

    # ── Rule 2: High Lipophilicity + Low Polarity → Solubility Risk ────
    # IF logP > 3 AND TPSA < 40
    logp = properties.get("logP") or properties.get("logp")
    tpsa = properties.get("tpsa") or properties.get("TPSA")

    if logp is not None and tpsa is not None:
        try:
            logp_val = float(logp)
            tpsa_val = float(tpsa)
        except (TypeError, ValueError):
            logp_val = None
            tpsa_val = None

        if logp_val is not None and tpsa_val is not None:
            if logp_val > 3 and tpsa_val < 40:
                flags.append({
                    "flag_name": "high_lipophilicity_low_polarity_solubility_risk",
                    "explanation_facts": {
                        "logP": logp_val,
                        "tpsa": tpsa_val,
                        "explanation": (
                            f"LogP of {logp_val} (>3) combined with TPSA of "
                            f"{tpsa_val} Å² (<40) suggests this molecule may "
                            "have poor aqueous solubility and limited oral "
                            "bioavailability. Consider structural modifications "
                            "to improve polarity."
                        ),
                    },
                })

    return flags
