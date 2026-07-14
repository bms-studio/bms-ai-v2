import { useRef, useState } from "react"
import {
  Upload, UploadCloud, Music2, ExternalLink,
  KeyRound, Eye, EyeOff, ShieldAlert
} from "lucide-react"
import { SectionHead, ErrorBox } from "../components/UI.jsx"
import StatusBadge from "../components/StatusBadge.jsx"
import { fmtBytes, fmtTime } from "../lib/utils.js"

const BYPASS_MODES = [
  { id: 'shield',   label: 'Shield',  desc: 'Spektral + noise floor' },
  { id: 'stealth',  label: 'Stealth', desc: 'Segment-based max' },
  { id: 'ringan',   label: 'Ringan',  desc: 'EQ notches halus' },
  { id: 'sedang',   label: 'Sedang',  desc: 'EQ + phaser' },
  { id: 'berat',    label: 'Berat',   desc: 'EQ + phaser + chorus' },
  { id: 'extreme',  label: 'Extreme', desc: 'Semua efek + mono' },
]

const API_KEY_STORAGE = 'bms.roblox.apiKey'
const USER_ID_STORAGE = 'bms.roblox.userId'
const BYPASS_URL = 'http://localhost:3000'
const BYPASS_MODE_KEY = 'bms_bypass_mode'

function getLS(k, d) { try { return localStorage.getItem(k) || d } catch { return d } }
function setLS(k, v) { try { localStorage.setItem(k, v) } catch {} }

export default function EditSong() {
  const [file, setFile] = useState(null)
  const [mode, setMode] = useState(() => getLS(BYPASS_MODE_KEY, 'shield'))
  const [format, setFormat] = useState('ogg')
  const [decoyStart, setDecoyStart] = useState(true)
  const [apiKey, setApiKeyState] = useState(() => getLS(API_KEY_STORAGE, ''))
  const [showKey, setShowKey] = useState(false)
  const [userId, setUserIdState] = useState(() => getLS(USER_ID_STORAGE, ''))
  const [loading, setLoading] = useState(false)
  const [loadText, setLoadText] = useState('')
  const [previewId, setPreviewId] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [duration, setDuration] = useState(0)

  const fileRef = useRef(null)
  const audioRef = useRef(null)

  function selectFile(f) {
    setError('')
    if (!f) return
    setFile(f)
    setPreviewId(null)
    setPreviewUrl(null)
    setResult(null)
    setDuration(0)
    // probe duration
    try {
      const a = new Audio()
      a.preload = 'metadata'
      a.onloadedmetadata = () => { setDuration(a.duration || 0); a.remove() }
      a.onerror = () => a.remove()
      a.src = URL.createObjectURL(f)
    } catch {}
  }

  async function handlePreview() {
    if (!file) { setError('Pilih file audio dulu!'); return }
    setLoading(true); setLoadText('Memproses audio...'); setError(''); setPreviewId(null); setPreviewUrl(null); setResult(null)
    try {
      const fd = new FormData()
      fd.append('audio', file)
      fd.append('level', mode)
      fd.append('format', format)
      fd.append('decoyStart', decoyStart ? 'true' : 'false')
      const r = await fetch(`${BYPASS_URL}/api/preview`, { method: 'POST', body: fd })
      const d = await r.json()
      if (d.previewId) {
        setPreviewId(d.previewId)
        setPreviewUrl(d.url)
        if (audioRef.current) { audioRef.current.src = d.url; audioRef.current.load() }
      } else {
        setError(d.error || 'Preview failed')
      }
    } catch (e) {
      setError('Gagal hubung ke server BMS: ' + (e.message || e))
    }
    setLoading(false)
  }

  async function handleUpload() {
    if (!previewId) { setError('Preview dulu audio nya!'); return }
    if (!apiKey) { setError('API Key belum diisi!'); return }
    if (!userId) { setError('User ID belum diisi!'); return }

    setLoading(true); setLoadText('Mengupload ke Roblox...'); setError(''); setResult(null)
    try {
      const fd = new FormData()
      fd.append('previewId', previewId)
      fd.append('apiKey', apiKey)
      fd.append('displayName', (file?.name || 'Audio').replace(/\.[^.]+$/, '').slice(0, 50))
      fd.append('description', `Uploaded via BMS Studio — Mode: ${mode}`)
      fd.append('userId', userId)

      const r = await fetch(`${BYPASS_URL}/api/upload-roblox`, { method: 'POST', body: fd })
      const d = await r.json()
      if (d.success) {
        setResult({ assetId: d.assetId, url: d.url })
      } else {
        setError(d.error || 'Upload gagal')
      }
    } catch (e) {
      setError('Gagal upload: ' + (e.message || e))
    }
    setLoading(false)
  }

  function saveKey() {
    setLS(API_KEY_STORAGE, apiKey)
    setLS(USER_ID_STORAGE, userId)
    setResult({ saved: true })
    setTimeout(() => setResult(null), 2000)
  }

  return (
    <div className="page-pad">
      <SectionHead
        kicker="// studio"
        title="Bypass Audible Magic"
        sub="Upload audio, proses dengan FFmpeg untuk bypass Audible Magic, lalu upload ke Roblox."
      >
        <StatusBadge variant="gold" dot>Bypass</StatusBadge>
      </SectionHead>

      {error && <div className="mb-4"><ErrorBox title="Error" message={error} /></div>}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Main */}
        <div className="lg:col-span-2 space-y-4">
          {/* File */}
          <div className="panel p-4">
            <div className="card-title mb-3">File Audio</div>
            <div
              className="border-2 border-dashed border-white/10 bg-jet/30 p-8 text-center cursor-pointer hover:border-gold/40 hover:bg-gold/5 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept="audio/*" className="hidden"
                onChange={e => e.target.files?.[0] && selectFile(e.target.files[0])} />
              <div className="text-2xl mb-1 opacity-40">🎵</div>
              {file ? (
                <div>
                  <div className="font-bold text-white text-sm">{file.name}</div>
                  <div className="text-[10px] font-mono text-white/40 mt-1">{fmtBytes(file.size)} {duration ? '· ' + fmtTime(Math.round(duration)) : ''}</div>
                </div>
              ) : (
                <div>
                  <div className="font-bold text-white text-sm">Klik atau drop file audio</div>
                  <div className="text-[10px] font-mono text-white/40 mt-1">mp3 · wav · ogg · flac · m4a</div>
                </div>
              )}
            </div>
          </div>

          {/* Mode + options */}
          <div className="panel p-4">
            <div className="card-title mb-3">Mode Bypass &amp; Format</div>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <label className="text-[9px] font-mono uppercase text-white/40 tracking-wider block mb-1">Mode</label>
                <select value={mode} onChange={e => { setMode(e.target.value); setLS(BYPASS_MODE_KEY, e.target.value) }}
                  className="input text-xs font-mono">
                  {BYPASS_MODES.map(m => <option key={m.id} value={m.id}>{m.label} — {m.desc}</option>)}
                </select>
              </div>
              <div className="w-28">
                <label className="text-[9px] font-mono uppercase text-white/40 tracking-wider block mb-1">Format</label>
                <select value={format} onChange={e => setFormat(e.target.value)} className="input text-xs font-mono">
                  <option value="ogg">OGG</option>
                  <option value="mp3">MP3</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={decoyStart} onChange={e => setDecoyStart(e.target.checked)}
                className="accent-gold" style={{ width: 14, height: 14 }} />
              <span className="text-[11px] text-white/60">Tambah 4 detik silence di awal (Decoy Start)</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={handlePreview} disabled={loading || !file} className="btn-primary btn flex-1">
              {loading && loadText.includes('Proses') ? '⏳' : <UploadCloud size={13} />} Preview
            </button>
            <button onClick={handleUpload} disabled={loading || !previewId} className="btn btn flex-1"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>
              {loading && loadText.includes('Upload') ? '⏳' : <Upload size={13} />} Upload ke Roblox
            </button>
          </div>

          {/* Progress */}
          {loading && (
            <div className="panel p-3 text-center">
              <div className="h-1 bg-white/5 rounded mb-2 overflow-hidden">
                <div className="h-full bg-gold rounded" style={{ width: '100%', animation: 'pulse 1.5s infinite' }} />
              </div>
              <div className="text-[11px] font-mono text-white/50">{loadText}</div>
            </div>
          )}

          {/* Player */}
          {previewUrl && (
            <div className="panel p-3">
              <div className="flex items-center gap-2 mb-2">
                <Music2 size={12} className="text-gold" />
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Preview</span>
              </div>
              <audio ref={audioRef} controls preload="auto" className="w-full" style={{ borderRadius: 4 }} />
            </div>
          )}

          {/* Result */}
          {result && result.assetId && (
            <div className="panel p-3" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
              <div className="text-emerald-400 font-bold text-sm mb-1">✓ Upload Berhasil!</div>
              <div className="text-[11px] font-mono text-white/60">Asset ID: {result.assetId}</div>
              {result.url && (
                <a href={result.url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-gold text-[11px] mt-2 hover:underline">
                  Lihat di Roblox <ExternalLink size={10} />
                </a>
              )}
            </div>
          )}
          {result && result.saved && (
            <div className="text-emerald-400 text-[11px] font-mono">API Key saved!</div>
          )}
        </div>

        {/* Settings sidebar */}
        <div className="space-y-3">
          {/* Server info */}
          <div className="panel p-4">
            <div className="card-title flex items-center gap-2"><ShieldAlert size={13} className="text-gold" /> Server</div>
            <div className="mt-2 text-[10px] font-mono text-white/50">Pastikan BMS Upload server berjalan di:</div>
            <div className="mt-1 text-xs font-mono text-gold">{BYPASS_URL}</div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span className="text-[10px] font-mono text-white/40">Server BMS Upload</span>
            </div>
          </div>

          {/* API Key */}
          <div className="panel p-4">
            <div className="card-title flex items-center gap-2">
              <KeyRound size={13} className="text-gold" /> Roblox API Key
              {apiKey ? <StatusBadge variant="success" dot>saved</StatusBadge> : <StatusBadge variant="destructive" dot>missing</StatusBadge>}
            </div>
            <div className="mt-3 space-y-2">
              <label className="text-[9px] font-mono uppercase text-white/40 tracking-wider block">API Key</label>
              <div className="flex gap-1.5">
                <input type={showKey ? 'text' : 'password'} value={apiKey}
                  onChange={e => setApiKeyState(e.target.value)}
                  placeholder="rbx_..." className="input text-xs flex-1 min-w-0 font-mono" />
                <button onClick={() => setShowKey(s => !s)} className="btn-ghost btn-xs">
                  {showKey ? <EyeOff size={11} /> : <Eye size={11} />}
                </button>
              </div>
              <label className="text-[9px] font-mono uppercase text-white/40 tracking-wider block pt-1">User ID</label>
              <input value={userId} onChange={e => setUserIdState(e.target.value)}
                placeholder="12345678" className="input text-xs font-mono" />
              <button onClick={saveKey} className="btn-primary btn-xs btn-full">
                <KeyRound size={11} /> Save
              </button>
            </div>
          </div>

          {/* Tips */}
          <div className="panel p-4">
            <div className="card-title mb-2">Tips</div>
            <ul className="text-[10px] font-mono text-white/50 space-y-1 list-disc pl-4">
              <li>Server BMS Upload harus jalan di port 3000</li>
              <li>Shield &amp; Stealth = metode spektral baru</li>
              <li>Ringan s/d Extreme = pipeline legacy (EQ + re-encode)</li>
              <li>Buat API Key di create.roblox.com/dashboard/credentials</li>
            </ul>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
      `}</style>
    </div>
  )
}
