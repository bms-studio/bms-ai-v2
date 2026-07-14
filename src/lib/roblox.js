/* ============================================================
   Auralis AI v2 - Roblox Audio Upload helper
   Roblox Create API v1 (Open Cloud) for audio assets.
   Docs: https://create.roblox.com/docs/reference/cloud/assets
   ============================================================ */

import { EDIT_SONG } from '../config/endpoints.js'

/**
 * Validate a Roblox Open Cloud API Key with a lightweight usage probe.
 * Returns { ok: true } or { ok: false, error }.
 */
export async function validateRobloxApiKey(apiKey) {
  if (!apiKey || !apiKey.trim()) {
    return { ok: false, error: 'API key is required.' }
  }
  try {
    const res = await fetch('https://apis.roblox.com/cloud/v2/user/usage', {
      method: 'GET',
      headers: { 'x-api-key': apiKey.trim() }
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      let msg = `HTTP ${res.status}`
      try {
        const j = JSON.parse(t)
        if (j && j.message) msg = j.message
      } catch { /* keep status */ }
      return { ok: false, error: msg }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: 'Network: ' + (err.message || err) }
  }
}

/**
 * Read a File's duration using HTMLAudioElement.
 * Returns seconds (number) or null if not available.
 */
export function readAudioDuration(file) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file)
      const audio = new Audio()
      audio.preload = 'metadata'
      const cleanup = () => { try { URL.revokeObjectURL(url) } catch (_) {} }
      audio.onloadedmetadata = () => {
        const d = audio.duration
        cleanup()
        resolve(isFinite(d) ? d : null)
      }
      audio.onerror = () => { cleanup(); resolve(null) }
      audio.src = url
    } catch (_) {
      resolve(null)
    }
  })
}

/**
 * Validate a file against Roblox's limits (size + duration).
 * Returns { ok: true } or { ok: false, reason }.
 */
export async function validateAudioFile(file) {
  const { maxSizeMB, maxDurationSec } = EDIT_SONG.robloxLimits
  if (!file) return { ok: false, reason: 'No file provided.' }
  const supported = EDIT_SONG.formats.map(f => f.mime)
  // Some browsers report empty type for ogg; do a light extension check too.
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  const extOk = ['mp3', 'ogg', 'flac', 'wav'].includes(ext)
  if (file.type && !supported.includes(file.type) && !extOk) {
    return { ok: false, reason: `Format not supported by Roblox audio: ${file.type || ext}` }
  }
  const sizeMB = file.size / (1024 * 1024)
  if (sizeMB > maxSizeMB) {
    return { ok: false, reason: `File exceeds Roblox limit (${sizeMB.toFixed(1)}MB > ${maxSizeMB}MB).` }
  }
  const dur = await readAudioDuration(file)
  if (dur && dur > maxDurationSec) {
    return { ok: false, reason: `Duration exceeds Roblox limit (${dur.toFixed(1)}s > ${maxDurationSec}s).` }
  }
  return { ok: true, sizeMB, duration: dur }
}

/**
 * Upload an audio file to Roblox via Open Cloud Create API.
 * Endpoint: POST https://apis.roblox.com/assets/v1/assets
 *
 * Body: multipart/form-data
 *   - request:    JSON string with { assetType: 'Audio', displayName, description, creationContext: { creator: { userId: '...' } } }
 *   - fileContent: binary audio file
 *
 * Returns: { ok: true, assetId, operationId } or { ok: false, error, needsPolling }.
 * Note: Roblox returns 202 Accepted with an operationId that you poll
 * via GET https://apis.roblox.com/assets/v1/operations/{operationId}
 * to know if the moderation succeeded. The assetId is only available
 * after the operation is "Success".
 */
export async function uploadAudioToRoblox({
  apiKey,
  file,
  displayName,
  description = '',
  userId,
}) {
  if (!apiKey || !apiKey.trim()) throw new Error('API key is required.')
  if (!file) throw new Error('File is required.')
  if (!userId) throw new Error('Creator userId is required.')

  const requestBody = {
    assetType: 'Audio',
    displayName: (displayName || file.name || 'Auralis Upload').slice(0, 50),
    description: (description || '').slice(0, 200),
    creationContext: {
      creator: { userId: String(userId) },
    },
  }

  const fd = new FormData()
  fd.append('request', JSON.stringify(requestBody))
  fd.append('fileContent', file, file.name)

  const res = await fetch('https://apis.roblox.com/assets/v1/assets', {
    method: 'POST',
    headers: { 'x-api-key': apiKey.trim() },
    body: fd,
  })

  const text = await res.text()
  let parsed
  try { parsed = JSON.parse(text) } catch { parsed = null }

  if (res.status === 202 && parsed && parsed.path) {
    // Path looks like "operations/abc123..."  -- caller must poll
    const operationId = String(parsed.path).split('/').pop()
    return {
      ok: true,
      needsPolling: true,
      operationId,
      path: parsed.path,
    }
  }
  if (res.ok && parsed && parsed.assetId) {
    return { ok: true, needsPolling: false, assetId: String(parsed.assetId) }
  }
  // Error path
  let msg = `HTTP ${res.status}`
  if (parsed && parsed.message) msg = parsed.message
  else if (parsed && parsed.errors && parsed.errors[0]?.message) msg = parsed.errors[0].message
  else if (text) msg = text.slice(0, 200)
  throw new Error(msg)
}

/**
 * Poll an audio upload operation. Roblox moderation can take 30s-2min.
 * Returns { done: true, assetId } or { done: false, state } or throws.
 *
 * Possible "done" states: 'Success' -> assetId present, 'Failed'/'Cancelled' -> error.
 */
// Extract assetId from a Roblox operation response. The real Open Cloud API
// returns the asset path in `response.path` (a string like "assets/12345")
// while older docs show `response.assetId`. We support both, plus when the
// response itself IS a path string.
function _extractOpAssetId(data) {
  if (!data) return null
  const r = data.response
  if (r == null) return null
  // response is an object (newer shape): { path: "assets/<id>", assetId, ... }
  if (typeof r === 'object') {
    if (r.assetId) return String(r.assetId)
    if (typeof r.path === 'string') {
      const m = r.path.match(/assets\/(\d+)/i)
      if (m) return m[1]
    }
  }
  // response is a path string (e.g. "assets/12345")
  if (typeof r === 'string') {
    const m = r.match(/assets\/(\d+)/i)
    if (m) return m[1]
  }
  return null
}

// Extract error from a Roblox operation response (object shape only).
function _extractOpError(data) {
  if (!data) return null
  const r = data.response
  if (r && typeof r === 'object') {
    if (r.error && r.error.message) return r.error.message
    if (r.error && typeof r.error === 'string') return r.error
  }
  return null
}

export async function pollAudioOperation(apiKey, operationId, { timeoutMs = 180_000, intervalMs = 3000 } = {}) {
  const start = Date.now()
  // Pakai CORS proxy di server.js. Browser TIDAK bisa langsung GET ke
  // apis.roblox.com (sama seperti upload — CORS diblokir).
  const url = `/api/roblox/poll/${encodeURIComponent(operationId)}?apiKey=${encodeURIComponent(apiKey.trim())}`
  while (Date.now() - start < timeoutMs) {
    let res
    try {
      res = await fetch(url)
    } catch (err) {
      throw new Error('Network: ' + (err.message || err))
    }
    if (res.ok) {
      const payload = await res.json().catch(() => ({}))
      // Proxy membungkus: { success, data: { done, response, ... } }
      const data = (payload && payload.data) ? payload.data : (payload || {})
      if (data && data.done === true) {
        const assetId = _extractOpAssetId(data)
        if (assetId) {
          return { done: true, assetId }
        }
        // done but no assetId → either failed or still being processed
        const errMsg = _extractOpError(data) || data.error || data.state || 'Operation completed without assetId'
        return { done: true, failed: true, error: String(errMsg) }
      }
      // not done yet -- keep polling
    } else {
      // transient -- keep going unless we hit terminal
      const t = await res.text().catch(() => '')
      if (res.status === 404) {
        return { done: true, failed: true, error: 'Operation not found (it may have expired).' }
      }
      // For other errors keep polling briefly
      if (typeof console !== 'undefined') console.warn('[pollAudioOperation] status', res.status, t.slice(0, 120))
    }
    await new Promise(r => setTimeout(r, intervalMs))
  }
  return { done: false, state: 'Timeout' }
}

/**
 * Try to extract an audio URL from a Synox all-in-one response, since the
 * "all-site downloader" returns media metadata.
 *
 * Returns { url, filename } or null when nothing is found.
 */
export function pickAudioFromSynox(data) {
  if (!data || typeof data !== 'object') return null
  // Common shapes used by Synox/Rabbyt-style downloaders.
  const candidates = []
  const push = (v) => { if (typeof v === 'string') candidates.push(v) }

  // result.data can be an object or array
  const r = data.result
  if (r) {
    if (typeof r === 'string') push(r)
    if (Array.isArray(r)) {
      r.forEach(item => {
        if (!item) return
        if (typeof item === 'string') push(item)
        if (item.url) push(item.url)
        if (item.download_url) push(item.download_url)
        if (Array.isArray(item.medias)) {
          item.medias.forEach(m => {
            if (m && typeof m.url === 'string' && /audio|video|\.m3u8/i.test(m.url + (m.formatId || '') + (m.type || ''))) {
              push(m.url)
            }
          })
        }
        if (item.audio) push(item.audio)
      })
    }
    if (typeof r === 'object') {
      push(r.url); push(r.download_url); push(r.audio); push(r.link)
      if (Array.isArray(r.medias)) {
        r.medias.forEach(m => {
          if (m && typeof m.url === 'string') {
            const isAudio =
              (m.type && /audio/i.test(m.type)) ||
              (m.format && /audio|mp3|ogg|m4a|wav/i.test(m.format)) ||
              /\.(mp3|m4a|ogg|wav|flac)(\?|$)/i.test(m.url)
            if (isAudio) push(m.url)
          }
        })
      }
    }
  }
  // data.data fallbacks
  if (data.data && typeof data.data === 'object') {
    push(data.data.url); push(data.data.audio); push(data.data.download_url)
  }
  if (data.url) push(data.url)
  if (data.download_url) push(data.download_url)

  const found = candidates.find(u => /^https?:\/\//i.test(u) && /\.(mp3|m4a|ogg|wav|flac|aac|opus|mp4|m3u8)/i.test(u))
  if (found) {
    const name = found.split('/').pop().split('?')[0] || 'audio.mp3'
    return { url: found, filename: name }
  }
  return null
}

/**
 * Build the Synox all-in-one URL for a given target.
 * Used by the Edit Song page so the user can paste a YouTube/TikTok link
 * and we resolve it to a downloadable audio file.
 */
export function buildSynoxDownloadUrl(targetUrl) {
  const base = EDIT_SONG.downloader.base + EDIT_SONG.downloader.path
  return `${base}?${EDIT_SONG.downloader.param}=${encodeURIComponent(targetUrl)}`
}