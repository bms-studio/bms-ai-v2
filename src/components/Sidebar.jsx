import { NavLink } from "react-router-dom"
import {
  Home, MessageSquare, Sparkles, Upload, Download, Newspaper,
  Wand2, LayoutGrid, Activity
} from "lucide-react"
import { NAV_GROUPS } from "../config/endpoints.js"
import { cn } from "../lib/utils.js"
import StatusBadge from "./StatusBadge.jsx"

const ICONS = {
  home: Home,
  chat: MessageSquare,
  "image-gen": Sparkles,
  "file-analyze": Upload,
  "image-analyze": Wand2,
  uploaders: Upload,
  downloaders: Download,
  news: Newspaper,
  "image-tools": Wand2,
  models: LayoutGrid
}

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-white/5 bg-jet/70 backdrop-blur-md">
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 border border-gold/40 bg-gold/10 flex items-center justify-center text-gold font-mono font-bold text-lg shadow-glow-gold">
            BMS
          </div>
          <div className="leading-tight">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/70">
              BMS Studio
            </div>
            <div className="text-white font-bold tracking-tight">
              Auralis <span className="text-gold">AI</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <StatusBadge variant="success" dot>v2.5 UPDATE</StatusBadge>
          <StatusBadge variant="default">Live</StatusBadge>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-4">
            <div className="px-5 mb-1.5 text-[9px] font-mono uppercase tracking-[0.18em] text-white/30">
              {group.title}
            </div>
            <div className="space-y-px px-2">
              {group.items.map((it) => {
                const Icon = ICONS[it.id] || Activity
                return (
                  <NavLink
                    key={it.id}
                    to={it.to}
                    end={it.to === "/"}
                    className={({ isActive }) => cn(
                      "group flex items-center gap-3 px-3 py-2 text-sm",
                      "border-l-2 transition-colors",
                      isActive
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-transparent text-white/60 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Icon size={15} className="flex-shrink-0" />
                    <span className="truncate">{it.label}</span>
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-white/5 space-y-2">
        <div className="flex items-center gap-2">
          <StatusBadge variant="default" dot>Ready</StatusBadge>
          <StatusBadge variant="outline">v2.5 UPDATE.0</StatusBadge>
        </div>
        <a
          href="https://discord.gg/QzJGyYctDr"
          target="_blank"
          rel="noreferrer"
          className="block text-[10px] font-mono uppercase tracking-[0.08em] text-white/40 hover:text-gold transition-colors"
        >
          // join BMS Studio Discord
        </a>
      </div>
    </aside>
  )
}