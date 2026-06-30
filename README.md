# Auralis AI v2 - BMS Studio

A cyberpunk-glassmorphism, all-in-one AI tools dashboard. **110+ endpoints** under one interface.

> Built fresh from scratch on top of the original `BMS-AI-main` Auralis AI. The old vanilla-JS app still works; v2 is the React/Vite/Tailwind redesign.

## ⚡ What's inside

| Category | Count | Examples |
|---|---|---|
| **AI Chat Models** | 53 | Claude Opus 4.8, GPT-5.5, Gemini 3 Pro, DeepSeek R1, Llama 4 Maverick, Minimax, and more |
| **Image Generation** | 2 | Synox Text-to-Image (GET), Qwen Image AI (POST) |
| **AI Analysis** | 2 | File Analysis (`/api/ai-analyze/file`), Image Analysis (`/api/ai-analyze/image`) |
| **Image Uploaders** | 10 | Imgur, Catbox, Gofile, Litterbox, Uguu, ImgBB, ... |
| **Media Downloaders** | 28 | TikTok, Instagram, YouTube, Spotify, X, Threads, GitHub, GDrive, MediaFire, Mega, Pinterest, RedNote, **PH/PornHD/XNXX**, ... |
| **News Sources** | 54 | BBC, CNN, Reuters, NASA, CNA, Detik, Kompas, BMKG, BI, ... |
| **Image Tools** | 13 | Remove BG, Upscale, Sepia, Invert, Flip, Pixelate, Round Corners, Split, Noise, Blur, Sharpen, Solarize, Glow |

## 🎨 Design system

- **Theme:** Premium Dark Mode - Charcoal (`#0b0b0d`) + Jet Black (`#050507`) backgrounds with gold accents (`#d4af37`).
- **StatusBadge component** with 7 variants (default / secondary / destructive / success / warning / info / outline) and optional pulsing dot.
- **Glassmorphism** panels with `backdrop-blur` + `border-white/5`.
- **Typography:** Inter (sans) for body, JetBrains Mono for status indicators and code.
- **Shape language:** `rounded-none` everywhere for sharp, premium feel.
- **Animations:** Custom `scan`, `shimmer`, `pulseGlow` keyframes.
- **Layout:** Sticky sidebar (desktop) / collapsible top nav (mobile).

## 🏗️ Architecture

```
src/
├── App.jsx                    # Routes
├── main.jsx                   # Entry point
├── index.css                  # Tailwind base + custom utilities
├── config/
│   └── endpoints.js           # 110+ endpoint registry (single source of truth)
├── lib/
│   ├── api.js                 # postXylo, getUrl, extractUrl, fileToDataURL, aiChatXylo, ...
│   └── utils.js               # cn, uid, escHtml (via String.fromCharCode), md(), copyText
├── components/
│   ├── Sidebar.jsx            # Desktop nav
│   ├── Topbar.jsx             # Mobile nav
│   ├── StatusBadge.jsx        # Tag component (7 variants)
│   └── UI.jsx                 # SectionHead, Skeleton, EmptyState, ErrorBox, Card
├── state/
│   └── ToastContext.jsx       # Global toast system (success/error/info/warn)
└── pages/
    ├── Home.jsx               # Landing page
    ├── Chat.jsx               # 52-model chat
    ├── ImageGen.jsx           # Synox + Qwen image generation
    ├── FileAnalyze.jsx        # File upload + AI summary
    ├── ImageAnalyze.jsx       # Vision AI
    ├── Uploaders.jsx          # 10 image hosts
    ├── Downloaders.jsx        # 28 downloader endpoints
    ├── News.jsx               # 54 news sources
    ├── ImageTools.jsx         # 13 image effects
    └── Models.jsx             # Model catalog
```

## 🚀 Local development

```bash
npm install
npm run dev
```

Vite serves on `http://localhost:5173`.

## 📦 Build

```bash
npm run build
npm run preview
```

Output goes to `dist/`.

## 🌐 Deploy to GitHub Pages

### Option A: Manual (simplest)

1. Push this repo to GitHub.
2. Run `npm run build` locally.
3. Push the contents of `dist/` to a `gh-pages` branch:

   ```bash
   git checkout --orphan gh-pages
   git --work-tree dist add --all
   git --work-tree dist commit -m "deploy"
   git push origin HEAD:gh-pages --force
   ```

4. In your repo settings → Pages, set the source branch to `gh-pages`.

### Option B: `gh-pages` package (already in devDependencies)

```bash
npm run deploy
```

This runs `vite build && gh-pages -d dist`.

### Option C: GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
      - id: deploy
        uses: actions/deploy-pages@v4
```

Then in repo Settings → Pages → Source → **GitHub Actions**.

### Important: base path

If you deploy to `https://<user>.github.io/<repo>/`, override the base at build time:

```bash
vite build --base=/<repo>/
```

Or set in `vite.config.js`:

```js
export default defineConfig({
  base: process.env.GH_PAGES ? '/<repo>/' : './',
  // ...
})
```

The default `base: './'` in this repo works for any path because Vite generates relative asset URLs.

## 🔌 API endpoints used

All endpoints are documented in `src/config/endpoints.js`.

- **Synox Cloud** — `https://api.synoxcloud.xyz` (chat, image generation)
- **Xylo API** — `https://xyloapi.qzz.io` (uploaders, downloaders, news, image tools, analysis)

No API keys are needed; both are public proxies.

## 📝 License

MIT — do whatever you want.

---

**Maintained by [BMS Studio](https://discord.gg/QzJGyYctDr)**