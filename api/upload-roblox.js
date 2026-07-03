// api/upload-roblox.js
// Vercel-compatible serverless fallback. Dipakai hanya jika deploy di Vercel
// (atau platform serverless lain) dan tidak ada server.js.
//
// Catatan: Vercel Functions tidak support `multer` secara native dengan
// file memory storage, jadi handler ini pakai `parseForm` manual dengan
// busboy-style parsing. Untuk kebanyakan kasus, lebih mudah deploy di
// Railway/Render/Fly.io dan pakai server.js.
//
// Env var:
//   SYNOX_BASE        -> default https://api.synoxcloud.xyz
//   ROBLOX_COOKIE     -> opsional (auto submit Roblox)
//
// Body: multipart/form-data dengan field:
//   file  -> file audio (mp3/wav/ogg)
//   host  -> opsional, default "gofile"

import { FormData } from 'form-data'
import fetch from 'node-fetch'

export const config = {
  api: { bodyParser: false },
}

const SYNOX_BASE = process.env.SYNOX_BASE || 'https://api.synoxcloud.xyz'
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE || ''

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

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// Parser multipart sederhana (cukup untuk field 'file' + 'host')
function parseMultipart(buffer, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)
  if (!m) throw new Error('Boundary tidak ditemukan di Content-Type.')
  const boundary = `--${m[1] || m[2]}`
  const parts = []
  let start = 0
  while (true) {
    const idx = buffer.indexOf(boundary, start)
    if (idx < 0) break
    const next = buffer.indexOf(boundary, idx + boundary.length)
    if (next < 0) break
    const part = buffer.slice(idx + boundary.length, next)
    // strip leading \r\n-- dan trailing \r\n
    let p = part
    if (p[0] === 0x2d && p[1] === 0x2d) p = p.slice(2)
    if (p[0] === 0x0d && p[1] === 0x0a) p = p.slice(2)
    if (p[p.length - 2] === 0x0d && p[p.length - 1] === 0x0a) p = p.slice(0, -2)
    const headerEnd = p.indexOf('\r\n\r\n')
    if (headerEnd < 0) { start = next; continue }
    const header = p.slice(0, headerEnd).toString('utf8')
    const body = p.slice(headerEnd + 4)
    const nameMatch = /name="([^"]+)"/i.exec(header)
    const filenameMatch = /filename="([^"]*)"/i.exec(header)
    const typeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(header)
    parts.push({
      name: nameMatch?.[1] || '',
      filename: filenameMatch?.[1] || '',
      mime: typeMatch?.[1]?.trim() || 'application/octet-stream',
      data: body,
    })
    start = next
  }
  return parts
}

async function uploadToSynox({ host, filename, mime, buffer }) {
  const targetPath = SYNOX_UPLOADER_PATH[host] || SYNOX_UPLOADER_PATH.gofile
  const form = new FormData()
  form.append('file', buffer, { filename, contentType: mime })
  const res = await fetch(`${SYNOX_BASE}${targetPath}`, { method: 'POST', body: form })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Synox error ${res.status}: ${JSON.stringify(json).slice(0, 200)}`)
  const url =
    json?.data?.url || json?.data?.link || json?.url || json?.link || json?.result?.url
  if (!url) throw new Error('Synox tidak mengembalikan URL.')
  return { host, url, raw: json }
}

async function submitToRoblox({ name, mime, buffer, cookie }) {
  const form = new FormData()
  form.append('name', name.slice(0, 50))
  form.append('file', buffer, { filename: name, contentType: mime })
  const res = await fetch('https://create.roblox.com/v1/audio', {
    method: 'POST',
    headers: {
      'Cookie': `.ROBLOSECURITY=${cookie}`,
      'User-Agent': 'RobloxStudio/WinInet',
      'X-CSRF-TOKEN': '1',
    },
    body: form,
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, body: json }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-roblox-cookie')
    return res.status(204).end()
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    res.setHeader('Access-Control-Allow-Origin', '*')
    const raw = await readRawBody(req)
    const parts = parseMultipart(raw, req.headers['content-type'] || '')

    const filePart = parts.find(p => p.name === 'file')
    const hostPart = parts.find(p => p.name === 'host')

    if (!filePart) return res.status(400).json({ error: 'No file field.' })
    const host = hostPart ? hostPart.data.toString('utf8') : 'gofile'

    const uploaded = await uploadToSynox({
      host,
      filename: filePart.filename || 'audio.mp3',
      mime: filePart.mime,
      buffer: filePart.data,
    })

    const cookie = req.headers['x-roblox-cookie'] || ROBLOX_COOKIE
    let roblox = null
    if (cookie) {
      roblox = await submitToRoblox({
        name: (filePart.filename || 'audio').replace(/\.[^.]+$/, ''),
        mime: filePart.mime,
        buffer: filePart.data,
        cookie,
      })
    }
    res.status(200).json({ ok: true, upload: uploaded, roblox })
  } catch (err) {
    console.error('[/api/upload-roblox]', err)
    res.status(500).json({ ok: false, error: err.message })
  }
}