import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

test('cleanroom gate flags decompiler traces, allows allowlisted files and skips binaries', () => {
  const p = mkdtempSync(join(tmpdir(), 'rpk-trace-'))
  const git = (...args) => execFileSync('git', args, { cwd: p, stdio: 'ignore' })
  git('init', '-q')
  mkdirSync(join(p, 'docs'), { recursive: true })
  writeFileSync(join(p, 'engine.c'), 'int FUN_4a2c(int x) { __int16 y = undefined4; }\n')
  writeFileSync(join(p, 'docs/provenance.md'), 'routine FUN_4a2c came from the disassembler.\n')
  writeFileSync(join(p, 'tables.dat'), Buffer.from('MZ\x00 chunks with FUN_ inside are not scanned'))
  writeFileSync(join(p, 'clean.c'), 'int own_code(int x) { return x + 1; }\n') // no traces, no allowlist
  writeFileSync(join(p, 'cleanroom.config.json'), JSON.stringify({ traceAllowlist: ['docs/'] }))
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A')
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 't')
  const r = spawnSync('node', [join(ROOT, 'tools/cleanroom-check.mjs'), '--quick'], { cwd: p, encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stdout, /decompiler traces in engine\.c/)
  assert.doesNotMatch(r.stdout, /decompiler traces in docs/)
  assert.doesNotMatch(r.stdout, /decompiler traces in tables\.dat/)
  assert.doesNotMatch(r.stdout, /decompiler traces in clean\.c/)
  rmSync(p, { recursive: true, force: true })
})

test('cleanroom gate passes with traced files when detection is off', () => {
  const p = mkdtempSync(join(tmpdir(), 'rpk-trace-off-'))
  const git = (...args) => execFileSync('git', args, { cwd: p, stdio: 'ignore' })
  git('init', '-q')
  writeFileSync(join(p, 'engine.c'), 'int FUN_4a2c(int x) { __int16 y = undefined4; }\n')
  writeFileSync(join(p, 'cleanroom.config.json'), JSON.stringify({ decompilerTraces: false, originalNames: '(^|/)([\\w-]+\\.(voc|dat))$' }))
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A')
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 't')
  const r = spawnSync('node', [join(ROOT, 'tools/cleanroom-check.mjs'), '--quick'], { cwd: p, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stdout)
  rmSync(p, { recursive: true, force: true })
})

test('model tiers emit a model where mapped and degrade where not', async () => {
  const { agentFile, loadKit } = await import(pathToFileURL(join(ROOT, 'scripts/lib.mjs')).href)
  const { MODEL_TIERS } = await import(pathToFileURL(join(ROOT, 'scripts/model-tiers.mjs')).href)
  const kit = loadKit()
  const orchestrator = kit.agents.find((a) => a.meta.name === 'port-orchestrator')
  assert.ok(orchestrator, 'orchestrator source exists')
  const claude = agentFile('claude', orchestrator).text
  assert.match(claude, /model: opus/, 'claude mapping emits a model alias')
  for (const target of ['opencode', 'vscode']) {
    assert.doesNotMatch(agentFile(target, orchestrator).text, /\nmodel:/, `${target} has no mapping configured → field omitted`)
  }
  assert.equal(MODEL_TIERS.claude.fast, 'haiku')
  // removing the tier from frontmatter degrades to no model, build still fine
  const plain = { ...orchestrator, meta: { ...orchestrator.meta, model_tier: undefined } }
  assert.ok(!agentFile('claude', plain).text.includes('model:'))
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
