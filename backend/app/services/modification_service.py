"""
ROGVEDA — Modification Service (Phase 12)

A library of predefined medicinal-chemistry structural transforms.
Each transform is a function (smiles: str) → str | None that applies a
SMARTS-based reaction and returns the canonical SMILES of the product,
or None if the transform does not apply to the input molecule.

These transforms are the single source of truth used by both the
individual-apply UI and the analog_service shortlist scorer.
"""

import logging
from dataclasses import dataclass
from typing import Callable, Optional

from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem

# Suppress noisy RDKit warnings
RDLogger.logger().setLevel(RDLogger.ERROR)

logger = logging.getLogger(__name__)


# ── Helper: apply a single SMARTS reaction ──────────────────────────────

def _apply_reaction(smiles: str, rxn_smarts: str) -> Optional[str]:
    """
    Apply a SMARTS-encoded reaction to *smiles*.
    Returns canonical SMILES of the first valid product, or None.
    Only the first matching site is transformed (single-site edit).
    """
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None

    try:
        rxn = AllChem.ReactionFromSmarts(rxn_smarts)
    except Exception:
        logger.warning("Invalid reaction SMARTS: %s", rxn_smarts)
        return None

    try:
        products = rxn.RunReactants((mol,))
    except Exception:
        return None

    if not products:
        return None

    # Take the first product set, first product molecule
    product_mol = products[0][0]
    try:
        Chem.SanitizeMol(product_mol)
        result_smiles = Chem.MolToSmiles(product_mol, canonical=True)
        # Validate the result parses back cleanly
        if Chem.MolFromSmiles(result_smiles) is None:
            return None
        # Don't return the same molecule
        original_canonical = Chem.MolToSmiles(mol, canonical=True)
        if result_smiles == original_canonical:
            return None
        return result_smiles
    except Exception:
        return None


# ── Transform definitions ───────────────────────────────────────────────

@dataclass
class Transform:
    """A named structural modification with a description and callable."""
    name: str
    description: str
    fn: Callable[[str], Optional[str]]


def _make_transform(rxn_smarts: str) -> Callable[[str], Optional[str]]:
    """Create a transform function from a reaction SMARTS string."""
    def transform(smiles: str) -> Optional[str]:
        return _apply_reaction(smiles, rxn_smarts)
    return transform


TRANSFORMS: list[Transform] = [
    Transform(
        name="Replace -OH with -OCH₃",
        description="Hydroxyl → methoxy: increases lipophilicity, may improve membrane permeability",
        fn=_make_transform("[OH:1]>>[O:1]C"),
    ),
    Transform(
        name="Replace -OH with -F",
        description="Hydroxyl → fluorine bioisostere: blocks metabolism at that position",
        fn=_make_transform("[OH:1]>>[F:1]"),
    ),
    Transform(
        name="Replace -NH₂ with -NHAc",
        description="Amine → acetamide: reduces basicity, may improve metabolic stability",
        fn=_make_transform("[NH2:1]>>[NH:1]C(=O)C"),
    ),
    Transform(
        name="Add methyl at aromatic C-H",
        description="Aromatic C-H → C-CH₃: can block metabolic soft spots",
        fn=_make_transform("[cH:1]>>[c:1]C"),
    ),
    Transform(
        name="Replace -Cl with -F",
        description="Chlorine → fluorine: smaller, stronger C-F bond, altered electronics",
        fn=_make_transform("[Cl:1]>>[F:1]"),
    ),
    Transform(
        name="Replace -COOH with -CONH₂",
        description="Carboxylic acid → primary amide: removes ionizable group, may improve cell permeability",
        fn=_make_transform("[C:1](=O)[OH]>>[C:1](=O)N"),
    ),
    Transform(
        name="Add fluorine at aromatic C-H",
        description="Aromatic C-H → C-F: blocks CYP-mediated oxidation at that position",
        fn=_make_transform("[cH:1]>>[c:1]F"),
    ),
    Transform(
        name="N-methylation of NH",
        description="Secondary amine → tertiary amine: increases lipophilicity, blocks H-bond donation",
        fn=_make_transform("[NH:1]>>[N:1]C"),
    ),
    Transform(
        name="Replace -OCH₃ with -OH",
        description="Methoxy → hydroxyl: increases polarity and H-bond donation capacity",
        fn=_make_transform("[O:1]([CH3])>>[O:1]"),
    ),
    Transform(
        name="Ester to amide",
        description="Ester → amide: greatly improves metabolic stability (resists esterases)",
        fn=_make_transform("[C:1](=O)[O:2][C:3]>>[C:1](=O)[NH:2][C:3]"),
    ),
    Transform(
        name="Replace -Br with -CN",
        description="Bromide → nitrile: introduces H-bond acceptor, changes electronic properties",
        fn=_make_transform("[Br:1]>>[C:1]#N"),
    ),
    Transform(
        name="Replace -Cl with -CN",
        description="Chloride → nitrile: introduces H-bond acceptor, metabolically stable",
        fn=_make_transform("[Cl:1]>>[C:1]#N"),
    ),
]
