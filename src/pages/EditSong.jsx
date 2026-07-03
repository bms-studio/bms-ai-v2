import { useEffect, useRef, useState } from "react"
import {
  Music,
  Upload,
  Link2,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  FileAudio,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react"
import StatusBadge from "../components/StatusBadge.jsx"
import { SectionHead, ErrorBox } from "../components/UI.jsx"
import { useToast } from "../state/ToastContext.jsx"
import { EDIT_SONG } from "../config/endpoints.js"
import { fileToURL, copyText } from "../lib/utils.js"
import {
  validateRobloxApiKey,
  validateAudioFile,
  uploadAudioToRoblox,
  pollAudioOperation,
  buildSynoxDownloadUrl,
  pickAudioFromSynox,
} from "../lib/roblox.js"

const STORAGE = {
  key: "bms_auralis_roblox_apikey",
  userId: "bms_auralis_roblox_userid",
}

function fmtSize(mb) {
  if (mb == null) return "-"
  return `${mb.toFixed(2)} MB`
}

function fmtDur(sec) {
  if (sec == null) return "-"
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

export default function EditSong() {
  const toast = useToast()

  // Persisted settings
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE.key) || "")
  const [userId, setUserId] = useState(() => localStorage.getItem(STORAGE.userId) || "")
  const [showKey, setShowKey] = useState(false)
  const [keyValid, setKeyValid] = useState(null) // null | true | false
  const [keyError, setKeyError] = useState("")

  // Source: file or url
  const [sourceTab, setSourceTab] = useState("file") // "file" | "url"
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [fileMeta, setFileMeta] = useState(null) // { sizeMB, duration }
  const [targetUrl, setTargetUrl] = useState("")

  // Asset meta
  const [displayName, setDisplayName] = useState("")
  const [description, setDescription] = useState("")

  // Pipeline state: idle | validating | uploading | moderating | success | failed
  const [stage, setStage] = useState("idle")
  const [stageMsg, setStageMsg] = useState("")
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const [result, setResult] = useState(null) // { assetId, url, filename }

  const cancelRef = useRef({ cancelled: false })

  // Persist settings
  useEffect(() => { localStorage.setItem(STORAGE.key, apiKey) }, [apiKey])
  useEffect(() => { localStorage.setItem(STORAGE.userId, userId) }, [userId])

  // File preview lifecycle
  useEffect(() => {
    if (!file) { setPreviewUrl(""); setFileMeta(null); return
    }
    const url = fileToURL(file)
    setPreviewUrl(url)
    return () => { try { URL.revokeObjectURL(url) } catch (_) {} }
  }, [file])

  // Whenever the user changes the file, sync the default displayName
  useEffect(() => {
    if (file && !displayName) {
      setDisplayName(file.name.replace(/\.[^.]+$/, "").slice(0, 50))
    }
  }, [file, displayName])

  // Reset pipeline on input change
  useEffect(() => {
    setStage("idle"); setStageMsg(""); setProgress(0)
    setError(""); setResult(null)
    cancelRef.current.cancelled = false
  }, [file, targetUrl, sourceTab])

  // ---------- handlers ----------

  function onPick(f) { setFile(f || null) }

  async function checkKey() {
    if (!apiKey.trim()) {
      setKeyValid(false); setKeyError("API key is empty.")
      return
    }
    setKeyValid(null); setKeyError("")
    const r = await validateRobloxApiKey(apiKey)
    if (r.ok) {
      setKeyValid(true); toast.success("API key valid")
    } else {
      setKeyValid(false); setKeyError(r.error || "Invalid")
      toast.error("API key invalid", r.error || "Check your key")
    }
  }

  function reset() {
    cancelRef.current.cancelled = true
    setStage("idle"); setStageMsg(""); setProgress(0)
    setError(""); setResult(null)
  }

  async function ensureFile() {
    if (sourceTab === "file") {
      if (!file) throw new Error("Pick an audio file first.")
      const v = await validateAudioFile(file)
      if (!v.ok) throw new Error(v.reason)
      setFileMeta({ sizeMB: v.sizeMB, duration: v.duration })
      return file
    }
    // url source
    if (!targetUrl.trim()) throw new Error("Paste a target URL first.")
    setStage("downloading"); setStageMsg("Resolving audio URL...")
    const dl = await fetch(buildSynoxDownloadUrl(targetUrl.trim()))
    if (!dl.ok) throw new Error(`Synox ${dl.status}: ${await dl.text().catch(() => "")}`)
    const j = await dl.json()
    const picked = pickAudioFromSynox(j)
    if (!picked) throw new Error("No downloadable audio URL found in the response.")
    setStage("downloading"); setStageMsg("Downloading audio...")
    const r = await fetch(picked.url)
    if (!r.ok) throw new Error(`Failed to fetch audio: HTTP ${r.status}`)
    const blob = await r.blob()
    const mime = blob.type || "audio/mpeg"
    const filename = picked.filename || "audio.mp3"
    const f = new File([blob], filename, { type: mime })
    const v = await validateAudioFile(f)
    if (!v.ok) throw new Error(v.reason)
    setFileMeta({ sizeMB: v.sizeMB, duration: v.duration })
    setFile(f)
    if (!displayName) {
      setDisplayName(filename.replace(/\.[^.]+$/, "").slice(0, 50))
    }
    return f
  }

  async function submit() {
    setError(""); setResult(null); setProgress(0)
    cancelRef.current = { cancelled: false }
    if (!apiKey.trim()) { setError("Roblox Open Cloud API key is required."); return }
    if (!userId.trim()) { setError("Creator UserId is required."); return }
    if (!displayName.trim()) { setError("Display name is required."); return }
    try {
      // 1) ensure file
      setStage("validating"); setStageMsg("Checking file...")
      const f = await ensureFile()
      if (cancelRef.current.cancelled) return

      // 2) upload
      setStage("uploading"); setStageMsg("Uploading to Roblox...")
      const up = await uploadAudioToRoblox({
        apiKey, file: f, displayName, description, userId: userId.trim(),
      })
      if (cancelRef.current.cancelled) return

      if (!up.needsPolling && up.assetId) {
        setProgress(100)
        setStage("success"); setStageMsg("Approved instantly.")
        setResult({ assetId: up.assetId, filename: f.name })
        toast.success("Audio approved", `ID ${up.assetId}`)
        return
      }

      // 3) poll moderation
      setStage("moderating"); setStageMsg("Waiting for Roblox moderation...")
      const poll = await pollAudioOperation(apiKey, up.operationId, {
        timeoutMs: EDIT_SONG.pollTimeoutMs,
        intervalMs: EDIT_SONG.pollIntervalMs,
        onTick: ({ state }) => {
          if (cancelRef.current.cancelled) return
          // small UI feedback even when not done
          setStageMsg(`Moderation: ${state}...`)
        },
      })
      if (cancelRef.current.cancelled) return
      if (poll.done && poll.assetId) {
        setProgress(100)
        setStage("success"); setStageMsg("Approved!")
        setResult({ assetId: poll.assetId, filename: f.name })
        toast.success("Audio approved", `ID ${poll.assetId}`)
      } else if (poll.done && poll.failed) {
        setStage("failed"); setError(poll.error || "Operation failed.")
        toast.error("Audio rejected", poll.error || "Operation failed.")
      } else {
        setStage("failed"); setError("Timed out waiting for Roblox moderation.")
        toast.error("Timeout", "Roblox moderation took too long.")
      }
    } catch (err) {
      if (cancelRef.current.cancelled) return
      setStage("failed"); setError(err.message || String(err))
      toast.error("Upload failed", err.message || "error")
    }
  }

  const limits = EDIT_SONG.robloxLimits
  const canSubmit =
    apiKey.trim() && userId.trim() && displayName.trim() &&
    (sourceTab === "file" ? !!file : !!targetUrl.trim()) &&
    !["uploading", "moderating", "downloading", "validating"].includes(stage)

  const stageBadge = (() => {
    switch (stage) {
      case "uploading": return <StatusBadge variant="info" dot>Uploading</StatusBadge>
      case "downloading": return <StatusBadge variant="info" dot>Downloading</StatusBadge>
      case "validating": return <StatusBadge variant="info" dot>Validating</StatusBadge>
      case "moderating": return <StatusBadge variant="info" dot>Moderation</StatusBadge>
      case "success": return <StatusBadge variant="success" dot>Approved</StatusBadge>
      case "failed": return <StatusBadge variant="destructive" dot>Failed</StatusBadge>
      default: return <StatusBadge variant="outline">Idle</StatusBadge>
    }
  })()

  return (
    <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto">
      <SectionHead
        kicker="// roblox"
        title="Edit Song"
        sub={`Upload audio to Roblox audio library via Open Cloud (max ${limits.maxSizeMB}MB / ${limits.maxDurationSec}s).`}
      >
        {stageBadge}
      </SectionHead>

      <div className="grid md:grid-cols-3 gap-6">
        {/* LEFT: input */}
        <div className="md:col-span-1 space-y-4">
          {/* Tabs */}
          <div className="panel p-1 flex">
            {[
              { id: "file", label: "Local File", icon: FileAudio },
              { id: "url", label: "From URL", icon: Link2 },
            ].map(t => {
              const Icon = t.icon
              const active = sourceTab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setSourceTab(t.id)}
                  className={
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-mono uppercase tracking-wider rounded transition-colors " +
                    (active
                      ? "bg-gold/10 text-gold"
                      : "text-white/50 hover:text-white hover:bg-white/5")
                  }
                >
                  <Icon size={12} />
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* File picker */}
          {sourceTab === "file" && (
            <label className="block">
              <div className="card-title mb-1.5">Audio file</div>
              <div className="panel p-3 border-dashed hover:border-gold/40 transition-colors cursor-pointer relative min-h-[180px] flex items-center justify-center">
                <input
                  type="file"
                  accept={EDIT_SONG.formats.map(f => f.mime).join(",") + ",.mp3,.ogg,.wav,.flac"}
                  onChange={(e) => onPick(e.target.files?.[0] || null)}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                {previewUrl ? (
                  <div className="w-full">
                    <div className="flex items-center gap-2 mb-2 text-[11px] font-mono text-white/60 break-all">
                      <FileAudio size={12} className="text-gold shrink-0" />
                      {file?.name}
                    </div>
                    <audio src={previewUrl} controls className="w-full" />
                    <div className="text-[10px] font-mono text-white/40 mt-2 flex justify-between">
                      <span>{fmtSize(fileMeta?.sizeMB)}</span>
                      <span>{fmtDur(fileMeta?.duration)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Upload size={24} className="text-gold mx-auto mb-2" />
                    <div className="font-mono text-sm text-white">Drop or click</div>
                    <div className="text-[10px] text-white/40 mt-1 font-mono">
                      MP3 / OGG / WAV / FLAC
                    </div>
                  </div>
                )}
              </div>
            </label>
          )}

          {/* URL picker */}
          {sourceTab === "url" && (
            <div>
              <div className="card-title mb-1.5">Target URL</div>
              <div className="panel p-3">
                <input
                  type="url"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-transparent text-sm font-mono text-white placeholder-white/30 outline-none"
                />
                <div className="text-[10px] font-mono text-white/40 mt-2">
                  Resolves via {EDIT_SONG.downloader.name}
                </div>
              </div>
            </div>
          )}

          {/* Display name + description */}
          <div>
            <div className="card-title mb-1.5">Display name</div>
            <div className="panel p-3">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="My awesome song"
                maxLength={50}
                className="w-full bg-transparent text-sm font-mono text-white placeholder-white/30 outline-none"
              />
              <div className="text-[10px] font-mono text-white/30 mt-1 text-right">
                {displayName.length}/50
              </div>
            </div>
          </div>

          <div>
            <div className="card-title mb-1.5">Description (optional)</div>
            <div className="panel p-3">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional caption..."
                maxLength={200}
                rows={2}
                className="w-full bg-transparent text-xs font-mono text-white placeholder-white/30 outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* RIGHT: settings + result */}
        <div className="md:col-span-2 space-y-4">
          {/* Credentials */}
          <div className="panel p-4">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound size={14} className="text-gold" />
              <div className="card-title !mb-0">Roblox Open Cloud credentials</div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] font-mono uppercase text-white/40 mb-1">API Key</div>
                <div className="panel p-2 flex items-center gap-1">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); setKeyValid(null) }}
                    placeholder="rbx_..."
                    className="flex-1 bg-transparent text-xs font-mono text-white placeholder-white/30 outline-none"
                  />
                  <button onClick={() => setShowKey(s => !s)} className="btn-ghost btn-xs">
                    {showKey ? <EyeOff size={11} /> : <Eye size={11} />}
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button onClick={checkKey} className="btn-ghost btn-xs" disabled={!apiKey.trim()}>
                    Test key
                  </button>
                  {keyValid === true && (
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={10} /> Valid
                    </span>
                  )}
                  {keyValid === false && (
                    <span className="text-[10px] font-mono text-destructive flex items-center gap-1">
                      <AlertTriangle size={10} /> {keyError || "Invalid"}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase text-white/40 mb-1">Creator UserId</div>
                <div className="panel p-2">
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="12345678"
                    className="w-full bg-transparent text-xs font-mono text-white placeholder-white/30 outline-none"
                  />
                </div>
                <div className="text-[10px] font-mono text-white/30 mt-1">
                  Numeric Roblox user ID of the audio owner.
                </div>
              </div>
            </div>
          </div>

          {/* Pipeline panel */}
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="card-title !mb-0 flex items-center gap-2">
                <Music size={14} className="text-gold" />
                Upload pipeline
              </div>
              {stage !== "idle" && stage !== "success" && (
                <button onClick={reset} className="btn-ghost btn-xs">
                  <RotateCcw size={10} /> Reset
                </button>
              )}
            </div>

            {/* Progress */}
            {["uploading", "moderating", "downloading", "validating"].includes(stage) && (
              <div className="mb-3">
                <div className="h-1.5 bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gold transition-all"
                    style={{
                      width:
                        stage === "uploading" ? "55%"
                        : stage === "moderating" ? "80%"
                        : stage === "downloading" ? "30%"
                        : "10%",
                    }}
                  />
                </div>
                <div className="text-[10px] font-mono text-white/50 mt-1">{stageMsg}</div>
              </div>
            )}

            {error && <ErrorBox>{error}</ErrorBox>}

            {/* Result */}
            {result && (
              <div className="border border-emerald-500/30 bg-emerald-500/5 p-3">
                <div className="flex items-center gap-2 mb-2 text-emerald-400 text-xs font-mono">
                  <CheckCircle2 size={12} />
                  Audio approved & uploaded
                </div>
                <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Asset ID</div>
                <div className="font-mono text-sm text-white mb-2 break-all">{result.assetId}</div>
                <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-1">Library URL</div>
                <div className="font-mono text-[11px] text-white/70 break-all mb-3">
                  {`https://www.roblox.com/library/${result.assetId}`}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => copyText(`https://www.roblox.com/library/${result.assetId}`)}
                    className="btn-primary btn-sm"
                  >
                    <Copy size={11} /> Copy URL
                  </button>
                  <button
                    onClick={() => copyText(result.assetId)}
                    className="btn-ghost btn-sm"
                  >
                    <Copy size={11} /> Copy ID
                  </button>
                  <a
                    href={`https://www.roblox.com/library/${result.assetId}`}
                    target="_blank" rel="noreferrer"
                    className="btn-ghost btn-sm"
                  >
                    <ExternalLink size={11} /> Open on Roblox
                  </a>
                  <button onClick={reset} className="btn-ghost btn-sm">
                    <Upload size={11} /> New upload
                  </button>
                </div>
              </div>
            )}

            {/* Submit */}
            {!result && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={submit}
                  disabled={!canSubmit}
                  className="btn-primary btn-lg"
                >
                  <Upload size={14} />
                  {stage === "uploading" ? "Uploading..."
                    : stage === "moderating" ? "Waiting moderation..."
                    : stage === "downloading" ? "Downloading..."
                    : "Upload to Roblox"}
                </button>
                <div className="text-[10px] font-mono text-white/40">
                  Limits: {EDIT_SONG.formats.map(f => f.label).join(" / ")} - up to {limits.maxSizeMB}MB / {limits.maxDurationSec}s.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}