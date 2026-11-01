// Terminal UI for the installer: colors (NO_COLOR aware), multi-select, confirmation and plan rendering.
// Interactive prompts are written to the given stream (stderr when --json) so stdout stays machine-readable.
import { emitKeypressEvents } from 'node:readline'
import { createInterface } from 'node:readline/promises'
import { homedir } from 'node:os'
import { dirname, relative, sep } from 'node:path'

/** user pressed Ctrl-C / q / Esc at a prompt: nothing was changed */
export class Cancelled extends Error {
  constructor() {
    super('cancelled')
    this.name = 'Cancelled'
  }
}

const colorOn = () => !process.env.NO_COLOR && !process.env.RPK_NO_COLOR && Boolean(process.stderr.isTTY)
const wrap = (open, close) => (s) => (colorOn() ? `\x1b[${open}m${s}\x1b[${close}m` : String(s))
export const bold = wrap(1, 22)
export const dim = wrap(2, 22)
export const red = wrap(31, 39)
export const green = wrap(32, 39)
export const yellow = wrap(33, 39)
export const cyan = wrap(36, 39)

/** interactive = a human can answer (stdout may still be redirected for --json) */
export const isInteractive = () => Boolean(process.stdin.isTTY && process.stderr.isTTY)

/** yes/no question; Ctrl-C and a closed stdin both mean "cancelled", never "no" */
export async function promptConfirm(question, { defaultAnswer = false, out = process.stdout } = {}) {
  const rl = createInterface({ input: process.stdin, output: out })
  let interrupted = false
  rl.on('SIGINT', () => {
    interrupted = true
    rl.close()
  })
  try {
    const answer = (await rl.question(`${question} ${defaultAnswer ? '[Y/n]' : '[y/N]'} `)).trim().toLowerCase()
    if (interrupted) throw new Cancelled()
    if (!answer) return defaultAnswer
    return answer === 'y' || answer === 'yes'
  } catch (e) {
    if (interrupted || e?.code === 'ABORT_ERR' || e?.code === 'ERR_USE_AFTER_CLOSE') throw new Cancelled()
    throw e
  } finally {
    rl.close()
  }
}

/** sequential y/N prompts: for screen readers, dumb terminals and `--accessible` */
async function accessibleSelect({ title, items, selected, out }) {
  out.write(bold(title) + '\n')
  const chosen = []
  for (const item of items) {
    const pre = selected.includes(item.id)
    const ok = await promptConfirm(`  ${item.label}${item.hint ? dim(' — ' + item.hint) : ''}?`, { defaultAnswer: pre, out })
    if (ok) chosen.push(item.id)
  }
  return chosen
}

/**
 * Arrow-key multi-select. Space toggles, a/n select all/none, enter confirms, q/Esc/Ctrl-C cancels.
 * Returns the chosen ids (possibly empty).
 */
export async function promptMultiSelect({ title, hint = '', items, selected = [], accessible = false, out = process.stderr }) {
  if (!items.length) return []
  if (accessible) return accessibleSelect({ title, items, selected, out })
  const stdin = process.stdin
  if (!stdin.isTTY) throw new Error('interactive selection needs a terminal; pass --client <id> instead')

  const chosen = new Set(selected.filter((id) => items.some((i) => i.id === id)))
  const width = Math.max(...items.map((i) => i.label.length))
  const blockLines = items.length + 2
  let cursor = 0

  const draw = (first) => {
    if (!first) out.write(`\x1b[${blockLines}A`)
    out.write('\x1b[0J')
    out.write(bold(title) + (hint ? '  ' + dim(hint) : '') + '\n')
    for (const [i, item] of items.entries()) {
      const mark = chosen.has(item.id) ? green('◉') : dim('◯')
      const pointer = i === cursor ? cyan('❯') : ' '
      const label = (i === cursor ? bold(item.label) : item.label).padEnd(width + (i === cursor ? 9 : 0))
      out.write(`${pointer} ${mark} ${label}${item.hint ? '  ' + dim(item.hint) : ''}\n`)
    }
    out.write(dim('↑/↓ move · space toggle · a all · n none · enter confirm · q cancel') + '\n')
  }

  return await new Promise((resolve, reject) => {
    emitKeypressEvents(stdin)
    const wasRaw = stdin.isRaw
    stdin.setRawMode(true)
    stdin.resume()
    const cleanup = () => {
      stdin.removeListener('keypress', onKey)
      if (!wasRaw) stdin.setRawMode(false)
      stdin.pause()
    }
    const finish = (ids) => {
      cleanup()
      out.write(`\x1b[${blockLines}A\x1b[0J`)
      const labels = items.filter((i) => ids.includes(i.id)).map((i) => i.label)
      out.write(bold(title) + '  ' + (labels.length ? green(labels.join(', ')) : yellow('none')) + '\n')
      resolve(ids)
    }
    const cancel = () => {
      cleanup()
      out.write(`\x1b[${blockLines}A\x1b[0J`)
      out.write(dim(title + '  cancelled') + '\n')
      reject(new Cancelled())
    }
    const onKey = (str, key = {}) => {
      if ((key.ctrl && key.name === 'c') || key.name === 'escape' || str === 'q') return cancel()
      if (key.name === 'up' || key.name === 'k') { cursor = (cursor - 1 + items.length) % items.length; return draw() }
      if (key.name === 'down' || key.name === 'j') { cursor = (cursor + 1) % items.length; return draw() }
      if (key.name === 'home') { cursor = 0; return draw() }
      if (key.name === 'end') { cursor = items.length - 1; return draw() }
      if (key.name === 'space') {
        const id = items[cursor].id
        chosen.has(id) ? chosen.delete(id) : chosen.add(id)
        return draw()
      }
      if (str === 'a') { items.forEach((i) => chosen.add(i.id)); return draw() }
      if (str === 'n') { chosen.clear(); return draw() }
      if (key.name === 'return' || key.name === 'enter') return finish(items.map((i) => i.id).filter((id) => chosen.has(id)))
    }
    stdin.on('keypress', onKey)
    draw(true)
  })
}

const shortPath = (dest, root) => {
  const rel = relative(root, dest)
  if (!rel) return '.'
  if (!rel.startsWith('..') && !rel.startsWith(sep)) return rel
  const home = homedir()
  return dest.startsWith(home) ? '~' + dest.slice(home.length) : dest
}

const verbOf = (kinds) => (kinds.size === 1 ? [...kinds][0] : 'write')
const VERB = { file: 'write', link: 'link', block: 'merge' }

/**
 * Human-readable plan: one line per destination group (exact paths with --verbose),
 * grouped by client, so the user reviews what will change before approving.
 */
export function renderPlan(ops, { scope, project, clients = [], verbose = false, out = process.stdout, cli = 'retro-port-kit' } = {}) {
  const root = scope === 'user' ? homedir() : project
  const w = (s = '') => out.write(s + '\n')
  w('')
  w(`${bold('Plan')} ${dim('·')} ${scope}${scope === 'project' ? ' ' + dim(root) : ' ' + dim('~')} ${dim('·')} ${ops.length} operations`)
  w('')
  const order = [...clients, ...new Set(ops.map((o) => o.client).filter((id) => !clients.includes(id)))]
  for (const id of order) {
    const mine = ops.filter((o) => o.client === id)
    if (!mine.length) continue
    const label = id === 'scaffold' ? 'project scaffold' : `${id}`
    w(`  ${bold(label)}`)
    const groups = new Map()
    for (const op of mine) {
      const dir = op.pruneRoot ?? (op.kind === 'block' ? op.dest : dirname(op.dest))
      let g = groups.get(dir)
      if (!g) groups.set(dir, (g = { dir, kinds: new Set(), items: [] }))
      g.kinds.add(op.kind)
      g.items.push(op)
    }
    for (const g of groups.values()) {
      const verb = VERB[verbOf(g.kinds)] ?? 'write'
      const path = shortPath(g.dir, root)
      const detail = g.items.length === 1 && g.items[0].kind === 'block' ? 'marked block' : `${g.items.length} file${g.items.length === 1 ? '' : 's'}`
      const keep = g.items.every((i) => i.skipIfExists) ? dim(' · keep if present') : ''
      w(`    ${green(verb.padEnd(6))}${path.padEnd(34)} ${dim(detail)}${keep}`)
      if (verbose) for (const item of g.items) w(dim(`             ${shortPath(item.dest, root)}  (${item.label})`))
    }
    w('')
  }
  if (scope === 'project') {
    const agents = clients.filter((c) => c !== 'scaffold')
    if (agents.length) w(dim(`  Restart after installing: ${agents.join(', ')}`))
    w(dim(`  Verify with: ${cli} doctor --project ${root}`))
    w('')
  }
}
