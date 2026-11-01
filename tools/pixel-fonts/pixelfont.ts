import { glyphRows } from './font5x7.ts'

/**
 * Fuente de píxel propia completa: ASCII + Latin-1 (acentos compuestos sobre las letras base) + símbolos de la página de códigos del juego.
 * Cada glifo = filas de 5 bits (bit 4 = columna izquierda) con la fila 0 en la parte superior de las mayúsculas;
 * `y0` es la fila de la primera fila del arreglo (negativo = hay acento por encima; 7 = fila de descendente).
 */
export interface PGlyph { rows: number[]; y0: number }

const bin = (rows: string[]): number[] => rows.map((r) => parseInt(r.replace(/[.\s]/g, '0').replace(/#/g, '1'), 2))

/** filas 0..7 del glifo ASCII (la fila 7 es la de descendentes de g, j, p, q, y) */
function asciiRows(code: number): number[] {
  const rows = glyphRows(code).slice()
  while (rows.length < 7) rows.push(0)
  return rows
}
// descendentes: la tabla 5×7 original las trunca; se redibujan g j p q y con cola en la fila 7
const DESC: Record<string, string[]> = {
  g: ['.....', '.....', '.###.', '#...#', '#...#', '.####', '....#', '.###.'],
  j: ['...#.', '.....', '..##.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  p: ['.....', '.....', '####.', '#...#', '#...#', '####.', '#....', '#....'],
  q: ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#', '....#'],
  y: ['.....', '.....', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
}
const EXPLICIT: Record<string, string[]> = {
  '¢': ['..#..', '.###.', '#.#.#', '#.#..', '#.#.#', '.###.', '..#..'],
  '£': ['..##.', '.#..#', '.#...', '###..', '.#...', '.#...', '#####'],
  '¥': ['#...#', '.#.#.', '..#..', '#####', '..#..', '#####', '..#..'],
  '₧': ['####.', '#..#.', '####.', '#.###', '#..#.', '#..#.', '#..#.'],
  ƒ: ['..##.', '.#...', '.#...', '####.', '.#...', '.#...', '#....'],
  ª: ['.###.', '....#', '.####', '#...#', '.####', '.....', '#####'],
  º: ['.###.', '#...#', '#...#', '#...#', '.###.', '.....', '#####'],
  ß: ['..##.', '.#..#', '.#.#.', '.#..#', '.#..#', '.#.#.', '#.#..'],
  '€': ['..##.', '.#..#', '####.', '#....', '####.', '.#..#', '..##.'],
  '·': ['.....', '.....', '.....', '..#..', '.....', '.....', '.....'],
  '°': ['.##..', '.##..', '.....', '.....', '.....', '.....', '.....'],
  '±': ['..#..', '..#..', '#####', '..#..', '..#..', '.....', '#####'],
  '×': ['.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '.....'],
  '÷': ['..#..', '.....', '#####', '.....', '..#..', '.....', '.....'],
  '«': ['.....', '..#.#', '.#.#.', '#.#..', '.#.#.', '..#.#', '.....'],
  '»': ['.....', '#.#..', '.#.#.', '..#.#', '.#.#.', '#.#..', '.....'],
  '¡': ['..#..', '.....', '..#..', '..#..', '..#..', '..#..', '..#..'],
  '¿': ['..#..', '.....', '..#..', '..#..', '.#...', '#...#', '.###.'],
  '©': ['.###.', '#...#', '#.#.#', '#.#.#', '#...#', '.###.', '.....'],
  '®': ['.###.', '#...#', '#.#.#', '#.##.', '#.#.#', '.###.', '.....'],
  Æ: ['..###', '.#.#.', '#..#.', '#####', '#..#.', '#..#.', '#..##'],
  æ: ['.....', '.....', '##.#.', '..#.#', '#####', '#.#..', '.####'],
}
/** marcas diacríticas: [fila −2, fila −1] (acento sobre mayúscula) */
const MARK: Record<string, [string, string]> = {
  '̀': ['.#...', '..#..'], '́': ['...#.', '..#..'], '̂': ['..#..', '.#.#.'], '̃': ['..#.#', '.#.#.'], '̈': ['.....', '.#.#.'], '̊': ['..#..', '.#.#.'],
}

const cache = new Map<number, PGlyph | null>()

/** glifo para el punto de código `cp` (null si no hay) */
export function pglyph(cp: number): PGlyph | null {
  if (cache.has(cp)) return cache.get(cp)!
  const ch = String.fromCodePoint(cp)
  let g: PGlyph | null = null
  if (cp === 32 || cp === 160) g = { rows: [0, 0, 0, 0, 0, 0, 0], y0: 0 }
  else if (EXPLICIT[ch]?.length) g = { rows: bin(EXPLICIT[ch]), y0: 0 }
  else if (DESC[ch]) g = { rows: bin(DESC[ch]), y0: 0 }
  else if (cp > 32 && cp < 127) g = { rows: asciiRows(cp), y0: 0 }
  else {
    const d = ch.normalize('NFD')
    if (d.length === 2 && MARK[d[1]] !== undefined) {
      const base = pglyph(d.codePointAt(0)!)
      if (base) {
        const rows = base.rows.slice()
        const isUpper = d[0] !== d[0].toLowerCase()
        const m = MARK[d[1]]
        if (isUpper || /[bdfhklt]/.test(d[0])) g = { rows: [...bin(m), ...rows], y0: -2 }
        else {
          // minúscula de altura x: el acento ocupa las filas −1 y 0 y deja libre la fila 1 (sin tocar la letra); la «i» pierde su punto
          const r = rows.slice()
          if (d[0] === 'i') r[2] = 0
          g = { rows: [...bin(m), ...r.slice(1)], y0: -1 }
        }
      }
    } else if (d.length === 2 && d[1] === '̧') {
      const base = pglyph(d.codePointAt(0)!)
      if (base) g = { rows: [...base.rows, 0b00100, 0b01100].slice(0, base.rows.length + 1).concat(base.rows.length === 7 ? [] : []), y0: base.y0 }
      if (g) g.rows[g.rows.length - 1] = 0b00100
    }
  }
  cache.set(cp, g)
  return g
}

/** puntos de código cubiertos: ASCII imprimible + Latin-1 + símbolos */
export function coveredCodepoints(): number[] {
  const out: number[] = []
  for (let cp = 32; cp <= 0xff; cp++) if (cp !== 127 && pglyph(cp)) out.push(cp)
  for (const cp of [0x20ac, 0x20a7, 0x0192]) if (pglyph(cp)) out.push(cp)
  return out
}

/** variante pequeña de 5 filas de altura de mayúscula: se fusionan las filas (1,2) y (4,5) para conservar las barras de A, E, B, R… */
export function pglyphSmall(cp: number): PGlyph | null {
  const g = pglyph(cp)
  if (!g) return null
  const i = -g.y0
  const r = g.rows.slice(0, 7 - g.y0)
  if (r.length < 7 + i) return { rows: r, y0: g.y0 } // espacio y similares
  return { rows: [...r.slice(0, i), r[i], r[i + 1] | r[i + 2], r[i + 3], r[i + 4] | r[i + 5], r[i + 6]], y0: g.y0 }
}
