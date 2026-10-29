"""
ROGVEDA — Research Dossier Schemas (Phase 3)

Pydantic schemas for reproducible research dossier generation,
encompassing 12 structured scientific sections:
1. Title & metadata
2. Executive summary (LLM or deterministic fallback)
3. Canonical 2D structure
4. 3D conformer geometry & status
5. Physicochemical properties & drug-likeness rules
6. Calibrated ML predictions with model provenance
7. Lead Optimization War Room trade-offs & optimization profile
8. Explainable molecular attribution (atomic sensitivities & collisions)
9. Structural alerts (PAINS/Brenk) & synthetic accessibility
10. Curated similarity search results
11. Experiment lineage & audit provenance
12. Evidence & regulatory disclaimers
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DossierConformerData(BaseModel):
    has_conformer: bool = False
    status_label: str = "Not generated"
    method: str = "ETKDGv3 / MMFF94 force field"
    atom_count: Optional[Any] = None
    sdf_block: Optional[str] = None
    disclaimer: str = (
        "In-silico generated 3D conformer (ETKDGv3 with MMFF94 force field optimization). "
        "This is a computational estimate, NOT an experimentally determined crystal or Cryo-EM structure."
    )


class DossierAttributionData(BaseModel):
    is_available: bool = False
    endpoint_name: Optional[str] = None
    method_name: Optional[str] = None
    method_limitations: Optional[str] = None
    top_positive_atoms: List[Dict[str, Any]] = Field(default_factory=list)
    top_negative_atoms: List[Dict[str, Any]] = Field(default_factory=list)
    has_collisions: bool = False
    colliding_atom_count: int = 0
    highlighted_svg: Optional[str] = None


class DossierWarRoomData(BaseModel):
    is_available: bool = False
    profile_id: Optional[str] = None
    profile_name: Optional[str] = None
    profile_version: Optional[str] = "v1"
    target_endpoint: Optional[str] = None
    description: Optional[str] = None
    parent_smiles: Optional[str] = None
    candidate_smiles: Optional[str] = None
    candidate_name: Optional[str] = None
    candidate_score: Optional[Any] = None
    hard_constraints_passed: bool = True
    hard_constraint_flags: List[str] = Field(default_factory=list)
    dimensions: Any = Field(default_factory=list)
    property_deltas: Any = Field(default_factory=dict)


class DossierLineageData(BaseModel):
    experiment_id: Optional[str] = None
    parent_experiment_id: Optional[str] = None
    modification_chain: List[str] = Field(default_factory=list)
    transform_name: Optional[str] = None
    created_at: Optional[str] = None
    user_notes: Optional[str] = None


class DossierGenerateRequest(BaseModel):
    smiles: Optional[str] = None
    canonical_smiles: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None
    predictions: Optional[List[Dict[str, Any]]] = None
    ai_summary: Optional[Dict[str, Any]] = None
    similarity_hits: Optional[List[Dict[str, Any]]] = None
    drug_likeness: Optional[Dict[str, Any]] = None
    activity_log: Optional[List[Dict[str, Any]]] = None
    molecule_svg: Optional[str] = None
    conformer_3d: Optional[DossierConformerData] = None
    attribution: Optional[DossierAttributionData] = None
    war_room: Optional[DossierWarRoomData] = None
    lineage: Optional[DossierLineageData] = None
    structural_alerts: Optional[List[Dict[str, Any]]] = None
    synthesizability: Optional[Dict[str, Any]] = None
    report_format: str = "Research Dossier (PDF)"


class DossierGenerateResponse(BaseModel):
    dossier_id: str
    name: str
    html: str
    pdf_available: bool = True
    created_at: str
