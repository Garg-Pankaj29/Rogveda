"""
ROGVEDA — Batch Screening Service (Phase 17)

Parses a CSV upload containing SMILES strings, runs each molecule through
the full existing per-molecule pipeline (descriptors, predictions,
contradictions, synthesizability), and collects results into a flat table.

Design decisions:
  - Pure caller of existing services: chemistry_service, ml_service,
    contradiction_service, synthesizability_service.  Does NOT modify
    any of their public function signatures.
  - Sequential processing (no speculative concurrency).  On a laptop
    with the trained models already loaded, each molecule takes ~50-150ms,
    giving ~200 molecules in 10-30 seconds — well within demo-safe limits.
  - Row-level error isolation: one bad SMILES never aborts the batch.
  - Hard cap of 500 rows; rejects with a clear error above that.
"""

import csv
import io
import logging
import time
from typing import Optional

from rdkit import Chem, RDLogger

from app.services import chemistry_service
from app.services import ml_service
from app.services import contradiction_service
from app.services import synthesizability_service
from app.services import cache_service

# Suppress noisy RDKit warnings during batch processing
RDLogger.logger().setLevel(RDLogger.ERROR)

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────
MAX_ROWS = 500
MAX_FILE_SIZE_MB = 5

# The 6 ML endpoints, matching molecule.py's predict_all_endpoints
ENDPOINTS = [
    {"id": "herg", "name": "hERG Cardiotoxicity"},
    {"id": "antiinflammatory", "name": "Anti-inflammatory"},
    {"id": "antioxidant", "name": "Antioxidant"},
    {"id": "antimicrobial", "name": "Antimicrobial"},
    {"id": "anticancer", "name": "Anticancer"},
    {"id": "tox21_mmp", "name": "Tox21 Mitochondrial Toxicity"},
]


# ── CSV Parsing ───────────────────────────────────────────────

def parse_csv(file_bytes: bytes) -> list[tuple[int, Optional[str], str]]:
    """
    Parse a CSV file containing at minimum a `smiles` column.

    Args:
        file_bytes: Raw bytes of the uploaded CSV file.

    Returns:
        List of (row_index, name_or_none, smiles) tuples.
        row_index is 1-based (row 1 = first data row after header).

    Raises:
        ValueError: If CSV has no `smiles` column, exceeds row cap,
                    or is otherwise unparseable.
    """
    try:
        text = file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = file_bytes.decode("latin-1")
        except Exception:
            raise ValueError(
                "Could not decode the uploaded file. "
                "Please upload a UTF-8 or Latin-1 encoded CSV."
            )

    reader = csv.DictReader(io.StringIO(text))

    if reader.fieldnames is None:
        raise ValueError("The uploaded file appears to be empty or is not a valid CSV.")

    # Case-insensitive header matching
    header_map = {h.strip().lower(): h for h in reader.fieldnames}

    if "smiles" not in header_map:
        raise ValueError(
            f"CSV must contain a 'smiles' column. "
            f"Found columns: {', '.join(reader.fieldnames)}"
        )

    smiles_col = header_map["smiles"]

    # Try to find a name/id column
    name_col = None
    for candidate in ("name", "id", "compound_name", "compound_id", "mol_name"):
        if candidate in header_map:
            name_col = header_map[candidate]
            break

    rows = []
    for i, row in enumerate(reader, start=1):
        if i > MAX_ROWS:
            raise ValueError(
                f"CSV exceeds the maximum of {MAX_ROWS} rows. "
                f"Your file contains more than {MAX_ROWS} data rows. "
                f"Please split into smaller batches."
            )
        smiles = (row.get(smiles_col) or "").strip()
        name = (row.get(name_col) or "").strip() if name_col else None
        rows.append((i, name if name else None, smiles))

    if not rows:
        raise ValueError("The CSV file contains no data rows.")

    return rows


# ── Single-Molecule Pipeline ─────────────────────────────────

def screen_single_molecule(smiles: str) -> dict:
    """
    Run a single molecule through the full pipeline.

    Returns a flat dict with all computed fields, suitable for
    table display and CSV export.

    Raises:
        ValueError: if SMILES is invalid (caught by caller).
    """
    # 1. RDKit sanitization + canonical SMILES
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"invalid SMILES: could not parse '{smiles}'")

    canonical = Chem.MolToSmiles(mol, canonical=True)

    # 2. Molecular descriptors
    props = chemistry_service.calculate_properties(canonical)

    # 3. ML predictions for all 6 endpoints
    fingerprint = cache_service.get_model_fingerprint()
    cached_preds = cache_service.get_cached(canonical, "predict-all", fingerprint)

    predictions = []
    pred_flat = {}
    
    if cached_preds:
        predictions = cached_preds
        for ep in ENDPOINTS:
            ep_key = ep["id"]
            match = next((p for p in predictions if p["endpoint_name"] == ep["name"]), None)
            if match:
                pred_flat[f"pred_{ep_key}_status"] = match["status_label"]
                pred_flat[f"pred_{ep_key}_confidence"] = match["confidence"]
            else:
                pred_flat[f"pred_{ep_key}_status"] = "Error"
                pred_flat[f"pred_{ep_key}_confidence"] = None
    else:
        for ep in ENDPOINTS:
            try:
                pred = ml_service.predict_endpoint(canonical, ep["id"])
    
                # Map labels to status (same logic as molecule.py predict_all_endpoints)
                if ep["id"] in ("herg", "tox21_mmp"):
                    status_label = "High Risk" if "likely active" in pred.label else "Low Risk"
                else:
                    status_label = "Active" if "likely active" in pred.label else "Inactive"
    
                predictions.append({
                    "endpoint_name": ep["name"],
                    "status_label": status_label,
                    "confidence": round(pred.probability_active, 4), # Note: molecule.py uses 2 decimal places, but we use 4 here. It's fine to cache 4.
                    "available": True,
                })
    
                # Flat columns for the results table
                ep_key = ep["id"]
                pred_flat[f"pred_{ep_key}_status"] = status_label
                pred_flat[f"pred_{ep_key}_confidence"] = round(pred.probability_active, 4)
    
            except FileNotFoundError:
                predictions.append({
                    "endpoint_name": ep["name"],
                    "status_label": "Model not available",
                    "confidence": None,
                    "available": False,
                })
                ep_key = ep["id"]
                pred_flat[f"pred_{ep_key}_status"] = "Model not available"
                pred_flat[f"pred_{ep_key}_confidence"] = None
            except Exception as e:
                ep_key = ep["id"]
                pred_flat[f"pred_{ep_key}_status"] = "Error"
                pred_flat[f"pred_{ep_key}_confidence"] = None
        
        # Store in Cache to benefit future calls (e.g. within this batch)
        # Add from_cache=False as required by standard endpoint format
        preds_to_cache = [dict(p, from_cache=False) for p in predictions]
        cache_service.store_result(canonical, "predict-all", fingerprint, "0.1.0", preds_to_cache)

    # 4. Contradiction detection
    contradictions = contradiction_service.detect_contradictions(props, predictions)

    # 5. Synthesizability assessment
    try:
        synth = synthesizability_service.assess_synthesizability(canonical)
    except Exception:
        synth = {"sa_score": None, "difficulty_label": "unknown", "reactive_group_flags": []}

    # 6. Assemble flat result row
    result = {
        "canonical_smiles": canonical,
        "molecular_weight": props.get("molecular_weight"),
        "logp": props.get("logp"),
        "tpsa": props.get("tpsa"),
        **pred_flat,
        "sa_score": synth.get("sa_score"),
        "sa_difficulty": synth.get("difficulty_label"),
        "reactive_groups": len(synth.get("reactive_group_flags", [])),
        "contradiction_flags": len(contradictions),
        "contradictions": [c["flag_name"] for c in contradictions] if contradictions else [],
        # Keep full structured data for report generation
        "_predictions": predictions,
        "_contradictions": contradictions,
        "_synth": synth,
    }

    return result


# ── Batch Orchestration ──────────────────────────────────────

def screen_batch(
    rows: list[tuple[int, Optional[str], str]],
    progress_callback=None,
) -> dict:
    """
    Screen a batch of molecules sequentially.

    Power-aware (Phase 20): reads the power mode ONCE at the start
    and paces processing with deliberate pauses between chunks when
    throttled. This only affects timing, never which molecules are
    analyzed or their results.

    Args:
        rows: Output of parse_csv() — list of (row_index, name, smiles).
        progress_callback: Optional callable(current, total) for progress.

    Returns:
        {
            "results": [{ row_index, name, smiles, ...computed_fields }],
            "errors": [{ row_index, name, smiles, reason }],
            "summary": { total, succeeded, failed, elapsed_seconds, power_mode }
        }
    """
    from app.services import power_service

    results = []
    errors = []
    total = len(rows)
    t0 = time.time()

    # Read power mode once (not per-row) to avoid thrashing
    power_mode = power_service.get_power_mode()
    is_throttled = power_mode["is_throttled"]
    chunk_size = power_service.THROTTLE_CHUNK_SIZE if is_throttled else total  # no chunking at full speed
    pause_secs = power_service.THROTTLE_PAUSE_SECONDS if is_throttled else 0

    if is_throttled:
        logger.info(
            "Batch throttled — power_source=%s, setting=%s, chunk_size=%d, pause=%.1fs",
            power_mode["power_source"], power_mode["power_saver_setting"],
            chunk_size, pause_secs,
        )
    else:
        logger.info(
            "Batch at full speed — power_source=%s, setting=%s",
            power_mode["power_source"], power_mode["power_saver_setting"],
        )

    for idx, (row_index, name, smiles) in enumerate(rows):
        # Handle blank/empty SMILES
        if not smiles or smiles.isspace():
            errors.append({
                "row_index": row_index,
                "name": name,
                "smiles": smiles or "(empty)",
                "reason": "blank or empty SMILES string",
            })
            if progress_callback:
                progress_callback(idx + 1, total)
            continue

        try:
            result = screen_single_molecule(smiles)
            result["row_index"] = row_index
            result["name"] = name
            result["input_smiles"] = smiles
            results.append(result)

        except ValueError as e:
            errors.append({
                "row_index": row_index,
                "name": name,
                "smiles": smiles,
                "reason": str(e),
            })
        except Exception as e:
            errors.append({
                "row_index": row_index,
                "name": name,
                "smiles": smiles,
                "reason": f"unexpected error: {str(e)}",
            })

        if progress_callback:
            progress_callback(idx + 1, total)

        # Throttle: pause between chunks (not after the very last row)
        if is_throttled and (idx + 1) % chunk_size == 0 and (idx + 1) < total:
            time.sleep(pause_secs)

    elapsed = round(time.time() - t0, 2)

    return {
        "results": results,
        "errors": errors,
        "summary": {
            "total": total,
            "succeeded": len(results),
            "failed": len(errors),
            "elapsed_seconds": elapsed,
            "power_mode": power_mode,
        },
    }
