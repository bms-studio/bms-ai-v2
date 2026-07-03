// src/lib/uploadApi.js
// Upload audio LANGSUNG dari browser ke Roblox Open Cloud API.
// Tidak butuh backend proxy, tidak butuh .ROBLOSECURITY cookie.
// User cukup punya API Key dari
//   https://create.roblox.com/dashboard/credentials
// dengan scope "Audio API" → di-paste sekali lalu disimpan di localStorage.
//
// Endpoint: POST https://apis.roblox.com/assets/v1/assets
//   Header : x-api-key: <KEY>
//   Body   : multipart/form-data
//     - request     : JSON.stringify({ displayName, description, assetType: "Audio",
//                                     creationContext: { creator: { userId } } })
//     - fileContent : binary audio
//   Response: { path: "assets/<assetId>", assetId, ... } (atau operations endpoint
//              untuk audio yang perlu moderasi)
//
// CORS: apis.roblox.com support CORS untuk credential-less (api-key) request.

import { ROBLOX_OPEN_CLOUD } from '../config/endpoints.js'
import { pollAudioOperation } from './roblox.js'

const API_KEY_STORAGE = 'bms.roblox.apiKey'
const USER_ID_STORAGE = 'bms.roblox.userId'

// Untuk audio "music" (umumnya > 6 detik), Roblox Open Cloud tidak langsung
// mengembalikan assetId. Response awalnya adalah path ke Operation API yang
// harus di-poll sampai moderasi selesai.
//   POST /assets/v1/assets         → { path: "operations/<opId>" } (HTTP 200/202)
//   GET  /assets/v1/operations/:id → { done: true, response: { path: "assets/<id>", assetId } }
//                                  | { done: true, error: {...} }
const OPERATION_PATH_RE = /^operations\/([^/]+)\/?$/i

/* -------------------------------------------------------------------------- */
/*  API Key & User ID management                                              */
/* -------------------------------------------------------------------------- */

export function getApiKey() {
  try { return localStorage.getItem(API_KEY_STORAGE) || '' } catch { return '' }
}

export function setApiKey(key) {
  try {
    if (key) localStorage.setItem(API_KEY_STORAGE, key.trim())
    else localStorage.removeItem(API_KEY_STORAGE)
  } catch { /* ignore */ }
}

export function getUserId() {
  try { return localStorage.getItem(USER_ID_STORAGE) || '' } catch { return '' }
}

export function setUserId(id) {
  try {
    if (id) localStorage.setItem(USER_ID_STORAGE, String(id).trim())
    else localStorage.removeItem(USER_ID_STORAGE)
  } catch { /* ignore */ }
}

export function hasApiKey() {
  return !!getApiKey()
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function sanitizeAudioName(name) {
  // Roblox: max 50 char untuk displayName
  const base = String(name || 'audio')
    .replace(/\.[^.]+$/, '')                // hapus extension
    .replace(/[^A-Za-z0-9 _\-]/g, ' ')      // strip karakter tidak valid
    .replace(/\s+/g, ' ')
    .trim()
  if (!base) return 'audio'
  return base.slice(0, 50)
}

function extractAssetId(path) {
  if (typeof path !== 'string') return null
  const m = path.match(/(?:^|\/)assets\/(\d+)(?:\/|$)/i)
  return m ? Number(m[1]) : null
}

function extractOwnerId(path) {
  if (typeof path !== 'string') return null
  const m = path.match(/(?:^|\/)users\/(\d+)\//i)
  return m ? Number(m[1]) : null
}

/* -------------------------------------------------------------------------- */
/*  Core: uploadAudio                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Upload satu file audio ke Roblox Open Cloud menggunakan API Key user.
 *
 * @param {Object} args
 * @param {Blob|File} args.file
 * @param {string}    [args.audioName]   - nama untuk Roblox (max 50 char)
 * @param {string}    [args.apiKey]      - override (default: localStorage)
 * @param {string}    [args.userId]      - override (default: localStorage)
 * @param {string}    [args.description] - deskripsi opsional
 * @param {Function}  [args.onProgress]  - callback 0-100
 * @param {AbortSignal}[args.signal]
 * @returns {Promise<{ok, assetId, playbackUrl, path, ownerId, raw}>}
 */
export async function uploadAudio({
  file, audioName, apiKey, userId, description,
  onProgress, signal,
} = {}) {
  if (!file) throw new Error('File audio wajib diisi.')

  const key = (apiKey || getApiKey() || '').trim()
  if (!key) {
    throw new Error(
      'Roblox API Key belum diisi. Buka Settings → paste API Key dari ' +
      ROBLOX_OPEN_CLOUD.credentialsUrl
    )
  }

  const name = sanitizeAudioName(audioName || file.name || 'audio')
  const uid = (userId || getUserId() || '').trim()

  // Pre-check ukuran (Roblox hard limit 20MB untuk audio non-music).
  const maxBytes = ROBLOX_OPEN_CLOUD.robloxLimits.maxSizeMB * 1024 * 1024
  if (file.size > maxBytes) {
    throw new Error(
      `File terlalu besar (${(file.size / 1024 / 1024).toFixed(1)}MB). ` +
      `Maks ${ROBLOX_OPEN_CLOUD.robloxLimits.maxSizeMB}MB.`
    )
  }

  // Open Cloud: request metadata (JSON) + fileContent (binary)
  const requestPayload = {
    displayName: name,
    description: (description || `Uploaded via BMS Studio v2 — ${name}`).slice(0, 1000),
    assetType: 'Audio',
  }
  // Hanya kirim creator kalau userId tersedia. Kalau tidak, Open Cloud akan
  // otomatis gunakan owner dari API key.
  if (uid) {
    requestPayload.creationContext = { creator: { userId: Number(uid) } }
  }

  const fd = new FormData()
  fd.append('request', JSON.stringify(requestPayload))
  fd.append('fileContent', file, (file.name || 'audio') + '')

  if (onProgress) onProgress(10)

  // Pakai XHR supaya bisa track upload progress.
  const result = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const url = ROBLOX_OPEN_CLOUD.audioInsert

    xhr.open('POST', url, true)
    // Jangan pakai responseType 'json' dengan multipart upload.
    // Beberapa browser (termasuk Roblox Studio WebView) gagal parse
    // kalau server return Content-Type yang tidak exact 'application/json'.
    // Kita parse manual dari responseText di onload.
    xhr.responseType = ''
    xhr.withCredentials = false
    // 180 detik = cukup untuk upload audio sampai 20MB di koneksi lambat.
    xhr.timeout = 180000
    xhr.setRequestHeader('x-api-key', key)
    // Explicit Accept supaya server tidak return HTML error page.
    xhr.setRequestHeader('Accept', 'application/json')

    if (signal) {
      if (signal.aborted) {
        reject(new Error('Upload dibatalkan.'))
        return
      }
      const onAbort = () => {
        xhr.abort()
        reject(new Error('Upload dibatalkan.'))
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable || !onProgress) return
      const p = 10 + Math.round((e.loaded / e.total) * 75) // 10-85%
      onProgress(p)
    }

    xhr.onload = () => {
      const status = xhr.status
      const rawText = (typeof xhr.responseText === 'string') ? xhr.responseText : ''
      let body = xhr.response
      if ((!body || typeof body !== 'object') && rawText) {
        try { body = JSON.parse(rawText) } catch { body = null }
      }
      if (status >= 200 && status < 300) {
        resolve({ status, body: body || {}, rawText })
      } else {
        const errText = (body && (body.error || body.message || body.errors))
          || rawText
          || `HTTP ${status}`
        reject(new Error(`Roblox reject (HTTP ${status}): ${errText}`))
      }
    }

    xhr.onerror = () => reject(new Error(
      'Network error saat upload ke Roblox. ' +
      'Cek koneksi internet, CORS preflight, & pastikan API Key valid. ' +
      '(URL: ' + url + ')'
    ))
    xhr.ontimeout = () => reject(new Error(
      'Timeout 180s saat upload ke Roblox. ' +
      'Cek koneksi atau coba file lebih kecil.'
    ))

    xhr.send(fd)
  })

  // Open Cloud response shape bisa berbeda tergantung status moderation:
  //   - Audio non-music: { path: "assets/<id>", assetId, ... }
  //   - Audio music    : { path: "...", operationId, ... } (perlu polling)
  //   - Unverified     : { path: "assets/<id>", ... }
  // Kita coba extract id dari path; kalau tidak ada, fallback ke assetId field.
  const body = result?.body || {}
  const path = body.path || body.assetPath || ''

  // === Music moderation polling flow ===
  // Untuk audio "music" (umumnya > 6 detik), Roblox Open Cloud TIDAK
  // langsung mengembalikan assetId. Response awalnya adalah:
  //   { path: "operations/<operationId>", ... }   (HTTP 200/202)
  // Kita harus poll GET /assets/v1/operations/:id sampai moderasi
  // selesai. Lihat: roblox.js → pollAudioOperation().
  // Referensi: https://devforum.roblox.com/t/open-cloud-audio-api-changes
  if (onProgress) onProgress(88)
  const opMatch = typeof path === 'string' ? path.match(OPERATION_PATH_RE) : null
  if (opMatch) {
    const operationId = opMatch[1]
    if (onProgress) onProgress(90)
    let pollRes
    try {
      pollRes = await pollAudioOperation(key, operationId, {
        timeoutMs: 180_000,
        intervalMs: 3000,
      })
    } catch (pollErr) {
      throw new Error(
        'Gagal polling moderasi Roblox: ' + (pollErr?.message || String(pollErr)) +
        '. Operation ID: ' + operationId
      )
    }
    if (pollRes && pollRes.done === true && pollRes.assetId) {
      const polledAssetId = Number(pollRes.assetId)
      if (onProgress) onProgress(100)
      return {
        ok: true,
        assetId: polledAssetId,
        ownerId: null,
        path: `assets/${polledAssetId}`,
        playbackUrl: `https://assetdelivery.roblox.com/v1/asset/?id=${polledAssetId}`,
        moderationStatus: 'approved',
        operationId,
        raw: body,
      }
    }
    if (pollRes && pollRes.done === true && pollRes.failed) {
      throw new Error(
        'Moderasi Roblox menolak audio: ' + (pollRes.error || 'Unknown reason') +
        '. Cek apakah file berhak cipta atau durasi melebihi 360 detik. ' +
        'Operation ID: ' + operationId
      )
    }
    // Timeout: pollRes.done !== true
    throw new Error(
      'Moderasi Roblox timeout setelah 180s. ' +
      'Operation ID: ' + operationId +
      '. Coba lagi nanti atau cek status di dashboard Roblox Creator ' +
      '(https://create.roblox.com/dashboard/credentials).'
    )
  }

  let assetId = extractAssetId(path) || (body.assetId ? Number(body.assetId) : null)
  const ownerId = extractOwnerId(path) || (body.creatorId ? Number(body.creatorId) : null)

  // Kalau path bentuknya "users/<uid>/assets/<id>" → extract differently
  if (!assetId && typeof path === 'string') {
    const m = path.match(/\/(\d+)$/)
    if (m) assetId = Number(m[1])
  }

  if (!assetId) {
    throw new Error(
      'Response Roblox tidak mengandung asset ID. ' +
      'Cek console browser untuk raw response. ' +
      `Path yang diterima: "${path}"`
    )
  }

  // Auto-cache userId kalau path mengandungnya
  if (ownerId && !getUserId()) {
    setUserId(String(ownerId))
  }

  return {
    ok: true,
    assetId,
    ownerId,
    path,
    playbackUrl: `https://assetdelivery.roblox.com/v1/asset/?id=${assetId}`,
    moderationStatus: body.moderationResult?.moderationState || 'approved',
    raw: body,
  }
}

/* -------------------------------------------------------------------------- */
/*  Aliases untuk backward-compat dengan call site lama                       */
/* -------------------------------------------------------------------------- */

export const uploadToRoblox = uploadAudio

// Synox tidak dipakai lagi; array dikosongkan untuk UI dropdown
export const UPLOAD_HOSTS = []

export function resolveBackendBase() {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin
  }
  return ''
}