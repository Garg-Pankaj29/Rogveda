"""
ROGVEDA — Modification Service (Phase 4 / Phase 12)

A library of predefined medicinal-chemistry structural transforms and live mutation workbench.
Each transform applies a SMARTS-based reaction and returns the canonical SMILES of the product,
or None if the transform does not apply to the input molecule.

These transforms are the single source of truth used by:
1. Live Mutation Workbench (Phase 4)
2. Individual-apply UI and Ketcher editor
3. analog_service shortlist scorer (Phase 12)
4. remediation_service toxicity risk remover (Phase 13)
5. Lead Optimization War Room candidate generator (Phase 1)
"""

import logging
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem

# Suppress noisy RDKit warnings
RDLogger.logger().setLevel(RDLogger.ERROR)

logger = logging.getLogger(__name__)


# ── Transform Catalog Definitions ────────────────────────────────────────

TRANSFORM_CATALOG: List[Dict[str, str]] = [
    {
        "id": "oh_to_ome",
        "name": "Replace -OH with -OCH₃",
        "description": "Hydroxyl → methoxy: increases lipophilicity, may improve membrane permeability",
        "category": "Polarity Tuning",
        "target_group": "Hydroxyl (-OH)",
        "target_smarts": "[OH:1]",
        "rxn_smarts": "[OH:1]>>[O:1]C",
        "unavailability_reason": "No free hydroxyl (-OH) group found in parent structure.",
    },
    {
        "id": "oh_to_f",
        "name": "Replace -OH with -F",
        "description": "Hydroxyl → fluorine bioisostere: blocks metabolism at that position",
        "category": "Bioisosteric Replacement",
        "target_group": "Hydroxyl (-OH)",
        "target_smarts": "[OH:1]",
        "rxn_smarts": "[OH:1]>>[F:1]",
        "unavailability_reason": "No free hydroxyl (-OH) group found in parent structure.",
    },
    {
        "id": "nh2_to_nhac",
        "name": "Replace -NH₂ with -NHAc",
        "description": "Amine → acetamide: reduces basicity, may improve metabolic stability",
        "category": "Metabolic Blocking",
        "target_group": "Primary Amine (-NH₂)",
        "target_smarts": "[NH2:1]",
        "rxn_smarts": "[NH2:1]>>[NH:1]C(=O)C",
        "unavailability_reason": "No primary aliphatic or aromatic amine (-NH₂) found in parent structure.",
    },
    {
        "id": "aromatic_ch_to_methyl",
        "name": "Add methyl at aromatic C-H",
        "description": "Aromatic C-H → C-CH₃: can block metabolic soft spots",
        "category": "Metabolic Blocking",
        "target_group": "Aromatic C-H",
        "target_smarts": "[cH:1]",
        "rxn_smarts": "[cH:1]>>[c:1]C",
        "unavailability_reason": "No unsubstituted aromatic C-H positions found in parent structure.",
    },
    {
        "id": "cl_to_f",
        "name": "Replace -Cl with -F",
        "description": "Chlorine → fluorine: smaller, stronger C-F bond, altered electronics",
        "category": "Bioisosteric Replacement",
        "target_group": "Chlorine (-Cl)",
        "target_smarts": "[Cl:1]",
        "rxn_smarts": "[Cl:1]>>[F:1]",
        "unavailability_reason": "No chlorine (-Cl) substituents found in parent structure.",
    },
    {
        "id": "cooh_to_conh2",
        "name": "Replace -COOH with -CONH₂",
        "description": "Carboxylic acid → primary amide: removes ionizable group, may improve cell permeability",
        "category": "Bioisosteric Replacement",
        "target_group": "Carboxylic Acid (-COOH)",
        "target_smarts": "[C:1](=O)[OH]",
        "rxn_smarts": "[C:1](=O)[OH]>>[C:1](=O)N",
        "unavailability_reason": "No carboxylic acid (-COOH) group found in parent structure.",
    },
    {
        "id": "aromatic_ch_to_f",
        "name": "Add fluorine at aromatic C-H",
        "description": "Aromatic C-H → C-F: blocks CYP-mediated oxidation at that position",
        "category": "Metabolic Blocking",
        "target_group": "Aromatic C-H",
        "target_smarts": "[cH:1]",
        "rxn_smarts": "[cH:1]>>[c:1]F",
        "unavailability_reason": "No unsubstituted aromatic C-H positions found in parent structure.",
    },
    {
        "id": "n_methylation",
        "name": "N-methylation of NH",
        "description": "Secondary amine → tertiary amine: increases lipophilicity, blocks H-bond donation",
        "category": "Polarity Tuning",
        "target_group": "Secondary Amine/Amide (-NH-)",
        "target_smarts": "[NH:1]",
        "rxn_smarts": "[NH:1]>>[N:1]C",
        "unavailability_reason": "No secondary amine or amide NH found in parent structure.",
    },
    {
        "id": "ome_to_oh",
        "name": "Replace -OCH₃ with -OH",
        "description": "Methoxy → hydroxyl: increases polarity and H-bond donation capacity",
        "category": "Polarity Tuning",
        "target_group": "Methoxy (-OCH₃)",
        "target_smarts": "[O:1]([CH3])",
        "rxn_smarts": "[O:1]([CH3])>>[O:1]",
        "unavailability_reason": "No methoxy (-OCH₃) ether group found in parent structure.",
    },
    {
        "id": "ester_to_amide",
        "name": "Ester to amide",
        "description": "Ester → amide: greatly improves metabolic stability (resists esterases)",
        "category": "Esterase Resistance",
        "target_group": "Ester Linkage (-COO-C)",
        "target_smarts": "[C:1](=O)[O:2][C:3]",
        "rxn_smarts": "[C:1](=O)[O:2][C:3]>>[C:1](=O)[NH:2][C:3]",
        "unavailability_reason": "No ester linkage (-COO-C) found in parent structure.",
    },
    {
        "id": "br_to_cn",
        "name": "Replace -Br with -CN",
        "description": "Bromide → nitrile: introduces H-bond acceptor, changes electronic properties",
        "category": "Bioisosteric Replacement",
        "target_group": "Bromine (-Br)",
        "target_smarts": "[Br:1]",
        "rxn_smarts": "[Br:1]>>[C:1]#N",
        "unavailability_reason": "No bromine (-Br) substituents found in parent structure.",
    },
    {
        "id": "cl_to_cn",
        "name": "Replace -Cl with -CN",
        "description": "Chloride → nitrile: introduces H-bond acceptor, metabolically stable",
        "category": "Bioisosteric Replacement",
        "target_group": "Chlorine (-Cl)",
        "target_smarts": "[Cl:1]",
        "rxn_smarts": "[Cl:1]>>[C:1]#N",
        "unavailability_reason": "No chlorine (-Cl) substituents found in parent structure.",
    },
]


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


# ── Transform definitions (Backward Compatible) ─────────────────────────

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


# Built directly from TRANSFORM_CATALOG so modification_service, analog_service,
# and remediation_service share the exact same source of truth.
TRANSFORMS: List[Transform] = [
    Transform(
        name=t["name"],
        description=t["description"],
        fn=_make_transform(t["rxn_smarts"]),
    )
    for t in TRANSFORM_CATALOG
]


# ── Catalog Retrieval ────────────────────────────────────────────────────

def get_transform_catalog() -> List[Dict[str, str]]:
    """Return all 12 registered medicinal chemistry transforms with metadata."""
    return [
        {
            "id": t["id"],
            "name": t["name"],
            "description": t["description"],
            "category": t["category"],
            "target_group": t["target_group"],
            "rxn_smarts": t["rxn_smarts"],
        }
        for t in TRANSFORM_CATALOG
    ]


# ── Applicability & Ambiguity Evaluation (Phase 4) ──────────────────────

def evaluate_applicable_mutations(smiles: str) -> Dict[str, Any]:
    """
    Evaluate which of the 12 catalog transforms apply to the given molecule.
    Returns match counts, unavailability reasons, product previews, and
    variant counts (surfacing positional isomer ambiguity).
    """
    if not smiles or not isinstance(smiles, str) or not smiles.strip():
        raise ValueError("A valid non-empty SMILES string is required.")

    mol = Chem.MolFromSmiles(smiles.strip())
    if mol is None:
        raise ValueError("Invalid SMILES string could not be parsed by RDKit.")

    try:
        Chem.SanitizeMol(mol)
    except Exception as e:
        raise ValueError(f"SMILES sanitization failed: {str(e)}")

    canonical_parent = Chem.MolToSmiles(mol, canonical=True)

    evaluated_transforms = []
    applicable_count = 0

    for item in TRANSFORM_CATALOG:
        t_id = item["id"]
        t_name = item["name"]
        t_desc = item["description"]
        category = item["category"]
        target_group = item["target_group"]
        target_smarts = item["target_smarts"]
        rxn_smarts = item["rxn_smarts"]
        default_unavail = item["unavailability_reason"]

        try:
            patt = Chem.MolFromSmarts(target_smarts)
            matches = mol.GetSubstructMatches(patt) if patt else ()
            match_count = len(matches)
        except Exception:
            match_count = 0

        if match_count == 0:
            evaluated_transforms.append({
                "id": t_id,
                "name": t_name,
                "description": t_desc,
                "category": category,
                "target_group": target_group,
                "is_applicable": False,
                "applicable": False,
                "match_count": 0,
                "substructure_matches": 0,
                "unavailability_reason": default_unavail,
                "preview_smiles": None,
                "has_multiple_products": False,
                "product_variants_count": 0,
                "variants": [],
            })
            continue

        # Substructure exists; run reaction to get all sanitized distinct products
        try:
            rxn = AllChem.ReactionFromSmarts(rxn_smarts)
            product_sets = rxn.RunReactants((mol,))
        except Exception as e:
            logger.warning("Reaction execution failed for %s: %s", t_name, e)
            product_sets = ()

        unique_variants: List[str] = []
        seen = set()

        for p_set in product_sets:
            if not p_set:
                continue
            p_mol = p_set[0]
            try:
                Chem.SanitizeMol(p_mol)
                p_smi = Chem.MolToSmiles(p_mol, canonical=True)
                # Must be chemically distinct from the parent and non-duplicate
                if p_smi != canonical_parent and p_smi not in seen:
                    # Validate product parses back
                    if Chem.MolFromSmiles(p_smi) is not None:
                        seen.add(p_smi)
                        unique_variants.append(p_smi)
            except Exception:
                continue

        if not unique_variants:
            evaluated_transforms.append({
                "id": t_id,
                "name": t_name,
                "description": t_desc,
                "category": category,
                "target_group": target_group,
                "is_applicable": False,
                "applicable": False,
                "match_count": match_count,
                "substructure_matches": match_count,
                "unavailability_reason": "Target motif matched, but reaction produced no valid distinct sanitizable product.",
                "preview_smiles": None,
                "has_multiple_products": False,
                "product_variants_count": 0,
                "variants": [],
            })
        else:
            applicable_count += 1
            evaluated_transforms.append({
                "id": t_id,
                "name": t_name,
                "description": t_desc,
                "category": category,
                "target_group": target_group,
                "is_applicable": True,
                "applicable": True,
                "match_count": match_count,
                "substructure_matches": match_count,
                "unavailability_reason": None,
                "preview_smiles": unique_variants[0],
                "has_multiple_products": len(unique_variants) > 1,
                "product_variants_count": len(unique_variants),
                "variants": unique_variants,
            })

    return {
        "parent_smiles": canonical_parent,
        "smiles": canonical_parent,
        "total_transforms": len(TRANSFORM_CATALOG),
        "applicable_count": applicable_count,
        "num_applicable": applicable_count,
        "num_unavailable": len(TRANSFORM_CATALOG) - applicable_count,
        "transforms": evaluated_transforms,
    }


# ── Property Deltas Helper ───────────────────────────────────────────────

def _compute_property_deltas(parent_props: Dict[str, Any], candidate_props: Dict[str, Any]) -> Dict[str, Any]:
    """Compute signed before/after deltas for key physicochemical properties."""
    tracked = [
        ("mw", "Molecular Weight", 2, "Da"),
        ("molecular_weight", "Molecular Weight", 2, "Da"),
        ("logp", "LogP", 2, ""),
        ("logP", "LogP", 2, ""),
        ("tpsa", "TPSA", 2, "Å²"),
        ("hbd", "H-Bond Donors", 0, ""),
        ("hba", "H-Bond Acceptors", 0, ""),
        ("rotatable_bonds", "Rotatable Bonds", 0, ""),
        ("rotBonds", "Rotatable Bonds", 0, ""),
        ("aromatic_rings", "Aromatic Rings", 0, ""),
        ("heavy_atoms", "Heavy Atoms", 0, ""),
        ("heavyAtoms", "Heavy Atoms", 0, ""),
        ("fraction_csp3", "Fraction Csp3", 3, ""),
        ("fractionCsp3", "Fraction Csp3", 3, ""),
    ]

    deltas: Dict[str, Any] = {}
    seen_labels = set()

    for key, label, dec, unit in tracked:
        if label in seen_labels:
            continue
        p_val = parent_props.get(key)
        c_val = candidate_props.get(key)
        if p_val is not None and c_val is not None and p_val != "-" and c_val != "-":
            try:
                p_num = float(p_val)
                c_num = float(c_val)
                diff = round(c_num - p_num, dec) if dec > 0 else int(round(c_num - p_num))
                delta_str = f"+{diff}" if diff > 0 else str(diff)
                p_disp = round(p_num, dec) if dec > 0 else int(round(p_num))
                c_disp = round(c_num, dec) if dec > 0 else int(round(c_num))
                deltas[key] = {
                    "label": label,
                    "parent": p_disp,
                    "parent_val": p_disp,
                    "candidate": c_disp,
                    "candidate_val": c_disp,
                    "delta": delta_str,
                    "unit": unit,
                }
                seen_labels.add(label)
            except (ValueError, TypeError):
                pass
    return deltas


# ── Model Prediction Helper ──────────────────────────────────────────────

def _predict_endpoints(smiles: str) -> List[Dict[str, Any]]:
    """Predict bioactivity and ADMET liabilities for a candidate molecule."""
    from app.services import ml_service
    from app.services.analog_service import ALL_ENDPOINTS, RISK_ENDPOINTS

    predictions = []
    for ep in ALL_ENDPOINTS:
        is_risk = ep["id"] in RISK_ENDPOINTS
        category = "ADMET Risk" if is_risk else "Bioactivity"
        try:
            pred = ml_service.predict_endpoint(smiles, ep["id"])
            if is_risk:
                status = "High Risk" if "likely active" in pred.label else "Low Risk"
            else:
                status = "Active" if "likely active" in pred.label else "Inactive"
            prob = round(float(pred.probability_active), 4)
            predictions.append({
                "endpoint_id": ep["id"],
                "endpoint_name": ep["name"],
                "category": category,
                "status_label": status,
                "confidence": prob,
                "probability": prob,
                "available": True,
                "threshold": getattr(pred, "threshold", 0.5),
            })
        except FileNotFoundError:
            predictions.append({
                "endpoint_id": ep["id"],
                "endpoint_name": ep["name"],
                "category": category,
                "status_label": "Model not installed",
                "confidence": None,
                "probability": None,
                "available": False,
                "threshold": None,
            })
        except Exception as e:
            logger.warning("Prediction failed for %s on %s: %s", ep["id"], smiles, e)
            predictions.append({
                "endpoint_id": ep["id"],
                "endpoint_name": ep["name"],
                "category": category,
                "status_label": "Unavailable",
                "confidence": None,
                "probability": None,
                "available": False,
                "threshold": None,
            })
    return predictions


def _compute_full_properties(smiles: str) -> Dict[str, Any]:
    """Calculate deterministic molecular properties and descriptors using RDKit."""
    from rdkit.Chem import Descriptors, rdMolDescriptors
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: '{smiles}'")
    
    mw = round(Descriptors.MolWt(mol), 2)
    logp = round(Descriptors.MolLogP(mol), 2)
    tpsa = round(Descriptors.TPSA(mol), 2)
    formula = rdMolDescriptors.CalcMolFormula(mol)
    hbd = int(Descriptors.NumHDonors(mol))
    hba = int(Descriptors.NumHAcceptors(mol))
    rotb = int(Descriptors.NumRotatableBonds(mol))
    arom = int(rdMolDescriptors.CalcNumAromaticRings(mol))
    heavy = int(mol.GetNumHeavyAtoms())
    fcsp3 = round(Descriptors.FractionCSP3(mol), 3)

    return {
        "molecular_weight": mw,
        "mw": mw,
        "formula": formula,
        "logp": logp,
        "logP": logp,
        "tpsa": tpsa,
        "hbd": hbd,
        "hba": hba,
        "rotatable_bonds": rotb,
        "rotBonds": rotb,
        "aromatic_rings": arom,
        "heavy_atoms": heavy,
        "heavyAtoms": heavy,
        "fraction_csp3": fcsp3,
        "fractionCsp3": fcsp3,
    }


# ── Apply Live Mutation (Phase 4) ───────────────────────────────────────

def apply_mutation(smiles: str, transform_id_or_name: str, variant_index: int = 0) -> Dict[str, Any]:
    """
    Apply a selected catalog transform to a molecule.
    Returns candidate product, physicochemical properties, signed property deltas,
    and updated independent ML predictions.

    Does not modify the parent in place.
    """
    start_time = time.perf_counter()
    if not smiles or not isinstance(smiles, str) or not smiles.strip():
        raise ValueError("A valid non-empty SMILES string is required.")

    mol = Chem.MolFromSmiles(smiles.strip())
    if mol is None:
        raise ValueError("Invalid SMILES string could not be parsed by RDKit.")

    try:
        Chem.SanitizeMol(mol)
    except Exception as e:
        raise ValueError(f"Parent SMILES sanitization failed: {str(e)}")

    canonical_parent = Chem.MolToSmiles(mol, canonical=True)

    # Locate transform by id or case-insensitive name
    key = transform_id_or_name.strip()
    transform_item = next(
        (t for t in TRANSFORM_CATALOG if t["id"] == key or t["name"].lower() == key.lower()),
        None
    )
    if not transform_item:
        raise ValueError(f"Unknown transform '{transform_id_or_name}'. Must match one of the 12 registered transforms.")

    # Match count
    try:
        patt = Chem.MolFromSmarts(transform_item["target_smarts"])
        matches = mol.GetSubstructMatches(patt) if patt else ()
        match_count = len(matches)
    except Exception:
        match_count = 0

    if match_count == 0:
        raise ValueError(
            f"Transform '{transform_item['name']}' is not applicable to {canonical_parent}. "
            f"{transform_item['unavailability_reason']}"
        )

    # Run reaction
    try:
        rxn = AllChem.ReactionFromSmarts(transform_item["rxn_smarts"])
        product_sets = rxn.RunReactants((mol,))
    except Exception as e:
        raise ValueError(f"Reaction execution failed for '{transform_item['name']}': {str(e)}")

    unique_variants: List[str] = []
    seen = set()

    for p_set in product_sets:
        if not p_set:
            continue
        p_mol = p_set[0]
        try:
            Chem.SanitizeMol(p_mol)
            p_smi = Chem.MolToSmiles(p_mol, canonical=True)
            if p_smi != canonical_parent and p_smi not in seen:
                if Chem.MolFromSmiles(p_smi) is not None:
                    seen.add(p_smi)
                    unique_variants.append(p_smi)
        except Exception:
            continue

    if not unique_variants:
        raise ValueError(
            f"Transform '{transform_item['name']}' yielded no valid, sanitizable products distinct from parent."
        )

    # Resolve variant index
    if variant_index < 0 or variant_index >= len(unique_variants):
        variant_index = 0
    candidate_smiles = unique_variants[variant_index]

    if candidate_smiles == canonical_parent:
        raise ValueError("Candidate product is identical to parent molecule; no chemical change occurred.")

    # Compute properties
    parent_props = _compute_full_properties(canonical_parent)
    candidate_props = _compute_full_properties(candidate_smiles)
    property_deltas = _compute_property_deltas(parent_props, candidate_props)

    # Independent model predictions
    parent_preds = _predict_endpoints(canonical_parent)
    candidate_preds = _predict_endpoints(candidate_smiles)

    timing_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return {
        "parent_smiles": canonical_parent,
        "candidate_smiles": candidate_smiles,
        "candidate_formula": candidate_props.get("formula", ""),
        "transform_id": transform_item["id"],
        "transform_name": transform_item["name"],
        "transform_description": transform_item["description"],
        "category": transform_item["category"],
        "match_count": match_count,
        "has_multiple_products": len(unique_variants) > 1,
        "variant_index": variant_index,
        "selected_variant_index": variant_index,
        "total_variants": len(unique_variants),
        "variants": unique_variants,
        "parent_properties": parent_props,
        "candidate_properties": candidate_props,
        "property_deltas": property_deltas,
        "property_deltas_list": list(property_deltas.values()),
        "parent_predictions": parent_preds,
        "candidate_predictions": candidate_preds,
        "predictions": candidate_preds,
        "timing_ms": timing_ms,
        "is_distinct": True,
    }
