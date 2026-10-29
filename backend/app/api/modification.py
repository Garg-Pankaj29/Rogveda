"""
ROGVEDA — Modification API Router (Phase 4 / Phase 12)

Endpoints for molecular modification and live mutation workbench:
- GET  /api/modification/transforms — List all 12 supported structural transforms
- POST /api/modification/applicable — Evaluate transform applicability and product previews
- POST /api/modification/mutate     — Execute interactive mutation with deltas and predictions
- GET  /api/modification/profiles   — Versioned War Room optimization profiles
- POST /api/modification/war-room   — Lead Optimization War Room multi-parameter evaluation
- POST /api/modification/shortlist  — Ranked suggestions (backward compatible)
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.schemas.mutation_schemas import (
    ApplicableRequest,
    ApplicableResponse,
    MutateRequest,
    MutateResponse,
    TransformCatalogResponse,
)
from app.services import analog_service
from app.services import modification_service
from app.services import war_room_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/modification",
    tags=["modification"],
)


class ShortlistRequest(BaseModel):
    smiles: str
    target_endpoint: str


class WarRoomRequest(BaseModel):
    smiles: str = Field(..., description="SMILES of the parent molecule")
    profile_id: str = Field("anti_inflammatory_exploration_v1", description="Optimization profile ID")
    top_n: int = Field(5, ge=1, le=25, description="Number of top candidates to return")


# ── Live Mutation Workbench Endpoints (Phase 4) ──────────────────────────

@router.get("/transforms", response_model=TransformCatalogResponse)
def get_transform_catalog():
    """
    Return all 12 registered medicinal chemistry transforms with metadata.
    """
    catalog = modification_service.get_transform_catalog()
    return {
        "total_transforms": len(catalog),
        "transforms": catalog,
    }


@router.post("/applicable", response_model=ApplicableResponse)
def get_applicable_mutations(request: ApplicableRequest):
    """
    Check which catalog transforms are applicable to the given molecule,
    reporting match counts, unavailability reasons, and product variant ambiguity.
    """
    try:
        return modification_service.evaluate_applicable_mutations(request.smiles)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Applicability check failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Applicability check failed: {str(e)}")


@router.post("/mutate", response_model=MutateResponse)
def apply_live_mutation(request: MutateRequest):
    """
    Apply a selected transform to generate a live mutated candidate with
    RDKit-computed property deltas and independent ML predictions.
    """
    try:
        return modification_service.apply_mutation(
            smiles=request.smiles,
            transform_id_or_name=request.transform_id,
            variant_index=request.variant_index,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Mutation failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Mutation failed: {str(e)}")


# ── Lead Optimization War Room (Phase 1) ─────────────────────────────────

@router.get("/profiles")
def get_profiles():
    """
    Return all available versioned optimization profiles for the Lead Optimization War Room.
    """
    return {
        "profiles": war_room_service.get_available_profiles(),
    }


@router.post("/war-room")
def evaluate_war_room(request: WarRoomRequest):
    """
    Lead Optimization War Room:
    Multi-dimensional parent vs. analog evaluation across predicted activity,
    cardiac safety, mitochondrial safety, oral-property heuristic, synthetic ease,
    and metabolic stability.
    """
    try:
        results = war_room_service.evaluate_war_room(
            smiles=request.smiles,
            profile_id=request.profile_id,
            top_n=request.top_n,
        )
        return results
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("War room evaluation failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"War room evaluation failed: {str(e)}",
        )


# ── Shortlist Suggestions (Phase 12 / Backward Compatibility) ────────────

@router.post("/shortlist")
def get_shortlist(request: ShortlistRequest):
    """
    Apply every predefined transform to the input molecule, score each
    product using ML predictions, and return the top 5 ranked suggestions.
    Preserved for backward compatibility.
    """
    try:
        results = analog_service.generate_shortlist(
            smiles=request.smiles,
            target_endpoint=request.target_endpoint,
        )
        return {
            "original_smiles": request.smiles,
            "target_endpoint": request.target_endpoint,
            "shortlist": [
                {
                    "rank": r.rank,
                    "transform_name": r.transform_name,
                    "transform_description": r.transform_description,
                    "product_smiles": r.product_smiles,
                    "score": r.score,
                    "properties": r.properties,
                    "property_deltas": r.property_deltas,
                    "predictions": r.predictions,
                }
                for r in results
            ],
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Shortlist generation failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Shortlist generation failed: {str(e)}",
        )
