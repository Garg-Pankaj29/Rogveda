# ROGVEDA

> **In-Silico Molecular Intelligence & Drug Discovery Screening Platform**  
> *One molecule. One workspace. One reproducible research loop.*

[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](LICENSE)
[![Python: 3.12+](https://img.shields.io/badge/Python-3.12%2B-blue.svg)](https://www.python.org/)
[![FastAPI: 0.115+](https://img.shields.io/badge/FastAPI-0.115%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![React: 19](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF.svg)](https://vitejs.dev/)
[![Cheminformatics: RDKit](https://img.shields.io/badge/Cheminformatics-RDKit-green.svg)](https://www.rdkit.org/)
[![Tests: 171 Passed](https://img.shields.io/badge/Tests-171%20Passed-brightgreen.svg)](backend/tests/)

---

## 1. Project Overview

**ROGVEDA** is an offline-first, privacy-preserving computational chemistry and early-stage drug discovery workbench.

### The Problem It Solves
Early-stage medicinal chemistry and drug discovery workflows are heavily fragmented. Researchers, students, and small academic laboratories frequently juggle disconnected utilities:
- Standalone drawing apps for 2D chemical sketching.
- Cloud web servers for calculating molecular descriptors.
- Cloud APIs for bioactivity and toxicity estimations.
- External databases for similarity matching.
- Manual spreadsheets and notes for tracking structural modifications.

This fragmentation creates severe context switching, eliminates reproducibility, and forces researchers to upload proprietary or unpublished molecular structures to third-party cloud servers.

### Why ROGVEDA Exists
ROGVEDA unifies the complete molecular exploration cycle into a **single, local-first desktop application**:
$$\text{Input (Draw / SMILES)} \longrightarrow \text{Compute Descriptors} \longrightarrow \text{Predict Multi-Endpoint Activity} \longrightarrow \text{Similarity Search} \longrightarrow \text{Optimize and Mutate} \longrightarrow \text{Track and Export}$$

### What Makes It Different
1. **Local-First & Offline**: Operates completely on `127.0.0.1` without outbound runtime network calls. No user molecules, proprietary structures, or experiment notes leave the local machine.
2. **Deterministic Cheminformatics**: Powered by native C++ **RDKit** binaries running locally via Python and WebAssembly in the browser.
3. **Calibrated Machine Learning**: Uses scikit-learn models trained on 474,000+ compound evaluations (354,000+ unique molecules) from **ChEMBL 37**, **Tox21**, and **ClinTox**, evaluated strictly using **80/20 Bemis-Murcko Scaffold Splits** and calibrated via `CalibratedClassifierCV` for well-calibrated confidence probabilities.
4. **Locally Grounded AI Insights (RAG)**: Connects to local LLM engines (e.g., LM Studio or `llama.cpp` running models like `llama-3.2-1b-instruct` or `Qwen2.5-0.5B`) to synthesize structured chemical facts, flag structural contradictions, and explain property trade-offs without cloud dependencies.

---

## 2. Key Features

### Core Cheminformatics
- **Deterministic Descriptor Calculation**: Computes 17+ core physical and topological properties in real-time using RDKit:
  - Molecular Formula, Molecular Weight (MW), Exact Mass.
  - Lipophilicity & Polarity: Crippen LogP, Topological Polar Surface Area (TPSA), Molar Refractivity.
  - Bioavailability / Lipinski Rules: Hydrogen Bond Donors (HBD), Hydrogen Bond Acceptors (HBA), Rotatable Bonds, Lipinski Rule-of-5 Violations.
  - Geometry & Composition: Aromatic Rings, Saturated Rings, Total Rings, Heavy Atoms, Heteroatoms, Fraction Csp³ (carbon saturation), Chiral Centers, Amide Bonds.
- **Synthesizability Assessment**: Computes fragment-based Synthetic Accessibility Scores (SA_Score 1–10) and flags reactive functional groups (e.g., acyl halides, Michael acceptors, aldehydes).

### Interactive 2D & 3D Visualization
- **Embedded Ketcher 2D Sketcher**: Full chemical canvas supporting atom/bond drawing, template libraries, ring insertions, SMILES/Molfile import and export, with automatic structure sanitization.
- **Interactive 3D Conformer Viewer**: Real-time 3D coordinate embedding using the Distance Geometry algorithm (ETKDGv3) rendered directly in WebGL via `3Dmol.js` and Three.js scenes.

### Calibrated Machine Learning Predictions
- **Multi-Endpoint Classification**: Instant parallel inference across 8 critical safety and efficacy targets:
  - **hERG Cardiotoxicity** (KCNH2 channel inhibition / QT prolongation risk).
  - **Tox21_MMP** (Mitochondrial Membrane Potential disruption).
  - **Anti-microbial Activity** (Bacterial MIC & growth inhibition).
  - **Anti-cancer Activity** (Pan-cancer tumor cell cytotoxicity).
  - **Anti-inflammatory Activity** (COX-1/2, TNF, 5-LOX, iNOS, p38, JAK targets).
  - **Anti-oxidant Potential** (Radical scavenging & redox activity).
  - **Tox21 Full Biological Panel** (12-assay environmental & cellular stress response panel).
  - **ClinTox** (FDA clinical trial approval & safety failure liability).
- **Probability Calibration**: Every prediction ships with a calibrated confidence bar derived from `CalibratedClassifierCV(method='sigmoid')`, explicitly communicating probability distance from the decision boundary.

### Lead Optimization & Explainability
- **Lead Optimization War Room**: Multi-parameter optimization (MPO) decision studio evaluating parent molecules and generated analogs across 6 research-relevant dimensions (activity, cardiac safety, mitochondrial safety, oral property heuristic, synthetic ease, and metabolic stability) with versioned profiles, dynamic weight renormalization, and independent hard constraints.
- **Explainable Molecular Attribution**: Atom- and bond-level feature attribution maps using atomic environment perturbation (`SimilarityMaps`), bit-collision tracking, and structural alert screening (PAINS, Brenk, NIH).
- **Benchmark Drug Gallery & Case Studies**: Curated reference library of historical drugs (Terfenadine, Fexofenadine, Aspirin, Celecoxib, Ibuprofen) with comparative case studies and 1-click loading into analysis or the War Room.

### Virtual Screening & Exploration
- **Tanimoto Similarity Search**: 2048-bit Morgan Fingerprint (radius=2) nearest-neighbor searches against 10,027 curated reference compounds to discover structurally related bioactives across 5 similarity metrics (ECFP4, ECFP6, MACCS, Dice, Cosine).
- **Chemical Space Projection**: 2D UMAP projection mapping novel compounds into known chemical space via weighted KNN interpolation.
- **High-Throughput Batch Screening**: Process multi-molecule CSV files (up to 500 rows) in parallel with power-aware battery throttling, automated property filters, and exportable screening summaries.

### Local AI Copilot & Contradiction Detection
- **Trade-Off & Contradiction Detection**: Rule-based heuristic engine flags biochemical paradoxes (e.g., high predicted anti-inflammatory activity coupled with unacceptable hERG cardiotoxicity or poor oral bioavailability).
- **Offline RAG Summaries**: Formulates strict prompt templates containing computed facts, detected trade-offs, and synthesis flags for local LLM text generation.

### Experiment Management & Reporting
- **Versioned Experiment History**: Tracks parent-child molecular modification chains in a local SQLite database with automated story narration.
- **Research Dossiers & PDF Generation**: Compiles comprehensive, self-contained 12-section research dossiers and HTML/PDF reports using WeasyPrint detailing 2D structure, 3D conformer status, computed properties, ML predictions, War Room trade-offs, and AI notes.

---

## 3. System Architecture

```mermaid
flowchart TB
    subgraph Client["Frontend Client (Browser / WebView @ 127.0.0.1:5173)"]
        UI["React 19 Dashboard (Tailwind CSS v4)"]
        Ketcher["Ketcher 2D Chemical Canvas"]
        Viewer3D["3Dmol.js / WebGL Conformer Viewer"]
        WASM["@rdkit/rdkit (Client-side WASM Validation)"]
    end

    subgraph Server["Local Application Server (FastAPI @ 127.0.0.1:8000)"]
        Router["FastAPI Central Router & CORS Middleware"]
        AuthSvc["Auth & Session Controller (JWT HS256)"]
        ChemSvc["Chemistry Service (RDKit Python Engine)"]
        MLSvc["ML Service (Calibrated Random Forest Ensembles)"]
        SimSvc["Similarity Service (2048-bit Morgan Fingerprints)"]
        ContraSvc["Contradiction & Trade-Off Engine"]
        BatchSvc["Batch Screening Pipeline"]
        LLMSvc["Local LLM Client (HTTPX Local Connector)"]
        CacheSvc["Analysis Cache (LRU + SQLite Persistent Store)"]
    end

    subgraph Storage["Local Storage Layer"]
        SQLite[("Local SQLite Database (backend/rogveda.db)")]
        Models[("Serialized Calibrated ML Models (*.pkl)")]
        RefData[("Curated Reference Libraries (data/reference/)")]
    end

    subgraph LocalAI["Local AI Runtime (@ 127.0.0.1:1234)"]
        LLMEngine["LM Studio / llama.cpp Server (OpenAI-compatible /v1)"]
        LLMWeights["Quantized GGUF Model (e.g. Llama-3.2-1B-Instruct)"]
    end

    UI <-->|"HTTP / REST API (localhost:5173 proxy to 8000)"| Router
    UI --- Ketcher
    UI --- Viewer3D
    UI --- WASM

    Router --> AuthSvc
    Router --> ChemSvc
    Router --> MLSvc
    Router --> SimSvc
    Router --> ContraSvc
    Router --> BatchSvc
    Router --> LLMSvc
    Router --> CacheSvc

    AuthSvc <--> SQLite
    CacheSvc <--> SQLite
    BatchSvc <--> SQLite
    ChemSvc --> RefData
    MLSvc <--> Models
    LLMSvc <-->|"Local Loopback POST /v1/chat/completions"| LLMEngine
    LLMEngine --- LLMWeights
```

### Component Breakdown
- **Frontend**: Single-page application built with React 19, Vite, and Tailwind CSS. Employs `@rdkit/rdkit` (WebAssembly) for instantaneous client-side SMILES validation and canonicalization. Ketcher handles 2D molecular drawing inside an iframe container, while `3Dmol.js` renders ETKDG-embedded 3D coordinates.
- **Backend**: Python 3.12 FastAPI service strictly bound to loopback `127.0.0.1`. Contains modular service domains for RDKit descriptor calculation, scikit-learn model inference, Tanimoto similarity searching, batch screening, and SQLite persistence.
- **Database**: Local SQLite instance (`backend/rogveda.db`) storing user credentials (salted password hashes), experiment history, saved reports, and analysis cache entries.
- **Machine Learning Layer**: Joblib-serialized ensemble models combining 2048-bit Morgan Fingerprints with calibrated probability sigmoid curves. Preloaded asynchronously into memory at server startup.
- **LLM Layer**: Decoupled HTTP interface connecting via loopback to an OpenAI-compatible local runtime (LM Studio or `llama.cpp`). Operates strictly as a text-in/text-out summarizer with structured RAG prompt templates.

---

## 4. Architecture Dataflow

The standard lifecycle for analyzing a molecule proceeds through 7 discrete stages:

```text
User Action (Draw structure / Enter SMILES)
  │
  ▼
[1] Client-side Validation (@rdkit/rdkit WASM)
  │ (Instant syntax verification; canonicalizes SMILES; rejects invalid valence)
  ▼
[2] HTTP POST Request -> /api/molecule/analyze or /api/molecule/predict-all
  │
  ▼
[3] Backend Chemistry Engine (RDKit Python)
  ├── Parses Mol from SMILES with sanitization
  ├── Generates 3D conformer coordinates via ETKDGv3 algorithm
  └── Calculates 17+ physicochemical properties (MW, LogP, TPSA, HBD, HBA)
  │
  ▼
[4] Parallel ML Inference Engine (Scikit-Learn)
  ├── Featurizes molecule into 2048-bit Morgan Fingerprint (radius=2)
  ├── Queries calibrated Random Forest models (hERG, Tox21, Antimicrobial, etc.)
  └── Computes calibrated confidence probabilities
  │
  ▼
[5] Biochemical Trade-off & Synthesis Evaluation
  ├── Evaluates rule-based contradictions (e.g. Activity vs. Toxicity)
  └── Computes Ertl-Schuffenhauer Synthetic Accessibility (SA_Score)
  │
  ▼
[6] Local LLM Context Injection (RAG)
  ├── Constructs structured factual prompt (Properties + Predictions + Contradictions)
  └── Queries local LLM engine (127.0.0.1:1234/v1) with 10s strict timeout
  │
  ▼
[7] Unified JSON Response -> Frontend UI Rendering
  └── Synchronously updates 2D view, 3D WebGL viewer, Property cards, ML bars, and AI notes
```

---

## 5. Technology Stack

| Layer | Technology | Version / Specification | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | 19.1.0 | Component-based reactive user interface |
| **Frontend Tooling** | Vite | 6.x | Fast development server and module bundler |
| **Frontend Styling** | Tailwind CSS | 4.x (`@tailwindcss/vite`) | Responsive, custom dark-mode theme |
| **In-Browser Chemistry** | `@rdkit/rdkit` | 2026.3.6 (WASM) | Client-side validation, canonicalization, and live feedback |
| **2D Chemical Editor** | Ketcher Core & React | 3.14.0 | Professional 2D chemical structure drawing |
| **3D Molecular Viewer** | 3Dmol.js / Three.js | 2.5.5 / 10.7.8 | WebGL 3D conformer rendering and orbital animations |
| **Charts & Metrics** | Recharts | 3.10.1 | Radar plots and property comparison charts |
| **Backend Framework** | FastAPI | 0.115+ | High-performance asynchronous REST API |
| **ASGI Server** | Uvicorn | Standard | Asynchronous web server bound to `127.0.0.1` |
| **Cheminformatics Engine**| RDKit (Python) | 2026.3.6 | Descriptors, fingerprints, 3D embedding, and SMARTS matching |
| **Machine Learning** | Scikit-Learn | 1.9.1 | Random Forest classifiers and CalibratedClassifierCV |
| **Model Serialization** | Joblib | 1.6.0 | Fast loading and caching of trained ML pipelines |
| **Report Generation** | WeasyPrint | 70.0 | High-fidelity local HTML-to-PDF binary compiler |
| **Local Database** | SQLite / SQLAlchemy | 2.0+ (SessionLocal) | Local relational storage for experiments, users, and cache |
| **Authentication** | python-jose / bcrypt | HS256 / Bcrypt (12 rounds) | Local user authentication and salted password hashing |
| **Local LLM Runtime** | LM Studio / llama.cpp | OpenAI API compatible | Local loopback inference for quantized GGUF models |
| **HTTP Client** | HTTPX | 0.28+ | High-speed async client for local LLM requests |
| **Hardware Telemetry** | Psutil | 7.2+ | Battery sensing for power-aware batch throttling |
| **Testing** | Pytest / AnyIO | 9.1+ | Test runner for 171 automated backend tests (100% passing) |

---

## 6. Project Structure

```text
Rogveda/
├── docs/                             # System specifications and architectural design
│   ├── 01_PRD.md                     # Product requirements and MVP scope
│   ├── 02_TECH_STACK.md              # Technical stack rationale
│   ├── 03_ARCHITECTURE.md            # System architecture and data models
│   ├── 04_RULES.md                   # Development rules and determinism constraints
│   ├── 05_SECURITY.md                # Threat model and localhost security
│   └── 06_PROJECT_STRUCTURE.md       # Directory layout and organization
│
├── backend/                          # FastAPI application package
│   ├── app/
│   │   ├── api/                      # REST API endpoint routers
│   │   │   ├── auth.py               # User registration, login, and password reset
│   │   │   ├── batch.py              # Batch molecule virtual screening endpoints
│   │   │   ├── benchmarks.py         # Benchmark catalog and comparative case studies
│   │   │   ├── chat.py               # Conversational molecular assistant routes
│   │   │   ├── chemical_space.py     # Chemical space coordinate mapping
│   │   │   ├── experiments.py        # Experiment CRUD and modification history
│   │   │   ├── modification.py       # War Room, bioisostere, and mutation endpoints
│   │   │   ├── molecule.py           # Core property, 3D, attribution, and prediction endpoints
│   │   │   ├── power.py              # System power settings and hardware modes
│   │   │   ├── remediation.py        # Structural remediation recommendations
│   │   │   └── reports.py            # PDF/HTML dossier and report generation
│   │   ├── core/                     # Application configuration and security
│   │   │   ├── config.py             # Environment variable parsing and directory paths
│   │   │   └── security.py           # Bcrypt hashing and JWT encoding/decoding
│   │   ├── db/                       # Database layer
│   │   │   ├── database.py           # SQLAlchemy engine and session factory
│   │   │   └── models.py             # ORM models (User, Experiment, SavedDocument, Cache, AppSetting)
│   │   ├── schemas/                  # Pydantic validation schemas
│   │   │   ├── attribution_schemas.py # Atom/bond attribution and alert schemas
│   │   │   ├── auth_schemas.py       # Auth request/response models
│   │   │   ├── benchmark_schemas.py  # Benchmark catalog & case study schemas
│   │   │   ├── dossier_schemas.py    # 12-section research dossier schemas
│   │   │   ├── experiments.py        # Experiment serialization schemas
│   │   │   ├── molecule_schemas.py   # SMILES, prediction, and 3D response models
│   │   │   └── mutation_schemas.py   # Transformation request/response schemas
│   │   ├── services/                 # Business logic and domain services
│   │   │   ├── analog_service.py     # Analog searching and structural similarity
│   │   │   ├── attribution_service.py # Feature attribution (SimilarityMaps) & PAINS/Brenk alerts
│   │   │   ├── batch_service.py      # High-throughput batch file processing
│   │   │   ├── benchmark_service.py  # Curated benchmark catalog & historical case studies
│   │   │   ├── cache_service.py      # Result caching with composite model fingerprinting
│   │   │   ├── chemical_space_service.py # Chemical space lookup via weighted KNN
│   │   │   ├── chemistry_service.py  # RDKit descriptor calculation and 3D conformers
│   │   │   ├── contradiction_service.py # Biochemical trade-off and paradox detection
│   │   │   ├── llm_service.py        # Local LLM client and prompt construction
│   │   │   ├── ml_service.py         # Model loading and multi-endpoint inference
│   │   │   ├── modification_service.py # 12 SMARTS transform algorithms & live mutation
│   │   │   ├── power_service.py      # Psutil hardware power and battery monitoring
│   │   │   ├── remediation_service.py# Two-depth toxicity mitigation heuristics
│   │   │   ├── report_service.py     # 12-section research dossier & WeasyPrint PDF compiler
│   │   │   ├── story_service.py      # Narrative experiment summary generation
│   │   │   ├── synthesizability_service.py # SA_Score and reactive group detection
│   │   │   └── war_room_service.py   # Multi-parameter optimization & radar chart calculations
│   │   └── main.py                   # FastAPI initialization, middleware, and lifespan
│   ├── tests/                        # 171 automated backend unit and integration tests
│   ├── pyproject.toml                # Python project configuration
│   ├── requirements.txt              # Pinned Python package dependencies
│   └── .env.example                  # Backend environment template
│
├── frontend/                         # React 19 + Vite frontend
│   ├── public/                       # Static public assets, fonts, and Ketcher bundles
│   │   ├── ketcher/                  # Self-hosted Ketcher 2D editor assets
│   │   └── rdkit/                    # Self-hosted RDKit WebAssembly binaries
│   ├── src/
│   │   ├── components/               # Reusable UI components
│   │   │   ├── KetcherEditor.jsx     # Ketcher iframe wrapper and synchronization
│   │   │   ├── Viewer3D.jsx          # 3Dmol.js conformer visualizer
│   │   │   ├── WarRoomTab.jsx        # Lead Optimization War Room & radar chart UI
│   │   │   ├── AttributionViewer.jsx # Atom-level feature attribution visualization
│   │   │   ├── BenchmarkSelectorModal.jsx # Curated benchmark selector modal
│   │   │   ├── BenchmarkContextCard.jsx   # Benchmark reference card
│   │   │   ├── MolecularSidebar.jsx  # Navigation sidebar
│   │   │   ├── AnalysisTab.jsx       # 17+ properties display panel
│   │   │   ├── PredictionTab.jsx     # ML prediction cards and confidence bars
│   │   │   ├── SimilarityTab.jsx     # 5-metric similarity search view
│   │   │   ├── ModificationTab.jsx   # Live mutation workbench & property deltas
│   │   │   ├── CompareTab.jsx        # Side-by-side differential analysis studio
│   │   │   └── ChemicalSpaceTab.jsx  # Chemical space exploration view
│   │   ├── hooks/                    # Custom React hooks (e.g. debounced analysis)
│   │   ├── lib/                      # Frontend utilities, API client, and chemistry helpers
│   │   ├── pages/                    # Application views
│   │   │   ├── MoleculeDraw.jsx      # Main 9-tab molecular workspace
│   │   │   ├── BatchScreening.jsx    # Virtual batch screening dashboard
│   │   │   ├── Experiments.jsx       # Experiment history and version tree
│   │   │   ├── SavedDocuments.jsx    # Generated reports and documentation library
│   │   │   ├── Home.jsx              # Home landing hub
│   │   │   └── Login.jsx             # Local user authentication
│   │   ├── App.jsx                   # React Router configuration
│   │   ├── index.css                 # Global CSS and Tailwind definitions
│   │   └── main.jsx                  # React application entrypoint
│   ├── package.json                  # Node.js dependencies and build scripts
│   └── vite.config.js                # Vite build and localhost proxy configuration
│
├── models/                           # 8 trained calibrated ML models (*.pkl) & metadata (*.json)
│
├── ml/                               # Machine learning training and calibration pipeline
│   ├── data_prep/                    # ChEMBL & Tox21 data extraction and scaffold splitting
│   ├── featurize.py                  # RDKit Morgan fingerprint extraction
│   ├── train_bioactivity.py          # Bioactivity classifier training routines
│   ├── train_toxicity.py             # Toxicity classifier training routines
│   ├── calibrate.py                  # Probability calibration routines
│   └── build_chemical_space_map.py   # UMAP chemical space projection builder
│
├── scripts/                          # Automated data and build scripts
│   ├── build_dataset.py              # Scaffold-split pickle dataset generator
│   ├── build_similarity_db.py        # Reference fingerprint database generator
│   ├── train_model.py                # Standalone model training with CalibratedClassifierCV
│   └── sanity_check.py               # Verification script for models and descriptors
│
├── data/                             # Reference data and processed datasets
│   ├── chemical_space_map.pkl        # Serialized UMAP projection map
│   ├── processed/similarity.db       # 10,027 reference compounds with Morgan fingerprints
│   └── reference/                    # Curated reference drug compounds CSV
│
├── LICENSE                           # Official MIT License file
├── LICENSE.md                        # MIT License with research and medical disclaimer
└── README.md                         # Project documentation
```
└── README.md                         # Project documentation
```

---

## 7. Prerequisites

### Required Environment
- **Operating System**: Linux (Ubuntu 22.04+ recommended), macOS, or Windows via WSL2.
- **Python**: `3.12.x` (required for RDKit, FastAPI, and Scikit-Learn).
- **Node.js**: `18.x` or `20.x` LTS.
- **Package Manager**: `npm` (v9+) or `pnpm`.
- **Git**: `2.30+`.

### Hardware Specifications
- **CPU**: Dual-core x86_64 or Apple Silicon ARM processor (Quad-core recommended for batch screening).
- **RAM**: Minimum **8 GB** (16 GB recommended when training ML models or running local LLMs).
- **Disk Space**: ~2 GB for dependencies, datasets, and local database.
- **Acceleration**: **CPU-only execution is fully supported**. No CUDA GPU is required for property calculations or ML inference.

### Optional: Local LLM Server
For the AI Copilot ("AI Insight" and chat features), a local OpenAI-compatible inference server is used:
- **LM Studio** (v0.3+) or **llama.cpp server** running at `http://127.0.0.1:1234`.
- **Recommended Model**: `llama-3.2-1b-instruct` (Q4_K_M GGUF) or `Qwen2.5-0.5B-Instruct` for instant, lightweight CPU inference.
- *Note: If the local LLM server is not running, the application degrades gracefully—all chemistry, ML predictions, and batch screening functions operate normally.*

---

## 8. Installation

### 1. Clone Repository
```bash
git clone https://github.com/Garg-Pankaj29/Rogveda.git
cd Rogveda
```

### 2. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create Python 3.12 virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate
# (Windows WSL: source .venv/bin/activate | Windows PowerShell: .venv\Scripts\Activate.ps1)

# Upgrade pip and install pinned dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Return to root directory
cd ..
```

### 3. Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Return to root directory
cd ..
```

---

## 9. Environment Configuration

ROGVEDA reads environment settings from `backend/.env` or root `.env`. Copy the reference configuration:

```bash
cp .env.example .env
```

### Configuration Variables

| Variable | Description | Default Value | Required |
| :--- | :--- | :--- | :---: |
| `HOST` | Loopback IP address for local server binding | `127.0.0.1` | Yes |
| `BACKEND_PORT` | Port number for FastAPI backend service | `8000` | Yes |
| `FRONTEND_ORIGIN` | Allowed CORS origin for frontend client | `http://localhost:5173` | Yes |
| `DATABASE_PATH` | Path to local SQLite database file | `backend/rogveda.db` | No |
| `JWT_SECRET_KEY` | Secret key used for signing local session tokens | *(Set unique string)* | Yes |
| `JWT_ALGORITHM` | Cryptographic algorithm for JWT signatures | `HS256` | Yes |
| `JWT_EXPIRE_MINUTES` | Session validity duration in minutes | `1440` (24 hours) | No |
| `LLM_ENDPOINT` | Local loopback endpoint for OpenAI-compatible LLM server | `http://127.0.0.1:1234/v1` | No |

> [!WARNING]
> Never commit `.env` containing personal credentials to version control. The repository `.gitignore` automatically prevents `.env` tracking.

---

## 10. Running the Application

### 1. Start the Backend API
In your primary terminal:
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*The backend initializes the SQLite database tables and asynchronously preloads ML models into memory.*

### 2. Start the Frontend Development Server
In a second terminal:
```bash
cd frontend
npm run dev
```

### 3. (Optional) Start the Local LLM Server
If using LM Studio:
1. Load `llama-3.2-1b-instruct` or any preferred small instruction-tuned model.
2. Start the **Local Server** on port `1234` (`http://127.0.0.1:1234`).
3. Verify that CORS is enabled.

### 4. Access the Platform
Open your browser and navigate to:
```text
http://localhost:5173
```
- Interactive Swagger API Documentation: `http://127.0.0.1:8000/docs`
- ReDoc API Documentation: `http://127.0.0.1:8000/redoc`

---

## 11. API Documentation

All backend endpoints are bound to `127.0.0.1:8000`. Detailed interactive documentation is available at `http://127.0.0.1:8000/docs`.

### Authentication Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/signup` | Register a new local user account with security question |
| `POST` | `/api/auth/login` | Authenticate credentials and return JWT bearer token |
| `GET` | `/api/auth/me` | Fetch authenticated user profile details |
| `GET` | `/api/auth/stats` | Retrieve platform statistics (experiment counts, saves) |
| `POST` | `/api/auth/forgot-password` | Initiate password recovery via security question |
| `POST` | `/api/auth/verify-security-answer`| Validate security answer hash |
| `POST` | `/api/auth/reset-password` | Reset password following verified security answer |

### Molecule & Cheminformatics Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/molecule/predict` | Predict single-endpoint activity for a SMILES string |
| `POST` | `/api/molecule/predict-all` | Run parallel inference across all 8 calibrated ML models |
| `POST` | `/api/molecule/attribution` | Atom- and bond-level feature attribution (SimilarityMaps) & structural alerts |
| `POST` | `/api/molecule/3d` | Generate 3D coordinates via ETKDGv3 and return SDF block |
| `POST` | `/api/molecule/similar` | Tanimoto nearest-neighbor search against reference database (5 metrics) |
| `POST` | `/api/molecule/substructure` | Substructure search against reference molecules with SVG alignment |
| `POST` | `/api/molecule/synthesizability` | Calculate SA_Score (1–10) and identify reactive functional groups |
| `POST` | `/api/molecule/insight` | Generate grounded LLM summary combining properties and trade-offs |
| `POST` | `/api/molecule/ai-summary` | Combined endpoint returning summary and key insights with caching |
| `GET` | `/api/molecule/model-info` | Retrieve metadata, training dates, and split metrics for models |
| `GET` | `/api/molecule/cache/stats` | View cache hit/miss statistics |
| `POST` | `/api/molecule/cache/clear` | Clear the analysis cache table |

### Exploration, Optimization & Benchmarks
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/modification/profiles` | List versioned Lead Optimization War Room profiles |
| `POST` | `/api/modification/war-room` | Multi-parameter optimization decision ranking & 6-axis radar metrics |
| `GET` | `/api/modification/transforms` | List 12 registered medicinal chemistry SMARTS transforms |
| `POST` | `/api/modification/applicable` | Filter transforms matching target functional groups in query structure |
| `POST` | `/api/modification/mutate` | Apply specific catalog transform, generate analog, and compute signed deltas |
| `POST` | `/api/modification/shortlist` | Suggest bioisosteric modifications and R-group variants |
| `POST` | `/api/remediation/find` | Recommend 2-depth structural changes to mitigate specific toxicity flags |
| `GET` | `/api/benchmarks` | List curated reference benchmark drug catalog (Aspirin, Terfenadine, etc.) |
| `GET` | `/api/benchmarks/case-studies` | Retrieve paired historical lead optimization case studies |
| `GET` | `/api/benchmarks/{benchmark_id}` | Detailed pharmacological and clinical provenance for benchmark drug |
| `POST` | `/api/benchmarks/identify` | Match query SMILES against canonical benchmark records |
| `POST` | `/api/chemical-space/locate` | Locate a molecule's coordinates in 2D chemical space via weighted KNN |

### Batch Screening, Reports & System
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/batch/screen` | Screen multi-molecule CSV batches (up to 500 rows) with power pacing |
| `POST` | `/api/batch/report` | Generate aggregated batch screening export summary |
| `POST` | `/api/reports/generate` | Compile self-contained HTML/PDF experiment report |
| `POST` | `/api/reports/dossier` | Generate complete 12-section scientific research dossier HTML |
| `POST` | `/api/reports/dossier/pdf` | Compile 12-section research dossier directly to PDF via WeasyPrint |
| `POST` | `/api/reports/pdf/render` | Render arbitrary dossier HTML into downloadable binary PDF |
| `GET` | `/api/experiments/` | List saved user experiments |
| `POST` | `/api/experiments/` | Save or update an experiment iteration in history |
| `DELETE`| `/api/experiments/{local_id}` | Remove an experiment record from history |
| `GET` | `/api/experiments/{db_id}/story` | Generate narrative chronology for a molecule's optimization chain |
| `GET` | `/api/power/status` | Detect laptop AC power vs battery status via psutil |
| `GET` | `/api/power/setting` | Fetch power-saver mode setting (auto, always_on, always_off) |
| `POST` | `/api/power/setting` | Persist power-saver mode setting in SQLite |
| `GET` | `/api/health` | Health probe returning service status |

---

## 12. Local Database & Schema

ROGVEDA uses a local **SQLite** database (`backend/rogveda.db`) managed via SQLAlchemy 2.0. Tables are initialized automatically on backend startup via `init_db()`.

### Key Tables
1. **`users`**: Stores local user identity:
   - `id`, `display_name`, `email` (indexed, unique), `password_hash` (bcrypt), `security_question`, `security_answer_hash`, `created_at`.
2. **`experiments`**: Stores reproducible experimental iterations:
   - `id`, `user_id`, `local_id` (UUID), `name`, `molfile`, `original_smiles`, `modified_smiles`, `properties_json`, `predictions_json`, `similarity_json`, `ai_insight`, `parent_experiment_id` (links modification chains), `created_at`.
3. **`saved_documents`**: Stores generated or exported documentation:
   - `id`, `user_id`, `name`, `format` (HTML/PDF), `html_content`, `smiles`, `created_at`.
4. **`analysis_cache`**: High-performance persistent cache for ML and LLM results:
   - `id`, `canonical_smiles`, `model_version`, `rogveda_version`, `endpoint`, `result_json`, `created_at`.
   - Constrained by unique constraint: `(canonical_smiles, endpoint)`.
5. **`app_settings`**: Key-value table for hardware modes and local UI preferences:
   - `key` (primary key), `value`, `updated_at`.

---

## 13. AI / Machine Learning Architecture

```text
Input SMILES
     │
     ▼
[RDKit Canonicalization & Sanitization]
     │
     ▼
[Feature Extraction: 2048-bit Morgan Fingerprint (radius=2)]
     │
     ▼
[Ensemble Random Forest Classifiers (n_estimators=500, class_weight='balanced')]
     │
     ▼
[Probability Calibration: CalibratedClassifierCV(method='sigmoid', cv=5)]
     │
     ▼
Output Probability & Calibrated Risk/Activity Label
```

### Model Performance Benchmarks

All models were trained on bioactivity assays from **ChEMBL 37**, **Tox21**, and **ClinTox**, totaling **474,409 evaluated compound records** (**354,323 unique molecules**) under a zero-leakage **80/20 Bemis-Murcko Scaffold Split** (ensuring test compounds possess distinct chemical core ring frameworks from training data):

| Endpoint Target | Source Dataset | Total Compounds | Scaffold Accuracy | ROC-AUC | Precision | Recall | F1 Score | Chosen Threshold | Primary Optimization |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Anti-cancer** | ChEMBL 37 | 227,409 | **77.8%** *(80.3% @0.5)* | **0.822** | 0.627 | 0.670 | 0.648 | 0.30 | Broad pan-cancer cytotoxicity |
| **Anti-microbial** | ChEMBL 37 | 149,610 | **89.4%** *(89.4% @0.5)* | **0.948** | 0.720 | 0.830 | 0.771 | 0.15 | S. aureus bacterial MIC |
| **Anti-inflammatory** | ChEMBL 37 (16 targets) | 52,211 | **79.8%** *(79.8% @0.5)* | **0.886** | 0.803 | 0.947 | 0.869 | 0.50 | COX-1/2, TNF, 5-LOX, iNOS, p38, JAKs |
| **hERG Cardiotoxicity** | ChEMBL 37 (CHEMBL240) | 20,751 | **64.4%** *(74.0% @0.5)* | **0.799** | 0.533 | 0.865 | 0.660 | 0.20 | Safety-first QT prolongation recall |
| **Anti-oxidant** | ChEMBL 37 (Redox/Radical) | 9,340 | **69.9%** *(71.5% @0.5)* | **0.806** | 0.643 | 0.905 | 0.752 | 0.30 | Multi-assay radical scavenging redox |
| **Tox21 (Full Panel)** | NIH / Tox21 | 7,823 | **60.5%** *(65.8% @0.5)* | **0.708** | 0.541 | 0.830 | 0.655 | 0.30 | Broad biological hazard screening |
| **Tox21_MMP Toxicity** | Tox21 / NIH | 5,804 | **77.6%** *(78.6% @0.5)* | **0.798** | 0.517 | 0.635 | 0.570 | 0.15 | Mitochondrial membrane safety |
| **ClinTox** | FDA / Clinical Trials | 1,461 | **82.9%** *(93.5% @0.5)* | **0.762** | 0.208 | 0.579 | 0.306 | 0.10 | Clinical trial failure detection |
| **Total Evaluated** | **ChEMBL 37 + NIH** | **474,409** | — | — | — | — | — | — | **8 Calibrated Ensembles (354k+ unique)** |

### Why Scaffold Splitting & Threshold Optimization Matter
Standard random splits allow identical or near-identical chemical scaffolds to appear in both training and test sets, artificially inflating reported accuracy. ROGVEDA enforces **Bemis-Murcko Scaffold Splitting**, measuring true generalization to novel, unseen chemotypes. Furthermore, for critical safety endpoints like cardiotoxicity (hERG) and clinical toxicity (ClinTox), ROGVEDA performs automated threshold scanning to prioritize recall over raw precision—ensuring potentially hazardous candidate molecules are reliably flagged rather than missed due to severe class imbalance.

---

## 14. Local LLM & RAG Integration

ROGVEDA decouples generative language modeling from the core chemistry backend:
1. **Model Agnostic**: Connects over HTTP to any runtime providing an OpenAI-compatible `/v1/chat/completions` endpoint (default: `http://127.0.0.1:1234/v1`).
2. **Deterministic Context (RAG)**: The LLM is never permitted to guess chemical properties. Instead, the backend constructs a factual payload containing:
   - Computed RDKit descriptors (MW, LogP, TPSA, HBD, HBA).
   - Calibrated ML prediction outcomes and confidence intervals.
   - Detected trade-offs (e.g., cardiotoxicity risk vs. bioactivity).
   - Synthetic accessibility rating (SA_Score) and reactive functional group flags.
3. **Anti-Hallucination Constraints**: Prompts enforce concise, one-paragraph summaries restricted exclusively to the injected facts, with internal reasoning output strictly disabled.
4. **Resilient Timeout & Fallback**: The client enforces a 10-second timeout. If the LLM server is uninitialized or slow, the UI displays the calculated properties and predictions with a notice that AI narrative generation is currently unavailable.

---

## 15. Offline & Privacy Architecture

ROGVEDA is designed from the ground up for strict data privacy:

```text
Browser Client
     │ (Loopback only)
     ▼
127.0.0.1:5173  ──(Vite Proxy)──▶  127.0.0.1:8000 (FastAPI Backend)
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
               127.0.0.1:1234 (Local LLM)           Local SQLite & Pickle Models
```

- **Loopback Binding**: Both FastAPI and the Vite dev server bind strictly to `127.0.0.1`, rejecting connections originating outside the local machine.
- **Zero Cloud Dependencies**: Property calculations, 2D Ketcher drawing, 3D conformer generation, ML inference, and similarity searches run entirely in local memory.
- **No Analytics or Telemetry**: No tracking scripts, telemetry pings, or analytics cookies are bundled or transmitted.

---

## 16. Automated Testing

The backend includes a comprehensive automated test suite implemented in `pytest` covering chemistry calculations, ML inference, cache consistency, contradiction detection, and API endpoints.

### Running the Test Suite
```bash
cd backend
source .venv/bin/activate
pytest
```

### Test Suite Coverage (171 Tests Passing)
- `test_analog_service.py`: Tanimoto similarity queries, shortlist ranking, and target endpoint validation.
- `test_attribution.py`: Atom- and bond-level feature attributions (SimilarityMaps), atomic perturbation, and structural alerts.
- `test_batch_service.py`: High-throughput screening pipelines, CSV parsing, and error recovery.
- `test_benchmarks.py`: Reference benchmark drug catalog integrity, case study pairing, and canonicalization.
- `test_cache_service.py`: Composite MD5 model fingerprinting, cache hit/miss semantics, and cache invalidation.
- `test_contradiction_service.py`: Biochemical trade-off and paradox detection heuristics (Efficacy vs. Cardiotoxicity).
- `test_dossier.py`: 12-section research dossier generation, WeasyPrint PDF compilation, and fallback narratives.
- `test_mutation.py`: 12 registered SMARTS transforms, live mutation workbench, and property deltas.
- `test_remediation_service.py`: Two-depth structural mitigation search for toxicity liability removal.
- `test_story_service.py`: Chronological experiment lineage walking and delta narrative generation.
- `test_synthesizability_service.py`: Ertl-Schuffenhauer SA_Score calculations and reactive group matching.
- `test_war_room.py`: Multi-parameter optimization profiles, dynamic weight renormalization, and hard constraints.

---

## 17. Security Considerations

- **Input Sanitization**: All incoming SMILES strings pass through RDKit's strict C++ sanitizer (`Chem.MolFromSmiles`). Invalid valences, malformed strings, or script injection payloads are rejected before processing.
- **Password Security**: Passwords and security recovery answers are salted and hashed using **Bcrypt** (`bcrypt` with 12 rounds) before storage.
- **Session Tokens**: Authentication tokens are signed using **JWT (JSON Web Tokens)** with the `HS256` algorithm and a 24-hour expiration window.
- **Localhost Boundary**: Servers do not bind to `0.0.0.0` (all interfaces), preventing exposure on local Wi-Fi or local area networks.
- **Prompt Sandboxing**: Local LLM calls are strictly bounded text-in/text-out transformations. The model runtime is never granted filesystem or shell execution capabilities.

---

## 18. Troubleshooting

### 1. `ModuleNotFoundError: No module named 'fastapi'` (or `rdkit`)
- **Cause**: Command executed outside the virtual environment.
- **Solution**: Ensure the virtual environment is activated before running backend commands:
  ```bash
  source backend/.venv/bin/activate
  ```

### 2. Frontend Fails to Connect to Backend (`Network Error`)
- **Cause**: Backend server is not running or running on an unexpected port.
- **Solution**: Verify that `uvicorn` is running on `127.0.0.1:8000`. Test the health check in your browser or terminal:
  ```bash
  curl http://127.0.0.1:8000/api/health
  # Should return: {"status":"ok","service":"rogveda-backend"}
  ```

### 3. AI Insight Shows "AI service currently unavailable"
- **Cause**: Local LLM server (LM Studio or llama.cpp) is not running on port `1234`.
- **Solution**: Start your local LLM runtime and ensure it listens on `http://127.0.0.1:1234/v1`. Note that all chemical descriptors, 3D conformers, and ML predictions continue functioning normally without the LLM.

### 4. Port Conflict on 8000 or 5173
- **Cause**: An existing process is occupying the designated port.
- **Solution**: Terminate the conflicting process:
  ```bash
  # Check for process on port 8000
  lsof -i :8000
  # Terminate PID
  kill -9 <PID>
  ```

---

## 19. Contributing & Development Workflow

Contributions from researchers, software engineers, and computational chemists are welcome.

### Contribution Process
1. **Fork the Repository**: Create your own branch on GitHub.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. **Adhere to Code Standards**:
   - Maintain PEP 8 guidelines for Python code.
   - Run the automated test suite before committing (`pytest backend/tests/`).
   - Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).
4. **Submit a Pull Request**: Provide a clear description of changes, referenced issue numbers, and test output.

---

## 20. Project Roadmap

### Completed (v0.1.0 MVP)
- [x] Full-featured Ketcher 2D molecular drawing interface.
- [x] WebGL 3D conformer viewer (ETKDGv3 distance geometry with MMFF94 force field).
- [x] Deterministic calculation of 17+ core physicochemical descriptors via RDKit WebAssembly & Python.
- [x] 8 calibrated Random Forest ML models trained on ChEMBL 37, Tox21, and ClinTox data.
- [x] Strict 80/20 Bemis-Murcko scaffold splitting evaluation.
- [x] Lead Optimization War Room with multi-parameter optimization (MPO) and hard constraint filtering.
- [x] Explainable AI attribution viewer (atomic environment perturbation & PAINS/Brenk structural alerts).
- [x] Benchmark Drug Gallery with historical case studies (e.g. Terfenadine vs. Fexofenadine).
- [x] High-throughput batch molecule screening dashboard with power-aware battery pacing.
- [x] Tanimoto fingerprint similarity search against 10,027 reference compounds.
- [x] Offline RAG copilot integration via local loopback LLMs.
- [x] Local SQLite experiment tracking and 12-section research dossier PDF/HTML exports.
- [x] 171-test automated backend test suite (100% passing).

### Planned Enhancements
- [ ] **Cross-Platform Desktop Shell**: Packaging as a lightweight standalone desktop binary using **Tauri** (Rust backend + Web view) for native OS installation without manual terminal launch.
- [ ] **Quantum Chemical Descriptors**: Integrating semi-empirical 3D quantum descriptors (HOMO/LUMO energy gaps, bond dissociation enthalpies) to enhance antioxidant and redox prediction accuracy.
- [ ] **Transfer Learning Models**: Incorporating pretrained molecular transformers (e.g., ChemBERTa / MoLFormer) for low-data endpoint regimes.
- [ ] **Local Molecular Docking**: Lightweight target protein docking integration via AutoDock Vina running locally on CPU.

---

## 21. Known Limitations

- **Endpoint Diversity**: Bioactivity and toxicity predictions are focused on 8 calibrated endpoints spanning primary discovery and safety targets (anticancer, antimicrobial, anti-inflammatory, antioxidant, hERG cardiotoxicity, Tox21 MMP, full Tox21 panel, and ClinTox). Broader ADMET profiling outside these targets remains an area for future extension.
- **Low-Data Regimes**: Endpoints with smaller public assay sets (such as ClinTox and antioxidant) exhibit wider confidence bounds due to extreme class imbalance and multi-mechanistic biological cliffs.
- **Conformer Generation**: 3D conformers are computed using standard ETKDG distance geometry heuristics and represent reasonable energy conformations, but do not replace full molecular dynamics energy minimizations.
- **Hardware Bound**: Local LLM generation speed is directly dependent on host CPU/RAM capabilities.

---

## 22. License & Scientific Disclaimer

This project is open-source software licensed under the **MIT License**. See the [LICENSE](LICENSE) file for the full license text.

> ### Scientific & Medical Research Disclaimer
> **Research Use Only**: The bioactivity, toxicity, and pharmacokinetic predictions generated by Rogveda are computed using *in-silico* machine learning models and cheminformatics heuristics. 
> 
> - This software is intended strictly for academic, scientific, and educational research in computational drug discovery.
> - Output from this platform must **not** be construed as medical diagnosis, clinical advice, or a guarantee of biological safety or therapeutic efficacy.
> - Any candidate molecules identified or evaluated by Rogveda must undergo rigorous *in-vitro*, *in-vivo*, and regulatory validation before any biological or medical application.

---

## 23. Authors & Team

- **Pankaj Garg** — *Lead Architect & Developer* ([GitHub](https://github.com/Garg-Pankaj29))
- **Team Zenith**

---

## 24. Acknowledgements

- **[RDKit](https://www.rdkit.org/)**: Open-source cheminformatics and machine learning software.
- **[ChEMBL](https://www.ebi.ac.uk/chembl/)**: European Bioinformatics Institute (EMBL-EBI) open bioactivity database.
- **[Tox21 / NIH](https://tripod.nih.gov/tox21/)**: High-throughput environmental and clinical chemical toxicity screening data.
- **[Ketcher](https://lifescience.opensource.epam.com/ketcher/)**: Open-source chemical structure editor by EPAM Systems.
- **[3Dmol.js](https://3dmol.csb.pitt.edu/)**: WebGL-based molecular viewer by Nicholas Rego & David Koes.
- **[FastAPI](https://fastapi.tiangolo.com/)**: Modern high-performance Python web framework.
