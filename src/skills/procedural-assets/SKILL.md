---
name: procedural-assets
description: Generate original game assets in code (tiles, sprites, UI, fonts, audio, maps, missions) so the project ships no third-party binaries. Use for clean-room rebuilds, asset replacement and format modernisation. Includes format policy and contracts with the engine.
---
# Procedural assets

## Principles
- **The engine defines the contract; assets satisfy it.** Derive ids and counts by running engine functions over their input space (e.g. enumerate animation ids), never by copying tables from the original. Detect id collisions and fail the build.
- Deterministic generators (seeded PRNG, bit-exact output). Re-running must give identical bytes; hash the output in CI.
- One orchestrating `build` script; flags for partial builds (`--no-audio`), output dir not versioned.
- Semantic colour roles (`UI.panelBg`, `UI.hostile`...) in engine code, never bare palette indices.

## Format policy (modern, light, scalable)
UI & backgrounds → SVG · text → TTF/WOFF2 (build pixel fonts from the same bitmap design; WOFF2 files must be a multiple of 4 bytes) · audio → OGG (synthesised in code; ffmpeg libvorbis or native vorbis -ac 2) · data → JSON · palette pixel art → indexed PNG only where recolouring needs it.

## Content generators
- Maps: validate connectivity (BFS) and object-pool limits at generation time; retry with another seed.
- Missions/campaign: templates by objective type + difficulty curve; check with the bot over ALL missions (0 invariant violations, deterministic).
- Pixel art: write a tiny rasteriser/z-buffer renderer for isometric solids instead of hand-drawing sprites.

## Verify visually
Screenshot each new screen/asset family and review it; keep a contact sheet.
