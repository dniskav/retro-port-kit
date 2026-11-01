---
name: web-shell
description: Build the browser shell for a port: fixed-timestep loop, deterministic simulation boundary, input mapping, pixel-perfect canvas scaling, asset loading, audio unlock, saves and a performance budget. Use before the first playable screen and for any web-platform bug.
---
# Web shell

The shell is the contract between the browser and the deterministic simulation. Keep it small, boring and observable.

## Loop
- One `requestAnimationFrame` loop with an accumulator; the simulation advances in **fixed ticks** (e.g. 70 Hz or the original's rate), rendering is decoupled.
- Clamp `dt` (tab switch, breakpoint), cap catch-up steps, and pause on `blur`/`visibilitychange` with an explicit resume.
- No `Date.now()`/`Math.random()`/`performance.now()` inside the simulation. Time and RNG are inputs; seed and tick are state.

## Simulation boundary
```
input snapshot → step(state, input) → state → render(state)
```
- `step` is pure-ish and integer-based where the original is; `render` never mutates state.
- Expose `window.app = { state, step, render, config }` in debug builds so tests read state instead of pixels.
- Keep an input log + seed for deterministic replay (`?replay=...`).

## Input
- Bind on `event.code` (physical key), not `event.key` (layout). Map browser keys to the original's scancodes once, in data.
- `preventDefault` for arrows/space/tab only while the game has focus; never trap the user.
- Support gamepad and pointer as adapters over the same input snapshot; keep bindings in JSON so they can be remapped.

## Rendering
- Draw into a low-resolution offscreen canvas at the original resolution; scale by an **integer** factor to the display canvas.
- `imageSmoothingEnabled = false`, CSS `image-rendering: pixelated`, letterbox; handle `devicePixelRatio` once.
- Palette-indexed art: keep indices + palette as data (recolour is free); use indexed PNG only where recolouring needs it.
- Respect the pixel aspect decided in the policy (320×200 is not square); never "fix" it per screen.

## Assets and audio
- Manifest JSON + `fetch`, explicit progress, and **fail loudly**: a missing asset is an error, not a silent fallback (see `silent-fallback-hunt`).
- One `AudioContext`, resumed on the first user gesture; master gain and mute; schedule with `currentTime`.
- Preload before the first tick; show a real loading state, not a frozen screen.

## Saves
- Versioned JSON (`version`, `seed`, `tick`, game state, checksum) in `localStorage` or IndexedDB.
- Migrate on load; never crash on an old/corrupt save — report it and start clean, visibly.
- Export/import as a file so saves survive browser storage eviction.

## Budget and verification
- Frame budget: 16.6 ms at 60 Hz; measure sim and render separately; log p95, not just average.
- Set a memory/asset ceiling in the policy and assert it in CI.
- E2E: load, start, play N ticks, screenshot, save, reload, compare state hash. Read the browser log (`cdp-log.mjs`), not only the screenshot.
- Static hosting: relative paths, content-hashed asset names, no absolute `/` roots.

## Vertical slice first
Before content: one screen that goes input → sim → render → audio → save, from a clean checkout, with an e2e test. That is the gate; everything else is content.
