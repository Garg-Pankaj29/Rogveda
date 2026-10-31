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

def _sanitize_chat_messages(raw_messages: list[ChatMessage]) -> list[dict]:
    """
    Sanitizes conversation messages for strict OpenAI / Jinja chat template compliance:
    - Drops leading assistant greetings (conversation must begin with a user turn).
    - Collapses consecutive messages of the same role to maintain strict user/assistant alternation.
    - Strips whitespace and ignores blank messages.
    """
    # 1. Skip leading assistant messages
    start_idx = 0
    while start_idx < len(raw_messages) and raw_messages[start_idx].role == "assistant":
        start_idx += 1

    sanitized: list[dict] = []
    for msg in raw_messages[start_idx:]:
        content = (msg.content or "").strip()
        if not content:
            continue
        role = msg.role.strip().lower()
        if role not in ("user", "assistant"):
            role = "user"

        if sanitized and sanitized[-1]["role"] == role:
            # Merge consecutive turns of identical role
            sanitized[-1]["content"] += "\n\n" + content
        else:
            sanitized.append({"role": role, "content": content})

    return sanitized


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
                url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{compound}/property/CanonicalSMILES,IsomericSMILES/JSON"
                r = httpx.get(url, timeout=10.0)
                if r.status_code == 200:
                    props = r.json().get("PropertyTable", {}).get("Properties", [])
                    if props:
                        smiles = props[0].get("CanonicalSMILES") or props[0].get("IsomericSMILES") or props[0].get("ConnectivitySMILES")
                        if smiles:
                            return ChatResponse(reply=f"The SMILES string for **{compound}** is:\n`{smiles}`")
                
                # If we get here, we couldn't find the SMILES.
                return ChatResponse(reply=f"I couldn't find a verified SMILES string for '{compound}' in the PubChem database. You can try drawing it manually in the editor.")
            except Exception as e:
                logger.warning(f"PubChem lookup failed: {e}")
                return ChatResponse(reply=f"I couldn't retrieve the SMILES string for '{compound}' due to a database connection error. Please draw it manually.")

    # Sanitize turns to ensure strict user/assistant alternation compliant with Jinja / LM Studio templates
    dialogue_messages = _sanitize_chat_messages(request.messages)
    if not dialogue_messages:
        return ChatResponse(reply="Please ask a question or provide a molecule topic to discuss.")

    messages = [{"role": "system", "content": system_msg}] + dialogue_messages

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
                msg = data["choices"][0]["message"]
                reply = (msg.get("content") or "").strip()
                if not reply and msg.get("reasoning_content"):
                    reply = msg.get("reasoning_content").strip()
                if reply:
                    return ChatResponse(reply=reply)
                else:
                    raise HTTPException(status_code=500, detail="AI returned an empty response.")
            else:
                raise HTTPException(status_code=500, detail="AI returned an empty or malformed response.")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Local AI not available. Please ensure the local LLM server is running.")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI response timed out. The local model is taking too long to generate a reply.")
    except httpx.HTTPStatusError as e:
        error_msg = e.response.text
        try:
            err_json = e.response.json()
            if isinstance(err_json, dict) and "error" in err_json:
                err_val = err_json["error"]
                if isinstance(err_val, dict):
                    error_msg = err_val.get("message") or str(err_val)
                else:
                    error_msg = str(err_val)
        except Exception:
            pass
        logger.error(f"LLM API HTTP Error ({e.response.status_code}): {error_msg}")
        raise HTTPException(status_code=502, detail=f"LLM server error ({e.response.status_code}): {error_msg}")
    except Exception as e:
        logger.error(f"LLM API Error: {e}")
        raise HTTPException(status_code=500, detail=f"AI chat failed: {e}")
