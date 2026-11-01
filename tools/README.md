# Reusable tools (no dependencies)

Node >= 18.17 for the plain `.mjs` tools; the CDP scripts need Node >= 22 (global `WebSocket`); the TypeScript tools need Node >= 22.6 (`--experimental-strip-types`).

| tool | purpose |
|---|---|
| `cdp-shot.mjs` | headless Chrome by CDP: screenshot, click, key, eval, wait (`CHROME`, `VIEW=WxH`, `DPR`) |
| `cdp-log.mjs` | console, page errors, failed requests and browser log entries (decoder/CORS/404) |
| `cleanroom-check.mjs` | clean-room gate (see skill `cleanroom-gate`) |
| `pixel-fonts/` | build TTF/WOFF/WOFF2 from a 5×7 bitmap design (own code, no deps) |
| `png-svg/` | minimal PNG encoder and SVG builder (raster → vector paths) |

## cleanroom-check config

`cleanroom.config.json` in the project root:

```json
{
  "originalNames": "regex for files that must not be tracked",
  "referenceDir": "reference/",
  "originalDataDir": "Original/",
  "generatedDirs": ["public/assets-free/"],
  "buildCommand": ["npm", "run", "assets:ci"],
  "testCommand": ["npx", "vitest", "run"],
  "workdir": "."
}
```

`--quick` runs only the tracked-file checks (fast, no build). The full run copies the repo **without** `Original/`, `reference/` and generated dirs, then builds and tests, proving the project does not need the originals.

## Pixel fonts

```sh
node --experimental-strip-types tools/pixel-fonts/fontbuild.ts assets/fonts
```

Writes `pixel.ttf`, `pixel.woff`, `pixel.woff2` (the WOFF2 is padded to a multiple of 4 bytes). Provenance and the glyph contract: `pixel-fonts/README.md`.

Copy what you need into the target project's `tools/` (or use `setup --scaffold`).
