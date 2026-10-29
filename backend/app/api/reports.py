"""
ROGVEDA — Reports & Research Dossier API Router (Phase 3)

Endpoints for generating comprehensive reports, reproducible research dossiers (HTML/PDF),
and managing user-saved documents.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import SavedDocument, User
from app.api.auth import _get_current_user
from app.schemas.dossier_schemas import (
    DossierAttributionData,
    DossierConformerData,
    DossierGenerateRequest,
    DossierGenerateResponse,
    DossierLineageData,
    DossierWarRoomData,
)
from app.services.report_service import (
    generate_comprehensive_report,
    generate_research_dossier,
    render_pdf_from_html,
)

router = APIRouter(
    prefix="/api/reports",
    tags=["reports"],
)


# ── Request / Response Schemas ───────────────────────────

class ReportGenerateRequest(BaseModel):
    smiles: Optional[str] = None
    canonical_smiles: Optional[str] = None
    properties: Optional[dict] = None
    predictions: Optional[list] = None
    ai_summary: Optional[dict] = None
    similarity_hits: Optional[list] = None
    drug_likeness: Optional[dict] = None
    activity_log: Optional[list] = None
    molecule_svg: Optional[str] = None
    conformer_3d: Optional[dict] = None
    attribution: Optional[dict] = None
    war_room: Optional[dict] = None
    lineage: Optional[dict] = None
    structural_alerts: Optional[list] = None
    synthesizability: Optional[dict] = None
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
    Generate an HTML report from the provided data.
    If 'Research Dossier' format is requested, delegates to the 12-section dossier engine.
    Otherwise produces the standard comprehensive report.
    """
    if "dossier" in (request.report_format or "").lower():
        dossier = generate_research_dossier(
            smiles=request.smiles,
            canonical_smiles=request.canonical_smiles,
            properties=request.properties,
            predictions=request.predictions,
            ai_summary=request.ai_summary,
            similarity_hits=request.similarity_hits,
            drug_likeness=request.drug_likeness,
            activity_log=request.activity_log,
            molecule_svg=request.molecule_svg,
            conformer_3d=request.conformer_3d,
            attribution=request.attribution,
            war_room=request.war_room,
            lineage=request.lineage,
            structural_alerts=request.structural_alerts,
            synthesizability=request.synthesizability,
            report_format=request.report_format,
        )
        return ReportGenerateResponse(html=dossier["html"], name=dossier["name"])

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

    formula = (request.properties or {}).get("formula", "")
    date_str = datetime.now().strftime("%Y-%m-%d_%H-%M")
    if formula and formula != "-":
        name = f"Report_{formula}_{date_str}"
    else:
        name = f"Report_{date_str}"

    return ReportGenerateResponse(html=html, name=name)


@router.post("/dossier", response_model=DossierGenerateResponse)
def generate_dossier(request: DossierGenerateRequest):
    """
    Generate a full 12-section Reproducible Research Dossier in HTML format.
    """
    result = generate_research_dossier(
        smiles=request.smiles,
        canonical_smiles=request.canonical_smiles,
        properties=request.properties,
        predictions=request.predictions,
        ai_summary=request.ai_summary,
        similarity_hits=request.similarity_hits,
        drug_likeness=request.drug_likeness,
        activity_log=request.activity_log,
        molecule_svg=request.molecule_svg,
        conformer_3d=request.conformer_3d.model_dump() if request.conformer_3d else None,
        attribution=request.attribution.model_dump() if request.attribution else None,
        war_room=request.war_room.model_dump() if request.war_room else None,
        lineage=request.lineage.model_dump() if request.lineage else None,
        structural_alerts=request.structural_alerts,
        synthesizability=request.synthesizability,
        report_format=request.report_format,
    )

    return DossierGenerateResponse(
        dossier_id=result["dossier_id"],
        name=result["name"],
        html=result["html"],
        pdf_available=True,
        created_at=result["created_at"],
    )


@router.post("/dossier/pdf")
def export_dossier_pdf(request: DossierGenerateRequest):
    """
    Generate a research dossier and render as a real, binary PDF file using WeasyPrint.
    """
    result = generate_research_dossier(
        smiles=request.smiles,
        canonical_smiles=request.canonical_smiles,
        properties=request.properties,
        predictions=request.predictions,
        ai_summary=request.ai_summary,
        similarity_hits=request.similarity_hits,
        drug_likeness=request.drug_likeness,
        activity_log=request.activity_log,
        molecule_svg=request.molecule_svg,
        conformer_3d=request.conformer_3d.model_dump() if request.conformer_3d else None,
        attribution=request.attribution.model_dump() if request.attribution else None,
        war_room=request.war_room.model_dump() if request.war_room else None,
        lineage=request.lineage.model_dump() if request.lineage else None,
        structural_alerts=request.structural_alerts,
        synthesizability=request.synthesizability,
        report_format="Research Dossier (PDF)",
    )

    try:
        pdf_bytes = render_pdf_from_html(result["html"])
        filename = f"{result['name']}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-Dossier-ID": result["dossier_id"],
            },
        )
    except Exception as e:
        logger.error(f"WeasyPrint PDF rendering failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"PDF rendering failed: {str(e)}",
        )


class RenderPdfRequest(BaseModel):
    html: str
    filename: Optional[str] = "Rogveda_Document"


@router.post("/pdf/render")
def render_pdf(request: RenderPdfRequest):
    """
    Render any valid HTML string into a binary PDF using WeasyPrint.
    """
    try:
        pdf_bytes = render_pdf_from_html(request.html)
        safe_filename = request.filename.replace(" ", "_").replace("/", "_")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_filename}.pdf"',
            },
        )
    except Exception as e:
        logger.error(f"WeasyPrint PDF rendering failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"PDF rendering failed: {str(e)}",
        )


@router.post("/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def save_document(
    doc: DocumentSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
):
    """Save a generated report or dossier as a document for the current user."""
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
