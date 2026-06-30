import React, { createContext, useCallback, useContext, useState } from "react"
import { CheckCircle2, XCircle, Info, AlertTriangle } from "lucide-react"
import { cn, uid } from "../lib/utils.js"

const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])

  const dismiss = useCallback((id) => {
    setItems((arr) => arr.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((title, message = "", variant = "info", ms = 3200) => {
    const id = uid()
    setItems((arr) => [...arr, { id, title, message, variant }])
    setTimeout(() => dismiss(id), ms)
  }, [dismiss])

  const api = {
    push,
    success: (t, m) => push(t, m, "success"),
    error:   (t, m) => push(t, m, "destructive"),
    info:    (t, m) => push(t, m, "info"),
    warn:    (t, m) => push(t, m, "warning")
  }

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {items.map((t) => (
          <ToastItem key={t.id} item={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

function ToastItem({ item, onClose }) {
  const Icon =
    item.variant === "success" ? CheckCircle2
    : item.variant === "destructive" ? XCircle
    : item.variant === "warning" ? AlertTriangle
    : Info
  const tone =
    item.variant === "success"     ? "border-success/30 bg-success/10 text-success"
    : item.variant === "destructive"? "border-destructive/30 bg-destructive/10 text-destructive"
    : item.variant === "warning"   ? "border-warning/30 bg-warning/10 text-warning"
    : "border-info/30 bg-info/10 text-info"
  return (
    <div className={cn(
      "pointer-events-auto min-w-[260px] max-w-sm",
      "border backdrop-blur-md bg-charcoal/85 shadow-glass",
      "px-3 py-2.5 flex items-start gap-2",
      tone
    )}>
      <Icon size={16} className="mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-white">
          {item.title}
        </div>
        {item.message && (
          <div className="text-[11px] text-white/60 mt-0.5 break-words">
            {item.message}
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-white/40 hover:text-white text-xs leading-none"
        aria-label="Close"
      >x</button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error("useToast must be used inside ToastProvider")
  return ctx
}