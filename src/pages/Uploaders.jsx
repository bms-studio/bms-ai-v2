import { useState } from "react"
import { Upload, Copy, ExternalLink, Image as ImageIcon, CheckCircle2 } from "lucide-react"
import StatusBadge from "../components/StatusBadge.jsx"
import { SectionHead, EmptyState, ErrorBox } from "../components/UI.jsx"
import { useToast } from "../state/ToastContext.jsx"
import { UPLOADERS } from "../config/endpoints.js"
import { postXylo, fileToDataURL, extractUrl } from "../lib/api.js"
import { fileToURL, copyText } from "../lib/utils.js"

export default function Uploaders() {
  const toast = useToast()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState("")
  const [busyId, setBusyId] = useState(null)
  const [results, setResults] = useState({}) // { [id]: { url, data, ts } }
  const [errors, setErrors] = useState({})

  function onPick(f) {
    if (!f) { setFile(null); setPreview(""); return }
    setFile(f)
    setPreview(fileToURL(f))
    setResults({}); setErrors({})
  }

  async function uploadOne(endpoint) {
    if (!file) { toast.warn("No file", "Choose a file first."); return }
    setBusyId(endpoint.id); setErrors((e) => ({ ...e, [endpoint.id]: null }))
    try {
      const dataUrl = await fileToDataURL(file)
      const data = await postXylo(endpoint.path, { image: dataUrl })
      const url = extractUrl(data) || extractUrl(data, "data.url") || extractUrl(data, "url")
      const final = url || (typeof data === "string" ? data : null) || JSON.stringify(data)
      setResults((r) => ({ ...r, [endpoint.id]: { url: final, ts: Date.now() } }))
      toast.success("Uploaded", endpoint.name)
    } catch (err) {
      setErrors((e) => ({ ...e, [endpoint.id]: err.message || "Failed" }))
      toast.error("Failed", `${endpoint.name}: ${err.message || "error"}`)
    } finally {
      setBusyId(null)
    }
  }

  async function uploadAll() {
    for (const ep of UPLOADERS) await uploadOne(ep)
  }

  return (
    <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto">
      <SectionHead
        kicker="// uploaders"
        title="Image Hosts"
        sub={`${UPLOADERS.length} free CDN uploaders - upload once, broadcast everywhere.`}
      >
        <StatusBadge variant="success" dot>Online</StatusBadge>
      </SectionHead>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <label className="block">
            <div className="card-title mb-1.5">Image</div>
            <div className="panel p-3 border-dashed hover:border-gold/40 transition-colors cursor-pointer relative min-h-[220px] flex items-center justify-center">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onPick(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              {preview ? (
                <img src={preview} alt="Preview" className="max-h-[280px] max-w-full border border-white/10" />
              ) : (
                <div className="text-center py-6">
                  <ImageIcon size={28} className="text-gold mx-auto mb-2" />
                  <div className="font-mono text-sm text-white">Drop or click</div>
                  <div className="text-xs text-white/40 mt-1">PNG, JPG, WebP, GIF</div>
                </div>
              )}
            </div>
          </label>
          <button
            onClick={uploadAll}
            disabled={!file || busyId}
            className="btn-primary btn-lg w-full"
          >
            <Upload size={14} />
            {busyId ? `Uploading to ${busyId}...` : "Upload to all"}
          </button>
        </div>

        <div className="md:col-span-2 grid sm:grid-cols-2 gap-3">
          {UPLOADERS.map((u) => {
            const r = results[u.id]
            const e = errors[u.id]
            const busy = busyId === u.id
            return (
              <div key={u.id} className="panel p-3 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-bold text-white text-sm">{u.name}</div>
                    <div className="text-[10px] font-mono text-white/40 break-all">{u.path}</div>
                  </div>
                  {r ? <StatusBadge variant="success" dot>OK</StatusBadge> :
                   e ? <StatusBadge variant="destructive" dot>Fail</StatusBadge> :
                   <StatusBadge variant="outline">Idle</StatusBadge>}
                </div>
                <div className="text-[11px] text-white/50 mb-3 flex-1">{u.notes}</div>
                {e && <div className="text-[11px] text-destructive/80 mb-2 break-words">{e}</div>}
                {r && (
                  <div className="text-[11px] font-mono text-white/70 break-all mb-2 line-clamp-2">{r.url}</div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => uploadOne(u)}
                    disabled={busy || !file}
                    className="btn-primary btn-sm flex-1"
                  >
                    {busy ? "Uploading..." : r ? "Re-upload" : "Upload"}
                  </button>
                  {r && (
                    <>
                      <button onClick={() => copyText(r.url)} className="btn-ghost btn-sm">
                        <Copy size={11} />
                      </button>
                      <a href={r.url} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
                        <ExternalLink size={11} />
                      </a>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}