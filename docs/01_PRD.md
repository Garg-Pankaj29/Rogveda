# ROGVEDA — Product Requirements Document (PRD)

**Team:** Zenith | **Event:** byteBuilt 1.0 (byteXL × Chandigarh University)
**Tagline:** "One molecule. One workspace. One reproducible research loop."
**Version:** 1.0 (MVP-focused)

---

## 1. Problem Statement

Drug-discovery researchers, especially students and small labs, juggle disconnected tools: one app to draw molecules, another to check properties, another for similarity search, another for AI-assisted interpretation, and manual notes for tracking experiments. This fragmentation makes molecular research **slow, non-reproducible, and cloud-dependent** — a real problem for privacy-sensitive or resource-constrained research.

## 2. Vision

ROGVEDA is a **single, offline-first desktop/web workspace** that takes a researcher from "I have a molecule idea" to "I have a reproducible, explained, exportable experiment" — without needing the internet, a subscription API key, or five different tools open at once.

## 3. Target Users

- **Primary:** Chemistry/pharmacy students and early-stage academic researchers who need a free, private sandbox.
- **Secondary:** Small research labs wanting an offline-capable internal tool (data never leaves their machine).
- **Tertiary (future/business model):** Pharma teams wanting a custom-licensed, hardened version.

## 4. Core User Journey

```
Login → Home Hub → Create/Select Molecule (Draw / SMILES / Template / History)
     → Molecular Analysis (properties, AI insight, ML predictions)
     → Similarity Search (compare vs. curated compound DB)
     → Molecular Modification (edit, apply suggested changes, recalc)
     → Compare Molecules (side-by-side, before/after)
     → Save Experiment (versioned) → Generate Report (PDF/HTML)
```

This loop (Input → Analyze → Explore → Modify → Simulate → Compare → Understand → Save & Reproduce) is the product's spine — every screen should visibly belong to one step of this loop.

## 5. MVP Feature Set (must-have for demo/judging)

| # | Feature | Description | Priority |
|---|---|---|---|
| 1 | Auth / Login | Local account or single-user mode; animated login screen | P0 |
| 2 | Draw Molecule (2D) | Canvas editor: draw, templates, SMILES import/export | P0 |
| 3 | Molecular Analysis | RDKit-computed descriptors (MW, LogP, TPSA, HBD/HBA, rings, etc.) | P0 |
| 4 | 3D Viewer | Ball & stick / stick / spacefill / surface, generated from 2D structure | P0 |
| 5 | Similarity Search | Fingerprint + Tanimoto search against curated local DB | P0 |
| 6 | Molecular Modification | Suggested edits (add R-group, replace group, bioisostere) + recompute | P0 |
| 7 | Compare Molecules | Side-by-side property + similarity diff, matched-property table | P0 |
| 8 | ML Predictions | Bioactivity (anti-inflammatory, antioxidant, antimicrobial, anticancer) + Toxicity (hepatotox, cardiotox, mutagenicity, carcinogenicity, hERG) with confidence bars | P0 |
| 9 | AI Insight | Local tiny-LLM generated plain-English summary of the above, grounded in computed facts | P0 |
| 10 | Experiment History | Versioned save of every analysis/modification cycle | P1 |
| 11 | Saved Documents / Report Generation | Export a PDF/HTML report bundling structure, properties, predictions, insight | P1 |
| 12 | "Ask ROGVEDA" chat | Local LLM Q&A grounded in the current molecule's computed data + any imported PDFs | P1 |
| 13 | Document library / paper summarization | Import PDFs, local retrieval + summarization | P2 (stretch) |

## 6. Explicitly Out of Scope for MVP

- Molecular docking (AutoDock Vina) — advanced module, later phase.
- De novo / generative molecule design.
- Large general-purpose LLM or cloud inference of any kind.
- ADMET full-suite prediction.
- Multi-user / cloud sync / real-time collaboration.
- Claims of "safe" or "effective" — this is a computational research aid, not a clinical or regulatory tool.

## 7. Non-Functional Requirements

- **Offline-first:** app must be fully usable with network disabled, after one-time setup.
- **Hardware target:** 8–16 GB RAM, CPU-only or integrated GPU. No CUDA dependency in the MVP path.
- **Performance:** property calculation < 200ms; similarity search over reference DB < 1s; AI Insight generation < 5s on CPU.
- **Determinism:** same molecule + same DB version → same properties, same similarity ranking, every time (reproducibility is a headline feature).
- **Privacy:** no molecule, document, or experiment data ever leaves the user's machine by default.
- **Scientific honesty:** every prediction card must show a confidence score and a plain disclaimer that this is a computational estimate, not a clinical/safety determination.

## 8. Success Metrics (for demo/judging)

- Full loop (draw → analyze → similarity → modify → compare → save → report) completed with network adapter disabled.
- Time from "draw molecule" to "get all four panels populated" (properties, 3D, ML predictions, AI insight) under ~3 seconds on a mid-range laptop.
- Report generation produces a shareable, self-contained PDF/HTML with no missing data.

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| ≤8M param LLM constraint produces incoherent text | Relax constraint to ≤1B params, quantized GGUF via LM Studio/llama.cpp; keep prompts short & structured |
| Prediction models overfit / mislead due to small curated datasets | Scaffold-split evaluation, calibrated confidence, visible "Moderate/Low confidence" states, clear disclaimer |
| 3D rendering heavy on old laptops | Default to 2D; 3D is opt-in per molecule, uses lightweight WebGL libraries |
| Judges test without internet and something silently calls out | Explicit "airplane mode test" as a required QA step before submission |

## 10. Open Questions (to resolve as a team)

- Single-user local app vs. installable desktop app (Electron/Tauri) vs. pure local web app — see Tech Stack doc.
- Which exact endpoints (bioactivity/toxicity classes) ship in the MVP vs. "View More."
- Whether "Ask ROGVEDA" is chat-style or fixed Q&A buttons for the demo.
