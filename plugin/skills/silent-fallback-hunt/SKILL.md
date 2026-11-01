---
name: silent-fallback-hunt
description: Find failures hidden by graceful fallbacks (fonts, assets, codecs, optional features) when tests pass but the result looks wrong. Use after any visual surprise, and as a design rule when writing fallback code.
---
# Silent fallbacks

Symptom: all checks green, output degraded (missing text, wrong font, silence, low-res art).

1. List every `try/catch`, `?? default`, `if (feature)` and "fallback to X" path in the area.
2. Make each fallback observable: increment a counter and `console.warn` once with the reason; expose counters on the debug handle.
3. Add an e2e assertion `fallbackCount === 0` for the default configuration.
4. Check browser-only diagnostics (`cdp-log.mjs`): many decoders report only in the log.
5. Reproduce the failure in isolation with the smallest input, then apply `fault-bisect`.
