// Validates the kit sources: names, descriptions, sizes, skills referenced by agents. Exit code != 0 on problems.
import { loadKit } from './lib.mjs'
const kit = loadKit()
let bad = 0
const err = (m) => { console.log('ERROR ' + m); bad++ }
const names = new Set(kit.skills.map((s) => s.name))
for (const s of kit.skills) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.name) || s.name.length > 64) err(`skill name invalid: ${s.name}`)
  if (s.meta.name !== s.name) err(`skill ${s.name}: frontmatter name differs from folder (${s.meta.name})`)
  if (!s.meta.description || s.meta.description.length > 1024) err(`skill ${s.name}: description missing or > 1024 chars`)
  if (s.body.length > 20000) err(`skill ${s.name}: body too long`)
  for (const k of Object.keys(s.meta)) if (!['name', 'description'].includes(k)) err(`skill ${s.name}: non-portable frontmatter key ${k}`)
}
for (const a of kit.agents) {
  const n = a.meta.name
  if (!n || a.file !== n + '.md') err(`agent file/name mismatch: ${a.file}`)
  if (!a.meta.description) err(`agent ${n}: description missing`)
  for (const k of (a.meta.skills ?? '').split(',').map((x) => x.trim()).filter(Boolean)) if (!names.has(k)) err(`agent ${n}: unknown skill ${k}`)
}
console.log(bad ? `${bad} problems` : `ok: ${kit.skills.length} skills, ${kit.agents.length} agents`)
process.exit(bad ? 1 : 0)
