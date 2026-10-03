"""
ROGVEDA — Batch Screening API Router (Phase 17)

POST /api/batch/screen  — upload a CSV, run batch screening
POST /api/batch/report  — generate HTML report from batch results
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.batch_service import parse_csv, screen_batch, MAX_FILE_SIZE_MB, MAX_ROWS

router = APIRouter(
    prefix="/api/batch",
    tags=["batch"],
)


# ── File size limit (bytes) ───────────────────────────────────
_MAX_FILE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024  # 5 MB


@router.post("/screen")
async def batch_screen(file: UploadFile = File(...)):
    """
    Upload a CSV file with a `smiles` column.  Each row is screened
    through the full per-molecule pipeline (descriptors, ML predictions,
    contradictions, synthesizability).

    Limits:
      - Max file size: 5 MB
      - Max rows: 500

    Returns:
        {
            results: [...],
            errors: [...],
            summary: { total, succeeded, failed, elapsed_seconds }
        }
    """
    # Validate file extension
    filename = (file.filename or "").lower()
    if not filename.endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are accepted. Please upload a .csv file."
        )

    # Read file with size check
    file_bytes = await file.read()
    if len(file_bytes) > _MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                f"File too large ({len(file_bytes) / (1024*1024):.1f} MB). "
                f"Maximum allowed size is {MAX_FILE_SIZE_MB} MB."
            ),
        )

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    # Parse CSV
    try:
        rows = parse_csv(file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Run batch screening
    result = screen_batch(rows)

    # Strip internal fields (prefixed with _) from results before returning
    clean_results = []
    for r in result["results"]:
        clean = {k: v for k, v in r.items() if not k.startswith("_")}
        clean_results.append(clean)

    return {
        "results": clean_results,
        "errors": result["errors"],
        "summary": result["summary"],
    }


# ── Batch Report ──────────────────────────────────────────────

class BatchReportRequest(BaseModel):
    results: list[dict]
    errors: list[dict]
    summary: dict
    report_format: str = "Batch Screening Report (PDF)"


@router.post("/report")
def batch_report(request: BatchReportRequest):
    """
    Generate an HTML report from batch screening results.
    Reuses the CSS styling from the existing single-molecule report pipeline.
    """
    from app.services.report_service import _badge_color
    from datetime import datetime

    results = request.results
    errors = request.errors
    summary = request.summary
    now = datetime.now().strftime("%B %d, %Y at %I:%M %p")

    # ── Build results table rows ──────────────────────────────
    result_rows = ""
    for r in results:
        name = r.get("name") or "-"
        smiles = r.get("canonical_smiles", r.get("input_smiles", "-"))
        if len(smiles) > 40:
            smiles_display = smiles[:37] + "..."
        else:
            smiles_display = smiles
        mw = r.get("molecular_weight", "-")
        logp = r.get("logp", "-")
        tpsa = r.get("tpsa", "-")
        sa_score = r.get("sa_score", "-")
        sa_diff = r.get("sa_difficulty", "-")

        # Prediction columns
        pred_cols = ""
        for ep_id in ["herg", "antiinflammatory", "antioxidant", "antimicrobial", "anticancer", "tox21_mmp"]:
            status = r.get(f"pred_{ep_id}_status", "-")
            conf = r.get(f"pred_{ep_id}_confidence")
            if conf is not None:
                color = _badge_color(status)
                pct = round(conf * 100)
                pred_cols += f'<td><span style="color:{color};font-weight:600">{status}</span><br><span style="font-size:11px;color:#64748b">{pct}%</span></td>'
            else:
                pred_cols += f'<td style="color:#94a3b8;font-style:italic">N/A</td>'

        sa_color = "#4ade80" if sa_diff == "easy" else ("#fbbf24" if sa_diff == "moderate" else "#f87171")

        result_rows += f"""<tr>
            <td>{r.get("row_index", "-")}</td>
            <td>{name}</td>
            <td style="font-family:monospace;font-size:11px;word-break:break-all" title="{r.get("canonical_smiles", "")}">{smiles_display}</td>
            <td>{mw}</td>
            <td>{logp}</td>
            <td>{tpsa}</td>
            {pred_cols}
            <td><span style="color:{sa_color};font-weight:600">{sa_score}</span> ({sa_diff})</td>
        </tr>"""

    # ── Build errors table rows ───────────────────────────────
    error_rows = ""
    for e in errors:
        error_rows += f"""<tr>
            <td>{e.get("row_index", "-")}</td>
            <td>{e.get("name") or "-"}</td>
            <td style="font-family:monospace;font-size:11px">{e.get("smiles", "-")}</td>
            <td style="color:#f87171">{e.get("reason", "Unknown error")}</td>
        </tr>"""

    # ── Assemble HTML ─────────────────────────────────────────
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ROGVEDA — Batch Screening Report</title>
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
            font-size: 28px; font-weight: 700; color: #0f172a; margin-bottom: 4px;
        }}
        .report-header .subtitle {{
            font-size: 14px; color: #64748b;
        }}
        .report-header .meta {{
            display: flex; gap: 24px; margin-top: 12px; font-size: 13px; color: #64748b;
        }}
        .summary-bar {{
            display: flex; gap: 24px; margin-bottom: 24px; padding: 16px;
            background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;
        }}
        .summary-item {{
            text-align: center; flex: 1;
        }}
        .summary-item .value {{
            font-size: 28px; font-weight: 700; color: #0f172a;
        }}
        .summary-item .label {{
            font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;
        }}
        .section {{
            margin-bottom: 32px; page-break-inside: avoid;
        }}
        .section h2 {{
            font-size: 18px; font-weight: 700; color: #0f172a;
            margin-bottom: 14px; padding-bottom: 8px;
            border-bottom: 1px solid #e2e8f0;
        }}
        table {{
            width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px;
        }}
        th, td {{
            border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left;
        }}
        th {{
            background: #f1f5f9; font-weight: 600; color: #334155; white-space: nowrap;
        }}
        tr:nth-child(even) {{
            background: #fafbfc;
        }}
        .footer {{
            margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0;
            font-size: 12px; color: #94a3b8; text-align: center;
        }}
        @media print {{
            body {{ padding: 20px; font-size: 10px; }}
            .section {{ page-break-inside: avoid; }}
            table {{ font-size: 10px; }}
            th, td {{ padding: 4px 6px; }}
        }}
    </style>
</head>
<body>
    <div class="report-header">
        <h1>ROGVEDA — Batch Screening Report</h1>
        <p class="subtitle">Multi-Molecule Analysis Results</p>
        <div class="meta">
            <span>Generated: {now}</span>
            <span>Format: {request.report_format}</span>
            <span>Engine: RDKit + ML Pipeline</span>
        </div>
    </div>

    <div class="summary-bar">
        <div class="summary-item">
            <div class="value">{summary.get("total", 0)}</div>
            <div class="label">Total Molecules</div>
        </div>
        <div class="summary-item">
            <div class="value" style="color:#16a34a">{summary.get("succeeded", 0)}</div>
            <div class="label">Succeeded</div>
        </div>
        <div class="summary-item">
            <div class="value" style="color:#dc2626">{summary.get("failed", 0)}</div>
            <div class="label">Failed</div>
        </div>
        <div class="summary-item">
            <div class="value">{summary.get("elapsed_seconds", "-")}s</div>
            <div class="label">Processing Time</div>
        </div>
    </div>

    <div class="section">
        <h2>Results ({summary.get("succeeded", 0)} molecules)</h2>
        <div style="overflow-x:auto">
        <table>
            <thead><tr>
                <th>#</th><th>Name</th><th>SMILES</th>
                <th>MW</th><th>LogP</th><th>TPSA</th>
                <th>hERG</th><th>Anti-inflam.</th><th>Antioxidant</th>
                <th>Antimicrobial</th><th>Anticancer</th><th>Tox21</th>
                <th>SA Score</th>
            </tr></thead>
            <tbody>{result_rows if result_rows else '<tr><td colspan="13" style="text-align:center;color:#94a3b8;font-style:italic">No results</td></tr>'}</tbody>
        </table>
        </div>
    </div>

    {"" if not error_rows else f'''
    <div class="section">
        <h2 style="color:#dc2626">Errors ({summary.get("failed", 0)} rows)</h2>
        <table>
            <thead><tr><th>#</th><th>Name</th><th>SMILES</th><th>Reason</th></tr></thead>
            <tbody>{error_rows}</tbody>
        </table>
    </div>
    '''}

    <div class="footer">
        <p>Generated by ROGVEDA — Offline-First Molecular Research Workspace</p>
        <p>All computations performed locally using RDKit, scikit-learn, and local LLM</p>
    </div>

    <script>
        window.onload = () => {{ setTimeout(() => {{ window.print(); }}, 800); }}
    </script>
</body>
</html>"""

    date_str = datetime.now().strftime("%Y-%m-%d_%H-%M")
    name = f"Batch_Report_{summary.get('total', 0)}_molecules_{date_str}"

    return {"html": html, "name": name}
