"""
ROGVEDA — Cache Service (Phase 19)

Manages caching for heavy analysis endpoints (predict-all, ai-summary).
Uses a SQLite table for local caching, keyed by canonical SMILES and 
a composite model version fingerprint to ensure stale predictions are never served.
"""

import json
import logging
import hashlib
from functools import lru_cache
from typing import Optional, Dict, Any

from app.db.database import SessionLocal
from app.db.models import AnalysisCache
from app.services import ml_service

logger = logging.getLogger(__name__)

# The 6 ML endpoints used for the composite model fingerprint
ENDPOINTS = ["herg", "antiinflammatory", "antioxidant", "antimicrobial", "anticancer", "tox21_mmp"]

@lru_cache(maxsize=1)
def get_model_fingerprint() -> str:
    """
    Generate a composite fingerprint of all loaded ML models.
    This ensures that if ANY model is updated, the entire cache is safely invalidated.
    """
    versions = []
    for ep in ENDPOINTS:
        try:
            info = ml_service.get_model_info(ep)
            v = info.get("version", 0)
        except Exception:
            v = 0
        versions.append(f"{ep}:{v}")
    
    # Sort to ensure deterministic string regardless of order
    versions.sort()
    composite_string = "|".join(versions)
    return hashlib.md5(composite_string.encode()).hexdigest()


def get_cached(canonical_smiles: str, endpoint: str, model_version: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve a cached result if the SMILES and model_version match exactly.
    """
    with SessionLocal() as db:
        record = db.query(AnalysisCache).filter(
            AnalysisCache.canonical_smiles == canonical_smiles,
            AnalysisCache.endpoint == endpoint,
            AnalysisCache.model_version == model_version
        ).first()
        
        if record:
            try:
                return json.loads(record.result_json)
            except json.JSONDecodeError:
                logger.error("Failed to decode cached JSON for %s:%s", endpoint, canonical_smiles)
                return None
    return None


def store_result(canonical_smiles: str, endpoint: str, model_version: str, rogveda_version: str, result_json: Dict[str, Any]) -> None:
    """
    Upsert a cached result for the given SMILES + endpoint.
    If the SMILES+endpoint already exists, it is overwritten.
    """
    json_str = json.dumps(result_json)
    
    with SessionLocal() as db:
        # Check if exists to do an upsert
        record = db.query(AnalysisCache).filter(
            AnalysisCache.canonical_smiles == canonical_smiles,
            AnalysisCache.endpoint == endpoint
        ).first()
        
        if record:
            record.model_version = model_version
            record.rogveda_version = rogveda_version
            record.result_json = json_str
            # created_at is not updated so we keep the original creation time
        else:
            record = AnalysisCache(
                canonical_smiles=canonical_smiles,
                endpoint=endpoint,
                model_version=model_version,
                rogveda_version=rogveda_version,
                result_json=json_str
            )
            db.add(record)
        
        db.commit()


def clear_cache() -> int:
    """
    Clear all cached analysis results. Returns the number of deleted rows.
    """
    with SessionLocal() as db:
        count = db.query(AnalysisCache).delete()
        db.commit()
        return count


def get_cache_stats() -> Dict[str, Any]:
    """
    Return statistics about the cache.
    """
    with SessionLocal() as db:
        predict_count = db.query(AnalysisCache).filter(AnalysisCache.endpoint == "predict-all").count()
        ai_count = db.query(AnalysisCache).filter(AnalysisCache.endpoint == "ai-summary").count()
        
        return {
            "predict_all_entries": predict_count,
            "ai_summary_entries": ai_count,
            "total_entries": predict_count + ai_count
        }
