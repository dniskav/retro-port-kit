import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

test('5x7 font table is complete and well formed', () => {
  const src = readFileSync(join(ROOT, 'tools/pixel-fonts/font5x7.ts'), 'utf8')
  const body = src.slice(src.indexOf('const COLS = ['), src.indexOf('\n]'))
  const cells = [...body.matchAll(/'([0-9a-f]+)'/g)].map((m) => m[1])
  assert.equal(cells.length, 95, 'one cell per printable ASCII character')
  for (const [i, hex] of cells.entries()) assert.match(hex, /^[0-9a-f]{10}$/, `glyph ${i + 32} (${String.fromCharCode(i + 32)})`)
  assert.doesNotMatch(src, /\.replace\(/, 'no patched cells')
})

test('web shell modules parse as ES modules', () => {
  const srcDir = join(ROOT, 'templates/web/src')
  const tmp = mkdtempSync(join(tmpdir(), 'rpk-web-'))
  for (const f of ['config.js', 'input.js', 'audio.js', 'save.js', 'assets.js', 'main.js']) {
    const dest = join(tmp, f.replace(/\.js$/, '.mjs'))
    copyFileSync(join(srcDir, f), dest)
    const r = spawnSync('node', ['--check', dest], { encoding: 'utf8' })
    assert.equal(r.status, 0, `${f}: ${r.stderr}`)
  }
  rmSync(tmp, { recursive: true, force: true })
})

test('cleanroom gate fails on tracked original binaries and passes when clean', () => {
  const p = mkdtempSync(join(tmpdir(), 'rpk-clean-'))
  const git = (...args) => execFileSync('git', args, { cwd: p, stdio: 'ignore' })
  git('init', '-q')
  writeFileSync(join(p, 'main.exe'), 'MZ')
  git('add', 'main.exe')
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'add')
  const bad = spawnSync('node', [join(ROOT, 'tools/cleanroom-check.mjs'), '--quick'], { cwd: p, encoding: 'utf8' })
  assert.equal(bad.status, 1)
  assert.match(bad.stdout, /original names/)

  rmSync(join(p, 'main.exe'))
  writeFileSync(join(p, 'README.md'), '# clean\n')
  git('add', '-A')
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'clean')
  const good = spawnSync('node', [join(ROOT, 'tools/cleanroom-check.mjs'), '--quick'], { cwd: p, encoding: 'utf8' })
  assert.equal(good.status, 0, good.stdout)
  assert.match(good.stdout, /clean/)
  rmSync(p, { recursive: true, force: true })
})

test('cleanroom gate reports a missing git repository instead of crashing', () => {
  const p = mkdtempSync(join(tmpdir(), 'rpk-nogit-'))
  const r = spawnSync('node', [join(ROOT, 'tools/cleanroom-check.mjs'), '--quick'], { cwd: p, encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stdout, /not a git repository/)
  rmSync(p, { recursive: true, force: true })
})

test('renderPlan groups operations per client and emits no ANSI codes off a TTY', async () => {
  const { renderPlan } = await import(pathToFileURL(join(ROOT, 'scripts/ui.mjs')).href)
  const ops = [
    { kind: 'file', dest: '/p/.claude/skills/a/SKILL.md', client: 'claude_code', pruneRoot: '/p/.claude/skills', label: 'skill a/SKILL.md' },
    { kind: 'block', dest: '/p/AGENTS.md', client: 'claude_code', label: 'AGENTS.md block' },
    { kind: 'file', dest: '/p/tools/x.mjs', client: 'scaffold', skipIfExists: true, label: 'tool x.mjs' },
  ]
  let text = ''
  renderPlan(ops, { scope: 'project', project: '/p', clients: ['claude_code'], out: { write: (s) => { text += s } } })
  assert.match(text, /\.claude\/skills\s+1 file/)
  assert.match(text, /merge\s+AGENTS\.md\s+marked block/)
  assert.match(text, /project scaffold/)
  assert.match(text, /keep if present/)
  assert.doesNotMatch(text, /\x1b\[/)
})
