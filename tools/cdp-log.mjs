import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const url = process.argv[2]
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const port = 9700 + Math.floor(Math.random() * 200)
const proc = spawn(chrome, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cl-'))}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let t
for (let i = 0; i < 50; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.length) break } catch {} await sleep(200) }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0
const send = (m, p = {}) => ws.send(JSON.stringify({ id: ++id, method: m, params: p }))
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.method === 'Log.entryAdded') console.log('LOG', m.params.entry.level, m.params.entry.text.slice(0, 300)); if (m.method === 'Runtime.consoleAPICalled') console.log('CON', m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300)) })
send('Log.enable'); send('Runtime.enable'); send('Page.navigate', { url })
await sleep(3000)
proc.kill(); process.exit(0)
