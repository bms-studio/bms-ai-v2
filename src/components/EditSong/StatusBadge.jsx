/* ============================================================
   Auralis AI v2 - Edit Song / Status Badge
   Small pill-shaped badge for queue item statuses.
   ============================================================ */

import React from "react"

const VARIANT_CLASSES = {
  outline: "bg-white/5 text-white/70 border-white/15",
  gold: "bg-gold/15 text-gold border-gold/30",
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  destructive: "bg-red-500/15 text-red-300 border-red-400/30",
}

const DOT_CLASSES = {
  outline: "bg-white/40",
  gold: "bg-gold",
  success: "bg-emerald-400",
  destructive: "bg-red-400",
}

export default function StatusBadge({
  variant = "outline",
  dot = false,
  children,
  className = "",
}) {
  const v = VARIANT_CLASSES[variant] || VARIANT_CLASSES.outline
  const d = DOT_CLASSES[variant] || DOT_CLASSES.outline

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 border font-mono text-[9px] uppercase tracking-wider ${v} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${d}`} />}
      {children}
    </span>
  )
}