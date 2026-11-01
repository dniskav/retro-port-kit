# Installer

`retro-port-kit setup` installs skills, agents and project scaffolding into a game project, or skills and global agents into the client's personal directory with `--scope user`. The flow follows [`rea setup`](https://github.com/morluto/rea): choose what to configure, review the exact plan, approve, then restart the clients that were touched.

```sh
npx retro-port-kit setup            # published package
node bin/retro-port-kit.mjs setup   # from this checkout
```

## What the wizard asks

| Step | What you see | Notes |
|---|---|---|
| Clients | Arrow-key multi-select with detection hints | Already-installed clients stay selected; on a first run, detected clients are pre-selected |
| Components | Skills / Agents / Context files / Project scaffold | Only the ones that apply to the scope |
| Plan | Exact destinations grouped per client | `write`, `merge` (marked block) and `link`, plus "keep if present" |
| Approval | `Apply these changes? [y/N]` | Default No; Ctrl-C cancels (exit 0) |
| Completion | Written / unchanged / kept / backups | Names the clients to restart and how to verify |

`--client <id>` skips the client question. `--scaffold`, `--skills=false`, `--agents=false` and `--context=false` skip the component question for the values they set.

## Flags

| Flag | Effect |
|---|---|
| `--client <id>` | Repeatable. `--client all` selects every client. Skips the selector |
| `--all-detected` | Every client detected on this machine. Combines with `--client` |
| `--all` | Every supported client |
| `--scope project\|user` | `project` (default) writes inside `--project`; `user` writes skills to the client's personal directory, plus agents for clients that support global agents (Claude Code, OpenCode) |
| `--project <dir>` | Project root (default: cwd) |
| `--scaffold` | Also copy `tools/`, project docs and the web shell (never overwrites) |
| `--skills=false` / `--skill=false` | Omit skills |
| `--agents=false` | Omit agent files |
| `--context=false` | Omit the `AGENTS.md`/`CLAUDE.md`/`QWEN.md`/`GEMINI.md` blocks |
| `--link` | Symlink skill folders to this checkout (live updates) |
| `--dry-run` | Print the plan, write nothing, exit 0 |
| `--yes` | Apply without asking (needed when there is no terminal) |
| `--json` | Machine-readable plan/result on stdout, progress on stderr. Alone it does not apply; pair with `--yes` |
| `--accessible` | Sequential y/N prompts instead of the arrow-key selector |
| `--verbose` | List every destination and every write |
| `--no-color` | Same as `NO_COLOR=1` |

`update` accepts the same flags. Without `--client` it re-plans from the recipe stored in the manifest (`.retro-port-kit.json`), so `update --project <dir>` is enough after pulling a new kit version.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Applied, planned (`--dry-run` / `--json`), or cancelled by the user |
| `1` | `needs_confirmation`: a real apply was requested without a terminal and without `--yes`; also doctor failures and refused writes |
| `2` | Usage error (unknown client, invalid scope, scaffold at user scope…) |

A non-interactive run never guesses: without `--yes` it prints the plan and exits `1`.

## Automation

```sh
# plan only, parse the JSON
node bin/retro-port-kit.mjs setup --client opencode --project . --json

# apply and report
node bin/retro-port-kit.mjs setup --client opencode --project . --json --yes

# verify, update, remove
node bin/retro-port-kit.mjs doctor --project . --json
node bin/retro-port-kit.mjs update --project . --yes
node bin/retro-port-kit.mjs uninstall --project . --yes
```

`--json` output shape:

```json
{
  "status": "planned | applied | cancelled | needs_confirmation | failed | error",
  "command": "setup",
  "scope": "project",
  "project": "/path/to/game",
  "clients": ["opencode"],
  "options": { "skills": true, "agents": true, "context": true, "scaffold": false, "link": false },
  "plan": { "operations": 28, "paths": ["..."] },
  "result": { "written": 28, "unchanged": 0, "skipped": [], "backups": [], "refused": [] },
  "restart": ["opencode"],
  "manifest": "/path/to/game/.retro-port-kit.json"
}
```

## Safety guarantees

- Nothing is written before approval. Declining or cancelling leaves the filesystem untouched.
- Files we replace are backed up first: `<file>.rpk.backup`, and later different versions as `<file>.rpk.backup.<sha256>.recovery`.
- Writes are staged and read back; a failed verification is reported as a refusal, not as success.
- A destination that changed while the plan was being reviewed is refused.
- A symlink that we do not own is refused.
- Context files are merged inside `<!-- retro-port-kit:begin/end -->` markers; your text outside them is never touched.
- The manifest records every owned file with its SHA-256 and the install recipe. `uninstall` removes only unchanged, owned files, restores backups, and keeps anything you edited (reported with the path).
- Scaffold operations never overwrite an existing file.
- Empty folders are pruned only up to the skills directory we own, never the project root.

## What is not covered

- The installer does not run npm, download binaries or install analysis tools. It copies files from this checkout.
- `--scope user` installs skills everywhere and agents only for clients with global agent support (Claude Code, OpenCode). Context files (`AGENTS.md` and imports) and the scaffold are always per project.
- Symlinked skills (`--link`) point at this checkout: deleting or moving it breaks the links. Uninstall removes the links, not the targets.
