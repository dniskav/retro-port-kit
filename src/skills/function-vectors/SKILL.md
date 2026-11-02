---
name: function-vectors
description: Record and store per-function test vectors from the original (real inputs and outputs of concrete game functions) beside the spec rule they support. Use during recon with the runtime harness, and to seed golden-master scenarios before the clean-room replica exists.
---
# Function vectors

Per-function test vectors captured from the original, stored next to the spec rule they support. They are the smallest verifiable unit between recon (stage 1-2) and the golden master (stage 3): a spec claim without a vector stays a hypothesis.

## Per vector
- `id`: behavioural name of the function; original addresses/offsets live only in provenance docs.
- `rules`: spec rule ids this vector backs (cross-link both ways).
- `inputs`: the exact input state (arguments, registers, file/image section). Binary inputs are stored as files with hash, produced by a script.
- `output`: the exact observed output (result registers, memory section, constants, flags), recorded as literals — never reformatted by hand.
- `run`: command + emulator/config hash + seed that reproduces the capture (see `dos-runtime-harness`).

## Where they live
Vectors live in the spec folder of their system (or the project's `FUNCTION-VECTORS.md`), in plain data format (YAML/JSON). They are produced and replayed by scripts against the harness; nothing is retyped and no original binary is committed.

## How they are used
- `spec-from-evidence` cites the vectors backing each rule.
- `oracle-golden-master`: vectors seed synthetic scenarios, fuzz boundaries and mutation checks; the clean-room replica must reproduce every vector before gate 3 advances.
- `qa-verifier` re-runs them at every gate when the underlying system changes.

## Rules
- Vectors record behaviour (input → output), never disassembly listings or guess names from dumps (`FUN_…` stays out; see `cleanroom-gate`).
- Knowledge reused from community sources is a vector only after a reference run confirms it; mark `[source, confidence]`.
