---
name: cleanroom-gate
description: Prove that a repository contains and needs no files of the original game. Use before publishing or whenever the policy is clean-room. Runs a scripted checker and defines what to remove or rewrite.
---
# Clean-room gate

Run `node tools/cleanroom-check.mjs` (configure patterns in `cleanroom.config.json`). It verifies:
1. No tracked files with original names/types (data files, executables, extracted media) and no large binaries.
2. Generated assets are not versioned.
3. A fresh copy WITHOUT the original data directory builds the assets and passes the tests.

Also review by hand: source comments that cite original addresses, provenance documents (allowed only if policy says so), test fixtures derived from originals, history (only if the policy requires rewriting; irreversible, ask).
