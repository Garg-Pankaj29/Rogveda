"""
ROGVEDA — Retrieval & Chemical Knowledge Service (RAG Engine)

Deterministic compound resolution, semantic context retrieval, and fact-grounding.
Per docs/04_RULES.md §1 & §2:
- If a fact can be computed deterministically (RDKit, database lookup),
  it must NEVER be answered or hallucinated by the LLM.
- Grounded on the local 10,028 reference molecule dataset, Rogveda benchmark case studies,
  and local SQLite experiment history, with PubChem fallback.
"""

import csv
import logging
import re
from pathlib import Path
from typing import Optional, List, Dict, Any

import httpx
from sqlalchemy.orm import Session
from rdkit import Chem, RDLogger
from rdkit.Chem import Descriptors, rdMolDescriptors

# Suppress noisy RDKit parsing logs completely
RDLogger.DisableLog('rdApp.*')

logger = logging.getLogger(__name__)

from app.core.config import PROJECT_ROOT
from app.db.models import Experiment, SavedDocument
from app.services.benchmark_service import BENCHMARK_RAW_CATALOG, get_benchmark_by_id

REFERENCE_CSV = PROJECT_ROOT / "data" / "reference" / "reference_molecules.csv"

# In-memory fast cache for known compounds and runtime lookups
_COMPOUND_INDEX: Dict[str, dict] = {}
_SMILES_INDEX: Dict[str, str] = {}  # canonical_smiles -> compound_name


def _load_reference_compounds():
    """Load the local reference database into memory on first call."""
    if _COMPOUND_INDEX:
        return

    if not REFERENCE_CSV.exists():
        logger.warning(f"Reference molecules CSV not found at {REFERENCE_CSV}")
        return

    try:
        with open(REFERENCE_CSV, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = (row.get("name") or "").strip()
                smiles = (row.get("smiles") or "").strip()
                if not name or not smiles:
                    continue

                mol = Chem.MolFromSmiles(smiles)
                if mol is None:
                    continue

                canonical = Chem.MolToSmiles(mol, canonical=True)
                key = name.lower()
                _COMPOUND_INDEX[key] = {
                    "name": name,
                    "canonical_smiles": canonical,
                    "source": "Rogveda Reference Library",
                }
                if canonical not in _SMILES_INDEX:
                    _SMILES_INDEX[canonical] = name

        logger.info(f"Loaded {len(_COMPOUND_INDEX)} reference molecules into memory.")
    except Exception as e:
        logger.error(f"Failed to load reference molecules CSV: {e}")


# Initialize once at module import
_load_reference_compounds()


# Comprehensive non-chemical stopwords and common conversational terms
_STOP_WORDS = {
    "what", "when", "where", "which", "with", "would", "could", "should", "about",
    "please", "there", "their", "these", "those", "other", "using", "under", "after",
    "before", "between", "against", "during", "without", "because", "while", "since",
    "action", "effect", "effects", "reduce", "modify", "compare", "suggest", "explain",
    "describe", "difference", "mechanism", "toxicity", "efficacy", "synthesize", "synthesis",
    "experiment", "experiments", "molecule", "molecules", "compound", "compounds",
    "properties", "structure", "structures", "formula", "formulas", "lipinski", "rule",
    "rules", "screen", "screening", "batch", "batches", "model", "models", "qsar", "tell",
    "test", "tested", "testing", "tests", "recent", "last", "show", "give", "help", "list",
    "name", "good", "best", "some", "more", "make", "find", "have", "from", "into", "over",
    "each", "both", "such", "than", "very", "also", "most", "only", "same", "been", "were",
    "said", "will", "hello", "thank", "thanks", "does", "done", "know", "just", "like",
    "view", "card", "data", "draw", "drawing", "work", "runs", "need", "want", "here",
    "they", "them", "then", "anyone", "anything", "anyone", "something", "someone"
}


def is_pure_lookup_query(text: str) -> bool:
    """
    Distinguish between a pure chemical structure lookup request vs a broader analytical question.
    Pure lookups:
    - 'what is the smile name ibuprofen'
    - 'smiles for aspirin'
    - 'caffeine'
    - 'CC(C)Cc1ccc(C(C)C(=O)O)cc1'
    Conversational / RAG questions:
    - 'can you suggest modifications for ibuprofen to reduce GI toxicity?'
    - 'how does ibuprofen compare to aspirin?'
    - 'explain the mechanism of action of celecoxib'
    - 'what did I test in my last experiment?'
    """
    t = text.strip().rstrip("?.!\"'").lower()
    if not t:
        return False

    # 1. Directly a SMILES string
    if " " not in t and any(c in t for c in ["=", "#", "(", ")", "1", "2", "3", "4", "@"]):
        if Chem.MolFromSmiles(t) is not None:
            return True

    # 2. Conversational / Analytical indicators
    conversational_keywords = [
        "explain", "how", "why", "suggest", "modify", "modification", "compare",
        "difference", "mechanism", "action", "side effect", "adverse", "efficacy",
        "toxicity", "synthesize", "synthesis", "route", "metabolism", "history",
        "experiment", "my molecule", "what did i", "what was", "clinical", "target",
        "cardiac", "cardiotoxicity", "analogs", "candidates", "lead", "screen", "batch"
    ]
    if any(k in t for k in conversational_keywords):
        return False

    # 3. Direct lookup patterns
    lookup_patterns = [
        r"^(?:what\s+is\s+(?:the\s+)?)?(?:smile\s+name|smiles?\s+name|smiles?|smile\s+string|structure|formula|chemical\s+formula|molecular\s+formula|iupac)\s+(?:of|for|is)?\s*([a-zA-Z0-9\-\s]+)$",
        r"^([a-zA-Z0-9\-\s]+)\s+(?:smiles?|smile\s+name|smiles?\s+name|smile\s+string|structure|formula)$",
        r"^(?:get|find|search|lookup|show|give\s+me)\s+(?:the\s+)?(?:smile\s+name|smiles?|structure|formula)\s+(?:for|of)?\s*([a-zA-Z0-9\-\s]+)$",
        r"^(?:lookup|find|search)\s+(?:compound|molecule|drug)?\s*([a-zA-Z0-9\-\s]+)$",
    ]
    for p in lookup_patterns:
        if re.match(p, t):
            return True

    # Single or two word query (e.g. 'ibuprofen', 'aspirin', 'paracetamol')
    words = t.split()
    if len(words) <= 2 and not any(w in _STOP_WORDS for w in words):
        return True

    return False


def extract_target_compound(text: str) -> Optional[str]:
    """Extract single compound target for direct lookup queries."""
    t = text.strip().rstrip("?.!\"'")
    if not t:
        return None

    # Direct SMILES
    if " " not in t and any(c in t for c in ["=", "#", "(", ")", "1", "2", "3", "4", "@"]):
        if Chem.MolFromSmiles(t) is not None:
            return t

    lower = t.lower()
    cleaned = re.sub(
        r"^(?:can\s+you\s+)?(?:please\s+)?(?:tell\s+me\s+about|show\s+me|give\s+me|find|search|lookup|get)\s+(?:the\s+)?",
        "",
        lower,
    ).strip()
    cleaned = re.sub(r"^(?:what\s+is|what\'s|whats)\s+(?:the\s+)?", "", cleaned).strip()
    cleaned = re.sub(
        r"^(?:smile\s+name|smiles?\s+name|smiles?|smile\s+string|chemical\s+structure|structure|chemical\s+formula|molecular\s+formula|formula|properties|compound|molecule|drug)\s+(?:of|for|is)?\s*",
        "",
        cleaned,
    ).strip()
    cleaned = re.sub(
        r"\s+(?:smiles?|smile\s+name|smiles?\s+name|smile\s+string|structure|formula|properties)$",
        "",
        cleaned,
    ).strip()
    cleaned = re.sub(r"^(?:of|for|about|is)\s+", "", cleaned).strip()

    if len(cleaned) >= 2 and cleaned not in _STOP_WORDS:
        return cleaned
    return None


def resolve_compound(query_or_name: str, allow_pubchem: bool = False) -> Optional[dict]:
    """
    Multi-tier deterministic compound resolver:
    1. Direct RDKit SMILES parse.
    2. Benchmark Catalog (rich ground-truth cases).
    3. Local Reference Library (10,028 compounds - exact match only).
    4. PubChem Grounded Database (optional online fallback, strictly for pure lookups).
    """
    _load_reference_compounds()

    raw = query_or_name.strip()
    if not raw:
        return None

    # ── Tier 1: Valid SMILES string ──
    if any(c in raw for c in ["=", "#", "(", ")", "1", "2", "3", "4", "@"]):
        mol = Chem.MolFromSmiles(raw)
        if mol is not None:
            canonical = Chem.MolToSmiles(mol, canonical=True)
            known_name = _SMILES_INDEX.get(canonical, "Query Molecule")
            return _build_compound_payload(
                name=known_name,
                mol=mol,
                canonical_smiles=canonical,
                source="Local RDKit Engine",
            )

    q = raw.lower()

    # ── Tier 2: Benchmark Catalog ──
    if q in BENCHMARK_RAW_CATALOG:
        b = get_benchmark_by_id(q)
        if b and b.canonical_smiles:
            mol = Chem.MolFromSmiles(b.canonical_smiles)
            if mol:
                payload = _build_compound_payload(
                    name=b.name,
                    mol=mol,
                    canonical_smiles=b.canonical_smiles,
                    formula=b.formula,
                    mw=f"{b.molecular_weight:.2f}",
                    source="Rogveda Benchmark Ground Truth",
                )
                payload["mechanism"] = b.mechanism_of_action
                payload["clinical_outcome"] = b.clinical_outcome
                payload["historical_context"] = b.historical_context
                return payload

    # Synonyms mapping for benchmark compounds
    synonyms = {
        "paracetamol": "acetaminophen",
        "tylenol": "acetaminophen",
        "advil": "ibuprofen",
        "motrin": "ibuprofen",
        "bayer": "aspirin",
        "celebrex": "celecoxib",
        "seldane": "terfenadine",
        "allegra": "fexofenadine",
    }
    if q in synonyms and synonyms[q] in BENCHMARK_RAW_CATALOG:
        b = get_benchmark_by_id(synonyms[q])
        if b and b.canonical_smiles:
            mol = Chem.MolFromSmiles(b.canonical_smiles)
            if mol:
                payload = _build_compound_payload(
                    name=b.name,
                    mol=mol,
                    canonical_smiles=b.canonical_smiles,
                    formula=b.formula,
                    mw=f"{b.molecular_weight:.2f}",
                    source="Rogveda Benchmark Ground Truth",
                )
                payload["mechanism"] = b.mechanism_of_action
                payload["clinical_outcome"] = b.clinical_outcome
                payload["historical_context"] = b.historical_context
                return payload

    # ── Tier 3: Local Reference Library (10,028 molecules) ──
    # Exact match only! Never prefix match arbitrary substrings.
    if q in _COMPOUND_INDEX:
        item = _COMPOUND_INDEX[q]
        mol = Chem.MolFromSmiles(item["canonical_smiles"])
        if mol:
            return _build_compound_payload(
                name=item["name"],
                mol=mol,
                canonical_smiles=item["canonical_smiles"],
                source="Rogveda Reference Library",
            )

    # ── Tier 4: PubChem Database (only when explicitly requested) ──
    if allow_pubchem:
        try:
            url = (
                f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{q}/property/"
                "CanonicalSMILES,IsomericSMILES,SMILES,MolecularFormula,MolecularWeight,IUPACName/JSON"
            )
            with httpx.Client(timeout=4.0) as client:
                r = client.get(url)
                if r.status_code == 200:
                    props = r.json().get("PropertyTable", {}).get("Properties", [])
                    if props:
                        p = props[0]
                        smiles = (
                            p.get("SMILES")
                            or p.get("CanonicalSMILES")
                            or p.get("ConnectivitySMILES")
                            or p.get("IsomericSMILES")
                        )
                        if smiles:
                            mol = Chem.MolFromSmiles(smiles)
                            if mol:
                                canonical = Chem.MolToSmiles(mol, canonical=True)
                                formula = p.get("MolecularFormula") or rdMolDescriptors.CalcMolFormula(mol)
                                mw = p.get("MolecularWeight") or f"{Descriptors.MolWt(mol):.2f}"
                                iupac = p.get("IUPACName")
                                disp_name = q.title()

                                # Cache in memory
                                _COMPOUND_INDEX[q] = {
                                    "name": disp_name,
                                    "canonical_smiles": canonical,
                                    "source": "PubChem Database",
                                }
                                _SMILES_INDEX[canonical] = disp_name

                                return _build_compound_payload(
                                    name=disp_name,
                                    mol=mol,
                                    canonical_smiles=canonical,
                                    formula=formula,
                                    mw=mw,
                                    iupac=iupac,
                                    source="PubChem Grounded Database",
                                )
        except Exception as e:
            logger.debug(f"PubChem lookup skipped for '{q}': {e}")

    return None


def find_mentioned_compounds(text: str) -> List[dict]:
    """
    Scan a conversational query for verified referenced chemical compounds.
    Uses exact word-boundary matching against Benchmark Catalog and Reference Library.
    Zero network calls and zero false positives on standard English words.
    """
    _load_reference_compounds()
    found: Dict[str, dict] = {}
    lower_text = text.lower()

    # 1. Benchmark catalog entities (exact word boundary)
    for k in BENCHMARK_RAW_CATALOG:
        if re.search(r"\b" + re.escape(k) + r"\b", lower_text):
            res = resolve_compound(k, allow_pubchem=False)
            if res:
                found[res["name"].lower()] = res

    # Common aliases
    alias_map = {
        "paracetamol": "acetaminophen",
        "tylenol": "acetaminophen",
        "advil": "ibuprofen",
        "motrin": "ibuprofen",
        "bayer": "aspirin",
    }
    for alias, canonical_name in alias_map.items():
        if re.search(r"\b" + re.escape(alias) + r"\b", lower_text):
            res = resolve_compound(canonical_name, allow_pubchem=False)
            if res:
                found[res["name"].lower()] = res

    # 2. Reference molecules (exact word match in 10,028 database)
    words = re.findall(r"[a-zA-Z0-9\-]+", lower_text)
    for w in words:
        if len(w) >= 4 and w not in _STOP_WORDS and w not in found:
            if w in _COMPOUND_INDEX:
                res = resolve_compound(w, allow_pubchem=False)
                if res:
                    found[res["name"].lower()] = res

    return list(found.values())


def retrieve_user_experiments_context(db: Session, user_id: Optional[int]) -> dict:
    """Retrieve and format the user's experiment history and molecular data from SQLite."""
    if not user_id:
        return {"total_count": 0, "recent_experiments": []}

    total = db.query(Experiment).filter(Experiment.user_id == user_id).count()
    recent = (
        db.query(Experiment)
        .filter(Experiment.user_id == user_id)
        .order_by(Experiment.created_at.desc())
        .limit(5)
        .all()
    )

    items = []
    for exp in recent:
        smiles = exp.original_smiles or exp.modified_smiles
        exp_dict: Dict[str, Any] = {
            "id": exp.id,
            "name": exp.name or f"Experiment #{exp.id}",
            "smiles": smiles,
            "date": exp.date or (exp.created_at.strftime("%Y-%m-%d %H:%M") if exp.created_at else None),
            "parent_id": exp.parent_experiment_id,
        }

        # Calculate descriptors if valid molecule
        if smiles:
            mol = Chem.MolFromSmiles(smiles)
            if mol:
                exp_dict["canonical_smiles"] = Chem.MolToSmiles(mol, canonical=True)
                exp_dict["formula"] = rdMolDescriptors.CalcMolFormula(mol)
                exp_dict["mw"] = round(Descriptors.MolWt(mol), 2)
                exp_dict["logp"] = round(Descriptors.MolLogP(mol), 2)
                exp_dict["tpsa"] = round(Descriptors.TPSA(mol), 2)
                # Known common name if matched in reference
                exp_dict["identified_name"] = _SMILES_INDEX.get(exp_dict["canonical_smiles"])

        items.append(exp_dict)

    return {"total_count": total, "recent_experiments": items}


def build_rag_augmented_system_prompt(
    base_prompt: str,
    user_query: str,
    db: Session,
    user_id: Optional[int] = None,
) -> str:
    """
    Assemble the complete RAG-augmented system prompt injecting verified factual context:
    1. Retrieved Chemical Knowledge (SMILES, properties, mechanisms for mentioned compounds).
    2. Retrieved User Experiments (real lab records, molecules, and properties from SQLite).
    3. Strict factual alignment constraints (docs/04_RULES.md §1 & §5).
    """
    rag_blocks: List[str] = [base_prompt]

    # ── 1. Retrieved Chemical Context ──
    compounds = find_mentioned_compounds(user_query)
    if compounds:
        lines = ["\n### RETRIEVED CHEMICAL KNOWLEDGE (GROUND TRUTH):"]
        for c in compounds:
            lines.append(f"- Compound: {c['name']} ({c['formula']})")
            lines.append(f"  Canonical SMILES: {c['canonical_smiles']}")
            lines.append(f"  Molecular Weight: {c['mw']} g/mol | LogP: {c['logp']} | TPSA: {c['tpsa']} Å²")
            lines.append(f"  HBD: {c['hbd']} | HBA: {c['hba']} | Lipinski: {c['lipinski']}")
            if c.get("mechanism"):
                lines.append(f"  Mechanism of Action: {c['mechanism']}")
            if c.get("clinical_outcome"):
                lines.append(f"  Clinical Profile: {c['clinical_outcome']}")
            if c.get("historical_context"):
                lines.append(f"  Scientific Background: {c['historical_context']}")
            lines.append("")
        rag_blocks.append("\n".join(lines))

    # ── 2. Retrieved User Experiments Context ──
    if user_id:
        exp_data = retrieve_user_experiments_context(db, user_id)
        if exp_data["total_count"] > 0:
            lines = [
                f"\n### RETRIEVED USER LAB HISTORY (from SQLite Database):",
                f"- Total user experiments recorded: {exp_data['total_count']}",
            ]
            for e in exp_data["recent_experiments"]:
                mol_label = e.get("identified_name") or e.get("formula") or "Novel Candidate"
                lines.append(
                    f"- [Experiment #{e['id']}] '{e['name']}' ({e.get('date', 'Recent')}):"
                )
                lines.append(f"  Structure (SMILES): `{e['smiles']}` ({mol_label})")
                if "mw" in e:
                    lines.append(
                        f"  Computed Properties: MW={e['mw']} g/mol, LogP={e['logp']}, TPSA={e['tpsa']} Å²"
                    )
                if e.get("parent_id"):
                    lines.append(f"  Optimization Lineage: Derived from Parent Experiment #{e['parent_id']}")
            rag_blocks.append("\n".join(lines))

    # ── 3. Strict Grounding Directives ──
    rag_blocks.append(
        "\n### STRICT FACTUAL DIRECTIVES:\n"
        "1. Base your answer strictly on the verified chemical and lab data provided above.\n"
        "2. When mentioning SMILES, ALWAYS copy the exact verified Canonical SMILES from the facts above.\n"
        "3. Provide structured, scientifically thorough, and directly responsive answers to what the user asked."
    )

    return "\n".join(rag_blocks)


def generate_offline_rag_response(
    user_query: str,
    db: Session,
    user_id: Optional[int] = None,
) -> str:
    """
    Construct a grounded, authoritative answer when the local LLM runtime is offline or unreachable.
    Uses retrieved compound facts, user experiments, and benchmark knowledge.
    """
    q_lower = user_query.lower()

    # 1. User asked about their experiments
    if any(k in q_lower for k in ["experiment", "my molecule", "what did i", "what was my", "history"]):
        if not user_id:
            return (
                "### User Laboratory History\n\n"
                "You are currently chatting as a guest. Please log in or register to view and analyze your recorded laboratory experiments."
            )

        exp_data = retrieve_user_experiments_context(db, user_id)
        if exp_data["total_count"] == 0:
            return (
                "You have not recorded any molecular experiments in your laboratory history yet.\n\n"
                "To start, open the **Draw** tab (`/draw`), sketch or paste a SMILES structure, and run property or toxicity predictions."
            )

        resp = [
            f"### Your Research Experiment History\n",
            f"You have a total of **{exp_data['total_count']} experiment(s)** recorded in your local database:\n",
        ]
        for e in exp_data["recent_experiments"]:
            name = e["name"]
            smiles = e["smiles"]
            ident = f" ({e['identified_name']})" if e.get("identified_name") else ""
            resp.append(f"#### {name}{ident}")
            resp.append(f"- **Structure (SMILES):** `{smiles}`")
            if "mw" in e:
                resp.append(
                    f"- **Descriptors:** MW: {e['mw']} g/mol | LogP: {e['logp']} | TPSA: {e['tpsa']} Å² | Formula: {e.get('formula')}"
                )
            if e.get("parent_id"):
                resp.append(f"- **Lineage:** Modified analog derived from Parent Experiment #{e['parent_id']}")
            resp.append("")
        return "\n".join(resp)

    # 2. Check for mentioned compounds
    compounds = find_mentioned_compounds(user_query)

    # Specific check for modification queries (e.g. reducing GI toxicity for Ibuprofen)
    if any(k in q_lower for k in ["gi toxicity", "gastric", "ulcer", "stomach", "reduce toxicity", "modification", "modify"]):
        if any(c["name"].lower() in ["ibuprofen", "aspirin"] for c in compounds) or "ibuprofen" in q_lower:
            return (
                "### Strategies to Reduce GI Toxicity for Ibuprofen / Carboxylic Acid NSAIDs\n\n"
                "Ibuprofen causes gastrointestinal mucosal injury via two mechanisms: **direct local contact irritation** from the free carboxylic acid group (`-COOH`), and **systemic COX-1 inhibition** suppressing cytoprotective prostaglandins ($PGE_2$ and $PGI_2$).\n\n"
                "**Key Rational Modification Strategies:**\n\n"
                "1. **Ester Prodrug Synthesis (Shielding the Acidic Moiety):**\n"
                "   - Synthesize alkyl, glycolate, or aminoalkyl esters (e.g., Ibuprofen guaiacol ester or morpholinoethyl ester).\n"
                "   - Masking the free carboxylic acid temporarily eliminates direct gastric epithelial irritation, with systemic esterases releasing active ibuprofen after absorption.\n\n"
                "2. **Nitric Oxide (NO)-Donating NSAID Hybrids (CINODs):**\n"
                "   - Couple a nitrooxyalkyl linker (e.g., `-O-(CH2)4-ONO2`) to the carboxylic acid.\n"
                "   - Released NO promotes gastric microcirculation and mucosal mucus secretion, counteracting prostaglandin deficiency.\n\n"
                "3. **Tetrazole Bioisosteric Replacement:**\n"
                "   - Replace `-COOH` with a `1H-tetrazol-5-yl` ring.\n"
                "   - Retains similar pKa (~4.5–4.9) and hydrogen-bonding capacity, while increasing lipophilicity and altering local mucosal membrane partition dynamics.\n\n"
                "4. **COX-2 Selective Tuning:**\n"
                "   - Modulate sterics to favor COX-2 over COX-1, reducing gastric ulceration risk (while monitoring cardiac liability via the hERG model)."
            )

    if compounds:
        if len(compounds) == 1:
            c = compounds[0]
            lines = [
                f"### {c['name']} ({c['formula']})\n",
                f"**Canonical SMILES:**\n```smiles\n{c['canonical_smiles']}\n```\n",
                f"**Molecular Descriptors:**",
                f"- **Molecular Weight:** {c['mw']} g/mol",
                f"- **LogP (Lipophilicity):** {c['logp']}",
                f"- **TPSA:** {c['tpsa']} Å²",
                f"- **Lipinski Rule of 5:** {c['lipinski']}",
            ]
            if c.get("mechanism"):
                lines.append(f"\n**Mechanism of Action:**\n{c['mechanism']}")
            if c.get("clinical_outcome"):
                lines.append(f"\n**Clinical & Pharmacological Profile:**\n{c['clinical_outcome']}")
            if c.get("historical_context"):
                lines.append(f"\n**Scientific Background:**\n{c['historical_context']}")
            return "\n".join(lines)
        else:
            # Comparison between compounds
            lines = [f"### Comparative Molecular Analysis: {' vs '.join([c['name'] for c in compounds])}\n"]
            for c in compounds:
                lines.append(f"#### {c['name']} ({c['formula']})")
                lines.append(f"- **Canonical SMILES:** `{c['canonical_smiles']}`")
                lines.append(f"- **MW:** {c['mw']} g/mol | **LogP:** {c['logp']} | **TPSA:** {c['tpsa']} Å²")
                if c.get("mechanism"):
                    lines.append(f"- **Mechanism:** {c['mechanism']}")
                if c.get("clinical_outcome"):
                    lines.append(f"- **Clinical Profile:** {c['clinical_outcome']}")
                lines.append("")
            return "\n".join(lines)

    # 3. Platform Knowledge Topics
    if any(k in q_lower for k in ["lipinski", "rule of 5", "rule-of-5", "ro5"]):
        return (
            "### Lipinski's Rule of 5 (Pfizer Rule of Five)\n\n"
            "Lipinski's Rule of 5 evaluates whether a chemical compound has chemical and physical properties "
            "that would make it likely to be an orally active drug in humans:\n\n"
            "- **Molecular Weight (MW):** ≤ 500 Da\n"
            "- **Octanol-water partition coefficient (LogP):** ≤ 5 (measures lipophilicity)\n"
            "- **Hydrogen Bond Donors (HBD):** ≤ 5 (sum of all OH and NH groups)\n"
            "- **Hydrogen Bond Acceptors (HBA):** ≤ 10 (sum of all N and O atoms)\n\n"
            "**Key Insight:** If a molecule violates more than one of these criteria, it is significantly more likely "
            "to exhibit poor solubility or low gastrointestinal permeability."
        )

    if any(k in q_lower for k in ["qsar", "model", "prediction", "endpoints"]):
        return (
            "### QSAR Models in Rogveda\n\n"
            "Rogveda operates **6 calibrated machine learning classifiers** running locally with scaffold-split validation:\n\n"
            "1. **hERG Cardiotoxicity:** Predicts cardiac potassium channel liability to prevent QT prolongation.\n"
            "2. **Anti-inflammatory:** Identifies non-steroidal and anti-inflammatory bioactivity.\n"
            "3. **Antioxidant:** Assesses radical-scavenging potential.\n"
            "4. **Antimicrobial:** Predicts antibacterial and antifungal inhibitory efficacy.\n"
            "5. **Anticancer:** Predicts cytotoxic potential against tumor cell lines.\n"
            "6. **Tox21 Mitochondrial Membrane Potential:** Evaluates mitochondrial disruption toxicity."
        )

    if any(k in q_lower for k in ["screen", "batch"]):
        return (
            "### Batch Screening in Rogveda\n\n"
            "1. Navigate to the **Batch Screening** tab (`/batch`).\n"
            "2. Upload a `.csv` or `.sdf` file containing a molecular `SMILES` column.\n"
            "3. The engine initiates parallel multi-threaded prediction across all 6 bioactivity and toxicity endpoints.\n"
            "4. Filter, rank candidates by therapeutic index, and export prioritized leads as a CSV or PDF Dossier."
        )

    return (
        "**Local AI Offline**\n\n"
        "The local LLM server is currently not reachable at `http://127.0.0.1:1234`.\n\n"
        "**To enable open-ended chat:**\n"
        "1. Open **LM Studio**\n"
        "2. Load an instruction model (e.g. `llama-3.2-1b-instruct` or `google/gemma-3-4b`)\n"
        "3. Start the **Local Server** on port `1234`\n\n"
        "*(Deterministic SMILES lookups, RDKit descriptors, and ML predictions continue working 100% offline without the LLM.)*"
    )


def sanitize_and_validate_smiles(reply: str, retrieved_compounds: List[dict]) -> str:
    """
    Sanitize generated text:
    1. Strip thinking tags (`<think>...</think>`).
    2. Validate any SMILES code blocks or strings with RDKit.
    3. Correct corrupted or hallucinated SMILES using retrieved ground truth.
    """
    # 1. Strip thinking tags
    if "<think>" in reply and "</think>" in reply:
        reply = re.sub(r"<think>.*?</think>", "", reply, flags=re.DOTALL).strip()

    # 2. Check for code blocks with smiles
    def _validate_block(match):
        code = match.group(1).strip()
        # Test if valid SMILES
        mol = Chem.MolFromSmiles(code)
        if mol is not None:
            return f"```smiles\n{code}\n```"
        # If invalid and we have a retrieved compound, replace with the canonical SMILES!
        if retrieved_compounds:
            verified = retrieved_compounds[0]["canonical_smiles"]
            logger.info(f"Corrected invalid generated SMILES '{code}' -> '{verified}'")
            return f"```smiles\n{verified}\n```"
        return f"```smiles\n{code}\n```"

    reply = re.sub(r"```(?:smiles)?\s*([a-zA-Z0-9\-\(\)\=\#\@\+]+)\s*```", _validate_block, reply)

    return reply


def _build_compound_payload(
    name: str,
    mol: Chem.Mol,
    canonical_smiles: str,
    formula: Optional[str] = None,
    mw: Optional[str] = None,
    iupac: Optional[str] = None,
    source: str = "Rogveda Engine",
) -> dict:
    """Calculate deterministic RDKit properties for the resolved molecule."""
    calc_formula = formula or rdMolDescriptors.CalcMolFormula(mol)
    calc_mw = mw or f"{Descriptors.MolWt(mol):.2f}"
    logp = f"{Descriptors.MolLogP(mol):.2f}"
    tpsa = f"{Descriptors.TPSA(mol):.1f}"
    hbd = rdMolDescriptors.CalcNumHBD(mol)
    hba = rdMolDescriptors.CalcNumHBA(mol)

    violations = 0
    try:
        if float(calc_mw) > 500:
            violations += 1
        if float(logp) > 5.0:
            violations += 1
        if hbd > 5:
            violations += 1
        if hba > 10:
            violations += 1
    except ValueError:
        pass

    lipinski_status = (
        "Passes (0 violations — favorable oral bioavailability)"
        if violations == 0
        else f"{violations} violation(s)"
    )

    return {
        "name": name,
        "canonical_smiles": canonical_smiles,
        "formula": calc_formula,
        "mw": calc_mw,
        "logp": logp,
        "tpsa": tpsa,
        "hbd": hbd,
        "hba": hba,
        "lipinski": lipinski_status,
        "iupac": iupac,
        "source": source,
    }


def format_compound_card(info: dict) -> str:
    """Format resolved chemical data into a clean, markdown response."""
    name = info["name"]
    formula = info["formula"]
    smiles = info["canonical_smiles"]
    mw = info["mw"]
    logp = info["logp"]
    tpsa = info["tpsa"]
    hbd = info["hbd"]
    hba = info["hba"]
    lipinski = info["lipinski"]
    source = info["source"]
    iupac = info.get("iupac")
    mechanism = info.get("mechanism")

    iupac_line = f"- **IUPAC Name:** {iupac}\n" if iupac else ""
    mech_block = f"\n**Mechanism of Action:**\n{mechanism}\n" if mechanism else ""

    return (
        f"### {name} ({formula})\n\n"
        f"**Canonical SMILES:**\n"
        f"```smiles\n{smiles}\n```\n\n"
        f"**Key Molecular Properties:**\n"
        f"{iupac_line}"
        f"- **Molecular Formula:** {formula}\n"
        f"- **Molecular Weight:** {mw} g/mol\n"
        f"- **LogP:** {logp}\n"
        f"- **TPSA:** {tpsa} Å²\n"
        f"- **H-Bond Donors:** {hbd} | **H-Bond Acceptors:** {hba}\n"
        f"- **Lipinski Rule of 5:** {lipinski}\n"
        f"{mech_block}\n"
        f"*(Verified via {source}. You can copy this SMILES string and paste it into the **Draw** tab editor to view 2D/3D structures or generate ML toxicity predictions.)*"
    )
