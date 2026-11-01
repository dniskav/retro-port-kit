#!/usr/bin/env node
// retro-port-kit CLI — setup | update | uninstall | list | doctor | build
// Installer UX modelled on `rea setup`: pick clients, pick what to install, review the exact plan, approve,
// then restart the clients named in the completion message. Progress goes to stderr when --json is used.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CLIENTS } from '../scripts/clients.mjs'
import { apply, buildPlan, manifestOf, manifestPath, status, uninstall } from '../scripts/engine.mjs'
import { loadKit } from '../scripts/lib.mjs'
import {
  Cancelled, bold, cyan, dim, green, isInteractive, promptConfirm, promptMultiSelect, red, renderPlan, yellow,
} from '../scripts/ui.mjs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const argv = process.argv.slice(2)
const cmd = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'setup'
const rest = cmd === argv[0] ? argv.slice(1) : argv
const many = (n) => rest.flatMap((a, i) => (a === '--' + n ? [rest[i + 1]] : a.startsWith(`--${n}=`) ? [a.split('=').slice(1).join('=')] : [])).filter((v) => v !== undefined && v !== '')
const flag = (n) => rest.includes('--' + n)
const offAny = (names) => names.some((n) => rest.includes(`--${n}=false`))
const json = flag('json'), yes = flag('yes'), dry = flag('dry-run'), link = flag('link'), accessible = flag('accessible'), verbose = flag('verbose')
const scope = many('scope')[0] ?? 'project'
const project = resolve(many('project')[0] ?? process.cwd())
if (rest.includes('--no-color')) process.env.NO_COLOR = '1'
const interactive = isInteractive()
const self = process.argv[1]
const cli = `node ${self}`
const kit = loadKit()

// human output: stdout normally, stderr with --json (stdout stays machine-readable)
const human = json ? process.stderr : process.stdout
const say = (s = '') => human.write(s + '\n')
const emit = (obj) => process.stdout.write(JSON.stringify(obj, null, 2) + '\n')
const done = (code) => process.exit(code)

function fail(message, code = 2) {
  if (json) emit({ status: 'error', command: cmd, message })
  else say(red('error: ') + message)
  done(code)
}

const safeDetect = (c) => {
  try { return c.detect() || null } catch { return null }
}
const RESTART_HINT = {
  claude_code: 'quit the session and start a new one',
  codex: 'start a new session',
  opencode: 'quit and reopen the session',
  vscode: 'reload the window',
  qwen: 'start a new session',
  gemini: 'start a new session',
  cursor: 'reload the window',
  cline: 'start a new task',
  generic: 'start a new chat',
  agents: 'start a new session',
}

function usage() {
  say(`${bold('retro-port-kit')} ${dim(pkg.version)}

  ${bold('setup')}     [--client <id>]... [--all-detected] [--all] [--scope project|user] [--project <dir>]
            [--scaffold] [--skills=false] [--agents=false] [--context=false] [--link]
            [--dry-run] [--yes] [--json] [--accessible] [--verbose] [--no-color]
  ${bold('update')}    same flags; without --client it re-applies what the manifest recorded
  ${bold('uninstall')} [--project <dir>] [--scope project|user] [--dry-run] [--force] [--yes]
  ${bold('doctor')}    [--project <dir>] [--scope project|user] [--json]
  ${bold('list')}      [--json]
  ${bold('build')}     [--check]

Exit codes: 0 applied / planned / cancelled, 1 needs confirmation or unhealthy, 2 usage error.`)
}

if (cmd === 'version' || flag('version') || flag('v')) {
  say(pkg.version)
  done(0)
}
if (cmd === 'help' || flag('help') || flag('h')) {
  usage()
  done(0)
}

if (!['project', 'user'].includes(scope)) fail(`invalid scope: ${scope}. Use project or user.`)

// ── clients ────────────────────────────────────────────────────────────────────────────────────────
function validateClients(ids) {
  const unknown = ids.filter((id) => !CLIENTS[id])
  if (unknown.length) fail(`unknown client(s): ${unknown.join(', ')}. Valid: ${Object.keys(CLIENTS).join(', ')}.`)
  return ids
}

function clientsFromFlags() {
  const explicit = many('client').flatMap((id) => (id === 'all' ? Object.keys(CLIENTS) : [id]))
  if (!explicit.length && !flag('all') && !flag('all-detected')) return null
  const ids = new Set(explicit)
  if (flag('all')) Object.keys(CLIENTS).forEach((id) => ids.add(id))
  if (flag('all-detected')) for (const [id, c] of Object.entries(CLIENTS)) if (safeDetect(c)) ids.add(id)
  return validateClients([...ids])
}

async function chooseClients(installed = []) {
  const items = Object.entries(CLIENTS).map(([id, c]) => {
    const why = safeDetect(c)
    return { id, label: c.label, hint: why ? `detected — ${why}` : 'not detected', detected: Boolean(why) }
  })
  // REA-like: what is already installed stays selected; on a first run, detected clients are pre-selected.
  const preselected = installed.length ? installed : items.filter((i) => i.detected).map((i) => i.id)
  return promptMultiSelect({
    title: 'Clients to configure',
    hint: '(space toggles, enter confirms)',
    items,
    selected: preselected,
    accessible,
    out: human,
  })
}

// ── options ───────────────────────────────────────────────────────────────────────────────────────
const DEFAULTS = { skills: true, agents: true, context: true, scaffold: false, link: false }
const componentFlags = rest.some((a) => /^--(skills?|agents?|context|scaffold)(=|$)/.test(a))

function optionsFromFlags() {
  const out = {}
  if (rest.some((a) => /^--skills?=/.test(a))) out.skills = !offAny(['skills', 'skill'])
  if (rest.some((a) => /^--agents?=/.test(a))) out.agents = !offAny(['agents', 'agent'])
  if (rest.some((a) => /^--context=/.test(a))) out.context = !offAny(['context'])
  if (flag('scaffold')) out.scaffold = true
  if (rest.includes('--scaffold=false')) out.scaffold = false
  return out
}

async function chooseOptions(options, clients = []) {
  const globalAgents = scope === 'user' && clients.some((id) => CLIENTS[id]?.userAgents)
  const items = [
    { id: 'skills', label: 'Skills', hint: `${kit.skills.length} SKILL.md folders` },
    ...(scope === 'project'
      ? [
          { id: 'agents', label: 'Agents', hint: `${kit.agents.length} role definitions` },
          { id: 'context', label: 'Context files', hint: 'AGENTS.md block + harness imports' },
          { id: 'scaffold', label: 'Project scaffold', hint: 'tools/, docs/, web shell (never overwrites)' },
        ]
      : globalAgents
        ? [{ id: 'agents', label: 'Agents', hint: `${kit.agents.length} role definitions (global, Claude Code/OpenCode)` }]
        : []),
  ]
  const selected = items.filter((i) => options[i.id]).map((i) => i.id)
  const chosen = await promptMultiSelect({
    title: 'What to install',
    hint: '(space toggles, enter confirms)',
    items,
    selected,
    accessible,
    out: human,
  })
  const next = { ...options }
  for (const i of items) next[i.id] = chosen.includes(i.id)
  return next
}

// ── list ──────────────────────────────────────────────────────────────────────────────────────────
if (cmd === 'list') {
  const rows = Object.entries(CLIENTS).map(([id, c]) => {
    const detected = safeDetect(c)
    return { id, label: c.label, detected: detected ?? null, skills: c.skills, agents: Boolean(c.agents), note: c.note || null }
  })
  if (json) emit({ status: 'ok', command: 'list', clients: rows })
  else {
    for (const r of rows) {
      const dot = r.detected ? green('●') : dim('○')
      say(`${dot} ${r.id.padEnd(12)} ${r.label.padEnd(44)} ${r.detected ? dim(r.detected) : dim('-')}`)
    }
  }
  done(0)
}

// ── doctor ────────────────────────────────────────────────────────────────────────────────────────
if (cmd === 'doctor') {
  const entries = status(scope, project)
  const bad = entries.filter((e) => e.state !== 'ok')
  if (json) {
    emit({ status: bad.length ? 'unhealthy' : 'ok', command: 'doctor', scope, project: scope === 'project' ? project : null, manifest: manifestPath(scope, project), entries, summary: { ok: entries.length - bad.length, notOk: bad.length } })
  } else if (!entries.length) {
    say(`nothing installed (no manifest) at ${manifestPath(scope, project)}`)
  } else {
    for (const e of entries) {
      const color = e.state === 'ok' ? green : e.state === 'missing' ? yellow : red
      say(`${color(e.state.padEnd(9))} ${e.kind.padEnd(5)} ${e.path}`)
    }
    say('')
    say(`${entries.length - bad.length} ok${bad.length ? `, ${bad.length} need attention` : ''}`)
  }
  done(bad.length ? 1 : 0)
}

// ── uninstall ─────────────────────────────────────────────────────────────────────────────────────
if (cmd === 'uninstall') {
  const installed = manifestOf(scope, project)
  if (!installed.entries.length) fail(`nothing installed at ${manifestPath(scope, project)}`, 1)
  try {
    if (!yes && !dry && (!interactive || json)) {
      if (json) emit({ status: 'needs_confirmation', command: 'uninstall', message: 're-run with --yes to apply' })
      else say(yellow('Approval required') + ': re-run with --yes (non-interactive) or in a terminal. Nothing was changed.')
      done(1)
    }
    if (interactive && !yes && !dry && !json) {
      say(`${bold('Uninstall')} ${dim('·')} ${installed.entries.length} owned files in ${scope === 'project' ? project : '~'}`)
      say(dim('Files you edited are kept, and backups are restored.'))
      if (!(await promptConfirm('Remove what this kit installed?'))) {
        say(yellow('Cancelled') + '. Nothing was removed.')
        done(0)
      }
    }
    const r = uninstall({ scope, project, dry, force: flag('force'), log: verbose && !json ? (s) => say(dim('  ' + s)) : () => {} })
    if (json) emit({ status: dry ? 'planned' : 'applied', command: 'uninstall', scope, project: scope === 'project' ? project : null, result: r })
    else say(`${dry ? yellow('Dry run') : green('Removed')} ${dim('·')} ${r.removed} file(s)${r.kept.length ? `, kept ${r.kept.length}:\n  ${r.kept.join('\n  ')}` : ''}`)
    done(0)
  } catch (e) {
    if (e instanceof Cancelled) {
      say(yellow('Cancelled') + '. Nothing was removed.')
      done(0)
    }
    throw e
  }
}

// ── setup / update ───────────────────────────────────────────────────────────────────────────────
if (cmd !== 'setup' && cmd !== 'update' && cmd !== 'build') fail(`unknown command: ${cmd}. Try \`help\`.`)

if (cmd === 'build') {
  await import('../scripts/build.mjs')
} else {
  const kind = cmd
  const installed = manifestOf(scope, project)
  try {
    let clients = clientsFromFlags()
    if (kind === 'update' && !installed.entries.length) fail(`nothing installed at ${manifestPath(scope, project)}; run setup first.`, 1)
    if (!clients && (kind === 'update' || (yes && installed.entries.length))) clients = validateClients(installed.clients ?? [])
    if (!clients) {
      if (!interactive || json) fail('choose clients: --client <id> (repeatable), --all-detected or --all. Run `list` for ids.', 2)
      clients = await chooseClients(installed.clients ?? [])
      if (!clients.length) {
        say(yellow('No clients selected') + '. Nothing was changed.')
        done(0)
      }
    }

    let options = { ...DEFAULTS, ...(installed.options ?? {}), ...optionsFromFlags(), link }
    if (scope === 'user' && options.scaffold) fail('--scaffold only applies to --scope project')
    if (scope === 'user') options = { ...options, context: false, scaffold: false }
    if (interactive && !yes && !json && kind === 'setup' && !componentFlags) options = await chooseOptions(options, clients)

    let ops
    try {
      ops = buildPlan({ clients, scope, project, link: options.link, skills: options.skills, agents: options.agents, context: options.context, scaffold: options.scaffold }, kit)
    } catch (e) {
      fail('cannot plan: ' + e.message)
    }

    if (!ops.length) {
      say(yellow('Nothing to do') + '. The selection produces no changes.')
      done(0)
    }

    if (!json) {
      renderPlan(ops, { scope, project, clients, verbose, out: human, cli })
      for (const id of clients) if (CLIENTS[id]?.note) say(dim(`  note [${id}]: ${CLIENTS[id].note}`))
      say('')
    }

    const payload = {
      status: dry || (json && !yes) ? 'planned' : 'applied',
      command: kind,
      version: pkg.version,
      scope,
      project: scope === 'project' ? project : null,
      clients,
      options,
      plan: { operations: ops.length, paths: ops.map((o) => o.dest) },
      result: null,
      restart: clients,
      manifest: manifestPath(scope, project),
    }

    if (dry || (json && !yes)) {
      if (json) emit(payload)
      else say(`${yellow('Dry run')} ${dim('·')} ${ops.length} operations planned, nothing written.`)
      done(0)
    }

    if (!yes) {
      if (!interactive) {
        if (json) emit({ ...payload, status: 'needs_confirmation', message: 're-run with --yes to apply' })
        else say(yellow('Approval required') + ': re-run with --yes (non-interactive) or in a terminal. Nothing was changed.')
        done(1)
      }
      if (!(await promptConfirm('Apply these changes?'))) {
        if (json) emit({ ...payload, status: 'cancelled' })
        else say(yellow('Cancelled') + '. Nothing was changed.')
        done(0)
      }
    }

    const r = apply(ops, {
      scope,
      project,
      dry: false,
      log: verbose && !json ? (s) => say(dim('  ' + s)) : () => {},
      meta: { clients, options, version: pkg.version },
    })
    payload.result = r
    payload.status = r.refused.length ? 'failed' : 'applied'

    if (json) emit(payload)
    else {
      const parts = [`${r.written} written`]
      if (r.unchanged) parts.push(`${r.unchanged} unchanged`)
      if (r.skipped.length) parts.push(`kept ${r.skipped.length} existing`)
      if (r.backups.length) parts.push(`${r.backups.length} backup${r.backups.length === 1 ? '' : 's'}`)
      say(`${r.refused.length ? red('Applied with refusals') : green('Applied')} ${dim('·')} ${parts.join(' · ')}`)
      if (r.backups.length) say(dim('  backups: ' + r.backups.join(', ')))
      if (r.refused.length) {
        say(red('Refused:'))
        for (const line of r.refused) say('  ' + line)
      }
      if (r.skipped.length) say(dim('  kept: ' + r.skipped.join(', ')))
      if (!r.refused.length) {
        say('')
        say(bold('Restart these clients so they load the new files:'))
        for (const id of clients) say(`  ${green('·')} ${CLIENTS[id]?.label ?? id} ${dim('— ' + (RESTART_HINT[id] ?? 'restart it'))}`)
        say('')
        say(`Verify with: ${cyan(cli + ' doctor' + (scope === 'project' ? ' --project ' + project : ' --scope user'))}`)
        say(`Start with the ${bold('port-orchestrator')} agent, or the ${bold('retro-port-intake')} skill.`)
      }
    }
    done(r.refused.length ? 1 : 0)
  } catch (e) {
    if (e instanceof Cancelled) {
      if (json) emit({ status: 'cancelled', command: kind })
      else say(yellow('Cancelled') + '. Nothing was changed.')
      done(0)
    }
    throw e
  }
}
