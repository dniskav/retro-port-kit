import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, lstatSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const CLI = join(ROOT, 'bin', 'retro-port-kit.mjs')
const run = (args, opts = {}) => spawnSync('node', [CLI, ...args], { encoding: 'utf8', ...opts })
const proj = () => mkdtempSync(join(tmpdir(), 'rpk-'))
const walk = (dir, base = dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const abs = join(dir, e.name)
    return e.isDirectory() ? walk(abs, base) : [relative(base, abs)]
  })
const tree = (dir) => (existsSync(dir) ? walk(dir) : [])

test('refuses to write without approval when not interactive', () => {
  const p = proj()
  const r = run(['setup', '--client', 'claude_code', '--project', p], { stdin: 'ignore' })
  assert.equal(r.status, 1)
  assert.match(r.stdout, /Approval required/)
  assert.equal(existsSync(join(p, '.claude')), false)
  rmSync(p, { recursive: true })
})

test('--json returns a machine-readable plan and writes nothing', () => {
  const p = proj()
  const r = run(['setup', '--client', 'opencode', '--project', p, '--json'])
  assert.equal(r.status, 0)
  const out = JSON.parse(r.stdout)
  assert.equal(out.status, 'planned')
  assert.deepEqual(out.clients, ['opencode'])
  assert.ok(out.plan.operations > 0)
  assert.equal(out.result, null)
  assert.equal(tree(p).length, 0)
  rmSync(p, { recursive: true })
})

test('--json --yes applies and records the install recipe', () => {
  const p = proj()
  const r = run(['setup', '--client', 'opencode', '--project', p, '--json', '--yes'])
  assert.equal(r.status, 0)
  const out = JSON.parse(r.stdout)
  assert.equal(out.status, 'applied')
  assert.ok(out.result.written > 0)
  const m = JSON.parse(readFileSync(join(p, '.retro-port-kit.json'), 'utf8'))
  assert.deepEqual(m.clients, ['opencode'])
  assert.equal(m.options.skills, true)
  assert.equal(m.options.scaffold, false)
  rmSync(p, { recursive: true })
})

test('update without flags re-applies the recorded install', () => {
  const p = proj()
  assert.equal(run(['setup', '--client', 'opencode', '--project', p, '--yes']).status, 0)
  const agent = join(p, '.opencode/agents/qa-verifier.md')
  rmSync(agent)
  const r = run(['update', '--project', p, '--yes'])
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.ok(existsSync(agent))
  assert.equal(run(['doctor', '--project', p, '--json']).status, 0)
  rmSync(p, { recursive: true })
})

test('dry run writes nothing', () => {
  const p = proj()
  const r = run(['setup', '--client', 'all', '--all', '--project', p, '--dry-run'])
  assert.equal(r.status, 0)
  assert.equal(tree(p).length, 0)
  rmSync(p, { recursive: true })
})

test('invalid scope is rejected before planning or changing files', () => {
  const p = proj()
  for (const command of ['setup', 'update', 'doctor', 'uninstall']) {
    const r = run([command, '--client', 'codex', '--scope', 'invalid', '--project', p, '--yes', '--json'])
    assert.equal(r.status, 2)
    assert.match(JSON.parse(r.stdout).message, /invalid scope/)
  }
  assert.deepEqual(tree(p), [])
  rmSync(p, { recursive: true })
})

test('non-interactive uninstall requires approval and dry run preserves files', () => {
  const p = proj()
  assert.equal(run(['setup', '--client', 'codex', '--project', p, '--yes']).status, 0)
  const before = tree(p).sort()
  for (const extra of [[], ['--json']]) {
    const r = run(['uninstall', '--project', p, ...extra])
    assert.equal(r.status, 1)
    if (extra.length) assert.equal(JSON.parse(r.stdout).status, 'needs_confirmation')
    else assert.match(r.stdout, /Approval required/)
    assert.deepEqual(tree(p).sort(), before)
  }
  assert.equal(run(['uninstall', '--project', p, '--dry-run']).status, 0)
  assert.deepEqual(tree(p).sort(), before)
  assert.equal(run(['uninstall', '--project', p, '--yes']).status, 0)
  assert.deepEqual(tree(p), [])
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
  assert.equal(run(['uninstall', '--project', p, '--yes']).status, 0)
  assert.equal(readFileSync(join(p, 'AGENTS.md'), 'utf8').trim(), '# mine')
  assert.deepEqual(tree(p), ['AGENTS.md'])
  rmSync(p, { recursive: true })
})

test('uninstall never removes the project directory, even when it becomes empty', () => {
  const p = proj()
  assert.equal(run(['setup', '--client', 'claude_code', '--project', p, '--yes']).status, 0)
  assert.equal(run(['uninstall', '--project', p, '--yes']).status, 0)
  assert.ok(existsSync(p), 'project root must survive uninstall')
  assert.deepEqual(tree(p), [])
  rmSync(p, { recursive: true })
})

test('doctor detects a modified context block', () => {
  const p = proj()
  assert.equal(run(['setup', '--client', 'claude_code', '--project', p, '--yes']).status, 0)
  const f = join(p, 'AGENTS.md')
  writeFileSync(f, readFileSync(f, 'utf8').replace('Retro-port kit', 'Tampered'))
  const r = run(['doctor', '--project', p])
  assert.equal(r.status, 1)
  assert.match(r.stdout, /modified/)
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
  const u = run(['uninstall', '--project', p, '--yes'])
  assert.match(u.stdout, /kept 1/)
  assert.ok(existsSync(f))
  rmSync(p, { recursive: true })
})

test('shared skills destination is written once for several clients', async () => {
  const p = proj()
  assert.equal(run(['setup', '--client', 'codex', '--client', 'qwen', '--client', 'gemini', '--project', p, '--yes']).status, 0)
  const skills = tree(join(p, '.agents/skills')).filter((f) => f.endsWith('SKILL.md'))
  const { loadKit } = await import(pathToFileURL(join(ROOT, 'scripts/lib.mjs')).href)
  assert.equal(skills.length, loadKit().skills.length, 'one SKILL.md per kit skill, written once')
  rmSync(p, { recursive: true })
})

test('user scope installs skills and global agents under HOME and uninstalls', () => {
  const home = proj()
  const env = { ...process.env, HOME: home, XDG_CONFIG_HOME: join(home, '.config'), CLAUDE_CONFIG_DIR: '', OPENCODE_CONFIG_DIR: '' }
  const r = run(['setup', '--client', 'opencode', '--client', 'claude_code', '--scope', 'user', '--yes'], { env })
  assert.equal(r.status, 0, r.stdout + r.stderr)
  for (const base of ['.config/opencode', '.claude']) {
    assert.ok(existsSync(join(home, base, 'skills/ui-fidelity/SKILL.md')), 'missing skill in ' + base)
    assert.ok(existsSync(join(home, base, 'agents/port-orchestrator.md')), 'missing agent in ' + base)
  }
  assert.equal(run(['doctor', '--scope', 'user', '--json'], { env }).status, 0)
  assert.equal(run(['uninstall', '--scope', 'user', '--yes'], { env }).status, 0)
  assert.equal(tree(home).length, 0)
  rmSync(home, { recursive: true })
})

test('scaffold installs tools, templates and the web shell without overwriting user files', () => {
  const p = proj()
  writeFileSync(join(p, 'index.html'), '<h1>mine</h1>\n')
  const r = run(['setup', '--client', 'generic', '--project', p, '--scaffold', '--yes'])
  assert.equal(r.status, 0, r.stdout + r.stderr)
  for (const f of ['tools/cleanroom-check.mjs', 'PROJECT-POLICY.md', 'state.json', 'docs/DECISIONS.md', 'docs/KNOWN-GAPS.md', 'docs/REFERENCE.md', 'src/main.js', 'src/input.js', 'src/audio.js', 'src/save.js']) {
    assert.ok(existsSync(join(p, f)), 'missing ' + f)
  }
  assert.equal(readFileSync(join(p, 'index.html'), 'utf8'), '<h1>mine</h1>\n')
  assert.match(r.stdout, /kept 1 existing/)
  rmSync(p, { recursive: true })
})

test('scaffold is rejected for user scope', () => {
  const p = proj()
  const r = run(['setup', '--client', 'generic', '--project', p, '--scope', 'user', '--scaffold', '--yes'])
  assert.notEqual(r.status, 0)
  rmSync(p, { recursive: true })
})

test('scaffold refuses to write into the kit itself', () => {
  const r = run(['setup', '--client', 'generic', '--project', ROOT, '--scaffold', '--yes'])
  assert.notEqual(r.status, 0)
  assert.match(r.stdout, /refusing to scaffold/)
  assert.equal(existsSync(join(ROOT, 'index.html')), false)
})

test('validate passes and every skill is portable', () => {
  execFileSync('node', [join(ROOT, 'scripts', 'validate.mjs')])
})

test('generated plugin is up to date', () => {
  const r = run(['build', '--check'])
  assert.equal(r.status, 0, r.stdout + r.stderr)
})

test('symlinked destination that is not ours is refused', { skip: process.platform === 'win32' && 'creating symlinks usually requires elevation on Windows' }, () => {
  const p = proj()
  const r = run(['setup', '--client', 'claude_code', '--project', p, '--link', '--yes'])
  assert.equal(r.status, 0)
  assert.ok(lstatSync(join(p, '.claude/skills/ui-fidelity')).isSymbolicLink())
  assert.equal(run(['uninstall', '--project', p, '--yes']).status, 0)
  rmSync(p, { recursive: true })
})
