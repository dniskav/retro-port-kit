---
name: oracle-golden-master
description: Build a verification oracle that does not depend on the original game. Use when the simulation first matches the reference, when tests depend on original assets, or when you need regression safety for refactors. Covers synthetic scenarios, recorded traces, fuzz scenarios, invariants, mutation checks.
---
# Golden-master oracle

1. **Capture while the reference is available.** As soon as the engine matches the original on the agreed sample, record behaviour traces; they inherit that validation.
2. **Scenarios** are built in code (maps and entities synthesised, no assets): one hand-written scenario per rule + seeded random "fuzz" scenarios + end-to-end synthetic missions through the real loader. Seed the per-rule scenarios from the captured `function-vectors` when they exist — they are the smallest observed input→output facts.
3. **Trace** = full-state digest (every field of every object, RNG, stats, sounds) every N ticks + a human-readable summary (alive/dead/kills). Store as JSON in the repo.
4. **Invariants** checked every few ticks (ranges, links, bounds, no NaN).
5. **Determinism test**: run twice, same trace. Also lock-step/replay equality if networked.
6. **Update flow**: `golden` (check) and `golden:update` (accept) scripts; an unintended diff is a regression, an intended one is committed with the code and explained.
7. **Quality of the oracle**: measure coverage using only scenarios; run mutation checks with *large* constant changes (tiny changes are often equivalent mutants). Add scenarios until important mutants die.
8. Keep content-dependent numbers out of tests; tests must pass with generated assets.
