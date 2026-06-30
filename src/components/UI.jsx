import { cn } from "../lib/utils.js"
import StatusBadge from "./StatusBadge.jsx"

export function SectionHead({ kicker, title, sub, children }) {
  return (
    <div className="mb-6 pb-4 border-b border-white/5 flex items-end justify-between gap-4 flex-wrap">
      <div>
        {kicker && (
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/70 mb-1">
            {kicker}
          </div>
        )}
        <h1 className="text-2xl md:text-3xl font-bold text-white">{title}</h1>
        {sub && <p className="text-sm text-white/50 mt-1 max-w-2xl">{sub}</p>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  )
}

export function Skeleton({ lines = 3, withBlock = false }) {
  return (
    <div className="space-y-2">
      {withBlock && <div className="skeleton h-32 w-full" />}
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={cn("skeleton h-3", i % 2 === 0 ? "w-full" : "w-2/3")} />
      ))}
    </div>
  )
}

export function EmptyState({ title, sub, action }) {
  return (
    <div className="border border-dashed border-white/10 p-8 text-center bg-jet/40">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/60 mb-2">
        // idle
      </div>
      <div className="text-white font-bold mb-1">{title}</div>
      {sub && <div className="text-sm text-white/50 max-w-md mx-auto">{sub}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorBox({ title = "Error", message, className = "" }) {
  return (
    <div className={cn("border border-destructive/30 bg-destructive/10 p-4", className)}>
      <div className="flex items-center gap-2 mb-2">
        <StatusBadge variant="destructive" dot>{title}</StatusBadge>
      </div>
      <div className="text-sm text-white/70 break-words">{message}</div>
    </div>
  )
}

export function ResultCard({ children, className = "" }) {
  return (
    <div className={cn("panel p-5 border-gold/20 bg-charcoal/40", className)}>
      {children}
    </div>
  )
}

export function CodeBlock({ value }) {
  return (
    <pre className="md-pre bg-jet/70 border border-white/5 p-3 overflow-x-auto text-[12px] font-mono text-white/80">
      <code>{value}</code>
    </pre>
  )
}

export function Card({ children, className = "", accent }) {
  return (
    <div
      className={cn(
        "panel p-5 transition-colors hover:border-gold/30",
        className
      )}
      style={accent ? { borderLeft: `2px solid ${accent}` } : undefined}
    >
      {children}
    </div>
  )
}