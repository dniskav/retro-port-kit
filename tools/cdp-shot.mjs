// Captura y automatización del clon con Chrome headless por CDP (sin dependencias).
// Uso: node tools/cdp-shot.mjs "<url>" paso [paso …]
//   pasos: click:X,Y  | eval:JS (imprime el resultado) | move:X,Y | key:Code (p.ej. key:Enter) | wait:ms | shot:fichero.png
// Variables: CHROME (ruta al binario), DPR (devicePixelRatio, por defecto 1), VIEW (WxH, por defecto 640x400).
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [url, ...steps] = process.argv.slice(2)
if (!url) {
  console.log('usage: node tools/cdp-shot.mjs "<url>" [click:X,Y|move:X,Y|key:Code|wait:ms|eval:JS|shot:file.png] ...')
  process.exit(2)
}
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const [viewW, viewH] = (process.env.VIEW ?? '640x400').split('x').map(Number)
const port = 9300 + Math.floor(Math.random() * 500)
const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cs-'))}`, `--window-size=${viewW},${viewH}`, '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break } catch { /* aún arrancando */ } await sleep(200) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0; const pending = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })) })

await send('Emulation.setDeviceMetricsOverride', { width: viewW, height: viewH, deviceScaleFactor: Number(process.env.DPR ?? 1), mobile: false })
await send('Page.navigate', { url })
await sleep(3500)
const mouse = async (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 })
for (const s of steps) {
  const i = s.indexOf(':')
  const cmd = i < 0 ? s : s.slice(0, i)
  const arg = i < 0 ? '' : s.slice(i + 1)
  if (cmd === 'wait') await sleep(Number(arg))
  else if (cmd === 'click') { const [x, y] = arg.split(',').map(Number); await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await sleep(80); await mouse('mousePressed', x, y); await sleep(80); await mouse('mouseReleased', x, y); await sleep(1500) }
  else if (cmd === 'eval') { const r = await send('Runtime.evaluate', { expression: arg, returnByValue: true, awaitPromise: true }); console.log(JSON.stringify(r.result?.result?.value ?? r.result)) }
  else if (cmd === 'move') { const [x, y] = arg.split(',').map(Number); await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }) }
  else if (cmd === 'key') { const k = { Enter: 13, Space: 32, Escape: 27 }[arg] ?? arg.charCodeAt(0); for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: arg, code: arg, windowsVirtualKeyCode: k }); await sleep(600) }
  else if (cmd === 'shot') { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(arg, Buffer.from(r.result.data, 'base64')) }
  else throw new Error('paso desconocido: ' + s)
}
ws.close(); proc.kill()
process.exit(0)
