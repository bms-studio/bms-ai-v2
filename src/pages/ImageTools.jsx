import { useState } from "react"
import { Wand2, Upload, Download, Image as ImageIcon, Sliders } from "lucide-react"
import StatusBadge from "../components/StatusBadge.jsx"
import { SectionHead, EmptyState, ErrorBox } from "../components/UI.jsx"
import { useToast } from "../state/ToastContext.jsx"
import { IMAGE_TOOLS } from "../config/endpoints.js"
import { postXylo, fileToDataURL, fileToURL, extractUrl, copyText } from "../lib/api.js"

// Tools that have additional parameters
const PARAMS = {
  sepia:         [{ key: "intensity",  label: "Intensity",  type: "number", def: 80,  min: 0, max: 100 }],
  flip:          [{ key: "direction",  label: "Direction",  type: "select", def: "horizontal", options: ["horizontal", "vertical"] }],
  pixelate:      [{ key: "pixel_size", label: "Pixel Size", type: "number", def: 10, min: 1, max: 50 }],
  "round-corners": [{ key: "radius",   label: "Radius",     type: "number", def: 30, min: 0, max: 200 }],
  split:         [
    { key: "rows", label: "Rows", type: "number", def: 2, min: 1, max: 10 },
    { key: "cols", label: "Cols", type: "number", def: 2, min: 1, max: 10 }
  ],
  "add-noise":   [
    { key: "amount",     label: "Amount",     type: "number", def: 20,  min: 0,  max: 100 },
    { key: "noise_type", label: "Noise Type", type: "select", def: "gaussian", options: ["gaussian", "uniform", "salt-pepper"] }
  ],
  blur:          [{ key: "radius",  label: "Radius",    type: "number", def: 10, min: 0, max: 50 }],
  sharpen:       [{ key: "intensity", label: "Intensity", type: "number", def: 50, min: 0, max: 100 }],
  solarize:      [{ key: "threshold", label: "Threshold", type: "number", def: 128, min: 0, max: 255 }]
}

export default function ImageTools() {
  const toast = useToast()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState("")
  const [tool, setTool] = useState(IMAGE_TOOLS[0])
  const [params, setParams] = useState({})
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState(null)
  const [error, setError] = useState("")

  function onPick(f) {
    if (!f) { setFile(null); setPreview(""); setOut(null); return }
    setFile(f)
    setPreview(fileToURL(f))
    setOut(null); setError("")
  }

  function selectTool(t) {
    setTool(t)
    const p = {}
    for (const spec of (PARAMS[t.id] || [])) p[spec.key] = spec.def
    setParams(p)
    setOut(null); setError("")
  }

  async function run() {
    if (!file) { toast.warn("No image", "Choose an image first."); return }
    setBusy(true); setError(""); setOut(null)
    try {
      const dataUrl = await fileToDataURL(file)
      const body = { image: dataUrl, ...params }
      const data = await postXylo(tool.path, body)
      const url = extractUrl(data) || extractUrl(data, "data.image") || extractUrl(data, "data.url") || extractUrl(data, "result")
      const final = url || (typeof data === "string" && /^https?:\/\//i.test(data) ? data : null) || (data?.image || data?.data?.image)
      if (typeof final === "string" && /^https?:\/\//i.test(final)) {
        setOut({ type: "url", url: final, ts: Date.now() })
      } else if (typeof final === "string" && final.startsWith("data:image")) {
        setOut({ type: "data", url: final, ts: Date.now() })
      } else if (typeof data === "object" && data.image_base64) {
        setOut({ type: "data", url: "data:image/png;base64," + data.image_base64, ts: Date.now() })
      } else {
        throw new Error("No image returned.")
      }
      toast.success("Done", tool.name)
    } catch (err) {
      setError(err.message || "Failed")
      toast.error("Failed", err.message || "Error")
    } finally { setBusy(false) }
  }

  return (
    <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto">
      <SectionHead
        kicker="// image-tools"
        title="Image Effects"
        sub={`${IMAGE_TOOLS.length} AI-powered effects - remove background, upscale, blur, and more.`}
      >
        <StatusBadge variant="default" dot>Online</StatusBadge>
      </SectionHead>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Tool list */}
        <div className="lg:col-span-1 space-y-2">
          <div className="card-title mb-1.5">Tools</div>
          {IMAGE_TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTool(t)}
              className={"w-full text-left p-3 border transition-colors " +
                (tool.id === t.id
                  ? "border-gold/40 bg-gold/10"
                  : "border-white/5 bg-charcoal/40 hover:border-white/20")}
            >
              <div className="text-sm font-bold text-white">{t.name}</div>
              <div className="text-[11px] text-white/50 mt-0.5">{t.desc}</div>
              <div className="text-[10px] font-mono text-white/30 mt-1">{t.path}</div>
            </button>
          ))}
        </div>

        {/* Workspace */}
        <div className="lg:col-span-3 space-y-4">
          <label className="block">
            <div className="card-title mb-1.5">Input image</div>
            <div className="panel p-3 border-dashed hover:border-gold/40 transition-colors cursor-pointer relative min-h-[180px] flex items-center justify-center">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onPick(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              {preview ? (
                <img src={preview} alt="Input" className="max-h-[280px] max-w-full border border-white/10" />
              ) : (
                <div className="text-center py-4">
                  <Upload size={24} className="text-gold mx-auto mb-2" />
                  <div className="font-mono text-sm text-white">Drop or click</div>
                </div>
              )}
            </div>
          </label>

          {(PARAMS[tool.id] || []).length > 0 && (
            <div className="panel p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sliders size={12} className="text-gold" />
                <div className="card-title">Parameters</div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {PARAMS[tool.id].map((spec) => (
                  <div key={spec.key}>
                    <label className="text-[10px] font-mono uppercase tracking-[0.08em] text-white/50 mb-1 block">
                      {spec.label}
                    </label>
                    {spec.type === "select" ? (
                      <select
                        value={params[spec.key] ?? spec.def}
                        onChange={(e) => setParams({ ...params, [spec.key]: e.target.value })}
                        className="select-base"
                      >
                        {spec.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type="number"
                        min={spec.min}
                        max={spec.max}
                        value={params[spec.key] ?? spec.def}
                        onChange={(e) => setParams({ ...params, [spec.key]: Number(e.target.value) })}
                        className="input-base"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={run} disabled={busy || !file} className="btn-primary btn-lg">
            <Wand2 size={14} />
            {busy ? "Processing..." : `Apply ${tool.name}`}
          </button>

          {error && <ErrorBox title="Tool failed" message={error} />}

          <div>
            <div className="card-title mb-2">Output</div>
            {busy ? (
              <div className="panel p-6"><div className="skeleton h-48 w-full" /></div>
            ) : out ? (
              <div className="panel p-4 border-gold/30">
                <img src={out.url} alt="Output" className="max-w-full mx-auto border border-white/10" />
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <StatusBadge variant="success" dot>Done</StatusBadge>
                  <a href={out.url} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
                    Open
                  </a>
                  <a href={out.url} download={`${tool.id}-${out.ts}.png`} className="btn-primary btn-sm">
                    <Download size={12} /> Save
                  </a>
                  {out.type === "url" && (
                    <button onClick={() => copyText(out.url)} className="btn-ghost btn-sm">Copy URL</button>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState title="No output yet" sub="Apply a tool to see the result here." />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}