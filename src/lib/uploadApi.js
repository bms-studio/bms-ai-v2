// src/lib/uploadApi.js
// Helper untuk upload file audio (mp3/wav/ogg) ke Synox uploader via
// backend proxy (`/api/upload-roblox`) dan (opsional) auto-submit ke
// Roblox Create API dengan .ROBLOSECURITY cookie.
//
// Alasan pakai backend proxy: Synox tidak expose CORS, dan Roblox Create
// butuh Cookie yang TIDAK BOLEH di-expose ke frontend. Backend kita
// forward request dan opsional menambahkan Cookie.

import { API_URL } from '../config/endpoints.js'

const DEFAULT_HOSTS = ['gofile', 'catbox', 'uguu', '8uploads', 'litterbox', 'freeimage', 'imghippo', 'imgur']

/**
 * Resolve base URL untuk backend /api/upload-roblox.
 * - Di dev (vite): kosong -> pakai Vite proxy (sama-origin).
 * - Di prod (Express server.js): kosong -> pakai window.location.origin.
 * - User bisa override via VITE_API_URL di .env (lihat endpoints.js).
 */
function resolveBackendBase() {
  if (API_URL && typeof API_URL === 'string' && API_URL.trim()) {
    return API_URL.replace(/\/+$/, '')
  }
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin
  }
  return ''
}

/**
 * Upload satu file audio ke Synox (via backend proxy) dan (opsional) submit
 * ke Roblox Audio Create API.
 *
 * @param {Object} args
 * @param {File|Blob} args.file
 * @param {string}   [args.host]     - salah satu dari DEFAULT_HOSTS, default 'gofile'
 * @param {string}   [args.cookie]   - .ROBLOSECURITY value (opsional)
 * @param {string}   [args.audioName] - nama untuk Roblox (max 50 char)
 * @param {AbortSignal} [args.signal]
 * @returns {Promise<{ok:true, upload:{url,host,raw}, roblox?:{...}}>}
 */
export async function uploadAudio({ file, host = 'gofile', cookie, audioName, signal } = {}) {
  if (!file) throw new Error('File audio wajib diisi.')
  const base = resolveBackendBase()
  const url = `${base}/api/upload-roblox`

  const fd = new FormData()
  fd.append('file', file, file.name || 'audio.mp3')
  fd.append('host', host)

  const headers = {}
  if (cookie) headers['x-roblox-cookie'] = cookie

  const res = await fetch(url, { method: 'POST', body: fd, headers, signal })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = { ok: false, error: text } }
  if (!res.ok || !data.ok) {
    throw new Error(data?.error || `Upload gagal (HTTP ${res.status}).`)
  }
  if (audioName) data.audioName = audioName
  return data
}

/** Daftar host Synox uploader yang dipakai dropdown UI. */
export const UPLOAD_HOSTS = DEFAULT_HOSTS

// Alias dengan nama yang lebih generik: upload ke Roblox (Synox host + optional
// Roblox Create API). Identik dengan uploadAudio, hanya beda nama export.
export const uploadToRoblox = uploadAudio

export { resolveBackendBase }
