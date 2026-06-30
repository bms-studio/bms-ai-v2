import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base path is "/" so it works on user.github.io/repo-name OR custom domain.
// For project pages on GitHub Pages, override at build time:
//   vite build --base=/bms-ai-v2/
export default defineConfig({
  plugins: [react()],
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