// src/lib/metadata.js
// Mini metadata reader untuk file audio MP3.
// Yang kita butuhkan:
//   - Cover art (frame APIC ID3v2)
//   - Title + artist (frame TITLE / TPE1 / TPE2 / TALB) sebagai fallback
// Kita TIDAK depend ke jsmediatags karena bundle-nya UMD dan bikin
// Vite gagal resolve. Implementasi ID3v2-nya kecil dan cukup robust
// untuk kasus penggunaan kita (MP3 + ID3v2.3 / v2.4).
//
// ID3v2 spec: https://id3.org/id3v2.3.0
// Header (10 bytes):
//   "ID3" (3)  version (2)  flags (1)  size (4, synchsafe)
// Each frame (>= 10 bytes header + body):
//   id (4 ASCII)  size (4)  flags (2)  body...
// APIC frame body:
//   text encoding (1)  MIME type (null-terminated)  picture type (1)
//   description (null-terminated)  picture data
//
// Text frame body:
//   text encoding (1)  text (null-terminated)

const ID3_HEADER = [0x49, 0x44, 0x33] // "ID3"

function readSync(view, offset) {
  return (
    ((view[offset] & 0x7f) << 21) |
    ((view[offset + 1] & 0x7f) << 14) |
    ((view[offset + 2] & 0x7f) << 7) |
     (view[offset + 3] & 0x7f)
  )
}

/**
 * Cari frame di header ID3v2 berdasarkan 4-char id.
 * Return { data: Uint8Array, encoding: number } atau null.
 */
function findFrame(view, tagSize, frameIdStr) {
  const id0 = frameIdStr.charCodeAt(0)
  const id1 = frameIdStr.charCodeAt(1)
  const id2 = frameIdStr.charCodeAt(2)
  const id3 = frameIdStr.charCodeAt(3)
  let pos = 10
  const end = Math.min(10 + tagSize, view.length)
  while (pos + 10 <= end) {
    if (
      view[pos] !== id0 || view[pos + 1] !== id1 ||
      view[pos + 2] !== id2 || view[pos + 3] !== id3
    ) {
      // bukan frame yang kita cari; bisa null padding atau frame lain
      // Tetap skip via size; kalau id mengandung null kita break.
      if (view[pos] === 0) return null
      const sz = (view[pos + 4] << 24) | (view[pos + 5] << 16) | (view[pos + 6] << 8) | view[pos + 7]
      if (sz <= 0) return null
      pos += 10 + sz
      continue
    }
    const frameSize =
      (view[pos + 4] << 24) | (view[pos + 5] << 16) | (view[pos + 6] << 8) | view[pos + 7]
    if (frameSize <= 0 || pos + 10 + frameSize > end) return null
    const enc = view[pos + 10]
    const data = view.subarray(pos + 11, pos + 10 + frameSize)
    return { data, encoding: enc }
  }
  return null
}

function decodeText(data, enc) {
  if (!data || data.length === 0) return ''
  try {
    if (enc === 0) {
      // ISO-8859-1: hilangkan null terminator kalau ada
      let end = data.length
      if (data[end - 1] === 0) end -= 1
      return new TextDecoder('iso-8859-1').decode(data.subarray(0, end))
    }
    if (enc === 1) {
      // UTF-16 with BOM
      if (data[0] === 0xfe && data[1] === 0xff) {
        let end = data.length
        if (end >= 2 && data[end - 2] === 0 && data[end - 1] === 0) end -= 2
        return new TextDecoder('utf-16be').decode(data.subarray(2, end))
      }
      if (data[0] === 0xff && data[1] === 0xfe) {
        let end = data.length
        if (end >= 2 && data[end - 2] === 0 && data[end - 1] === 0) end -= 2
        return new TextDecoder('utf-16le').decode(data.subarray(2, end))
      }
      return new TextDecoder('utf-16').decode(data)
    }
    if (enc === 2) {
      let end = data.length
      if (end >= 2 && data[end - 2] === 0 && data[end - 1] === 0) end -= 2
      return new TextDecoder('utf-16be').decode(data.subarray(0, end))
    }
    if (enc === 3) {
      let end = data.length
      if (data[end - 1] === 0) end -= 1
      return new TextDecoder('utf-8').decode(data.subarray(0, end))
    }
  } catch {
    return ''
  }
  return ''
}

/**
 * Baca title + artist dari ID3v2.
 * @param {File|Blob} file
 * @returns {Promise<{title?:string, artist?:string}>}
 */
export async function readID3Basic(file) {
  const out = {}
  try {
    const headerSlice = file.slice(0, Math.min(file.size, 1024 * 1024))
    const buf = await headerSlice.arrayBuffer()
    const view = new Uint8Array(buf)
    if (
      view.length < 10 || view[0] !== 0x49 || view[1] !== 0x44 || view[2] !== 0x33
    ) return out
    const tagSize = readSync(view, 6)
    // title -> frame "TIT2"
    const t1 = findFrame(view, tagSize, 'TIT2')
    if (t1) {
      const t = decodeText(t1.data, t1.encoding)
      if (t) out.title = t
    }
    // artist -> "TPE1", fallback "TPE2"
    let a1 = findFrame(view, tagSize, 'TPE1')
    if (!a1) a1 = findFrame(view, tagSize, 'TPE2')
    if (a1) {
      const t = decodeText(a1.data, a1.encoding)
      if (t) out.artist = t
    }
    if (file.size > 1024 * 1024) {
      // mungkin tag lebih besar dari 1 MB; ulangi dengan full read
      const fullBuf = await file.arrayBuffer()
      const v2 = new Uint8Array(fullBuf)
      if (
        v2.length >= 10 && v2[0] === 0x49 && v2[1] === 0x44 && v2[2] === 0x33
      ) {
        const ts2 = readSync(v2, 6)
        if (!out.title) {
          const t = findFrame(v2, ts2, 'TIT2')
          if (t) {
            const s = decodeText(t.data, t.encoding)
            if (s) out.title = s
          }
        }
        if (!out.artist) {
          let t = findFrame(v2, ts2, 'TPE1')
          if (!t) t = findFrame(v2, ts2, 'TPE2')
          if (t) {
            const s = decodeText(t.data, t.encoding)
            if (s) out.artist = s
          }
        }
      }
    }
  } catch { /* ignore */ }
  return out
}

/**
 * Cari frame APIC dan return { data: Uint8Array, type: string (mime) } atau null.
 * @param {File|Blob} file
 */
export async function readID3Cover(file) {
  try {
    const headerSlice = file.slice(0, Math.min(file.size, 1024 * 1024))
    const buf = await headerSlice.arrayBuffer()
    const view = new Uint8Array(buf)
    if (
      view.length < 10 || view[0] !== 0x49 || view[1] !== 0x44 || view[2] !== 0x33
    ) return null
    const tagSize = readSync(view, 6)
    const pos = findFramePos(view, tagSize, 'APIC')
    if (pos == null && file.size > 1024 * 1024) {
      const fullBuf = await file.arrayBuffer()
      const v2 = new Uint8Array(fullBuf)
      const ts2 = readSync(v2, 6)
      const p2 = findFramePos(v2, ts2, 'APIC')
      if (p2 == null) return null
      return parseApicFrame(v2, p2)
    }
    if (pos == null) return null
    return parseApicFrame(view, pos)
  } catch {
    return null
  }
}

function findFramePos(view, tagSize, frameIdStr) {
  const id0 = frameIdStr.charCodeAt(0)
  const id1 = frameIdStr.charCodeAt(1)
  const id2 = frameIdStr.charCodeAt(2)
  const id3 = frameIdStr.charCodeAt(3)
  let pos = 10
  const end = Math.min(10 + tagSize, view.length)
  while (pos + 10 <= end) {
    if (
      view[pos] === id0 && view[pos + 1] === id1 &&
      view[pos + 2] === id2 && view[pos + 3] === id3
    ) {
      const frameSize =
        (view[pos + 4] << 24) | (view[pos + 5] << 16) | (view[pos + 6] << 8) | view[pos + 7]
      if (frameSize <= 0 || pos + 10 + frameSize > end) return null
      return pos
    }
    if (view[pos] === 0) return null
    const sz = (view[pos + 4] << 24) | (view[pos + 5] << 16) | (view[pos + 6] << 8) | view[pos + 7]
    if (sz <= 0) return null
    pos += 10 + sz
  }
  return null
}

function parseApicFrame(view, pos) {
  const frameSize =
    (view[pos + 4] << 24) | (view[pos + 5] << 16) | (view[pos + 6] << 8) | view[pos + 7]
  const frameEnd = pos + 10 + frameSize
  let p = pos + 10
  const enc = view[p]; p += 1
  // MIME type ASCII null-terminated
  const mimeEnd = view.indexOf(0, p)
  if (mimeEnd < 0 || mimeEnd >= frameEnd) return null
  const mime = new TextDecoder('ascii').decode(view.subarray(p, mimeEnd)) || 'image/jpeg'
  p = mimeEnd + 1
  // Picture type (1 byte)
  p += 1
  // Description null-terminated
  let descEnd = p
  if (enc === 1 || enc === 2) {
    while (descEnd + 1 < frameEnd) {
      if (view[descEnd] === 0 && view[descEnd + 1] === 0) break
      descEnd += 2
    }
    p = descEnd + 2
  } else {
    while (descEnd < frameEnd && view[descEnd] !== 0) descEnd += 1
    p = descEnd + 1
  }
  const data = view.subarray(p, frameEnd)
  if (data.length === 0) return null
  return { data, type: mime }
}

/**
 * Hitung durasi (detik) dari sebuah audio source URL/Blob pakai HTMLAudioElement.
 * @param {string} url
 * @returns {Promise<number>} durasi dalam detik (0 kalau gagal)
 */
export function readAudioDuration(url) {
  return new Promise((resolve) => {
    const a = new Audio()
    a.preload = 'metadata'
    a.onloadedmetadata = () => {
      const d = isFinite(a.duration) ? a.duration : 0
      resolve(d)
    }
    a.onerror = () => resolve(0)
    a.src = url
  })
}

/**
 * Format detik ke "m:ss" atau "h:mm:ss".
 */
export function formatDuration(seconds) {
  if (!isFinite(seconds) || seconds <= 0) return '0:00'
  const s = Math.floor(seconds % 60).toString().padStart(2, '0')
  const m = Math.floor((seconds / 60) % 60).toString()
  const h = Math.floor(seconds / 3600)
  if (h > 0) return `${h}:${m.padStart(2, '0')}:${s}`
  return `${m}:${s}`
}