# Web shell (vertical slice)

Dependency-free starting point for the browser side of a port. It is deliberately small: replace the demo square with your renderer, keep the shell contract.

## Run

```sh
python3 -m http.server 8080     # or: npx serve .
# open http://localhost:8080
```

## What is already wired

- `src/main.js` — fixed-timestep loop (70 Hz), accumulator with catch-up clamp, pause on hidden tab, integer scaling, debug overlay (`F3`), `window.app` debug handle.
- `src/input.js` — `event.code` bindings, `preventDefault` only for game keys, per-tick snapshot.
- `src/audio.js` — one `AudioContext`, unlocked on the first gesture, scheduled on the audio clock, failures logged and exposed.
- `src/save.js` — versioned save with validation; corrupt/old saves are reported, not ignored.
- `src/assets.js` — manifest/image/audio loading that throws on failure (no silent fallbacks).

## Replace next

1. `step()` with the real simulation (pure, seeded, integer where the original is).
2. `render()` with the real palette/renderer (low-res buffer → integer scale).
3. `src/assets.js` manifest with your generated assets (never original game files).
4. Add an e2e test: load → play N ticks → screenshot → save → reload → compare the state hash.
