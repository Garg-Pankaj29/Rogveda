"""
ROGVEDA — Modification API Router (Phase 12)

Endpoints for molecular modification features:
- POST /api/modification/shortlist — ranked best-modification suggestions
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import analog_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/modification",
    tags=["modification"],
)


class ShortlistRequest(BaseModel):
    smiles: str
    target_endpoint: str


@router.post("/shortlist")
def get_shortlist(request: ShortlistRequest):
    """
    Apply every predefined transform to the input molecule, score each
    product using ML predictions, and return the top 5 ranked suggestions.
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
