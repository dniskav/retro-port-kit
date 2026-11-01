# retro-port-kit

Agentes y skills para portar/recrear juegos retro (método extraído del proyecto Syndicate). **Una sola fuente neutral, adaptadores por arnés.**
Single neutral source of truth + per-harness adapters (Claude Code, Codex CLI, OpenCode, VS Code/Copilot, Qwen Code, Gemini CLI, Cursor, Cline; DeepSeek and any other model via a generic playbook).

```
src/skills/<name>/SKILL.md      15 portable skills (Agent Skills format: only `name` + `description` in frontmatter)
src/agents/<name>.md            7 role definitions (neutral frontmatter: capabilities, skills)
tools/                          dependency-free tools: Chrome CDP shot/log, clean-room checker, pixel-font & PNG/SVG builders
templates/project/              PROJECT-POLICY, state.json, HANDOFF, DECISIONS, cleanroom.config.json
scripts/                        validate.mjs · build.mjs · install.mjs   (Node >= 18, no dependencies)
dist/                           generated trees per harness (git-ignored)
```

## Quick start (setup wizard style, inspired by REA's `rea-agents setup`)
```
node bin/retro-port-kit.mjs list                                   # clients, ids, detection
node bin/retro-port-kit.mjs setup --all-detected --project /path/to/game   # shows the plan, asks for approval
node bin/retro-port-kit.mjs setup --client claude_code --client codex --project /path --yes
node bin/retro-port-kit.mjs setup --client claude_code --scope user --link --yes   # ~/.claude/skills, symlinked to this kit
node bin/retro-port-kit.mjs setup ... --dry-run                    # plan only
node bin/retro-port-kit.mjs setup ... --skills=false --context=false   # e.g. only agents
node bin/retro-port-kit.mjs doctor --project /path                 # verify owned files (ok/modified/missing)
node bin/retro-port-kit.mjs update --client ... --project /path    # re-apply after pulling a new kit version
node bin/retro-port-kit.mjs uninstall --project /path              # removes only what we own and that is unchanged
```
After publishing to npm: `npx retro-port-kit setup`. Then copy `templates/project/*` and the needed `tools/*` into the project and start with the **port-orchestrator** agent (or the skill `retro-port-intake`).

### Safety model (borrowed from REA's installer)
- The exact plan (paths and kind of change) is shown first; declining, Ctrl-C or a non-interactive run without `--yes` changes nothing (exit 3).
- Anything we replace is backed up first (`<file>.rpk.backup`, later versions as `.rpk.backup.<sha>.recovery`); writes are staged and read back to verify.
- We refuse to overwrite a file that changed while planning, or a symlink that is not ours.
- `AGENTS.md`/`CLAUDE.md`/`QWEN.md`/`GEMINI.md`: only our marked block is merged; your text is never touched.
- A manifest (`.retro-port-kit.json`, project root or `~`) lists owned files with SHA-256; `uninstall` removes only those that are still unchanged and restores backups; files you edited are kept.
- Env overrides honoured for user scope: `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `QWEN_HOME`, `GEMINI_CLI_HOME`, `OPENCODE_CONFIG_DIR`, `XDG_CONFIG_HOME`.
- When several clients share a destination (`.agents/skills`), it is written once.

### Claude Code plugin route (no CLI)
`node bin/retro-port-kit.mjs build` generates `plugin/` and `.claude-plugin/marketplace.json`. In Claude Code: `/plugin marketplace add <path-or-git-url-of-this-repo>` then `/plugin install retro-port-kit@retro-port-kit` (schema written from memory of the plugin docs; verify with your version). Codex plugin manifest is not generated (format not verified).

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

`AGENTS.md` is merged between `<!-- retro-port-kit:begin/end -->` markers; existing text is never clobbered, and `--uninstall` removes only our block.
**DeepSeek / any other model**: they run inside a harness (OpenCode, Cline, Qwen Code, aider, a chat). Use `generic` (PLAYBOOK.md + AGENTS.md); skill bodies are plain Markdown and avoid harness-specific tool names.

### Notes on portability (checked against vendor docs, may change)
- Skill folders with `SKILL.md` are an open convention; paths vary and some sources conflict (Codex: `.agents/skills` vs `.codex/skills`; OpenCode: `.opencode/skills` vs `.opencode/skill`; Copilot: `.github/skills`). If a tool does not see the skills, copy/link to the other path or use the generic playbook.
- Agent tool names are best-effort mappings in `scripts/lib.mjs` (`TOOLS`); adjust there if your harness version uses other names. OpenCode agent permissions changed between versions (`tools` map vs `permissions`); the generator emits the older map.
- Only portable frontmatter keys (`name`, `description`) are used in skills; `scripts/validate.mjs` enforces it.
- Verified: Claude Code lists the installed skills and agents at session start.

## Design
- Stage 0 intake and the ask-vs-decide matrix reduce questions to the user (see `retro-port-orchestrate`).
- Verification is scripted and independent (`qa-verifier`, `oracle-golden-master`, `cleanroom-gate`, `blind-rebuild-test`).
- Lessons encoded: silent fallbacks, opaque-failure bisection, environment pitfalls, detach from originals early.

## Extending
Add `src/skills/<new-name>/SKILL.md` (+ scripts) or `src/agents/<name>.md`, run `validate`, then re-run `install` (with `--link` skills update live).

## Tests
`node --test tests/` (7 tests: approval gate, dry run, idempotency, user text preserved, backups, shared destinations, symlinks).

## Credits
Installer design inspired by the setup/uninstall flow of [morluto/rea](https://github.com/morluto/rea) (plan before write, backups, ownership manifest, env overrides). No code copied.
