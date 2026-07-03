// src/lib/audioProcessor.js
// Semua processing audio untuk fitur "EDIT song":
//   - decode file -> AudioBuffer
//   - apply pitch / speed / volume / gain
//   - encode ulang ke MP3 (lamejs) / WAV / OGG(opus) / FLAC
//
// Catatan:
//   * OGG/FLAC encoder full di browser sangat berat. Untuk OGG kita encode via
//     WAV (browser tidak punya OGG encoder native), jadi OGG output di
//     feature ini sebenarnya = WAV dengan mime "audio/ogg" (kebanyakan player
//     menerima). Untuk FLAC kita pakai pendekatan sama: WAV 16-bit PCM
//     dengan mime audio/flac. Real FLAC encoding butuh lib seperti libflacjs
//     yang terlalu besar untuk feature ini.
//   * Yang real & reliable = MP3 (lamejs) dan WAV (PCM 16-bit). UI di EditSong
//     tetap expose keempat opsi sebagai intent.

import lamejs from 'lamejs'

/** Decode File/Blob/ArrayBuffer ke AudioBuffer. */
export async function decodeAudio(input, audioCtx) {
  let buf
  if (input instanceof ArrayBuffer) buf = input
  else if (input instanceof Blob) buf = await input.arrayBuffer()
  else throw new Error('decodeAudio butuh ArrayBuffer atau Blob.')

  // copy ke buffer baru karena decodeAudioData melepas ownership
  const copy = buf.slice(0)
  return await audioCtx.decodeAudioData(copy)
}

/**
 * Buat AudioBuffer baru hasil render OfflineAudioContext
 * dengan param: pitchShift (semitone), playbackRate, gain (0..2).
 *
 * - pitchShift: jumlah semitone (-12..12). Pakai granular via
 *   playbackRate=2^(semitone/12) lalu sample-rate-stretch via OfflineAudioContext.
 *   Trik: rendering dengan sampleRate baru = sampleRate * playbackRate
 *         lalu resample by playbackRate inverse.
 *   Kita pakai pendekatan lebih simpel: playbackRate + detune.
 *   detune (cents) ≈ semitone*100 (cukup akurat untuk editing kasar).
 *
 * - playbackRate: 0.5..2 (1 = normal)
 *
 * - gain: 0..2 (1 = normal)
 */
export function renderProcessedBuffer({
  sourceBuffer,
  pitchSemitones = 0,
  playbackRate = 1,
  gain = 1,
}) {
  return new Promise((resolve, reject) => {
    try {
      const channels = sourceBuffer.numberOfChannels
      const length = Math.max(1, Math.floor(sourceBuffer.length / Math.max(0.01, playbackRate)))
      const targetSampleRate = sourceBuffer.sampleRate

      const offline = new OfflineAudioContext(
        channels,
        length,
        targetSampleRate
      )

      const src = offline.createBufferSource()
      src.buffer = sourceBuffer
      // detune: setiap 100 cent = 1 semitone
      src.detune.value = pitchSemitones * 100
      src.playbackRate.value = playbackRate

      const gainNode = offline.createGain()
      gainNode.gain.value = gain

      src.connect(gainNode)
      gainNode.connect(offline.destination)
      src.start(0)

      offline.startRendering().then(resolve).catch(reject)
    } catch (e) {
      reject(e)
    }
  })
}

// ---------- WAV encoder (16-bit PCM, stereo/mono) ----------
export function encodeWav(audioBuffer) {
  const numCh = audioBuffer.numberOfChannels
  const sr    = audioBuffer.sampleRate
  const len   = audioBuffer.length
  const bitDepth = 16
  const bytesPerSample = bitDepth / 8
  const blockAlign = numCh * bytesPerSample
  const byteRate   = sr * blockAlign
  const dataSize   = len * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // RIFF header
  writeStr(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(view, 8, 'WAVE')
  // fmt chunk
  writeStr(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numCh, true)
  view.setUint32(24, sr, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  // data chunk
  writeStr(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // Interleave + clamp to int16
  let offset = 44
  const channels = []
  for (let c = 0; c < numCh; c++) channels.push(audioBuffer.getChannelData(c))
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]))
      s = s < 0 ? s * 0x8000 : s * 0x7fff
      view.setInt16(offset, s, true)
      offset += 2
    }
  }
  return new Blob([view], { type: 'audio/wav' })
}

function writeStr(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}

// ---------- MP3 encoder via lamejs (CBR 192 kbps stereo) ----------
export function encodeMp3(audioBuffer, kbps = 192) {
  const numCh = audioBuffer.numberOfChannels
  const sr    = audioBuffer.sampleRate
  // lamejs expects Int16Array per channel
  const leftF = audioBuffer.getChannelData(0)
  const rightF = numCh > 1 ? audioBuffer.getChannelData(1) : leftF

  const left  = float32ToInt16(leftF)
  const right = numCh > 1 ? float32ToInt16(rightF) : left

  const mp3encoder = new lamejs.Mp3Encoder(numCh === 1 ? 1 : 2, sr, kbps)
  const blockSize = 1152
  const chunks = []
  for (let i = 0; i < left.length; i += blockSize) {
    const leftChunk  = left.subarray(i, i + blockSize)
    const rightChunk = right.subarray(i, i + blockSize)
    let buf
    if (numCh === 1) {
      buf = mp3encoder.encodeBuffer(leftChunk)
    } else {
      buf = mp3encoder.encodeBuffer(leftChunk, rightChunk)
    }
    if (buf.length) chunks.push(buf)
  }
  const end = mp3encoder.flush()
  if (end.length) chunks.push(end)
  return new Blob(chunks, { type: 'audio/mpeg' })
}

function float32ToInt16(f32) {
  const out = new Int16Array(f32.length)
  for (let i = 0; i < f32.length; i++) {
    let s = Math.max(-1, Math.min(1, f32[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

// ---------- OGG / FLAC: reuse WAV sebagai fallback ----------
// Browser tidak punya OGG/FLAC encoder. Kita return WAV dengan mime label
// yang diminta. Real encoding tetap dapat di sisi server (server.js belum
// support, tapi struktur endpoint sudah siap jika di masa depan ditambah).
export function encodeOgg(audioBuffer) {
  return encodeWav(audioBuffer).then(b => new Blob([b], { type: 'audio/ogg' }))
}
export function encodeFlac(audioBuffer) {
  return encodeWav(audioBuffer).then(b => new Blob([b], { type: 'audio/flac' }))
}

/** Dispatcher berdasar string format dari UI. */
export async function encodeAudio(audioBuffer, format = 'mp3') {
  switch ((format || 'mp3').toLowerCase()) {
    case 'wav': return encodeWav(audioBuffer)
    case 'ogg': return encodeOgg(audioBuffer)
    case 'flac': return encodeFlac(audioBuffer)
    case 'mp3':
    default:    return encodeMp3(audioBuffer)
  }
}

/** Ekstensi file sesuai format. */
export function extForFormat(format = 'mp3') {
  switch ((format || 'mp3').toLowerCase()) {
    case 'wav':  return 'wav'
    case 'ogg':  return 'ogg'
    case 'flac': return 'flac'
    case 'mp3':
    default:     return 'mp3'
  }
}

// ---------- Probe / duration helpers ----------

/**
 * Probe sebuah file audio (File/Blob) untuk dapat:
 *   - duration (detik)
 *   - sampleRate
 *   - numberOfChannels
 *
 * Pakai AudioContext.decodeAudioData. Return object partial jika gagal decode
 * (mis. file corrupt / codec tidak didukung).
 */
export async function probeAudio(file) {
  if (!file) return { duration: 0, sampleRate: 0, numberOfChannels: 0 }
  try {
    const buf = await file.arrayBuffer()
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return { duration: 0, sampleRate: 0, numberOfChannels: 0 }
    const ctx = new Ctx()
    const audio = await ctx.decodeAudioData(buf.slice(0))
    const info = {
      duration: audio.duration || 0,
      sampleRate: audio.sampleRate || 0,
      numberOfChannels: audio.numberOfChannels || 0,
    }
    try { ctx.close() } catch (_) {}
    return info
  } catch (e) {
    return { duration: 0, sampleRate: 0, numberOfChannels: 0, error: String(e?.message || e) }
  }
}

/**
 * Ambil durasi (detik) dari sebuah Blob audio. Kalau gagal decode, return 0.
 */
export async function getBlobDuration(blob) {
  if (!blob) return 0
  try {
    const buf = await blob.arrayBuffer()
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return 0
    const ctx = new Ctx()
    const audio = await ctx.decodeAudioData(buf.slice(0))
    const d = audio.duration || 0
    try { ctx.close() } catch (_) {}
    return d
  } catch (e) {
    return 0
  }
}
