"""
ROGVEDA — Benchmark Drug Schemas

Pydantic schemas for the curated Benchmark Drug Gallery.
Represents documented historical evidence, provenance, applicable endpoints,
and model alignment metadata without hard-coding computational outcomes.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class BenchmarkProvenanceSource(BaseModel):
    source_type: str = Field(..., description="e.g. 'Regulatory Approval / FDA', 'DrugBank', 'ChEMBL', 'Primary Literature'")
    identifier: str = Field(..., description="Accession / citation ID, e.g. 'NDA 018949', 'DB00342', 'CHEMBL655', 'Roy et al. 1996'")
    citation_title: str = Field(..., description="Full reference citation or registry title")
    url_or_ref: Optional[str] = Field(None, description="Offline citation reference or standard URI format")
    retrieval_date: str = Field(..., description="Date of verification / retrieval e.g. '2026-10'")


class BenchmarkCaseStudyInfo(BaseModel):
    pair_benchmark_id: Optional[str] = None
    pair_compound_name: Optional[str] = None
    study_title: str
    study_focus: str
    educational_summary: str


class BenchmarkSummaryItem(BaseModel):
    id: str
    name: str
    canonical_smiles: str
    formula: str
    molecular_weight: float
    category: str
    case_study_title: str
    primary_endpoint_id: str
    primary_endpoint_name: str
    historical_status_badge: str


class BenchmarkCompoundDetail(BaseModel):
    id: str
    name: str
    canonical_smiles: str
    formula: str
    molecular_weight: float
    exact_mass: float
    category: str
    description: str

    # Case study linkages
    case_study: BenchmarkCaseStudyInfo

    # Historical facts (STRICTLY distinct from ML predictions)
    historical_context: str
    regulatory_status: str
    clinical_outcome: str
    mechanism_of_action: str
    expected_reference_outcome: str

    # Endpoints & Scientific Boundaries
    applicable_endpoints: List[str]
    unsupported_endpoints: List[str]
    domain_applicability_note: str

    # Provenance & Citations
    provenance_sources: List[BenchmarkProvenanceSource]
    attribution_license: str

    # Alignment Guide (explains expected concordance or known 2D QSAR limitations)
    alignment_guide: Dict[str, Any] = Field(default_factory=dict)


class BenchmarkCatalogResponse(BaseModel):
    total_benchmarks: int
    categories: List[str]
    case_studies: List[Dict[str, Any]]
    benchmarks: List[BenchmarkSummaryItem]


class BenchmarkIdentifyRequest(BaseModel):
    smiles: str


class BenchmarkIdentifyResponse(BaseModel):
    is_benchmark: bool
    benchmark: Optional[BenchmarkCompoundDetail] = None

