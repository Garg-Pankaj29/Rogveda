"""
ROGVEDA — Chemical Space API

POST /api/chemical-space/locate  →  project a molecule into the 2D map
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.chemical_space_service import project_molecule

router = APIRouter(prefix="/api/chemical-space", tags=["chemical-space"])


class LocateRequest(BaseModel):
    smiles: str


@router.post("/locate")
def locate_molecule(body: LocateRequest):
    """
    Project a molecule into the pre-fitted 2D chemical space map.

    Returns the query molecule's (x, y) position plus all reference
    compound positions for scatter-plot rendering.
    """
    try:
        result = project_molecule(body.smiles)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
