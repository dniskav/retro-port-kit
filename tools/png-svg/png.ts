import { deflateSync } from 'node:zlib'

function crc32(buf: Uint8Array): number {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return ~c >>> 0
}
function chunk(type: string, body: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + body.length)
  out.writeUInt32BE(body.length, 0)
  out.write(type, 4, 'ascii')
  Buffer.from(body).copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length)
  return out
}

/** PNG RGBA de 8 bits (sin filtro: reproducible byte a byte) */
export function encodeRgba(w: number, h: number, rgba: Uint8Array): Buffer {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', new Uint8Array(0))])
}

/** PNG «indexado» del motor: RGBA con R = índice de paleta y A = 255 (opaco) o 0 (índice 255 = transparente) */
export function encodeIndexed(w: number, h: number, px: Uint8Array): Buffer {
  const rgba = new Uint8Array(w * h * 4)
  for (let i = 0; i < px.length; i++) {
    const t = px[i] === 255
    rgba[i * 4] = t ? 0 : px[i]
    rgba[i * 4 + 3] = t ? 0 : 255
  }
  return encodeRgba(w, h, rgba)
}

/** colorea una imagen indexada con una paleta */
export function colorize(w: number, h: number, px: Uint8Array, pal: ReadonlyArray<readonly [number, number, number]>): Buffer {
  const rgba = new Uint8Array(w * h * 4)
  for (let i = 0; i < px.length; i++) {
    if (px[i] === 255) continue
    const c = pal[px[i]] ?? [255, 0, 255]
    rgba.set([c[0], c[1], c[2], 255], i * 4)
  }
  return encodeRgba(w, h, rgba)
}

/** PNG de grises de 8 bits (mapas de tiles) */
export function encodeGray(w: number, h: number, px: Uint8Array): Buffer {
  const raw = Buffer.alloc((w + 1) * h)
  for (let y = 0; y < h; y++) Buffer.from(px.buffer, px.byteOffset + y * w, w).copy(raw, y * (w + 1) + 1)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 0
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', new Uint8Array(0))])
}
