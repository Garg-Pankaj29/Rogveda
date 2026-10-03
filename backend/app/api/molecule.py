"""
ROGVEDA — Molecule API Router
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.schemas.molecule_schemas import (
    PredictionRequest,
    PredictionResponse,
    SmilesRequest,
    SimilarityRequest,
    Conformer3DResponse,
    SimilarityResponse,
    SimilarityHitResponse,
    InsightRequest,
    InsightResponse,
)
from app.services import ml_service
from app.services import chemistry_service
from app.services import llm_service
from app.services import contradiction_service
from app.services import synthesizability_service
from app.services import cache_service

router = APIRouter(
    prefix="/api/molecule",
    tags=["molecule"],
)


@router.post("/predict", response_model=PredictionResponse)
def predict_molecule(request: PredictionRequest):
    """
    Predict hERG activity for a given SMILES string.
    """
    try:
        result = ml_service.predict(request.smiles)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.post("/3d", response_model=Conformer3DResponse)
def generate_3d(request: SmilesRequest):
    """
    Generate a 3D conformer for a SMILES string.
    Returns an SDF block with ETKDG-embedded 3D coordinates.
    """
    try:
        from rdkit import Chem
        sdf_block = chemistry_service.generate_3d_sdf(request.smiles)
        # Also return the canonical SMILES for display
        mol = Chem.MolFromSmiles(request.smiles)
        canonical = Chem.MolToSmiles(mol, canonical=True) if mol else request.smiles
        return Conformer3DResponse(sdf_block=sdf_block, canonical_smiles=canonical)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"3D generation failed: {str(e)}")


@router.post("/similar", response_model=SimilarityResponse)
def get_similar(request: SimilarityRequest):
    """
    Find similar reference molecules using Morgan fingerprints and Tanimoto similarity.
    Supports threshold filtering and configurable result count.
    """
    try:
        hits = chemistry_service.find_similar(
            request.smiles,
            top_n=request.top_n,
            threshold=request.threshold,
            metric=request.metric,
        )
        return SimilarityResponse(
            query_smiles=request.smiles,
            hits=[
                SimilarityHitResponse(
                    name=h.name,
                    canonical_smiles=h.canonical_smiles,
                    tanimoto=h.tanimoto,
                    svg=h.svg
                ) for h in hits
            ]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Similarity search failed: {str(e)}")


@router.post("/substructure", response_model=SimilarityResponse)
def get_substructure(request: SimilarityRequest):
    """
    Find molecules containing the given SMILES as a substructure.
    """
    try:
        hits = chemistry_service.find_substructure(
            request.smiles,
            max_results=request.top_n,
        )
        return SimilarityResponse(
            query_smiles=request.smiles,
            hits=[
                SimilarityHitResponse(
                    name=h.name,
                    canonical_smiles=h.canonical_smiles,
                    tanimoto=h.tanimoto,
                    svg=h.svg
                ) for h in hits
            ]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Substructure search failed: {str(e)}")


@router.post("/synthesizability")
def get_synthesizability(request: SmilesRequest):
    """
    Assess synthesis feasibility: SA_Score + reactive group flags.
    """
    try:
        result = synthesizability_service.assess_synthesizability(request.smiles)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Synthesizability assessment failed: {str(e)}")


@router.post("/insight", response_model=InsightResponse)
def get_insight(request: InsightRequest):
    """
    Generate an AI insight summary using RDKit properties and local LLM.
    Includes detected tradeoffs/contradictions when applicable.
    """
    try:
        # Calculate properties deterministically
        properties = chemistry_service.calculate_properties(request.smiles)

        # Run all predictions to feed into contradiction detection
        preds_for_contradictions = []
        endpoints = [
            {"id": "herg", "name": "hERG Cardiotoxicity"},
            {"id": "antiinflammatory", "name": "Anti-inflammatory"},
        ]
        for ep in endpoints:
            try:
                pred = ml_service.predict_endpoint(request.smiles, ep["id"])
                if ep["id"] in ("herg", "tox21_mmp"):
                    status = "High Risk" if "likely active" in pred.label else "Low Risk"
                else:
                    status = "Active" if "likely active" in pred.label else "Inactive"
                preds_for_contradictions.append({
                    "endpoint_name": ep["name"],
                    "status_label": status,
                    "confidence": round(pred.probability_active, 2),
                    "available": True,
                })
            except Exception:
                pass  # Model not available — skip

        # Detect contradictions
        contradictions = contradiction_service.detect_contradictions(
            properties, preds_for_contradictions
        )

        # Assess synthesizability (Phase 16)
        synth_data = None
        try:
            synth_data = synthesizability_service.assess_synthesizability(request.smiles)
        except Exception:
            pass  # Non-critical — don't block insight generation

        # Call LLM service with properties + contradictions + synthesizability
        insight_text = llm_service.generate_insight(
            smiles=request.smiles,
            properties=properties,
            contradictions=contradictions if contradictions else None,
            synthesizability=synth_data if synth_data and synth_data.get("difficulty_label") != "easy" else None,
        )
        return InsightResponse(insight=insight_text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Insight generation failed: {str(e)}")


@router.get("/model-info")
def get_model_info():
    """
    Get metadata for the currently loaded hERG model.
    """
    try:
        return ml_service.get_model_info()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/predict-all")
def predict_all_endpoints(request: PredictionRequest, force_refresh: bool = False):
    """
    Return predictions from every available model as a list.
    Each entry contains: endpoint_name, status_label, confidence, available.
    """
    from rdkit import Chem
    from app.main import app as main_app # To get version if possible, or hardcode/import from config
    # Actually, version is in main.py but hard to import cleanly here, we'll use a constant or config
    
    # 1. Canonicalize SMILES
    mol = Chem.MolFromSmiles(request.smiles)
    if mol is None:
        raise HTTPException(status_code=400, detail=f"Invalid SMILES: '{request.smiles}'")
    canonical = Chem.MolToSmiles(mol, canonical=True)

    # 2. Get Model Fingerprint
    fingerprint = cache_service.get_model_fingerprint()

    # 3. Check Cache
    if not force_refresh:
        cached = cache_service.get_cached(canonical, "predict-all", fingerprint)
        if cached:
            # Rehydrate the from_cache flag
            for res in cached:
                res["from_cache"] = True
            return cached

    # 4. If Miss, Compute Fresh
    results = []

    endpoints = [
        {"id": "herg", "name": "hERG Cardiotoxicity"},
        {"id": "antiinflammatory", "name": "Anti-inflammatory"},
        {"id": "antioxidant", "name": "Antioxidant"},
        {"id": "antimicrobial", "name": "Antimicrobial"},
        {"id": "anticancer", "name": "Anticancer"},
        {"id": "tox21_mmp", "name": "Tox21 Mitochondrial Toxicity"},
    ]

    for ep in endpoints:
        try:
            pred = ml_service.predict_endpoint(request.smiles, ep["id"])
            
            if ep["id"] in ("herg", "tox21_mmp"):
                if "likely active" in pred.label:
                    status_label = "High Risk"
                else:
                    status_label = "Low Risk"
            else:
                if "likely active" in pred.label:
                    status_label = "Active"
                else:
                    status_label = "Inactive"
                    
            results.append({
                "endpoint_name": ep["name"],
                "status_label": status_label,
                "confidence": round(pred.probability_active, 2),
                "available": True,
            })
        except FileNotFoundError:
            results.append({
                "endpoint_name": ep["name"],
                "status_label": "Model not yet available",
                "confidence": None,
                "available": False,
            })
        except ValueError:
            results.append({
                "endpoint_name": ep["name"],
                "status_label": "Invalid input",
                "confidence": None,
                "available": False,
            })
        except Exception:
            results.append({
                "endpoint_name": ep["name"],
                "status_label": "Error",
                "confidence": None,
                "available": False,
            })

    # Add from_cache=False to response
    for res in results:
        res["from_cache"] = False

    # Store in Cache
    cache_service.store_result(canonical, "predict-all", fingerprint, "0.1.0", results)

    return results


class AISummaryRequest(BaseModel):
    """Request for combined AI summary + key insights."""
    smiles: str
    properties: dict
    predictions: list


@router.post("/ai-summary")
def get_ai_summary(request: AISummaryRequest, force_refresh: bool = False):
    """
    Combined AI call for the Prediction & AI tab.
    Returns { summary, key_insights } from a single LLM call.
    Both fields are grounded ONLY in the provided properties and predictions.
    """
    import httpx
    from app.core.config import LLM_ENDPOINT
    from rdkit import Chem

    # 1. Canonicalize SMILES
    mol = Chem.MolFromSmiles(request.smiles)
    if mol is None:
        raise HTTPException(status_code=400, detail=f"Invalid SMILES: '{request.smiles}'")
    canonical = Chem.MolToSmiles(mol, canonical=True)

    # 2. Check Cache
    fingerprint = cache_service.get_model_fingerprint()
    if not force_refresh:
        cached = cache_service.get_cached(canonical, "ai-summary", fingerprint)
        if cached:
            cached["from_cache"] = True
            return cached

    # Build a structured facts block for the LLM
    props = request.properties
    preds = request.predictions

    facts_lines = [
        f"SMILES: {request.smiles}",
        f"Molecular Formula: {props.get('formula', 'N/A')}",
        f"Molecular Weight: {props.get('mw', 'N/A')} g/mol",
        f"LogP: {props.get('logP', 'N/A')}",
        f"TPSA: {props.get('tpsa', 'N/A')} Å²",
        f"H-Bond Donors: {props.get('hbd', 'N/A')}",
        f"H-Bond Acceptors: {props.get('hba', 'N/A')}",
        f"Rotatable Bonds: {props.get('rotBonds', 'N/A')}",
        f"Aromatic Rings: {props.get('aromaticRings', 'N/A')}",
        f"Heavy Atoms: {props.get('heavyAtoms', 'N/A')}",
    ]

    pred_lines = []
    for p in preds:
        if p.get("available"):
            pred_lines.append(
                f"  - {p['endpoint_name']}: {p['status_label']} (confidence: {p.get('confidence', 'N/A')})"
            )
        else:
            pred_lines.append(
                f"  - {p['endpoint_name']}: {p.get('status_label', 'Model not yet available')} (no trained model)"
            )

    facts_block = "\n".join(facts_lines)
    preds_block = "\n".join(pred_lines) if pred_lines else "No predictions available."

    system_prompt = (
        "You are an expert medicinal chemist. Your task is to INTERPRET the provided molecular properties "
        "and ML predictions to generate meaningful insights about the molecule's drug-likeness, bioavailability, "
        "and potential liabilities.\n"
        "DO NOT just repeat the raw facts (e.g., do not just say 'it has 3 aromatic rings'). "
        "Instead, explain what that MEANS (e.g., 'High aromaticity may increase lipophilicity and decrease aqueous solubility, potentially affecting oral bioavailability').\n"
        "Consider Lipinski's Rule of 5 (MW <= 500, LogP <= 5, HBD <= 5, HBA <= 10) and TPSA (<= 140 for cell permeability). "
        "You MUST base your response on the provided data, but provide professional interpretation.\n"
        "Do NOT fabricate ML predictions.\n"
        "Respond with valid JSON only, no markdown fences, with exactly two fields:\n"
        '  "summary": a short, professional paragraph summarizing the molecule\'s pharmacological potential, drug-likeness, and key risks based on the data.\n'
        '  "key_insights": an array of 4 to 6 short strings highlighting the most important pharmacological or chemical implications of the data. DO NOT include conversational preambles (e.g., "Here are the observations:") inside the array. Every single item MUST be a standalone scientific insight.'
    )

    # Detect contradictions from properties + predictions
    contradictions = contradiction_service.detect_contradictions(props, preds)

    tradeoff_block = ""
    if contradictions:
        tradeoff_lines = []
        for c in contradictions:
            facts = c.get("explanation_facts", {})
            tradeoff_lines.append(
                f"  - {c['flag_name']}: {facts.get('explanation', 'No details.')}"
            )
        tradeoff_block = "\n\nDetected Tradeoffs (you MUST discuss these in your summary and key_insights):\n" + "\n".join(tradeoff_lines)

    # Phase 16: Synthesizability block (only for moderate/difficult)
    synth_block = ""
    try:
        synth_data = synthesizability_service.assess_synthesizability(request.smiles)
        if synth_data.get("difficulty_label") in ("moderate", "difficult"):
            synth_lines = [
                f"  SA_Score: {synth_data['sa_score']} ({synth_data['difficulty_label']})",
            ]
            for flag in synth_data.get("reactive_group_flags", []):
                synth_lines.append(f"  - Reactive group: {flag['name']} ({flag['rationale']})")
            synth_block = "\n\nSynthesis Feasibility (mention in summary — use cautious language like 'may be challenging to synthesize'):\n" + "\n".join(synth_lines)
    except Exception:
        pass  # Non-critical

    user_prompt = (
        f"Based ONLY on the following computed data, provide a summary and key insights.\n\n"
        f"Computed Properties:\n{facts_block}\n\n"
        f"ML Predictions:\n{preds_block}"
        f"{tradeoff_block}"
        f"{synth_block}"
    )

    payload = {
        "messages": [
            {"role": "system", "content": system_prompt + " DO NOT output any internal thinking or reasoning steps. Output only the requested JSON."},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 800,
    }

    fallback = {
        "summary": "Local AI not available — start LM Studio to generate AI insights.",
        "key_insights": [],
    }

    try:
        url = f"{LLM_ENDPOINT.rstrip('/')}/chat/completions"
        with httpx.Client(timeout=60.0) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()

            if "choices" not in data or len(data["choices"]) == 0:
                return fallback

            msg = data["choices"][0]["message"]
            raw = msg.get("content", "").strip()
            reasoning = msg.get("reasoning_content", "").strip()

            if not raw and reasoning:
                return {
                    "summary": f"**[AI Thoughts (Token limit reached)]**: {reasoning}...\n\n*(Tip: You are using a heavy reasoning model that takes a long time to think. For instant summaries, eject this model and load 'llama-3.2-1b-instruct' in LM Studio.)*",
                    "key_insights": ["Model timed out while reasoning. Please switch to a faster model (like Llama 3.2 1B) for instant insights."]
                }
            elif not raw:
                return fallback

            import re
            import json
            
            # Strip markdown code fences if the model wraps in ```json ... ```
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)

            try:
                # Try strict JSON parsing first
                start = raw.find('{')
                end = raw.rfind('}')
                if start != -1 and end != -1 and end > start:
                    json_str = raw[start:end+1]
                    parsed = json.loads(json_str)
                else:
                    parsed = json.loads(raw)
                    
                result = {
                    "summary": parsed.get("summary", fallback["summary"]),
                    "key_insights": parsed.get("key_insights", []),
                }
                
                cache_service.store_result(canonical, "ai-summary", fingerprint, "0.1.0", result)
                result["from_cache"] = False
                return result
            except json.JSONDecodeError:
                # Fallback to regex extraction if JSON is truncated or slightly malformed
                summary_match = re.search(r'"summary"\s*:\s*"((?:[^"\\]|\\.)*)"', raw)
                summary_str = summary_match.group(1).encode().decode('unicode_escape') if summary_match else fallback["summary"]
                
                insights = []
                insights_match = re.search(r'"key_insights"\s*:\s*\[(.*)', raw, re.DOTALL)
                if insights_match:
                    items = re.findall(r'"((?:[^"\\]|\\.)*)"', insights_match.group(1))
                    insights = [item.encode().decode('unicode_escape') for item in items]
                    
                if summary_match or insights:
                    result = {
                        "summary": summary_str,
                        "key_insights": insights,
                    }
                else:
                    result = {
                        "summary": raw if raw else fallback["summary"],
                        "key_insights": [],
                    }
                
                cache_service.store_result(canonical, "ai-summary", fingerprint, "0.1.0", result)
                result["from_cache"] = False
                return result
    except httpx.TimeoutException:
        print("AI SUMMARY ERROR: TimeoutException")
        return {
            "summary": "AI insight generation timed out. Your model is taking too long to think. Try loading the smaller 'llama-3.2-1b-instruct' model in LM Studio for instant results.",
            "key_insights": ["Timeout: Model reasoning took longer than 60 seconds."]
        }
    except httpx.ConnectError as e:
        return {
            "summary": f"Connection Error to LM Studio: {str(e)}",
            "key_insights": []
        }
    except Exception as e:
        import traceback
        return {
            "summary": f"AI SUMMARY INTERNAL ERROR: {type(e).__name__}: {str(e)}\n{traceback.format_exc()}",
            "key_insights": []
        }
        logging.getLogger(__name__).error(f"AI summary error: {e}")
        return fallback


@router.post("/cache/clear")
def clear_analysis_cache(force: bool = True):
    """
    Clear all cached analysis results.
    For development and testing purposes.
    """
    count = cache_service.clear_cache()
    return {"status": "success", "cleared_rows": count}


@router.get("/cache/stats")
def get_analysis_cache_stats():
    """
    Return statistics about the analysis cache.
    """
    return cache_service.get_cache_stats()
