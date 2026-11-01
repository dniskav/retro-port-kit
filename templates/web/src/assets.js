// Asset loading with loud failures: a missing file is an error, not an empty sprite.
export async function loadManifest(url, onProgress = () => {}) {
  const res = await fetch(url, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`manifest ${url}: HTTP ${res.status}`)
  const manifest = await res.json()
  const entries = Object.entries(manifest.assets ?? {})
  const out = {}
  let done = 0
  for (const [name, entry] of entries) {
    const value = entry.type === 'audio' ? await loadAudio(entry.url) : await loadImage(entry.url)
    out[name] = value
    onProgress(++done, entries.length)
  }
  return out
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`image ${url}: failed to decode`))
    img.src = url
  })
}

export async function loadAudio(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`audio ${url}: HTTP ${res.status}`)
  return res.arrayBuffer()
}
