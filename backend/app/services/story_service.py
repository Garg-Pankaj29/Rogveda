"""
ROGVEDA — Story Service (Phase 10)

Walks a parent_experiment_id chain, computes deltas between consecutive
experiments, and narrates the modification journey via a local LLM.
"""

import json
import logging
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.config import LLM_ENDPOINT
from app.db.models import Experiment

logger = logging.getLogger(__name__)

# Path to the story prompt template
_TEMPLATE_PATH = Path(__file__).resolve().parents[2] / "llm" / "prompts" / "story_template.txt"


# ── Deterministic delta computation ──────────────────────────────────────

# Properties to diff (keys as stored in properties_json)
_PROPERTY_KEYS = [
    ("mw", "Molecular Weight (g/mol)"),
    ("logP", "LogP"),
    ("tpsa", "TPSA (Å²)"),
    ("hbd", "H-Bond Donors"),
    ("hba", "H-Bond Acceptors"),
    ("rotBonds", "Rotatable Bonds"),
    ("aromaticRings", "Aromatic Rings"),
    ("heavyAtoms", "Heavy Atoms"),
]


def _safe_float(val: Any) -> float | None:
    """Try to parse a value as float, return None on failure."""
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _parse_json_field(raw: str | None) -> dict | list:
    """Safely parse a JSON string, returning {} or [] on failure."""
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {}


def _compute_property_deltas(prev_props: dict, curr_props: dict) -> list[dict]:
    """Compute numeric deltas for known property keys."""
    deltas = []
    for key, label in _PROPERTY_KEYS:
        prev_val = _safe_float(prev_props.get(key))
        curr_val = _safe_float(curr_props.get(key))
        if prev_val is not None and curr_val is not None:
            delta = round(curr_val - prev_val, 4)
            if delta != 0:
                deltas.append({
                    "property": label,
                    "key": key,
                    "prev": round(prev_val, 4),
                    "curr": round(curr_val, 4),
                    "delta": delta,
                    "direction": "increased" if delta > 0 else "decreased",
                })
    return deltas


def _compute_prediction_deltas(prev_preds: list, curr_preds: list) -> list[dict]:
    """Compute label/confidence changes between prediction lists."""
    # Index predictions by endpoint_name for fast lookup
    prev_map = {}
    for p in prev_preds:
        name = p.get("endpoint_name", "")
        if name:
            prev_map[name] = p

    deltas = []
    for cp in curr_preds:
        name = cp.get("endpoint_name", "")
        if not name or not cp.get("available"):
            continue
        pp = prev_map.get(name)
        if not pp or not pp.get("available"):
            continue

        prev_label = pp.get("status_label", "")
        curr_label = cp.get("status_label", "")
        prev_conf = _safe_float(pp.get("confidence"))
        curr_conf = _safe_float(cp.get("confidence"))

        label_changed = prev_label != curr_label
        conf_delta = None
        if prev_conf is not None and curr_conf is not None:
            conf_delta = round(curr_conf - prev_conf, 4)

        if label_changed or (conf_delta is not None and conf_delta != 0):
            deltas.append({
                "endpoint": name,
                "prev_label": prev_label,
                "curr_label": curr_label,
                "label_changed": label_changed,
                "prev_confidence": round(prev_conf, 2) if prev_conf is not None else None,
                "curr_confidence": round(curr_conf, 2) if curr_conf is not None else None,
                "confidence_delta": conf_delta,
            })
    return deltas


def _walk_chain(final_id: int, db: Session) -> list[Experiment]:
    """
    Walk parent_experiment_id chain backwards from final_id to root.
    Returns list in chronological order [root, ..., final].
    Guards against infinite loops (max 100 hops).
    """
    chain = []
    visited = set()
    current_id = final_id
    max_hops = 100

    while current_id is not None and len(chain) < max_hops:
        if current_id in visited:
            logger.warning(f"Circular chain detected at experiment id={current_id}")
            break
        visited.add(current_id)

        exp = db.query(Experiment).filter(Experiment.id == current_id).first()
        if exp is None:
            logger.warning(f"Broken chain: experiment id={current_id} not found")
            break
        chain.append(exp)
        current_id = exp.parent_experiment_id

    chain.reverse()  # chronological: root first
    return chain


def build_story(final_experiment_id: int, db: Session) -> dict:
    """
    Build the deterministic story data for a modification chain.

    Returns:
        {
            "chain_length": int,
            "steps": [
                {
                    "step_index": 0,  # 0 = original
                    "experiment_db_id": int,
                    "experiment_name": str,
                    "smiles": str,
                    "properties": dict,
                    "predictions": list,
                    "property_deltas": list,   # empty for step 0
                    "prediction_deltas": list,  # empty for step 0
                },
                ...
            ]
        }
    """
    chain = _walk_chain(final_experiment_id, db)

    steps = []
    for i, exp in enumerate(chain):
        props = _parse_json_field(exp.properties_json)
        preds_raw = _parse_json_field(exp.predictions_json)
        preds = preds_raw if isinstance(preds_raw, list) else []

        smiles = exp.modified_smiles or exp.original_smiles or ""

        step = {
            "step_index": i,
            "experiment_db_id": exp.id,
            "experiment_name": exp.name or f"Step {i}",
            "smiles": smiles,
            "properties": props,
            "predictions": preds,
            "property_deltas": [],
            "prediction_deltas": [],
        }

        if i > 0:
            prev_props = _parse_json_field(chain[i - 1].properties_json)
            prev_preds_raw = _parse_json_field(chain[i - 1].predictions_json)
            prev_preds = prev_preds_raw if isinstance(prev_preds_raw, list) else []

            step["property_deltas"] = _compute_property_deltas(prev_props, props)
            step["prediction_deltas"] = _compute_prediction_deltas(prev_preds, preds)

        steps.append(step)

    return {
        "chain_length": len(chain),
        "steps": steps,
    }


# ── LLM narration ────────────────────────────────────────────────────────

def _load_template() -> str:
    """Load the story prompt template from disk."""
    try:
        return _TEMPLATE_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        logger.error(f"Story template not found at {_TEMPLATE_PATH}")
        return ""


def _format_steps_for_prompt(steps: list[dict]) -> str:
    """Format step data into a human-readable block for the LLM prompt."""
    lines = []
    for step in steps:
        idx = step["step_index"]
        name = step["experiment_name"]
        smiles = step["smiles"]

        if idx == 0:
            lines.append(f"Step {idx} (Original): {name}")
            lines.append(f"  SMILES: {smiles}")
            props = step.get("properties", {})
            for key, label in _PROPERTY_KEYS:
                val = props.get(key)
                if val is not None:
                    lines.append(f"  {label}: {val}")
        else:
            lines.append(f"\nStep {idx} (Modification {idx}): {name}")
            lines.append(f"  SMILES: {smiles}")

            prop_deltas = step.get("property_deltas", [])
            if prop_deltas:
                lines.append("  Property Changes:")
                for d in prop_deltas:
                    lines.append(
                        f"    - {d['property']}: {d['prev']} → {d['curr']} "
                        f"({d['direction']} by {abs(d['delta'])})"
                    )
            else:
                lines.append("  Property Changes: none")

            pred_deltas = step.get("prediction_deltas", [])
            if pred_deltas:
                lines.append("  Prediction Changes:")
                for d in pred_deltas:
                    parts = [f"    - {d['endpoint']}:"]
                    if d["label_changed"]:
                        parts.append(f"{d['prev_label']} → {d['curr_label']}")
                    if d["confidence_delta"] is not None and d["confidence_delta"] != 0:
                        direction = "+" if d["confidence_delta"] > 0 else ""
                        parts.append(f"(confidence {direction}{d['confidence_delta']})")
                    lines.append(" ".join(parts))
            else:
                lines.append("  Prediction Changes: none")

    return "\n".join(lines)


def narrate_story(steps: list[dict]) -> str:
    """
    Use the local LLM to narrate the modification story.
    Falls back to a structured summary if the LLM is unavailable.
    """
    template = _load_template()
    if not template:
        return _fallback_narration(steps)

    steps_text = _format_steps_for_prompt(steps)
    prompt = template.replace("{{STEPS}}", steps_text)

    payload = {
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a medicinal chemistry assistant. Narrate molecular "
                    "modification stories concisely and accurately. Reference ONLY "
                    "the provided data — do NOT invent any numbers or properties."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 800,
    }

    try:
        url = f"{LLM_ENDPOINT.rstrip('/')}/chat/completions"
        with httpx.Client(timeout=300.0) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()

            if "choices" in data and len(data["choices"]) > 0:
                return data["choices"][0]["message"]["content"].strip()
            else:
                return _fallback_narration(steps)
    except httpx.ConnectError:
        return _fallback_narration(steps)
    except Exception as e:
        logger.error(f"Story narration LLM error: {e}")
        return _fallback_narration(steps)


def _fallback_narration(steps: list[dict]) -> str:
    """Generate a structured text summary when the LLM is unavailable."""
    if len(steps) < 2:
        return "No modification chain to narrate."

    parts = [f"Modification story ({len(steps)} steps):"]
    original = steps[0]
    parts.append(f"\nOriginal molecule: {original['smiles']}")

    for step in steps[1:]:
        idx = step["step_index"]
        parts.append(f"\n→ Modification {idx} ({step['experiment_name']}):")
        parts.append(f"  New SMILES: {step['smiles']}")

        for d in step.get("property_deltas", []):
            parts.append(
                f"  • {d['property']} {d['direction']} by {abs(d['delta'])} "
                f"({d['prev']} → {d['curr']})"
            )

        for d in step.get("prediction_deltas", []):
            if d["label_changed"]:
                parts.append(
                    f"  • {d['endpoint']}: {d['prev_label']} → {d['curr_label']}"
                )
            elif d.get("confidence_delta"):
                direction = "+" if d["confidence_delta"] > 0 else ""
                parts.append(
                    f"  • {d['endpoint']} confidence: {direction}{d['confidence_delta']}"
                )

    return "\n".join(parts)
