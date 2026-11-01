# retro-port-kit

Agents and skills for porting or recreating retro games (method extracted from a real Syndicate port), with a DOS-first recon pack and a browser shell. **One neutral source, per-harness adapters.**

```
src/skills/<name>/SKILL.md      20 portable skills (Agent Skills format: only `name` + `description` in frontmatter)
src/agents/<name>.md            7 role definitions (neutral frontmatter: capabilities, skills)
tools/                          dependency-free tools: Chrome CDP shot/log, clean-room checker, pixel-font & PNG/SVG builders
templates/project/              PROJECT-POLICY, state.json, HANDOFF, docs/ (ADRs, experiments, sources, gaps), cleanroom config
templates/web/                  dependency-free browser shell: fixed tick, input, audio unlock, saves, debug handle
scripts/                        validate.mjs · build.mjs · engine.mjs · ui.mjs   (Node >= 18.17, no dependencies)
docs/INSTALLER.md               installer reference (wizard, flags, exit codes, JSON, guarantees)
dist/                           generated trees per harness (git-ignored)
```

## Quick start

```sh
node bin/retro-port-kit.mjs setup                    # wizard: pick clients, pick what to install, review, approve
node bin/retro-port-kit.mjs list                     # clients, ids, detection
node bin/retro-port-kit.mjs setup --all-detected --project /path/to/game   # scripted: plan + approval
node bin/retro-port-kit.mjs setup --client claude_code --client codex --project /path --yes
node bin/retro-port-kit.mjs setup --client claude_code --project /path --scaffold --yes  # + tools/, policy, docs, web shell
node bin/retro-port-kit.mjs setup --all-detected --scope user --link --yes   # global: skills + agents in each client's home
node bin/retro-port-kit.mjs setup ... --dry-run                    # plan only, exit 0
node bin/retro-port-kit.mjs setup ... --skills=false --context=false   # e.g. only agents
node bin/retro-port-kit.mjs setup ... --json                       # machine-readable plan (add --yes to apply)
node bin/retro-port-kit.mjs doctor --project /path                 # verify owned files (ok/modified/missing)
node bin/retro-port-kit.mjs update --project /path                 # re-apply exactly what the manifest recorded
node bin/retro-port-kit.mjs uninstall --project /path              # removes only what we own and that is unchanged
```

After publishing to npm: `npx retro-port-kit setup`. Start with the **port-orchestrator** agent (or the skill `retro-port-intake`). Full installer reference: [`docs/INSTALLER.md`](docs/INSTALLER.md).

### Installer (modelled on `rea setup`)
Running `setup` in a terminal starts a wizard:

1. **Clients to configure** — arrow keys + space; detected clients are pre-selected on a first run, and what is already installed stays selected. Explicit `--client` skips this step.
2. **What to install** — skills, agents, context files (`AGENTS.md` + harness imports) and the optional project scaffold.
3. **Plan review** — exact destinations, grouped per client, with what will be merged vs written and what is kept if present.
4. **Approval** — `Apply these changes? [y/N]`, default No.
5. **Completion** — files written/kept, backups, and the clients to restart.

`--accessible` replaces the arrow-key selector with sequential y/N prompts; `NO_COLOR=1` or `--no-color` disables color; `--verbose` lists every file; `--json` keeps stdout machine-readable and writes progress to stderr.

Exit codes: `0` applied / planned / cancelled, `1` needs confirmation (non-interactive without `--yes`) or unhealthy, `2` usage error.

### Scaffold (`--scaffold`, project scope only)
Copies, **without overwriting anything that already exists**:
- `tools/` (CDP scripts, clean-room checker, font/PNG/SVG builders),
- `PROJECT-POLICY.md`, `state.json`, `HANDOFF.md`, `cleanroom.config.json`, `docs/{DECISIONS,EXPERIMENTS,SOURCES,KNOWN-GAPS,REFERENCE}.md`,
- `templates/web/` → `index.html`, `src/{main,config,input,audio,save,assets}.js`, `src/style.css`, `docs/WEB-SHELL.md`.

Run it in an empty project, or let it fill the gaps in an existing one.

### Safety model (borrowed from REA's installer)
- The exact plan (paths and kind of change) is shown first; declining, Ctrl-C or a non-interactive run without `--yes` changes nothing (`needs_confirmation`, exit 1).
- Anything we replace is backed up first (`<file>.rpk.backup`, later versions as `.rpk.backup.<sha>.recovery`); writes are staged and read back to verify.
- We refuse to overwrite a file that changed while planning, or a symlink that is not ours.
- `AGENTS.md`/`CLAUDE.md`/`QWEN.md`/`GEMINI.md`: only our marked block is merged; your text is never touched.
- A manifest (`.retro-port-kit.json`, project root or `~`) lists owned files with SHA-256 **and the install recipe** (`clients`, `options`); `update` re-plans from it, and `uninstall` removes only files that are still unchanged and restores backups. Files you edited are kept. Empty skill folders are pruned, never the project root.
- Env overrides honoured for user scope: `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `QWEN_HOME`, `GEMINI_CLI_HOME`, `OPENCODE_CONFIG_DIR`, `XDG_CONFIG_HOME`.
- When several clients share a destination (`.agents/skills`), it is written once.

### Claude Code plugin route (no CLI)
`node bin/retro-port-kit.mjs build` generates `plugin/` and `.claude-plugin/marketplace.json` (both committed; `build --check` verifies they match `src/`). In Claude Code: `/plugin marketplace add <path-or-git-url-of-this-repo>` then `/plugin install retro-port-kit@retro-port-kit` (schema written from the plugin docs; verify with your version). Codex plugin manifest is not generated (format not verified).

## Where each harness reads things
| target | skills | agents | context file |
|---|---|---|---|
| claude_code | `.claude/skills/<n>/SKILL.md` | `.claude/agents/<n>.md` | `CLAUDE.md` (imports `@AGENTS.md`) |
| codex | `.agents/skills/<n>/` (shared) | — (roles live in `AGENTS.md`) | `AGENTS.md` |
| opencode | `.opencode/skills/<n>/` | `.opencode/agents/<n>.md` (`mode: subagent`) | `AGENTS.md` |
| vscode (Copilot) | `.github/skills/<n>/` | `.github/agents/<n>.agent.md` | `AGENTS.md` |
| qwen | `.agents/skills/<n>/` (shared) | `.qwen/agents/<n>.md` | `QWEN.md` (imports `@AGENTS.md`) |
| gemini | `.agents/skills/<n>/` (shared) | — | `GEMINI.md` |
| cursor | `.cursor/rules/<n>.mdc` | — | `AGENTS.md` |
| cline | `.clinerules/retro-port-<n>.md` | — | `AGENTS.md` |
| generic | `retro-port/PLAYBOOK.md` (all skills in one file) | — | `AGENTS.md` |

`AGENTS.md` is merged between `<!-- retro-port-kit:begin/end -->` markers; existing text is never clobbered, and `uninstall` removes only our block.

### Global install (available in every project)
`--scope user` writes to the client's personal directory instead of a project, so the skills and agents are always available:

| client | skills | agents |
|---|---|---|
| claude_code | `~/.claude/skills/<n>/` | `~/.claude/agents/<n>.md` |
| opencode | `~/.config/opencode/skills/<n>/` | `~/.config/opencode/agents/<n>.md` |
| codex | `~/.codex/skills/<n>/` | — |
| vscode | `~/.copilot/skills/<n>/` | — |
| qwen, gemini, agents | `~/.agents/skills/<n>/` (shared) | — |
| cursor, cline, generic | not supported — use project scope | — |

The manifest lives at `~/.retro-port-kit.json`; `update --scope user` re-applies it and `uninstall --scope user` removes it. Restart the clients afterwards. Context files and the scaffold are always project scope.
**DeepSeek / any other model**: they run inside a harness (OpenCode, Cline, Qwen Code, aider, a chat). Use `generic` (PLAYBOOK.md + AGENTS.md); skill bodies are plain Markdown and avoid harness-specific tool names.

### Notes on portability (checked against vendor docs, may change)
- Skill folders with `SKILL.md` are an open convention; paths vary and some sources conflict (Codex: `.agents/skills` vs `.codex/skills`; OpenCode: `.opencode/skills` vs `.opencode/skill`; Copilot: `.github/skills`). If a tool does not see the skills, copy/link to the other path or use the generic playbook.
- Agent tool names are best-effort mappings in `scripts/lib.mjs` (`TOOLS`); adjust there if your harness version uses other names. OpenCode agent permissions changed between versions (`tools` map vs `permissions`); the generator emits the older map.
- Only portable frontmatter keys (`name`, `description`) are used in skills; `scripts/validate.mjs` enforces it.
- `model_tier` in agent frontmatter is advisory (`strong`/`balanced`/`fast`); adapters do not force a model, so each harness keeps its own default.
- Verified: Claude Code lists the installed skills and agents at session start.
- Node: the installer and tests run on **Node >= 18.17**. The CDP tools (`tools/cdp-*.mjs`) use the global `WebSocket` and need **Node >= 22**; the TypeScript tools need Node >= 22.6 (`--experimental-strip-types`).

## Method
Nine numbered stages plus a vertical-slice gate; do not advance without the gate (full detail in `retro-port-orchestrate`):

| # | Stage | Gate |
|---|---|---|
| 0 | Intake | `PROJECT-POLICY.md` exists and the user confirmed it |
| 1 | Recon & research | inventory complete, every format has a status, unknowns ledger started |
| 2 | Spec from evidence | each rule has source + confidence, contradictions listed |
| 3 | Core engine | reference hashes match on the agreed sample, golden master recorded |
| **3.5** | **Vertical slice** | one screen end to end (input → sim → render → audio → save) in a real browser |
| 4 | Verification infra | golden + fuzz + bot + e2e in CI, mutation score measured |
| 5 | Render/UI | screenshot diff under threshold, or rubric signed by the user |
| 6 | Campaign/meta/audio | scripted playthrough completes, save/load stable |
| 7 | **Detach from originals** | clean-room check green, assets own/generated |
| 8 | Polish & docs | blind-rebuild test passes |

- **Ask vs decide**: decide and log (ADR) reversible technical choices; ask (batched, with a recommended default) for irreversible, legal, aesthetic or expensive ones.
- **Never grade your own work**: `qa-verifier` runs the gates and reports PASS/FAIL with evidence.
- **Record the oracle early**: as soon as stage 3 matches, snapshot behaviour while the original is still available.
- **Failure handling**: `silent-fallback-hunt` when "all green but looks wrong"; `fault-bisect` for opaque failures; two failed attempts of the same kind → change approach or ask.

## Skills
**Method**: `retro-port-intake` · `retro-port-orchestrate` · `handoff-memory` · `spec-from-evidence`
**DOS recon**: `dos-runtime-harness` · `dos-binary-analysis` · `dos-video-modes` · `dos-audio-opl` · `game-data-recon`
**Engineering**: `web-shell` · `oracle-golden-master` · `behavior-preserving-refactor` · `procedural-assets` · `ui-fidelity`
**Verification**: `browser-e2e-cdp` · `silent-fallback-hunt` · `fault-bisect` · `cleanroom-gate` · `blind-rebuild-test`
**Environment**: `env-recipes`

## Tools
| tool | purpose |
|---|---|
| `cdp-shot.mjs` | headless Chrome by CDP: screenshot, click, key, eval, wait (`CHROME`, `VIEW`, `DPR`) |
| `cdp-log.mjs` | console, page errors, failed requests and browser log entries (decoder/CORS/404) |
| `cleanroom-check.mjs` | clean-room gate: tracked originals, reference captures, generated assets, rebuild without originals |
| `pixel-fonts/` | build TTF/WOFF/WOFF2 from a 5×7 design (own code, no deps) |
| `png-svg/` | minimal PNG encoder and SVG builder (raster → vector paths) |

## Extending
Add `src/skills/<new-name>/SKILL.md` (+ scripts) or `src/agents/<name>.md`, run `validate`, then `build` (and commit `plugin/`). With `--link`, skills update live.

## Tests
```sh
npm test        # node --test tests/ (21 tests: wizard contract, JSON, update recipe, scaffold, blocks, uninstall, tools, clean-room, plugin drift)
npm run check   # validate + tests + build --check (CI runs this)
```
CI: `.github/workflows/ci.yml` on Node 22.

## Credits
Installer design inspired by the setup/uninstall flow of [morluto/rea](https://github.com/morluto/rea) (plan before write, backups, ownership manifest, env overrides). No code copied. Licensed MIT (see `LICENSE`).
