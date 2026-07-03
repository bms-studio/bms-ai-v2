// src/lib/audioEncoder.js
// Encode an AudioBuffer to compressed formats in the browser.
// - MP3: pure-JS via lamejs (already in package.json)
// - OGG: via MediaRecorder + audio/ogg;codecs=opus (Chrome / Firefox)
// - WAV: pass-through (the existing PCM16 encoder)
//
// All encoders return a Blob. The caller controls the filename extension.

import lamejs from 'lamejs'

/* -------------------------------------------------------------------------- */
/*  WAV (16-bit PCM)                                                          */
/* -------------------------------------------------------------------------- */
export function audioBufferToWavBlob(buffer) {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const samples = buffer.length
  const blockAlign = numChannels * 2
  const byteRate = sampleRate * blockAlign
  const dataSize = samples * blockAlign
  const out = new ArrayBuffer(44 + dataSize)
  const view = new DataView(out)

  let p = 0
  function ws(s) { for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i)) }

  ws('RIFF'); view.setUint32(p, 36 + dataSize, true); p += 4
  ws('WAVE'); ws('fmt '); view.setUint32(p, 16, true); p += 4
  view.setUint16(p, 1, true); p += 2
  view.setUint16(p, numChannels, true); p += 2
  view.setUint32(p, sampleRate, true); p += 4
  view.setUint32(p, byteRate, true); p += 4
  view.setUint16(p, blockAlign, true); p += 2
  view.setUint16(p, 16, true); p += 2
  ws('data'); view.setUint32(p, dataSize, true); p += 4

  const channels = []
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c))
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numChannels; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i] || 0))
      view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      p += 2
    }
  }
  return new Blob([out], { type: 'audio/wav' })
}

/* -------------------------------------------------------------------------- */
/*  MP3 (lamejs)                                                              */
/* -------------------------------------------------------------------------- */
/**
 * Encode AudioBuffer to MP3 using lamejs.
 * @param {AudioBuffer} buffer
 * @param {number} kbps  - bitrate, default 192
 */
export function audioBufferToMp3Blob(buffer, kbps = 192) {
  if (!lamejs) throw new Error('lamejs not available')
  const numChannels = Math.min(buffer.numberOfChannels, 2)
  const sampleRate = buffer.sampleRate
  const encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, kbps)

  // lamejs butuh Int16Array per channel
  const left = floatTo16(buffer.getChannelData(0))
  const right = numChannels === 2 ? floatTo16(buffer.getChannelData(1)) : null

  const chunks = []
  const BLOCK = 1152
  for (let i = 0; i < left.length; i += BLOCK) {
    const lChunk = left.subarray(i, i + BLOCK)
    const rChunk = right ? right.subarray(i, i + BLOCK) : null
    let enc
    if (numChannels === 2 && rChunk) {
      enc = encoder.encodeBuffer(lChunk, rChunk)
    } else {
      enc = encoder.encodeBuffer(lChunk)
    }
    if (enc.length) chunks.push(enc)
  }
  const tail = encoder.flush()
  if (tail.length) chunks.push(tail)

  return new Blob(chunks, { type: 'audio/mpeg' })
}

function floatTo16(float32) {
  const out = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    let s = Math.max(-1, Math.min(1, float32[i] || 0))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

/* -------------------------------------------------------------------------- */
/*  OGG (MediaRecorder → Opus)                                               */
/* -------------------------------------------------------------------------- */
/**
 * Encode AudioBuffer to OGG (Opus) via MediaRecorder.
 * Returns a Blob with type 'audio/ogg' when supported.
 * Throws if browser doesn't support audio/ogg MediaRecorder.
 */
export async function audioBufferToOggBlob(buffer) {
  // Pick best supported mime
  const candidates = [
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/webm;codecs=opus',
  ]
  const mime = candidates.find((m) =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)
  )
  if (!mime) {
    throw new Error('Browser does not support OGG/Opus MediaRecorder encoding.')
  }

  // Render to a MediaStream via AudioContext
  const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext
  const ctx = new AC(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
  const src = ctx.createBufferSource()
  src.buffer = buffer
  // We need a real-time MediaStreamDestination — switch to AudioContext.
  const liveCtx = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: buffer.sampleRate,
  })
  const dest = liveCtx.createMediaStreamDestination()
  // Re-create the source on the live context (OfflineAudioContext buffers
  // are not directly playable on a different context).
  const liveSrc = liveCtx.createBufferSource()
  liveSrc.buffer = buffer
  liveSrc.connect(dest)

  const recorder = new MediaRecorder(dest.stream, { mimeType: mime, audioBitsPerSecond: 192_000 })
  const chunks = []
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data) }
  const stopped = new Promise((resolve) => { recorder.onstop = resolve })

  recorder.start(100)
  liveSrc.start()
  // wait for source to end
  await new Promise((resolve) => {
    liveSrc.onended = resolve
    // fallback in case onended doesn't fire
    setTimeout(resolve, (buffer.duration + 0.2) * 1000)
  })
  recorder.stop()
  await stopped
  await liveCtx.close()

  const outType = mime.startsWith('audio/webm') ? 'audio/ogg' : mime.split(';')[0]
  return new Blob(chunks, { type: outType })
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */
/**
 * Encode AudioBuffer to the requested format.
 * @param {AudioBuffer} buffer
 * @param {'mp3'|'ogg'|'wav'} format
 * @param {Object} [opts]
 * @param {number} [opts.mp3Kbps=192]
 * @returns {Promise<Blob>}
 */
export async function encodeAudioBuffer(buffer, format, opts = {}) {
  const fmt = (format || 'wav').toLowerCase()
  if (fmt === 'wav') return audioBufferToWavBlob(buffer)
  if (fmt === 'mp3') return audioBufferToMp3Blob(buffer, opts.mp3Kbps || 192)
  if (fmt === 'ogg') return audioBufferToOggBlob(buffer)
  throw new Error(`Unsupported audio format: ${format}`)
}

/** MIME type and filename extension for a given format. */
export function formatMeta(format) {
  switch ((format || 'wav').toLowerCase()) {
    case 'mp3': return { mime: 'audio/mpeg',     ext: 'mp3' }
    case 'ogg': return { mime: 'audio/ogg',      ext: 'ogg' }
    case 'wav': return { mime: 'audio/wav',      ext: 'wav' }
    default:    return { mime: 'application/octet-stream', ext: format }
  }
}