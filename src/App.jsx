import { Routes, Route } from "react-router-dom"
import Sidebar from "./components/Sidebar.jsx"
import Topbar from "./components/Topbar.jsx"
import Home from "./pages/Home.jsx"
import Chat from "./pages/Chat.jsx"
import ImageGen from "./pages/ImageGen.jsx"
import FileAnalyze from "./pages/FileAnalyze.jsx"
import ImageAnalyze from "./pages/ImageAnalyze.jsx"
import Uploaders from "./pages/Uploaders.jsx"
import Downloaders from "./pages/Downloaders.jsx"
import News from "./pages/News.jsx"
import ImageTools from "./pages/ImageTools.jsx"
import Models from "./pages/Models.jsx"

function DiscordMini() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={11} height={11}>
      <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.2a.074.074 0 0 0-.079.037c-.34.6-.717 1.387-.98 2.005a18.27 18.27 0 0 0-5.487 0c-.264-.625-.654-1.405-.98-2.005a.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 5.183 4.37a.07.07 0 0 0-.032.027C2.034 8.91 1.27 13.32 1.66 17.677a.083.083 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.46-.628.873-1.295 1.226-1.994a.076.076 0 0 0-.042-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.193.372-.292a.074.074 0 0 1 .077-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.128 12.298 12.298 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.365 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-4.971-.838-9.302-3.549-13.281a.06.06 0 0 0-.031-.028z"/>
    </svg>
  )
}

export default function App() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-x-hidden">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/image-gen" element={<ImageGen />} />
            <Route path="/analyze/file" element={<FileAnalyze />} />
            <Route path="/analyze/image" element={<ImageAnalyze />} />
            <Route path="/uploaders" element={<Uploaders />} />
            <Route path="/downloaders" element={<Downloaders />} />
            <Route path="/news" element={<News />} />
            <Route path="/image-tools" element={<ImageTools />} />
            <Route path="/models" element={<Models />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </main>
        <footer className="border-t border-white/5 px-4 py-6 bg-jet/50">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-[0.18em] text-white/40">
            <span>(c) 2026 BMS Studio // Auralis AI v2.0</span>
            <a
              href="https://discord.gg/QzJGyYctDr"
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-gold transition-colors"
            >
              <DiscordMini />
              Join BMS Studio Discord
            </a>
            <span>Built with React + Vite + Tailwind</span>
          </div>
        </footer>
      </div>
    </div>
  )
}