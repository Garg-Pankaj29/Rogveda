# ROGVEDA — System Architecture

## 1. High-level architecture

```
┌──────────────────────────────── CLIENT (React + Vite, runs in browser/webview) ───────────────────────────────┐
│                                                                                                                  │
│  Login Screen        Home Hub          Molecular Analysis      Similarity      Modification      Compare        │
│  (CSS float anim)    (6 hex nodes)     2D+3D view, props,      Search UI       sandbox UI         side-by-side  │
│                                          ML preds, AI insight                                                    │
│                                                                                                                  │
│  RDKit.js (WASM) ── in-browser SMILES validation / canonicalization / quick descriptors (no round trip)         │
└───────────────────────────────────────────────┬──────────────────────────────────────────────────────────────┘
                                                  │ REST calls (localhost only, no external DNS)
┌───────────────────────────────────────────────▼──────────────────────────────────────────────────────────────┐
│                                   LOCAL BACKEND (FastAPI, Python, runs on localhost:PORT)                       │
│                                                                                                                  │
│  ┌───────────────┐   ┌──────────────────┐   ┌───────────────────┐   ┌────────────────────┐                     │
│  │ Chemistry      │   │ Similarity        │   │ ML Prediction      │   │ Report Generator    │                     │
│  │ Service        │   │ Service           │   │ Service            │   │ Service              │                     │
│  │ (RDKit)        │   │ (fingerprints +   │   │ (sklearn models,   │   │ (Jinja2 + WeasyPrint)│                     │
│  │                │   │  Tanimoto vs DB)  │   │  calibrated probs) │   │                      │                     │
│  └───────┬────────┘   └────────┬──────────┘   └─────────┬──────────┘   └──────────┬───────────┘                    │
│          │                     │                         │                        │                                │
│  ┌───────▼─────────────────────▼─────────────────────────▼────────────────────────▼──────────┐                    │
│  │                              SQLite  (experiments, saved docs, reference compounds+FPs)      │                    │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘                    │
│                                                                                                                  │
│  ┌────────────────────────────┐        ┌───────────────────────────────────────┐                                │
│  │ Local LLM Client            │───────▶│ LM Studio / llama.cpp server           │                                │
│  │ (calls localhost:1234/v1)   │        │ Qwen2.5-0.5B-Instruct (GGUF, quantized)│                                │
│  └────────────────────────────┘        └───────────────────────────────────────┘                                │
│                                                                                                                  │
│  ┌────────────────────────────┐                                                                                  │
│  │ Document Retrieval Service  │  (pypdf extraction + BM25 → passages → LLM for summarization/Q&A)                │
│  └────────────────────────────┘                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Everything below the top box runs on `localhost`/`127.0.0.1` only. No component ever makes an outbound call to the public internet at runtime — the only place internet touches this system is the one-time developer-side dataset/model download.

## 2. Request flow: "Analyze this molecule"

1. User draws or pastes SMILES → RDKit.js validates instantly client-side (instant UX feedback, e.g. red border on invalid SMILES).
2. On "Load Molecule," frontend sends the canonical SMILES to `POST /api/molecule/analyze`.
3. **Chemistry Service** (RDKit, Python) computes: formula, MW, LogP, TPSA, HBD/HBA, rotatable bonds, rings, QED, Fraction Csp3, formal charge, and a 2D depiction + a 3D conformer (ETKDG) → returned as an SDF/molblock for the frontend 3D viewer.
4. **ML Prediction Service** loads pre-trained calibrated sklearn models (one per endpoint: anti-inflammatory, antioxidant, antimicrobial, anticancer, hepatotoxicity, cardiotoxicity, mutagenicity, carcinogenicity, hERG), featurizes the molecule (Morgan FP + descriptors), returns label + calibrated confidence per endpoint.
5. **Similarity Service** computes the molecule's fingerprint, runs Tanimoto against the precomputed reference-DB fingerprints (indexed in SQLite), returns top-N similar compounds.
6. All of the above structured JSON is assembled into a single **facts payload**.
7. **Local LLM Client** sends the facts payload inside a tight template prompt (see §5) to the local LLM server → gets back a 2–4 sentence "AI Insight" string.
8. Backend returns one combined response; frontend renders Properties panel, 3D Viewer, ML Predictions panel, AI Insight card — matching the mockups.
9. On "Save," the whole payload + input SMILES + timestamp is written to SQLite as a new experiment version.

## 3. Data model (SQLite, simplified)

```sql
-- Reference compounds for similarity search
CREATE TABLE reference_compounds (
    id INTEGER PRIMARY KEY,
    name TEXT,
    smiles_canonical TEXT UNIQUE,
    morgan_fp BLOB,          -- serialized bit vector
    mw REAL, logp REAL, tpsa REAL
);

-- Experiment history (versioned)
CREATE TABLE experiments (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    original_smiles TEXT,
    modified_smiles TEXT,
    properties_json TEXT,
    predictions_json TEXT,
    similarity_json TEXT,
    ai_insight TEXT,
    parent_experiment_id INTEGER,   -- links modification chains
    created_at TEXT
);

-- Saved documents (imported PDFs)
CREATE TABLE documents (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    filename TEXT,
    extracted_text TEXT,
    imported_at TEXT
);

CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    display_name TEXT,
    password_hash TEXT,      -- local auth only, see Security doc
    created_at TEXT
);
```

## 4. Offline dataflow (setup-time vs. runtime)

| Phase | What happens | Internet needed? |
|---|---|---|
| **Setup (once, by developer/installer)** | Download ChEMBL/Tox21/ClinTox, curate + featurize + train sklearn models, precompute reference-compound fingerprints, download LLM GGUF weights | Yes |
| **Packaging** | Bundle: app binary, trained `.pkl` models, SQLite DB pre-populated with reference compounds, LLM weights file | N/A |
| **Runtime (end user)** | Draw/analyze/similarity/modify/compare/save/report, chat with local LLM | **No** |

## 5. Local LLM prompt pattern (keeps a small model coherent)

Never ask the small model to "reason" — hand it the answer, ask it to phrase it:

```
System: You are a concise scientific assistant. Only use the facts given below.
Do not invent data. Keep the answer to 3 sentences.

Facts:
- Molecule: 4-(ethylamino)benzoic acid, MW 165.19, LogP 1.88, TPSA 63.32
- Anti-inflammatory: Likely Active (confidence 0.82)
- Antioxidant: Likely Active (confidence 0.76)
- Antimicrobial: Moderate (confidence 0.61)
- Anticancer: Low Probability (confidence 0.23)

Task: Summarize what this means for a researcher in plain language.
```

This "facts → template → tiny LLM → prose" pattern is what makes a 0.5B-class model usable — it's transcribing, not reasoning.

## 6. Modification loop architecture

```
Original molecule (SMILES) → RDKit applies suggested transform (e.g., replace -OH with -OCH3)
   → validate resulting structure (RDKit sanitization) → recompute properties
   → rerun ML predictions → diff against original → store as child experiment
   → AI Insight generated on the delta specifically ("this change increases LogP by 0.48...")
```

## 7. 3D rendering pipeline

```
Canonical SMILES → RDKit AddHs() → EmbedMolecule (ETKDGv3) → MMFF/UFF optimize
   → export MolBlock/SDF → frontend 3Dmol.js/NGL renders Ball&Stick/Stick/Spacefill/Surface
```
Runs in well under a second for typical drug-like molecules (< 50 heavy atoms) on CPU.

## 8. Deployment topology options

- **Hackathon demo:** two processes on one laptop — `npm run dev` (frontend, port 5173) + `uvicorn` (backend, port 8000) + LM Studio server (port 1234). Judge can literally disable Wi-Fi and it still works.
- **Post-hackathon packaging:** Tauri bundles frontend + a bundled Python backend (via PyOxidizer/embedded interpreter or a Rust rewrite of hot paths) + bundled LLM runtime into one installable binary per OS.
