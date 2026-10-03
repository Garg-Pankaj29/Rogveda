from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Experiment, User
from app.api.auth import _get_current_user
from app.schemas.experiments import ExperimentCreate, ExperimentUpdate, ExperimentResponse

router = APIRouter(
    prefix="/api/experiments",
    tags=["experiments"],
    responses={404: {"description": "Not found"}},
)

@router.get("/", response_model=List[ExperimentResponse])
def get_experiments(
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user)
):
    """Retrieve all experiments for current user."""
    experiments = db.query(Experiment).filter(Experiment.user_id == current_user.id).all()
    
    # Map back to response
    result = []
    for exp in experiments:
        result.append(_map_exp(exp))
    return result

@router.post("/", response_model=ExperimentResponse, status_code=status.HTTP_201_CREATED)
def create_experiment(
    experiment: ExperimentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user)
):
    """Create a new experiment."""
    # Check if experiment with this local_id already exists for this user
    existing = db.query(Experiment).filter(
        Experiment.user_id == current_user.id,
        Experiment.local_id == experiment.local_id
    ).first()

    if existing:
        existing.name = experiment.name
        existing.molfile = experiment.molfile
        existing.original_smiles = experiment.original_smiles
        existing.modified_smiles = experiment.modified_smiles
        existing.properties_json = experiment.properties_json
        existing.predictions_json = experiment.predictions_json
        existing.similarity_json = experiment.similarity_json
        existing.ai_insight = experiment.ai_insight
        existing.date = experiment.date
        existing.parent_experiment_id = experiment.parent_experiment_id
        db.commit()
        db.refresh(existing)
        return _map_exp(existing)

    db_exp = Experiment(
        user_id=current_user.id,
        local_id=experiment.local_id,
        name=experiment.name,
        molfile=experiment.molfile,
        original_smiles=experiment.original_smiles,
        modified_smiles=experiment.modified_smiles,
        properties_json=experiment.properties_json,
        predictions_json=experiment.predictions_json,
        similarity_json=experiment.similarity_json,
        ai_insight=experiment.ai_insight,
        date=experiment.date,
        parent_experiment_id=experiment.parent_experiment_id,
    )
    db.add(db_exp)
    db.commit()
    db.refresh(db_exp)
    return _map_exp(db_exp)

@router.patch("/{local_id}", response_model=ExperimentResponse)
def update_experiment(
    local_id: str,
    experiment_update: ExperimentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user)
):
    """Update an experiment (e.g. rename)."""
    db_exp = db.query(Experiment).filter(
        Experiment.user_id == current_user.id,
        Experiment.local_id == local_id
    ).first()

    if not db_exp:
        raise HTTPException(status_code=404, detail="Experiment not found")

    if experiment_update.name is not None:
        db_exp.name = experiment_update.name

    db.commit()
    db.refresh(db_exp)
    return _map_exp(db_exp)

@router.delete("/{local_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_experiment(
    local_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user)
):
    """Delete an experiment."""
    db_exps = db.query(Experiment).filter(
        Experiment.user_id == current_user.id,
        Experiment.local_id == local_id
    ).all()

    if not db_exps:
        raise HTTPException(status_code=404, detail="Experiment not found")

    for db_exp in db_exps:
        db.delete(db_exp)
    db.commit()
    return None


@router.get("/{db_id}/story")
def get_experiment_story(
    db_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user)
):
    """
    Generate a narrated story of the modification chain ending at this experiment.
    Returns { steps: [...], chain_length: N, narration: str }.
    """
    # Verify experiment exists and belongs to this user
    exp = db.query(Experiment).filter(
        Experiment.id == db_id,
        Experiment.user_id == current_user.id
    ).first()

    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")

    from app.services.story_service import build_story, narrate_story

    story_data = build_story(db_id, db)

    if story_data["chain_length"] < 2:
        raise HTTPException(
            status_code=400,
            detail="This experiment has no modification chain (it is a standalone root experiment)."
        )

    narration = narrate_story(story_data["steps"])

    return {
        "steps": story_data["steps"],
        "chain_length": story_data["chain_length"],
        "narration": narration,
    }


def _map_exp(exp: Experiment):
    return {
        "id": exp.local_id,
        "db_id": exp.id,
        "name": exp.name,
        "molfile": exp.molfile,
        "original_smiles": exp.original_smiles,
        "modified_smiles": exp.modified_smiles,
        "properties_json": exp.properties_json,
        "predictions_json": exp.predictions_json,
        "similarity_json": exp.similarity_json,
        "ai_insight": exp.ai_insight,
        "date": exp.date,
        "parent_experiment_id": exp.parent_experiment_id,
    }
