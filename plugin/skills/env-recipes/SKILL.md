---
name: env-recipes
description: Known environment pitfalls and fixes (macOS BSD tools, zsh globbing, Node TypeScript stripping, ffmpeg encoders, headless Chrome, emulators needing a user session). Use when a command behaves unexpectedly.
---
# Environment recipes

- macOS `sed -i` needs `''` (`sed -i '' 's/a/b/' file`); zsh errors on unmatched globs (`--include=*.ts` → quote it or use `--include='*.ts'`).
- Node native TypeScript stripping rejects constructor parameter properties and enums; write explicit fields. Use a loader (`register-ts`) for extensionless imports.
- `timeout` may not exist on macOS; use the harness timeout parameter.
- Heredocs with unquoted `cat > file` can hang without input: use the file-writing tool.
- ffmpeg may lack `libvorbis`; the native `vorbis` encoder needs `-strict -2 -ac 2`.
- WOFF2 must be a multiple of 4 bytes; check with the browser log.
- Emulators/automation that move the mouse need an idle, unlocked desktop session: ask before running; never while the user works.
- Browser extension may be unavailable: fall back to CDP scripts.
- Regex literal on a line after `)` without semicolon is parsed as division (no-semicolon style): wrap in `if` or add `;`.
