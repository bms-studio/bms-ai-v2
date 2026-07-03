/* ============================================================
   Auralis AI v2 - Edit Song / Queue Item
   Displays a single track in the queue with status, progress,
   waveform, and per-item actions.
   ============================================================ */

import { useEffect, useRef, useState } from "react"
import {
  Play, Pause, Music2, Disc3, Trash2, Pencil, Upload,
  Image as ImageIcon, Loader2, CheckCircle2, XCircle, FileAudio
} from "lucide-react"
import StatusBadge from "./StatusBadge.jsx"
import { fmtBytes, fmtTime } from "../../lib/utils.js"

function formatStatus(s) {
  switch (s) {
    case "ready": return "Ready"
    case "editing": return "Editing"
    case "rendering": return "Rendering"
    case "uploading": return "Uploading"
    case "done": return "Uploaded"
    case "error": return "Failed"
    default: return s
  }
}

function statusVariant(s) {
  switch (s) {
    case "ready": return "outline"
    case "editing":
    case "rendering":
    case "uploading": return "gold"
    case "done": return "success"
    case "error": return "destructive"
    default: return "outline"
  }
}

export default function QueueItem({
  item,
  index,
  isCurrent,
  onSelect,
  onEdit,
  onRemove,
  onUpload,
  onTogglePlay,
  isPlaying,
}) {
  const canvasRef = useRef(null)
  const [waveReady, setWaveReady] = useState(false)

  // Draw a simple waveform from the audio buffer (downsampled bars)
  useEffect(() => {
    let mounted = true
    async function draw() {
      const c = canvasRef.current
      if (!c) return
      const url = item.previewUrl || ""
      if (!url) return
      try {
        const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext
        if (!AC) return
        const res = await fetch(url)
        const buf = await res.arrayBuffer()
        const probe = new (window.AudioContext || window.webkitAudioContext)()
        const audio = await probe.decodeAudioData(buf.slice(0))
        if (!mounted) return
        const data = audio.getChannelData(0)
        const bars = 80
        const block = Math.floor(data.length / bars)
        const ctx = c.getContext("2d")
        const w = c.width = c.clientWidth * 2
        const h = c.height = c.clientHeight * 2
        ctx.clearRect(0, 0, w, h)
        ctx.fillStyle = "rgba(245, 158, 11, 0.7)"
        for (let i = 0; i < bars; i++) {
          let peak = 0
          for (let j = 0; j < block; j++) {
            const v = Math.abs(data[i * block + j] || 0)
            if (v > peak) peak = v
          }
          const bh = Math.max(2, peak * h * 0.9)
          const x = (i / bars) * w
          const bw = w / bars - 2
          ctx.fillRect(x, (h - bh) / 2, bw, bh)
        }
        setWaveReady(true)
        try { probe.close() } catch (_) {}
      } catch (_) {
        setWaveReady(false)
      }
    }
    draw()
    return () => { mounted = false }
  }, [item.previewUrl, item.editedBlob, item.file])

  return (
    <div
      className={`panel p-3 transition-colors cursor-pointer ${
        isCurrent ? "border-gold/40" : "hover:border-white/15"
      }`}
      onClick={() => onSelect?.(item.id)}
    >
      <div className="flex items-start gap-3">
        {/* Cover / Icon */}
        <div className="relative w-12 h-12 flex-shrink-0 bg-jet border border-white/10 overflow-hidden">
          {item.coverUrl ? (
            <img src={item.coverUrl} alt="" className="w-full h-12 object-cover" />
          ) : (
            <div className="w-full h-12 flex items-center justify-center text-white/30">
              {item.kind === "url" ? <Disc3 size={18} /> : <FileAudio size={18} />}
            </div>
          )}
          {isCurrent && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <button
                onClick={(e) => { e.stopPropagation(); onTogglePlay?.(item.id) }}
                className="text-gold"
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-[10px] text-white/40">#{String(index + 1).padStart(2, "0")}</div>
            <StatusBadge variant={statusVariant(item.status)} dot>
              {formatStatus(item.status)}
              {typeof item.progress === "number" && item.progress > 0 && item.progress < 100
                ? ` ${item.progress}%` : ""}
            </StatusBadge>
          </div>
          <div className="font-bold text-white text-sm truncate mt-0.5" title={item.name}>
            {item.name}
          </div>
          <div className="text-[10px] font-mono text-white/40 truncate">
            {item.artist || "Unknown artist"} · {fmtTime(item.duration || 0)} · {fmtBytes(item.size || 0)}
          </div>
          {item.uploadedAssetId && (
            <div className="text-[10px] font-mono text-emerald-400/80 mt-0.5 truncate">
              ✓ asset {item.uploadedAssetId}
            </div>
          )}
        </div>
      </div>

      {/* Waveform / progress bar */}
      <div className="mt-2 h-8 bg-white/5 relative overflow-hidden">
        {item.status === "uploading" || item.status === "rendering" ? (
          <div className="absolute inset-0 flex items-center justify-center text-gold">
            <Loader2 size={14} className="animate-spin" />
          </div>
        ) : null}
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ opacity: waveReady ? 1 : 0.2 }}
        />
        {item.status === "uploading" && (
          <div
            className="absolute bottom-0 left-0 h-0.5 bg-gold transition-all"
            style={{ width: `${item.progress || 0}%` }}
          />
        )}
        {item.status === "done" && (
          <div className="absolute top-1 right-1 text-emerald-400">
            <CheckCircle2 size={12} />
          </div>
        )}
        {item.status === "error" && (
          <div className="absolute top-1 right-1 text-red-400">
            <XCircle size={12} />
          </div>
        )}
      </div>

      {item.error && (
        <div className="mt-2 text-[10px] font-mono text-red-400/80 break-words line-clamp-2">
          {item.error}
        </div>
      )}

      {/* Actions */}
      <div className="mt-2 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePlay?.(item.id) }}
            className="btn-ghost btn-xs"
            title={isPlaying ? "Pause" : "Play preview"}
          >
            {isPlaying ? <Pause size={11} /> : <Play size={11} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit?.(item.id) }}
            className="btn-ghost btn-xs"
            title="Edit (pitch/speed/trim)"
          >
            <Pencil size={11} /> Edit
          </button>
        </div>
        <div className="flex items-center gap-1">
          {item.status === "done" ? (
            <a
              href={item.playbackUrl}
              target="_blank" rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="btn-ghost btn-xs text-emerald-300"
              title="Open on Roblox"
            >
              <ImageIcon size={11} /> Open
            </a>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onUpload?.(item.id) }}
              disabled={item.status === "uploading" || item.status === "rendering"}
              className="btn-primary btn-xs"
              title="Upload to Roblox"
            >
              <Upload size={11} /> Upload
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove?.(item.id) }}
            className="btn-ghost btn-xs text-red-300"
            title="Remove from queue"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Edit badge */}
      {item.edited && (
        <div className="mt-2 flex items-center gap-1.5 text-[9px] font-mono text-gold/80">
          <Music2 size={9} /> edited · {item.editMeta?.speed?.toFixed(2)}x
          {item.editMeta?.pitch ? ` · pitch ${item.editMeta.pitch >= 0 ? "+" : ""}${item.editMeta.pitch}st` : ""}
        </div>
      )}
    </div>
  )
}