---
name: retro-port-intake
description: Stage 0 of a retro-game port or clone. Use before any technical work, and whenever scope is unclear. Runs the intake questionnaire (legal scope, fidelity target, formats, platforms, languages, taste), writes PROJECT-POLICY.md and the decision matrix so later agents stop asking.
---
# Intake (stage 0)

Goal: capture, once, the decisions that were expensive to change late in past projects.

## Ask the user (batch all questions in ONE message, offer a recommended default for each)
1. **Legal/scope**: 1:1 clone using the user's own copy of the original data, OR a new game with the same mechanics and fully original assets? Will it be published? (If published: clean-room by default.)
2. **Fidelity level** (decides which stage gates are mandatory — matrix in `retro-port-orchestrate`):
   - **A (parecido)** — plays like it, looks similar; rendering may differ. Gates 3/4/5 optional.
   - **B (se juega igual)** — simulation must hold the original's rules; look verified by rubric. Gate 5 optional (rubric), rest mandatory.
   - **C (idéntico)** — bit-exact simulation and measured visual 1:1. Every gate mandatory.
   Record exceptions ("which parts may deviate") next to the level in `PROJECT-POLICY.md`.
3. **Runtime data policy**: no original binaries at runtime (recommended); originals only as inputs of offline tools and as a *temporary* oracle.
4. **Formats**: prefer modern, light, scalable formats (SVG for UI, WOFF2/TTF for text, OGG for audio, JSON for data, indexed PNG only for palette-recoloured pixel art).
5. **Platforms/harness**: target runtime (web/desktop), languages (code, UI text, docs), CI available?
6. **Taste & constraints**: visual references, things the user dislikes, machine constraints (e.g. emulator needs an idle desktop session, no credentials, folders that must never be modified).
7. **External research policy**: web sources allowed for *knowledge* (formats, behaviour); never copy third-party code; log provenance.
8. **Reference source code**: if a public reference implementation or released source already exists (a community reimplementation under a permissive licence, an author release…), record the choice in the policy: (a) none → standard clean-room recon; (b) read-as-spec → allowed, disassembly is skipped or reduced to the minimum; (c) direct reuse → only if the licence is compatible and the policy accepts its obligations (attribution, redistribution). (b) and (c) change stage 1: see `retro-port-orchestrate`.

## Produce
- `PROJECT-POLICY.md` from `templates/project/PROJECT-POLICY.md` (rules, not prose).
- `state.json` stage ledger (see `retro-port-orchestrate`).
- Save durable user preferences to the harness memory if it has one.

## Rules
- Do not start recon until the policy exists. Re-open the policy only when the user changes scope; record the change as a decision (ADR).
