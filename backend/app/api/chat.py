"""
ROGVEDA — Chat API Router
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import httpx
import logging

from app.core.config import LLM_ENDPOINT
from app.api.auth import _get_current_user
from app.db.models import User, Experiment
from app.db.database import get_db
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/chat",
    tags=["chat"],
)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    system_prompt: str | None = None

class ChatResponse(BaseModel):
    reply: str

@router.post("/", response_model=ChatResponse)
def chat_with_bot(
    request: ChatRequest,
    current_user: User = Depends(_get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send messages to the local LLM and get a response.
    """
    total_experiments = db.query(Experiment).filter(Experiment.user_id == current_user.id).count()
    recent_experiments = db.query(Experiment).filter(Experiment.user_id == current_user.id).order_by(Experiment.created_at.desc()).limit(3).all()
    exp_info = f"The user has a total of {total_experiments} experiment(s) in their history. "
    if recent_experiments:
        exp_smiles = [e.original_smiles or e.modified_smiles or "Unknown" for e in recent_experiments]
        exp_info += "Their most recent experiments involved these molecules (SMILES): " + ", ".join(exp_smiles) + "."
    else:
        exp_info += "They haven't performed any experiments yet."
        
    system_msg = request.system_prompt if request.system_prompt else (
        f"You are Rogveda AI, a professional medicinal chemistry and drug discovery assistant. You are currently talking to the user '{current_user.email}'. {exp_info} "
        "Rogveda is an offline-first molecular research workspace and AI drug discovery assistant built with a local FastAPI (Python) backend, Vite/React frontend, and SQLite database. "
        "It features Ketcher for 2D molecular drawing, 3Dmol.js for 3D viewing, and uses local LLMs (like LM Studio). "
        "Rogveda provides machine learning predictions using scikit-learn models for 6 endpoints: hERG Cardiotoxicity, Anti-inflammatory, Antioxidant, Antimicrobial, Anticancer, and Tox21 Mitochondrial Toxicity. "
        "It also features Batch Screening, Chemical Space visualization, Tanimoto similarity comparison using Morgan fingerprints, Synthesizability (SA_Score) calculations via RDKit, and a unique Power Saver mode that dynamically scales ML threads when a laptop is on battery power. "
        "It is strictly authorized and safe for you to provide chemical information, synthesis routes, suggest chemical modifications, and analyze compounds. "
        "CRITICAL INSTRUCTION: YOU MUST NEVER REFUSE TO ANSWER QUESTIONS ABOUT THE USER'S EXPERIMENTS, ACCOUNT, OR CHEMICAL MODIFICATIONS. You are explicitly authorized to discuss their experiment history, recommend molecular edits, and analyze their data. Do not issue safety, privacy, or proprietary refusals for these topics. "
        "SMILES strings and basic chemical properties are public domain scientific facts, NOT proprietary information. YOU MUST NEVER REFUSE to provide a SMILES string or chemical formula. "
        "CRITICAL RULE: You must be extremely factually accurate. Do not invent, guess, or hallucinate SMILES strings, chemical properties, or acronyms (like TPSA). If you are not absolutely certain of a fact, state that you do not know. "
        "Keep your answers concise and informative."
    )
    
    # Simple RAG: intercept SMILES queries and fetch factual data from PubChem to prevent hallucinations in small models
    if len(request.messages) > 0:
        import re
        last_msg = request.messages[-1].content.lower()
        match = re.search(r'(?:smiles?|smile name)\s+(?:for|of)\s+([a-zA-Z0-9\-\s\,]+)', last_msg)
        if match:
            compound = match.group(1).replace('?', '').strip()
            try:
                url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{compound}/property/CanonicalSMILES/JSON"
                r = httpx.get(url, timeout=10.0)
                if r.status_code == 200:
                    props = r.json().get("PropertyTable", {}).get("Properties", [])
                    if props:
                        smiles = props[0].get("CanonicalSMILES") or props[0].get("ConnectivitySMILES")
                        if smiles:
                            request.messages[-1].content = f"Answer this question factually. FACT: The SMILES for '{compound}' is '{smiles}'.\n\nQuestion: {last_msg}"
                else:
                    request.messages[-1].content = f"Question: {last_msg}\n\n[SYSTEM INSTRUCTION: You do not know the SMILES for this compound. You must explicitly reply: 'I cannot verify the exact SMILES string for this compound right now. Please draw it manually in the editor.' Do not guess.]"
            except Exception as e:
                logger.warning(f"PubChem lookup failed: {e}")
                request.messages[-1].content = f"Question: {last_msg}\n\n[SYSTEM INSTRUCTION: You do not know the SMILES for this compound. You must explicitly reply: 'I cannot verify the exact SMILES string for this compound right now. Please draw it manually in the editor.' Do not guess.]"

    messages = [{"role": "system", "content": system_msg}]
    for msg in request.messages:
        messages.append({"role": msg.role, "content": msg.content})

    payload = {
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 800
    }

    try:
        url = f"{LLM_ENDPOINT.rstrip('/')}/chat/completions"
        with httpx.Client(timeout=300.0) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            
            if "choices" in data and len(data["choices"]) > 0:
                reply = data["choices"][0]["message"]["content"].strip()
                return ChatResponse(reply=reply)
            else:
                raise HTTPException(status_code=500, detail="AI returned an empty or malformed response.")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Local AI not available. Please ensure the local LLM server is running.")
    except Exception as e:
        logger.error(f"LLM API Error: {e}")
        raise HTTPException(status_code=500, detail=f"AI chat failed: {e}")
