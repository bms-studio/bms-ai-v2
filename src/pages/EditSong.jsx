/* ============================================================
   Auralis AI v2 - Edit Song page
   Upload / drop multiple audio files, edit pitch/speed/trim,
   then upload to Roblox as audio assets.
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Upload, Plus, Wand2, UploadCloud, Trash2, Music2,
  X, ChevronRight, Loader2, Link2, Sparkles, FileAudio,
  KeyRound, ExternalLink, Eye, EyeOff, ShieldAlert
} from "lucide-react"
import { SectionHead, EmptyState, ErrorBox } from "../components/UI.jsx"
import StatusBadge from "../components/StatusBadge.jsx"
import EditorModal from "../components/EditorModal.jsx"
import QueueItem from "../components/EditSong/QueueItem.jsx"
import { readID3Cover, readID3Basic } from "../lib/metadata.js"
import { probeAudio, getBlobDuration } from "../lib/audioProcessor.js"
import {
  uploadToRoblox, hasApiKey, getApiKey, setApiKey, getUserId, setUserId
} from "../lib/uploadApi.js"
import { fmtBytes } from "../lib/utils.js"
import { ROBLOX_OPEN_CLOUD } from "../config/endpoints.js"

let __id = 0
const nextId = () => `q_${Date.now()}_${++__id}`

export default function EditSong() {
  const [items, setItems] = useState([])          // queue items
  const [current, setCurrent] = useState(null)    // selected item id
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSource, setEditorSource] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [bulkUploading, setBulkUploading] = useState(false)
  const [remoteUrl, setRemoteUrl] = useState("")
  const [globalError, setGlobalError] = useState("")

  // API key untuk upload langsung ke Roblox Open Cloud (disimpan di localStorage).
  const [apiKey, setApiKeyState] = useState(getApiKey() || "")
  const [showApiKey, setShowApiKey] = useState(false)
  const [robloxUserId, setRobloxUserIdState] = useState(getUserId() || "")
  const [keySaved, setKeySaved] = useState(false)

  // Bypass processing mode (Audible Magic bypass via BMS server)
  const [bypassMode, setBypassMode] = useState(() => localStorage.getItem('bms_bypass_mode') || 'none')
  const [bypassServerUrl, setBypassServerUrl] = useState(() => localStorage.getItem('bms_bypass_url') || 'http://localhost:3000')

  const BYPASS_MODES = [
    { id: 'none', label: 'None', desc: 'Direct upload' },
    { id: 'shield', label: 'Shield', desc: 'Spektral + noise floor' },
    { id: 'stealth', label: 'Stealth', desc: 'Segment-based max' },
    { id: 'ringan', label: 'Ringan', desc: 'EQ notches halus' },
    { id: 'sedang', label: 'Sedang', desc: 'EQ + phaser' },
    { id: 'berat', label: 'Berat', desc: 'EQ + phaser + chorus' },
    { id: 'extreme', label: 'Extreme', desc: 'Semua efek + mono' },
  ]

  const fileInputRef = useRef(null)
  const audioPlayerRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const currentItem = useMemo(
    () => items.find((x) => x.id === current) || null,
    [items, current]
  )

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      items.forEach((it) => {
        if (it.previewUrl && it.kind === "file") {
          try { URL.revokeObjectURL(it.previewUrl) } catch (_) {}
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Queue management ----
  const updateItem = useCallback((id, patch) => {
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }, [])

  const removeItem = useCallback((id) => {
    setItems((arr) => {
      const it = arr.find((x) => x.id === id)
      if (it?.previewUrl && it.kind === "file") {
        try { URL.revokeObjectURL(it.previewUrl) } catch (_) {}
      }
      return arr.filter((x) => x.id !== id)
    })
    setCurrent((c) => (c === id ? null : c))
  }, [])

  const clearDone = useCallback(() => {
    setItems((arr) => arr.filter((x) => x.status !== "done"))
  }, [])

  // ---- Add files ----
  const ingestFiles = useCallback(async (fileList) => {
    setGlobalError("")
    const list = Array.from(fileList || []).filter((f) =>
      /^audio\//.test(f.type) || /\.(mp3|wav|ogg|flac|m4a|aac|webm)$/i.test(f.name)
    )
    if (!list.length) {
      setGlobalError("No audio files detected. Supported: mp3, wav, ogg, flac, m4a, aac, webm.")
      return
    }
    const newItems = []
    for (const f of list) {
      const url = URL.createObjectURL(f)
      let meta = { title: f.name.replace(/\.[^.]+$/, ""), artist: "Unknown" }
      let coverUrl = ""
      try {
        const tag = await readID3Basic(f)
        if (tag?.title) meta.title = tag.title
        if (tag?.artist) meta.artist = tag.artist
        const cov = await readID3Cover(f)
        if (cov) coverUrl = URL.createObjectURL(new Blob([cov.data], { type: cov.type || "image/jpeg" }))
      } catch (_) { /* ignore */ }
      let duration = 0
      try { duration = await getBlobDuration(f) } catch (_) {}
      newItems.push({
        id: nextId(),
        kind: "file",
        name: meta.title,
        file: f,
        previewUrl: url,
        coverUrl,
        artist: meta.artist,
        duration,
        size: f.size,
        status: "ready",
        progress: 0,
        edited: false,
        editMeta: null,
        editedBlob: null,
        editedFilename: null,
        uploadedAssetId: null,
        playbackUrl: null,
        error: null,
      })
    }
    setItems((arr) => [...newItems, ...arr])
    if (!current && newItems.length) setCurrent(newItems[0].id)
  }, [current])

  // ---- Add remote URL ----
  const ingestRemoteUrl = useCallback(async () => {
    const url = remoteUrl.trim()
    if (!url) return
    setGlobalError("")
    try {
      const res = await fetch(url, { method: "HEAD" }).catch(() => null)
      const len = Number(res?.headers?.get?.("content-length") || 0) || undefined
      const name = (() => {
        try { return decodeURIComponent(new URL(url).pathname.split("/").pop() || "remote") }
        catch { return "remote" }
      })().slice(-60)
      setItems((arr) => [
        {
          id: nextId(),
          kind: "url",
          name,
          url,
          previewUrl: url,
          coverUrl: "",
          artist: "Remote",
          duration: 0,
          size: len,
          status: "ready",
          progress: 0,
          edited: false,
          editMeta: null,
          editedBlob: null,
          editedFilename: null,
          uploadedAssetId: null,
          playbackUrl: null,
          error: null,
        },
        ...arr,
      ])
      setRemoteUrl("")
    } catch (e) {
      setGlobalError(`Could not enqueue remote URL: ${e?.message || e}`)
    }
  }, [remoteUrl])

  // ---- Drag and drop ----
  function onDragOver(e) {
    e.preventDefault()
    setDragOver(true)
  }
  function onDragLeave() { setDragOver(false) }
  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer?.files?.length) ingestFiles(e.dataTransfer.files)
  }

  // ---- Edit modal ----
  const openEditor = useCallback((id) => {
    const it = items.find((x) => x.id === id)
    if (!it) return
    setEditorSource({
      kind: it.editedBlob ? "file" : it.kind,
      file: it.editedBlob || it.file,
      url: it.editedBlob ? null : it.url,
      name: it.name,
    })
    setEditorOpen(true)
  }, [items])

  const applyEditForCurrent = useCallback(({ blob, filename, meta }) => {
    if (!currentItem) return
    const id = currentItem.id
    const previewUrl = URL.createObjectURL(blob)
    getBlobDuration(blob).then((d) => {
      updateItem(id, {
        edited: true,
        editMeta: meta,
        editedBlob: blob,
        editedFilename: filename,
        previewUrl,
        duration: d || meta?.duration,
        status: "ready",
        error: null,
      })
    }).catch(() => {
      updateItem(id, {
        edited: true,
        editMeta: meta,
        editedBlob: blob,
        editedFilename: filename,
        previewUrl,
        status: "ready",
        error: null,
      })
    })
    setEditorOpen(false)
  }, [currentItem, updateItem])

  // ---- Playback preview ----
  const togglePlay = useCallback((id) => {
    const it = items.find((x) => x.id === id)
    if (!it) return
    if (current !== id) {
      setCurrent(id)
      setTimeout(() => {
        const a = audioPlayerRef.current
        if (a) { a.src = it.previewUrl; a.play().catch(() => {}); setIsPlaying(true) }
      }, 30)
      return
    }
    const a = audioPlayerRef.current
    if (!a) return
    if (a.paused) { a.play().catch(() => {}); setIsPlaying(true) }
    else { a.pause(); setIsPlaying(false) }
  }, [current, items])

  useEffect(() => {
    const a = audioPlayerRef.current
    if (!a) return
    a.onended = () => setIsPlaying(false)
  }, [])

  // ---- Save API key ----
  const saveApiKey = useCallback(() => {
    setApiKey(apiKey)
    setUserId(robloxUserId)
    setKeySaved(true)
    setTimeout(() => setKeySaved(false), 1500)
  }, [apiKey, robloxUserId])

  // ---- Upload with bypass via BMS server ----
  const uploadItemWithBypass = useCallback(async (id) => {
    const it = items.find((x) => x.id === id)
    if (!it) return
    const key = getApiKey()
    if (!key) {
      updateItem(id, { status: "error", error: "API Key belum diisi." })
      return
    }
    const uid = getUserId()
    if (!uid) {
      updateItem(id, { status: "error", error: "User ID belum diisi." })
      return
    }
    updateItem(id, { status: "uploading", progress: 5, error: null })
    try {
      const blob = it.editedBlob || it.file
      const filename = it.editedFilename || it.name

      // Step 1: Kirim ke BMS server untuk diproses (bypass)
      const fd = new FormData()
      fd.append('audio', blob, (filename + '.wav'))
      fd.append('level', bypassMode)
      fd.append('format', 'ogg')
      fd.append('decoyStart', 'true')

      const previewRes = await fetch(`${bypassServerUrl}/api/preview`, { method: 'POST', body: fd })
      const previewData = await previewRes.json()
      if (!previewData.previewId) throw new Error(previewData.error || 'Preview failed')
      updateItem(id, { progress: 40 })

      // Step 2: Upload ke Roblox via BMS server
      const ufd = new FormData()
      ufd.append('previewId', previewData.previewId)
      ufd.append('displayName', filename.slice(0, 50))
      ufd.append('description', `Uploaded via BMS Studio — Mode: ${bypassMode}`)
      ufd.append('userId', uid)
      ufd.append('apiKey', key)

      const uploadRes = await fetch(`${bypassServerUrl}/api/upload-roblox`, { method: 'POST', body: ufd })
      const uploadData = await uploadRes.json()
      if (!uploadData.success) throw new Error(uploadData.error || 'Upload via server failed')
      if (uploadData.assetId) {
        updateItem(id, {
          status: "done", progress: 100,
          uploadedAssetId: uploadData.assetId,
          playbackUrl: uploadData.url,
          publicUrl: uploadData.url,
          error: null,
        })
      } else {
        throw new Error('No asset ID returned')
      }
    } catch (e) {
      updateItem(id, { status: "error", error: e?.message || String(e) })
    }
  }, [items, updateItem, bypassMode, bypassServerUrl])

  // ---- Upload single ----
  const uploadItem = useCallback(async (id) => {
    const it = items.find((x) => x.id === id)
    if (!it) return
    if (bypassMode !== 'none') {
      await uploadItemWithBypass(id)
      return
    }
    if (!hasApiKey()) {
      updateItem(id, {
        status: "error",
        error: "API Key belum diisi. Buka Settings → paste API Key Roblox.",
      })
      return
    }
    updateItem(id, { status: "uploading", progress: 5, error: null })
    try {
      const blob = it.editedBlob || it.file
      const filename = it.editedFilename || it.name
      const result = await uploadToRoblox({
        file: blob,
        audioName: filename,
        onProgress: (p) => updateItem(id, { progress: Math.max(5, Math.min(95, p)) }),
      })
      updateItem(id, {
        status: "done",
        progress: 100,
        uploadedAssetId: result.assetId,
        playbackUrl: result.playbackUrl,
        publicUrl: result.playbackUrl,
        error: null,
      })
      if (result.ownerId && !getUserId()) {
        setUserId(String(result.ownerId))
        setRobloxUserIdState(String(result.ownerId))
      }
    } catch (e) {
      updateItem(id, { status: "error", error: e?.message || String(e) })
    }
  }, [items, updateItem, bypassMode, uploadItemWithBypass])

  // ---- Upload all ready ----
  const uploadAllReady = useCallback(async () => {
    const targets = items.filter((x) => x.status === "ready")
    if (!targets.length) return
    setBulkUploading(true)
    for (const t of targets) {
      // eslint-disable-next-line no-await-in-loop
      await uploadItem(t.id)
    }
    setBulkUploading(false)
  }, [items, uploadItem])

  // ---- Stats ----
  const stats = useMemo(() => {
    const total = items.length
    const ready = items.filter((x) => x.status === "ready").length
    const done = items.filter((x) => x.status === "done").length
    const errs = items.filter((x) => x.status === "error").length
    const busy = items.some((x) => ["uploading", "rendering"].includes(x.status))
    return { total, ready, done, errs, busy }
  }, [items])

  return (
    <div className="page-pad" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <SectionHead
        kicker="// studio"
        title="Edit Song"
        sub="Drop audio files, tweak pitch / speed / volume / trim, then upload to Roblox as audio assets."
      >
        <StatusBadge variant="gold" dot>Beta</StatusBadge>
        <button
          className="btn-primary btn-sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={bulkUploading}
        >
          <Plus size={12} /> Add files
        </button>
        <input
          ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden"
          onChange={(e) => e.target.files && ingestFiles(e.target.files)}
        />
        {stats.ready > 0 && (
          <button
            className="btn-ghost btn-sm"
            onClick={uploadAllReady}
            disabled={bulkUploading}
            title="Upload every ready item"
          >
            <UploadCloud size={12} /> Upload all ({stats.ready})
          </button>
        )}
        {stats.done > 0 && (
          <button className="btn-ghost btn-sm" onClick={clearDone} title="Remove uploaded items">
            <Trash2 size={12} /> Clear done
          </button>
        )}
      </SectionHead>

      {globalError && (
        <div className="mb-4">
          <ErrorBox title="Could not import" message={globalError} />
        </div>
      )}

      {/* Drop zone + URL import */}
      <div
        className={`mb-5 border-2 border-dashed p-6 transition-colors ${
          dragOver ? "border-gold bg-gold/5" : "border-white/10 bg-jet/30"
        }`}
        onClick={() => fileInputRef.current?.click()}
        role="button"
      >
        <div className="flex items-center gap-3">
          <UploadCloud className="text-gold" size={20} />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-sm">
              Drop audio files here, or click to browse
            </div>
            <div className="text-[11px] font-mono text-white/40">
              mp3 · wav · ogg · flac · m4a · aac · webm — multiple files supported
            </div>
          </div>
        </div>

        <div
          className="mt-4 flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Link2 size={14} className="text-white/40" />
          <input
            value={remoteUrl}
            onChange={(e) => setRemoteUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ingestRemoteUrl()}
            placeholder="…or paste a remote audio URL (https://…)"
            className="input flex-1 text-xs"
          />
          <button onClick={ingestRemoteUrl} disabled={!remoteUrl.trim()} className="btn-ghost btn-sm">
            <Plus size={11} /> Add URL
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <Stat label="Total" value={stats.total} />
        <Stat label="Ready" value={stats.ready} accent="gold" />
        <Stat label="Uploaded" value={stats.done} accent="emerald" />
        <Stat label="Failed" value={stats.errs} accent="red" />
      </div>

      {/* Main grid: queue + detail */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Queue list */}
        <div className="lg:col-span-2 space-y-2">
          {items.length === 0 ? (
            <EmptyState
              title="Queue is empty"
              sub="Drop some audio files above to start editing and uploading."
              action={null}
            />
          ) : (
            items.map((it, i) => (
              <QueueItem
                key={it.id}
                item={it}
                index={i}
                isCurrent={it.id === current}
                isPlaying={isPlaying && it.id === current}
                onSelect={setCurrent}
                onEdit={openEditor}
                onRemove={removeItem}
                onUpload={uploadItem}
                onTogglePlay={togglePlay}
              />
            ))
          )}
        </div>

        {/* Detail panel */}
        <div className="space-y-3">
          <div className="panel p-4">
            <div className="card-title flex items-center gap-2">
              <Sparkles size={13} className="text-gold" /> Inspector
            </div>
            {!currentItem ? (
              <div className="text-xs font-mono text-white/40 mt-2">
                Select a track to inspect.
              </div>
            ) : (
              <div className="mt-3 space-y-2 text-xs font-mono">
                <Row k="Name" v={currentItem.name} />
                <Row k="Artist" v={currentItem.artist || "—"} />
                <Row k="Source" v={currentItem.kind === "url" ? "remote" : "local file"} />
                <Row k="Size" v={fmtBytes(currentItem.size || 0)} />
                <Row k="Duration" v={`${(currentItem.duration || 0).toFixed(2)}s`} />
                <Row k="Status" v={
                  <StatusBadge variant={
                    currentItem.status === "done" ? "success" :
                    currentItem.status === "error" ? "destructive" :
                    ["uploading", "rendering"].includes(currentItem.status) ? "gold" : "outline"
                  } dot>{currentItem.status}</StatusBadge>
                } />
                {currentItem.edited && (
                  <Row k="Edit" v={`${currentItem.editMeta?.speed?.toFixed(2)}x · pitch ${
                    currentItem.editMeta?.pitch >= 0 ? "+" : ""
                  }${currentItem.editMeta?.pitch || 0}st`} />
                )}
                {currentItem.uploadedAssetId && (
                  <Row k="Asset" v={<span className="text-emerald-300">{currentItem.uploadedAssetId}</span>} />
                )}
                <div className="pt-3 flex flex-wrap items-center gap-1.5">
                  <button onClick={() => openEditor(currentItem.id)} className="btn-primary btn-xs">
                    <Wand2 size={11} /> Edit
                  </button>
                  <button
                    onClick={() => uploadItem(currentItem.id)}
                    disabled={currentItem.status === "uploading" || currentItem.status === "rendering" || currentItem.status === "done"}
                    className="btn-ghost btn-xs"
                  >
                    <Upload size={11} /> {currentItem.status === "done" ? "Uploaded" : "Upload"}
                  </button>
                  <button onClick={() => togglePlay(currentItem.id)} className="btn-ghost btn-xs">
                    <Music2 size={11} /> Preview
                  </button>
                </div>
              </div>
            )}
          </div>

          {currentItem && (currentItem.playbackUrl || currentItem.publicUrl) && (
            <div className="panel p-4">
              <div className="card-title flex items-center gap-2">
                <Link2 size={13} className="text-emerald-300" /> Result
              </div>
              <div className="mt-2 space-y-2 text-[11px] font-mono">
                {currentItem.publicUrl && (
                  <ResultRow
                    label="Public URL"
                    url={currentItem.publicUrl}
                    onCopy={copyToClipboard}
                  />
                )}
                {currentItem.playbackUrl && (
                  <ResultRow
                    label="Roblox Asset"
                    url={currentItem.playbackUrl}
                    onCopy={copyToClipboard}
                  />
                )}
                {currentItem.uploadedAssetId && (
                  <Row k="Asset ID" v={<span className="text-emerald-300">{currentItem.uploadedAssetId}</span>} />
                )}
              </div>
            </div>
          )}

          {/* API key settings untuk Roblox Open Cloud */}
          <div className="panel p-4">
            <div className="card-title flex items-center gap-2">
              <KeyRound size={13} className="text-gold" /> Roblox API Key
              {hasApiKey() ? (
                <StatusBadge variant="success" dot>saved</StatusBadge>
              ) : (
                <StatusBadge variant="destructive" dot>missing</StatusBadge>
              )}
            </div>
            <p className="mt-2 text-[10px] font-mono text-white/50 leading-relaxed">
              Disimpan lokal di browser (localStorage). Buat di{" "}
              <a
                href={ROBLOX_OPEN_CLOUD.credentialsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-gold hover:underline inline-flex items-center gap-0.5"
              >
                create.roblox.com
                <ExternalLink size={9} />
              </a>{" "}
              dengan scope <span className="text-white/70">Audio API</span>.
            </p>

            <div className="mt-3 space-y-2">
              <label className="text-[9px] font-mono uppercase text-white/40 tracking-wider block">
                API Key
              </label>
              <div className="flex gap-1.5">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => { setApiKeyState(e.target.value); setKeySaved(false) }}
                  placeholder="rbx_…"
                  className="input text-xs flex-1 min-w-0 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((s) => !s)}
                  className="btn-ghost btn-xs"
                  title={showApiKey ? "Hide" : "Show"}
                >
                  {showApiKey ? <EyeOff size={11} /> : <Eye size={11} />}
                </button>
              </div>

              <label className="text-[9px] font-mono uppercase text-white/40 tracking-wider block pt-1">
                User ID <span className="text-white/30">(opsional, auto-detect)</span>
              </label>
              <input
                value={robloxUserId}
                onChange={(e) => { setRobloxUserIdState(e.target.value); setKeySaved(false) }}
                placeholder="12345678"
                className="input text-xs font-mono"
              />

              <div className="flex items-center gap-2 pt-1">
                <button onClick={saveApiKey} className="btn-primary btn-xs">
                  <KeyRound size={11} /> {keySaved ? "Saved!" : "Save"}
                </button>
                <button
                  onClick={() => { setApiKeyState(""); setRobloxUserIdState(""); setApiKey(""); setUserId("") }}
                  className="btn-ghost btn-xs"
                >
                  <Trash2 size={11} /> Clear
                </button>
              </div>
            </div>
          </div>

          {/* Bypass Audible Magic panel */}
          <div className="panel p-4">
            <div className="card-title flex items-center gap-2">
              <ShieldAlert size={13} className="text-gold" /> Bypass Audible Magic
              {bypassMode !== 'none' ? (
                <StatusBadge variant="gold" dot>active</StatusBadge>
              ) : (
                <StatusBadge variant="outline" dot>off</StatusBadge>
              )}
            </div>
            <p className="mt-2 text-[10px] font-mono text-white/50 leading-relaxed">
              Proses audio lewat server FFmpeg untuk menghindari deteksi Audible Magic. Pastikan server BMS Upload berjalan.
            </p>
            <div className="mt-3 space-y-2">
              <label className="text-[9px] font-mono uppercase text-white/40 tracking-wider block">Server URL</label>
              <input
                value={bypassServerUrl}
                onChange={(e) => {
                  setBypassServerUrl(e.target.value)
                  localStorage.setItem('bms_bypass_url', e.target.value)
                }}
                placeholder="http://localhost:3000"
                className="input text-xs font-mono"
              />
              <label className="text-[9px] font-mono uppercase text-white/40 tracking-wider block pt-1">Mode</label>
              <div className="grid grid-cols-2 gap-1">
                {BYPASS_MODES.filter(m => m.id !== 'none').map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setBypassMode(m.id); localStorage.setItem('bms_bypass_mode', m.id) }}
                    className={`px-2 py-1.5 border text-[10px] font-mono text-left transition-colors ${
                      bypassMode === m.id
                        ? 'border-gold bg-gold/10 text-gold'
                        : 'border-white/10 bg-jet/30 text-white/60 hover:border-white/20'
                    }`}
                  >
                    <div className="font-bold">{m.label}</div>
                    <div className="text-[8px] opacity-60">{m.desc}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setBypassMode('none'); localStorage.setItem('bms_bypass_mode', 'none') }}
                className={`btn btn-xs btn-full mt-1 ${bypassMode === 'none' ? 'btn-primary' : 'btn-ghost'}`}
              >
                Nonaktifkan bypass (direct upload)
              </button>
            </div>
          </div>

          <div className="panel p-4">
            <div className="card-title flex items-center gap-2">
              <FileAudio size={13} className="text-gold" /> Tips
            </div>
            <ul className="mt-2 space-y-1 text-[11px] font-mono text-white/50 list-disc pl-4">
              <li>Edit multiple files in one go via the per-row <span className="text-gold">Edit</span> action.</li>
              <li>Speed greater than 1x raises pitch (browser behavior); use the <em>Pitch</em> slider to compensate.</li>
              <li>Aktifkan <span className="text-gold">Bypass Audible Magic</span> untuk proses audio lewat server FFmpeg sebelum upload.</li>
              <li>Cover art is extracted from ID3 tags when present.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Hidden audio element used for preview */}
      <audio
        ref={audioPlayerRef}
        src={currentItem?.previewUrl || ""}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="hidden"
      />

      {/* Editor modal */}
      <EditorModal
        open={editorOpen}
        source={editorSource}
        onClose={() => setEditorOpen(false)}
        onApply={applyEditForCurrent}
      />

      {dragOver && (
        <div className="fixed inset-0 z-40 pointer-events-none border-2 border-gold/40 m-4">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-jet/90 border border-gold/40 px-4 py-2 font-mono text-xs text-gold">
              Drop to add audio files
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, accent }) {
  const cls =
    accent === "gold" ? "text-gold" :
    accent === "emerald" ? "text-emerald-300" :
    accent === "red" ? "text-red-300" :
    "text-white"
  return (
    <div className="panel p-3">
      <div className="text-[9px] font-mono uppercase text-white/40 tracking-wider">{label}</div>
      <div className={`text-2xl font-bold ${cls}`}>{value}</div>
    </div>
  )
}

function Row({ k, v }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-white/40 uppercase tracking-wider text-[9px]">{k}</div>
      <div className="text-white/80 text-right break-all min-w-0 max-w-[60%]">{v}</div>
    </div>
  )
}

function ResultRow({ label, url, onCopy }) {
  return (
    <div className="space-y-1">
      <div className="text-white/40 uppercase tracking-wider text-[9px]">{label}</div>
      <div className="flex items-center gap-1.5">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className="input text-[10px] font-mono flex-1 min-w-0"
        />
        <button
          type="button"
          onClick={() => onCopy?.(url)}
          className="btn-ghost btn-xs"
          title="Copy to clipboard"
        >
          <ChevronRight size={11} />
          <span className="hidden sm:inline">Copy</span>
        </button>
      </div>
    </div>
  )
}

async function copyToClipboard(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const ta = document.createElement("textarea")
      ta.value = text
      ta.style.position = "fixed"
      ta.style.opacity = "0"
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
    }
  } catch (_) { /* ignore */ }
}
