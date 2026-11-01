// Imprime consola, errores de página y entradas del log del navegador (404, CORS, fuentes, decodificadores).
// Uso: node tools/cdp-log.mjs "<url>" [ms]     (CHROME=ruta al binario)
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const url = process.argv[2]
if (!url) {
  console.log('usage: node tools/cdp-log.mjs "<url>" [wait-ms]')
  process.exit(2)
}
const wait = Number(process.argv[3] ?? 3000)
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const port = 9700 + Math.floor(Math.random() * 200)
const proc = spawn(chrome, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cl-'))}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break } catch { /* aún arrancando */ } await sleep(200) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0
const send = (m, p = {}) => ws.send(JSON.stringify({ id: ++id, method: m, params: p }))
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.method === 'Log.entryAdded') console.log('LOG', m.params.entry.level, m.params.entry.text.slice(0, 300))
  if (m.method === 'Runtime.consoleAPICalled') console.log('CON', m.params.type, m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300))
  if (m.method === 'Runtime.exceptionThrown') console.log('ERR', (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 300))
  if (m.method === 'Network.loadingFailed') console.log('NET', m.params.errorText, m.params.type)
})
send('Log.enable'); send('Runtime.enable'); send('Network.enable'); send('Page.navigate', { url })
await sleep(wait)
proc.kill(); process.exit(0)
