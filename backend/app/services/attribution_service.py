"""
ROGVEDA — Explainable Molecular Attribution Service (Phase 2)

Calculates deterministic atom- and bond-level feature attributions for trained ML
models using atomic environment perturbation (RDKit Morgan Fingerprint SimilarityMaps).
Extracts independent structural alerts (PAINS, BRENK, NIH) using RDKit FilterCatalog.
"""

import logging
from typing import Dict, List, Optional, Tuple
import numpy as np

from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem
from rdkit.Chem.Draw import SimilarityMaps, rdMolDraw2D
from rdkit.Chem.FilterCatalog import FilterCatalog, FilterCatalogParams

from app.services import ml_service
from app.schemas.attribution_schemas import (
    AtomAttribution,
    BondAttribution,
    StructuralAlertMatch,
    AttributionResponse,
)

RDLogger.logger().setLevel(RDLogger.ERROR)
logger = logging.getLogger(__name__)

# Endpoint metadata and display names
ENDPOINT_NAMES: Dict[str, str] = {
    "herg": "hERG Cardiotoxicity",
    "antiinflammatory": "Anti-inflammatory",
    "antioxidant": "Antioxidant",
    "antimicrobial": "Antimicrobial",
    "anticancer": "Anticancer",
    "tox21_mmp": "Tox21 Mitochondrial Toxicity",
    "clintox": "Clinical Toxicity (ClinTox)",
    "tox21": "Tox21 Stress Response",
}

# Liability endpoints where higher probability indicates greater toxic liability
LIABILITY_ENDPOINTS = {"herg", "tox21_mmp", "clintox", "tox21"}

# Initialize FilterCatalog once for structural alert detection
_filter_catalog = None


def _get_filter_catalog() -> FilterCatalog:
    global _filter_catalog
    if _filter_catalog is None:
        params = FilterCatalogParams()
        params.AddCatalog(FilterCatalogParams.FilterCatalogs.PAINS)
        params.AddCatalog(FilterCatalogParams.FilterCatalogs.BRENK)
        params.AddCatalog(FilterCatalogParams.FilterCatalogs.NIH)
        _filter_catalog = FilterCatalog(params)
    return _filter_catalog


# In-memory LRU-like cache for explanation results
_attribution_cache: Dict[Tuple[str, str, int], AttributionResponse] = {}


def detect_structural_alerts(mol: Chem.Mol) -> List[StructuralAlertMatch]:
    """Detect independent structural alerts (PAINS, Brenk, NIH) using RDKit FilterCatalog."""
    catalog = _get_filter_catalog()
    matches = catalog.GetMatches(mol)
    results = []

    for entry in matches:
        desc = entry.GetDescription()
        # Classify rule set from description or entry
        rule_set = "PAINS" if "pains" in desc.lower() else ("BRENK" if "brenk" in desc.lower() else "NIH")
        
        # Extract matched target atom indices
        matched_atoms_set = set()
        for filter_match in entry.GetFilterMatches(mol):
            for _, target_atom_idx in filter_match.atomPairs:
                matched_atoms_set.add(int(target_atom_idx))

        results.append(
            StructuralAlertMatch(
                rule_set=rule_set,
                alert_name=desc,
                matched_atoms=sorted(list(matched_atoms_set)),
                description=f"Matched filter catalog alert: {desc}",
            )
        )

    return results


def _compute_atomic_weights(mol: Chem.Mol, model) -> List[float]:
    """
    Compute atomic attribution weights using batched Morgan fingerprint environment removal.
    Weight_i = P(mol) - P(mol \\ atom_i environment)
    """
    num_atoms = mol.GetNumAtoms()
    if num_atoms == 0:
        return []

    # Reset RDKit's internal fingerprint cache on mol
    SimilarityMaps._DeleteFpInfoAttr(mol)
    
    # Generate base fingerprint (-1 indicates full molecule, no atoms removed)
    base_fp = SimilarityMaps.GetMorganFingerprint(mol, -1, radius=2, nBits=2048)
    
    # Generate atom-ablated fingerprints
    fps = [base_fp]
    for atom_idx in range(num_atoms):
        fps.append(SimilarityMaps.GetMorganFingerprint(mol, atom_idx, radius=2, nBits=2048))
        
    SimilarityMaps._DeleteFpInfoAttr(mol)

    # Convert to batched 2D numpy array for efficient single-pass prediction
    X = np.empty((len(fps), 2048), dtype=np.int8)
    for i, fp in enumerate(fps):
        X[i] = fp

    # Model evaluation
    probs = model.predict_proba(X)[:, 1]
    base_prob = float(probs[0])
    weights = [float(base_prob - p) for p in probs[1:]]

    return weights


def _generate_highlighted_svg(
    mol: Chem.Mol,
    atom_attributions: List[AtomAttribution],
    bond_attributions: List[BondAttribution],
    structural_alerts: List[StructuralAlertMatch],
    is_liability: bool,
    width: int = 440,
    height: int = 320,
) -> str:
    """Generate dark-mode compatible RDKit SVG depicting atom and bond attributions."""
    drawer = rdMolDraw2D.MolDraw2DSVG(width, height)
    opts = drawer.drawOptions()
    opts.clearBackground = False
    opts.bondLineWidth = 2

    # Map atom colors and radii
    atom_colors = {}
    atom_radii = {}
    
    # Collect alert atom indices for distinct outline
    alert_atoms = set()
    for alert in structural_alerts:
        alert_atoms.update(alert.matched_atoms)

    for attr in atom_attributions:
        idx = attr.atom_index
        intensity = abs(attr.normalized_intensity)
        
        if intensity < 0.05 and idx not in alert_atoms:
            continue

        radius = max(0.22, min(0.48, 0.22 + intensity * 0.26))
        atom_radii[idx] = radius

        if idx in alert_atoms and intensity < 0.15:
            # Highlight structural alert in distinctive purple
            atom_colors[idx] = (0.75, 0.45, 0.95, 0.6)
        elif attr.direction == "positive":
            if is_liability:
                # Increases toxicity risk -> Rose/Coral
                atom_colors[idx] = (0.96, 0.25, 0.37, 0.55 + 0.35 * intensity)
            else:
                # Increases desired activity -> Emerald Green
                atom_colors[idx] = (0.06, 0.73, 0.51, 0.55 + 0.35 * intensity)
        elif attr.direction == "negative":
            if is_liability:
                # Decreases toxicity risk (protective) -> Cyan/Teal
                atom_colors[idx] = (0.18, 0.83, 0.83, 0.55 + 0.35 * intensity)
            else:
                # Decreases desired activity -> Amber
                atom_colors[idx] = (0.96, 0.62, 0.04, 0.55 + 0.35 * intensity)
        else:
            atom_colors[idx] = (0.4, 0.45, 0.55, 0.3)

    # Map bond colors
    bond_colors = {}
    for b_attr in bond_attributions:
        b_idx = b_attr.bond_index
        b_intensity = abs(b_attr.normalized_intensity)
        if b_intensity < 0.08:
            continue

        if b_attr.direction == "positive":
            if is_liability:
                bond_colors[b_idx] = (0.96, 0.25, 0.37, 0.45 + 0.35 * b_intensity)
            else:
                bond_colors[b_idx] = (0.06, 0.73, 0.51, 0.45 + 0.35 * b_intensity)
        elif b_attr.direction == "negative":
            if is_liability:
                bond_colors[b_idx] = (0.18, 0.83, 0.83, 0.45 + 0.35 * b_intensity)
            else:
                bond_colors[b_idx] = (0.96, 0.62, 0.04, 0.45 + 0.35 * b_intensity)

    drawer.DrawMolecule(
        mol,
        highlightAtoms=list(atom_colors.keys()),
        highlightAtomColors=atom_colors,
        highlightAtomRadii=atom_radii,
        highlightBonds=list(bond_colors.keys()),
        highlightBondColors=bond_colors,
    )
    drawer.FinishDrawing()
    svg = drawer.GetDrawingText()

    # Post-process SVG for seamless dark theme embedding
    import re
    svg = re.sub(r'<rect[^>]*fill=[\'"]#FFFFFF[\'"][^>]*>', '<rect opacity="0" fill="none" />', svg, flags=re.IGNORECASE)
    return svg


def explain_prediction(smiles: str, endpoint: str) -> AttributionResponse:
    """
    Generate explainable molecular attribution for a molecule and prediction endpoint.

    Returns structured atom/bond contributions, bit collision accounting, structural alerts,
    depiction SVG, and human-readable limitations.
    """
    # 1. Parse & canonicalize molecule
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: '{smiles}' — RDKit could not parse this chemical structure.")

    canonical = Chem.MolToSmiles(mol, canonical=True)
    mol = Chem.MolFromSmiles(canonical)
    endpoint = endpoint.strip().lower()
    endpoint_name = ENDPOINT_NAMES.get(endpoint, endpoint.replace("_", " ").title())

    # 2. Extract independent structural alerts (PAINS, BRENK, NIH)
    structural_alerts = detect_structural_alerts(mol)

    # 3. Verify model availability
    model_path = ml_service.MODELS_DIR / f"{endpoint}_model.pkl"
    if not model_path.exists():
        return AttributionResponse(
            canonical_smiles=canonical,
            endpoint=endpoint,
            endpoint_name=endpoint_name,
            is_available=False,
            unavailability_reason=f"No local machine-learning model is available for endpoint '{endpoint}'.",
            attribution_method="Unavailable",
            method_limitations="Model attribution cannot be computed without a trained model artifact.",
            atom_attributions=[],
            bond_attributions=[],
            structural_alerts=structural_alerts,
            highlighted_svg=None,
            summary_text="Attribution unavailable: model artifact not found.",
        )

    # Check cache
    cache_key = (canonical, endpoint, ml_service._metadatas.get(endpoint, {}).get("version", 1))
    if cache_key in _attribution_cache:
        return _attribution_cache[cache_key]

    # 4. Load model and run base prediction
    if endpoint not in ml_service._models:
        ml_service._load_model(endpoint)
    model = ml_service._models[endpoint]

    pred_result = ml_service.predict_endpoint(canonical, endpoint)
    threshold = ml_service.get_threshold(endpoint)
    is_liability = endpoint in LIABILITY_ENDPOINTS

    # 5. Featurize and track bit collisions
    info = {}
    AllChem.GetMorganFingerprintAsBitVect(mol, radius=2, nBits=2048, bitInfo=info)

    atom_bits: Dict[int, List[int]] = {i: [] for i in range(mol.GetNumAtoms())}
    bit_collision: Dict[int, bool] = {}

    for bit, envs in info.items():
        bit_collision[bit] = len(envs) > 1
        for center_at, rad in envs:
            if rad == 0:
                atom_bits[center_at].append(bit)
            else:
                env = Chem.FindAtomEnvironmentOfRadiusN(mol, rad, center_at)
                amap = {}
                Chem.PathToSubmol(mol, env, atomMap=amap)
                for at_idx in amap.keys():
                    atom_bits[at_idx].append(bit)

    # 6. Compute atomic weights via perturbation
    raw_weights = _compute_atomic_weights(mol, model)

    max_abs_weight = max([abs(w) for w in raw_weights]) if raw_weights else 0.0

    atom_attributions: List[AtomAttribution] = []
    for idx, (atom, weight) in enumerate(zip(mol.GetAtoms(), raw_weights)):
        norm_intensity = (weight / max_abs_weight) if max_abs_weight > 1e-6 else 0.0
        
        if abs(weight) < 1e-4:
            direction = "neutral"
        elif weight > 0:
            direction = "positive"
        else:
            direction = "negative"

        bits = sorted(list(set(atom_bits.get(idx, []))))
        has_coll = any(bit_collision.get(b, False) for b in bits)

        atom_attributions.append(
            AtomAttribution(
                atom_index=idx,
                atom_symbol=atom.GetSymbol(),
                raw_contribution=round(weight, 4),
                normalized_intensity=round(norm_intensity, 4),
                direction=direction,
                bit_count=len(bits),
                bit_ids=bits,
                has_collision=has_coll,
            )
        )

    # 7. Compute bond attributions
    bond_attributions: List[BondAttribution] = []
    for b_idx, bond in enumerate(mol.GetBonds()):
        u = bond.GetBeginAtomIdx()
        v = bond.GetEndAtomIdx()
        w_bond = (raw_weights[u] + raw_weights[v]) / 2.0
        norm_b_intensity = (w_bond / max_abs_weight) if max_abs_weight > 1e-6 else 0.0
        
        if abs(w_bond) < 1e-4:
            b_direction = "neutral"
        elif w_bond > 0:
            b_direction = "positive"
        else:
            b_direction = "negative"

        bond_attributions.append(
            BondAttribution(
                bond_index=b_idx,
                begin_atom_index=u,
                end_atom_index=v,
                raw_contribution=round(w_bond, 4),
                normalized_intensity=round(norm_b_intensity, 4),
                direction=b_direction,
            )
        )

    # 8. Generate highlighted SVG
    highlighted_svg = _generate_highlighted_svg(
        mol, atom_attributions, bond_attributions, structural_alerts, is_liability
    )

    # 9. Generate descriptive summary
    sorted_atoms = sorted(atom_attributions, key=lambda a: abs(a.raw_contribution), reverse=True)
    top_drivers = [a for a in sorted_atoms if a.direction != "neutral"][:3]
    
    driver_desc = ", ".join([f"Atom {a.atom_index} ({a.atom_symbol}, Δ={a.raw_contribution:+.3f})" for a in top_drivers])
    
    if is_liability:
        orientation_text = "Increasing predicted liability risk" if pred_result.probability_active >= threshold else "Low liability risk"
    else:
        orientation_text = "Promoting target activity" if pred_result.probability_active >= threshold else "Inactive profile"

    summary_text = (
        f"{endpoint_name} prediction: {pred_result.probability_active:.1%} ({pred_result.label}). "
        f"Key driving atoms: {driver_desc if driver_desc else 'Diffuse contributions across structure'}. "
        f"{len(structural_alerts)} independent structural alert(s) detected."
    )

    response = AttributionResponse(
        canonical_smiles=canonical,
        endpoint=endpoint,
        endpoint_name=endpoint_name,
        is_available=True,
        unavailability_reason=None,
        probability=pred_result.probability_active,
        threshold=threshold,
        label=pred_result.label,
        confidence=pred_result.confidence,
        model_name=ml_service._metadatas.get(endpoint, {}).get("model_name", f"{endpoint}_model"),
        model_version=pred_result.model_version,
        attribution_method="Morgan Fingerprint Atomic Environment Perturbation (SimilarityMaps)",
        method_limitations=(
            "Attribution scores reflect in-silico sensitivity when fingerprint bits overlapping each atom's "
            "2-bond topological neighborhood are masked. They indicate statistical model associations, "
            "not experimentally validated pharmacophores, toxicophores, or causal biological mechanisms."
        ),
        atom_attributions=atom_attributions,
        bond_attributions=bond_attributions,
        structural_alerts=structural_alerts,
        highlighted_svg=highlighted_svg,
        summary_text=summary_text,
    )

    # Save to cache
    _attribution_cache[cache_key] = response
    return response
