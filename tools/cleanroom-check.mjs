// Clean-room gate: does the repo contain or need files of the original game?
// Usage: node tools/cleanroom-check.mjs [--quick]   (config: cleanroom.config.json in the project root)
// config: { "originalNames": "regex", "generatedDirs": ["dist-assets/"], "originalDataDir": "Original/", "buildCommand": ["npm","run","assets:ci"], "testCommand": ["npx","vitest","run"], "workdir": "." }
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(process.cwd())
const cfgPath = join(root, 'cleanroom.config.json')
const cfg = { originalNames: '(^|/)(game\\d+\\.dat|main\\.exe|[\\w-]+\\.(xmi|fli|voc))$', generatedDirs: [], originalDataDir: '', buildCommand: ['npm', 'run', 'assets:ci'], testCommand: ['npx', 'vitest', 'run'], workdir: '.', ...(existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')) : {}) }
const sh = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
let bad = 0
const fail = (m) => { console.log('FAIL   ' + m); bad++ }
const ok = (m) => console.log('ok     ' + m)

const tracked = sh('git', ['ls-files']).split('\n').filter(Boolean)
const re = new RegExp(cfg.originalNames, 'i')
const hits = tracked.filter((f) => re.test(f))
hits.length ? fail('tracked files with original names: ' + hits.slice(0, 5).join(', ')) : ok('no tracked file has an original-data name')
const media = tracked.filter((f) => existsSync(join(root, f)) && /\.(dat|exe|bin|ani|tab|fli|xmi|voc)$/i.test(f))
media.length ? fail('tracked binaries: ' + media.slice(0, 5).join(', ')) : ok('no tracked data binaries')
const gen = tracked.filter((f) => cfg.generatedDirs.some((d) => f.startsWith(d)))
gen.length ? fail('generated assets are tracked: ' + gen.slice(0, 3).join(', ')) : ok('generated assets are not tracked')
if (process.argv.includes('--quick')) process.exit(bad ? 1 : 0)

const tmp = mkdtempSync(join(tmpdir(), 'cleanroom-'))
try {
  cpSync(root, join(tmp, 'p'), { recursive: true, filter: (s) => !/node_modules|[\\/]\.git([\\/]|$)/.test(s) && !(cfg.originalDataDir && s.includes(cfg.originalDataDir)) })
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
