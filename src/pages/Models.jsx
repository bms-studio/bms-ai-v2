import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Search, MessageSquare } from "lucide-react"
import StatusBadge from "../components/StatusBadge.jsx"
import { SectionHead } from "../components/UI.jsx"
import { AI_MODELS, MODEL_CATEGORIES } from "../config/endpoints.js"

export default function Models() {
  const nav = useNavigate()
  const [cat, setCat] = useState("All")
  const [q, setQ] = useState("")

  const filtered = useMemo(() => {
    return AI_MODELS.filter((m) =>
      (cat === "All" || m.category === cat) &&
      (!q || (m.name + " " + m.provider + " " + m.category).toLowerCase().includes(q.toLowerCase()))
    )
  }, [cat, q])

  function chat(m) {
    localStorage.setItem("auralis.v2.activeModel", m.id)
    nav("/chat")
  }

  return (
    <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto">
      <SectionHead
        kicker="// catalog"
        title="Models"
        sub={`${AI_MODELS.length} AI models across ${MODEL_CATEGORIES.length - 1} providers.`}
      >
        <StatusBadge variant="default" dot>{filtered.length} shown</StatusBadge>
      </SectionHead>

      <div className="panel p-4 mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-white/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search models..."
            className="input-base flex-1"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {MODEL_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={"px-2 py-1 border text-[10px] font-mono uppercase tracking-[0.08em] " +
                (cat === c
                  ? "border-gold/40 bg-gold/10 text-gold"
                  : "border-white/10 text-white/60 hover:border-white/20")}
            >{c}</button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((m) => (
          <div key={m.id}
               onClick={() => chat(m)}
               className="panel p-4 cursor-pointer hover:border-gold/40 hover:translate-y-[-2px] transition-all group">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div
                className="w-10 h-10 flex items-center justify-center font-mono font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${m.accent}, ${shade(m.accent, -40)})` }}
              >{initials(m.name)}</div>
              <StatusBadge variant="outline">{m.category}</StatusBadge>
            </div>
            <div className="font-bold text-white text-sm">{m.name}</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.08em] text-white/40 mt-0.5">{m.provider}</div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10px] font-mono text-white/30">id: {m.id}</span>
              <span className="text-[10px] font-mono text-gold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <MessageSquare size={10} /> Chat
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function initials(name) {
  const p = String(name || "?").trim().split(/\s+/)
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return (p[0][0] + p[1][0]).toUpperCase()
}
function shade(hex, amount) {
  const c = hex.replace("#", "")
  const r = Math.max(0, Math.min(255, parseInt(c.substr(0, 2), 16) + amount))
  const g = Math.max(0, Math.min(255, parseInt(c.substr(2, 2), 16) + amount))
  const b = Math.max(0, Math.min(255, parseInt(c.substr(4, 2), 16) + amount))
  return `rgb(${r}, ${g}, ${b})`
}