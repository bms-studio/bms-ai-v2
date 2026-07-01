import { Link } from "react-router-dom"
import {
  MessageSquare, Sparkles, Upload, Download, Newspaper,
  Wand2, Image as ImageIcon, FileText, Shield, Cpu, Globe, Zap, ArrowRight
} from "lucide-react"
import StatusBadge from "../components/StatusBadge.jsx"
import { Card } from "../components/UI.jsx"
import { AI_MODELS } from "../config/endpoints.js"

const STATS = [
  { num: AI_MODELS.length.toString(), label: "AI Models" },
  { num: "10",  label: "Uploaders" },
  { num: "28",  label: "Downloaders" },
  { num: "54",  label: "News Sources" },
  { num: "13",  label: "Image Tools" },
  { num: "2",   label: "Image AIs" }
]

const QUICK = [
  { to: "/chat",          label: "Chat",          sub: "Ask 53 AI models anything", icon: MessageSquare, color: "#8b7dd4" },
  { to: "/image-gen",     label: "Image Gen",     sub: "Two AI image engines",      icon: Sparkles,     color: "#f59e0b" },
  { to: "/analyze/image", label: "Image Analysis",sub: "Vision AI on any image",    icon: ImageIcon,    color: "#22d3ee" },
  { to: "/analyze/file",  label: "File Analysis", sub: "Summarize docs with AI",    icon: FileText,     color: "#a78bfa" },
  { to: "/uploaders",     label: "Image Hosts",   sub: "10 free CDN uploaders",     icon: Upload,       color: "#4ade80" },
  { to: "/downloaders",   label: "Downloaders",   sub: "28 platforms supported",    icon: Download,     color: "#fb7185" },
  { to: "/news",          label: "News",          sub: "54 sources worldwide",      icon: Newspaper,    color: "#0ea5e9" },
  { to: "/image-tools",   label: "Image Tools",   sub: "BG remove, blur, sepia...", icon: Wand2,        color: "#facc15" }
]

const FEATURES = [
  { icon: Cpu,    title: "Multi-Provider", desc: "Backed by multiple AI providers. Switch models seamlessly." },
  { icon: Zap,    title: "Real-Time",      desc: "Streaming-ready infra. Low-latency responses across endpoints." },
  { icon: Shield, title: "Privacy First",  desc: "Conversations stored only in your browser. Nothing leaves." },
  { icon: Globe,  title: "Open Source",    desc: "MIT-licensed. Deploy anywhere - GH Pages, Vercel, Netlify." }
]

const HERO_GIF = "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3bzVjY2p0dGExZzZ5YWo4azl2MjB1d2o2eDQ0NmR0ZWZlcndleXBieiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/UC8DbMqXvkpd6/giphy.gif"
const DISCORD_GIF = "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3ODVhaHpzNDBqN3ZhN2J0NWR0d3lpZjFxamgwOG56NGo4NG1qem5wYyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/8JCIWBz8oRRLZmZhNn/giphy.gif"

function DiscordIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.2a.074.074 0 0 0-.079.037c-.34.6-.717 1.387-.98 2.005a18.27 18.27 0 0 0-5.487 0c-.264-.625-.654-1.405-.98-2.005a.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 5.183 4.37a.07.07 0 0 0-.032.027C2.034 8.91 1.27 13.32 1.66 17.677a.083.083 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.46-.628.873-1.295 1.226-1.994a.076.076 0 0 0-.042-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.193.372-.292a.074.074 0 0 1 .077-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.128 12.298 12.298 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.365 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-4.971-.838-9.302-3.549-13.281a.06.06 0 0 0-.031-.028z"/>
    </svg>
  )
}

export default function Home() {
  return (
    <div className="relative">
      {/* Animated decorative orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full bg-gold/5 blur-3xl animate-pulseGlow" />
        <div className="absolute top-1/3 right-10 w-72 h-72 rounded-full bg-info/5 blur-3xl animate-pulseGlow" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 rounded-full bg-destructive/5 blur-3xl animate-pulseGlow" style={{ animationDelay: "2s" }} />
      </div>

      <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto">
        {/* Hero */}
        <section className="mb-12 relative">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <StatusBadge variant="success" dot>System Online</StatusBadge>
            <StatusBadge variant="default">v2.5 UPDATE</StatusBadge>
            <StatusBadge variant="outline">{AI_MODELS.length} Models</StatusBadge>
            <a
              href="https://discord.gg/QzJGyYctDr"
              target="_blank" rel="noreferrer"
              className="ml-auto flex items-center gap-1.5 px-3 py-1 border border-[#5865F2]/40 bg-[#5865F2]/10 text-[#a8b1ff] hover:bg-[#5865F2]/20 hover:text-white transition-colors font-mono text-[10px] uppercase tracking-[0.05em]"
            >
              <DiscordIcon size={11} />
              Join Discord
            </a>
          </div>
          <div className="grid md:grid-cols-5 gap-6 items-center">
            <div className="md:col-span-3">
              <h1 className="text-4xl md:text-6xl font-bold text-white leading-[1.05] tracking-tight">
                One workspace.<br />
                <span className="text-gold text-glow-gold">Every AI you need.</span>
              </h1>
              <p className="text-white/50 mt-4 max-w-2xl text-base md:text-lg leading-relaxed">
                Chat with Claude, GPT, Gemini, DeepSeek and 48 more model ai. Generate images, analyze
                files, download media from 28 platforms, scrape news from 54 sources, and run
                13 image effects. All in one interface.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link to="/chat" className="btn-primary btn-lg">
                  <MessageSquare size={16} /> Start chatting
                  <ArrowRight size={14} />
                </Link>
                <Link to="/models" className="btn-ghost btn-lg">
                  Browse {AI_MODELS.length} models
                </Link>
              </div>
              <div className="mt-6 flex items-center gap-4 text-[10px] font-mono uppercase tracking-[0.18em] text-white/30 flex-wrap">
                <span>// No login</span>
                <span>// No API key</span>
                <span>// Free forever</span>
                <span>// BMS STUDIO PROJECT</span>
              </div>
            </div>
            <div className="md:col-span-2 relative">
              <div className="relative aspect-[16/10] overflow-hidden border border-gold/30 shadow-glow-gold">
                <img src={HERO_GIF} alt="Auralis AI hero animation" className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-jet via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <StatusBadge variant="success" dot>Live</StatusBadge>
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/60">// system.online</span>
                </div>
              </div>
              <div className="absolute -top-2 -right-2 w-12 h-12 border border-gold/40 bg-gold/10 rotate-45 animate-pulseGlow" />
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-white/5 border border-white/5 mb-12">
          {STATS.map((s) => (
            <div key={s.label} className="bg-jet/80 p-4 text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="text-2xl font-bold text-gold font-mono relative">{s.num}</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/40 mt-1 relative">
                {s.label}
              </div>
            </div>
          ))}
        </section>

        {/* Quick tiles */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/70 mb-1">
                // Modules
              </div>
              <h2 className="text-2xl font-bold text-white">Pick a tool</h2>
            </div>
            <StatusBadge variant="outline">{QUICK.length} tools</StatusBadge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {QUICK.map((q) => {
              const Icon = q.icon
              return (
                <Link key={q.to} to={q.to}>
                  <Card accent={q.color} className="h-full hover:translate-y-[-2px] transition-transform group">
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className="w-10 h-10 flex items-center justify-center border transition-all group-hover:scale-110"
                        style={{ borderColor: q.color + "55", background: q.color + "15", color: q.color }}
                      >
                        <Icon size={18} />
                      </div>
                      <StatusBadge variant="outline">Live</StatusBadge>
                    </div>
                    <div className="font-bold text-white">{q.label}</div>
                    <div className="text-xs text-white/40 mt-1">{q.sub}</div>
                  </Card>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Features */}
        <section className="mb-12 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <Card key={f.title}>
                <Icon size={20} className="text-gold mb-3" />
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/70 mb-1">
                  {f.title}
                </div>
                <div className="text-sm text-white/60 leading-relaxed">{f.desc}</div>
              </Card>
            )
          })}
        </section>

        {/* Discord CTA */}
        <section className="panel p-6 md:p-8 border-gold/30 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <img src={DISCORD_GIF} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/70 mb-1">
                // community
              </div>
              <h3 className="text-2xl font-bold text-white">Join the BMS Studio Discord</h3>
              <p className="text-sm text-white/50 mt-1 max-w-xl">
                Get help, Order Development, request features, and chat with other AI enthusiasts.
              </p>
            </div>
            <a
              href="https://discord.gg/QzJGyYctDr"
              target="_blank" rel="noreferrer"
              className="btn-primary btn-lg flex items-center gap-2 whitespace-nowrap"
            >
              <DiscordIcon size={16} />
              Join Discord Server
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}
