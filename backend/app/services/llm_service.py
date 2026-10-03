"""
ROGVEDA — LLM Service

Communicates with a local LLM server (like LM Studio) providing an OpenAI-compatible API.
"""

import logging
import httpx

from app.core.config import LLM_ENDPOINT

def generate_insight(
    smiles: str,
    properties: dict,
    contradictions: list[dict] | None = None,
    synthesizability: dict | None = None,
) -> str:
    """
    Generate a short, plain-English summary of the molecule's properties
    using a local LLM. Optionally includes detected tradeoffs/contradictions
    and synthesis feasibility notes.
    """
    prompt = f"""
You are a medicinal chemistry assistant. Provide a concise, professional summary of the following molecule based ONLY on the provided data.
Do NOT hallucinate additional properties.
Keep it to one short paragraph. DO NOT output any internal thinking or reasoning steps.

Molecule SMILES: {smiles}

Computed Properties:
- Molecular Weight: {properties.get('molecular_weight')} g/mol
- LogP: {properties.get('logp')}
- TPSA: {properties.get('tpsa')} Å²
"""

    # Append tradeoff section when contradictions exist
    if contradictions:
        tradeoff_lines = []
        for c in contradictions:
            facts = c.get("explanation_facts", {})
            tradeoff_lines.append(
                f"- {c['flag_name']}: {facts.get('explanation', 'No details.')}"
            )
        prompt += "\nDetected Tradeoffs (discuss these in your summary):\n"
        prompt += "\n".join(tradeoff_lines)
        prompt += "\n"

    # Phase 16: Append synthesis feasibility section (only for moderate/difficult)
    if synthesizability and synthesizability.get("difficulty_label") in ("moderate", "difficult"):
        prompt += f"\nSynthesis Feasibility (use cautious language like 'may be challenging to synthesize'):\n"
        prompt += f"- SA_Score: {synthesizability['sa_score']} ({synthesizability['difficulty_label']})\n"
        for flag in synthesizability.get("reactive_group_flags", []):
            prompt += f"- Reactive group: {flag['name']} ({flag.get('rationale', '')})\n"

    try:
        url = f"{LLM_ENDPOINT.rstrip('/')}/chat/completions"
        with httpx.Client(timeout=60.0) as client:
            
            # Omit 'model' so LM Studio uses whatever is currently loaded in memory.
            payload = {
                "messages": [
                    {"role": "system", "content": "You are a helpful, professional medicinal chemistry assistant. Do NOT output any internal thinking or reasoning steps. Output only the final summary."},
                    {"role": "user", "content": prompt.strip()}
                ],
                "temperature": 0.1,
                "max_tokens": 500
            }
            
            logger.info("Generating insight with local LLM...")
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            
            if "choices" in data and len(data["choices"]) > 0:
                msg = data["choices"][0]["message"]
                content = msg.get("content", "").strip()
                reasoning = msg.get("reasoning_content", "").strip()
                
                if content:
                    return content
                elif reasoning:
                    return f"**[AI Thoughts (Token limit reached)]**: {reasoning}...\n\n*(Tip: You are using a heavy reasoning model that takes a long time to think. For instant summaries, eject this model and load 'llama-3.2-1b-instruct' in LM Studio.)*"
                else:
                    return "AI returned an empty response."
            else:
                return "AI returned an empty or malformed response."
    except httpx.ConnectError:
        return "Local AI not available (is LM Studio running?)"
    except httpx.TimeoutException:
        return "AI insight generation timed out. Your model is taking too long to think. Try loading the smaller 'llama-3.2-1b-instruct' model in LM Studio for instant results."
    except Exception as e:
        logger.error(f"LLM API Error: {e}")
        return f"AI insight generation failed: {e}"
