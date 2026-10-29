"""
ROGVEDA — Benchmark Drug API Router

Endpoints for retrieving the curated Benchmark Drug Gallery catalog,
paired case studies, and matching active workspace structures against
historical benchmark records.
"""

from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException

from app.schemas.benchmark_schemas import (
    BenchmarkCatalogResponse,
    BenchmarkCompoundDetail,
    BenchmarkIdentifyRequest,
    BenchmarkIdentifyResponse,
    BenchmarkSummaryItem,
)
from app.services import benchmark_service

router = APIRouter(prefix="/api/benchmarks", tags=["benchmarks"])


@router.get("", response_model=BenchmarkCatalogResponse)
def get_benchmarks_catalog() -> BenchmarkCatalogResponse:
    """
    Return the full curated benchmark drug gallery catalog.
    Includes summaries for selector controls and paired case studies.
    """
    summaries = benchmark_service.get_benchmark_catalog()
    case_studies = benchmark_service.get_benchmark_case_studies()
    categories = sorted(list(set(b.category for b in summaries)))

    return BenchmarkCatalogResponse(
        total_benchmarks=len(summaries),
        categories=categories,
        case_studies=case_studies,
        benchmarks=summaries,
    )


@router.get("/case-studies", response_model=List[Dict[str, Any]])
def get_case_studies() -> List[Dict[str, Any]]:
    """Return paired case studies for comparative workflows."""
    return benchmark_service.get_benchmark_case_studies()


@router.get("/{benchmark_id}", response_model=BenchmarkCompoundDetail)
def get_benchmark_detail(benchmark_id: str) -> BenchmarkCompoundDetail:
    """Return complete benchmark compound details and provenance by ID."""
    detail = benchmark_service.get_benchmark_by_id(benchmark_id)
    if detail is None:
        raise HTTPException(
            status_code=404,
            detail=f"Benchmark compound '{benchmark_id}' not found in curated catalog.",
        )
    return detail


@router.post("/identify", response_model=BenchmarkIdentifyResponse)
def identify_benchmark(payload: BenchmarkIdentifyRequest) -> BenchmarkIdentifyResponse:
    """
    Check if a given molecular SMILES matches any curated benchmark drug.
    Uses canonical RDKit SMILES matching for atom-order invariance.
    """
    match = benchmark_service.find_benchmark_by_smiles(payload.smiles)
    if match:
        return BenchmarkIdentifyResponse(is_benchmark=True, benchmark=match)
    return BenchmarkIdentifyResponse(is_benchmark=False, benchmark=None)

