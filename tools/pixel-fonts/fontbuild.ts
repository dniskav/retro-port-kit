import { brotliCompressSync, deflateSync } from 'node:zlib'
import { coveredCodepoints, pglyph, pglyphSmall, type PGlyph } from './pixelfont.ts'

/**
 * Generador de TrueType propio (sin dependencias): cada píxel del diseño 5×7 pasa a ser un cuadrado vectorial de 100 unidades
 * (unitsPerEm 1000 ⇒ a 10 px de cuerpo cada píxel del diseño mide 1 px: nítido a cualquier múltiplo y escalable sin pixelarse).
 * Salidas: TTF, WOFF (zlib) y WOFF2 (Brotli, sin transformación de glyf/loca).
 */
const PX = 100, ADV = 600, LSB = 50, UPM = 1000, ASC = 900, DESC = -200

interface Glyph { cp: number; contours: Array<Array<[number, number]>>; adv: number }

/** rectángulos de un glifo con fusión vertical de tramos idénticos */
function rects(rows: number[], y0: number): Array<[number, number, number, number]> {
  const out: Array<[number, number, number, number]> = [] // x0,x1 (columnas) y y0,y1 (filas, y1 excl.)
  let active = new Map<string, [number, number, number, number]>()
  rows.forEach((bits, i) => {
    const row = y0 + i
    const runs: Array<[number, number]> = []
    for (let x = 0; x < 5; ) { if ((bits >> (4 - x)) & 1) { let n = 1; while (x + n < 5 && (bits >> (4 - x - n)) & 1) n++; runs.push([x, x + n]); x += n } else x++ }
    const next = new Map<string, [number, number, number, number]>()
    for (const [a, b] of runs) {
      const k = `${a}-${b}`
      const prev = active.get(k)
      if (prev) { prev[3] = row + 1; next.set(k, prev) } else { const r: [number, number, number, number] = [a, b, row, row + 1]; next.set(k, r); out.push(r) }
    }
    active = next
  })
  return out
}
function glyphFor(cp: number, capRows: number, src: (cp: number) => PGlyph | null): Glyph | null {
  const g = src(cp)
  if (!g) return null
  const contours = rects(g.rows, g.y0).map(([xa, xb, ya, yb]) => {
    const x0 = LSB + xa * PX, x1 = LSB + xb * PX
    // la línea base es el borde inferior de la última fila de mayúscula; y crece hacia arriba
    const yT = (capRows - ya) * PX, yB = (capRows - yb) * PX
    return [[x0, yT], [x1, yT], [x1, yB], [x0, yB]] as Array<[number, number]> // sentido horario
  })
  return { cp, contours, adv: ADV }
}

const u16 = (v: number): Buffer => { const b = Buffer.alloc(2); b.writeUInt16BE(v & 0xffff); return b }
const i16 = (v: number): Buffer => { const b = Buffer.alloc(2); b.writeInt16BE(v); return b }
const u32 = (v: number): Buffer => { const b = Buffer.alloc(4); b.writeUInt32BE(v >>> 0); return b }
const pad4 = (b: Buffer): Buffer => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4))]) : b)
const checksum = (b: Buffer): number => { const p = pad4(b); let s = 0; for (let i = 0; i < p.length; i += 4) s = (s + p.readUInt32BE(i)) >>> 0; return s }

function glyfEntry(g: Glyph): Buffer {
  if (!g.contours.length) return Buffer.alloc(0)
  const xs = g.contours.flat().map((p) => p[0]), ys = g.contours.flat().map((p) => p[1])
  const parts: Buffer[] = [i16(g.contours.length), i16(Math.min(...xs)), i16(Math.min(...ys)), i16(Math.max(...xs)), i16(Math.max(...ys))]
  let n = 0
  for (const c of g.contours) { n += c.length; parts.push(u16(n - 1)) }
  parts.push(u16(0)) // sin instrucciones
  const pts = g.contours.flat()
  parts.push(Buffer.alloc(pts.length, 0x01)) // todos en la curva, coordenadas de 16 bits
  let px = 0
  for (const [x] of pts) { parts.push(i16(x - px)); px = x }
  let py = 0
  for (const [, y] of pts) { parts.push(i16(y - py)); py = y }
  return pad4(Buffer.concat(parts))
}

export interface FontFiles { ttf: Buffer; woff: Buffer; woff2: Buffer }

export function buildFonts(family = 'Syndi Pixel', small = false): FontFiles {
  const cps = coveredCodepoints()
  const capRows = small ? 5 : 7
  // .notdef: marco de 5×7
  const notdef: Glyph = { cp: -1, adv: ADV, contours: [[[LSB, 0], [LSB, capRows * PX], [LSB + 500, capRows * PX], [LSB + 500, 0]], [[LSB + 100, 100], [LSB + 400, 100], [LSB + 400, capRows * PX - 100], [LSB + 100, capRows * PX - 100]]] }
  const glyphs: Glyph[] = [notdef, ...cps.map((cp) => glyphFor(cp, capRows, small ? pglyphSmall : pglyph)!).filter(Boolean)]
  const nG = glyphs.length
  const glyf: Buffer[] = glyphs.map(glyfEntry)
  const loca = Buffer.alloc((nG + 1) * 4)
  let off = 0
  glyf.forEach((g, i) => { loca.writeUInt32BE(off, i * 4); off += g.length })
  loca.writeUInt32BE(off, nG * 4)
  const allPts = glyphs.flatMap((g) => g.contours.flat())
  const xMin = Math.min(...allPts.map((p) => p[0])), xMax = Math.max(...allPts.map((p) => p[0])), yMin = Math.min(...allPts.map((p) => p[1])), yMax = Math.max(...allPts.map((p) => p[1]))
  const maxPts = Math.max(...glyphs.map((g) => g.contours.flat().length)), maxCont = Math.max(...glyphs.map((g) => g.contours.length))

  const head = Buffer.concat([u32(0x00010000), u32(0x00010000), u32(0), u32(0x5f0f3cf5), u16(0x000b), u16(UPM), u32(0), u32(3_800_000_000), u32(0), u32(3_800_000_000), i16(xMin), i16(yMin), i16(xMax), i16(yMax), u16(0), u16(8), i16(2), i16(1), i16(0)])
  const hhea = Buffer.concat([u32(0x00010000), i16(ASC), i16(DESC), i16(100), u16(ADV), i16(LSB), i16(LSB), i16(xMax), i16(1), i16(0), i16(0), i16(0), i16(0), i16(0), i16(0), i16(0), u16(nG)])
  const maxp = Buffer.concat([u32(0x00010000), u16(nG), u16(maxPts), u16(maxCont), u16(0), u16(0), u16(1), u16(0), u16(0), u16(0), u16(0), u16(0), u16(0), u16(0), u16(0)])
  const hmtx = Buffer.concat(glyphs.map((g) => Buffer.concat([u16(g.adv), i16(g.contours.length ? Math.min(...g.contours.flat().map((p) => p[0])) : 0)])))
  // cmap formato 4 (BMP)
  const sorted = glyphs.slice(1).map((g, i) => ({ cp: g.cp, gid: i + 1 })).sort((a, b) => a.cp - b.cp)
  const segs: Array<{ start: number; end: number; delta: number }> = []
  for (const { cp, gid } of sorted) { const last = segs.at(-1); if (last && cp === last.end + 1 && (gid - cp) % 65536 === last.delta) last.end = cp; else segs.push({ start: cp, end: cp, delta: (gid - cp) & 0xffff }) }
  segs.push({ start: 0xffff, end: 0xffff, delta: 1 })
  const sc = segs.length
  const search = 2 ** Math.floor(Math.log2(sc))
  const f4 = Buffer.concat([u16(4), u16(16 + sc * 8), u16(0), u16(sc * 2), u16(search * 2), u16(Math.log2(search)), u16(sc * 2 - search * 2), ...segs.map((s) => u16(s.end)), u16(0), ...segs.map((s) => u16(s.start)), ...segs.map((s) => u16(s.delta)), ...segs.map(() => u16(0))])
  const cmap = Buffer.concat([u16(0), u16(1), u16(3), u16(1), u32(12), f4])
  const str = (s: string): Buffer => Buffer.from(s, 'utf16le').swap16()
  const names: Array<[number, string]> = [[1, family], [2, 'Regular'], [3, `${family} 1.0 (generado por tools/assets)`], [4, family], [5, 'Version 1.000'], [6, family.replace(/ /g, '')]]
  const strs = names.map(([, s]) => str(s))
  let so = 0
  const nameRecs = names.map(([id], i) => { const r = Buffer.concat([u16(3), u16(1), u16(0x409), u16(id), u16(strs[i].length), u16(so)]); so += strs[i].length; return r })
  const name = Buffer.concat([u16(0), u16(names.length), u16(6 + names.length * 12), ...nameRecs, ...strs])
  const os2 = Buffer.concat([u16(3), i16(600), u16(400), u16(5), u16(0), i16(600), i16(600), i16(0), i16(300), i16(600), i16(600), i16(0), i16(300), i16(50), i16(250), i16(0), Buffer.alloc(10), u32(1), u32(0), u32(0), u32(0), Buffer.from('SYND'), u16(0x40), u16(32), u16(0xffff), i16(ASC), i16(DESC), i16(100), u16(ASC), u16(-DESC), u32(1), u32(0), i16(500), i16(700), u16(0), u16(0), u16(0)])
  const post = Buffer.concat([u32(0x00030000), u32(0), i16(-100), i16(50), u32(1), u32(0), u32(0), u32(0), u32(0)])

  const tables: Array<[string, Buffer]> = [['OS/2', os2], ['cmap', cmap], ['glyf', Buffer.concat(glyf)], ['head', head], ['hhea', hhea], ['hmtx', hmtx], ['loca', loca], ['maxp', maxp], ['name', name], ['post', post]]
  tables.sort((a, b) => (a[0] < b[0] ? -1 : 1))
  // TTF
  const n = tables.length, sr = 16 * 2 ** Math.floor(Math.log2(n))
  let o = 12 + n * 16
  const dir: Buffer[] = [], body: Buffer[] = []
  for (const [tag, data] of tables) { dir.push(Buffer.concat([Buffer.from(tag), u32(checksum(data)), u32(o), u32(data.length)])); const p = pad4(data); body.push(p); o += p.length }
  let ttf = Buffer.concat([u32(0x00010000), u16(n), u16(sr), u16(Math.log2(sr / 16)), u16(n * 16 - sr), ...dir, ...body])
  const adj = (0xb1b0afba - checksum(ttf)) >>> 0
  const headIdx = tables.findIndex(([t]) => t === 'head')
  const headOff = 12 + n * 16 + body.slice(0, headIdx).reduce((s, b) => s + b.length, 0)
  ttf.writeUInt32BE(adj, headOff + 8)
  tables[headIdx][1].writeUInt32BE(adj, 8)
  // WOFF (zlib por tabla)
  let wo = 44 + n * 20
  const wdir: Buffer[] = [], wbody: Buffer[] = []
  for (const [tag, data] of tables) { const z = deflateSync(data, { level: 9 }); const use = z.length < data.length ? z : data; wdir.push(Buffer.concat([Buffer.from(tag), u32(wo), u32(use.length), u32(data.length), u32(checksum(data))])); const p = pad4(use); wbody.push(p); wo += p.length }
  const woff = Buffer.concat([Buffer.from('wOFF'), u32(0x00010000), u32(wo), u16(n), u16(0), u32(ttf.length), u16(1), u16(0), u32(0), u32(0), u32(0), u32(0), u32(0), ...wdir, ...wbody])
  // WOFF2: tablas sin transformar en un único flujo Brotli
  const KNOWN = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep']
  const base128 = (v: number): Buffer => { const bytes = [v & 0x7f]; v >>>= 7; while (v) { bytes.unshift((v & 0x7f) | 0x80); v >>>= 7 } return Buffer.from(bytes) }
  const t2 = tables // mismo orden que el fichero sfnt (por etiqueta)
  const w2dir = t2.map(([tag, data]) => { const idx = KNOWN.indexOf(tag); const flags = idx | ((tag === 'glyf' || tag === 'loca' ? 3 : 0) << 6); return Buffer.concat([Buffer.from([flags]), base128(data.length)]) })
  const stream = brotliCompressSync(Buffer.concat(t2.map(([, d]) => d)))
  const hdrLen = 48 + w2dir.reduce((s, b) => s + b.length, 0)
  const padding = Buffer.alloc((4 - ((hdrLen + stream.length) % 4)) % 4) // el fichero WOFF2 debe medir un múltiplo de 4 bytes
  const total = hdrLen + stream.length + padding.length
  const woff2 = Buffer.concat([Buffer.from('wOF2'), u32(0x00010000), u32(total), u16(t2.length), u16(0), u32(ttf.length), u32(stream.length), u16(1), u16(0), u32(0), u32(0), u32(0), u32(0), u32(0), ...w2dir, stream, padding])
  ttf = ttf
  return { ttf, woff, woff2 }
}
