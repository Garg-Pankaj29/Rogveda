from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ExperimentBase(BaseModel):
    # Frontend passes 'id' as a string UUID, we map it to 'local_id' in backend
    local_id: str = Field(..., alias="id")
    name: Optional[str] = "Unnamed Experiment"
    molfile: Optional[str] = None
    original_smiles: Optional[str] = None
    modified_smiles: Optional[str] = None
    properties_json: Optional[str] = None
    predictions_json: Optional[str] = None
    similarity_json: Optional[str] = None
    ai_insight: Optional[str] = None
    date: Optional[str] = None
    parent_experiment_id: Optional[int] = None

class ExperimentCreate(ExperimentBase):
    pass

class ExperimentUpdate(BaseModel):
    name: Optional[str] = None

class ExperimentResponse(BaseModel):
    # What frontend expects as 'id' is the local_id string.
    id: str
    db_id: int
    name: Optional[str]
    molfile: Optional[str]
    original_smiles: Optional[str]
    modified_smiles: Optional[str]
    properties_json: Optional[str]
    predictions_json: Optional[str]
    similarity_json: Optional[str]
    ai_insight: Optional[str]
    date: Optional[str]
    parent_experiment_id: Optional[int] = None

    class Config:
        from_attributes = True
