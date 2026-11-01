---
name: behavior-preserving-refactor
description: Refactor or reformat simulation code with proof that behaviour did not change. Use for module splits, formatter rollouts, API cleanups, data-format migrations.
---
# Refactor with proof

1. Record a baseline BEFORE touching code: state hashes per tick over a broad battery (all missions via the bot) + outcomes + golden traces.
2. Change one thing at a time (mechanical moves first, logic changes never mixed with moves).
3. After each step: typecheck, lint, unit tests, golden check, baseline comparison (hashes, ticks, outcome, kills). Ignore only timing fields.
4. If a diff appears: bisect by reverting halves of the change; the first differing tick/field tells you where.
5. Formatter rollouts and file splits go in their own commits, last.
6. Generate import-cycle and unused-export reports; remove dead code only when unreferenced.
