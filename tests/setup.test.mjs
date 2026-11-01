import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, lstatSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CLI = join(import.meta.dirname, '..', 'bin', 'retro-port-kit.mjs')
const run = (args, opts = {}) => spawnSync('node', [CLI, ...args], { encoding: 'utf8', ...opts })
const tree = (d) => readdirSync(d, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(e.parentPath ?? e.path, e.name))
const proj = () => mkdtempSync(join(tmpdir(), 'rpk-'))

test('refuses to write without approval when not interactive', () => {
  const p = proj()
  const r = run(['setup', '--client', 'claude_code', '--project', p], { stdin: 'ignore' })
  assert.equal(r.status, 3)
  assert.equal(existsSync(join(p, '.claude')), false)
  rmSync(p, { recursive: true })
})

test('dry run writes nothing', () => {
  const p = proj()
  const r = run(['setup', '--client', 'all', '--all', '--project', p, '--dry-run'])
  assert.equal(r.status, 0)
  assert.equal(tree(p).length, 0)
  rmSync(p, { recursive: true })
})

test('install is idempotent, preserves user AGENTS.md, and uninstall restores the original state', () => {
  const p = proj()
  writeFileSync(join(p, 'AGENTS.md'), '# mine\n')
  assert.equal(run(['setup', '--all', '--project', p, '--yes']).status, 0)
  const first = readFileSync(join(p, 'AGENTS.md'), 'utf8')
  assert.match(first, /^# mine/)
  assert.equal(first.match(/retro-port-kit:begin/g).length, 1)
  assert.equal(run(['setup', '--all', '--project', p, '--yes']).status, 0)
  assert.equal(readFileSync(join(p, 'AGENTS.md'), 'utf8'), first)
  assert.equal(run(['doctor', '--project', p]).status, 0)
  assert.equal(run(['uninstall', '--project', p]).status, 0)
  assert.equal(readFileSync(join(p, 'AGENTS.md'), 'utf8').trim(), '# mine')
  assert.deepEqual(tree(p).map((f) => f.replace(p, '')), ['/AGENTS.md'])
  rmSync(p, { recursive: true })
})

test('a file edited by the user is backed up on update and kept on uninstall', () => {
  const p = proj()
  assert.equal(run(['setup', '--client', 'claude_code', '--project', p, '--yes']).status, 0)
  const f = join(p, '.claude/agents/qa-verifier.md')
  writeFileSync(f, 'my edit\n')
  assert.equal(run(['setup', '--client', 'claude_code', '--project', p, '--yes']).status, 0)
  assert.ok(existsSync(f + '.rpk.backup'))
  assert.equal(readFileSync(f + '.rpk.backup', 'utf8'), 'my edit\n')
  writeFileSync(f, 'edited again\n')
  const u = run(['uninstall', '--project', p])
  assert.match(u.stdout, /kept 1/)
  assert.ok(existsSync(f))
  rmSync(p, { recursive: true })
})

test('shared skills destination is written once for several clients', () => {
  const p = proj()
  assert.equal(run(['setup', '--client', 'codex', '--client', 'qwen', '--client', 'gemini', '--project', p, '--yes']).status, 0)
  const skills = tree(join(p, '.agents/skills')).filter((f) => f.endsWith('SKILL.md'))
  assert.equal(skills.length, 15)
  rmSync(p, { recursive: true })
})

test('validate passes and every skill is portable', () => {
  execFileSync('node', [join(import.meta.dirname, '..', 'scripts', 'validate.mjs')])
})

test('symlinked destination that is not ours is refused', () => {
  const p = proj()
  const r = run(['setup', '--client', 'claude_code', '--project', p, '--link', '--yes'])
  assert.equal(r.status, 0)
  assert.ok(lstatSync(join(p, '.claude/skills/ui-fidelity')).isSymbolicLink())
  assert.equal(run(['uninstall', '--project', p]).status, 0)
  rmSync(p, { recursive: true })
})
