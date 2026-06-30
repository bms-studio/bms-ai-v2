/* ============================================================
   Auralis AI v2 - API client
   Wraps fetch with timeouts, JSON heuristics, and error normalization.
   ============================================================ */

import { XYLO_BASE, SYNOX_BASE } from '../config/endpoints.js'
import { fileToURL, copyText } from './utils.js'

// Re-export common utils so pages can import everything from one place.
export { fileToURL, copyText }

const DEFAULT_TIMEOUT = 90_000 // 90s

async function fetchWithTimeout(url, opts = {}, timeout = DEFAULT_TIMEOUT) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal })
    return res
  } finally {
    clearTimeout(t)
  }
}

function pickField(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

/**
 * Strip Xylo/raw JSON noise from an error string so we never leak
 * envelopes like {"success":false,"creator":"XyloAPI","error":"..."} to the UI.
 * If the input is JSON we return '' (callers fall back to a friendly message).
 */
function cleanError(s) {
  if (!s) return ''
  const t = String(s).trim()
  if (!t) return ''
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const o = JSON.parse(t)
      if (o && typeof o === 'object') {
        return '' // generic HTTP fallback, do not leak envelope
      }
    } catch { /* not JSON, keep going */ }
  }
  // Defensive: if upstream text happens to contain the Xylo envelope, hide it.
  if (/creator["']?\s*:\s*["']XyloAPI/i.test(t)) return ''
  return t.slice(0, 200)
}

/**
 * Generic POST to a xylo endpoint: {XYLO_BASE}{path} with JSON body.
 * Returns the parsed body (object) or throws an Error with a useful message.
 */
export async function postXylo(path, body, { headers = {}, timeout } = {}) {
  const url = `${XYLO_BASE}${path}`
  let res
  try {
    res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body ?? {})
    }, timeout)
  } catch (err) {
    throw new Error('Network: ' + (err.message || err))
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(cleanError(t) || `HTTP ${res.status}`)
  }
  const raw = await res.text()
  let parsed
  try { parsed = JSON.parse(raw) } catch { return raw }
  // Xylo endpoints return { success, data, ... } envelope.
  // When success is false, throw a sanitized error message; otherwise return inner data.
  if (parsed && typeof parsed === 'object' && 'success' in parsed) {
    if (parsed.success === false) {
      // Keep the raw payload for debugging in console, but expose a clean message.
      if (typeof console !== 'undefined') console.warn('[postXylo] upstream error:', parsed)
      throw new Error('Upstream service is currently unavailable. Please try again later.')
    }
    return parsed.data !== undefined ? parsed.data : parsed
  }
  return parsed
}

/** Build a query string from a plain object. */
function qs(obj) {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue
    u.set(k, String(v))
  }
  return u.toString()
}

/** GET with query string. */
export async function getUrl(url, params = {}, opts = {}) {
  const final = params && Object.keys(params).length ? `${url}?${qs(params)}` : url
  let res
  try {
    res = await fetchWithTimeout(final, { method: 'GET' }, opts.timeout)
  } catch (err) {
    throw new Error('Network: ' + (err.message || err))
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(cleanError(t) || `HTTP ${res.status}`)
  }
  const raw = await res.text()
  try { return JSON.parse(raw) } catch { return raw }
}

/**
 * GET request to a Synox endpoint.
 * Accepts a full URL OR a path (will be prefixed with SYNOX_BASE).
 * Returns the parsed body (or raw text). Throws on network/HTTP error.
 */
export async function getSynox(urlOrPath, params = {}, opts = {}) {
  const url = urlOrPath.startsWith('http')
    ? urlOrPath
    : `${SYNOX_BASE}${urlOrPath.startsWith('/') ? '' : '/'}${urlOrPath}`
  return getUrl(url, params, opts)
}

/**
 * All-in-One downloader. Returns the parsed payload from the API,
 * or throws a friendly error if the upstream service is down.
 */
export async function allInOneDownload(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.trim()) {
    throw new Error('Please paste a valid URL to download.')
  }
  const data = await getSynox('/download/all-in-one', { url: targetUrl.trim() }, { timeout: 120_000 })
  // Synox returns { status, result: {...} or false, creator, ... }
  if (data && typeof data === 'object' && 'status' in data) {
    if (data.status === true) return data
    if (data.status === false) {
      throw new Error(typeof data.result === 'string' ? data.result : 'Upstream service is currently unavailable. Please try again later.')
    }
  }
  return data
}

/** Read a Blob as a base64 data URL (no external deps). */
export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error || new Error('FileReader failed'))
    r.readAsDataURL(file)
  })
}

/** Pull a URL out of a heterogeneous API response. */
export function extractUrl(data, dotted = 'data.url') {
  if (typeof data === 'string') {
    if (/^https?:\/\//i.test(data)) return data
    return ''
  }
  if (!data || typeof data !== 'object') return ''
  const v = pickField(data, dotted)
  if (typeof v === 'string' && /^https?:\/\//i.test(v)) return v
  // Common fallbacks
  const cands = [
    data.url, data.image, data.result, data.data?.url, data.data?.image,
    data.result?.url, data.result?.image, data.download_url
  ]
  for (const c of cands) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c
  }
  return ''
}

/** Upload an image file by sending it as base64 data URL under `image` key. */
export async function uploadImage(endpoint, file) {
  const dataUrl = await fileToDataURL(file)
  return postXylo(endpoint.path, { image: dataUrl })
}

/** Generate an image (Synox GET). */
export async function generateImageSynox(prompt, ratio = '1:1') {
  return getUrl(SYNOX_BASE + '/ai-generate/text-2-image', { prompt, ratio })
}

/** Generate an image (Qwen POST). */
export async function generateImageQwen(prompt, aspect_ratio = '1:1') {
  return postXylo('/api/ai-image/qwenimage', { prompt, aspect_ratio })
}

/**
 * AI chat - primary via Synox Cloud (works reliably), with Xylo fallback.
 * Synox endpoint: GET {SYNOX_BASE}/ai-chat/{modelId}?pesan={prompt}
 *   Response shape: { status: true, result: { reply: "..." }, creator, timestamp }
 */
export async function aiChatXylo(modelId, prompt, systemPrompt = '') {
  const sys = systemPrompt ? systemPrompt.trim() + '\n\n' : ''
  const fullPrompt = sys + prompt

  // Primary: Synox (GET with ?pesan=)
  try {
    const url = `${SYNOX_BASE}/ai-chat/${encodeURIComponent(modelId)}?pesan=${encodeURIComponent(fullPrompt)}`
    const res = await fetchWithTimeout(url, { method: 'GET' })
    if (res.ok) {
      const raw = await res.text()
      try {
        const data = JSON.parse(raw)
        if (data && data.status === true && data.result && typeof data.result.reply === 'string') {
          return data.result.reply.trim()
        }
      } catch (_) { /* fall through */ }
    }
  } catch (_) { /* fall through to Xylo */ }

  // Fallback: Xylo POST (may not work if Xylo API is down for this endpoint)
  try {
    const data = await postXylo(`/api/ai-chat/${encodeURIComponent(modelId)}`, {
      message: fullPrompt,
      prompt: fullPrompt,
      text: fullPrompt
    })
    if (typeof data === 'string') return data
    const cands = [
      data?.reply, data?.text, data?.response, data?.answer, data?.message,
      data?.content, data?.output, data?.result?.reply, data?.result?.text,
      data?.data?.reply, data?.data?.text, data?.data?.response,
      data?.data?.answer, data?.data?.message, data?.data?.content
    ]
    for (const c of cands) if (typeof c === 'string' && c.trim()) return c.trim()
    if (Array.isArray(data?.choices)) {
      const c = data.choices[0]?.message?.content || data.choices[0]?.text
      if (typeof c === 'string' && c.trim()) return c.trim()
    }
  } catch (_) { /* fall through */ }

  throw new Error('AI service unavailable. Please try again.')
}
