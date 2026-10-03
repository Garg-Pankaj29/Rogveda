import pytest
from rdkit import Chem

from app.services import cache_service
from app.db.models import AnalysisCache
from app.db.database import SessionLocal

def test_cache_store_and_retrieve():
    # Setup
    cache_service.clear_cache()
    
    canonical = "CC(=O)Oc1ccccc1C(=O)O"
    endpoint = "predict-all"
    fingerprint = "fake_fingerprint_v1"
    version = "0.1.0"
    data = [{"endpoint_name": "test", "status_label": "Active", "confidence": 0.9}]
    
    # Empty initially
    assert cache_service.get_cached(canonical, endpoint, fingerprint) is None
    
    # Store
    cache_service.store_result(canonical, endpoint, fingerprint, version, data)
    
    # Retrieve hit
    cached = cache_service.get_cached(canonical, endpoint, fingerprint)
    assert cached is not None
    assert len(cached) == 1
    assert cached[0]["endpoint_name"] == "test"
    
    # Retrieve miss (wrong model version)
    assert cache_service.get_cached(canonical, endpoint, "fake_fingerprint_v2") is None
    
    # Upsert (overwrite)
    new_data = [{"endpoint_name": "test", "status_label": "Inactive", "confidence": 0.1}]
    cache_service.store_result(canonical, endpoint, fingerprint, version, new_data)
    
    cached_again = cache_service.get_cached(canonical, endpoint, fingerprint)
    assert cached_again[0]["status_label"] == "Inactive"
    
    # Stats
    stats = cache_service.get_cache_stats()
    assert stats["predict_all_entries"] == 1
    assert stats["total_entries"] == 1

def test_cache_clear():
    cache_service.clear_cache()
    canonical = "C"
    cache_service.store_result(canonical, "ai-summary", "fp1", "0.1.0", {"summary": "test"})
    
    assert cache_service.get_cache_stats()["total_entries"] == 1
    
    cleared = cache_service.clear_cache()
    assert cleared == 1
    assert cache_service.get_cache_stats()["total_entries"] == 0

def test_model_fingerprint_is_deterministic():
    fp1 = cache_service.get_model_fingerprint()
    fp2 = cache_service.get_model_fingerprint()
    assert fp1 == fp2
    assert len(fp1) > 0
