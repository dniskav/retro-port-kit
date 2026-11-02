// Clean-room gate: does the repo contain or need files of the original game?
// Usage: node tools/cleanroom-check.mjs [--quick]   (config: cleanroom.config.json in the project root)
// config: { "originalNames": "regex", "referenceDir": "reference/", "generatedDirs": ["dist-assets/"],
//           "originalDataDir": "Original/", "analysisDir": "analysis/", "decompilerTraces": true,
//           "traceAllowlist": ["docs/SOURCES.md"], "buildCommand": ["npm","run","assets:ci"],
//           "testCommand": ["npx","vitest","run"], "workdir": "." }
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'

const root = resolve(process.cwd())
const cfgPath = join(root, 'cleanroom.config.json')
const cfg = {
  originalNames: '(^|/)([\\w-]+\\.(exe|com|dat|voc|xmi|fli|flc|pal|s3m|mod|xm|it|opl|adl|hsc|cmf|mid|wav))$',
  referenceDir: 'reference/',
  generatedDirs: [],
  originalDataDir: '',
  analysisDir: 'analysis/',
  decompilerTraces: true,
  traceAllowlist: [],
  buildCommand: ['npm', 'run', 'assets:ci'],
  testCommand: ['npx', 'vitest', 'run'],
  workdir: '.',
  ...(existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')) : {}),
}
const sh = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const norm = (p) => p.replace(/\\/g, '/').replace(/\/+$/, '')
const under = (f, dir) => { const d = norm(dir); return d !== '' && (f === d || f.startsWith(d + '/')) }
const dirs = (v) => (Array.isArray(v) ? v : v ? [v] : []).map(norm).filter(Boolean)

let bad = 0
const fail = (m) => { console.log('FAIL   ' + m); bad++ }
const ok = (m) => console.log('ok     ' + m)

let tracked
try { tracked = sh('git', ['ls-files', '-z']).split('\0').filter(Boolean) } catch (e) {
  console.log('FAIL   not a git repository (the gate needs `git ls-files`): ' + e.message.split('\n')[0])
  process.exit(1)
}

const re = new RegExp(cfg.originalNames, 'i')
const hits = tracked.filter((f) => re.test(f))
hits.length ? fail('tracked files with original names: ' + hits.slice(0, 5).join(', ')) : ok('no tracked file has an original-data name')

const media = tracked.filter((f) => existsSync(join(root, f)) && /\.(dat|exe|com|bin|ani|tab|fli|flc|xmi|voc|pal|s3m|mod|xm|it|opl|adl|hsc|cmf|mid|wav)$/i.test(f))
media.length ? fail('tracked data binaries: ' + media.slice(0, 5).join(', ')) : ok('no tracked data binaries')

const generated = tracked.filter((f) => dirs(cfg.generatedDirs).some((d) => under(f, d)))
generated.length ? fail('generated assets are tracked: ' + generated.slice(0, 3).join(', ')) : ok('generated assets are not tracked')

const original = tracked.filter((f) => cfg.originalDataDir && under(f, cfg.originalDataDir))
original.length ? fail('original data directory is tracked: ' + original.slice(0, 3).join(', ')) : ok('original data directory is not tracked')

const reference = tracked.filter((f) => cfg.referenceDir && under(f, cfg.referenceDir))
reference.length ? fail('reference captures are tracked: ' + reference.slice(0, 3).join(', ')) : ok('reference captures are not tracked')

const analysis = tracked.filter((f) => cfg.analysisDir && under(f, cfg.analysisDir))
analysis.length
  ? fail(`binary-analysis output is tracked (keep decompiler/pseudocode work in ${cfg.analysisDir}, git-ignored): ` + analysis.slice(0, 3).join(', '))
  : ok(`binary-analysis output (${cfg.analysisDir}) is not tracked`)

// Decompiler leftovers committed as if they were source: IDA/Ghidra default names and calling-convention
// keywords. Editable allowlist for provenance docs; binary artifacts are ignored by the scan.
if (cfg.decompilerTraces) {
  const reTrace = /\b(FUN|DAT|LAB|JPT|MSG|OFF|UNK)_[0-9a-fA-F]{4,}\b|\bundefined[0-9]+[a-z0-9_]*\b|\b__int(?:8|16|32|64|128)\b|\b__(?:c?cdecl|fastcall|thiscall|stdlib|usercall)\b|\b__return\b|\b__stack_protect\b/gi
  const allow = dirs(cfg.traceAllowlist)
  const hits = new Map()
  for (const f of tracked) {
    if (allow.some((d) => under(f, d))) continue
    let buf
    try { buf = readFileSync(join(root, f)) } catch { continue }
    if (buf.length === 0 || buf.length > 4 * 1024 * 1024) continue
    if (buf.subarray(0, Math.min(buf.length, 512)).includes(0)) continue // binary
    const text = buf.toString('utf8')
    const n = [...text.matchAll(reTrace)].length
    if (n) hits.set(f, n)
  }
  hits.size
    ? [...hits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f, n]) => fail(`decompiler traces in ${f}: ${n} (rewrite as own code/prose, or allowlist in traceAllowlist)`))
    : ok('no decompiler traces in tracked text files')
}

if (process.argv.includes('--quick')) {
  console.log(bad ? `\n${bad} failed checks` : '\nclean (quick)')
  process.exit(bad ? 1 : 0)
}

const tmp = mkdtempSync(join(tmpdir(), 'cleanroom-'))
try {
  const skip = (abs) => {
    const rel = norm(relative(root, abs))
    if (!rel || rel === '.') return true
    if (rel === '.git' || rel.startsWith('.git/')) return true
    if (rel === 'node_modules' || rel.startsWith('node_modules/')) return true
    if (cfg.originalDataDir && under(rel, cfg.originalDataDir)) return true
    if (cfg.referenceDir && under(rel, cfg.referenceDir)) return true
    return dirs(cfg.generatedDirs).some((d) => under(rel, d))
  }
  cpSync(root, join(tmp, 'p'), { recursive: true, filter: skip })
  if (existsSync(join(root, 'node_modules'))) sh('ln', ['-s', join(root, 'node_modules'), join(tmp, 'p/node_modules')])
  const wd = join(tmp, 'p', cfg.workdir)
  sh(cfg.buildCommand[0], cfg.buildCommand.slice(1), wd)
  ok('build works without the original data')
  sh(cfg.testCommand[0], cfg.testCommand.slice(1), wd)
  ok('tests pass without the original data')
} catch (e) {
  fail('rebuild failed: ' + String(e.stdout ?? '').slice(-300) + String(e.stderr ?? '').slice(-300))
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
console.log(bad ? `\n${bad} failed checks` : '\nclean')
process.exit(bad ? 1 : 0)
