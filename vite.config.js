import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createProxyMiddleware } from 'http-proxy-middleware'

// Base path is "./" so it works on user.github.io/repo-name OR custom domain.
// For project pages on GitHub Pages, override at build time:
//   vite build --base=/bms-ai-v2/

// Plugin kecil untuk proxy /api/* ke server.js ketika dev server jalan.
// Tidak mengubah production build; production build dilayani oleh server.js
// langsung (yang juga handle /api/*).
function apiProxyPlugin() {
  return {
    name: 'bms-api-proxy',
    configureServer(server) {
      // Lazy import agar tidak ikut ter-bundel di production.
      // Vite resolve module ini hanya saat dev.
      server.middlewares.use(
        '/api',
        createProxyMiddleware({
          target: 'http://localhost:8080',
          changeOrigin: true,
        })
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), apiProxyPlugin()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
    chunkSizeWarningLimit: 1500
  },
  server: {
    port: 5173,
    open: true
  }
})