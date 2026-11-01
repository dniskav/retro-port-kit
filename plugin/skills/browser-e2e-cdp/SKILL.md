---
name: browser-e2e-cdp
description: Drive a real Chrome by the DevTools protocol without dependencies to take screenshots, click, read console/log errors and evaluate JS. Use for end-to-end smoke tests, visual checks and diagnosing resource/font/decoding errors that only the browser reports.
---
# Browser checks (no extension needed)

Scripts live in `tools/` of the kit (copy into the project): `cdp-shot.mjs` (screenshot + steps) and `cdp-log.mjs` (print console + log entries of a page).

- Start the dev server first; use a random port per run.
- `node tools/cdp-shot.mjs "<url>" wait:3000 click:X,Y eval:JS shot:/tmp/a.png`
- `node tools/cdp-log.mjs "<url>"` prints warnings that never reach the page (e.g. font sanitiser errors, CORS, 404). **Always read these when something loads silently wrong.**
- Expose a debug handle (`window.app = { scene, state }`) so tests can read state instead of guessing from pixels.
- Look at the screenshot yourself (image read) before declaring a visual task done; automated passes can hide visual bugs.
- Headless Chrome path differs per OS; allow a `CHROME` env var.
