import { cn } from "../lib/utils.js"

const VARIANTS = {
  default:     "border-gold/30 bg-gold/10 text-gold shadow-glow-gold",
  secondary:   "border-white/10 bg-charcoal text-white/80",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive shadow-glow-error",
  success:     "border-success/30 bg-success/10 text-success shadow-glow-success",
  warning:     "border-warning/30 bg-warning/10 text-warning shadow-glow-warn",
  info:        "border-info/30 bg-info/10 text-info shadow-glow-info",
  outline:     "border-white/10 bg-transparent text-white/60"
}

const DOT_COLORS = {
  default: "bg-gold",
  success: "bg-success",
  destructive: "bg-destructive",
  warning: "bg-warning",
  info: "bg-info",
  secondary: "bg-white/60",
  outline: "bg-white/40"
}

export default function StatusBadge({
  children,
  variant = "default",
  dot = false,
  className = "",
  ...props
}) {
  const cls = VARIANTS[variant] || VARIANTS.default
  const dotCls = DOT_COLORS[variant] || DOT_COLORS.default
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-0.5",
        "text-[10px] font-mono font-bold uppercase tracking-[0.05em]",
        "transition-colors rounded-none select-none whitespace-nowrap",
        cls,
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn("w-1.5 h-1.5", dotCls, variant !== "secondary" && variant !== "outline" && "animate-pulseGlow")} />
      )}
      {children}
    </span>
  )
}