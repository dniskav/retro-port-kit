---
name: cleanroom-gate
description: Prove that a repository contains and needs no files of the original game. Use before publishing or whenever the policy is clean-room. Runs a scripted checker and defines what to remove or rewrite.
---
# Clean-room gate

Run `node tools/cleanroom-check.mjs` (configure patterns in `cleanroom.config.json`). It verifies:
1. No tracked files with original names/types (data files, executables, extracted media) and no large binaries.
2. Generated assets are not versioned.
3. Binary-analysis output (`analysisDir`, default `analysis/`) is not tracked: keep it git-ignored like `reference/`.
4. No decompiler leftovers in tracked text files (fun labels such as `FUN_`/`DAT_`/`LAB_`, `undefined4`, `__int16`, `__fastcall`…); `decompilerTraces: false` or `traceAllowlist: [...]` configures it (allowlist is for provenance docs, not for reusing dump code).
5. A fresh copy WITHOUT the original data directory builds the assets and passes the tests.

Where binary-analysis output lives: decompilations, symbol notes, memory dumps and other recon work go to private, git-ignored folders — `analysis/` for disassembler/decompiler output, `reference/` for runtime captures. Nothing else should reference their content beyond provenance pointers.

Also review by hand: source comments that cite original addresses, provenance documents (allowed only if policy says so), test fixtures derived from originals, history (only if the policy requires rewriting; irreversible, ask).
