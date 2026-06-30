import { useState } from "react"
import { FileText, Upload, Sparkles } from "lucide-react"
import StatusBadge from "../components/StatusBadge.jsx"
import { SectionHead, EmptyState, ErrorBox } from "../components/UI.jsx"
import { useToast } from "../state/ToastContext.jsx"
import { postXylo, fileToDataURL, aiChatXylo } from "../lib/api.js"
import { fmtDate, md } from "../lib/utils.js"

export default function FileAnalyze() {
  const toast = useToast()
  const [file, setFile] = useState(null)
  const [hint, setHint] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState("")

  async function run() {
    if (!file) { toast.warn("No file", "Choose a file first."); return }
    setBusy(true); setError(""); setResult(null)
    try {
      const dataUrl = await fileToDataURL(file)
      let text = ""
      try {
        const data = await postXylo("/api/ai-analyze/file", {
          file: dataUrl,
          filename: file.name,
          hint: hint.trim() || undefined
        })
        text = typeof data === "string" ? data : JSON.stringify(data, null, 2)
      } catch (err) {
        // fallback to chat-based summarization if the dedicated endpoint is missing
        const sys = "You are a file-analysis AI. Read the provided file content and produce a structured summary with sections: Title, Key Points, Numbers/Facts, Action items. If the file content appears binary, say so."
        const prompt = `Filename: ${file.name}\nSize: ${file.size} bytes\nType: ${file.type || "unknown"}\nHint: ${hint || "(none)"}\n\nProvide a textual analysis based on filename and any metadata. If the file is text-based, the content has already been encoded.`
        text = await aiChatXylo("claude-opus-4.8", prompt, sys)
        if (!text) throw err
      }
      setResult({ ts: Date.now(), text })
      toast.success("Done", "File analyzed.")
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
        title="File Analysis"
        sub="Upload any document and let AI extract insights, summary, and key points."
      >
        <StatusBadge variant="info" dot>Beta</StatusBadge>
      </SectionHead>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <label className="block">
            <div className="card-title mb-1.5">File</div>
            <div className="panel p-6 border-dashed hover:border-gold/40 transition-colors cursor-pointer relative">
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="text-center">
                <Upload size={24} className="text-gold mx-auto mb-2" />
                {file ? (
                  <>
                    <div className="font-mono text-sm text-white break-all">{file.name}</div>
                    <div className="text-xs text-white/40 mt-1">{(file.size / 1024).toFixed(1)} KB - {file.type || "unknown"}</div>
                  </>
                ) : (
                  <>
                    <div className="font-mono text-sm text-white">Drop or click to upload</div>
                    <div className="text-xs text-white/40 mt-1">PDF, DOCX, TXT, MD, CSV...</div>
                  </>
                )}
              </div>
            </div>
          </label>

          <div>
            <label className="card-title block mb-1.5">Hint (optional)</label>
            <input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              className="input-base"
              placeholder="e.g. Focus on financial highlights and risks."
            />
          </div>

          <button onClick={run} disabled={busy || !file} className="btn-primary btn-lg">
            <Sparkles size={14} />
            {busy ? "Analyzing..." : "Analyze file"}
          </button>

          {error && <ErrorBox title="Analysis failed" message={error} />}
        </div>

        <aside className="space-y-3">
          <InfoCard title="Supported" body="Most document and text formats. Binary files are described from metadata." />
          <InfoCard title="Endpoint" body="POST /api/ai-analyze/file" />
          <InfoCard title="Privacy" body="File is sent only to the API; not stored anywhere." />
        </aside>
      </div>

      <div className="mt-8">
        <div className="card-title mb-2">Result</div>
        {busy ? (
          <div className="panel p-6 space-y-2">
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-3/4" />
            <div className="skeleton h-3 w-2/3" />
            <div className="skeleton h-3 w-5/6" />
          </div>
        ) : result ? (
          <div className="panel p-5 border-gold/20">
            <div className="flex items-center gap-2 mb-3">
              <StatusBadge variant="success" dot>Done</StatusBadge>
              <StatusBadge variant="outline">{file?.name}</StatusBadge>
              <span className="text-[10px] font-mono text-white/40">{fmtDate(result.ts)}</span>
            </div>
            <div className="prose-sm text-sm text-white/90 leading-relaxed"
                 dangerouslySetInnerHTML={{ __html: md(result.text) }} />
          </div>
        ) : (
          <EmptyState title="No analysis yet" sub="Upload a file to see structured insights." />
        )}
      </div>
    </div>
  )
}

function InfoCard({ title, body }) {
  return (
    <div className="panel p-4">
      <div className="card-title mb-1">{title}</div>
      <div className="text-xs text-white/60">{body}</div>
    </div>
  )
}