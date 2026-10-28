"""
ROGVEDA — Modification API Router (Phase 12)

Endpoints for molecular modification features:
- POST /api/modification/shortlist — ranked best-modification suggestions
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services import analog_service
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

