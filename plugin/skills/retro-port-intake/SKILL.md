---
name: retro-port-intake
description: Stage 0 of a retro-game port or clone. Use before any technical work, and whenever scope is unclear. Runs the intake questionnaire (legal scope, fidelity target, formats, platforms, languages, taste), writes PROJECT-POLICY.md and the decision matrix so later agents stop asking.
---
# Intake (stage 0)

Goal: capture, once, the decisions that were expensive to change late in past projects.

## Ask the user (batch all questions in ONE message, offer a recommended default for each)
1. **Legal/scope**: 1:1 clone using the user's own copy of the original data, OR a new game with the same mechanics and fully original assets? Will it be published? (If published: clean-room by default.)
2. **Fidelity target**: bit-exact simulation? visual 1:1? "feels the same"? Which parts may deviate?
3. **Runtime data policy**: no original binaries at runtime (recommended); originals only as inputs of offline tools and as a *temporary* oracle.
4. **Formats**: prefer modern, light, scalable formats (SVG for UI, WOFF2/TTF for text, OGG for audio, JSON for data, indexed PNG only for palette-recoloured pixel art).
5. **Platforms/harness**: target runtime (web/desktop), languages (code, UI text, docs), CI available?
6. **Taste & constraints**: visual references, things the user dislikes, machine constraints (e.g. emulator needs an idle desktop session, no credentials, folders that must never be modified).
7. **External research policy**: web sources allowed for *knowledge* (formats, behaviour); never copy third-party code; log provenance.

## Produce
- `PROJECT-POLICY.md` from `templates/project/PROJECT-POLICY.md` (rules, not prose).
- `state.json` stage ledger (see `retro-port-orchestrate`).
- Save durable user preferences to the harness memory if it has one.

## Rules
- Do not start recon until the policy exists. Re-open the policy only when the user changes scope; record the change as a decision (ADR).
