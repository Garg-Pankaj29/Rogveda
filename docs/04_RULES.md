# ROGVEDA — Development Rules (for team + Antigravity agents)

These rules are written to be dropped into Antigravity's agent/workspace rules folder so every agent task follows them automatically. Antigravity persists a rules/skills folder per workspace ("Fractal Memory") — put this file there as the base ruleset.

## Core Project Directives
1. **Never call any external API or CDN at runtime** — everything must work with network disabled after initial setup.
2. **All chemistry computation happens via RDKit** (Python backend or RDKit.js frontend) — never approximate chemistry logic yourself.
3. **Keep the ML model and LLM calls behind clean route boundaries** so they can fail gracefully without crashing the rest of the app.
4. **Ask before adding any new npm/pip dependency** not already discussed.

## 1. Golden rule
**If it can be computed deterministically (RDKit, math, a lookup), it must never be answered by the LLM.** The LLM only phrases already-computed facts into prose, or answers questions grounded in retrieved local text. Any agent-generated code that asks the LLM to "calculate," "predict," or "look up" a chemical fact is wrong by construction — reject it.

## 2. Offline-first enforcement
- No `fetch`/`axios`/`requests` call in application runtime code may target a non-localhost host. Only setup/training scripts (clearly separated in a `scripts/setup/` or `training/` folder) may touch the internet.
- Every PR/agent task must be testable with the network adapter disabled. If a feature can't be demoed offline, it doesn't belong in the app.
- Any new dependency must be checked for "phone home" behavior (telemetry, license checks) before adding it.
- **Demo Data Script:** The standalone script `backend/scripts/seed_demo_data.py` is provided purely for demo/presentation setup (e.g., seeding a story mode chain). It must be run manually, is NOT part of the automated tests, and must **never** be run against a real user's production database.

## 3. Chemistry correctness
- All molecule parsing goes through RDKit's `Chem.MolFromSmiles` / `Chem.SanitizeMol`. Never hand-roll SMILES validation.
- Reject and surface a clear error for invalid/unsanitizable structures — never silently "guess" a structure.
- Canonicalize SMILES (`Chem.MolToSmiles(mol, canonical=True)`) before storing or comparing, so similarity/dedup logic is consistent.

## 4. ML model rules
- Every prediction must ship with a **calibrated** confidence score, not a raw classifier probability.
- Every model must be trained with a **scaffold split**, not a random split — document the split method in the model's card/metadata file.
- Models are versioned artifacts (`models/<endpoint>_v{n}.pkl`) with a small `metadata.json` (training date, dataset source, split method, test AUC/F1). Never overwrite a model file silently.
- Never claim "safe," "effective," or "will work in humans." Always phrase predictions as "likely active," "low/moderate/high predicted risk," etc., with a confidence value shown.

## 5. Local LLM rules
- Keep prompts short, structured, and fact-grounded (see Architecture doc §5 template). No open-ended "what do you think" prompts to the tiny model.
- Set a low `max_tokens` (≈150–250) and low temperature (≤0.3) for insight generation — determinism and brevity matter more than creativity here.
- Always pass the LLM's output through a basic sanity filter (no empty response, no repeated looping text) before showing it in the UI; fall back to a templated sentence if the LLM output fails the filter.
- Document Q&A must only answer from retrieved local passages — if no relevant passage is found, say so; never let the model "fill in" from its own training knowledge and present it as sourced from the user's document.

## 6. Frontend/UI rules
- Match the existing mockup visual language: dark charcoal/black background, deep teal/cyan accents, muted (not neon) confidence colors — subdued green/teal (high), olive/yellow (medium), muted red (low).
- Burger menu collapsed by default, top-left, left of the ROGVEDA logo.
- Sidebar holds only "Experiment History" and "Saved Documents" — AI Insights stays as an in-page card, never in the sidebar.
- Every screen that shows a prediction must show its confidence bar; never show a label without a number.
- Report generation lives at the bottom of the Prediction/Analysis page — don't duplicate a report button elsewhere.

## 7. Antigravity workflow rules (how to actually run this in the IDE)
- Treat every feature as one **Manager Surface task** with an explicit plan artifact before code is written: e.g., "Implement Similarity Search endpoint" → agent proposes plan (files touched, API contract, test plan) → you approve → agent executes → agent runs `pytest` and reports pass/fail as its artifact.
- Require the agent to produce a **verifiable artifact** for anything chemistry- or ML-related: a screenshot of the 2D/3D render, or a printed table of computed descriptors for a known molecule (e.g., aspirin) that you can eyeball-check against known values (aspirin MW ≈ 180.16, LogP ≈ 1.19–1.3 depending on method).
- Never let an agent auto-commit changes to `models/` (trained model files) or `data/reference_compounds.db` without an explicit human review step — these are the app's "ground truth" and silent corruption there is hard to notice later.
- Gate all shell/terminal actions the agent proposes that touch the network (`pip install` from an unknown index, `curl` to a new host) behind explicit human approval, per Antigravity's security policy gating.
- Use the Manager Surface to parallelize independent slices (e.g., one agent on the 2D editor + RDKit.js integration, another on the ML prediction API, another on report generation) since they don't share state until integration.

## 8. Reproducibility rules
- Every experiment save must include: input SMILES, all computed outputs, model versions used, and a timestamp. This is what "reproducible research loop" means in practice — nothing computed should be un-traceable later.
- Modification chains (`parent_experiment_id`) must never be broken — a user should always be able to walk Original → Mod 1 → Mod 2 and see the property delta at each step.

## 9. Code style
- Python: type hints everywhere in `services/`, `black` + `ruff` for formatting/linting.
- React: functional components + hooks only, Tailwind utility classes (no ad-hoc inline styles unless dynamic).
- Keep chemistry logic, ML logic, and LLM logic in separate service modules (`chemistry_service.py`, `ml_service.py`, `llm_service.py`) — never mix RDKit calls and LLM calls in the same function.
