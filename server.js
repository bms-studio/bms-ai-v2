// server.js
// Auralis AI v2 - Optional Express backend.
//
// ⚠️  Modern flow: audio upload to Roblox uses the user's Open Cloud API Key
// from the browser directly (see src/lib/uploadApi.js + src/lib/roblox.js).
// This server is OPTIONAL and is kept for compatibility with deployments that
// have not migrated yet, or for features that must proxy through a server
// (chat proxies, news scrapers, etc.).
//
// Run with:  node server.js
// Env vars:  PORT  (default 3000)
//            ALLOWED_ORIGINS  (CSV, default = same-origin only)
//
// Endpoints (all under /api):
//   GET  /api/health                         -> { ok: true, version }
//   GET  /api/ai-chat/:modelId?pesan=...     -> Synox proxy (with Xylo fallback)
//   POST /api/ai-image/qwenimage             -> { prompt, aspect_ratio } -> Xylo
//   POST /api/image-tool/:tool               -> image effects via Xylo
//   POST /api/ai-analyze/file                -> file -> Xylo
//   POST /api/ai-analyze/image               -> { image } -> Xylo
//   GET  /api/news/:source                   -> news proxy
//   POST /api/uploader/:host                 -> file -> various hosts
//   POST /api/upload-audio                   -> LEGACY: .ROBLOSECURITY cookie flow
//
// The /api/upload-audio endpoint is documented as a placeholder; production
// users should use the Open Cloud API key flow in the browser.

import express from 'express'
import multer from 'multer'
import FormData from 'form-data'
import fetch from 'node-fetch'

const PORT = Number(process.env.PORT) || 3000
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

const SYNOX_BASE = process.env.SYNOX_BASE || 'https://api.synoxcloud.xyz'
const XYLO_BASE  = process.env.XYLO_BASE  || 'https://xyloapi.qzz.io'

const app = express()

/* -------------------------------------------------------------------------- */
/*  CORS / security                                                           */
/* -------------------------------------------------------------------------- */

function corsFor(req, res) {
  const origin = req.headers.origin
  // Default: same-origin only (no Access-Control-Allow-Origin sent).
  // If origin is in allowlist, echo it back.
  if (origin && (ALLOWED_ORIGINS.length === 0
      ? origin === `${req.protocol}://${req.get('host')}`
      : ALLOWED_ORIGINS.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept')
    res.setHeader('Access-Control-Max-Age', '600')
  }
}

app.use((req, res, next) => {
  corsFor(req, res)
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

/* -------------------------------------------------------------------------- */
/*  Body parsing                                                              */
/*                                                                             */
/*  ⚠️  Important: do NOT use express.json() with a low limit for arbitrary   */
/*  routes. Files / base64 images are sent as JSON. We use 25mb to fit the    */
/*  largest expected payload (a 5mb image becomes ~6.7mb base64).              */
/* -------------------------------------------------------------------------- */

app.use(express.json({ limit: '25mb' }))
app.use(express.urlencoded({ extended: true, limit: '25mb' }))

// Multer for file uploads (legacy upload-audio + some uploaders).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100mb
})

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const FETCH_TIMEOUT_MS = 120_000

async function fetchJSON(url, opts = {}, timeout = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal })
    const text = await res.text()
    let parsed
    try { parsed = JSON.parse(text) } catch { parsed = null }
    return { ok: res.ok, status: res.status, text, json: parsed }
  } catch (err) {
    const msg = err && err.name === 'AbortError' ? 'Upstream timeout' : 'Network: ' + (err.message || err)
    return { ok: false, status: 0, text: msg, json: null }
  } finally {
    clearTimeout(timer)
  }
}

/** Strip Xylo envelope noise from an error string. */
function cleanError(s) {
  if (!s) return ''
  const t = String(s).trim()
  if (!t) return ''
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const o = JSON.parse(t)
      if (o && typeof o === 'object') return ''
    } catch { /* keep */ }
  }
  if (/creator["']?\s*:\s*["']XyloAPI/i.test(t)) return ''
  return t.slice(0, 200)
}

function rejectEnvelope(parsed) {
  return parsed && typeof parsed === 'object' && parsed.success === false
}

async function postXylo(path, body) {
  const r = await fetchJSON(`${XYLO_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  if (!r.ok) throw new Error(cleanError(r.text) || `HTTP ${r.status}`)
  if (rejectEnvelope(r.json)) throw new Error('Upstream service is currently unavailable. Please try again later.')
  return r.json && r.json.data !== undefined ? r.json.data : r.json
}

async function getSynox(path, params = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    qs.set(k, String(v))
  }
  const url = `${SYNOX_BASE}${path}?${qs.toString()}`
  const r = await fetchJSON(url, { method: 'GET' })
  if (!r.ok) throw new Error(cleanError(r.text) || `HTTP ${r.status}`)
  if (r.json && r.json.status === false) {
    throw new Error(typeof r.json.result === 'string' ? r.json.result : 'Upstream service is currently unavailable. Please try again later.')
  }
  return r.json
}

/* -------------------------------------------------------------------------- */
/*  Per-host uploader config                                                  */
/*                                                                             */
/*  Different hosts expect the file under different field names. The          */
/*  previous version hard-coded 'file' for every host, which silently failed  */
/*  for gofile (expects 'file'), catbox ('reqfile'), litterbox/uguu          */
/*  ('files[]'), and others. This map is the source of truth.                 */
/* -------------------------------------------------------------------------- */

const UPLOAD_FIELD = {
  imgur:         'image',
  '8uploads':    'file',
  freeimage:     'source',
  imghippo:      'file',
  catbox:        'reqfile',
  litterbox:     'files[]',     // sent as array
  uguu:          'files[]',     // sent as array
  imgbb:         'image',
  yourimageshare:'image',
  gofile:        'file',
}

/* -------------------------------------------------------------------------- */
/*  Health                                                                     */
/* -------------------------------------------------------------------------- */

app.get('/api/health', (req, res) => {
  res.json({ ok: true, version: '2.5.0', node: process.version, time: new Date().toISOString() })
})

/* -------------------------------------------------------------------------- */
/*  Chat proxy                                                                 */
/* -------------------------------------------------------------------------- */

app.get('/api/ai-chat/:modelId', async (req, res) => {
  const { modelId } = req.params
  const pesan = (req.query.pesan || '').toString()
  if (!pesan) return res.status(400).json({ success: false, error: 'pesan wajib diisi' })

  // Primary: Synox
  try {
    const data = await getSynox(`/ai-chat/${encodeURIComponent(modelId)}`, { pesan })
    if (data && data.status === true && data.result && typeof data.result.reply === 'string') {
      return res.json({ success: true, reply: data.result.reply.trim() })
    }
  } catch (err) {
    // fall through to Xylo
  }

  // Fallback: Xylo
  try {
    const data = await postXylo(`/api/ai-chat/${encodeURIComponent(modelId)}`, {
      message: pesan, prompt: pesan, text: pesan,
    })
    const cands = [
      data?.reply, data?.text, data?.response, data?.answer,
      data?.result?.reply, data?.data?.reply, data?.choices?.[0]?.message?.content,
    ]
    for (const c of cands) if (typeof c === 'string' && c.trim()) {
      return res.json({ success: true, reply: c.trim() })
    }
    return res.status(502).json({ success: false, error: 'Empty upstream response' })
  } catch (err) {
    return res.status(502).json({ success: false, error: cleanError(err.message) || 'AI service unavailable' })
  }
})

/* -------------------------------------------------------------------------- */
/*  Image generation                                                           */
/* -------------------------------------------------------------------------- */

app.post('/api/ai-image/qwenimage', async (req, res) => {
  try {
    const data = await postXylo('/api/ai-image/qwenimage', req.body || {})
    res.json({ success: true, data })
  } catch (err) {
    res.status(502).json({ success: false, error: cleanError(err.message) || 'Image gen failed' })
  }
})

/* -------------------------------------------------------------------------- */
/*  Image tools                                                                */
/* -------------------------------------------------------------------------- */

const IMAGE_TOOL_ENDPOINTS = {
  removebg:      '/api/image-tool/removebg',
  upscale:       '/api/image-tool/upscale',
  sepia:         '/api/image-tool/sepia',
  invert:        '/api/image-tool/invert',
  flip:          '/api/image-tool/flip',
  pixelate:      '/api/image-tool/pixelate',
  'round-corners':'/api/image-tool/round-corners',
  split:         '/api/image-tool/split',
  'add-noise':   '/api/image-tool/add-noise',
  blur:          '/api/image-tool/blur',
  sharpen:       '/api/image-tool/sharpen',
  solarize:      '/api/image-tool/solarize',
  glow:          '/api/image-tool/glow',
}

app.post('/api/image-tool/:tool', async (req, res) => {
  const { tool } = req.params
  const path = IMAGE_TOOL_ENDPOINTS[tool]
  if (!path) return res.status(404).json({ success: false, error: 'Unknown tool' })
  try {
    const data = await postXylo(path, req.body || {})
    res.json({ success: true, data })
  } catch (err) {
    res.status(502).json({ success: false, error: cleanError(err.message) || 'Tool failed' })
  }
})

/* -------------------------------------------------------------------------- */
/*  Analyze                                                                    */
/* -------------------------------------------------------------------------- */

app.post('/api/ai-analyze/file', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'file wajib diisi' })
  try {
    const fd = new FormData()
    fd.append('file', req.file.buffer, { filename: req.file.originalname || 'file' })
    const r = await fetch(`${XYLO_BASE}/api/ai-analyze/file`, { method: 'POST', body: fd })
    const text = await r.text()
    let parsed
    try { parsed = JSON.parse(text) } catch { parsed = { success: r.ok, data: text } }
    if (!r.ok) return res.status(r.status).json({ success: false, error: cleanError(text) || `HTTP ${r.status}` })
    res.json(parsed)
  } catch (err) {
    res.status(502).json({ success: false, error: 'Network: ' + (err.message || err) })
  }
})

app.post('/api/ai-analyze/image', async (req, res) => {
  try {
    const data = await postXylo('/api/ai-analyze/image', req.body || {})
    res.json({ success: true, data })
  } catch (err) {
    res.status(502).json({ success: false, error: cleanError(err.message) || 'Analyze failed' })
  }
})

/* -------------------------------------------------------------------------- */
/*  News                                                                       */
/* -------------------------------------------------------------------------- */

app.get('/api/news/:source', async (req, res) => {
  const { source } = req.params
  try {
    const r = await fetchJSON(`${XYLO_BASE}/api/news/${encodeURIComponent(source)}`)
    if (!r.ok) return res.status(r.status).json({ success: false, error: cleanError(r.text) || `HTTP ${r.status}` })
    res.json(r.json)
  } catch (err) {
    res.status(502).json({ success: false, error: 'Network: ' + (err.message || err) })
  }
})

/* -------------------------------------------------------------------------- */
/*  Uploaders                                                                  */
/* -------------------------------------------------------------------------- */

const UPLOADER_URLS = {
  imgur:         'https://api.imgur.com/3/image',
  '8uploads':    'https://8upload.com/api/upload',
  freeimage:     'https://freeimage.host/api/1/upload',
  imghippo:      'https://api.imghippo.com/v1/upload',
  catbox:        'https://catbox.moe/user/api.php',
  litterbox:     'https://litterbox.catbox.moe/resources/internals/api.php',
  uguu:          'https://uguu.se/upload.php',
  imgbb:         'https://api.imgbb.com/1/upload',
  yourimageshare:'https://yourimageshare.com/api/upload',
  gofile:        'https://upload.gofile.io/uploadFile',
}

app.post('/api/uploader/:host', upload.single('file'), async (req, res) => {
  const { host } = req.params
  const url = UPLOADER_URLS[host]
  const field = UPLOAD_FIELD[host]
  if (!url || !field) return res.status(404).json({ success: false, error: 'Unknown host' })
  if (!req.file) return res.status(400).json({ success: false, error: 'file wajib diisi' })

  try {
    const fd = new FormData()
    // Some hosts require the field to be sent as an array (litterbox, uguu).
    if (field.endsWith('[]')) {
      fd.append(field, req.file.buffer, { filename: req.file.originalname || 'file' })
    } else {
      fd.append(field, req.file.buffer, { filename: req.file.originalname || 'file' })
    }
    // litterbox/uguu require extra fields:
    if (host === 'litterbox') fd.append('reqtype', 'fileupload'), fd.append('time', '24h')
    if (host === 'uguu')      fd.append('reqtype', 'fileupload')
    if (host === 'catbox')    fd.append('reqtype', 'fileupload')

    const upstream = await fetch(url, { method: 'POST', body: fd })
    const text = await upstream.text()
    if (!upstream.ok) {
      return res.status(upstream.status).json({ success: false, error: cleanError(text) || `HTTP ${upstream.status}` })
    }
    // Try to parse JSON; if not JSON, return the raw URL/text directly.
    let parsed
    try { parsed = JSON.parse(text) } catch {
      return res.json({ success: true, data: { url: text.trim() } })
    }
    res.json({ success: true, data: parsed })
  } catch (err) {
    res.status(502).json({ success: false, error: 'Network: ' + (err.message || err) })
  }
})

/* -------------------------------------------------------------------------- */
/*  LEGACY: upload-audio via .ROBLOSECURITY cookie                            */
/*                                                                             */
/*  ⚠️  Modern clients use the Open Cloud API key flow in the browser.         */
/*  This endpoint is left as a placeholder. It intentionally returns a         */
/*  clear error so callers know to migrate.                                    */
/* -------------------------------------------------------------------------- */

app.post('/api/upload-audio', (req, res) => {
  res.status(410).json({
    success: false,
    error: 'This endpoint is deprecated. Use the Open Cloud API Key flow in the browser (see src/lib/uploadApi.js).',
  })
})

/* -------------------------------------------------------------------------- */
/*  Static frontend (optional)                                                 */
/* -------------------------------------------------------------------------- */

import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const distDir = path.join(__dirname, 'dist')
app.use(express.static(distDir))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) next()
  })
})

/* -------------------------------------------------------------------------- */
/*  Error handler                                                              */
/* -------------------------------------------------------------------------- */

app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error('[server] error:', err && err.stack || err)
  if (res.headersSent) return next(err)
  res.status(500).json({ success: false, error: 'Internal server error' })
})

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[bms-ai-v2] server listening on http://localhost:${PORT}`)
  // eslint-disable-next-line no-console
  console.log(`[bms-ai-v2] allowed origins: ${ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(', ') : '(same-origin only)'}`)
})