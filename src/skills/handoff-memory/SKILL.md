---
name: handoff-memory
description: Keep durable project memory so work survives context resets and agent switches. Use at every gate, before long runs, and when finishing a session. Writes HANDOFF.md, state.json, ADRs and preference memory.
---
# Handoff and memory

Files (templates in `templates/project/`):
- `HANDOFF.md`: current state in <60 lines (what works, what is next, how to run/verify, gotchas).
- `state.json`: machine-readable stage, gate results, risks.
- `docs/DECISIONS.md`: ADRs (date, context, decision, consequences, who decided).
- `docs/EXPERIMENTS.md`: failed and successful experiments.
- Harness memory (if available): user preferences and constraints with *why* and *how to apply*.

Rules: facts only, verified against the repo today; commands copy-pasteable; never paste secrets; update before ending a long turn.
