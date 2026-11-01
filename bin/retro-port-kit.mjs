#!/usr/bin/env node
// retro-port-kit CLI: setup | uninstall | update | list | doctor | build
// setup [--client <id>]... [--all-detected] [--scope project|user] [--project <dir>] [--link] [--yes] [--dry-run] [--skills=false] [--agents=false] [--context=false]
import { createInterface } from 'node:readline/promises'
import { resolve } from 'node:path'
import { CLIENTS } from '../scripts/clients.mjs'
import { apply, buildPlan, describe, manifestPath, status, uninstall } from '../scripts/engine.mjs'
import { loadKit } from '../scripts/lib.mjs'

const argv = process.argv.slice(2)
const cmd = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'setup'
const rest = cmd === argv[0] ? argv.slice(1) : argv
const many = (n) => rest.flatMap((a, i) => (a === '--' + n ? [rest[i + 1]] : a.startsWith(`--${n}=`) ? [a.split('=')[1]] : []))
const flag = (n) => rest.includes('--' + n)
const off = (n) => rest.includes(`--${n}=false`)
const scope = many('scope')[0] ?? 'project'
const project = resolve(many('project')[0] ?? process.cwd())
const yes = flag('yes'), dry = flag('dry-run'), link = flag('link')

async function confirm(q) {
  if (yes || dry) return true
  if (!process.stdin.isTTY) { console.log('\nApproval required: re-run with --yes (non-interactive) or in a terminal. Nothing was changed.'); process.exit(3) }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const a = (await rl.question(q + ' [y/N] ')).trim().toLowerCase()
  rl.close()
  return a === 'y' || a === 'yes'
}

if (cmd === 'list') {
  for (const [id, c] of Object.entries(CLIENTS)) console.log(`${id.padEnd(12)} ${c.label.padEnd(44)} ${c.detect() ? 'detected: ' + c.detect() : '-'}`)
} else if (cmd === 'doctor') {
  const st = status(scope, project)
  if (!st.length) console.log('nothing installed (no manifest) at ' + manifestPath(scope, project))
  for (const s of st) console.log(`${s.state.padEnd(9)} ${s.kind.padEnd(5)} ${s.path}`)
  process.exit(st.some((s) => s.state !== 'ok') ? 1 : 0)
} else if (cmd === 'uninstall') {
  const r = uninstall({ scope, project, dry, force: flag('force') })
  console.log(`removed ${r.removed}${r.kept.length ? `, kept ${r.kept.length}:\n  ${r.kept.join('\n  ')}` : ''}`)
} else if (cmd === 'setup' || cmd === 'update') {
  let clients = many('client')
  if (flag('all-detected')) clients = Object.entries(CLIENTS).filter(([, c]) => c.detect()).map(([id]) => id)
  if (flag('all')) clients = Object.keys(CLIENTS)
  if (!clients.length) { console.log('Choose clients: --client <id> (repeatable) or --all-detected.\nRun `list` to see ids and detection.'); process.exit(2) }
  const kit = loadKit()
  const ops = buildPlan({ clients, scope, project, link, skills: !off('skills'), agents: !off('agents'), context: !off('context') }, kit)
  console.log(`Plan (${scope}${scope === 'project' ? ': ' + project : ''}) — clients: ${clients.join(', ')}\n${describe(ops)}\n`)
  for (const id of clients) if (CLIENTS[id].note) console.log(`note [${id}]: ${CLIENTS[id].note}`)
  if (!(await confirm('Apply these changes?'))) { console.log('Declined. Nothing was changed.'); process.exit(1) }
  const r = apply(ops, { scope, project, dry })
  console.log(`${dry ? 'dry run: ' : ''}written ${r.written}, unchanged ${r.unchanged}${r.backups.length ? `, backups ${r.backups.length}` : ''}${r.refused.length ? `\nREFUSED:\n  ${r.refused.join('\n  ')}` : ''}`)
  process.exit(r.refused.length ? 1 : 0)
} else if (cmd === 'build') {
  await import('../scripts/build.mjs')
} else { console.log('commands: setup | update | uninstall | list | doctor | build'); process.exit(2) }
