"""
ROGVEDA — Synthesizability Service (Phase 16)

Assesses how easy or difficult a molecule is to synthesize, using two
complementary approaches:

1. SA_Score (Ertl & Schuffenhauer, J. Cheminform. 2009):
   Fragment-contribution + complexity-penalty formula from RDKit's
   Contrib/SA_Score module. Returns a score in the 1 (trivial) to 10
   (extremely difficult) range.

2. Reactive Group Flagging:
   A SMARTS-pattern rule table flagging unstable / hazardous-to-handle
   functional groups relevant to *synthesis feasibility* — deliberately
   separate from liability_service.py's Brenk-style toxicity/metabolic
   flags, since synthesis difficulty and biological liability are
   different concerns.

Per docs/04_RULES.md §1: SA_Score is deterministic (RDKit), so it must
never be deferred to the LLM.
"""

import logging
from typing import Optional

from rdkit import Chem, RDLogger
from rdkit.Contrib.SA_Score import sascorer

# Suppress noisy RDKit warnings in server logs
RDLogger.logger().setLevel(RDLogger.ERROR)

logger = logging.getLogger(__name__)


# ── SA_Score difficulty thresholds ─────────────────────────────────
# Source: Ertl & Schuffenhauer, J. Cheminform. 2009, 1:8.
# ~80% of known drugs score between 1 and 4. Scores above 5 indicate
# genuinely challenging synthesis targets.
SA_EASY_THRESHOLD = 3.0       # ≤ 3.0 → "easy"
SA_MODERATE_THRESHOLD = 5.0   # 3.0 < score ≤ 5.0 → "moderate"
                               # > 5.0 → "difficult"


# ── Reactive group SMARTS patterns ────────────────────────────────
# These flag groups that are relevant to SYNTHESIS FEASIBILITY:
# e.g. hydrolysis-prone, explosive, or requiring special handling.
# This is NOT the same concern as biological liability / toxicity.
REACTIVE_GROUP_PATTERNS = [
    {
        "name": "Acyl Halide",
        "smarts": "[CX3](=[OX1])[F,Cl,Br,I]",
        "rationale": "Highly moisture-sensitive; hydrolyzes rapidly",
    },
    {
        "name": "Epoxide",
        "smarts": "C1OC1",
        "rationale": "Ring-strained; prone to ring-opening side reactions",
    },
    {
        "name": "Organic Azide",
        "smarts": "[N-]=[N+]=N",
        "rationale": "Potentially explosive; requires careful handling",
    },
    {
        "name": "Isocyanate",
        "smarts": "[NX2]=[CX2]=[OX1]",
        "rationale": "Toxic vapors; highly reactive with nucleophiles",
    },
    {
        "name": "Acid Anhydride",
        "smarts": "[CX3](=[OX1])[OX2][CX3](=[OX1])",
        "rationale": "Moisture-sensitive; hydrolyzes to carboxylic acids",
    },
    {
        "name": "Peroxide",
        "smarts": "[OX2][OX2]",
        "rationale": "Potentially explosive; shock/heat-sensitive",
    },
    {
        "name": "Michael Acceptor (Enone)",
        "smarts": "[CX3](=[OX1])/[CX3]=[CX3]",
        "rationale": "Electrophilic alkene; may undergo unwanted conjugate additions",
    },
]

# Pre-compile SMARTS patterns for performance
_COMPILED_PATTERNS = []
for entry in REACTIVE_GROUP_PATTERNS:
    pat = Chem.MolFromSmarts(entry["smarts"])
    if pat is not None:
        _COMPILED_PATTERNS.append({
            "name": entry["name"],
            "smarts": entry["smarts"],
            "rationale": entry["rationale"],
            "pattern": pat,
        })
    else:
        logger.warning("Failed to compile reactive group SMARTS: %s", entry["smarts"])


# ── Public API ────────────────────────────────────────────────────

def score_synthesizability(mol) -> dict:
    """
    Compute the SA_Score for an RDKit Mol object.

    Returns:
        dict with keys:
            sa_score (float): Raw SA_Score (1–10 range).
            difficulty_label (str): "easy", "moderate", or "difficult".
    """
    sa_score = sascorer.calculateScore(mol)

    if sa_score <= SA_EASY_THRESHOLD:
        difficulty_label = "easy"
    elif sa_score <= SA_MODERATE_THRESHOLD:
        difficulty_label = "moderate"
    else:
        difficulty_label = "difficult"

    return {
        "sa_score": round(sa_score, 2),
        "difficulty_label": difficulty_label,
    }


def flag_reactive_groups(mol) -> list[dict]:
    """
    Scan an RDKit Mol object for reactive functional groups relevant
    to synthesis feasibility.

    Returns:
        List of dicts, each with keys: name, smarts, count, rationale.
        Empty list if no reactive groups found.
    """
    flags = []
    for entry in _COMPILED_PATTERNS:
        matches = mol.GetSubstructMatches(entry["pattern"])
        if matches:
            flags.append({
                "name": entry["name"],
                "smarts": entry["smarts"],
                "count": len(matches),
                "rationale": entry["rationale"],
            })
    return flags


def assess_synthesizability(smiles: str) -> dict:
    """
    Convenience wrapper: parse SMILES, compute SA_Score, flag reactive
    groups, and return a combined dict.

    Returns:
        {
            "sa_score": float,
            "difficulty_label": "easy"|"moderate"|"difficult",
            "reactive_group_flags": [{"name", "smarts", "count", "rationale"}, ...]
        }

    Raises:
        ValueError: if SMILES is invalid.
    """
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: '{smiles}'")

    sa_result = score_synthesizability(mol)
    reactive_flags = flag_reactive_groups(mol)

    return {
        "sa_score": sa_result["sa_score"],
        "difficulty_label": sa_result["difficulty_label"],
        "reactive_group_flags": reactive_flags,
    }
