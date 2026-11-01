import { glyphRows } from './font5x7.ts'

/** Constructor mínimo de SVG (vectorial: escala sin pixelarse) con texto en forma de trazos a partir de la fuente 5×7. */
export const PAL = {
  bg: '#031a00', bg2: '#052a02', grid: '#0a3a05', panel: '#093a03', panel2: '#0d4a06', line: '#1f7a10', frame: '#61ff24', bright: '#8dff5a', dim: '#2f9a14', text: '#9cff6e', warn: '#ffd23a', red: '#ff5a3a', water: '#06310a',
} as const

export class Svg {
  private parts: string[] = []
  readonly w: number
  readonly h: number
  constructor(w = 320, h = 200) {
    this.w = w
    this.h = h
  }
  raw(s: string): this { this.parts.push(s); return this }
  rect(x: number, y: number, w: number, h: number, fill: string, stroke?: string, sw = 1): this {
    return this.raw(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`)
  }
  /** rectángulo con borde de 1 px dentro de sus límites (no se sale del recuadro) */
  box(x: number, y: number, w: number, h: number, fill: string, stroke: string): this {
    return this.rect(x + 0.5, y + 0.5, w - 1, h - 1, fill, stroke, 1)
  }
  path(d: string, fill: string): this { return this.raw(`<path d="${d}" fill="${fill}"/>`) }
  line(x1: number, y1: number, x2: number, y2: number, stroke: string, sw = 1): this {
    return this.raw(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"/>`)
  }
  /** texto con la fuente 5×7 como trazos vectoriales (sin depender de fuentes del sistema) */
  text(s: string, x: number, y: number, color: string, scale = 1): this {
    let d = ''
    for (let i = 0; i < s.length; i++)
      glyphRows(s.toUpperCase().charCodeAt(i)).forEach((r, yy) => {
        let xx = 0
        while (xx < 5) {
          if ((r >> (4 - xx)) & 1) { let n = 1; while (xx + n < 5 && (r >> (4 - xx - n)) & 1) n++; d += `M${x + (i * 6 + xx) * scale} ${y + yy * scale}h${n * scale}v${scale}h-${n * scale}z`; xx += n } else xx++
        }
      })
    return d ? this.path(d, color) : this
  }
  textWidth(s: string, scale = 1): number { return s.length * 6 * scale - scale }
  toString(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.w}" height="${this.h}" viewBox="0 0 ${this.w} ${this.h}" shape-rendering="crispEdges">${this.parts.join('')}</svg>`
  }
}

/**
 * Vectoriza una imagen indexada: un `<path>` por color con tramos horizontales fusionados verticalmente (cada píxel del diseño es un
 * cuadrado exacto: bordes nítidos a cualquier escala, sin suavizado y con tamaño de fichero muy pequeño). El índice 255 es transparente.
 */
export function rasterToSvg(px: Uint8Array, w: number, h: number, pal: ReadonlyArray<readonly [number, number, number]>, opts: { nearest?: boolean } = {}): string {
  const byColor = new Map<number, string>()
  let open = new Map<string, { x: number; w: number; y0: number; c: number }>()
  const flush = (r: { x: number; w: number; y0: number; c: number }, y1: number): void => {
    byColor.set(r.c, (byColor.get(r.c) ?? '') + `M${r.x} ${r.y0}h${r.w}v${y1 - r.y0}h-${r.w}z`)
  }
  for (let y = 0; y <= h; y++) {
    const next = new Map<string, { x: number; w: number; y0: number; c: number }>()
    if (y < h) {
      for (let x = 0; x < w; ) {
        const c = px[y * w + x]
        if (c === 255) { x++; continue }
        let n = 1
        while (x + n < w && px[y * w + x + n] === c) n++
        const k = `${c}:${x}:${n}`
        const prev = open.get(k)
        if (prev) { next.set(k, prev); open.delete(k) } else next.set(k, { x, w: n, y0: y, c })
        x += n
      }
    }
    for (const r of open.values()) flush(r, y)
    open = next
  }
  const hex = (c: readonly [number, number, number]): string => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
  const body = [...byColor].sort((a, b) => a[0] - b[0]).map(([c, d]) => `<path fill="${hex(pal[c] ?? [255, 0, 255])}" d="${d}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${body}</svg>`
}
