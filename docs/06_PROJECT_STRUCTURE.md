# ROGVEDA — Project Structure

```
rogveda/
├── frontend/                          # React + Vite app
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx              # animated login (floating molecules, CSS keyframes)
│   │   │   ├── Home.jsx               # hex-node hub (Draw / Analyze / Similarity / Modify / Compare / Predict)
│   │   │   ├── DrawMolecule.jsx       # 2D editor + SMILES input + 3D viewer toggle
│   │   │   ├── MolecularAnalysis.jsx  # properties + AI insight + ML predictions panels
│   │   │   ├── SimilaritySearch.jsx   # molecule A/B + similarity results + AI insights
│   │   │   ├── MolecularModification.jsx
│   │   │   ├── CompareMolecules.jsx
│   │   │   ├── PredictionResults.jsx
│   │   │   ├── ExperimentHistory.jsx
│   │   │   └── SavedDocuments.jsx
│   │   ├── components/
│   │   │   ├── molecule/
│   │   │   │   ├── Canvas2DEditor.jsx     # Ketcher wrapper or custom canvas
│   │   │   │   ├── Viewer3D.jsx           # 3Dmol.js/NGL wrapper
│   │   │   │   ├── SmilesInput.jsx
│   │   │   │   └── TemplatePicker.jsx
│   │   │   ├── panels/
│   │   │   │   ├── PropertiesPanel.jsx
│   │   │   │   ├── AiInsightCard.jsx
│   │   │   │   ├── MlPredictionsPanel.jsx
│   │   │   │   └── ConfidenceBar.jsx
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   ├── TopNav.jsx
│   │   │   │   └── Breadcrumb.jsx
│   │   │   └── shared/ (buttons, modals, cards...)
│   │   ├── lib/
│   │   │   ├── rdkitClient.js          # @rdkit/rdkit WASM wrapper (client-side validation/canonicalize)
│   │   │   └── apiClient.js            # fetch wrapper, hardcoded to localhost backend
│   │   ├── hooks/
│   │   ├── styles/ (tailwind config, theme tokens: teal/charcoal palette)
│   │   └── App.jsx / main.jsx
│   ├── public/
│   │   └── vendor/ (self-hosted 3Dmol.js / NGL / Ketcher bundles — no CDN)
│   ├── package.json
│   └── vite.config.js
│
├── backend/                            # FastAPI app
│   ├── app/
│   │   ├── main.py                     # FastAPI entrypoint, binds 127.0.0.1 only
│   │   ├── api/
│   │   │   ├── molecule.py             # /api/molecule/analyze, /validate
│   │   │   ├── similarity.py           # /api/similarity/search
│   │   │   ├── modification.py         # /api/modification/apply
│   │   │   ├── prediction.py           # /api/prediction/run
│   │   │   ├── experiments.py          # /api/experiments (CRUD, history)
│   │   │   ├── documents.py            # /api/documents (import, list, ask)
│   │   │   └── reports.py              # /api/reports/generate
│   │   ├── services/
│   │   │   ├── chemistry_service.py    # RDKit: parse, sanitize, descriptors, 2D/3D
│   │   │   ├── similarity_service.py   # fingerprint + Tanimoto vs reference DB
│   │   │   ├── ml_service.py           # load models, featurize, predict, calibrate
│   │   │   ├── llm_service.py          # calls local LM Studio/llama.cpp endpoint
│   │   │   ├── retrieval_service.py    # PDF extraction + BM25 retrieval
│   │   │   └── report_service.py       # Jinja2 + WeasyPrint
│   │   ├── db/
│   │   │   ├── database.py             # SQLite connection/session
│   │   │   ├── models.py               # ORM models: User, Experiment, Document, ReferenceCompound
│   │   │   └── migrations/
│   │   ├── schemas/                    # Pydantic request/response models
│   │   └── core/
│   │       ├── config.py               # local paths, ports, model file locations
│   │       └── security.py             # password hashing, local auth
│   ├── tests/
│   │   ├── test_chemistry_service.py   # e.g., aspirin MW/LogP sanity checks
│   │   ├── test_similarity_service.py
│   │   ├── test_ml_service.py
│   │   └── test_api_offline.py         # runs with mocked/no network to prove offline-safety
│   ├── requirements.txt
│   └── pyproject.toml
│
├── ml/                                  # training pipeline — NOT shipped with the app runtime
│   ├── data_prep/
│   │   ├── fetch_chembl.py             # one-time download from EBI FTP
│   │   ├── fetch_tox21_clintox.py      # via DeepChem/MoleculeNet loaders
│   │   ├── standardize_smiles.py       # canonicalize, strip salts, dedupe
│   │   └── scaffold_split.py           # Murcko scaffold split
│   ├── featurize.py                    # Morgan FP + RDKit descriptors
│   ├── train_bioactivity.py
│   ├── train_toxicity.py
│   ├── calibrate.py                    # CalibratedClassifierCV
│   └── model_cards/                    # metadata.json per model: source, split, metrics
│
├── data/                                # shipped, read-mostly data
│   ├── reference_compounds.db          # SQLite: curated compounds + precomputed fingerprints
│   └── models/                         # trained .pkl files, one per endpoint, versioned
│
├── llm/
│   ├── README.md                       # which GGUF model, how to load in LM Studio/llama.cpp
│   └── prompts/
│       ├── ai_insight_template.txt
│       └── modification_delta_template.txt
│
├── scripts/
│   ├── setup_offline_bundle.sh         # one-time: pull datasets/models, populate data/
│   └── run_dev.sh                      # starts backend + frontend + LM Studio server together
│
├── docs/                                # this document set
│   ├── 01_PRD.md
│   ├── 02_TECH_STACK.md
│   ├── 03_ARCHITECTURE.md
│   ├── 04_RULES.md
│   ├── 05_SECURITY.md
│   └── 06_PROJECT_STRUCTURE.md
│
├── .antigravity/                        # Antigravity workspace rules/skills ("Fractal Memory")
│   └── rules.md                        # copy of 04_RULES.md, loaded automatically per-workspace
│
├── .gitignore
└── README.md
```

## Notes on the split

- **`ml/` vs `data/`**: `ml/` is where internet access is allowed (fetching ChEMBL/Tox21/PubChem, training). `data/` is what actually ships — pre-trained `.pkl` files and a pre-populated SQLite reference DB. This separation is what makes the Rules doc's "no runtime internet calls" enforceable: a linter/CI check can simply scan `backend/` and `frontend/` for outbound network calls and fail the build if any are found, without touching `ml/`.
- **`llm/`** just documents which model + prompt templates to use; the actual model weights file lives wherever LM Studio/llama.cpp stores it locally (not committed to git — too large; document the download step instead).
- **`.antigravity/rules.md`**: put your team's `04_RULES.md` content here so every Antigravity agent task in this workspace automatically inherits it via Antigravity's persistent workspace-rules mechanism.
