// Generates the Claude Code plugin (plugin/) and per-client trees (dist/, git-ignored) from src/.
//   node bin/retro-port-kit.mjs build
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { KIT, agentFile, loadKit } from './lib.mjs'
import { CLIENTS } from './clients.mjs'
import { apply, buildPlan } from './engine.mjs'

const kit = loadKit()
const pkg = JSON.parse(readFileSync(join(KIT, 'package.json'), 'utf8'))

// 1) Claude Code plugin: plugin/{.claude-plugin/plugin.json, skills/, agents/} + marketplace at the repo root
const plugin = join(KIT, 'plugin')
rmSync(plugin, { recursive: true, force: true })
mkdirSync(join(plugin, '.claude-plugin'), { recursive: true })
for (const s of kit.skills) cpSync(s.dir, join(plugin, 'skills', s.name), { recursive: true })
mkdirSync(join(plugin, 'agents'), { recursive: true })
for (const a of kit.agents) writeFileSync(join(plugin, 'agents', `${a.meta.name}.md`), agentFile('claude', a).text)
writeFileSync(join(plugin, '.claude-plugin/plugin.json'), JSON.stringify({ name: 'retro-port-kit', version: pkg.version, description: pkg.description, author: { name: 'retro-port-kit' }, keywords: ['retro-games', 'port', 'clean-room'] }, null, 2) + '\n')
mkdirSync(join(KIT, '.claude-plugin'), { recursive: true })
writeFileSync(join(KIT, '.claude-plugin/marketplace.json'), JSON.stringify({ name: 'retro-port-kit', owner: { name: 'retro-port-kit' }, plugins: [{ name: 'retro-port-kit', source: './plugin', description: pkg.description }] }, null, 2) + '\n')

// 2) per-client trees for inspection
rmSync(join(KIT, 'dist'), { recursive: true, force: true })
for (const id of Object.keys(CLIENTS)) {
  const root = join(KIT, 'dist', id)
  apply(buildPlan({ clients: [id], scope: 'project', project: root }, kit), { scope: 'project', project: root, log: () => {} })
}
console.log(`built plugin/ and dist/ (${kit.skills.length} skills, ${kit.agents.length} agents)`)
