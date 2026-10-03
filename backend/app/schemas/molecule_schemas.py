"""
ROGVEDA — Pydantic request/response schemas for molecule API
"""

from typing import Optional
from pydantic import BaseModel, Field


# ── Requests ───────────────────────────────────────────

class SmilesRequest(BaseModel):
    smiles: str = Field(..., description="SMILES string of the molecule")


class InsightRequest(BaseModel):
    smiles: str = Field(..., description="SMILES string of the molecule")


class SimilarityRequest(BaseModel):
    smiles: str = Field(..., description="SMILES string of the query molecule")
    metric: str = Field("tanimoto_ecfp4", description="Similarity metric to use (e.g., tanimoto_ecfp4, tanimoto_ecfp6, dice_ecfp4, tanimoto_maccs)")
    threshold: float = Field(0.0, ge=0.0, le=1.0, description="Minimum similarity threshold")
    top_n: int = Field(50, ge=1, le=200, description="Maximum number of results to return")


class PredictionRequest(BaseModel):
    smiles: str = Field(..., description="SMILES string of the molecule to predict")


# ── Responses ──────────────────────────────────────────

class PredictionResponse(BaseModel):
    canonical_smiles: str
    probability_active: float
    label: str
    confidence: str
    threshold_used: float
    model_version: int

    model_config = {"from_attributes": True}


class Conformer3DResponse(BaseModel):
    sdf_block: str
    canonical_smiles: str


class SimilarityHitResponse(BaseModel):
    name: str
    canonical_smiles: str
    tanimoto: float
    svg: Optional[str] = None


class SimilarityResponse(BaseModel):
    query_smiles: str
    hits: list[SimilarityHitResponse]


class InsightResponse(BaseModel):
    insight: str

