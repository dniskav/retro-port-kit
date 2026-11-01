// Client registry (inspired by REA's `setup`): one entry per harness with detection, env overrides and install locations.
// `skills`: directory (relative to the root) where SKILL.md folders go; `agents`: adapter id for lib.agentFile (or null);
// `ctx`: files that import AGENTS.md; `rules`: per-skill rule files (cursor/cline); `playbook`: write retro-port/PLAYBOOK.md.
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'

const home = homedir()
const inPath = (cmd) => (process.env.PATH ?? '').split(delimiter).some((d) => d && existsSync(join(d, cmd)))
const env = (k, d) => (process.env[k] ? process.env[k] : d)

export const CLIENTS = {
  claude_code: {
    label: 'Claude Code', skills: '.claude/skills', agents: 'claude', ctx: [['CLAUDE.md', '@AGENTS.md\n']],
    userRoot: () => env('CLAUDE_CONFIG_DIR', join(home, '.claude')), userSkills: 'skills', userAgents: 'agents',
    detect: () => (existsSync(env('CLAUDE_CONFIG_DIR', join(home, '.claude'))) || inPath('claude')) && 'claude config dir or CLI found',
    note: 'Plugin route: /plugin marketplace add <this-folder> (see README). Quit running sessions to see new skills.',
  },
  codex: {
    label: 'Codex CLI', skills: '.agents/skills', agents: null, ctx: [], playbook: true,
    userRoot: () => env('CODEX_HOME', join(home, '.codex')), userSkills: 'skills',
    detect: () => (existsSync(env('CODEX_HOME', join(home, '.codex'))) || inPath('codex')) && 'codex home or CLI found',
    note: 'Roles live in AGENTS.md (Codex has no subagent files).',
  },
  opencode: {
    label: 'OpenCode', skills: '.opencode/skills', agents: 'opencode', ctx: [],
    userRoot: () => env('OPENCODE_CONFIG_DIR', join(env('XDG_CONFIG_HOME', join(home, '.config')), 'opencode')), userSkills: 'skills', userAgents: 'agents',
    detect: () => (existsSync(env('OPENCODE_CONFIG_DIR', join(env('XDG_CONFIG_HOME', join(home, '.config')), 'opencode'))) || inPath('opencode')) && 'opencode config or CLI found',
    note: 'Agent permissions format changed between versions; the older `tools` map is emitted.',
  },
  vscode: {
    label: 'VS Code / GitHub Copilot', skills: '.github/skills', agents: 'vscode', ctx: [],
    userRoot: () => join(home, '.copilot'), userSkills: 'skills',
    detect: () => (existsSync(join(home, '.vscode')) || inPath('code')) && 'VS Code found',
    note: 'Custom agents: .github/agents/*.agent.md (workspace).',
  },
  qwen: {
    label: 'Qwen Code', skills: '.agents/skills', agents: 'qwen', ctx: [['QWEN.md', '@AGENTS.md\n']],
    userRoot: () => env('QWEN_HOME', join(home, '.qwen')), userSkills: null, sharedUser: true,
    detect: () => (existsSync(env('QWEN_HOME', join(home, '.qwen'))) || inPath('qwen')) && 'qwen home or CLI found',
    note: 'Skills go to the shared .agents/skills location.',
  },
  gemini: {
    label: 'Gemini CLI', skills: '.agents/skills', agents: null, ctx: [['GEMINI.md', '@./AGENTS.md\n']],
    userRoot: () => env('GEMINI_CLI_HOME', home), userSkills: null, sharedUser: true,
    detect: () => (existsSync(join(env('GEMINI_CLI_HOME', home), '.gemini')) || inPath('gemini')) && 'gemini home or CLI found',
    note: '',
  },
  cursor: {
    label: 'Cursor', skills: null, agents: null, ctx: [], rules: '.cursor/rules',
    userRoot: () => home, userSkills: null,
    detect: () => (existsSync(join(home, '.cursor')) || inPath('cursor')) && 'cursor found',
    note: 'Skills become .cursor/rules/*.mdc (project scope only).',
  },
  cline: {
    label: 'Cline', skills: null, agents: null, ctx: [], rules: '.clinerules',
    userRoot: () => home, userSkills: null,
    detect: () => false,
    note: 'Skills become .clinerules/*.md (project scope only).',
  },
  generic: {
    label: 'Any other model/harness (DeepSeek, aider, chat…)', skills: null, agents: null, ctx: [], playbook: true,
    userRoot: () => home, userSkills: null, detect: () => false,
    note: 'Writes AGENTS.md + retro-port/PLAYBOOK.md (all skills in one file).',
  },
  agents: {
    label: 'Shared skills only (~/.agents/skills)', skills: '.agents/skills', agents: null, ctx: [],
    userRoot: () => home, userSkills: null, sharedUser: true, detect: () => false,
    note: 'Fallback used by several tools.',
  },
}

/** destination root and skills dir for a client in a scope */
export function skillsDir(client, scope, project) {
  const c = CLIENTS[client]
  if (scope === 'project') return c.skills ? join(project, c.skills) : null
  if (c.sharedUser) return join(home, '.agents', 'skills')
  return c.userSkills ? join(c.userRoot(), c.userSkills) : null
}
