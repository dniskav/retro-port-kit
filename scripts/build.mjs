// Generates the Claude Code plugin (plugin/) and per-client trees (dist/, git-ignored) from src/.
//   node bin/retro-port-kit.mjs build           # write plugin/ and dist/
//   node bin/retro-port-kit.mjs build --check   # verify plugin/ and .claude-plugin/ match src/ (CI)
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { KIT, agentFile, loadKit } from './lib.mjs'
import { CLIENTS } from './clients.mjs'
import { apply, buildPlan } from './engine.mjs'

const kit = loadKit()
const pkg = JSON.parse(readFileSync(join(KIT, 'package.json'), 'utf8'))

/** write the Claude Code plugin tree under `root` (root/plugin + root/.claude-plugin/marketplace.json) */
function generatePlugin(root) {
  const plugin = join(root, 'plugin')
  rmSync(plugin, { recursive: true, force: true })
  mkdirSync(join(plugin, '.claude-plugin'), { recursive: true })
  for (const s of kit.skills) cpSync(s.dir, join(plugin, 'skills', s.name), { recursive: true })
  mkdirSync(join(plugin, 'agents'), { recursive: true })
  for (const a of kit.agents) writeFileSync(join(plugin, 'agents', `${a.meta.name}.md`), agentFile('claude', a).text)
  writeFileSync(join(plugin, '.claude-plugin/plugin.json'), JSON.stringify({ name: 'retro-port-kit', version: pkg.version, description: pkg.description, author: { name: 'retro-port-kit' }, keywords: ['retro-games', 'port', 'clean-room'] }, null, 2) + '\n')
  mkdirSync(join(root, '.claude-plugin'), { recursive: true })
  writeFileSync(join(root, '.claude-plugin/marketplace.json'), JSON.stringify({ name: 'retro-port-kit', owner: { name: 'retro-port-kit' }, plugins: [{ name: 'retro-port-kit', source: './plugin', description: pkg.description }] }, null, 2) + '\n')
}

function generateDist() {
  rmSync(join(KIT, 'dist'), { recursive: true, force: true })
  for (const id of Object.keys(CLIENTS)) {
    const root = join(KIT, 'dist', id)
    apply(buildPlan({ clients: [id], scope: 'project', project: root }, kit), { scope: 'project', project: root, log: () => {} })
  }
}

/** relative path → bytes for every file under `root` (missing root = empty) */
function treeOf(root) {
  const out = new Map()
  if (!existsSync(root)) return out
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, e.name)
      if (e.isDirectory()) walk(abs)
      else out.set(relative(root, abs), readFileSync(abs))
    }
  }
  walk(root)
  return out
}

function diffTrees(expected, actual, label) {
  const a = treeOf(expected), b = treeOf(actual)
  const problems = []
  for (const [rel, bytes] of a) {
    const other = b.get(rel)
    if (!other) problems.push(`missing in ${label}: ${rel}`)
    else if (!bytes.equals(other)) problems.push(`stale in ${label}: ${rel}`)
  }
  for (const rel of b.keys()) if (!a.has(rel)) problems.push(`extra in ${label}: ${rel}`)
  return problems
}

if (process.argv.includes('--check')) {
  const tmp = mkdtempSync(join(tmpdir(), 'rpk-build-'))
  try {
    generatePlugin(tmp)
    const problems = [
      ...diffTrees(join(tmp, 'plugin'), join(KIT, 'plugin'), 'plugin/'),
      ...diffTrees(join(tmp, '.claude-plugin'), join(KIT, '.claude-plugin'), '.claude-plugin/'),
    ]
    if (problems.length) {
      console.log(problems.slice(0, 20).join('\n'))
      console.log(`\n${problems.length} problem(s): run \`node bin/retro-port-kit.mjs build\` and commit plugin/ and .claude-plugin/.`)
      process.exit(1)
    }
    console.log(`ok: plugin/ and .claude-plugin/ are up to date (${kit.skills.length} skills, ${kit.agents.length} agents)`)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
} else {
  generatePlugin(KIT)
  generateDist()
  console.log(`built plugin/ and dist/ (${kit.skills.length} skills, ${kit.agents.length} agents)`)
}
