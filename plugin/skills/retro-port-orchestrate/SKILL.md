---
name: retro-port-orchestrate
description: Run a retro-game port as a staged pipeline with automatic gates. Use when planning, resuming after a context reset, delegating to specialist agents, or deciding whether to ask the user. Defines stages, gates, delegation, the ask-vs-decide matrix and the handoff discipline.
---
# Orchestrating a port

## Stages and gates (do not advance without the gate)
| # | Stage | Gate (objective, scripted) |
|---|---|---|
| 0 | Intake | `PROJECT-POLICY.md` exists and the user confirmed it |
| 1 | Recon & research | inventory complete; every file/format has a status; unknowns ledger started |
| 2 | Spec from evidence | each rule has source + confidence; contradictions listed |
| 3 | Core engine (deterministic) | reference hashes match on the agreed sample; golden master recorded |
| 3.5 | **Vertical slice** | one screen works end to end (input → sim → render → audio → save) in a real browser from a clean checkout |
| 4 | Verification infra | golden + fuzz + bot + e2e run in CI; mutation score measured |
| 5 | Render/UI | screenshot diff vs reference under threshold, or rubric signed by user |
| 6 | Campaign/meta/audio | scripted playthrough completes; save/load stable |
| 7 | **Detach from originals** | clean-room check green; golden recorded; assets own/generated |
| 8 | Polish & docs | blind-rebuild test passes |

Run stage 7 earlier than feels natural: as soon as stage 3 matches the reference, snapshot behaviour (golden master) while the original is still available.

For DOS sources, stage 1 starts with `dos-runtime-harness` (reproducible oracle) and `dos-binary-analysis`; stage 3.5 uses `web-shell`. Do not advance past 3.5 on screenshots alone: the slice must pass e2e with the browser log clean.

## Delegation
- One owner per stage. Use specialist agents when context isolation or parallelism pays (recon, QA, assets); otherwise load the skill and do it yourself.
- Parallel fan-out only for independent work (assets vs engine vs docs). Shared resources (browser, emulator, ports) need a lock: one user at a time.
- The agent that implements never grades itself: QA agent/scripts run the gates.

## Ask or decide?
- **Decide and log (ADR)**: reversible, cheap, technical (naming, module layout, tool choice, refactors proven by hashes).
- **Ask (batched, with options + recommended default)**: irreversible or outward-facing (history rewrite, publishing, deleting data), legal scope, aesthetic taste, large cost/time trade-offs, anything the policy does not cover.
- Never ask what the repo, policy or memory already answers.

## State and handoff
- Keep `state.json` (stage, gate results, open risks, decisions) and `HANDOFF.md` (human summary). Update both at every gate and before long runs.
- After a context reset: read policy → state → handoff → `git log -5` → run the last gate. Do not trust memory over files.
- Log experiments (what, result, conclusion) in `docs/EXPERIMENTS.md`; failed paths are valuable.

## Failure handling
Use `silent-fallback-hunt` after any "everything passes but it looks wrong" moment and `fault-bisect` for opaque failures. Two failed attempts of the same kind → change approach or ask.
