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


