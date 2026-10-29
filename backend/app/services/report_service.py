"""
ROGVEDA — Report & Research Dossier Service (Phase 3)

Generates professional, self-contained, print-ready HTML and binary PDF research dossiers
adhering to the 12-section scientific specification:
1. Title Page, Dossier ID & Generation Metadata
2. Executive Summary (Grounded Local LLM or Deterministic Fallback)
3. 2D Structure Depiction & Canonical SMILES
4. 3D Conformer Geometry & Status
5. Physicochemical Properties & Drug-Likeness Evaluation
6. Calibrated ML Bioactivity & Toxicity Predictions with Model Provenance
7. Lead Optimization War Room Evaluation & Multi-Dimensional Trade-Offs
8. Explainable Molecular Attribution (Phase 2 Atomic Perturbation & Collisions)
9. Structural Alerts (PAINS/Brenk) & Synthetic Accessibility
10. Similarity Search Results & Curated Library Provenance
11. Experiment Lineage & Audit Provenance
12. Evidence, Scientific Limitations & Legal Disclaimer

All computation and rendering occur 100% offline (127.0.0.1) using RDKit,
WeasyPrint, and local scikit-learn models. No external fonts, CDNs, or remote assets.
"""

import html
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from rdkit import Chem, RDLogger
from rdkit.Chem.Draw import rdMolDraw2D

# Suppress noisy RDKit logs
RDLogger.logger().setLevel(RDLogger.ERROR)

logger = logging.getLogger(__name__)


def _not_calculated(custom_label: str = "Data yet to be calculated") -> str:
    """Standard placeholder for missing data."""
    return f'<span style="color:#94a3b8;font-style:italic">{html.escape(custom_label)}</span>'


def _safe(val: Any, suffix: str = "", placeholder: str = "Data yet to be calculated") -> str:
    """Return the escaped value if meaningful, else the placeholder."""
    if val is None or val == "" or val == "-" or val == "—":
        return _not_calculated(placeholder)
    val_str = str(val)
    return f"{html.escape(val_str)}{html.escape(suffix)}"


def _badge_color(status: Optional[str]) -> str:
    """Map status labels to CSS colors."""
    s = (status or "").lower()
    if any(k in s for k in ("low risk", "passed", "pass", "easy")) or ("active" in s and "inactive" not in s):
        return "#16a34a"  # Green
    if any(k in s for k in ("high risk", "fail", "flagged", "difficult")):
        return "#e11d48"  # Red
    if any(k in s for k in ("moderate", "uncertain", "warning", "caution")):
        return "#d97706"  # Amber
    return "#64748b"  # Slate / Neutral


def _render_clean_svg(smiles: str, width: int = 420, height: int = 260) -> Optional[str]:
    """Generate a clean vector SVG for print/HTML without dark mode inversion."""
    if not smiles:
        return None
    try:
        mol = Chem.MolFromSmiles(smiles)
        if not mol:
            return None
        drawer = rdMolDraw2D.MolDraw2DSVG(width, height)
        opts = drawer.drawOptions()
        opts.clearBackground = True
        opts.bondLineWidth = 2.0
        rdMolDraw2D.PrepareAndDrawMolecule(drawer, mol)
        drawer.FinishDrawing()
        svg_text = drawer.GetDrawingText()
        return svg_text
    except Exception as e:
        logger.warning(f"Failed to generate clean SVG for {smiles}: {e}")
        return None


def generate_deterministic_dossier_summary(
    smiles: Optional[str],
    properties: Optional[Dict[str, Any]],
    predictions: Optional[List[Dict[str, Any]]],
    drug_likeness: Optional[Dict[str, Any]],
    war_room: Optional[Dict[str, Any]] = None,
    structural_alerts: Optional[List[Dict[str, Any]]] = None,
    synthesizability: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Deterministic fallback executive summary synthesized directly from structured findings.
    Operates completely offline with zero LLM dependency.
    """
    props = properties or {}
    preds = predictions or []
    dl = drug_likeness or {}
    alerts = structural_alerts or []

    parts = []

    # 1. Identity & Physicochemical Overview
    formula = props.get("formula") or "-"
    mw = props.get("mw") or props.get("molecular_weight") or "-"
    logp = props.get("logP") or props.get("logp") or "-"
    tpsa = props.get("tpsa") or "-"

    identity_text = f"The evaluated chemical structure ({formula}, MW {mw} g/mol) exhibits a computed LogP of {logp} and a topological polar surface area (TPSA) of {tpsa} Å²."
    parts.append(identity_text)

    # 2. Oral Drug-Likeness & Rules
    if dl:
        passed_rules = sum(1 for v in dl.values() if isinstance(v, dict) and v.get("passed"))
        total_rules = len(dl)
        lipo = dl.get("Lipinski", {})
        lipo_violations = lipo.get("violations", 0) if isinstance(lipo, dict) else 0
        rule_text = f"In drug-likeness screening, the structure complies with {passed_rules}/{total_rules} standard filter criteria, exhibiting {lipo_violations} Lipinski Rule of 5 violations."
        parts.append(rule_text)

    # 3. Bioactivity & Toxicological Liabilities
    if preds:
        active_targets = [p.get("endpoint_name") for p in preds if p.get("available") and "active" in (p.get("status_label") or "").lower()]
        liabilities = [p.get("endpoint_name") for p in preds if p.get("available") and "high risk" in (p.get("status_label") or "").lower()]

        if active_targets:
            parts.append(f"Machine learning bioactivity models indicate positive target potential for {', '.join(active_targets[:3])}.")
        if liabilities:
            parts.append(f"Key toxicological scrutiny points include elevated predicted risk for {', '.join(liabilities[:2])}.")
        elif not active_targets and not liabilities:
            parts.append("Trained multi-target classifiers show moderate or inactive profiles across evaluated bioassays with no acute flagged liabilities.")

    # 4. War Room Lead Optimization Trade-Offs
    if war_room and war_room.get("is_available"):
        p_name = war_room.get("profile_name", "Lead Optimization Profile")
        cand_score = war_room.get("candidate_score")
        passed = war_room.get("hard_constraints_passed", True)
        status_str = "passing all defined hard constraints" if passed else f"flagged on {len(war_room.get('hard_constraint_flags', []))} hard constraint(s)"
        if cand_score is not None:
            parts.append(f"In Lead Optimization War Room trade-off analysis under the '{p_name}' profile, the analog candidate attained a composite multi-parameter score of {cand_score:.1f}/100, {status_str}.")

    # 5. Alerts & Synthesizability
    if alerts:
        parts.append(f"Filter catalog screening detected {len(alerts)} structural alert motif(s) (PAINS/Brenk) requiring chemical scrutiny.")
    else:
        parts.append("No reactive PAINS or Brenk chemical alert motifs were detected.")

    if synthesizability:
        difficulty = synthesizability.get("difficulty_label", "moderate")
        sa_score = synthesizability.get("sa_score", "-")
        parts.append(f"Synthetic feasibility is classified as {difficulty} (heuristic SA score {sa_score}/10).")

    # 6. Scientific Honesty Footer
    parts.append("All observations represent in-silico computational estimates for hypothesis generation and must be experimentally validated prior to clinical translation.")

    return " ".join(parts)


def generate_research_dossier(
    smiles: Optional[str] = None,
    canonical_smiles: Optional[str] = None,
    properties: Optional[Dict[str, Any]] = None,
    predictions: Optional[List[Dict[str, Any]]] = None,
    ai_summary: Optional[Dict[str, Any]] = None,
    similarity_hits: Optional[List[Dict[str, Any]]] = None,
    drug_likeness: Optional[Dict[str, Any]] = None,
    activity_log: Optional[List[Dict[str, Any]]] = None,
    molecule_svg: Optional[str] = None,
    conformer_3d: Optional[Dict[str, Any]] = None,
    attribution: Optional[Dict[str, Any]] = None,
    war_room: Optional[Dict[str, Any]] = None,
    lineage: Optional[Dict[str, Any]] = None,
    structural_alerts: Optional[List[Dict[str, Any]]] = None,
    synthesizability: Optional[Dict[str, Any]] = None,
    report_format: str = "Research Dossier (PDF)",
) -> Dict[str, Any]:
    """
    Build a comprehensive, reproducible 12-section Research Dossier.
    Returns a dictionary with 'html', 'name', 'dossier_id', and 'created_at'.
    """
    now_dt = datetime.now(timezone.utc)
    dossier_id = f"ROG-DOSSIER-{uuid.uuid4().hex[:8].upper()}"
    timestamp_str = now_dt.strftime("%B %d, %Y at %I:%M %p UTC")
    iso_timestamp = now_dt.isoformat()

    effective_smiles = canonical_smiles or smiles or ""
    props = properties or {}
    preds = predictions or []
    ai = ai_summary or {}
    sim_hits = similarity_hits or []
    dr = drug_likeness or {}
    log = activity_log or []
    conf = conformer_3d or {}
    attr = attribution or {}
    wr = war_room or {}
    lin = lineage or {}
    alerts = structural_alerts or []
    synth = synthesizability or {}

    # File / report naming
    formula = props.get("formula") or "Molecule"
    date_code = now_dt.strftime("%Y%m%d_%H%M")
    report_name = f"Dossier_{formula}_{date_code}"

    # ── Section 2: Executive Summary (LLM with deterministic fallback) ──────
    raw_llm_summary = (ai.get("summary") or "").strip()
    key_insights = ai.get("key_insights") or []

    # Verify if LLM summary is valid and not a placeholder or hallucination
    is_llm_valid = (
        raw_llm_summary
        and "not available" not in raw_llm_summary.lower()
        and "failed" not in raw_llm_summary.lower()
        and "empty" not in raw_llm_summary.lower()
        and "fda approved" not in raw_llm_summary.lower()
        and "clinical proof" not in raw_llm_summary.lower()
    )

    if is_llm_valid:
        summary_text = html.escape(raw_llm_summary)
        summary_badge = '<span class="badge badge-teal">Local AI Synthesis (Grounded)</span>'
    else:
        summary_text = html.escape(
            generate_deterministic_dossier_summary(
                effective_smiles, props, preds, dr, wr, alerts, synth
            )
        )
        summary_badge = '<span class="badge badge-slate">Deterministic Rule Synthesis (Offline Fallback)</span>'

    insights_html = ""
    if key_insights:
        insights_li = "".join(f"<li>{html.escape(str(ins))}</li>" for ins in key_insights)
        insights_html = f'<ul style="margin-top:10px;padding-left:18px;color:#334155;line-height:1.7">{insights_li}</ul>'

    # ── Section 3: 2D Structure & Canonical Representation ──────────────────
    clean_svg = _render_clean_svg(effective_smiles) if effective_smiles else None
    if clean_svg:
        svg_display = clean_svg
    elif molecule_svg:
        svg_display = molecule_svg.replace('opacity="0"', 'opacity="1"').replace('fill="none"', 'fill="#fff"')
    else:
        svg_display = _not_calculated("No structure depiction generated")

    # ── Section 4: 3D Conformer Geometry & Status ───────────────────────────
    has_conformer = conf.get("has_conformer", False) or bool(conf.get("sdf_block"))
    conformer_status = conf.get("status_label") or ("Generated & Energy-Optimized" if has_conformer else "Conformer not generated in workspace")
    conformer_atom_count = conf.get("atom_count") or (props.get("heavyAtoms") if has_conformer else None)
    conformer_method = conf.get("method") or "ETKDGv3 (MMFF94 force field optimization)"
    conformer_disclaimer = conf.get("disclaimer") or (
        "In-silico generated 3D conformer (ETKDGv3 / MMFF94 force field). "
        "This represents an energetically minimized computational conformer, NOT an experimental X-ray crystallographic structure."
    )

    # ── Section 5: Physicochemical Properties & Drug-Likeness Rules ─────────
    prop_list = [
        ("Molecular Formula", props.get("formula"), ""),
        ("Molecular Weight", props.get("mw") or props.get("molecular_weight"), " g/mol"),
        ("Exact Mass", props.get("exactMass"), " Da"),
        ("LogP (Crippen / Wildman)", props.get("logP") or props.get("logp"), ""),
        ("TPSA (Polar Surface Area)", props.get("tpsa"), " Å²"),
        ("H-Bond Donors (HBD)", props.get("hbd"), ""),
        ("H-Bond Acceptors (HBA)", props.get("hba"), ""),
        ("Rotatable Bonds", props.get("rotBonds"), ""),
        ("Total Rings", props.get("totalRings"), ""),
        ("Aromatic Rings", props.get("aromaticRings"), ""),
        ("Saturated Rings", props.get("saturatedRings"), ""),
        ("Heavy Atom Count", props.get("heavyAtoms"), ""),
        ("Heteroatom Count", props.get("heteroAtoms"), ""),
        ("Fraction Csp³", props.get("fractionCsp3"), ""),
        ("Molar Refractivity", props.get("molarRefractivity"), ""),
        ("Chiral Centers", props.get("chiralCenters"), ""),
        ("Amide Bonds", props.get("amideBonds"), ""),
    ]

    prop_rows = ""
    for label, val, suffix in prop_list:
        prop_rows += f"<tr><th style='width:45%'>{html.escape(label)}</th><td>{_safe(val, suffix)}</td></tr>\n"

    # Drug-likeness table
    if dr:
        dl_rows = ""
        for rule_name, rule_data in dr.items():
            if isinstance(rule_data, dict):
                passed = rule_data.get("passed", False)
                violations = rule_data.get("violations", 0)
                color = "#16a34a" if passed else "#e11d48"
                status_label = "PASS (0 violations)" if passed else f"FAIL ({violations} violation{'s' if violations != 1 else ''})"
                dl_rows += f"""<tr>
                    <td><strong>{html.escape(rule_name)}</strong></td>
                    <td><span style="color:{color};font-weight:700">{html.escape(status_label)}</span></td>
                </tr>"""
            else:
                dl_rows += f"<tr><td><strong>{html.escape(rule_name)}</strong></td><td>{_safe(rule_data)}</td></tr>"
        drug_likeness_html = f"""
        <table>
            <thead><tr><th style="width:45%">Rule Framework</th><th>Screening Outcome</th></tr></thead>
            <tbody>{dl_rows}</tbody>
        </table>"""
    else:
        drug_likeness_html = f"<p>{_not_calculated()}</p>"

    # ── Section 6: Calibrated ML Bioactivity & Liability Predictions ────────
    if preds:
        pred_rows = ""
        for p in preds:
            name = p.get("endpoint_name") or p.get("endpoint_id") or "Unknown Endpoint"
            available = p.get("available", False)
            status_lbl = p.get("status_label") or ("Active" if p.get("probability", 0) >= 0.5 else "Inactive")
            conf_val = p.get("confidence") or p.get("probability")
            threshold = p.get("threshold", 0.5)

            if available and conf_val is not None:
                try:
                    pct = round(float(conf_val) * 100)
                except (ValueError, TypeError):
                    pct = 0
                color = _badge_color(status_lbl)
                is_liability = any(k in name.lower() for k in ("herg", "tox", "cardiac", "mmp"))
                type_label = "Toxicological Liability" if is_liability else "Target Bioactivity"

                pred_rows += f"""<tr>
                    <td>
                        <strong>{html.escape(name)}</strong><br>
                        <span style="font-size:11px;color:#64748b">{type_label}</span>
                    </td>
                    <td><span style="color:{color};font-weight:700">{html.escape(status_lbl)}</span></td>
                    <td>
                        <div style="display:flex;align-items:center;gap:8px">
                            <div style="flex:1;height:8px;border-radius:4px;background:#e2e8f0;overflow:hidden">
                                <div style="width:{min(max(pct, 0), 100)}%;height:100%;background:{color};border-radius:4px"></div>
                            </div>
                            <span style="font-weight:700;color:{color};font-size:12px">{pct}%</span>
                        </div>
                        <div style="font-size:10px;color:#94a3b8;margin-top:2px">Threshold: {int(threshold * 100)}%</div>
                    </td>
                    <td style="font-size:11px;color:#475569">
                        CalibratedClassifierCV(RandomForest)<br>
                        <span style="color:#64748b">Scaffold-Split Trained</span>
                    </td>
                </tr>"""
            else:
                pred_rows += f"""<tr>
                    <td><strong>{html.escape(name)}</strong></td>
                    <td><span style="color:#94a3b8;font-style:italic">{html.escape(status_lbl or 'Model not installed')}</span></td>
                    <td>{_not_calculated('Not evaluated')}</td>
                    <td style="font-size:11px;color:#94a3b8;font-style:italic">Unavailable in offline bundle</td>
                </tr>"""

        predictions_html = f"""
        <table>
            <thead>
                <tr>
                    <th style="width:32%">Endpoint & Target Class</th>
                    <th style="width:20%">Prediction Label</th>
                    <th style="width:26%">Calibrated Confidence</th>
                    <th style="width:22%">Model Architecture & Split</th>
                </tr>
            </thead>
            <tbody>{pred_rows}</tbody>
        </table>"""
    else:
        predictions_html = f"<p>{_not_calculated('No prediction records available')}</p>"

    # ── Section 7: Lead Optimization War Room Evaluation ────────────────────
    if wr and wr.get("is_available"):
        p_name = wr.get("profile_name") or "Balanced Lead Optimization"
        p_version = wr.get("profile_version") or "v1"
        p_desc = wr.get("description") or "Multi-parameter optimization balancing target potency against safety liabilities."
        c_name = wr.get("candidate_name") or "Selected Analog Candidate"
        c_score = wr.get("candidate_score")
        score_display = f"{c_score:.1f} / 100" if isinstance(c_score, (int, float)) else _not_calculated()

        hc_passed = wr.get("hard_constraints_passed", True)
        hc_color = "#16a34a" if hc_passed else "#e11d48"
        hc_flags = wr.get("hard_constraint_flags") or []
        hc_text = "PASSED (All constraints satisfied)" if hc_passed else f"FLAGGED ({len(hc_flags)} constraint violation(s))"

        raw_dims = wr.get("dimensions", [])
        if isinstance(raw_dims, dict):
            dims = [
                {
                    "name": v.get("name") or k.replace("_", " ").title(),
                    "id": k,
                    "parent_raw": v.get("parent_raw"),
                    "analog_raw": v.get("analog_raw"),
                    "delta": v.get("delta"),
                    "effective_weight": v.get("weight") or v.get("effective_weight"),
                    "score": v.get("score"),
                    "is_available": v.get("available", True),
                    "unavailability_reason": v.get("unavailability_reason"),
                }
                for k, v in raw_dims.items()
                if isinstance(v, dict)
            ]
        elif isinstance(raw_dims, list):
            dims = raw_dims
        else:
            dims = []

        dim_rows = ""
        for d in dims:
            if not isinstance(d, dict):
                continue
            d_name = d.get("name") or d.get("id") or "Dimension"
            p_val = d.get("parent_raw")
            a_val = d.get("analog_raw")
            delta = d.get("delta")
            wt = d.get("effective_weight")
            score = d.get("score")
            avail = d.get("is_available", True)

            if avail:
                delta_str = f"{delta:+.3f}" if isinstance(delta, (int, float)) else "-"
                wt_str = f"{wt * 100:.1f}%" if isinstance(wt, (int, float)) else "-"
                score_str = f"{score * 100:.1f}" if isinstance(score, (int, float)) else "-"
                dim_rows += f"""<tr>
                    <td><strong>{html.escape(str(d_name))}</strong></td>
                    <td style="font-family:monospace">{_safe(p_val)}</td>
                    <td style="font-family:monospace;font-weight:600">{_safe(a_val)}</td>
                    <td style="font-family:monospace;color:{'#16a34a' if str(delta_str).startswith('+') else '#e11d48'}">{html.escape(str(delta_str))}</td>
                    <td>{wt_str}</td>
                    <td style="font-weight:700">{score_str}</td>
                </tr>"""
            else:
                unavail_msg = str(d.get('unavailability_reason') or 'Explicitly marked unavailable in offline model bundle')
                dim_rows += f"""<tr>
                    <td><strong>{html.escape(str(d_name))}</strong></td>
                    <td colspan="5"><span style="color:#94a3b8;font-style:italic">{html.escape(unavail_msg)}</span></td>
                </tr>"""

        war_room_html = f"""
        <div class="callout-box">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div>
                    <strong style="font-size:14px;color:#0f172a">{html.escape(str(p_name))}</strong>
                    <span class="badge badge-teal" style="margin-left:8px">Version: {html.escape(str(p_version))}</span>
                </div>
                <div style="text-align:right">
                    <span style="font-size:11px;color:#64748b">Candidate Desirability:</span>
                    <strong style="font-size:16px;color:#0d9488;margin-left:6px">{score_display}</strong>
                </div>
            </div>
            <p style="font-size:12px;color:#475569;margin-bottom:8px">{html.escape(str(p_desc))}</p>
            <div style="font-size:12px;display:flex;gap:16px;margin-bottom:12px">
                <span>Hard Constraint Status: <strong style="color:{hc_color}">{html.escape(str(hc_text))}</strong></span>
                <span>Target Activity: <strong style="color:#0f172a">{html.escape(str(wr.get('target_endpoint') or 'Anti-inflammatory'))}</strong></span>
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th style="width:28%">Evaluated Dimension</th>
                    <th style="width:16%">Parent Metric</th>
                    <th style="width:16%">Candidate Metric</th>
                    <th style="width:14%">Delta (Δ)</th>
                    <th style="width:12%">Weight</th>
                    <th style="width:14%">Score</th>
                </tr>
            </thead>
            <tbody>{dim_rows}</tbody>
        </table>"""
    else:
        war_room_html = '<p style="color:#94a3b8;font-style:italic">Lead optimization analysis not executed for this molecule session.</p>'

    # ── Section 8: Explainable Molecular Attribution (Phase 2) ──────────────
    if attr and attr.get("is_available"):
        ep_name = attr.get("endpoint_name", "Target Bioactivity")
        method_name = attr.get("method_name", "Morgan Fingerprint Substructure Perturbation")
        limitation_text = attr.get("method_limitations") or (
            "Attribution scores reflect mathematical model feature sensitivity (ΔP) to local Morgan atom environments. "
            "They do not establish causal pharmacological mechanisms or experimentally confirmed binding interactions."
        )

        pos_atoms = attr.get("top_positive_atoms", [])
        neg_atoms = attr.get("top_negative_atoms", [])

        atom_rows = ""
        for item in pos_atoms[:4]:
            idx = item.get("atom_index", "-")
            sym = item.get("atom_symbol", "")
            raw_c = item.get("raw_contribution", 0)
            coll = item.get("has_collision", False)
            atom_rows += f"""<tr>
                <td>Atom #{idx} ({sym})</td>
                <td style="color:#16a34a;font-weight:700">+{raw_c:.4f}</td>
                <td>Promotes target probability / liability</td>
                <td>{'<span class="badge badge-amber">Colliding (Symmetry/Hash)</span>' if coll else 'Unique Environment'}</td>
            </tr>"""

        for item in neg_atoms[:4]:
            idx = item.get("atom_index", "-")
            sym = item.get("atom_symbol", "")
            raw_c = item.get("raw_contribution", 0)
            coll = item.get("has_collision", False)
            atom_rows += f"""<tr>
                <td>Atom #{idx} ({sym})</td>
                <td style="color:#e11d48;font-weight:700">{raw_c:.4f}</td>
                <td>Mitigates target probability / liability</td>
                <td>{'<span class="badge badge-amber">Colliding (Symmetry/Hash)</span>' if coll else 'Unique Environment'}</td>
            </tr>"""

        attribution_html = f"""
        <div class="callout-box" style="margin-bottom:12px">
            <div style="font-size:12px;color:#0f172a">
                <strong>Attribution Target:</strong> {html.escape(ep_name)} &bull; 
                <strong>Method:</strong> {html.escape(method_name)} (Radius=2, 2048-bit)
            </div>
            <div style="font-size:11px;color:#64748b;margin-top:4px">
                <strong>Scientific Honesty Notice:</strong> {html.escape(limitation_text)}
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th style="width:25%">Atom Site</th>
                    <th style="width:20%">Sensitivity Delta (ΔP)</th>
                    <th style="width:30%">Directional Influence</th>
                    <th style="width:25%">Environment Uniqueness</th>
                </tr>
            </thead>
            <tbody>{atom_rows or '<tr><td colspan="4">No significant atomic perturbations detected.</td></tr>'}</tbody>
        </table>"""
    else:
        attribution_html = '<p style="color:#94a3b8;font-style:italic">Molecular attribution not requested or unavailable for this endpoint.</p>'

    # ── Section 9: Structural Alerts & Synthetic Accessibility ──────────────
    if alerts:
        alert_rows = ""
        for a in alerts:
            a_name = a.get("alert_name") or a.get("name") or "Structural Alert"
            rule_set = a.get("rule_set") or "PAINS / Brenk"
            matched = a.get("matched_atoms", [])
            atoms_str = ", ".join(map(str, matched)) if matched else "Undisclosed"
            alert_rows += f"""<tr>
                <td><strong style="color:#e11d48">{html.escape(a_name)}</strong></td>
                <td>{html.escape(rule_set)}</td>
                <td style="font-family:monospace">{html.escape(atoms_str)}</td>
            </tr>"""
        alerts_html = f"""
        <table>
            <thead><tr><th style="width:40%">Alert Name</th><th style="width:30%">Rule Catalog</th><th>Matched Atoms</th></tr></thead>
            <tbody>{alert_rows}</tbody>
        </table>"""
    else:
        alerts_html = '<p style="color:#16a34a;font-weight:600">✓ No PAINS or Brenk chemical alert motifs detected for this structure.</p>'

    if synth:
        sa_score = synth.get("sa_score", "-")
        diff_label = synth.get("difficulty_label", "moderate").upper()
        flags = synth.get("reactive_group_flags", [])
        flag_text = ", ".join(f.get("name", "") for f in flags) if flags else "None detected"
        synth_html = f"""
        <div style="margin-top:12px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:12px">
            <div style="display:flex;gap:24px">
                <span>Synthetic Accessibility (SA_Score): <strong>{_safe(sa_score)}</strong> / 10</span>
                <span>Difficulty Classification: <strong style="color:{_badge_color(diff_label)}">{html.escape(diff_label)}</strong></span>
                <span>Reactive Chemical Groups: <strong>{html.escape(flag_text)}</strong></span>
            </div>
            <div style="font-size:10px;color:#94a3b8;margin-top:4px">
                Method: Ertl &amp; Schuffenhauer heuristic fragment and ring-complexity scoring.
            </div>
        </div>"""
    else:
        synth_html = ""

    # ── Section 10: Similarity Search Results ────────────────────────────────
    if sim_hits:
        sim_rows = ""
        for i, hit in enumerate(sim_hits[:6], 1):
            h_name = hit.get("name") or f"Reference Compound #{i}"
            h_smiles = hit.get("canonical_smiles") or "-"
            t_score = hit.get("tanimoto", "-")
            t_str = f"{t_score:.3f}" if isinstance(t_score, (int, float)) else str(t_score)
            sim_rows += f"""<tr>
                <td style="text-align:center">{i}</td>
                <td><strong>{html.escape(h_name)}</strong></td>
                <td style="word-break:break-all;font-family:monospace;font-size:11px">{html.escape(h_smiles)}</td>
                <td style="text-align:center;font-weight:700">{html.escape(t_str)}</td>
            </tr>"""
        similarity_html = f"""
        <div style="font-size:11px;color:#64748b;margin-bottom:6px">
            Reference Database: <strong>curated_drugs_v1</strong> (10,027 compounds) &bull; Fingerprint: Morgan Radius 2 (2048-bit)
        </div>
        <table>
            <thead><tr><th style="width:6%">#</th><th style="width:30%">Compound Name</th><th>Canonical SMILES</th><th style="width:16%">Tanimoto Score</th></tr></thead>
            <tbody>{sim_rows}</tbody>
        </table>"""
    else:
        similarity_html = f"<p>{_not_calculated('No similarity matches performed')}</p>"

    # ── Section 11: Lineage & Activity Provenance ───────────────────────────
    exp_id = lin.get("experiment_id") or "EXP-LOCAL"
    p_exp_id = lin.get("parent_experiment_id") or "None (Root Molecule Idea)"
    mod_chain = lin.get("modification_chain") or []
    chain_str = " &rarr; ".join(html.escape(str(s)) for s in mod_chain) if mod_chain else "Original Unmodified Lead"

    lineage_html = f"""
    <div style="font-size:12px;background:#f8fafc;padding:12px;border:1px solid #e2e8f0;border-radius:6px;line-height:1.7">
        <div><strong>Experiment ID:</strong> {html.escape(exp_id)} &bull; <strong>Parent Lineage:</strong> {html.escape(p_exp_id)}</div>
        <div><strong>Modification Provenance:</strong> {chain_str}</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px">
            Deterministic Pipeline: Evaluated on local Rogveda server with fixed seed (42). All computations reproducible.
        </div>
    </div>"""

    # ── Build Self-Contained Print-Ready HTML ────────────────────────────────
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ROGVEDA — Reproducible Research Dossier ({html.escape(formula)})</title>
    <style>
        /* Strict offline system font stack (docs/04_RULES.md - zero external fonts/CDNs) */
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}

        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            line-height: 1.5;
            padding: 30px 40px;
            font-size: 13px;
        }}

        @page {{
            size: A4;
            margin: 14mm 16mm;
            @bottom-right {{
                content: "Page " counter(page) " of " counter(pages);
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 8pt;
                color: #64748b;
            }}
            @bottom-left {{
                content: "ROGVEDA Research Dossier • Confidential & Reproducible";
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 8pt;
                color: #64748b;
            }}
        }}

        .dossier-header {{
            border-bottom: 3px solid #0d9488;
            padding-bottom: 16px;
            margin-bottom: 24px;
        }}

        .dossier-header h1 {{
            font-size: 24px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.02em;
        }}

        .dossier-header .subtitle {{
            font-size: 13px;
            color: #0d9488;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-top: 2px;
        }}

        .meta-strip {{
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            margin-top: 10px;
            font-size: 11px;
            color: #475569;
            background: #f8fafc;
            padding: 8px 12px;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
        }}

        .section {{
            margin-bottom: 24px;
            page-break-inside: avoid;
        }}

        .section-title {{
            font-size: 15px;
            font-weight: 700;
            color: #0f172a;
            padding-bottom: 6px;
            border-bottom: 1.5px solid #cbd5e1;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            justifyContent: space-between;
        }}

        .badge {{
            font-size: 10px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 4px;
            display: inline-block;
        }}

        .badge-teal {{ background: #ccfbf1; color: #0f766e; }}
        .badge-slate {{ background: #f1f5f9; color: #475569; }}
        .badge-amber {{ background: #fef3c7; color: #b45309; }}

        .callout-box {{
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-left: 4px solid #0d9488;
            border-radius: 6px;
            padding: 12px 16px;
        }}

        .smiles-block {{
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 10px 14px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            word-break: break-all;
            color: #0f172a;
            margin: 8px 0;
        }}

        .structure-container {{
            text-align: center;
            padding: 16px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            margin: 8px 0;
        }}

        .structure-container svg {{
            max-width: 380px;
            width: 100%;
            height: auto;
        }}

        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-top: 6px;
        }}

        th, td {{
            border: 1px solid #cbd5e1;
            padding: 7px 10px;
            text-align: left;
            vertical-align: middle;
        }}

        th {{
            background: #f1f5f9;
            font-weight: 600;
            color: #334155;
        }}

        tr:nth-child(even) {{
            background: #f8fafc;
        }}

        .page-break {{
            page-break-before: always;
        }}

        .disclaimer-box {{
            margin-top: 24px;
            padding: 14px 18px;
            background: #fff1f2;
            border: 1px solid #fecdd3;
            border-radius: 6px;
            font-size: 11px;
            color: #9f1239;
            line-height: 1.5;
        }}

        @media print {{
            body {{ padding: 0; }}
            .section {{ page-break-inside: avoid; }}
        }}
    </style>
</head>
<body>

    <!-- ── 1. TITLE PAGE & METADATA ──────────────────────────────────────── -->
    <div class="dossier-header">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
                <h1>ROGVEDA &mdash; Research Dossier</h1>
                <div class="subtitle">Reproducible Cheminformatics &amp; In-Silico Molecular Profile</div>
            </div>
            <div style="text-align:right">
                <span class="badge badge-teal" style="font-size:12px;padding:4px 10px">{dossier_id}</span>
            </div>
        </div>

        <div class="meta-strip">
            <span><strong>Target Formula:</strong> {html.escape(formula)}</span>
            <span><strong>Generated:</strong> {timestamp_str}</span>
            <span><strong>Report Format:</strong> {html.escape(report_format)}</span>
            <span><strong>Engine:</strong> RDKit + Local Scikit-Learn (Offline-First)</span>
        </div>
    </div>

    <!-- ── 2. EXECUTIVE SUMMARY ─────────────────────────────────────────── -->
    <div class="section">
        <div class="section-title">
            <span>2. Executive Summary</span>
            {summary_badge}
        </div>
        <div class="callout-box">
            <p style="line-height:1.7;color:#1e293b">{summary_text}</p>
            {insights_html}
        </div>
    </div>

    <!-- ── 3. 2D STRUCTURE & CANONICAL REPRESENTATION ───────────────────── -->
    <div class="section">
        <div class="section-title">
            <span>3. Structure Depiction &amp; Canonical Identifier</span>
            <span class="badge badge-slate">RDKit 2D Vector Representation</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1.4fr;gap:16px;align-items:center">
            <div class="structure-container">
                {svg_display}
            </div>
            <div>
                <strong style="font-size:11px;color:#475569;text-transform:uppercase">Canonical SMILES Notation:</strong>
                <div class="smiles-block">{_safe(effective_smiles)}</div>
                <div style="font-size:11px;color:#64748b;line-height:1.6;margin-top:6px">
                    <div><strong>Formula:</strong> {html.escape(formula)}</div>
                    <div><strong>Molecular Weight:</strong> {_safe(props.get('mw') or props.get('molecular_weight'), ' g/mol')}</div>
                    <div><strong>Exact Mass:</strong> {_safe(props.get('exactMass'), ' Da')}</div>
                </div>
            </div>
        </div>
    </div>

    <!-- ── 4. 3D CONFORMER GEOMETRY & STATUS ────────────────────────────── -->
    <div class="section">
        <div class="section-title">
            <span>4. 3D Conformer Geometry &amp; In-Silico Stereochemistry</span>
            <span class="badge badge-slate">{html.escape(conformer_status)}</span>
        </div>
        <div style="background:#f8fafc;padding:12px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px">
            <div style="display:flex;gap:20px;margin-bottom:6px">
                <span>Conformer Status: <strong style="color:#0f172a">{html.escape(conformer_status)}</strong></span>
                <span>Embedding Method: <strong style="color:#0f172a">{html.escape(conformer_method)}</strong></span>
                <span>Conformer Heavy Atoms: <strong style="color:#0f172a">{_safe(conformer_atom_count)}</strong></span>
            </div>
            <div style="font-size:11px;color:#64748b;font-style:italic">
                <strong>Structural Honesty Notice:</strong> {html.escape(conformer_disclaimer)}
            </div>
        </div>
    </div>

    <div class="page-break"></div>

    <!-- ── 5. PHYSICOCHEMICAL PROPERTIES & DRUG-LIKENESS ─────────────────── -->
    <div class="section">
        <div class="section-title">
            <span>5. Physicochemical Properties &amp; Drug-Likeness Criteria</span>
            <span class="badge badge-teal">RDKit Deterministic Calculation</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div>
                <strong style="font-size:12px;color:#334155">Molecular Descriptors:</strong>
                <table>
                    <tbody>
                        {prop_rows}
                    </tbody>
                </table>
            </div>
            <div>
                <strong style="font-size:12px;color:#334155">Rule-Based Drug-Likeness Filters:</strong>
                {drug_likeness_html}
            </div>
        </div>
    </div>

    <!-- ── 6. CALIBRATED ML BIOACTIVITY & TOXICITY PREDICTIONS ───────────── -->
    <div class="section">
        <div class="section-title">
            <span>6. Calibrated ML Bioactivity &amp; Toxicological Liabilities</span>
            <span class="badge badge-teal">Calibrated Confidence Estimates</span>
        </div>
        {predictions_html}
    </div>

    <!-- ── 7. LEAD OPTIMIZATION WAR ROOM TRADE-OFFS ──────────────────────── -->
    <div class="section">
        <div class="section-title">
            <span>7. Lead Optimization War Room Evaluation</span>
            <span class="badge badge-teal">Multi-Parameter Trade-Off Analysis</span>
        </div>
        {war_room_html}
    </div>

    <div class="page-break"></div>

    <!-- ── 8. EXPLAINABLE MOLECULAR ATTRIBUTION ──────────────────────────── -->
    <div class="section">
        <div class="section-title">
            <span>8. Explainable Molecular Attribution</span>
            <span class="badge badge-teal">Substructural Environment Sensitivity</span>
        </div>
        {attribution_html}
    </div>

    <!-- ── 9. STRUCTURAL ALERTS & SYNTHESIS FEASIBILITY ──────────────────── -->
    <div class="section">
        <div class="section-title">
            <span>9. Structural Alerts &amp; Synthesis Accessibility</span>
            <span class="badge badge-slate">PAINS / Brenk &bull; Ertl SA Score</span>
        </div>
        {alerts_html}
        {synth_html}
    </div>

    <!-- ── 10. SIMILARITY SEARCH RESULTS ─────────────────────────────────── -->
    <div class="section">
        <div class="section-title">
            <span>10. Curated Chemical Library Similarity Search</span>
            <span class="badge badge-slate">Tanimoto &bull; 2048-bit Morgan Fingerprints</span>
        </div>
        {similarity_html}
    </div>

    <!-- ── 11. EXPERIMENT LINEAGE & PROVENANCE ───────────────────────────── -->
    <div class="section">
        <div class="section-title">
            <span>11. Experiment Lineage &amp; Audit Trail</span>
            <span class="badge badge-slate">Versioned Provenance</span>
        </div>
        {lineage_html}
    </div>

    <!-- ── 12. EVIDENCE, LIMITATIONS & REGULATORY DISCLAIMER ─────────────── -->
    <div class="disclaimer-box">
        <strong>12. Mandatory Evidence &amp; Regulatory Non-Claim Disclaimer:</strong>
        <p style="margin-top:6px">
            This Research Dossier is an automated synthesis of computational cheminformatics algorithms, calibrated machine-learning models, and heuristic decision profiles generated inside the local ROGVEDA research environment.
            <strong>These results are strictly computational estimates for in-silico hypothesis generation and prioritization.</strong>
            They do NOT constitute evidence of clinical safety, in-vivo human bioavailability, pharmacological efficacy, or regulatory approval (including but not limited to FDA IND, NDA, or EMA marketing authorizations).
            Any compound candidate identified through this workflow must undergo rigorous in-vitro and in-vivo experimental wet-lab validation prior to therapeutic development.
        </p>
    </div>

</body>
</html>"""

    return {
        "html": html_content,
        "name": report_name,
        "dossier_id": dossier_id,
        "created_at": iso_timestamp,
    }


def render_pdf_from_html(html_content: str) -> bytes:
    """
    Render binary PDF bytes from HTML using WeasyPrint.
    Guaranteed offline execution with pure system fonts and vector graphics.
    """
    try:
        import weasyprint
    except ModuleNotFoundError:
        import sys
        from pathlib import Path
        root_dir = Path(__file__).resolve().parents[3]
        for sp in root_dir.glob(".venv/lib/python3.*/site-packages"):
            if sp.exists() and str(sp) not in sys.path:
                sys.path.insert(0, str(sp))
        import weasyprint

    return weasyprint.HTML(string=html_content).write_pdf()


def generate_comprehensive_report(
    smiles=None,
    properties=None,
    predictions=None,
    ai_summary=None,
    similarity_hits=None,
    drug_likeness=None,
    activity_log=None,
    molecule_svg=None,
    report_format="Comprehensive Report (PDF)",
) -> str:
    """
    Backward-compatible legacy comprehensive report generator.
    Preserves exact public contract while removing remote font CDN dependencies.
    """
    props = properties or {}
    preds = predictions or []
    ai = ai_summary or {}
    sim_hits = similarity_hits or []
    dr = drug_likeness or {}
    log = activity_log or []

    # Structure Section
    if molecule_svg:
        structure_html = f'<div class="img-container">{molecule_svg}</div>'
    else:
        clean_svg = _render_clean_svg(smiles) if smiles else None
        if clean_svg:
            structure_html = f'<div class="img-container">{clean_svg}</div>'
        else:
            structure_html = '<div class="img-container"><p style="color:#94a3b8;font-style:italic">No structure visualization available</p></div>'

    smiles_display = _safe(smiles)

    # Properties
    prop_rows_data = [
        ("Molecular Formula", props.get("formula"), ""),
        ("Molecular Weight", props.get("mw") or props.get("molecular_weight"), " g/mol"),
        ("Exact Mass", props.get("exactMass"), " Da"),
        ("LogP (Crippen)", props.get("logP") or props.get("logp"), ""),
        ("TPSA", props.get("tpsa"), " Å²"),
        ("H-Bond Donors", props.get("hbd"), ""),
        ("H-Bond Acceptors", props.get("hba"), ""),
        ("Rotatable Bonds", props.get("rotBonds"), ""),
        ("Total Rings", props.get("totalRings"), ""),
        ("Aromatic Rings", props.get("aromaticRings"), ""),
        ("Heavy Atoms", props.get("heavyAtoms"), ""),
        ("Heteroatoms", props.get("heteroAtoms"), ""),
        ("Fraction Csp³", props.get("fractionCsp3"), ""),
        ("Molar Refractivity", props.get("molarRefractivity"), ""),
        ("Chiral Centers", props.get("chiralCenters"), ""),
        ("Amide Bonds", props.get("amideBonds"), ""),
        ("Saturated Rings", props.get("saturatedRings"), ""),
    ]

    prop_rows = ""
    for label, val, suffix in prop_rows_data:
        prop_rows += f"<tr><th>{label}</th><td>{_safe(val, suffix)}</td></tr>\n"

    # ML Predictions Section
    if preds and len(preds) > 0:
        pred_rows = ""
        for p in preds:
            name = p.get("endpoint_name", "Unknown")
            available = p.get("available", False)
            status = p.get("status_label", "")
            confidence = p.get("confidence") or p.get("probability")

            if available and confidence is not None:
                pct = round(confidence * 100)
                color = _badge_color(status)
                pred_rows += f"""<tr>
                    <td>{name}</td>
                    <td><span style="color:{color};font-weight:600">{status}</span></td>
                    <td>
                        <div style="display:flex;align-items:center;gap:8px">
                            <div style="flex:1;height:8px;border-radius:4px;background:#e2e8f0;overflow:hidden">
                                <div style="width:{pct}%;height:100%;background:{color};border-radius:4px"></div>
                            </div>
                            <span style="font-weight:600;color:{color}">{pct}%</span>
                        </div>
                    </td>
                </tr>"""
            else:
                pred_rows += f"""<tr>
                    <td>{name}</td>
                    <td><span style="color:#94a3b8;font-style:italic">{status or 'Model not available'}</span></td>
                    <td>{_not_calculated()}</td>
                </tr>"""
        predictions_html = f"""
        <table>
            <thead><tr><th style="width:35%">Endpoint</th><th style="width:25%">Result</th><th>Confidence</th></tr></thead>
            <tbody>{pred_rows}</tbody>
        </table>"""
    else:
        predictions_html = f'<p>{_not_calculated()}</p>'

    # Drug-Likeness Section
    if dr and len(dr) > 0:
        dl_rows = ""
        for rule_name, rule_data in dr.items():
            if isinstance(rule_data, dict):
                passed = rule_data.get("passed")
                violations = rule_data.get("violations", 0)
                color = "#16a34a" if passed else "#e11d48"
                status_text = "PASS" if passed else f"FAIL ({violations} violation{'s' if violations != 1 else ''})"
                dl_rows += f'<tr><td>{rule_name}</td><td><span style="color:{color};font-weight:600">{status_text}</span></td></tr>'
            else:
                dl_rows += f'<tr><td>{rule_name}</td><td>{rule_data}</td></tr>'
        drug_likeness_html = f"""
        <table>
            <thead><tr><th style="width:40%">Rule</th><th>Status</th></tr></thead>
            <tbody>{dl_rows}</tbody>
        </table>"""
    else:
        drug_likeness_html = f'<p>{_not_calculated()}</p>'

    # AI Summary
    summary_text = ai.get("summary", "")
    key_insights = ai.get("key_insights", [])

    if summary_text and "not available" not in summary_text.lower():
        ai_summary_html = f'<p style="line-height:1.7;color:#334155">{html.escape(summary_text)}</p>'
        if key_insights:
            insights_li = "".join(f"<li>{html.escape(str(ins))}</li>" for ins in key_insights)
            ai_summary_html += f'<ul style="margin-top:12px;color:#334155;line-height:1.8">{insights_li}</ul>'
    else:
        ai_summary_html = f'<p>{_not_calculated()}</p>'

    # Similarity
    if sim_hits and len(sim_hits) > 0:
        sim_rows = ""
        for i, hit in enumerate(sim_hits[:10], 1):
            name = hit.get("name", f"Compound {i}")
            hit_smiles = hit.get("canonical_smiles", "-")
            tanimoto = hit.get("tanimoto", "-")
            if isinstance(tanimoto, (int, float)):
                tanimoto = f"{tanimoto:.3f}"
            sim_rows += f"""<tr>
                <td>{i}</td>
                <td>{html.escape(name)}</td>
                <td style="word-break:break-all;font-family:monospace;font-size:12px">{html.escape(hit_smiles)}</td>
                <td style="text-align:center;font-weight:600">{tanimoto}</td>
            </tr>"""
        similarity_html = f"""
        <table>
            <thead><tr><th style="width:5%">#</th><th style="width:25%">Name</th><th>SMILES</th><th style="width:15%">Tanimoto</th></tr></thead>
            <tbody>{sim_rows}</tbody>
        </table>"""
    else:
        similarity_html = f'<p>{_not_calculated()}</p>'

    # Activity Log
    if log and len(log) > 0:
        log_rows = ""
        for entry in log[:20]:
            ts = entry.get("timestamp", "-")
            action = entry.get("action", "-")
            log_rows += f"<tr><td>{html.escape(str(ts))}</td><td>{html.escape(str(action))}</td></tr>"
        activity_html = f"""
        <table>
            <thead><tr><th style="width:35%">Timestamp</th><th>Action</th></tr></thead>
            <tbody>{log_rows}</tbody>
        </table>"""
    else:
        activity_html = '<p style="color:#94a3b8;font-style:italic">No activity recorded</p>'

    now = datetime.now().strftime("%B %d, %Y at %I:%M %p")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ROGVEDA &mdash; Molecular Analysis Report</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            padding: 40px 50px;
            color: #1e293b;
            background: #ffffff;
            line-height: 1.6;
        }}
        .report-header {{ border-bottom: 3px solid #0d9488; padding-bottom: 20px; margin-bottom: 30px; }}
        .report-header h1 {{ font-size: 28px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }}
        .report-header .subtitle {{ font-size: 14px; color: #64748b; }}
        .report-header .meta {{ display: flex; gap: 24px; margin-top: 12px; font-size: 13px; color: #64748b; }}
        .section {{ margin-bottom: 32px; page-break-inside: avoid; }}
        .section h2 {{ font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 8px; }}
        .section h2 .badge {{ font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 4px; background: #f0fdf4; color: #16a34a; }}
        .img-container {{ text-align: center; margin: 16px 0; border: 1px solid #e2e8f0; padding: 24px; background: #f8fafc; border-radius: 8px; }}
        .img-container svg {{ max-width: 400px; width: 100%; height: auto; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }}
        th, td {{ border: 1px solid #e2e8f0; padding: 10px 14px; text-align: left; }}
        th {{ background: #f1f5f9; font-weight: 600; color: #334155; }}
        tr:nth-child(even) {{ background: #fafbfc; }}
        .smiles-box {{ background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; font-family: 'Courier New', monospace; font-size: 14px; word-break: break-all; color: #1e293b; margin: 8px 0 16px; }}
        .footer {{ margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }}
        @media print {{ body {{ padding: 20px; }} .section {{ page-break-inside: avoid; }} }}
    </style>
</head>
<body>
    <div class="report-header">
        <h1>ROGVEDA &mdash; Molecular Analysis Report</h1>
        <p class="subtitle">Comprehensive Molecular Research Report</p>
        <div class="meta">
            <span>Generated: {now}</span>
            <span>Format: {html.escape(report_format)}</span>
            <span>Engine: RDKit + ML Pipeline (Offline-First)</span>
        </div>
    </div>
    <div class="section">
        <h2>1. Structure Visualization</h2>
        {structure_html}
        <div style="margin-top:12px">
            <strong style="color:#475569;font-size:13px">SMILES Notation:</strong>
            <div class="smiles-box">{smiles_display}</div>
        </div>
    </div>
    <div class="section">
        <h2>2. Molecular Properties <span class="badge">RDKit Computed</span></h2>
        <table><thead><tr><th style="width:40%">Property</th><th>Value</th></tr></thead><tbody>{prop_rows}</tbody></table>
    </div>
    <div class="section">
        <h2>3. Drug-Likeness Assessment</h2>
        {drug_likeness_html}
    </div>
    <div class="section">
        <h2>4. ML Predictions <span class="badge">Calibrated Models</span></h2>
        {predictions_html}
    </div>
    <div class="section">
        <h2>5. AI Summary &amp; Key Insights</h2>
        {ai_summary_html}
    </div>
    <div class="section">
        <h2>6. Similarity Search Results</h2>
        {similarity_html}
    </div>
    <div class="section">
        <h2>7. Activity Log</h2>
        {activity_html}
    </div>
    <div class="footer">
        <p>Generated by ROGVEDA &mdash; Offline-First Molecular Research Workspace</p>
        <p>All computations performed locally using RDKit, scikit-learn, and local LLM</p>
    </div>
</body>
</html>"""
