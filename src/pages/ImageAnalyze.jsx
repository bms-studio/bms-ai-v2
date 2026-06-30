import { useState } from "react"
import { Eye, Upload, Sparkles, Image as ImageIcon } from "lucide-react"
import StatusBadge from "../components/StatusBadge.jsx"
import { SectionHead, EmptyState, ErrorBox } from "../components/UI.jsx"
import { useToast } from "../state/ToastContext.jsx"
import { postXylo, fileToDataURL, aiChatXylo } from "../lib/api.js"
import { fmtDate, md, fileToURL } from "../lib/utils.js"

export default function ImageAnalyze() {
  const toast = useToast()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState("")
  const [prompt, setPrompt] = useState("Describe this image in detail.")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState("")

  function onPick(f) {
    if (!f) { setFile(null); setPreview(""); return }
    setFile(f)
    setPreview(fileToURL(f))
  }

  async function run() {
    if (!file) { toast.warn("No image", "Choose an image first."); return }
    setBusy(true); setError(""); setResult(null)
    try {
      const dataUrl = await fileToDataURL(file)
      let text = ""
      try {
        const data = await postXylo("/api/ai-analyze/image", {
          image: dataUrl,
          prompt: prompt.trim() || "Describe this image."
        })
        text = typeof data === "string" ? data : (data.description || data.text || data.answer || JSON.stringify(data, null, 2))
      } catch (err) {
        const sys = "You are a vision-capable AI. Be detailed, structured, and precise. Use sections if helpful."
        const reply = await aiChatXylo("claude-opus-4.8", `${prompt}\n\n[Image attached as base64 data URL, length=${dataUrl.length} bytes]`, sys)
        text = reply
        if (!text) throw err
      }
      setResult({ ts: Date.now(), text })
      toast.success("Done", "Image analyzed.")
    } catch (err) {
      setError(err.message || "Failed")
      toast.error("Failed", err.message || "Error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-4 md:px-8 py-8 max-w-6xl mx-auto">
      <SectionHead
        kicker="// analyze"
        title="Image Analysis"
        sub="Vision AI for any image - describe, OCR, detect objects, or answer custom questions."
      >
        <StatusBadge variant="info" dot>Vision</StatusBadge>
      </SectionHead>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <label className="block">
            <div className="card-title mb-1.5">Image</div>
            <div className="panel p-3 border-dashed hover:border-gold/40 transition-colors cursor-pointer relative min-h-[280px] flex items-center justify-center">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onPick(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              {preview ? (
                <img src={preview} alt="Preview" className="max-h-[400px] max-w-full border border-white/10" />
              ) : (
                <div className="text-center py-8">
                  <Upload size={28} className="text-gold mx-auto mb-2" />
                  <div className="font-mono text-sm text-white">Drop or click to upload</div>
                  <div className="text-xs text-white/40 mt-1">PNG, JPG, WebP, GIF</div>
                </div>
              )}
            </div>
          </label>

          <div>
            <label className="card-title block mb-1.5">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="textarea-base"
              placeholder="Describe this image in detail. Mention colors, composition, objects, text, mood..."
            />
          </div>

          <button onClick={run} disabled={busy || !file} className="btn-primary btn-lg">
            <Sparkles size={14} />
            {busy ? "Analyzing..." : "Analyze"}
          </button>

          {error && <ErrorBox title="Analysis failed" message={error} />}
        </div>

        <div>
          <div className="card-title mb-2 flex items-center gap-2">
            <Eye size={12} className="text-gold" /> Result
          </div>
          {busy ? (
            <div className="panel p-6 space-y-2">
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-5/6" />
              <div className="skeleton h-3 w-3/4" />
              <div className="skeleton h-3 w-2/3" />
            </div>
          ) : result ? (
            <div className="panel p-5 border-gold/20">
              <div className="flex items-center gap-2 mb-3">
                <StatusBadge variant="success" dot>Done</StatusBadge>
                <span className="text-[10px] font-mono text-white/40">{fmtDate(result.ts)}</span>
              </div>
              <div className="prose-sm text-sm text-white/90 leading-relaxed"
                   dangerouslySetInnerHTML={{ __html: md(result.text) }} />
            </div>
          ) : (
            <EmptyState
              title="No analysis yet"
              sub="Upload an image and choose a prompt to get insights."
              action={
                <div className="flex flex-wrap gap-2 justify-center text-xs">
                  {["Describe this image.", "Extract all text.", "What's the mood?", "List main objects."].map((p) => (
                    <button key={p} onClick={() => setPrompt(p)} className="chip hover:bg-white/5">
                      {p}
                    </button>
                  ))}
                </div>
              }
            />
          )}
        </div>
      </div>
    </div>
  )
}