# PROJECT-POLICY (rules, not prose; agents consult this instead of asking)

- Scope: <1:1 clone with user-owned data | new game with same mechanics (clean-room)>
- Publish: <yes/no>
- Fidelity: <A parecido | B se juega igual | C identico>  (gate matrix: retro-port-orchestrate; A omits 3/4/5, B verifies renders by rubric, C requires all)
- Fidelity exceptions: <parts allowed to deviate, if any>
- Runtime data: no original binaries at runtime. Originals only as offline inputs / temporary oracle.
- Reference runs: emulator + exact config pinned in `docs/REFERENCE.md`; captures in `reference/` (git-ignored), never tracked.
- Pixel aspect: <square | 320×200 stretched to 4:3 | other>; decided once, applied globally.
- Formats: SVG (UI), WOFF2/TTF (text), OGG (audio), JSON (data), indexed PNG only for recoloured pixel art.
- Audio: <OPL re-synthesis | original compositions | both>; no original music/SFX files shipped.
- External research: knowledge only; never third-party code; log in docs/SOURCES.md.
- Reference source code: <none (clean-room) | read-as-spec (repo/link) | direct reuse (licence + obligations)>; 8.b/8.c change stage 1 (orchestrate).
- Languages: code=<>, UI=<>, docs=<>
- Targets: browsers=<>, min viewport=<>, performance budget=<ms/frame, MB assets>
- Never: <folders not to modify, credentials, actions needing the user's session>
- Ask the user for: irreversible actions, legal scope, aesthetic taste, large trade-offs. Decide and log everything else.
- Taste notes: <likes / dislikes / references>
