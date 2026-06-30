import { Link, useLocation } from "react-router-dom"
import { Menu } from "lucide-react"
import { useState } from "react"
import { NAV_GROUPS } from "../config/endpoints.js"
import { cn } from "../lib/utils.js"
import StatusBadge from "./StatusBadge.jsx"

export default function Topbar() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  return (
    <header className="lg:hidden sticky top-0 z-40 border-b border-white/5 bg-jet/85 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 border border-gold/40 bg-gold/10 flex items-center justify-center text-gold font-mono font-bold">
            A
          </div>
          <div className="leading-tight">
            <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-gold/70">
              BMS Studio
            </div>
            <div className="text-white font-bold text-sm">
              Auralis <span className="text-gold">AI</span>
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <StatusBadge variant="success" dot>Live</StatusBadge>
          <button
            onClick={() => setOpen(!open)}
            className="p-2 border border-white/10 text-white/70"
            aria-label="Menu"
          >
            <Menu size={16} />
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-white/5 bg-jet/95 max-h-[70vh] overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="px-2 py-2 border-b border-white/5">
              <div className="px-3 mb-1 text-[9px] font-mono uppercase tracking-[0.18em] text-white/30">
                {group.title}
              </div>
              {group.items.map((it) => (
                <Link
                  key={it.id}
                  to={it.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block px-3 py-2 text-sm border-l-2",
                    loc.pathname === it.to
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-transparent text-white/70 hover:text-white"
                  )}
                >
                  {it.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      )}
    </header>
  )
}