import { useState } from "react"
import { Sparkles, Download, ExternalLink, Wand2 } from "lucide-react"
import StatusBadge from "../components/StatusBadge.jsx"
import { SectionHead, EmptyState, ErrorBox } from "../components/UI.jsx"
import { useToast } from "../state/ToastContext.jsx"
import { IMAGE_GEN } from "../config/endpoints.js"
import { generateImageSynox, generateImageQwen, extractUrl } from "../lib/api.js"

export default function ImageGen() {
  const toast = useToast()
  const [provider, setProvider] = useState("synox")
  const [prompt, setPrompt] = useState("")
  const [ratio, setRatio] = useState("1:1")
  const [busy, setBusy] = useState(false)
  const [image, setImage] = useState(null)
  const [error, setError] = useState("")

  async function run() {
    const p = prompt.trim()
    if (!p) { toast.warn("Empty", "Type a prompt first."); return }
    setBusy(true); setError(""); setImage(null)
    try {
      let url = ""
      if (provider === "synox") {
        const data = await generateImageSynox(p, ratio)
        url = extractUrl(data, "data.url") || extractUrl(data, "url")
      } else {
        const data = await generateImageQwen(p, ratio)
        url = extractUrl(data, "data.image") || extractUrl(data, "image")
      }
      if (!url) throw new Error("No image URL in response.")
      setImage(url)
      toast.success("Done", "Image generated.")
    } catch (err) {
      setError(err.message || "Failed")
      toast.error("Failed", err.message || "Error")
    } finally {
      setBusy(false)
    }
  }

  const cfg = provider === "synox" ? IMAGE_GEN.synox : IMAGE_GEN.qwen

  return (
    <div className="px-4 md:px-8 py-8 max-w-6xl mx-auto">
      <SectionHead
        kicker="// generate"
        title="Image Generation"
        sub="Two engines. Pick one and write a vivid prompt."
      >
        <StatusBadge variant="default" dot>Online</StatusBadge>
      </SectionHead>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          {/* Provider tabs */}
          <div className="flex items-center gap-2 border border-white/5 p-1">
            {[
              { id: "synox", name: "Engine A", notes: "Standard quality" },
              { id: "qwen",  name: "Engine B", notes: "High quality" }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                className={"flex-1 px-3 py-2 text-left transition-colors " +
                  (provider === p.id ? "bg-gold/10 border border-gold/30" : "border border-transparent hover:bg-white/5")}
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-white">{p.name}</div>
                <div className="text-[10px] text-white/40 mt-0.5">{p.notes}</div>
              </button>
            ))}
          </div>

          <div>
            <label className="card-title block mb-1.5">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              className="textarea-base"
              placeholder="e.g. A neon samurai in a rainy cyberpunk city, cinematic lighting, 35mm, hyper-detailed..."
            />
          </div>

          <div>
            <label className="card-title block mb-1.5">Aspect ratio</label>
            <div className="flex flex-wrap items-center gap-2">
              {cfg.ratios.map((r) => (
                <button
                  key={r}
                  onClick={() => setRatio(r)}
                  className={"px-3 py-1.5 border font-mono text-xs uppercase tracking-[0.08em] " +
                    (ratio === r
                      ? "border-gold/40 bg-gold/10 text-gold"
                      : "border-white/10 text-white/60 hover:border-white/20")}
                >{r}</button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button onClick={run} disabled={busy} className="btn-primary btn-lg">
              <Wand2 size={14} />
              {busy ? "Generating..." : "Generate"}
            </button>
            <StatusBadge variant="outline">{cfg.method}</StatusBadge>
          </div>

          {error && <ErrorBox title="Generation failed" message={error} />}
        </div>

        <aside className="space-y-3">
          <Card title="Provider">
            <div className="font-bold text-white">{cfg.name}</div>
            <div className="text-xs text-white/50 mt-1">Method: {cfg.method}</div>
            <div className="text-xs text-white/40 mt-2">High-quality image generation powered by {cfg.name}.</div>
          </Card>
          <Card title="Tips">
            <ul className="text-xs text-white/60 space-y-1 list-disc pl-4">
              <li>Mention the subject first</li>
              <li>Add a style (cinematic, anime, oil)</li>
              <li>Specify lighting and mood</li>
              <li>Include camera details (35mm f/1.4)</li>
            </ul>
          </Card>
        </aside>
      </div>

      <div className="mt-8">
        <div className="card-title mb-2">Result</div>
        {busy ? (
          <div className="panel p-6">
            <div className="skeleton h-64 w-full" />
            <div className="mt-3 skeleton h-3 w-1/2" />
          </div>
        ) : image ? (
          <div className="panel p-4 border-gold/30">
            <img src={image} alt="Generated" className="max-w-full mx-auto border border-white/10" />
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <StatusBadge variant="success" dot>{ratio}</StatusBadge>
              <a href={image} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
                <ExternalLink size={12} /> Open
              </a>
              <a href={image} download className="btn-primary btn-sm">
                <Download size={12} /> Save
              </a>
            </div>
          </div>
        ) : (
          <EmptyState title="No image yet" sub="Generated images will appear here." />
        )}
      </div>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className="panel p-4">
      <div className="card-title mb-2">{title}</div>
      {children}
    </div>
  )
}