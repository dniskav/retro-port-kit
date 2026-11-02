// Plan / approve / apply / uninstall engine (safety model borrowed from REA's setup): plan shown before writing, backups of anything we
// replace, refusal to clobber files changed after planning, staged writes, read-back verification, manifest of owned files, uninstall that
// removes only what we own and still matches.
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, basename, relative, resolve, sep } from 'node:path'
import { CLIENTS, HOME, skillsDir } from './clients.mjs'
import { KIT, MARK_BEGIN, MARK_END, agentFile, agentsBlock, playbook } from './lib.mjs'

const sha = (b) => createHash('sha256').update(b).digest('hex')
const MANIFEST = '.retro-port-kit.json'
export const manifestPath = (scope, project) => join(scope === 'user' ? HOME : project, MANIFEST)
/** read the ownership manifest of a scope (`{ clients, options, entries }`); empty when nothing is installed */
export const manifestOf = (scope, project) => {
  const p = manifestPath(scope, project)
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { kit: 'retro-port-kit', entries: [] }
}
const readManifest = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { kit: 'retro-port-kit', entries: [] })
const BLOCK_RE = new RegExp(`${MARK_BEGIN}[\\s\\S]*?${MARK_END}\\n?`)

function filesOf(dir, base = dir) {
  const out = []
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const abs = join(d, e.name)
      if (e.isDirectory()) walk(abs)
      else out.push(abs)
    }
  }
  walk(dir)
  return out.map((f) => ({ abs: f, rel: relative(base, f) }))
}

/** build the list of operations (deduplicated by destination) */
export function buildPlan({ clients, scope, project, link, skills = true, agents = true, context = true, scaffold = false }, kit) {
  const ops = new Map()
  const add = (op) => ops.has(op.dest) || ops.set(op.dest, op)
  const root = scope === 'user' ? HOME : project
  for (const id of clients) {
    const c = CLIENTS[id]
    if (!c) throw new Error(`unknown client: ${id}`)
    const sdir = skills ? skillsDir(id, scope, project) : null
    if (sdir) for (const s of kit.skills) {
      if (link) add({ kind: 'link', dest: join(sdir, s.name), target: s.dir, label: `skill ${s.name} (symlink)`, client: id })
      else for (const f of filesOf(s.dir)) add({ kind: 'file', dest: join(sdir, s.name, f.rel), content: readFileSync(f.abs), label: `skill ${s.name}/${f.rel}`, client: id, pruneRoot: sdir })
    }
    // agents: project-local normally; user scope installs them globally for clients that support it
    if (agents && c.agents) for (const a of kit.agents) {
      const f = agentFile(c.agents, a)
      if (!f) continue
      const dest = scope === 'project' ? join(root, f.path) : c.userAgents ? join(c.userRoot(), c.userAgents, basename(f.path)) : null
      if (dest) add({ kind: 'file', dest, content: Buffer.from(f.text), label: `agent ${a.meta.name}`, client: id })
    }
    if (scope !== 'project') continue
    if (context) {
      add({ kind: 'block', dest: join(root, 'AGENTS.md'), content: Buffer.from(agentsBlock(kit)), label: 'AGENTS.md block', client: id })
      for (const [file, text] of c.ctx) add({ kind: 'block', dest: join(root, file), content: Buffer.from(`${MARK_BEGIN}\n${text}${MARK_END}\n`), label: `${file} block`, client: id })
      if (c.rules) for (const s of kit.skills) add({ kind: 'file', dest: join(root, c.rules, id === 'cursor' ? `${s.name}.mdc` : `retro-port-${s.name}.md`), content: Buffer.from(id === 'cursor' ? `---\ndescription: ${s.meta.description}\nalwaysApply: false\n---\n${s.body}` : `# ${s.name}\n_${s.meta.description}_\n\n${s.body}`), label: `rule ${s.name}`, client: id })
      if (c.playbook) add({ kind: 'file', dest: join(root, 'retro-port/PLAYBOOK.md'), content: Buffer.from(playbook(kit)), label: 'PLAYBOOK.md', client: id })
    }
  }
  // --scaffold: tools/, project templates (policy, state, docs) and the dependency-free web shell.
  // Existing files are never overwritten: scaffolding only fills gaps.
  if (scaffold) {
    if (scope !== 'project') throw new Error('--scaffold only applies to --scope project')
    if (resolve(project) === resolve(KIT)) throw new Error('refusing to scaffold into the kit itself; pass --project <game>')
    const trees = [
      ['tools', 'tools', 'tool'],
      ['templates/project', '', 'template'],
      ['templates/web', '', 'web shell'],
    ]
    for (const [src, destPrefix, label] of trees) {
      const base = join(KIT, src)
      if (!existsSync(base)) continue
      for (const f of filesOf(base)) {
        const rel = destPrefix ? join(destPrefix, f.rel) : f.rel
        add({ kind: 'file', dest: join(root, rel), content: readFileSync(f.abs), label: `${label} ${f.rel}`, client: 'scaffold', skipIfExists: true })
      }
    }
  }
  return [...ops.values()]
}

export function describe(ops) {
  return ops.map((o) => `  ${o.kind.padEnd(5)} ${o.dest}   (${o.label}${o.skipIfExists ? ', keep if present' : ''})`).join('\n')
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

/** opaque snapshot of a destination, used to detect changes made while the plan was being approved */
function snapshotOf(dest) {
  const st = lstatSync(dest, { throwIfNoEntry: false })
  if (!st) return null
  if (st.isSymbolicLink()) return 'link:' + readlinkSync(dest)
  if (st.isDirectory()) return 'dir'
  return 'sha:' + sha(readFileSync(dest))
}

/** apply a plan; returns { written, unchanged, skipped, backups, refused } and updates the manifest */
export function apply(ops, { scope, project, dry = false, log = console.log, meta = {} }) {
  const mp = manifestPath(scope, project)
  const man = readManifest(mp)
  const owned = new Map(man.entries.map((e) => [e.path, e]))
  const res = { written: 0, unchanged: 0, skipped: [], backups: [], refused: [] }
  // snapshot BEFORE writing: refuse if something changes while we run
  const seen = new Map(ops.map((o) => [o.dest, snapshotOf(o.dest)]))
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
      if (snapshotOf(o.dest) !== seen.get(o.dest)) { res.refused.push(`${o.dest} changed while planning`); continue }
      if (lstatSync(o.dest, { throwIfNoEntry: false })?.isSymbolicLink() && !prev) { res.refused.push(`${o.dest} is a symlink that is not ours`); continue }
      const cur = existsSync(o.dest) ? readFileSync(o.dest) : null
      // scaffold only fills gaps: never overwrite a file the user already has
      if (o.skipIfExists && cur) { res.skipped.push(o.dest); continue }
      let next = o.content
      if (o.kind === 'block') {
        const text = cur ? cur.toString() : ''
        next = Buffer.from(BLOCK_RE.test(text) ? text.replace(BLOCK_RE, o.content.toString()) : (text ? text.replace(/\n*$/, '\n\n') : '') + o.content.toString())
      }
      if (cur && sha(cur) === sha(next)) { res.unchanged++; if (!prev) owned.set(o.dest, { path: o.dest, kind: o.kind, sha: sha(o.content), ...(o.pruneRoot ? { pruneRoot: o.pruneRoot } : {}) }); continue }
      log(`${dry ? '[dry] ' : ''}write ${o.dest}`)
      if (dry) { res.written++; continue }
      // anything that exists and is not an exact previous version of ours gets a backup first (blocks keep the user's text, so no backup)
      if (cur && o.kind === 'file' && !(prev && prev.sha === sha(cur))) { const b = backupOf(o.dest); if (b) res.backups.push(b) }
      atomicWrite(o.dest, next)
      owned.set(o.dest, { path: o.dest, kind: o.kind, sha: sha(o.content), ...(o.pruneRoot ? { pruneRoot: o.pruneRoot } : {}) })
      res.written++
    } catch (e) { res.refused.push(`${o.dest}: ${e.message}`) }
  }
  if (!dry) {
    // keep the install recipe (clients + options) so `update` can re-plan without repeating flags
    const prev = readManifest(mp)
    const recipe = {
      clients: meta.clients ?? prev.clients ?? [],
      options: meta.options ?? prev.options ?? {},
      version: meta.version ?? prev.version,
      scope,
      ...(scope === 'project' ? { project } : {}),
    }
    writeFileSync(mp, JSON.stringify({ kit: 'retro-port-kit', updated: new Date().toISOString(), ...recipe, entries: [...owned.values()] }, null, 1))
  }
  return res
}

/** remove empty parent folders of a removed skill file, never above the skills directory we own */
function pruneEmpty(start, stopAt) {
  if (!stopAt) return
  let d = start
  while (d !== stopAt && d.startsWith(stopAt + sep) && existsSync(d)) {
    try { if (readdirSync(d).length) break; rmSync(d, { recursive: true, force: true }) } catch { break }
    d = dirname(d)
  }
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
      pruneEmpty(dirname(e.path), e.pruneRoot)
    }
    res.removed++
  }
  if (!dry) {
    if (left.length) {
      const { entries: _entries, ...recipe } = man
      writeFileSync(mp, JSON.stringify({ ...recipe, entries: left }, null, 1))
    } else rmSync(mp, { force: true })
  }
  return res
}

export function status(scope, project) {
  const man = readManifest(manifestPath(scope, project))
  return man.entries.map((e) => {
    const st = lstatSync(e.path, { throwIfNoEntry: false })
    if (!st) return { path: e.path, kind: e.kind, state: 'missing' }
    if (e.kind === 'link') return { path: e.path, kind: e.kind, state: st.isSymbolicLink() && readlinkSync(e.path) === e.target ? 'ok' : 'replaced' }
    if (e.kind === 'block') {
      const text = readFileSync(e.path, 'utf8')
      const block = text.match(BLOCK_RE)?.[0]
      return { path: e.path, kind: e.kind, state: !block ? 'missing' : sha(Buffer.from(block)) === e.sha ? 'ok' : 'modified' }
    }
    return { path: e.path, kind: e.kind, state: sha(readFileSync(e.path)) === e.sha ? 'ok' : 'modified' }
  })
}

// exported for tests
export { snapshotOf, filesOf, pruneEmpty }
