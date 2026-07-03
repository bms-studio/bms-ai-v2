// server.js
// Express production server untuk bms-ai-v2.
// - Serve static dist/ hasil Vite build.
// - Sediakan proxy endpoint POST /api/upload-roblox yang menerima multipart upload
//   (atau JSON {filename, mime, base64}), lalu forward ke SynoxCloud + otomatis
//   submit ke Roblox Creator Dashboard audio library.
//
// Konfigurasi environment variable (opsional, ada fallback default):
//   PORT              -> port server (default 8080)
//   SYNOX_BASE        -> base URL SynoxCloud (default https://api.synoxcloud.xyz)
//   ROBLOX_COOKIE     -> cookie .ROBLOSECURITY untuk submit audio ke Roblox.
//                        JIKA TIDAK DIISI: server hanya upload ke SynoxCloud,
//                        return URL file, lalu client pakai cookie miliknya sendiri
//                        untuk submit ke Roblox via /api/roblox/submit-audio.
//   ROBLOX_USER_AGENT -> User-Agent default "RobloxStudio/WinInet"
//                        (beberapa minggu bisa berubah, override jika perlu).

import express from 'express'
import multer from 'multer'
import fetch from 'node-fetch'
import { FormData } from 'form-data'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 8080
const SYNOX_BASE = process.env.SYNOX_BASE || 'https://api.synoxcloud.xyz'
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE || ''
const ROBLOX_UA = process.env.ROBLOX_USER_AGENT || 'RobloxStudio/WinInet'

const app = express()
app.use(express.json({ limit: '50mb' }))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB (Roblox max 20MB + headroom)
})

// ---------- CORS ringan untuk preflight dari dev frontend ----------
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-roblox-cookie')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// ---------- Util: upload buffer ke SynoxCloud (Sanz /api/uploader) ----------
// SynoxCloud punya banyak uploader (gofile, catbox, uguu, dll).
// Kita pilih target lewat query ?host=catbox dan forward ke endpoint Synox
// yang sesuai. Lihat src/config/endpoints.js UPLOADERS.
const SYNOX_UPLOADER_PATH = {
  imgur:          '/api/uploader/imgur',
  '8uploads':     '/api/uploader/8uploads',
  freeimage:      '/api/uploader/freeimage',
  imghippo:       '/api/uploader/imghippo',
  catbox:         '/api/uploader/catbox',
  litterbox:      '/api/uploader/litterbox',
  uguu:           '/api/uploader/uguu',
  imgbb:          '/api/uploader/imgbb',
  yourimageshare: '/api/uploader/yourimageshare',
  gofile:         '/api/uploader/gofile',
}

async function uploadToSynox({ host, filename, mime, buffer }) {
  const targetPath = SYNOX_UPLOADER_PATH[host] || SYNOX_UPLOADER_PATH.gofile
  const url = `${SYNOX_BASE}${targetPath}`

  const form = new FormData()
  // field name 'file' adalah yang paling umum dipakai Synox wrapper.
  form.append('file', buffer, { filename, contentType: mime })

  const res = await fetch(url, { method: 'POST', body: form })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  if (!res.ok) {
    throw new Error(`Synox uploader error ${res.status}: ${text.slice(0, 200)}`)
  }
  // Cari URL pada response generik (beberapa host pakai field berbeda).
  const urlField =
    json?.data?.url ||
    json?.data?.link ||
    json?.url ||
    json?.link ||
    json?.result?.url ||
    ''
  if (!urlField) {
    throw new Error('Synox uploader tidak mengembalikan URL file.')
  }
  return { host, url: urlField, raw: json }
}

// ---------- Util: submit audio ke Roblox Creator Dashboard ----------
// Endpoint target: https://create.roblox.com/v1/audio
// Body: multipart/form-data dengan field 'name', 'file', dan 'groupId' (opsional)
async function submitToRoblox({ name, mime, buffer, cookie }) {
  const url = 'https://create.roblox.com/v1/audio'
  const form = new FormData()
  form.append('name', name.slice(0, 50))   // Roblox max 50 char
  form.append('file', buffer, {
    filename: name,
    contentType: mime,
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Cookie': `.ROBLOSECURITY=${cookie}`,
      'User-Agent': ROBLOX_UA,
      'Accept': 'application/json, text/plain, */*',
      'X-CSRF-TOKEN': '1', // akan di-refresh otomatis oleh Roblox
    },
    body: form,
  })

  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  return { status: res.status, body: json }
}

// ---------- API: /api/upload-roblox ----------
// Mendukung dua mode:
//   1. multipart/form-data (form field "file") – dipakai saat upload dari browser.
//   2. application/json  { filename, mime, base64, host } – dipakai kalau client
//      sudah punya ArrayBuffer hasil encode di Web Audio.
app.post('/api/upload-roblox', upload.single('file'), async (req, res) => {
  try {
    let filename, mime, buffer
    const { host = 'gofile' } = req.body

    if (req.file) {
      filename = req.file.originalname || 'audio.mp3'
      mime = req.file.mimetype || 'audio/mpeg'
      buffer = req.file.buffer
    } else if (req.body?.base64) {
      filename = req.body.filename || 'audio.mp3'
      mime = req.body.mime || 'audio/mpeg'
      buffer = Buffer.from(req.body.base64, 'base64')
    } else {
      return res.status(400).json({ error: 'No file or base64 payload provided.' })
    }

    // 1) Upload ke SynoxCloud (untuk dapetin public URL)
    const uploaded = await uploadToSynox({ host, filename, mime, buffer })

    // 2) Submit ke Roblox (opsional, hanya kalau cookie tersedia)
    const cookie = req.headers['x-roblox-cookie'] || ROBLOX_COOKIE
    let roblox = null
    if (cookie) {
      roblox = await submitToRoblox({
        name: filename.replace(/\.[^.]+$/, ''),
        mime, buffer,
        cookie,
      })
    }

    res.json({
      ok: true,
      upload: uploaded,
      roblox, // null kalau tidak ada cookie
    })
  } catch (err) {
    console.error('[/api/upload-roblox]', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ---------- API: /api/roblox/submit-audio ----------
// Versi "kirim audio jadi-jadi ke Roblox" terpisah, dipakai saat client
// ingin host di tempat lain (mis. Imgur/Catbox) tapi submit via proxy ini.
app.post('/api/roblox/submit-audio', upload.single('file'), async (req, res) => {
  try {
    const cookie = req.headers['x-roblox-cookie'] || ROBLOX_COOKIE
    if (!cookie) {
      return res.status(401).json({ error: 'Missing x-roblox-cookie header.' })
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })

    const result = await submitToRoblox({
      name: (req.file.originalname || 'audio').replace(/\.[^.]+$/, ''),
      mime: req.file.mimetype || 'audio/mpeg',
      buffer: req.file.buffer,
      cookie,
    })
    res.json({ ok: result.status < 400, ...result })
  } catch (err) {
    console.error('[/api/roblox/submit-audio]', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ---------- Health check ----------
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }))

// ---------- Static serve dist/ (production) ----------
const distDir = path.join(__dirname, 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  // SPA fallback: semua route non-/api kembalikan index.html
  app.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
} else {
  app.get('/', (_req, res) =>
    res.send('dist/ not found. Jalankan `npm run build` terlebih dahulu.')
  )
}

app.listen(PORT, () => {
  console.log(`[bms-ai-v2] server listening on http://localhost:${PORT}`)
})