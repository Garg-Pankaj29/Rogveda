# ROGVEDA — Tech Stack

## Guiding principle
Every layer should be the **lightest technology that solves the problem**. No AI where an algorithm works; no cloud where local suffices.

## 1. Application shell

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **Tauri (Rust shell + web frontend)** | Tiny binary, low RAM, native file access, cross-platform | Slightly more setup than Electron | **Recommended** for a real offline desktop app |
| Electron | Huge ecosystem, easy | Heavy (~150MB+ RAM baseline) | Fallback if Rust tooling is a blocker |
| Pure local web app (browser + local server) | Fastest to build for a hackathon | Feels less "installed," needs a running backend process | Fine for the hackathon demo; upgrade to Tauri post-hackathon |

**For the hackathon timeline: build as a local web app (React frontend + local FastAPI backend), run both on localhost. Package as Tauri afterward if time allows.**

## 2. Frontend

- **Framework:** React + Vite (fast dev server, matches the mockups' component-heavy dashboard style).
- **Styling:** Tailwind CSS (dark charcoal/teal theme already defined in mockups).
- **2D molecule editor / canvas:** Ketcher (open-source, self-hosted, no CDN) OR a custom lightweight canvas using `RDKit.js` for parsing — pick Ketcher if timeline allows, custom canvas if you need pixel control over the minimalist toolbar shown in mockups.
- **Chemistry in the browser:** `@rdkit/rdkit` (RDKit compiled to WebAssembly) — gives instant, offline, no-round-trip SMILES validation/canonicalization/descriptor calc directly in JS. Use this for live UI feedback; use the Python RDKit backend for anything heavier (batch similarity search, ML featurization).
- **3D viewer:** `3Dmol.js` or `NGL Viewer`, self-hosted JS bundle (no CDN fetch at runtime). Renders ball & stick / stick / spacefill / surface exactly as in the mockups.
- **Charts / confidence bars:** Recharts or simple custom CSS bars (muted green/yellow/red per the design decision doc).
- **Animation (login page molecules):** CSS `@keyframes` drift/rotate on SVG/PNG molecule sprites, staggered `animation-delay`; optional Three.js scene later for the in-app 3D-molecule "hero" background if desired.

## 3. Backend

- **Language/runtime:** Python (FastAPI) — because RDKit, scikit-learn, and most cheminformatics/ML tooling is Python-native.
- **Chemistry engine:** RDKit (Python) — descriptors, fingerprints, 2D depiction, 3D conformer generation (ETKDG), reaction/fragment operations.
- **ML:** scikit-learn (RandomForest / GradientBoosting / Logistic Regression / small MLP), `CalibratedClassifierCV` for confidence scores, `joblib` for model serialization.
- **Local database:** SQLite — stores curated reference compounds + fingerprints (similarity search), experiment history, saved documents metadata.
- **Local LLM serving:** LM Studio (dev/demo) or `llama.cpp` server (production packaging) exposing an OpenAI-compatible local endpoint (`http://localhost:1234/v1`). Backend calls this endpoint exactly like a cloud LLM call, just pointed at localhost.
- **Local LLM model:** Qwen2.5-0.5B-Instruct (GGUF, Q4_K_M/Q8_0) or SmolLM2-360M-Instruct — see Architecture doc §5 for reasoning.
- **Document retrieval (for "Ask ROGVEDA" / paper summarization):** simple local text extraction (`pypdf`/`pdfplumber`) + keyword/BM25 retrieval (`rank_bm25`) is enough for MVP; add a lightweight local embedding model + vector store (e.g., `sentence-transformers` small model + `sqlite-vec` or `faiss`) only if time/RAM allows.
- **Report generation:** `WeasyPrint` or `reportlab` for PDF; Jinja2 HTML templates for HTML export.

## 4. Data

- **Bioactivity training data:** ChEMBL (SQLite bundle from EBI FTP) + PubChem BioAssay bulk downloads.
- **Toxicity training data:** Tox21, ClinTox (via DeepChem/MoleculeNet loaders, cached locally).
- **Similarity-search reference library:** curated ~5k–20k compound subset (DrugBank open structures / filtered ChEMBL), stored as SMILES + precomputed Morgan fingerprints (2048-bit, radius 2) in SQLite.

## 5. Dev tooling

- **IDE:** Google Antigravity (agent-first, VS Code-based) — see Rules doc for how to structure agent tasks in it.
- **Version control:** Git + GitHub.
- **Environment:** Python venv + `requirements.txt`; Node + `package.json` for frontend.
- **Testing:** `pytest` for backend (chemistry correctness, model loading), basic React Testing Library for critical UI flows.
- **CI (optional for hackathon):** GitHub Actions running `pytest` + frontend build, with network-disabled smoke test if feasible.

## 6. Summary table

| Concern | Technology |
|---|---|
| Shell | Local web app now → Tauri later |
| Frontend | React + Vite + Tailwind |
| 2D editor | Ketcher or custom canvas + RDKit.js |
| 3D viewer | 3Dmol.js / NGL Viewer |
| Backend API | FastAPI (Python) |
| Chemistry | RDKit |
| ML | scikit-learn + joblib |
| Local LLM | LM Studio / llama.cpp, Qwen2.5-0.5B-Instruct GGUF |
| DB | SQLite |
| Reports | WeasyPrint/reportlab + Jinja2 |
| Retrieval (docs) | pypdf + BM25 (MVP), optional local embeddings later |
