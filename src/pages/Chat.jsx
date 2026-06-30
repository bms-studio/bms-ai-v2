import { useEffect, useRef, useState } from "react"
import { Send, Copy, RotateCw, ChevronDown, Search } from "lucide-react"
import StatusBadge from "../components/StatusBadge.jsx"
import { Card, EmptyState } from "../components/UI.jsx"
import { useToast } from "../state/ToastContext.jsx"
import { AI_MODELS, MODEL_CATEGORIES } from "../config/endpoints.js"
import { aiChatXylo } from "../lib/api.js"
import { uid, fmtDate, md, escHtml, copyText } from "../lib/utils.js"

const STORAGE = {
  convo: "auralis.v2.conversations",
  cur: "auralis.v2.current",
  model: "auralis.v2.activeModel",
  sys: "auralis.v2.systemPrompt"
}

function loadConvos() {
  try { return JSON.parse(localStorage.getItem(STORAGE.convo) || "[]") } catch { return [] }
}
function saveConvos(arr) {
  try { localStorage.setItem(STORAGE.convo, JSON.stringify(arr)) } catch {}
}

export default function Chat() {
  const toast = useToast()
  const [convos, setConvos] = useState(() => {
    const stored = loadConvos()
    if (stored.length) return stored
    const c = mkConvo()
    saveConvos([c])
    return [c]
  })
  const [curId, setCurId] = useState(() => localStorage.getItem(STORAGE.cur) || convos[0]?.id)
  const [modelId, setModelId] = useState(() => localStorage.getItem(STORAGE.model) || AI_MODELS[0].id)
  const [pickOpen, setPickOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [sysPrompt, setSysPrompt] = useState(() => localStorage.getItem(STORAGE.sys) || "")
  const scrollRef = useRef(null)

  const convo = convos.find((c) => c.id === curId) || convos[0]

  useEffect(() => { if (curId) localStorage.setItem(STORAGE.cur, curId) }, [curId])
  useEffect(() => { localStorage.setItem(STORAGE.model, modelId) }, [modelId])
  useEffect(() => { localStorage.setItem(STORAGE.sys, sysPrompt) }, [sysPrompt])
  useEffect(() => { saveConvos(convos) }, [convos])

  const model = AI_MODELS.find((m) => m.id === modelId) || AI_MODELS[0]
  const filteredModels = AI_MODELS.filter((m) =>
    !search || (m.name + " " + m.provider + " " + m.category).toLowerCase().includes(search.toLowerCase())
  )

  function newConvo() {
    const c = mkConvo()
    setConvos([c, ...convos])
    setCurId(c.id)
    toast.success("Ready", "New chat opened.")
  }

  function deleteConvo(id) {
    const next = convos.filter((c) => c.id !== id)
    if (!next.length) { const c = mkConvo(); next.push(c); setCurId(c.id) }
    else if (!next.find((c) => c.id === curId)) setCurId(next[0].id)
    setConvos(next)
  }

  async function send() {
    const t = text.trim()
    if (!t || busy) return
    setText("")
    const userMsg = { id: uid(), role: "user", content: t, createdAt: Date.now() }
    const assistantMsg = { id: uid(), role: "assistant", model: model.id, content: "", streaming: true, createdAt: Date.now() }

    setConvos((arr) => arr.map((c) => {
      if (c.id !== convo.id) return c
      const title = c.title === "New chat" ? t.slice(0, 52) : c.title
      return { ...c, title, updatedAt: Date.now(), messages: [...c.messages, userMsg, assistantMsg] }
    }))
    setBusy(true)

    try {
      const reply = await aiChatXylo(model.id, t, sysPrompt)
      setConvos((arr) => arr.map((c) => {
        if (c.id !== convo.id) return c
        return {
          ...c,
          updatedAt: Date.now(),
          messages: c.messages.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: reply || "(empty response)", streaming: false } : m
          )
        }
      }))
    } catch (err) {
      setConvos((arr) => arr.map((c) => {
        if (c.id !== convo.id) return c
        return {
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: "Error: " + (err.message || "failed"), error: true, streaming: false } : m
          )
        }
      }))
      toast.error("Error", err.message || "Failed to get response")
    } finally {
      setBusy(false)
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      })
    }
  }

  async function retry(msgId) {
    if (busy) return
    const idx = convo.messages.findIndex((m) => m.id === msgId)
    if (idx <= 0) return
    const prev = convo.messages.slice(0, idx).reverse().find((m) => m.role === "user")
    if (!prev) return
    const assistantMsg = { id: uid(), role: "assistant", model: model.id, content: "", streaming: true, createdAt: Date.now() }
    setConvos((arr) => arr.map((c) => {
      if (c.id !== convo.id) return c
      return {
        ...c,
        messages: [...c.messages.slice(0, idx).filter((m) => m.id !== msgId), ...convo.messages.slice(idx + 1), assistantMsg]
      }
    }))
    setBusy(true)
    try {
      const reply = await aiChatXylo(model.id, prev.content, sysPrompt)
      setConvos((arr) => arr.map((c) => {
        if (c.id !== convo.id) return c
        return { ...c, messages: c.messages.map((m) => m.id === assistantMsg.id ? { ...m, content: reply || "(empty)", streaming: false } : m) }
      }))
    } catch (err) {
      setConvos((arr) => arr.map((c) => {
        if (c.id !== convo.id) return c
        return { ...c, messages: c.messages.map((m) => m.id === assistantMsg.id ? { ...m, content: "Error: " + err.message, error: true, streaming: false } : m) }
      }))
    } finally { setBusy(false) }
  }

  return (
    <div className="flex h-[calc(100vh-0px)]">
      {/* Conversation list */}
      <aside className="hidden md:flex w-64 flex-col border-r border-white/5 bg-jet/50">
        <div className="p-3 border-b border-white/5 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/70">Conversations</span>
          <button onClick={newConvo} className="text-xs px-2 py-1 border border-gold/30 text-gold hover:bg-gold/10 font-mono uppercase tracking-[0.08em]">
            + New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convos.map((c) => (
            <div
              key={c.id}
              onClick={() => setCurId(c.id)}
              className={"px-3 py-2.5 border-b border-white/5 cursor-pointer group " + (c.id === curId ? "bg-gold/10 border-l-2 border-l-gold" : "border-l-2 border-l-transparent hover:bg-white/5")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{c.title}</div>
                  <div className="text-[10px] font-mono text-white/40 mt-0.5">{fmtDate(c.updatedAt)}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConvo(c.id) }}
                  className="text-white/30 hover:text-destructive text-xs opacity-0 group-hover:opacity-100"
                  title="Delete"
                >x</button>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-white/5">
          <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1.5 block">
            System Prompt
          </label>
          <textarea
            value={sysPrompt}
            onChange={(e) => setSysPrompt(e.target.value)}
            placeholder="e.g. Answer concisely..."
            rows={3}
            className="textarea-base text-[11px]"
          />
        </div>
      </aside>

      {/* Chat area */}
      <section className="flex-1 flex flex-col min-w-0">
        {/* Model picker */}
        <div className="border-b border-white/5 p-3 relative bg-jet/40">
          <button
            onClick={() => setPickOpen(!pickOpen)}
            className="w-full md:w-auto flex items-center gap-3 px-3 py-2 border border-white/10 hover:border-gold/30 transition-colors"
          >
            <div
              className="w-7 h-7 flex items-center justify-center font-mono font-bold text-white text-xs"
              style={{ background: `linear-gradient(135deg, ${model.accent}, ${shade(model.accent, -40)})` }}
            >
              {initials(model.name)}
            </div>
            <div className="text-left">
              <div className="text-sm text-white">{model.name}</div>
              <div className="text-[10px] font-mono text-white/40 uppercase tracking-[0.08em]">{model.provider} / {model.category}</div>
            </div>
            <ChevronDown size={14} className="ml-2 text-white/50" />
          </button>

          {pickOpen && (
            <div className="absolute top-full left-3 right-3 md:right-auto md:w-96 mt-1 panel bg-charcoal/95 backdrop-blur-xl z-30 max-h-[60vh] overflow-hidden flex flex-col">
              <div className="p-2 border-b border-white/5 flex items-center gap-2">
                <Search size={14} className="text-white/40" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search models..."
                  className="bg-transparent border-0 outline-none text-sm flex-1 placeholder-white/30"
                />
              </div>
              <div className="overflow-y-auto">
                {filteredModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setModelId(m.id); setPickOpen(false); setSearch("") }}
                    className={"w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 text-left " + (m.id === modelId ? "bg-gold/10" : "")}
                  >
                    <div
                      className="w-7 h-7 flex items-center justify-center font-mono font-bold text-white text-[10px]"
                      style={{ background: `linear-gradient(135deg, ${m.accent}, ${shade(m.accent, -40)})` }}
                    >{initials(m.name)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{m.name}</div>
                      <div className="text-[10px] font-mono text-white/40 uppercase tracking-[0.08em]">{m.provider}</div>
                    </div>
                    <StatusBadge variant="outline">{m.category}</StatusBadge>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4">
          {convo.messages.length === 0 ? (
            <EmptyState
              title="Start the conversation"
              sub="Pick a model above and type your first message."
            />
          ) : convo.messages.map((m) => <Message key={m.id} msg={m} onRetry={retry} />)}
        </div>

        {/* Composer */}
        <div className="border-t border-white/5 p-3 bg-jet/40">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
              }}
              placeholder={"Ask " + model.name + ". Enter to send, Shift+Enter for newline."}
              rows={1}
              className="textarea-base flex-1 min-h-[44px] max-h-48"
            />
            <button
              onClick={send}
              disabled={busy || !text.trim()}
              className="btn-primary px-4 h-[44px]"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function Message({ msg, onRetry }) {
  const isUser = msg.role === "user"
  const m = AI_MODELS.find((x) => x.id === msg.model)
  return (
    <div className={"flex gap-3 " + (isUser ? "justify-end" : "")}>
      {!isUser && (
        <div
          className="w-8 h-8 flex-shrink-0 flex items-center justify-center font-mono font-bold text-white text-xs"
          style={{ background: `linear-gradient(135deg, ${m?.accent || "#8b7dd4"}, ${m ? shade(m.accent, -40) : "#60a5fa"})` }}
        >
          {initials(m?.name || "AI")}
        </div>
      )}
      <div className={"max-w-[85%] md:max-w-[75%] " + (isUser ? "order-first" : "")}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-bold text-white">{isUser ? "You" : (m?.name || "Assistant")}</span>
          {!isUser && <StatusBadge variant="outline">{m?.provider || "AI"}</StatusBadge>}
          <span className="text-[10px] font-mono text-white/30">{fmtDate(msg.createdAt)}</span>
        </div>
        <div className={"border p-3 " + (isUser ? "border-gold/30 bg-gold/5" : (msg.error ? "border-destructive/30 bg-destructive/5" : "border-white/10 bg-charcoal/40"))}>
          {msg.streaming ? (
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-gold/60 animate-pulseGlow" />
              <span className="w-1.5 h-1.5 bg-gold/60 animate-pulseGlow" style={{ animationDelay: "0.2s" }} />
              <span className="w-1.5 h-1.5 bg-gold/60 animate-pulseGlow" style={{ animationDelay: "0.4s" }} />
            </div>
          ) : (
            <div
              className="prose-sm text-sm text-white/90 leading-relaxed break-words"
              dangerouslySetInnerHTML={{ __html: md(msg.content) }}
            />
          )}
          <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-2">
            <button
              onClick={() => copyText(escHtml(msg.content) || msg.content)}
              className="text-[10px] font-mono uppercase tracking-[0.08em] text-white/40 hover:text-gold flex items-center gap-1"
            >
              <Copy size={10} /> Copy
            </button>
            {!isUser && !msg.streaming && (
              <button
                onClick={() => onRetry(msg.id)}
                className="text-[10px] font-mono uppercase tracking-[0.08em] text-white/40 hover:text-gold flex items-center gap-1"
              >
                <RotateCw size={10} /> Retry
              </button>
            )}
          </div>
        </div>
      </div>
      {isUser && (
        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-gold/20 border border-gold/40 text-gold font-mono font-bold text-xs">
          U
        </div>
      )}
    </div>
  )
}

function mkConvo() {
  return { id: uid(), title: "New chat", model: AI_MODELS[0].id, createdAt: Date.now(), updatedAt: Date.now(), messages: [] }
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