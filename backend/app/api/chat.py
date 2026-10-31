"""
ROGVEDA — Chat API Router
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import httpx
import logging

from app.core.config import LLM_ENDPOINT
from app.api.auth import _get_optional_user
from app.db.models import User, Experiment
from app.db.database import get_db
from sqlalchemy.orm import Session
from app.services.retrieval_service import (
    is_pure_lookup_query,
    extract_target_compound,
    resolve_compound,
    format_compound_card,
    find_mentioned_compounds,
    build_rag_augmented_system_prompt,
    generate_offline_rag_response,
    sanitize_and_validate_smiles,
)

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

def normalize_chat_messages(system_prompt: str, raw_messages: list[ChatMessage]) -> list[dict]:
    """
    Ensure chat messages conform strictly to alternating user/assistant turns
    required by Gemma, Llama, and other Jinja chat templates:
    1. System message first.
    2. Discard leading assistant greeting bubbles.
    3. Ensure strict user/assistant alternation: merge consecutive messages with the same role.
    4. Ensure conversation ends on a user turn.
    """
    valid_msgs = [m for m in raw_messages if m.content and m.content.strip()]
    first_user_idx = 0
    while first_user_idx < len(valid_msgs) and valid_msgs[first_user_idx].role != "user":
        first_user_idx += 1

    relevant_msgs = valid_msgs[first_user_idx:]
    if not relevant_msgs:
        return [{"role": "system", "content": system_prompt}]

    cleaned: list[dict] = []
    for m in relevant_msgs:
        role = "assistant" if m.role == "assistant" else "user"
        content = m.content.strip()
        if cleaned and cleaned[-1]["role"] == role:
            cleaned[-1]["content"] += f"\n\n{content}"
        else:
            cleaned.append({"role": role, "content": content})

    return [{"role": "system", "content": system_prompt}] + cleaned

@router.post("/", response_model=ChatResponse)
def chat_with_bot(
    request: ChatRequest,
    current_user: User | None = Depends(_get_optional_user),
    db: Session = Depends(get_db)
):
    """
    RAG-driven medicinal chemistry chat assistant grounded in local chemistry knowledge,
    verified benchmarks, and SQLite experiment history.
    """
    last_user_query = ""
    for m in reversed(request.messages):
        if m.role == "user":
            last_user_query = m.content
            break

    user_id = current_user.id if current_user else None
    user_label = current_user.email if current_user else "Researcher"

    # ── 1. Pure Chemical Structure / SMILES Lookup (Rule §1) ──
    # If the user specifically asks for a compound's SMILES, structure, or formula,
    # return the deterministic, verified chemical card directly with 0% hallucination.
    if last_user_query and is_pure_lookup_query(last_user_query):
        candidate_target = extract_target_compound(last_user_query)
        if candidate_target:
            resolved = resolve_compound(candidate_target, allow_pubchem=True)
            if resolved:
                return ChatResponse(reply=format_compound_card(resolved))

    # ── 2. Full RAG Context Pipeline ──
    base_system = request.system_prompt if request.system_prompt else (
        f"You are Rogveda AI, a professional medicinal chemistry and drug discovery assistant talking to {user_label}. "
        "Rogveda is an offline-first molecular research workspace and AI drug discovery assistant built with a local FastAPI backend, Vite/React frontend, and SQLite database. "
        "It features Ketcher for 2D drawing, 3Dmol.js for 3D viewing, and local LLM execution. "
        "Rogveda provides calibrated ML predictions across 6 endpoints: hERG Cardiotoxicity, Anti-inflammatory, Antioxidant, Antimicrobial, Anticancer, and Tox21 Mitochondrial Toxicity. "
        "It also features Batch Screening, Chemical Space visualization, Tanimoto similarity comparison using Morgan fingerprints, and Synthesizability (SA_Score) calculations via RDKit. "
        "You are explicitly authorized to discuss experiment history, recommend molecular edits, suggest bioisosteres, and analyze chemical data. "
        "Keep your answers well-structured, professional, scientifically rigorous, and concise."
    )

    # Augment prompt with retrieved chemical entities, benchmarks, and SQLite lab records
    augmented_system_msg = build_rag_augmented_system_prompt(
        base_prompt=base_system,
        user_query=last_user_query,
        db=db,
        user_id=user_id,
    )

    messages = normalize_chat_messages(augmented_system_msg, request.messages)
    retrieved_compounds = find_mentioned_compounds(last_user_query)

    payload = {
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 800
    }

    try:
        url = f"{LLM_ENDPOINT.rstrip('/')}/chat/completions"
        with httpx.Client(timeout=120.0) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            
            if "choices" in data and len(data["choices"]) > 0:
                msg = data["choices"][0].get("message", {})
                content = (msg.get("content") or "").strip()
                reasoning = (msg.get("reasoning_content") or "").strip()
                reply = content or reasoning
                
                # Sanitize response and validate/correct any generated SMILES strings with RDKit
                reply = sanitize_and_validate_smiles(reply, retrieved_compounds)
                
                if reply:
                    return ChatResponse(reply=reply)
                else:
                    raise HTTPException(status_code=500, detail="AI returned an empty response.")
            else:
                raise HTTPException(status_code=500, detail="AI returned an empty or malformed response.")
    except httpx.HTTPStatusError as e:
        logger.error(f"LM Studio returned HTTP {e.response.status_code}: {e.response.text}")
        offline_reply = generate_offline_rag_response(last_user_query, db, user_id)
        return ChatResponse(reply=offline_reply)
    except (httpx.ConnectError, httpx.TimeoutException) as e:
        logger.warning(f"Local LLM unavailable or timed out: {e}")
        offline_reply = generate_offline_rag_response(last_user_query, db, user_id)
        return ChatResponse(reply=offline_reply)
    except Exception as e:
        logger.error(f"LLM API Error: {e}")
        offline_reply = generate_offline_rag_response(last_user_query, db, user_id)
        return ChatResponse(reply=offline_reply)
