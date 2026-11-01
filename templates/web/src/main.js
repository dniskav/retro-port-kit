import { CONFIG } from './config.js'
import { Input } from './input.js'
import { Audio } from './audio.js'
import { save, load } from './save.js'

// --- shell: canvas, fixed-size offscreen buffer, integer scaling ---------------------------------
const canvas = document.getElementById('screen')
const ctx = canvas.getContext('2d')
const buffer = document.createElement('canvas')
buffer.width = CONFIG.width
buffer.height = CONFIG.height
const bctx = buffer.getContext('2d')
bctx.imageSmoothingEnabled = false

const input = new Input(window)
const audio = new Audio()
const state = { tick: 0, x: 160, y: 100, rng: CONFIG.seed }
const debug = { visible: false, fps: 0, simMs: 0, renderMs: 0, message: '' }

function resize() {
  const sx = (window.innerWidth - 32) / CONFIG.width
  const sy = (window.innerHeight - 96) / CONFIG.height
  const scale = Math.max(1, Math.floor(Math.min(sx, sy)))
  canvas.width = CONFIG.width * scale
  canvas.height = CONFIG.height * scale
  canvas.style.width = canvas.width + 'px'
  canvas.style.height = canvas.height + 'px'
}
window.addEventListener('resize', resize)
resize()

// --- simulation: pure step, fixed tick, no DOM / clock / Math.random -----------------------------
const SPEED = 1
const PLAYER = 16

function nextRandom(s) {
  // xorshift32: seeded, deterministic, part of the save state
  s.rng ^= s.rng << 13
  s.rng ^= s.rng >>> 17
  s.rng ^= s.rng << 5
  return s.rng >>> 0
}

function step(s, i) {
  s.tick++
  if (i.left) s.x -= SPEED
  if (i.right) s.x += SPEED
  if (i.up) s.y -= SPEED
  if (i.down) s.y += SPEED
  s.x = Math.max(0, Math.min(CONFIG.width - PLAYER, s.x))
  s.y = Math.max(0, Math.min(CONFIG.height - PLAYER, s.y))

  if (i.pressed.has('fire')) audio.beep(220 + (nextRandom(s) & 0x3ff), 0.06)
  if (i.pressed.has('save')) { const r = save(s); debug.message = r.ok ? 'saved tick ' + s.tick : 'save failed: ' + r.reason }
  if (i.pressed.has('load')) { const r = load(s); debug.message = r.ok ? 'loaded tick ' + s.tick : 'load failed: ' + r.reason }
  if (i.pressed.has('debug')) debug.visible = !debug.visible
}

// --- render: never mutates state ----------------------------------------------------------------
function render(s) {
  bctx.fillStyle = '#031a00'
  bctx.fillRect(0, 0, CONFIG.width, CONFIG.height)
  bctx.fillStyle = '#0a3a05'
  for (let x = 0; x < CONFIG.width; x += 16) bctx.fillRect(x, 0, 1, CONFIG.height)
  for (let y = 0; y < CONFIG.height; y += 16) bctx.fillRect(0, y, CONFIG.width, 1)
  bctx.fillStyle = '#61ff24'
  bctx.fillRect(s.x | 0, s.y | 0, PLAYER, PLAYER)
  bctx.fillStyle = '#9cff6e'
  bctx.font = '8px monospace'
  bctx.fillText('tick ' + s.tick, 4, 10)

  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height)
  if (debug.visible) renderDebug()
}

function renderDebug() {
  const lines = [
    'fps ' + debug.fps.toFixed(1),
    'sim ' + debug.simMs.toFixed(2) + ' ms',
    'render ' + debug.renderMs.toFixed(2) + ' ms',
    'tick ' + state.tick,
    'x ' + state.x + ' y ' + state.y,
    debug.message,
  ]
  ctx.font = '12px ui-monospace, monospace'
  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  ctx.fillRect(8, 8, 190, lines.length * 16 + 8)
  ctx.fillStyle = '#9cff6e'
  lines.forEach((line, i) => ctx.fillText(line, 16, 26 + i * 16))
}

// --- fixed-timestep loop ------------------------------------------------------------------------
const STEP_MS = 1000 / CONFIG.tickHz
let acc = 0
let last = performance.now()
let frames = 0
let fpsAt = last

function frame(now) {
  const dt = Math.min(now - last, 250)
  last = now
  acc += dt

  const t0 = performance.now()
  let steps = 0
  while (acc >= STEP_MS && steps < CONFIG.maxCatchUp) {
    step(state, input.snapshot())
    input.endTick()
    acc -= STEP_MS
    steps++
  }
  if (steps === CONFIG.maxCatchUp) acc = 0 // drop the backlog instead of spiralling
  debug.simMs = performance.now() - t0

  const t1 = performance.now()
  render(state)
  debug.renderMs = performance.now() - t1

  frames++
  if (now - fpsAt >= 1000) { debug.fps = (frames * 1000) / (now - fpsAt); frames = 0; fpsAt = now }
  requestAnimationFrame(frame)
}

// --- audio needs a user gesture; pause the accumulator when the tab is hidden -------------------
function unlock() {
  audio.unlock()
  window.removeEventListener('keydown', unlock)
  window.removeEventListener('pointerdown', unlock)
}
window.addEventListener('keydown', unlock)
window.addEventListener('pointerdown', unlock)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) acc = 0
  last = performance.now()
})

requestAnimationFrame(frame)

// Debug handle: tests read state instead of guessing from pixels.
window.app = { state, config: CONFIG, input, audio, debug, step, render, save: () => save(state), load: () => load(state) }
