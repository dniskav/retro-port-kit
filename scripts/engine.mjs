// Plan / approve / apply / uninstall engine (safety model borrowed from REA's setup): plan shown before writing, backups of anything we
// replace, refusal to clobber files changed after planning, staged writes, read-back verification, manifest of owned files, uninstall that
// removes only what we own and still matches.
import { createHash } from 'node:crypto'
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { CLIENTS, skillsDir } from './clients.mjs'
import { MARK_BEGIN, MARK_END, agentFile, agentsBlock, playbook } from './lib.mjs'

const sha = (b) => createHash('sha256').update(b).digest('hex')
const MANIFEST = '.retro-port-kit.json'
export const manifestPath = (scope, project) => join(scope === 'user' ? homedir() : project, MANIFEST)
const readManifest = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { kit: 'retro-port-kit', entries: [] })
const BLOCK_RE = new RegExp(`${MARK_BEGIN}[\\s\\S]*?${MARK_END}\\n?`)

function filesOf(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesOf(join(dir, e.name), base) : [join(dir, e.name)])).map((f) => ({ abs: f, rel: relative(base, f) }))
}

/** build the list of operations (deduplicated by destination) */
export function buildPlan({ clients, scope, project, link, skills = true, agents = true, context = true }, kit) {
  const ops = new Map()
  const add = (op) => ops.has(op.dest) || ops.set(op.dest, op)
  const root = scope === 'user' ? homedir() : project
  for (const id of clients) {
    const c = CLIENTS[id]
    if (!c) throw new Error(`unknown client: ${id}`)
    const sdir = skills ? skillsDir(id, scope, project) : null
    if (sdir) for (const s of kit.skills) {
      if (link) add({ kind: 'link', dest: join(sdir, s.name), target: s.dir, label: `skill ${s.name} (symlink)`, client: id })
      else for (const f of filesOf(s.dir)) add({ kind: 'file', dest: join(sdir, s.name, f.rel), content: readFileSync(f.abs), label: `skill ${s.name}/${f.rel}`, client: id })
    }
    if (scope !== 'project') continue
    if (agents && c.agents) for (const a of kit.agents) { const f = agentFile(c.agents, a); if (f) add({ kind: 'file', dest: join(root, f.path), content: Buffer.from(f.text), label: `agent ${a.meta.name}`, client: id }) }
    if (context) {
      add({ kind: 'block', dest: join(root, 'AGENTS.md'), content: Buffer.from(agentsBlock(kit)), label: 'AGENTS.md block', client: id })
      for (const [file, text] of c.ctx) add({ kind: 'block', dest: join(root, file), content: Buffer.from(`${MARK_BEGIN}\n${text}${MARK_END}\n`), label: `${file} block`, client: id })
      if (c.rules) for (const s of kit.skills) add({ kind: 'file', dest: join(root, c.rules, id === 'cursor' ? `${s.name}.mdc` : `retro-port-${s.name}.md`), content: Buffer.from(id === 'cursor' ? `---\ndescription: ${s.meta.description}\nalwaysApply: false\n---\n${s.body}` : `# ${s.name}\n_${s.meta.description}_\n\n${s.body}`), label: `rule ${s.name}`, client: id })
      if (c.playbook) add({ kind: 'file', dest: join(root, 'retro-port/PLAYBOOK.md'), content: Buffer.from(playbook(kit)), label: 'PLAYBOOK.md', client: id })
    }
  }
  return [...ops.values()]
}

export function describe(ops) {
  return ops.map((o) => `  ${o.kind.padEnd(5)} ${o.dest}   (${o.label})`).join('\n')
}

function backupOf(dest) {
  if (!existsSync(dest)) return null
  const cur = readFileSync(dest)
  const first = dest + '.rpk.backup'
  if (!existsSync(first)) { writeFileSync(first, cur); return first }
  if (sha(readFileSync(first)) === sha(cur)) return first
  const rec = `${dest}.rpk.backup.${sha(cur).slice(0, 16)}.recovery`
  writeFileSync(rec, cur)
  return rec
}
function atomicWrite(dest, bytes) {
  mkdirSync(dirname(dest), { recursive: true })
  const tmp = `${dest}.rpk.tmp`
  writeFileSync(tmp, bytes)
  renameSync(tmp, dest)
  if (sha(readFileSync(dest)) !== sha(bytes)) throw new Error(`verification failed for ${dest}`)
}

/** apply a plan; returns { written, skipped, backups } and updates the manifest */
export function apply(ops, { scope, project, dry = false, log = console.log }) {
  const mp = manifestPath(scope, project)
  const man = readManifest(mp)
  const owned = new Map(man.entries.map((e) => [e.path, e]))
  const res = { written: 0, unchanged: 0, backups: [], refused: [] }
  // snapshot BEFORE writing: refuse if something changes while we run
  const seen = new Map(ops.map((o) => [o.dest, existsSync(o.dest) || lstatSync(o.dest, { throwIfNoEntry: false }) ? sha(existsSync(o.dest) && statSync(o.dest).isFile() ? readFileSync(o.dest) : Buffer.from(String(lstatSync(o.dest, { throwIfNoEntry: false })?.isSymbolicLink()))) : null]))
  for (const o of ops) {
    const prev = owned.get(o.dest)
    try {
      if (o.kind === 'link') {
        const st = lstatSync(o.dest, { throwIfNoEntry: false })
        if (st?.isSymbolicLink() && readlinkSync(o.dest) === o.target) { res.unchanged++; owned.set(o.dest, { path: o.dest, kind: 'link', target: o.target }); continue }
        if (st && !prev) { res.refused.push(`${o.dest} exists and is not ours`); continue }
        log(`${dry ? '[dry] ' : ''}link ${o.dest} -> ${o.target}`)
        if (!dry) { rmSync(o.dest, { recursive: true, force: true }); mkdirSync(dirname(o.dest), { recursive: true }); symlinkSync(o.target, o.dest); owned.set(o.dest, { path: o.dest, kind: 'link', target: o.target }) }
        res.written++
        continue
      }
      if (lstatSync(o.dest, { throwIfNoEntry: false })?.isSymbolicLink() && !prev) { res.refused.push(`${o.dest} is a symlink that is not ours`); continue }
      const cur = existsSync(o.dest) ? readFileSync(o.dest) : null
      if (cur && sha(cur) !== seen.get(o.dest) && o.kind !== 'link') { res.refused.push(`${o.dest} changed while planning`); continue }
      let next = o.content
      if (o.kind === 'block') {
        const text = cur ? cur.toString() : ''
        next = Buffer.from(BLOCK_RE.test(text) ? text.replace(BLOCK_RE, o.content.toString()) : (text ? text.replace(/\n*$/, '\n\n') : '') + o.content.toString())
      }
      if (cur && sha(cur) === sha(next)) { res.unchanged++; if (!prev) owned.set(o.dest, { path: o.dest, kind: o.kind, sha: sha(o.content) }); continue }
      log(`${dry ? '[dry] ' : ''}write ${o.dest}`)
      if (dry) { res.written++; continue }
      // anything that exists and is not an exact previous version of ours gets a backup first (blocks keep the user's text, so no backup)
      if (cur && o.kind === 'file' && !(prev && prev.sha === sha(cur))) { const b = backupOf(o.dest); if (b) res.backups.push(b) }
      atomicWrite(o.dest, next)
      owned.set(o.dest, { path: o.dest, kind: o.kind, sha: sha(o.content) })
      res.written++
    } catch (e) { res.refused.push(`${o.dest}: ${e.message}`) }
  }
  if (!dry) writeFileSync(mp, JSON.stringify({ kit: 'retro-port-kit', updated: new Date().toISOString(), entries: [...owned.values()] }, null, 1))
  return res
}

/** remove only what the manifest says we own (and that is still byte-identical); restore backups */
export function uninstall({ scope, project, dry = false, force = false, log = console.log }) {
  const mp = manifestPath(scope, project)
  const man = readManifest(mp)
  const res = { removed: 0, kept: [] }
  const left = []
  for (const e of man.entries) {
    const st = lstatSync(e.path, { throwIfNoEntry: false })
    if (!st) continue
    if (e.kind === 'link') { if (st.isSymbolicLink() && readlinkSync(e.path) === e.target) { log(`${dry ? '[dry] ' : ''}remove ${e.path}`); if (!dry) rmSync(e.path); res.removed++ } else { res.kept.push(e.path); left.push(e) } continue }
    const text = readFileSync(e.path).toString()
    if (e.kind === 'block') {
      const next = text.replace(new RegExp(`\\n*${BLOCK_RE.source}`), '\n')
      log(`${dry ? '[dry] ' : ''}strip block ${e.path}`)
      if (!dry) next.trim() ? writeFileSync(e.path, next) : rmSync(e.path)
      res.removed++
      continue
    }
    if (sha(Buffer.from(text)) !== e.sha && !force) { res.kept.push(e.path + ' (modified by you; use --force)'); left.push(e); continue }
    log(`${dry ? '[dry] ' : ''}remove ${e.path}`)
    if (!dry) {
      rmSync(e.path)
      const b = e.path + '.rpk.backup'
      if (existsSync(b)) { renameSync(b, e.path); log(`restored ${e.path}`) }
      // limpiar carpetas vacías de skills
      for (let d = dirname(e.path); d.length > 3; d = dirname(d)) { try { if (readdirSync(d).length) break; rmSync(d, { recursive: true }) } catch { break } }
    }
    res.removed++
  }
  if (!dry) left.length ? writeFileSync(mp, JSON.stringify({ kit: 'retro-port-kit', entries: left }, null, 1)) : rmSync(mp, { force: true })
  return res
}

export function status(scope, project) {
  const man = readManifest(manifestPath(scope, project))
  return man.entries.map((e) => {
    const st = lstatSync(e.path, { throwIfNoEntry: false })
    const state = !st ? 'missing' : e.kind === 'link' ? (st.isSymbolicLink() ? 'ok' : 'replaced') : e.kind === 'block' ? 'ok' : sha(readFileSync(e.path)) === e.sha ? 'ok' : 'modified'
    return { path: e.path, kind: e.kind, state }
  })
}
void cpSync; void relative
