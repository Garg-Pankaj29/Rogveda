"""
ROGVEDA — Remediation API Router (Phase 13)

Endpoints for automated structural remediation of high-risk predictions.
- POST /api/remediation/find — search for a minimal fix
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import remediation_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/remediation",
    tags=["remediation"],
)


class RemediationRequest(BaseModel):
    smiles: str
    flagged_endpoint: str
    protect_endpoint: str


@router.post("/find")
def find_remediation(request: RemediationRequest):
    """
    Search for a minimal structural modification that removes a flagged
    high-risk prediction while preserving a protected therapeutic activity.

    This is a computational suggestion for further validation — not a
    guarantee of safety or efficacy.
    """
    try:
        result = remediation_service.find_remediation(
            smiles=request.smiles,
            flagged_endpoint=request.flagged_endpoint,
            protect_endpoint=request.protect_endpoint,
        )
        return {
            "found": result.found,
            "depth": result.depth,
            "transforms_applied": result.transforms_applied,
            "original_smiles": result.original_smiles,
            "remediated_smiles": result.remediated_smiles,
            "flagged_endpoint": result.flagged_endpoint,
            "flagged_before": result.flagged_before,
            "flagged_after": result.flagged_after,
            "flagged_threshold": result.flagged_threshold,
            "protect_endpoint": result.protect_endpoint,
            "protect_before": result.protect_before,
            "protect_after": result.protect_after,
            "explanation": result.explanation,
            "search_time_ms": result.search_time_ms,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Remediation search failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Remediation search failed: {str(e)}",
        )
