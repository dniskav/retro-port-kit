// Tier → per-harness model mapping. Single place to edit; adapters emit `model: <value>` only when
// an entry is non-null, and omit the field otherwise (that harness keeps its own default), so the
// build never breaks when a harness changes its agent schema.
// claude: Claude Code model aliases (docs: model field of subagent frontmatter).
// opencode: needs `provider/model-id` — fill in and un-comment to enable.
// vscode: Copilot custom agents accept a model in .agent.md — fill in to enable.
// qwen/gcodex/gemini: no verified per-agent model field → nothing is emitted (unmapped harnesses).
export const MODEL_TIERS = {
  claude: { fast: 'haiku', balanced: 'sonnet', strong: 'opus' },
  opencode: { fast: null, balanced: null, strong: null },
  vscode: { fast: null, balanced: null, strong: null },
}
