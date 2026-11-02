---
name: spec-from-evidence
description: Write the behaviour specification of a game system from recon evidence so that another engineer or LLM can reimplement it. Use after recon and before or while implementing a subsystem.
---
# Specification

For each subsystem (movement, combat, AI, vehicles, campaign, UI layout, audio...):
1. **Inputs/outputs and state** (field names, ranges, integer widths and wrap behaviour).
2. **Rules** as numbered statements; each with `[source, confidence]`.
3. **Edge cases and original quirks** (unchecked reads, overflow). Keep them behind a flag when they are bugs, default = original behaviour.
4. **Test vectors**: per-function vectors captured from the reference (`function-vectors`); each rule cites the vectors backing it.
5. **Open questions** linked to the unknowns ledger.

Rules of thumb
- Specs describe behaviour in prose, tables and your OWN pseudocode. Never paste disassembler or decompiler output (`FUN_…`/`DAT_…` labels, `__intN`, `__fastcall` and the like) into specs or product code; keep raw dumps in the private `analysis/` folder and cite them as provenance only.
- Own numbers are fine when the project is clean-room: mark them as *design values*.
- A spec is done when a different agent can implement it and pass the vectors without reading the original.
