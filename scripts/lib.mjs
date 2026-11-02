// Shared helpers: tiny frontmatter parser, kit loader, and per-harness adapters (pure, no dependencies).
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MARK_BEGIN = '<!-- retro-port-kit:begin -->'
const MARK_END = '<!-- retro-port-kit:end -->'
export { MARK_BEGIN, MARK_END }

/** parse `---\nkey: value\n---\nbody` (flat keys only); CRLF is normalized so Windows checkouts work */
export function parseDoc(text) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text.replace(/\r\n/g, '\n'))
  if (!m) throw new Error('missing frontmatter')
  const meta = {}
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':')
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return { meta, body: m[2].trim() + '\n' }
}

export function loadKit() {
  const skills = readdirSync(join(KIT, 'src/skills')).filter((d) => existsSync(join(KIT, 'src/skills', d, 'SKILL.md'))).sort()
  const skillDocs = skills.map((name) => ({ name, dir: join(KIT, 'src/skills', name), ...parseDoc(readFileSync(join(KIT, 'src/skills', name, 'SKILL.md'), 'utf8')) }))
  const agents = readdirSync(join(KIT, 'src/agents')).filter((f) => f.endsWith('.md')).sort()
  const agentDocs = agents.map((f) => ({ file: f, ...parseDoc(readFileSync(join(KIT, 'src/agents', f), 'utf8')) }))
  return { skills: skillDocs, agents: agentDocs }
}

const list = (s) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean)

/** capability → tool names of each harness (best effort; see README for the sources) */
const TOOLS = {
  claude: { read: ['Read', 'Grep', 'Glob'], search: [], write: ['Write', 'Edit'], shell: ['Bash'], web: ['WebFetch', 'WebSearch'], browser: [], subagent: ['Agent'] },
  vscode: { read: ['read'], search: ['search'], write: ['edit'], shell: ['execute'], web: ['web'], browser: [], subagent: ['agent'] },
  qwen: { read: ['read_file', 'list_directory'], search: ['glob', 'search_file_content'], write: ['write_file', 'replace'], shell: ['run_shell_command'], web: ['web_fetch', 'google_web_search'], browser: [], subagent: [] },
}
const toolsFor = (target, caps) => [...new Set(caps.flatMap((c) => TOOLS[target]?.[c] ?? []))]

const q = (s) => JSON.stringify(s)

/** per-harness agent file: returns { path, text } relative to the project root */
export function agentFile(target, a) {
  const caps = list(a.meta.capabilities)
  const { name, description } = a.meta
  const body = a.body + `\nSkills to load when relevant: ${list(a.meta.skills).join(', ')} (see the skills directory of your harness, or retro-port/PLAYBOOK.md).\n`
  if (target === 'claude') return { path: `.claude/agents/${name}.md`, text: `---\nname: ${name}\ndescription: ${description}\ntools: ${toolsFor('claude', caps).join(', ')}\n---\n${body}` }
  if (target === 'vscode') return { path: `.github/agents/${name}.agent.md`, text: `---\nname: ${name}\ndescription: ${q(description)}\ntools: [${toolsFor('vscode', caps).map(q).join(', ')}]\n---\n${body}` }
  if (target === 'qwen') return { path: `.qwen/agents/${name}.md`, text: `---\nname: ${name}\ndescription: ${description}\ntools:\n${toolsFor('qwen', caps).map((t) => `  - ${t}`).join('\n')}\n---\n${body}` }
  if (target === 'opencode') {
    const tools = `tools:\n  write: ${caps.includes('write')}\n  edit: ${caps.includes('write')}\n  bash: ${caps.includes('shell')}\n  webfetch: ${caps.includes('web')}\n`
    // opencode_mode: all/primary for agents startable as the primary session agent (default: subagent)
    const mode = a.meta.opencode_mode || 'subagent'
    // opencode_deny: comma-separated edit-protection globs, emitted as OpenCode permission deny rules
    const deny = list(a.meta.opencode_deny)
    const permissions = deny.length
      ? `permissions:\n${deny.map((g) => `  - action: edit\n    resource: ${q(g)}\n    effect: deny`).join('\n')}\n`
      : ''
    // primary/all agents can both delegate and be delegated; subagents cannot nest further subagents
    const notes = mode === 'subagent' ? '' : `
Notes for this harness (OpenCode V2):
- As the primary session agent you MAY launch subagents with the \`subagent\` tool — that is your main delegation mechanism.
- If you yourself were launched as a subagent, you cannot nest further subagents; in that case do not attempt it — adopt the specialist role yourself and report limitations back.
`
    return { path: `.opencode/agents/${name}.md`, text: `---\ndescription: ${q(description)}\nmode: ${mode}\n${tools}${permissions}---\n${body}${notes}` }
  }
  return null
}

/** shared AGENTS.md block: roles + skill catalog + how to use them in harnesses without native support */
export function agentsBlock(kit) {
  const roles = kit.agents.map((a) => `- **${a.meta.name}** — ${a.meta.description}`).join('\n')
  const skills = kit.skills.map((s) => `- \`${s.name}\` — ${s.meta.description}`).join('\n')
  return `${MARK_BEGIN}
## Retro-port kit

This project follows the retro-port method: staged pipeline with automatic gates, policy in \`PROJECT-POLICY.md\`, state in \`state.json\` and \`HANDOFF.md\`.

### Roles (subagents where the harness supports them; otherwise adopt the role and load its skills)
${roles}

### Skills (each is a folder with \`SKILL.md\`; load the one whose description matches the task)
${skills}

If your harness has no native skills, read \`retro-port/PLAYBOOK.md\` (all skills concatenated) or the \`SKILL.md\` files in the skills folder.
Respond to the user in their language; keep code, commits and docs in the languages set by the policy.
${MARK_END}
`
}

export function playbook(kit) {
  return `# Retro-port playbook (all skills)\n\n` + kit.skills.map((s) => `\n---\n\n<!-- skill: ${s.name} -->\n# ${s.name}\n_${s.meta.description}_\n\n${s.body.replace(/^# .*\n/, '')}`).join('\n')
}

// Install locations live in `clients.mjs` only (single source of truth for paths).
export function isDir(p) { try { return statSync(p).isDirectory() } catch { return false } }
