# ROGVEDA — Security Document

## 1. Threat model summary
ROGVEDA is a **local, single-user (initially), offline-first** application. The primary asset to protect is the **user's research data** (molecules, experiments, imported documents) staying private and intact — not a multi-tenant cloud security problem. Threats are mostly local: malware on the same machine, a corrupted/malicious import file, or an unintended network call leaking data.

## 2. Data-at-rest
- All data (SQLite DB, saved documents, experiment history) lives in a user-owned local directory (e.g., `~/.rogveda/` or OS app-data equivalent), never in a shared/world-readable location.
- If/when the app supports login with a password, store only a salted hash (`bcrypt`/`argon2`), never plaintext — even though this is local-only, it protects against another local user/process reading the DB file directly.
- Consider optional at-rest encryption of the SQLite file (e.g., SQLCipher) for the "Pharma/Enterprise" tier described in the business model — not required for MVP/academic tier.

## 3. Data-in-transit (localhost only)
- All frontend↔backend↔LLM-server traffic stays on `127.0.0.1`. Bind all local servers to `127.0.0.1`, **not** `0.0.0.0`, so nothing on the local network can reach them.
- If a future version adds real networked sync, that is a distinct, explicitly-opt-in feature with its own TLS/auth review — never silently enabled.

## 4. Input validation / untrusted content
- **SMILES/molfile input:** always parse through RDKit's sanitizer; reject malformed input with a clear error, never `eval`/exec anything derived from user input.
- **Imported PDFs (document library):** treat as untrusted files. Use a hardened PDF text-extraction library (`pypdf`/`pdfplumber`), run extraction in a way that can't execute embedded scripts, and cap file size to avoid resource-exhaustion (zip-bomb-style PDFs).
- **File uploads generally:** validate file type by content sniffing, not just extension.

## 5. Local LLM sandboxing
- The local LLM must only ever be given: (a) computed chemistry/ML facts, and (b) retrieved passages from the user's own imported documents. It must never be given filesystem access, shell access, or the ability to trigger backend actions (no tool-use/agentic loop for the in-app LLM — keep it a pure text-in/text-out summarizer).
- Sanitize LLM output before rendering as HTML in the frontend (escape, don't `dangerouslySetInnerHTML` raw model output) to avoid any injected-markup issue if the model ever echoes something odd.

## 6. Dependency and supply-chain hygiene
- Pin dependency versions (`requirements.txt` with hashes, `package-lock.json`).
- Only download models/datasets from their official sources (EBI FTP for ChEMBL, official HuggingFace repos for GGUF weights, DeepChem's official loaders) — verify checksums where provided.
- Audit any new npm/pip package for telemetry/network calls before adding it, per the Rules doc.

## 7. Antigravity-agent-specific security notes
Since agents in Antigravity have terminal + file + (optionally) browser access, apply Antigravity's own gating features deliberately for this project:
- Disable/limit the agent's browser sub-agent for anything except UI verification of your own local app — it should never be used to browse to arbitrary external sites as part of a ROGVEDA feature.
- Gate destructive or network-touching shell commands (installing new packages, `curl`, writing outside the project directory) behind explicit human approval in every agent task.
- Review the "artifact" (implementation plan) before execution specifically for: any proposed outbound network call, any proposed telemetry/analytics library, any proposed change to `models/` or the reference-compound DB.
- Keep secrets (none should exist for a purely local app, but if any local API key/config is ever added) out of version control via `.gitignore` + `.env`, and never let an agent print `.env` contents into a shared artifact/log.

## 8. Scientific/ethical safety notes (not a technical vulnerability, but a real risk)
- The app must never present ML predictions as clinical or regulatory determinations. Every prediction UI element carries a "computational estimate, not a safety/efficacy determination" framing (per the PRD's non-functional requirements).
- Do not include real, unredacted patient or proprietary compound data in any bundled/demo dataset — use public curated datasets (ChEMBL, Tox21, ClinTox, PubChem) only.

## 9. Backup / integrity
- Since this is offline-first with no cloud backup by default, provide an explicit "Export my data" (DB + documents) function so users aren't locked into one machine with no recovery path.
- Consider a simple checksum/manifest for the bundled reference-compound DB and model files so corruption (disk issue, bad update) can be detected on startup rather than silently producing wrong predictions.
