# Reusable tools (no dependencies, Node >= 22)

| tool | purpose |
|---|---|
| `cdp-shot.mjs` | headless Chrome by CDP: screenshot, click, key, eval, wait (`CHROME` env for the binary) |
| `cdp-log.mjs` | print console + browser log entries of a page (decoder/CORS/404 errors) |
| `cleanroom-check.mjs` | clean-room gate (see skill `cleanroom-gate`) |
| `pixel-fonts/` | build TTF/WOFF/WOFF2 from a 5x7 bitmap design (own code, no deps) |
| `png-svg/` | minimal PNG encoder and SVG builder (raster -> vector paths) |

Copy what you need into the target project's `tools/`.
