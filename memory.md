# ROGVEDA — Project Memory & Phase Tracker

## Architecture & Guiding Invariants
- **Offline-First:** All chemistry computation, ML inference, and LLM text generation occur on `127.0.0.1`. No external APIs, CDNs, or cloud telemetry.
- **Cheminformatics Ground Truth:** RDKit is strictly used for molecular parsing, sanitization, canonicalization, 3D conformers, fingerprints, and descriptors.
- **Scientific Honesty:** ML predictions represent calibrated computational estimates, never clinical or safety determinations. Missing or unsupported endpoints are explicitly tracked and excluded from scores, never defaulted to zero or safe.
- **Reproducibility:** Experiments, objective profiles, and modification chains preserve complete provenance and parent-child linkage.

---

## Phase 1: Lead Optimization War Room

### Objectives & Summary
Implemented a dedicated Lead Optimization War Room decision workspace enabling medicinal chemists to evaluate multi-parameter trade-offs between parent molecules and generated analogs across 6 research-relevant dimensions with versioned optimization profiles.

### Dimensions & Scientific Provenance
1. **Predicted Activity:** Evaluated using trained activity models (`antiinflammatory`, `antioxidant`, etc.) with calibrated probabilities.
2. **Cardiac Liability (hERG):** Retains raw risk probability and risk status (threshold 0.20); normalized for display as Cardiac Safety = `1.0 - raw_risk` (higher is safer).
3. **Mitochondrial Liability (Tox21 MMP):** Disruption probability retained; normalized for display as Mitochondrial Safety = `1.0 - raw_risk` with explicit notice that safety preference is not calibrated clinical safety.
4. **Oral-Property Heuristic:** Deterministic Lipinski/Veber physicochemical proxy (MW, LogP, TPSA, RotB, HBD, HBA) scored in [0.0, 1.0]; explicitly labeled as a proxy heuristic, not a measured human bioavailability prediction.
5. **Synthetic Accessibility:** Reuses RDKit `sascorer.calculateScore(mol)` from `synthesizability_service.py` (scale 1–10) inverted to higher-is-easier: `(10.0 - raw_sa) / 9.0`. Raw SA score and difficulty label preserved.
6. **Metabolic Stability:** Explicitly marked unavailable with reason (`No validated local metabolic stability predictor is installed`). Transparently excluded from scoring and radar polygon rather than treated as zero or safe.

### Versioned Optimization Profiles
- `anti_inflammatory_exploration_v1`: Prioritizes anti-inflammatory activity (0.35) with cardiac (0.20) and mitochondrial (0.15) safety, oral proxy (0.15), and synthetic ease (0.15). Hard constraints: hERG risk <= 0.35, MW <= 550 Da.
- `balanced_lead_optimization_v1`: Balanced multi-parameter profile (activity 0.20, cardiac 0.25, mito 0.20, oral 0.15, synthetic ease 0.20). Hard constraints: hERG risk <= 0.20, MMP risk <= 0.25, SA_Score <= 5.0.
- `safety_first_scrutiny_v1`: High-scrutiny profile (cardiac 0.35, mito 0.25, activity 0.15, synthetic ease 0.15, oral 0.10). Hard constraints: hERG risk <= 0.20, MMP risk <= 0.15, SA_Score <= 4.5.

### Transparent Weight Renormalization & Gating
- Effective weights dynamically renormalize across eligible dimensions: `effective_weight_i = nominal_weight_i / sum(nominal_weights of available dimensions)`.
- Candidate aggregate score equals `sum(effective_weight_i * normalized_score_i)`.
- Hard constraints are evaluated independently on raw metrics; violations are flagged with clear badges and descriptions, preventing severe toxicity flags from being concealed behind high activity scores.

### New & Extended Contracts
- `GET /api/modification/profiles`: Returns versioned optimization profiles with descriptions, rationales, weights, and hard constraints.
- `POST /api/modification/war-room`: Evaluates parent molecule and ranks top-N analogs with full dimension breakdowns, radar data, deltas, and constraint checks.
- `POST /api/modification/shortlist`: Maintained with 100% backward compatibility.

### Files Modified & Created
- `backend/app/services/war_room_service.py` *(New)*: Core multi-dimensional scoring, profile repository, weight renormalization, and candidate evaluation.
- `backend/app/api/modification.py` *(Modified)*: Added `/profiles` and `/war-room` endpoints with Pydantic request models.
- `backend/tests/test_war_room.py` *(New)*: 18 unit/integration tests covering determinism, weight normalization, oriented dimensions, missing endpoints, hard constraints, property deltas, and API compatibility.
- `frontend/src/components/WarRoomTab.jsx` *(New)*: War Room workspace UI featuring profile selection, ranked shortlist, side-by-side 2D chemical structures, Recharts radar chart, companion breakdown table, and handoffs.
- `frontend/src/pages/MoleculeDraw.jsx` *(Modified)*: Integrated War Room tab into navigation, breadcrumbs, and tab switcher.
- `frontend/src/components/CompareTab.jsx` *(Modified)*: Added handoff receiver for candidate analogs sent from War Room.
- `frontend/src/App.jsx` *(Modified)*: Added `/war-room` route redirect.

### Verification Results
- `pytest backend/tests/test_war_room.py -v`: 18 passed (100%) in 392.24s.
- `frontend/src/components/WarRoomTab.jsx`: Alignment and symmetry matched to `CompareTab` and `ModificationTab` (650px container with `#0d1a1c` background, cyan border `rgba(45,212,212,0.1)`, centered empty-state copy and icon; dual-row 50/50 balanced layout when populated).
- `npm run build` (frontend): Built cleanly with Vite in 7.95s with zero errors.

### Unresolved Issues / Known Limitations
- Metabolic stability predictor is intentionally unavailable in offline model bundle; properly reported as unavailable in UI and scoring.

---

## Phase 2: Explainable Molecular Attribution

### Objectives & Summary
Integrated native, explainable molecular attribution into the existing Rogveda interface without creating new navigation tabs, standalone pages, or duplicate pipelines. Enabled medicinal chemists to inspect atomic- and bond-level feature sensitivities, Morgan fingerprint perturbations, bit collisions, and independent structural alerts directly within existing analysis, prediction, and War Room screens.

### Required Integration Points (Verified Embedded UX)
1. **Molecular Analysis (`AnalysisTab.jsx`)**:
   - Added inline "Explain Prediction" action button on prediction cards.
   - Clicking opens the `AttributionViewer` modal populated with the analyzed SMILES and targeted endpoint.
2. **Prediction & AI (`PredictionTab.jsx`)**:
   - Added "Explain" action button to every row of the Multi-Endpoint Prediction Results table.
   - Clicking immediately focuses `AttributionViewer` on the selected endpoint with zero context loss.
3. **Lead Optimization War Room (`WarRoomTab.jsx`)**:
   - Added "Explain" action on ML prediction dimensions (`cardiac_safety`, `mitochondrial_safety`, `predicted_activity`) in the Multi-Dimensional Evaluation Table for both the candidate analog and parent molecule without leaving the War Room workspace.
4. **Architectural Invariant Guarantee**:
   - **0 new navigation items or top-level tabs** introduced.
   - **0 changes** to routing shell or standalone pages.
   - Ketcher and 3D Conformer viewer remain intact and unmodified.

### Attribution Methodology & Scientific Provenance
1. **Estimator Inspection & Feature Representation**:
   - Verified all 8 active models (`herg`, `tox21_mmp`, `antiinflammatory`, `antioxidant`, `antimicrobial`, `anticancer`, `tox21`, `clintox`) use Morgan Fingerprints (`radius=2, nBits=2048`) with `CalibratedClassifierCV(RandomForestClassifier, method='sigmoid', cv=5)`.
2. **Batched Atomic Environment Perturbation**:
   - Uses RDKit's `SimilarityMaps.GetMorganFingerprintForAtom(mol, atom_idx, radius=2, nBits=2048)`.
   - Generates the base fingerprint and $N$ perturbed fingerprints (with atom $i$'s environment subtracted) in a single batched 2D NumPy array for vectorised `model.predict_proba(X)`.
   - Raw sensitivity: $\Delta P_i = P(\text{full molecule}) - P(\text{molecule without atom } i)$.
   - Normalized visualization intensity: $I_i = \text{sign}(\Delta P_i) \cdot \frac{|\Delta P_i|}{\max_j |\Delta P_j|} \in [-1.0, 1.0]$.
   - Signed score interpretation:
     - For activity endpoints: Positive delta ($\Delta P_i > 0$) indicates the atom promotes target efficacy; negative delta ($\Delta P_i < 0$) indicates the atom attenuates target efficacy.
     - For toxicity/liability endpoints: Positive delta ($\Delta P_i > 0$) indicates the atom drives toxicological liability (risk factor); negative delta ($\Delta P_i < 0$) indicates the atom mitigates liability.
3. **Bond Attribution**:
   - Bond contribution calculated deterministically as the average contribution of its constituent atoms: $B_{jk} = \frac{A_j + A_k}{2}$.
4. **Bit Collision Detection**:
   - Maps Morgan fingerprint bits to atom environments using RDKit fingerprint info bit dictionaries.
   - Flags `has_collision=True` if a bit maps to multiple disjoint atom environments (due to 2048-bit hash collisions or structural symmetry), ensuring transparency about non-unique feature mappings.
5. **Independent Structural Alerts**:
   - Evaluates RDKit `FilterCatalog` rule sets (`PAINS_A`, `PAINS_B`, `PAINS_C`, `BRENK`, `NIH`) independently of model weights.
   - Structural alerts are strictly separated from ML feature attribution to prevent confusing statistical feature sensitivity with proven causal biological mechanisms or clinical toxicophores.
6. **Transparent Unsupported / Unavailable State**:
   - Endpoints without trained models or valid estimators (e.g., `metabolic_stability`) return `is_available: false` with explicit explanatory reasons. No atom scores are ever invented or defaulted.

### New API Contracts & Schemas
- `POST /api/molecule/attribution`:
  - Request: `AttributionRequest(smiles: str, endpoint: str)`
  - Response: `AttributionResponse(smiles, canonical_smiles, endpoint, endpoint_name, is_available, unavailability_reason, probability, threshold, confidence, label, atom_attributions: List[AtomAttribution], bond_attributions: List[BondAttribution], structural_alerts: List[StructuralAlertMatch], highlighted_svg: str, method_name, method_limitations)`
- `POST /api/molecule/predict-all`:
  - Enriched response with `endpoint_id` across all result dictionaries for robust client-side attribution routing.

### Files Modified & Created
- `backend/app/schemas/attribution_schemas.py` *(New)*: Pydantic schemas for atom/bond attributions, structural alerts, and endpoint requests/responses.
- `backend/app/services/attribution_service.py` *(New)*: Morgan fingerprint atomic perturbation engine, FilterCatalog alert extraction, dark-theme SVG renderer with custom atom/bond highlight colors, and in-memory caching.
- `backend/app/api/molecule.py` *(Modified)*: Added `/api/molecule/attribution` endpoint and enriched `predict-all` endpoint responses with `endpoint_id`.
- `backend/tests/test_attribution.py` *(New)*: 15 comprehensive unit and API integration tests covering index bounds, SMILES canonicalization consistency, $[-1, 1]$ intensity bounds, signed score directions, bit collisions, alert separation, unavailable endpoints, and invalid SMILES.
- `frontend/src/components/AttributionViewer.jsx` *(New)*: Dark charcoal and teal attribution inspector modal with endpoint tabs, highlighted SVG depiction, color-coded legend, scientific limitation disclaimer, atom attribution breakdown table, and structural alerts drawer.
- `frontend/src/components/AnalysisTab.jsx` *(Modified)*: Integrated inline "Explain Prediction" trigger on prediction cards.
- `frontend/src/components/PredictionTab.jsx` *(Modified)*: Integrated "Explain" action on multi-endpoint table rows.
- `frontend/src/components/WarRoomTab.jsx` *(Modified)*: Integrated "Explain" action on ML dimensions for candidate analog and parent molecule.

### Verification Results
- `backend/tests/test_attribution.py`: 15 passed (100%) in 10.39s.
- Full backend validation suite (`test_attribution.py`, `test_cache_service.py`, `test_batch_service.py`, `test_contradiction_service.py`, `test_synthesizability_service.py`): 65 passed (100%) in 55.52s.
- `backend/tests/test_war_room.py`: 18 passed (100%) in 392.24s.
- Frontend Production Build (`npm run build`): Completed in 4.28s with zero errors (all 1321 modules transformed cleanly).
- Offline & Security Invariants: 100% loopback-only (`127.0.0.1`), zero external network requests or CDN dependencies.

### Unresolved Issues / Known Limitations
- Model attribution reflects in-silico feature sensitivity ($\Delta P$) of the calibrated classifier to Morgan atom environments, not confirmed biological binding kinetics or clinical toxicophores.
- Metabolic stability predictor remains unavailable in the offline model bundle; properly reports explicit unavailable status when queried.

---

## Phase 3: Reproducible Research Dossier

### Objectives & Summary
Integrated comprehensive, reproducible research dossier generation directly into the existing reporting and export workflows of ROGVEDA. Enabled medicinal chemists to generate self-contained, print-ready HTML and binary PDF dossiers from both Molecular Analysis and the Lead Optimization War Room without introducing any new top-level tabs, standalone report pages, or parallel export pipelines.

### Required Integration Points (Verified Embedded UX)
1. **Molecular Analysis (`AnalysisTab.jsx`)**:
   - Added contextual "Generate Research Dossier" action button alongside existing "Export" controls.
   - Added "Research Dossier (PDF)" and "Research Dossier (HTML)" to the format selector dropdown.
   - Generates and downloads the dossier directly for the currently analyzed molecule while preserving document history.
2. **Lead Optimization War Room (`WarRoomTab.jsx`)**:
   - Added contextual "Export Dossier" in top controls and "Research Dossier" button in candidate analog action bar.
   - Automatically bundles parent SMILES, selected candidate analog, versioned optimization profile metadata (`CNS_LEAD_V1`, `balanced_lead_optimization_v1`, etc.), candidate desirability score, multi-parameter radar breakdown, and hard-constraint checks without re-computation.
3. **Existing Report & Document History Flows (`MoleculeDraw.jsx`, `SavedDocuments.jsx`)**:
   - `MoleculeDraw.jsx`: Extended `handleGenerateReport` to support direct binary PDF downloads, HTML previews, 3D conformer attachment, and auto-saving to local history via `documentService`.
   - `SavedDocuments.jsx`: Updated `handleDownload` to trigger real WeasyPrint PDF downloads via `/api/reports/pdf/render` with local print preview fallback.
4. **Architectural Invariant Guarantee**:
   - **0 new navigation tabs or top-level routes** introduced.
   - **0 standalone reporting pages** or parallel pipelines.
   - **100% offline (127.0.0.1)**: Replaced external Google Font CDNs in legacy reporting with native system font stacks (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`). Zero telemetry or external network calls.

### 12-Section Reproducible Dossier Specification
1. **Title Page & Metadata**: Unique Dossier ID (`ROG-DOSSIER-XXXXXXXX`), UTC generation timestamp, chemical formula, format, and offline engine attribution.
2. **Executive Summary**: Synthesized from structured findings. Uses local LLM when available, grounded strictly in computed facts, with an automatic deterministic rule-based fallback when offline or LLM is stopped.
3. **2D Structure Depiction & Canonical SMILES**: High-contrast, clean RDKit vector SVG rendering with word-break monospaced SMILES and formula/mass data.
4. **3D Conformer Geometry & Status**: Conformer status and energy metrics with explicit structural honesty disclaimer: in-silico generated computational conformer (ETKDGv3 / MMFF94), NOT an experimental X-ray crystallographic structure.
5. **Physicochemical Properties & Drug-Likeness Evaluation**: Comprehensive RDKit descriptors (MW, LogP, TPSA, HBD, HBA, RotB, Rings, Fsp3, etc.) and drug-likeness rule compliance (Lipinski, Veber, Ghose, Egan, Muegge). Missing fields display explicit italicized *"Data yet to be calculated"* notice.
6. **Calibrated ML Bioactivity & Toxicity Predictions**: Target bioactivity and toxicological endpoints with calibrated confidence bars, decision thresholds, model architecture, and scaffold-split training provenance.
7. **Lead Optimization War Room Evaluation**: Multi-parameter trade-offs, profile version, composite candidate score, score delta, effective dimension weights, and hard constraint evaluation.
8. **Explainable Molecular Attribution**: Phase 2 atomic sensitivity perturbations ($\Delta P$), bit collision transparency, and method notices.
9. **Structural Alerts & Synthetic Accessibility**: Independent PAINS and Brenk filter catalog hits, heuristic Ertl SA score (1–10), and reactive functional group audit.
10. **Curated Chemical Library Similarity Search**: Tanimoto similarity ranking using 2048-bit Morgan radius-2 fingerprints against versioned local reference database (`curated_drugs_v1`).
11. **Experiment Lineage & Audit Trail**: Parent molecule ID, modification steps, user notes, and local reproducibility seed.
12. **Evidence, Scientific Limitations & Regulatory Disclaimer**: Prominent non-claim notice: strictly computational in-silico estimates for hypothesis generation; no claim of clinical safety, human bioavailability, or FDA IND/NDA regulatory readiness.

### Offline PDF & HTML Rendering Architecture
- **WeasyPrint 61.2**: Used for high-fidelity vector PDF generation directly from sanitized HTML.
- **CSS Paged Media**: `@page { size: A4; margin: 14mm 16mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); } @bottom-left { content: "ROGVEDA Research Dossier • Confidential & Reproducible"; } }`.
- **System Fonts**: Zero CDN dependencies; uses native fonts across Linux, macOS, and Windows.
- **Sanitization**: All user-supplied text and LLM outputs are escaped via `html.escape()` with strict `<script>` stripping to prevent XSS.

### New & Extended API Contracts & Schemas
- `POST /api/reports/dossier`: Generates structured dossier HTML and metadata.
  - Schema: `DossierGenerateRequest(smiles, canonical_smiles, properties, predictions, ai_summary, similarity_hits, drug_likeness, conformer_3d, attribution, war_room, lineage, structural_alerts, synthesizability, report_format)`
  - Schema: `DossierGenerateResponse(html, name, dossier_id, created_at)`
- `POST /api/reports/dossier/pdf`: Generates and streams binary PDF (`application/pdf`) with `Content-Disposition: attachment; filename="Dossier_...pdf"`.
- `POST /api/reports/pdf/render`: Reusable HTML-to-PDF renderer accepting `{"html": "..."}` and streaming valid binary PDF bytes.
- `POST /api/reports/generate`: Extended with backward compatibility; routes dossier formats to `generate_research_dossier`.

### Files Modified & Created
- `backend/app/schemas/dossier_schemas.py` *(New)*: Pydantic request/response models for dossier sections, war room data, attribution, lineage, and 3D conformers.
- `backend/app/services/report_service.py` *(Modified)*: Implemented `generate_research_dossier`, `generate_deterministic_dossier_summary`, and `render_pdf_from_html` (WeasyPrint). Sanitized legacy reports to remove Google Fonts CDNs.
- `backend/app/api/reports.py` *(Modified)*: Added `/dossier`, `/dossier/pdf`, and `/pdf/render` endpoints with binary streaming.
- `backend/app/services/llm_service.py` *(Modified)*: Fixed missing `logger` definition to prevent runtime NameError.
- `backend/tests/test_dossier.py` *(New)*: 10 comprehensive unit and API tests covering all 12 sections, missing data, deterministic fallback, XSS sanitization, long SMILES, and WeasyPrint PDF binary output.
- `frontend/src/lib/apiClient.js` *(Modified)*: Added `downloadBlob` helper for binary file downloads.
- `frontend/src/pages/MoleculeDraw.jsx` *(Modified)*: Extended `handleGenerateReport` for direct PDF download, dossier HTML preview, and War Room context handoff.
- `frontend/src/components/AnalysisTab.jsx` *(Modified)*: Added contextual "Generate Research Dossier" button and format selector options.
- `frontend/src/components/WarRoomTab.jsx` *(Modified)*: Added "Export Dossier" in top controls and "Research Dossier" in candidate handoff action bar.
- `frontend/src/pages/SavedDocuments.jsx` *(Modified)*: Added WeasyPrint PDF download option for saved reports.

### Verification Results
- `pytest backend/tests/test_dossier.py -v`: 10 passed (100%) in 2.24s.
- Full Backend Validation Suite (`test_dossier.py`, `test_attribution.py`, `test_cache_service.py`, `test_contradiction_service.py`, `test_synthesizability_service.py`): 57 passed (100%) in 14.60s.
- Frontend Production Build (`npm run build`): Built in 4.27s with zero errors (all 1321 modules transformed cleanly).
- Real Artifact Inspection: Generated `sample_dossier.html` (34,721 bytes) and `sample_dossier.pdf` (49,972 bytes, 4 pages, verified with `pypdf`).
- Visual & Structural Verification: Confirmed all 12 sections, vector RDKit SVG, deterministic fallback summary, CSS Paged Media `@page` bottom-left/bottom-right counters ("Page X of Y"), and regulatory non-claim disclaimers render correctly.
- Offline & Security Invariants: 100% offline (`127.0.0.1`), zero external network calls, zero unapproved dependencies.

### Unresolved Issues / Known Limitations
- Dossier results represent in-silico computational estimates for hypothesis generation; they do NOT constitute evidence of clinical safety, human bioavailability, or regulatory approval (FDA IND/NDA, EMA).
- 3D conformer depictions reflect computed molecular mechanics minima (RDKit ETKDGv3 / MMFF94 force field), not experimental X-ray crystallography or Cryo-EM structures.

---

## Post-Phase 3 Refinements & User Feedback Fixes

### 1. War Room Dossier Export Fixes
- **Root Causes**:
  - `DossierWarRoomData` schema in `dossier_schemas.py` rigidly required `dimensions` to be a `List[Dict]`. In the frontend and backend candidate objects, `dimensions` is an object/dict (`{"activity": {...}}`). This threw a 422 Unprocessable Entity error when exporting from the War Room.
  - In `report_service.py`, iterating over `for d in dims:` when `dims` is a dictionary iterated over string keys, raising `AttributeError: 'str' object has no attribute 'get'`.
  - When `description` was `None` in the war room payload, `html.escape(p_desc)` threw `AttributeError: 'NoneType' object has no attribute 'replace'`.
- **Fixes Applied**:
  - `dossier_schemas.py`: Made `dimensions: Any = None` and `property_deltas: Any = None` to accept both dictionary mapping and list arrays without validation failures.
  - `report_service.py`: Added automatic dictionary-to-list row conversion and safe string casting `html.escape(str(p_desc or ''))`, `html.escape(str(p_name or ''))`, etc.
  - `WarRoomTab.jsx`: Added `isExportingDossier` state, active animated loading spinner, and error alert handling on both "Export Dossier" in top controls and "Research Dossier" in candidate handoff bar.
  - Verified with new test `test_api_dossier_pdf_with_war_room_dict_dimensions` in `test_dossier.py` (29/29 tests passed in `test_dossier.py` + `test_war_room.py`).

### 2. Analysis Tab Export Button Consolidation
- **Root Cause**: The Analysis tab had two adjacent buttons: "Generate Research Dossier" and "Export Selected Format". They served overlapping purposes.
- **Fix Applied**:
  - Consolidated into a single dynamic button: `Export {selectedFormat}` (e.g. `Export Research Dossier (PDF)` or `Export Markdown Report`).
  - Added disabled states and animated spinner during active downloads.

### 3. Background Calculation on Molecule Draw (Zero Cyan Dot)
- **User Request**: Remove the cyan dot indicator on the War Room tab header, but ensure all tabs start background calculations when a molecule is drawn for seamless navigation.
- **Fix Applied**:
  - `MoleculeDraw.jsx`: Removed `isCalculating: isWarRoomCalculating` and deleted the cyan dot span from the tab navigation header.
  - Verified and ensured all tabs run background calculations on SMILES change:
    - **Analysis Tab**: Auto-computes molecular descriptors, Lipinski rules, and synthesizability score.
    - **Prediction & AI Tab**: Auto-queries bioactivity and ADMET liabilities.
    - **War Room Tab**: Auto-initiates candidate evaluation and multi-parameter desirability scoring.
    - **Similarity Tab**: Added auto-search on molecule draw so compound library similarity hits are pre-calculated before the user even clicks the tab.

---

## Phase 4: Live Molecular Mutation (Live Mutation Workbench)

### Objectives & Summary
Integrated interactive, real-time molecular mutation into the existing Draw and Molecular Modification workspaces without creating any new top-level tabs, standalone mutation pages, or duplicate drawing editors. Provided medicinal chemists with a chemically validated 12-transformation catalog, instant applicability evaluation against target molecular substructures, before-and-after physicochemical property delta comparisons, independent neural ML predictions for mutated candidates, positional isomer selection, and seamless candidate handoffs to Draw, Compare, and the Lead Optimization War Room.

### Required Integration Points (Verified Embedded UX)
1. **Molecular Modification (`ModificationTab.jsx`)**:
   - Added contextual "Live Mutation" subtab as the default active subtab in the Modification Analysis workspace.
   - Filter chips for `All (12)`, `Applicable (${num})`, and `Unavailable (${num})`.
   - 12-item Transformation Catalog displaying chemistry category tags, substructure target groups, applicability status, and specific unavailability rationales.
   - Active Candidate Mutation Workbench featuring:
     - 2D SVG structure preview with canonical candidate SMILES and one-click clipboard copy.
     - Positional Isomer Selector pills (for reactions with multiple regioisomers, e.g., aromatic C-H functionalization).
     - Before-and-After Physicochemical Property Deltas table comparing Parent vs Candidate with signed deltas (MW, LogP, TPSA, HBD, HBA, RotBonds, Aromatic Rings, Heavy Atoms, Fraction Csp3).
     - Independent candidate ML predictions (Anti-inflammatory, Antioxidant, Antimicrobial, Anticancer, hERG, Tox21 MMP) with calibrated confidence bars, probability percentages, and risk/activity status.
     - Action toolbar: **Accept Candidate** (promoted to active workspace molecule), **Continue in Draw**, **Compare with Parent**, **Send to War Room**, and **Reset to Parent**.
2. **Draw (`MoleculeDraw.jsx`)**:
   - Candidate handoff via `onSendToEditor`: Loads candidate into Ketcher editor and switches active tab to `Draw`.
   - Candidate acceptance via `onAcceptCandidate`: Promotes candidate to active molecule in the workspace and Ketcher, dispatching user notification and logging activity.
3. **Compare Molecules (`CompareTab.jsx`)**:
   - Candidate handoff via `onSendToCompare`: Sets candidate as Target Molecule B in `localStorage` (`rogveda_compare_target_molb`) and navigates to the `Compare` tab for structural and property comparison against Parent Molecule A.
4. **Lead Optimization War Room (`WarRoomTab.jsx`)**:
   - Candidate handoff via `onSendToWarRoom`: Loads candidate as the primary active lead for multi-parameter profile desirability scoring and radar chart evaluation.
5. **Architectural Invariant Guarantee**:
   - **0 new navigation tabs or top-level routes** introduced.
   - **0 duplicate molecular editors or drawing canvases** created.
   - Original parent molecule remains completely unchanged in place until the user explicitly clicks "Accept Candidate".
   - Preview operations do not generate permanent or unintended experiment records.
   - 100% offline-first (`127.0.0.1`), loopback-only binding, zero external CDNs or APIs.

### Chemistry Transformation Catalog (12 Core Transformations)
1. `methylate`: Aromatic C-H -> C-Me (`[cH:1]>>[c:1]C`) | Aliphatic & Aromatic Substitution | Target: Aromatic C-H
2. `fluorinate`: Aromatic C-H -> C-F (`[cH:1]>>[c:1]F`) | Halogenation | Target: Aromatic C-H
3. `chlorinate`: Aromatic C-H -> C-Cl (`[cH:1]>>[c:1]Cl`) | Halogenation | Target: Aromatic C-H
4. `hydroxylate_aromatic`: Aromatic C-H -> C-OH (`[cH:1]>>[c:1]O`) | Functional Group Addition | Target: Aromatic C-H
5. `c_to_n`: Aromatic C-H -> N pyridine bioisostere (`[cH:1]>>[n:1]`) | Bioisosteric Ring Replacement | Target: Aromatic C-H
6. `ester_to_amide`: Carboxylic Ester -> Secondary Amide (`[C:1](=[O:2])[O:3][C:4]>>[C:1](=[O:2])[NH:3][C:4]`) | Bioisosterism | Target: Carboxylic Ester
7. `amide_to_ester`: Amide -> Ester (`[C:1](=[O:2])[N:3][C:4]>>[C:1](=[O:2])[O:3][C:4]`) | Functional Group Modification | Target: Secondary/Tertiary Amide
8. `acid_to_tetrazole`: Carboxylic Acid -> Tetrazole bioisostere (`[C:1](=[O:2])[OH:3]>>[c:1]1nnn[nH]1`) | Bioisosterism | Target: Carboxylic Acid (-COOH)
9. `primary_amine_to_methyl`: Primary Amine -> Secondary Methylamine (`[NH2:1]>>[NH:1]C`) | N-Alkylation | Target: Primary Amine (-NH2)
10. `carboxylic_acid_to_amide`: Carboxylic Acid -> Primary Amide (`[C:1](=[O:2])[OH:3]>>[C:1](=[O:2])[NH2:3]`) | Amidation | Target: Carboxylic Acid (-COOH)
11. `phenol_to_methoxy`: Phenol -> Methoxy ether (`[c:1][OH:2]>>[c:1]OC`) | O-Methylation | Target: Phenolic -OH
12. `chlorine_to_trifluoromethyl`: Aryl Chloride -> Trifluoromethyl (`[c:1][Cl:2]>>[c:1]C(F)(F)F`) | Halogen Bioisostere | Target: Aryl Chloride (Ar-Cl)

### Performance & Latency Metrics
- RDKit Substructure Matching & Reaction execution: **2.5 ms**
- RDKit 9 Physicochemical Descriptors & Property Deltas: **1.04 ms**
- Warm ML Model Inference (6 neural/ensemble endpoints on candidate): **10.3 seconds**
- Request Sequencing Guard: `mutationRequestIdRef` tracks request monotonic IDs to discard stale responses during rapid successive clicks.

### New API Contracts & Schemas
- `GET /api/modification/transforms`: Returns full catalog of 12 transformations with chemistry metadata.
- `POST /api/modification/applicable`: Evaluates molecule against all 12 transforms, returning applicability status, substructure match counts, unavailability reasons, and preview product SMILES.
  - Request: `ApplicableRequest(smiles: str)`
  - Response: `ApplicableResponse(smiles, num_applicable, num_unavailable, transforms: List[TransformApplicabilityItem])`
- `POST /api/modification/mutate`: Applies specified transformation to molecule, computes property deltas, and generates independent ML predictions.
  - Request: `MutateRequest(smiles: str, transform_id: str, variant_index: int = 0)`
  - Response: `MutateResponse(parent_smiles, candidate_smiles, candidate_formula, transform_id, transform_name, transform_description, reaction_smarts, has_multiple_products, total_variants, selected_variant_index, variants, parent_properties, candidate_properties, property_deltas: List[PropertyDeltaItem], predictions: List[EndpointPrediction], timing_ms)`

### Files Modified & Created
- `backend/app/schemas/mutation_schemas.py` *(New)*: Pydantic schemas for catalog items, applicability evaluations, property deltas, candidate predictions, and mutation responses.
- `backend/app/services/modification_service.py` *(Modified)*: Implemented `TRANSFORM_CATALOG`, `get_transform_catalog`, `evaluate_applicable_mutations`, `_compute_full_properties`, `_compute_property_deltas`, `_predict_endpoints`, and `apply_mutation`.
- `backend/app/api/modification.py` *(Modified)*: Added `GET /transforms`, `POST /applicable`, and `POST /mutate` endpoints.
- `backend/tests/test_mutation.py` *(New)*: 15 comprehensive unit and API integration tests covering catalog integrity, applicability across diverse chemistries (aspirin, cyclohexane, aniline, chlorobenzene), invalid SMILES handling, candidate distinctness, multi-product isomer selection, RDKit property deltas, independent candidate ML predictions, and error handling.
- `frontend/src/components/ModificationTab.jsx` *(Modified)*: Integrated Live Mutation Workbench, transformation palette, candidate preview, before/after property deltas, independent ML predictions, and action buttons.
- `frontend/src/pages/MoleculeDraw.jsx` *(Modified)*: Passed candidate handoff handlers (`onSendToEditor`, `onSendToCompare`, `onSendToWarRoom`, `onAcceptCandidate`) to `ModificationTab`.

### Verification Results
- `backend/tests/test_mutation.py`: 15 passed (100%) in 137.48s.
- Frontend Production Build (`npm run build`): Built in 7.18s with zero errors (all 1321 modules transformed cleanly).
- Offline & Security Invariants: 100% loopback-only (`127.0.0.1`), zero external network calls.

### Unresolved Issues / Known Limitations
- Candidate predictions represent statistical ML estimates from warm local scikit-learn models, not wet-lab validated biological binding affinities.
- Transformations with symmetric or multiple matching reaction centers generate positional isomers; the user can inspect each isomer using the provided variant selector pills.





