import { useEffect, useMemo, useState } from "react"
import {
  Link2, Loader2, Search, Download, ExternalLink, Copy,
  RotateCcw, AlertTriangle, ChevronDown, ChevronUp, CheckCircle2,
  X, Maximize2, Play, Image as ImageIcon, Music
} from "lucide-react"
import { AIO_DOWNLOADER } from "../config/endpoints.js"
import { useToast } from "../state/ToastContext.jsx"
import {
  SectionHead, EmptyState, ErrorBox, ResultCard, CodeBlock
} from "../components/UI.jsx"
import StatusBadge from "../components/StatusBadge.jsx"
import { cn } from "../lib/utils.js"

/* ----------------------------------------------------------------
   Extract a list of downloadable media items from ANY response shape
   the Synox all-in-one endpoint has been observed to return:
     - { status, result: "https://..." }                         (string)
     - { status, result: { url, format, quality, ... } }        (object)
     - { status, result: { data: [ {...}, {...} ] } }            (object+data)
     - { status, data:   [ {...}, ... ] }                        (top-level data)
     - { status, data:   { url, format, ... } }                  (single obj)
     - { status, urls:   [..] } / { downloads: [..] }
     - { status, video, audio, image }                           (multi-field)
   Each item is normalized to { url, quality, format, ext, raw }.
   ---------------------------------------------------------------- */
function extractMedia(payload) {
  if (payload == null) return []

  // Some adapters wrap the original API body inside payload.data
  const root = (payload && typeof payload === "object" && payload.data && typeof payload.data === "object" && !Array.isArray(payload.data))
    ? payload.data
    : payload

  // 1) direct array anywhere in the tree
  const findArray = (obj, depth = 0) => {
    if (depth > 4 || obj == null || typeof obj !== "object") return null
    if (Array.isArray(obj)) return obj
    for (const k of ["data", "result", "urls", "downloads", "medias", "items", "files"]) {
      const v = obj[k]
      if (Array.isArray(v)) return v
      if (v && typeof v === "object") {
        const nested = findArray(v, depth + 1)
        if (nested) return nested
      }
    }
    return null
  }

  // 2) find a string that looks like a media URL
  const findUrlString = (obj, depth = 0) => {
    if (depth > 4 || obj == null) return null
    if (typeof obj === "string") {
      const s = obj.trim()
      if (/^https?:\/\/\S+\.(mp4|webm|mov|m4a|mp3|wav|jpg|jpeg|png|webp|gif)(\?|$)/i.test(s)) return s
      if (/^https?:\/\/\S+/.test(s)) return s
      return null
    }
    if (typeof obj !== "object") return null
    for (const k of ["url", "video", "audio", "image", "videoUrl", "audioUrl", "download", "link", "src"]) {
      if (typeof obj[k] === "string") {
        const s = obj[k].trim()
        if (/^https?:\/\//.test(s)) return s
      }
    }
    for (const k of Object.keys(obj)) {
      const r = findUrlString(obj[k], depth + 1)
      if (r) return r
    }
    return null
  }

  // helper: try to coerce a single candidate object → normalized item
  const coerce = (raw) => {
    if (raw == null) return null
    if (typeof raw === "string") {
      const s = raw.trim()
      if (!/^https?:\/\//.test(s)) return null
      return { url: s, quality: guessQuality(s), format: guessFormat(s), ext: guessExt(s), raw }
    }
    if (typeof raw !== "object") return null
    // has explicit url-like field
    const urlField =
      raw.url || raw.video || raw.audio || raw.image ||
      raw.videoUrl || raw.audioUrl || raw.download || raw.link || raw.src
    if (typeof urlField === "string" && /^https?:\/\//.test(urlField.trim())) {
      const url = urlField.trim()
      return {
        url,
        quality: raw.quality || raw.resolution || raw.label || guessQuality(url),
        format:  raw.format  || raw.type     || raw.mime   || guessFormat(url),
        ext:     raw.ext     || guessExt(url),
        raw
      }
    }
    // last resort: scan recursively for a string
    const found = findUrlString(raw)
    if (found) {
      return { url: found, quality: raw.quality, format: raw.format, ext: guessExt(found), raw }
    }
    return null
  }

  // try array first
  const arr = findArray(root)
  if (arr) {
    const out = []
    for (const item of arr) {
      const m = coerce(item)
      if (m) out.push(m)
    }
    if (out.length) return out
  }

  // then single object
  if (root && typeof root === "object") {
    const m = coerce(root)
    if (m) return [m]
  }

  // then string fallback
  if (typeof root === "string") {
    const m = coerce(root)
    if (m) return [m]
  }
  return []
}

function guessFormat(url) {
  const m = url.match(/\.(mp4|webm|mov|m4a|mp3|wav|jpg|jpeg|png|webp|gif)(?:\?|$)/i)
  return m ? m[1].toLowerCase() : "—"
}
function guessExt(url) {
  const m = url.match(/\.([a-z0-9]{2,5})(?:\?|$)/i)
  return m ? m[1].toLowerCase() : ""
}
function guessQuality(url) {
  // Try to pull a quality token from common CDN URL patterns
  const patterns = [/_(\d{3,4}p)\b/i, /(\d{3,4}x\d{3,4})/i, /quality[=_](\w+)/i, /[?&]q=(\w+)/i]
  for (const re of patterns) {
    const m = url.match(re)
    if (m) return m[1].toString()
  }
  return ""
}

function isValidMediaUrl(u) {
  if (typeof u !== "string") return false
  try { new URL(u); return true } catch { return false }
}

/* ---------------------------------------------------------------- */

export default function Downloaders() {
  const toast = useToast()
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [payload, setPayload] = useState(null)     // raw response
  const [items, setItems]   = useState([])         // normalized media items
  const [picked, setPicked] = useState(null)       // selected quick-pick
  const [showRaw, setShowRaw] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState(-1)
  const [playingIdx, setPlayingIdx] = useState(-1) // currently in-line playing video/audio
  const [expandedIdx, setExpandedIdx] = useState(-1) // video expanded inline (adaptive size)
  const [lightbox, setLightbox]     = useState(null) // { url, kind } for full-screen preview
  const [videoMeta, setVideoMeta]   = useState({})    // { idx: { w, h, ratio } } from onLoadedMetadata

  // auto-select first quick-pick
  useEffect(() => {
    if (!picked && AIO_DOWNLOADER.quickPicks?.length) {
      setPicked(AIO_DOWNLOADER.quickPicks[0])
    }
  }, [picked])

  // Esc closes lightbox
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e) => { if (e.key === "Escape") setLightbox(null) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [lightbox])

  const handleFetch = async (overrideUrl) => {
    const target = (overrideUrl ?? url).trim()
    if (!target) {
      toast.warn("URL kosong", "Tempel link video terlebih dahulu.")
      return
    }
    if (!isValidMediaUrl(target)) {
      toast.error("URL tidak valid", `Periksa kembali link yang Anda masukkan.`)
      setError(`URL tidak valid: "${target}"`)
      return
    }
    setLoading(true)
    setError(null)
    setPayload(null)
    setItems([])
    setPlayingIdx(-1)
    setExpandedIdx(-1)
    try {
      const endpoint = `${AIO_DOWNLOADER.base}${AIO_DOWNLOADER.path}?url=${encodeURIComponent(target)}`
      const res = await fetch(endpoint, { method: AIO_DOWNLOADER.method })
      const text = await res.text()
      let body
      try { body = JSON.parse(text) } catch { body = { raw: text } }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} — ${res.statusText || "request failed"}`)
      }

      setPayload(body)

      // Walk: result may be string, object, array, or nested
      const media = extractMedia(body)
      if (!media.length) {
        const msg = "Tidak ada media yang bisa diunduh dari respons ini."
        setError(msg)
        toast.warn("Tidak ada media", msg)
        setItems([])
      } else {
        setItems(media)
        toast.success(
          "Berhasil",
          `${media.length} media ditemukan dari ${guessHost(target)}`
        )
      }
    } catch (e) {
      const msg = e?.message || "Gagal menghubungi server."
      setError(msg)
      toast.error("Gagal fetch", msg)
    } finally {
      setLoading(false)
    }
  }

  const handleQuickPick = (qp) => {
    setPicked(qp)
    setUrl(qp.sample)
    handleFetch(qp.sample)
  }

  const handleReset = () => {
    setUrl("")
    setError(null)
    setPayload(null)
    setItems([])
    setShowRaw(false)
    setCopiedIdx(-1)
    setPlayingIdx(-1)
    setExpandedIdx(-1)
    setLightbox(null)
    setVideoMeta({})
  }

  const handleCopy = async (val, idx) => {
    try {
      await navigator.clipboard.writeText(val)
      setCopiedIdx(idx)
      toast.success("Tersalin", "URL disalin ke clipboard.")
      setTimeout(() => setCopiedIdx(-1), 1500)
    } catch {
      toast.error("Gagal menyalin", "Clipboard tidak tersedia.")
    }
  }

  const stats = useMemo(() => {
    const total = items.length
    const videos = items.filter(i => /\.(mp4|webm|mov|m4a)(\?|$)/i.test(i.url) || /video/i.test(i.format || "")).length
    const audios = items.filter(i => /\.(mp3|wav|m4a)(\?|$)/i.test(i.url) || /audio/i.test(i.format || "")).length
    const images = items.filter(i => /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(i.url) || /image/i.test(i.format || "")).length
    return { total, videos, audios, images }
  }, [items])

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <SectionHead
        kicker="// all-in-one downloader"
        title="All-Site Downloader"
        sub={`Tempel link dari ${AIO_DOWNLOADER.supportedPlatforms.length}+ platform yang didukung dan unduh dalam berbagai kualitas.`}
      >
        {loading && <StatusBadge variant="warning" dot>fetching</StatusBadge>}
        {!loading && items.length > 0 && <StatusBadge variant="success" dot>{items.length} item</StatusBadge>}
        {!loading && !items.length && !error && <StatusBadge variant="secondary" dot>idle</StatusBadge>}
      </SectionHead>

      {/* URL input */}
      <ResultCard className="mb-4">
        <label className="block">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/70 mb-2 flex items-center gap-2">
            <Link2 size={12} /> Source URL
          </div>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetch()}
              placeholder="https://www.tiktok.com/@user/video/..."
              className={cn(
                "flex-1 bg-jet/70 border border-white/10 px-3 py-2.5",
                "text-sm text-white placeholder-white/30",
                "focus:outline-none focus:border-gold/60 focus:shadow-glow-gold",
                "transition-all"
              )}
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleFetch()}
                disabled={loading}
                className={cn(
                  "px-4 py-2.5 border font-mono text-[11px] uppercase tracking-[0.1em] font-bold",
                  "border-gold/40 bg-gold/10 text-gold hover:bg-gold/20",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "transition-all flex items-center gap-2"
                )}
              >
                {loading
                  ? <><Loader2 size={14} className="animate-spin" /> Fetching…</>
                  : <><Search size={14} /> Fetch</>}
              </button>
              <button
                onClick={handleReset}
                disabled={loading}
                className={cn(
                  "px-3 py-2.5 border font-mono text-[11px] uppercase tracking-[0.1em]",
                  "border-white/10 bg-charcoal text-white/60 hover:text-white hover:border-white/20",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "transition-all flex items-center gap-2"
                )}
              >
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </div>
        </label>
      </ResultCard>

      {/* Quick-picks grid */}
      <div className="mb-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/60 mb-2">
          // quick picks
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {AIO_DOWNLOADER.quickPicks.map((qp) => {
            const active = picked?.id === qp.id
            return (
              <button
                key={qp.id}
                onClick={() => handleQuickPick(qp)}
                disabled={loading}
                className={cn(
                  "panel p-2 flex flex-col items-center gap-1 text-center",
                  "border transition-all hover:border-gold/40",
                  active ? "border-gold/60 bg-gold/5 shadow-glow-gold" : "border-white/5 bg-charcoal/40",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                title={qp.name}
              >
                <div className={cn(
                  "w-9 h-9 flex items-center justify-center",
                  "border font-mono text-[11px] font-bold",
                  active ? "border-gold/50 text-gold bg-gold/10" : "border-white/10 text-white/60 bg-jet/50"
                )}>
                  {qp.icon}
                </div>
                <div className="text-[10px] text-white/60 truncate w-full">{qp.name}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4">
          <ErrorBox title="Fetch failed" message={error} />
        </div>
      )}

      {/* Results */}
      {items.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/60">
              // result · {stats.total} item
              {stats.videos > 0 && ` · ${stats.videos} video`}
              {stats.audios > 0 && ` · ${stats.audios} audio`}
              {stats.images > 0 && ` · ${stats.images} image`}
            </div>
            <button
              onClick={() => setShowRaw((v) => !v)}
              className={cn(
                "text-[10px] font-mono uppercase tracking-[0.1em]",
                "px-2 py-1 border border-white/10 bg-charcoal text-white/60 hover:text-white",
                "flex items-center gap-1 transition-colors"
              )}
            >
              {showRaw ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showRaw ? "hide" : "show"} raw json
            </button>
          </div>

          <div className="space-y-2">
            {items.map((it, idx) => {
              const isVideo = /\.(mp4|webm|mov|m4a)(\?|$)/i.test(it.url) || /video/i.test(it.format || "")
              const isAudio = !isVideo && (/\.(mp3|wav|m4a)(\?|$)/i.test(it.url) || /audio/i.test(it.format || ""))
              const isImage = !isVideo && !isAudio && (/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(it.url) || /image/i.test(it.format || ""))
              const variant = isVideo ? "default" : isAudio ? "info" : isImage ? "success" : "secondary"
              return (
                <div
                  key={idx}
                  className="panel p-3 md:p-4 border-gold/20 bg-charcoal/40"
                >
                  <div className="flex items-start gap-3">
                    {/* Preview */}
        <div
          className={cn(
            "flex-shrink-0 w-16 h-16 border bg-jet/70 flex items-center justify-center overflow-hidden relative group",
            isVideo ? "border-gold/30" : isAudio ? "border-info/30" : isImage ? "border-success/30" : "border-white/10"
          )}
        >
          {isImage ? (
            <>
              {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
              <img
                src={it.url}
                alt="preview"
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = "none" }}
              />
              <button
                onClick={() => setLightbox({ url: it.url, kind: "image" })}
                className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex items-center justify-center"
                title="Perbesar"
              >
                <Maximize2 size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </>
          ) : isVideo ? (
            <>
              <div className="text-gold/80 font-mono text-[10px] font-bold flex flex-col items-center gap-0.5">
                <Play size={14} className="text-gold" />
                <span>VID</span>
              </div>
              {/* Klik → expand panel di bawah (adaptive) */}
              <button
                onClick={() => setExpandedIdx(expandedIdx === idx ? -1 : idx)}
                className="absolute inset-0 bg-black/0 group-hover:bg-gold/20 transition-colors flex items-center justify-center"
                title={expandedIdx === idx ? "Tutup preview" : "Buka preview adaptif"}
              >
                {expandedIdx === idx ? (
                  <ChevronUp size={14} className="text-white opacity-100" />
                ) : (
                  <Maximize2 size={14} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            </>
          ) : isAudio ? (
            playingIdx === idx ? (
              <audio
                src={it.url}
                controls
                autoPlay
                className="w-full h-full"
                onEnded={() => setPlayingIdx(-1)}
                onError={() => setPlayingIdx(-1)}
              />
            ) : (
              <>
                <div className="text-info/80 font-mono text-[10px] font-bold flex flex-col items-center gap-0.5">
                  <Music size={14} className="text-info" />
                  <span>AUD</span>
                </div>
                <button
                  onClick={() => setPlayingIdx(idx)}
                  className="absolute inset-0 bg-black/0 group-hover:bg-info/20 transition-colors flex items-center justify-center"
                  title="Play audio"
                >
                  <Play size={14} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </>
            )
          ) : (
            <div className="text-white/40 font-mono text-[10px] font-bold">FILE</div>
          )}
        </div>

                    {/* Meta + URL */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <StatusBadge variant={variant}>
                          {(it.format || it.ext || "file").toString().toUpperCase()}
                        </StatusBadge>
                        {it.quality && (
                          <StatusBadge variant="outline">{it.quality}</StatusBadge>
                        )}
                        <span className="text-[10px] font-mono text-white/30">
                          #{idx + 1}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-white/60 break-all line-clamp-2">
                        {it.url}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col md:flex-row gap-1.5 flex-shrink-0">
                      <a
                        href={it.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 border border-white/10 bg-jet/50 text-white/70 hover:text-gold hover:border-gold/40 transition-colors"
                        title="Open in new tab"
                      >
                        <ExternalLink size={14} />
                      </a>
                      <a
                        href={it.url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20 transition-colors"
                        title="Download"
                      >
                        <Download size={14} />
                      </a>
                      <button
                        onClick={() => handleCopy(it.url, idx)}
                        className={cn(
                          "p-2 border transition-colors",
                          copiedIdx === idx
                            ? "border-success/40 bg-success/10 text-success"
                            : "border-white/10 bg-jet/50 text-white/70 hover:text-white hover:border-white/30"
                        )}
                        title="Copy URL"
                      >
                        {copiedIdx === idx ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded inline preview (video only) — adaptive size */}
                  {isVideo && expandedIdx === idx && (
                    <div className="mt-3 panel p-3 border-gold/20 bg-jet/40">
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/70 flex items-center gap-2">
                          <Play size={12} className="text-gold" />
                          inline preview
                          {videoMeta[idx] && (
                            <span className="text-white/40 normal-case tracking-normal">
                              · {videoMeta[idx].w}×{videoMeta[idx].h}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setLightbox({ url: it.url, kind: "video" })}
                            className="text-[10px] font-mono uppercase tracking-[0.1em] px-2 py-1 border border-white/10 bg-charcoal text-white/60 hover:text-white hover:border-white/30 flex items-center gap-1 transition-colors"
                            title="Buka di lightbox"
                          >
                            <Maximize2 size={12} /> lightbox
                          </button>
                          <button
                            onClick={() => setExpandedIdx(-1)}
                            className="text-[10px] font-mono uppercase tracking-[0.1em] px-2 py-1 border border-white/10 bg-charcoal text-white/60 hover:text-white hover:border-white/30 flex items-center gap-1 transition-colors"
                            title="Tutup preview"
                          >
                            <ChevronUp size={12} /> tutup
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-center bg-black/60 border border-white/5 max-h-[60vh] overflow-hidden">
                        <video
                          src={it.url}
                          controls
                          autoPlay
                          playsInline
                          className="max-w-full max-h-[60vh] w-auto h-auto"
                          style={{
                            aspectRatio: videoMeta[idx]?.ratio || "16 / 9",
                            width: videoMeta[idx]
                              ? `min(100%, ${Math.min(videoMeta[idx].w, 1280)}px)`
                              : "100%"
                          }}
                          onLoadedMetadata={(e) => {
                            const v = e.currentTarget
                            const w = v.videoWidth || 16
                            const h = v.videoHeight || 9
                            if (w && h) {
                              setVideoMeta((m) => ({ ...m, [idx]: { w, h, ratio: `${w} / ${h}` } }))
                            }
                          }}
                          onError={() => {
                            toast.error("Video error", "Gagal memuat pratinjau video.")
                            setExpandedIdx(-1)
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Raw JSON debug */}
      {showRaw && payload && (
        <div className="mb-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/60 mb-2">
            // raw response
          </div>
          <CodeBlock value={JSON.stringify(payload, null, 2)} />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && items.length === 0 && (
        <EmptyState
          title="Belum ada hasil"
          sub="Tempel link media di atas atau pilih salah satu quick pick untuk mulai mengunduh."
        />
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="panel p-5 border-white/5 bg-charcoal/40">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 size={14} className="animate-spin text-gold" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/70">
              contacting bms studio search…
            </span>
          </div>
          <div className="space-y-2">
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-2/3" />
            <div className="skeleton h-3 w-4/5" />
          </div>
        </div>
      )}

      {/* Lightbox modal */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-[95vw] max-h-[95vh] panel border-gold/30 bg-charcoal shadow-glow-gold"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                {lightbox.kind === "video" ? (
                  <Play size={14} className="text-gold" />
                ) : lightbox.kind === "audio" ? (
                  <Music size={14} className="text-info" />
                ) : (
                  <ImageIcon size={14} className="text-success" />
                )}
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/70">
                  preview · {lightbox.kind}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <a
                  href={lightbox.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20"
                  title="Download"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={14} />
                </a>
                <a
                  href={lightbox.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 border border-white/10 bg-jet/50 text-white/70 hover:text-white"
                  title="Open in new tab"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={14} />
                </a>
                <button
                  onClick={() => setLightbox(null)}
                  className="p-1.5 border border-white/10 bg-jet/50 text-white/70 hover:text-white hover:border-white/30"
                  title="Close (Esc)"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="p-3 max-w-[90vw] max-h-[80vh] overflow-auto flex items-center justify-center bg-black/50">
              {lightbox.kind === "image" && (
                // eslint-disable-next-line jsx-a11y/img-redundant-alt
                <img
                  src={lightbox.url}
                  alt="preview full"
                  className="max-w-full max-h-[78vh] object-contain"
                />
              )}
              {lightbox.kind === "video" && (
                <video
                  src={lightbox.url}
                  controls
                  autoPlay
                  className="max-w-full max-h-[78vh]"
                />
              )}
              {lightbox.kind === "audio" && (
                <div className="w-[min(480px,80vw)] p-6 flex flex-col items-center gap-4">
                  <div className="w-20 h-20 border border-info/40 bg-info/10 flex items-center justify-center">
                    <Music size={32} className="text-info" />
                  </div>
                  <div className="text-xs font-mono text-white/60 break-all text-center max-w-full">
                    {lightbox.url}
                  </div>
                  <audio src={lightbox.url} controls autoPlay className="w-full" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Supported platforms footer */}
      <div className="mt-6 pt-4 border-t border-white/5">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40 mb-2 flex items-center gap-2">
          <AlertTriangle size={12} /> supported platforms
        </div>
        <div className="flex flex-wrap gap-1.5">
          {AIO_DOWNLOADER.supportedPlatforms.map((p) => (
            <span
              key={p}
              className="text-[10px] font-mono px-1.5 py-0.5 border border-white/5 bg-charcoal/40 text-white/50"
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function guessHost(u) {
  try { return new URL(u).hostname.replace(/^www\./, "") } catch { return "source" }
}