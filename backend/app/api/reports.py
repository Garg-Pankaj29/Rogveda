"""
ROGVEDA — Reports API Router

Endpoints for generating comprehensive reports and managing saved documents.
"""

from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import SavedDocument, User
from app.api.auth import _get_current_user
from app.services.report_service import generate_comprehensive_report

router = APIRouter(
    prefix="/api/reports",
    tags=["reports"],
)


# ── Request / Response Schemas ───────────────────────────

class ReportGenerateRequest(BaseModel):
    smiles: Optional[str] = None
    properties: Optional[dict] = None
    predictions: Optional[list] = None
    ai_summary: Optional[dict] = None
    similarity_hits: Optional[list] = None
    drug_likeness: Optional[dict] = None
    activity_log: Optional[list] = None
    molecule_svg: Optional[str] = None
    report_format: str = "Comprehensive Report (PDF)"


class ReportGenerateResponse(BaseModel):
    html: str
    name: str


class DocumentSaveRequest(BaseModel):
    name: str
    format: Optional[str] = "Comprehensive Report (PDF)"
    html_content: str
    smiles: Optional[str] = None


class DocumentResponse(BaseModel):
    id: int
    name: str
    format: Optional[str]
    smiles: Optional[str]
    created_at: str
    html_content: Optional[str] = None


# ── Endpoints ────────────────────────────────────────────

@router.post("/generate", response_model=ReportGenerateResponse)
def generate_report(request: ReportGenerateRequest):
    """
    Generate a comprehensive HTML report from the provided data.
    Missing sections will display 'Data yet to be calculated'.
    """
    html = generate_comprehensive_report(
        smiles=request.smiles,
        properties=request.properties,
        predictions=request.predictions,
        ai_summary=request.ai_summary,
        similarity_hits=request.similarity_hits,
        drug_likeness=request.drug_likeness,
        activity_log=request.activity_log,
        molecule_svg=request.molecule_svg,
        report_format=request.report_format,
    )

    # Generate a name for the report
    formula = (request.properties or {}).get("formula", "")
    date_str = datetime.now().strftime("%Y-%m-%d_%H-%M")
    if formula and formula != "-":
        name = f"Report_{formula}_{date_str}"
    else:
        name = f"Report_{date_str}"

    return ReportGenerateResponse(html=html, name=name)


@router.post("/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def save_document(
    doc: DocumentSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
):
    """Save a generated report as a document for the current user."""
    saved = SavedDocument(
        user_id=current_user.id,
        name=doc.name,
        format=doc.format,
        html_content=doc.html_content,
        smiles=doc.smiles,
    )
    db.add(saved)
    db.commit()
    db.refresh(saved)

    return DocumentResponse(
        id=saved.id,
        name=saved.name,
        format=saved.format,
        smiles=saved.smiles,
        created_at=saved.created_at.isoformat(),
    )


@router.get("/documents", response_model=List[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
):
    """List all saved documents for the current user, newest first."""
    docs = (
        db.query(SavedDocument)
        .filter(SavedDocument.user_id == current_user.id)
        .order_by(SavedDocument.created_at.desc())
        .all()
    )
    return [
        DocumentResponse(
            id=d.id,
            name=d.name,
            format=d.format,
            smiles=d.smiles,
            created_at=d.created_at.isoformat(),
        )
        for d in docs
    ]


@router.get("/documents/{doc_id}", response_model=DocumentResponse)
def get_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
):
    """Get a single saved document with its HTML content."""
    doc = (
        db.query(SavedDocument)
        .filter(SavedDocument.id == doc_id, SavedDocument.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentResponse(
        id=doc.id,
        name=doc.name,
        format=doc.format,
        smiles=doc.smiles,
        created_at=doc.created_at.isoformat(),
        html_content=doc.html_content,
    )


@router.delete("/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
):
    """Delete a saved document."""
    doc = (
        db.query(SavedDocument)
        .filter(SavedDocument.id == doc_id, SavedDocument.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    db.delete(doc)
    db.commit()
