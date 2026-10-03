"""
ROGVEDA — Report Service

Generates professional HTML reports from molecule data.
All sections display "Data yet to be calculated" when data is absent.
"""


def _not_calculated():
    """Standard placeholder for missing data."""
    return '<span style="color:#94a3b8;font-style:italic">Data yet to be calculated</span>'


def _safe(val, suffix=""):
    """Return the value if meaningful, else the placeholder."""
    if val is None or val == "" or val == "-" or val == "—":
        return _not_calculated()
    return f"{val}{suffix}"


def _badge_color(status):
    """Map status labels to CSS colors."""
    s = (status or "").lower()
    if "low risk" in s or "active" in s and "inactive" not in s or "safe" in s:
        return "#4ade80"
    if "high risk" in s or "low probability" in s:
        return "#f87171"
    if "moderate" in s or "uncertain" in s:
        return "#fbbf24"
    return "#94a3b8"


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
):
    """
    Build a full HTML report string covering every workspace section.
    Any section with missing data will show "Data yet to be calculated".
    """
    props = properties or {}
    preds = predictions or []
    ai = ai_summary or {}
    sim_hits = similarity_hits or []
    dr = drug_likeness or {}
    log = activity_log or []

    # ── Structure Section ─────────────────────────────────────
    structure_html = ""
    if molecule_svg:
        structure_html = f"""
        <div class="img-container">
            {molecule_svg}
        </div>"""
    else:
        structure_html = '<div class="img-container"><p style="color:#94a3b8;font-style:italic">No structure visualization available</p></div>'

    smiles_display = _safe(smiles)

    # ── Properties Table ──────────────────────────────────────
    prop_rows_data = [
        ("Molecular Formula", props.get("formula"), ""),
        ("Molecular Weight", props.get("mw"), " g/mol"),
        ("Exact Mass", props.get("exactMass"), " Da"),
        ("LogP (Crippen)", props.get("logP"), ""),
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

    # ── ML Predictions Section ────────────────────────────────
    if preds and len(preds) > 0:
        pred_rows = ""
        for p in preds:
            name = p.get("endpoint_name", "Unknown")
            available = p.get("available", False)
            status = p.get("status_label", "")
            confidence = p.get("confidence")

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

    # ── Drug-Likeness Section ─────────────────────────────────
    if dr and len(dr) > 0:
        dl_rows = ""
        for rule_name, rule_data in dr.items():
            if isinstance(rule_data, dict):
                passed = rule_data.get("passed")
                violations = rule_data.get("violations", 0)
                color = "#4ade80" if passed else "#f87171"
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

    # ── AI Summary & Key Insights ─────────────────────────────
    summary_text = ai.get("summary", "")
    key_insights = ai.get("key_insights", [])

    if summary_text and summary_text != "Local AI not available — start LM Studio to generate AI insights.":
        ai_summary_html = f'<p style="line-height:1.7;color:#334155">{summary_text}</p>'
        if key_insights:
            insights_li = "".join(f"<li>{ins}</li>" for ins in key_insights)
            ai_summary_html += f'<ul style="margin-top:12px;color:#334155;line-height:1.8">{insights_li}</ul>'
    else:
        ai_summary_html = f'<p>{_not_calculated()}</p>'

    # ── Similarity Search Results ─────────────────────────────
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
                <td>{name}</td>
                <td style="word-break:break-all;font-family:monospace;font-size:12px">{hit_smiles}</td>
                <td style="text-align:center;font-weight:600">{tanimoto}</td>
            </tr>"""
        similarity_html = f"""
        <table>
            <thead><tr><th style="width:5%">#</th><th style="width:25%">Name</th><th>SMILES</th><th style="width:15%">Tanimoto</th></tr></thead>
            <tbody>{sim_rows}</tbody>
        </table>"""
    else:
        similarity_html = f'<p>{_not_calculated()}</p>'

    # ── Activity Log ──────────────────────────────────────────
    if log and len(log) > 0:
        log_rows = ""
        for entry in log[:20]:
            ts = entry.get("timestamp", "-")
            action = entry.get("action", "-")
            log_rows += f"<tr><td>{ts}</td><td>{action}</td></tr>"
        activity_html = f"""
        <table>
            <thead><tr><th style="width:35%">Timestamp</th><th>Action</th></tr></thead>
            <tbody>{log_rows}</tbody>
        </table>"""
    else:
        activity_html = '<p style="color:#94a3b8;font-style:italic">No activity recorded</p>'

    # ── Build Final HTML ──────────────────────────────────────
    from datetime import datetime
    now = datetime.now().strftime("%B %d, %Y at %I:%M %p")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ROGVEDA — Molecular Analysis Report</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        * {{ margin: 0; padding: 0; box-sizing: border-box; }}

        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            padding: 40px 50px;
            color: #1e293b;
            background: #ffffff;
            line-height: 1.6;
        }}

        .report-header {{
            border-bottom: 3px solid #0d9488;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}

        .report-header h1 {{
            font-size: 28px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 4px;
        }}

        .report-header .subtitle {{
            font-size: 14px;
            color: #64748b;
        }}

        .report-header .meta {{
            display: flex;
            gap: 24px;
            margin-top: 12px;
            font-size: 13px;
            color: #64748b;
        }}

        .section {{
            margin-bottom: 32px;
            page-break-inside: avoid;
        }}

        .section h2 {{
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 14px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            gap: 8px;
        }}

        .section h2 .badge {{
            font-size: 11px;
            font-weight: 500;
            padding: 2px 8px;
            border-radius: 4px;
            background: #f0fdf4;
            color: #16a34a;
        }}

        .img-container {{
            text-align: center;
            margin: 16px 0;
            border: 1px solid #e2e8f0;
            padding: 24px;
            background: #f8fafc;
            border-radius: 8px;
        }}

        .img-container svg {{
            max-width: 400px;
            width: 100%;
            height: auto;
        }}

        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            font-size: 13px;
        }}

        th, td {{
            border: 1px solid #e2e8f0;
            padding: 10px 14px;
            text-align: left;
        }}

        th {{
            background: #f1f5f9;
            font-weight: 600;
            color: #334155;
        }}

        tr:nth-child(even) {{
            background: #fafbfc;
        }}

        .smiles-box {{
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px 16px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            word-break: break-all;
            color: #1e293b;
            margin: 8px 0 16px;
        }}

        .footer {{
            margin-top: 40px;
            padding-top: 16px;
            border-top: 1px solid #e2e8f0;
            font-size: 12px;
            color: #94a3b8;
            text-align: center;
        }}

        @media print {{
            body {{ padding: 20px; }}
            .section {{ page-break-inside: avoid; }}
        }}
    </style>
</head>
<body>

    <div class="report-header">
        <h1>ROGVEDA — Molecular Analysis Report</h1>
        <p class="subtitle">Comprehensive Molecular Research Report</p>
        <div class="meta">
            <span>Generated: {now}</span>
            <span>Format: {report_format}</span>
            <span>Engine: RDKit + ML Pipeline</span>
        </div>
    </div>

    <!-- Structure Visualization -->
    <div class="section">
        <h2>1. Structure Visualization</h2>
        {structure_html}
        <div style="margin-top:12px">
            <strong style="color:#475569;font-size:13px">SMILES Notation:</strong>
            <div class="smiles-box">{smiles_display}</div>
        </div>
    </div>

    <!-- Molecular Properties -->
    <div class="section">
        <h2>2. Molecular Properties <span class="badge">RDKit Computed</span></h2>
        <table>
            <thead><tr><th style="width:40%">Property</th><th>Value</th></tr></thead>
            <tbody>
                {prop_rows}
            </tbody>
        </table>
    </div>

    <!-- Drug-Likeness Assessment -->
    <div class="section">
        <h2>3. Drug-Likeness Assessment</h2>
        {drug_likeness_html}
    </div>

    <!-- ML Predictions -->
    <div class="section">
        <h2>4. ML Predictions <span class="badge">Calibrated Models</span></h2>
        {predictions_html}
    </div>

    <!-- AI Summary & Key Insights -->
    <div class="section">
        <h2>5. AI Summary &amp; Key Insights</h2>
        {ai_summary_html}
    </div>

    <!-- Similarity Search Results -->
    <div class="section">
        <h2>6. Similarity Search Results</h2>
        {similarity_html}
    </div>

    <!-- Activity Log -->
    <div class="section">
        <h2>7. Activity Log</h2>
        {activity_html}
    </div>

    <div class="footer">
        <p>Generated by ROGVEDA — Offline-First Molecular Research Workspace</p>
        <p>All computations performed locally using RDKit, scikit-learn, and local LLM</p>
    </div>

    <script>
        window.onload = () => {{ setTimeout(() => {{ window.print(); }}, 800); }}
    </script>

</body>
</html>"""

    return html
