// Versioned save in localStorage. A corrupt/old save or a storage failure is reported, never thrown.
const KEY = 'retro-port-save'
export const SAVE_VERSION = 1

export function save(state) {
  const data = { version: SAVE_VERSION, tick: state.tick, x: state.x, y: state.y, rng: state.rng }
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
    return { ok: true, data }
  } catch (e) {
    return { ok: false, reason: e.message }
  }
}

export function load(state) {
  let raw
  try { raw = localStorage.getItem(KEY) } catch (e) { return { ok: false, reason: e.message } }
  if (!raw) return { ok: false, reason: 'empty' }
  try {
    const data = JSON.parse(raw)
    if (data.version !== SAVE_VERSION) return { ok: false, reason: 'version ' + data.version }
    if (![data.tick, data.x, data.y, data.rng].every(Number.isFinite)) return { ok: false, reason: 'invalid fields' }
    Object.assign(state, { tick: data.tick, x: data.x, y: data.y, rng: data.rng })
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: 'corrupt: ' + e.message }
  }
}
