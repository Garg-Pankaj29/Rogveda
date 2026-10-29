"""
ROGVEDA — Mutation Schemas (Phase 4)

Pydantic schemas for live molecular mutation workbench:
- Transform catalog definitions
- Applicability inspection across all 12 transforms
- Mutation execution, property deltas, and candidate predictions
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TransformCatalogItem(BaseModel):
    id: str
    name: str
    description: str
    category: str
    target_group: str
    rxn_smarts: str


class TransformCatalogResponse(BaseModel):
    total_transforms: int
    transforms: List[TransformCatalogItem]


class ApplicableRequest(BaseModel):
    smiles: str = Field(..., description="SMILES string of the parent molecule")


class TransformApplicabilityItem(BaseModel):
    id: str
    name: str
    description: str
    category: str
    target_group: str
    is_applicable: bool
    applicable: Optional[bool] = None
    match_count: int
    substructure_matches: Optional[int] = None
    unavailability_reason: Optional[str] = None
    preview_smiles: Optional[str] = None
    has_multiple_products: bool = False
    product_variants_count: Optional[int] = None
    variants: List[str] = Field(default_factory=list)


class ApplicableResponse(BaseModel):
    parent_smiles: str
    smiles: Optional[str] = None
    total_transforms: int
    applicable_count: int
    num_applicable: Optional[int] = None
    num_unavailable: Optional[int] = None
    transforms: List[TransformApplicabilityItem]


class MutateRequest(BaseModel):
    smiles: str = Field(..., description="SMILES string of the parent molecule")
    transform_id: str = Field(..., description="Identifier or exact name of the transform to apply")
    variant_index: int = Field(0, ge=0, description="Index of product variant if multiple isomers exist")


class PropertyDeltaItem(BaseModel):
    label: Optional[str] = None
    parent: Any
    parent_val: Optional[Any] = None
    candidate: Any
    candidate_val: Optional[Any] = None
    delta: Any
    unit: Optional[str] = None


class EndpointPrediction(BaseModel):
    endpoint_id: str
    endpoint_name: str
    category: Optional[str] = None
    status_label: str
    confidence: Optional[float] = None
    probability: Optional[float] = None
    available: bool = True
    threshold: Optional[float] = None


class MutateResponse(BaseModel):
    parent_smiles: str
    candidate_smiles: str
    candidate_formula: Optional[str] = None
    transform_id: str
    transform_name: str
    transform_description: str
    category: str
    match_count: int
    has_multiple_products: bool
    variant_index: int
    selected_variant_index: Optional[int] = None
    total_variants: int
    variants: List[str]
    parent_properties: Dict[str, Any]
    candidate_properties: Dict[str, Any]
    property_deltas: Dict[str, PropertyDeltaItem]
    property_deltas_list: Optional[List[PropertyDeltaItem]] = None
    parent_predictions: List[EndpointPrediction]
    candidate_predictions: List[EndpointPrediction]
    predictions: Optional[List[EndpointPrediction]] = None
    timing_ms: Optional[float] = None
    is_distinct: bool

