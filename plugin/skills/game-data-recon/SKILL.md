---
name: game-data-recon
description: Reverse-engineer the data and logic of a retro game for a port. Use for file inventory, compression/format decoding, table extraction, routine analysis and external research. Produces an evidence-backed inventory with provenance and an unknowns ledger.
---
# Recon

## Inventory first
- List every shipped file with size, hash, and a status: `unknown | identified | decoded | verified-lossless`.
- Identify containers/compression by magic bytes. Write the decoder as a small standalone tool with CRC/size self-checks and tests against known vectors.

## Evidence discipline
- Every fact gets: source (offset/routine/URL), method (static, dynamic, community doc), confidence (high/med/low).
- Keep an **unknowns ledger** (`docs/KNOWN-GAPS.md`): what is not understood, where it was observed, how it would be resolved.
- Contradictions between sources are recorded, not silently resolved.

## Triage contract (stage-1 mechanical pass)
A cheap-model pass may label artefacts, but follows this contract — enforce it before advancing past the gate:
- The triage pass **labels, never removes or edits**: original game media and analysis output stay untouched; all it produces is a manifest.
- Manifest row per item: `id` (file/routine/table), `what` (inferred role), `category` (code | data | tables | strings | media | container | unknown), `confidence` (high/med/low), `evidence` (offset/routine/tool that motivated the label).
- Items it would mark as `irrelevant` are only marked, not discarded; the sampling review of the gate must check them against a disassembly/reference run before anything is excluded from further stages.
- The manifest is data (JSON/CSV), reviewed by the analyst agent (`recon-spec`) before any spec fact depends on it.

## External research (allowed by policy)
- Search community documentation, wikis, format notes and videos for *knowledge*: names, tables, behaviours, quirks. Treat as hypotheses and verify against the binary or reference runs.
- Never copy third-party code. Record URL, date and licence of each source in `docs/SOURCES.md`.
- Prefer sources that agree with the binary; note disagreements.

## Binary analysis
- Use the harness' reverse-engineering tools (decompiler/disassembler MCP, objdump, scripts). Name routines by behaviour, not by address, in anything that lands in source code; keep addresses only in provenance docs.
- Extract constant tables mechanically (script), never by retyping; verify with checksums.

## Output
Inventory, decoders + tests, extracted tables (machine-readable), unknowns ledger, sources list.
