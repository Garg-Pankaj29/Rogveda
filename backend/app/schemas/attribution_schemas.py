"""
ROGVEDA — Explainable Molecular Attribution Schemas
Data contracts for model feature attribution, atom/bond scores, and structural alerts.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class AttributionRequest(BaseModel):
    smiles: str = Field(..., description="SMILES string of the molecule to explain")
    endpoint: str = Field(..., description="Prediction endpoint ID (e.g., herg, antiinflammatory, tox21_mmp)")


class AtomAttribution(BaseModel):
    atom_index: int = Field(..., description="0-indexed atom index in the canonical molecule")
    atom_symbol: str = Field(..., description="Chemical element symbol (e.g., C, O, N)")
    raw_contribution: float = Field(..., description="Unscaled marginal probability delta: P(mol) - P(mol \\ atom)")
    normalized_intensity: float = Field(..., description="Contribution scaled to [-1.0, 1.0] by maximum absolute weight")
    direction: str = Field(..., description="'positive' (increases probability), 'negative' (decreases probability), or 'neutral'")
    bit_count: int = Field(..., description="Number of Morgan fingerprint bits overlapping this atom's environment")
    bit_ids: List[int] = Field(default_factory=list, description="IDs of overlapping active fingerprint bits")
    has_collision: bool = Field(False, description="True if any overlapping bit also maps to other disjoint atom environments")


class BondAttribution(BaseModel):
    bond_index: int = Field(..., description="0-indexed bond index in the canonical molecule")
    begin_atom_index: int = Field(..., description="Start atom index")
    end_atom_index: int = Field(..., description="End atom index")
    raw_contribution: float = Field(..., description="Averaged marginal probability contribution of connected atoms")
    normalized_intensity: float = Field(..., description="Normalized intensity in [-1.0, 1.0]")
    direction: str = Field(..., description="'positive', 'negative', or 'neutral'")


class StructuralAlertMatch(BaseModel):
    rule_set: str = Field(..., description="Catalog name: PAINS, BRENK, or NIH")
    alert_name: str = Field(..., description="Descriptive identifier of the matched chemical motif")
    matched_atoms: List[int] = Field(default_factory=list, description="Atom indices matching the alert pattern")
    description: str = Field(..., description="Human-readable description of the structural alert")


class AttributionResponse(BaseModel):
    canonical_smiles: str
    endpoint: str
    endpoint_name: str
    is_available: bool = True
    unavailability_reason: Optional[str] = None
    
    # Prediction context
    probability: Optional[float] = None
    threshold: Optional[float] = None
    label: Optional[str] = None
    confidence: Optional[str] = None
    model_name: Optional[str] = None
    model_version: Optional[int] = None
    
    # Method provenance & scientific honesty
    attribution_method: str = "Morgan Fingerprint Atomic Environment Perturbation (SimilarityMaps)"
    method_limitations: str = (
        "Attribution scores reflect in-silico sensitivity when fingerprint bits overlapping each atom's "
        "2-bond topological neighborhood are masked. They indicate statistical model associations, "
        "not experimentally validated pharmacophores, toxicophores, or causal biological mechanisms."
    )
    
    # Granular attributions
    atom_attributions: List[AtomAttribution] = Field(default_factory=list)
    bond_attributions: List[BondAttribution] = Field(default_factory=list)
    structural_alerts: List[StructuralAlertMatch] = Field(default_factory=list)
    
    # Depiction
    highlighted_svg: Optional[str] = None
    summary_text: Optional[str] = None
