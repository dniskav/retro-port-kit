---
name: blind-rebuild-test
description: Final acceptance test that another LLM or engineer can rebuild the project from the repository alone. Use at the end of stage 8 or before publishing.
---
# Blind rebuild

1. Copy the repo to an empty directory (no original data, no caches, no memory).
2. Give a fresh agent only the repo and this prompt: "Build, run and verify the project. Report every point where the docs were insufficient."
3. Success = build + tests + e2e pass using only documented commands.
4. Every stumble becomes a docs fix or a script. Repeat until clean.
5. Record the result (date, agent, time, issues) in `docs/EXPERIMENTS.md`.
