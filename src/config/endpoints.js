/* ============================================================
   Auralis AI v2 - Endpoints & Features Registry
   Single source of truth for all 100+ API integrations.
   ============================================================ */

export const SYNOX_BASE = 'https://api.synoxcloud.xyz'
export const XYLO_BASE  = 'https://xyloapi.qzz.io'

/* ============================================================
   52 AI Chat Models (xyloapi / synox proxy)
   Pattern: {XYLO_BASE}/api/ai-chat/{modelId}
   ============================================================ */
export const AI_MODELS = [
  { id: 'claude-opus-4.8',        name: 'Claude Opus 4.8',      provider: 'Anthropic', category: 'Claude',    accent: '#f59e0b' },
  { id: 'claude-opus-4.7',        name: 'Claude Opus 4.7',      provider: 'Anthropic', category: 'Claude',    accent: '#fb7185' },
  { id: 'claude-opus-4.6',        name: 'Claude Opus 4.6',      provider: 'Anthropic', category: 'Claude',    accent: '#f97316' },
  { id: 'claude-opus-4.5',        name: 'Claude Opus 4.5',      provider: 'Anthropic', category: 'Claude',    accent: '#fb923c' },
  { id: 'claude-sonnet-4.6',      name: 'Claude Sonnet 4.6',    provider: 'Anthropic', category: 'Claude',    accent: '#facc15' },
  { id: 'claude-haiku-4.5',       name: 'Claude Haiku 4.5',     provider: 'Anthropic', category: 'Claude',    accent: '#fde047' },
  { id: 'claude-haiku-3',         name: 'Claude Haiku 3',       provider: 'Anthropic', category: 'Claude',    accent: '#fde68a' },

  { id: 'gpt-4o-mini',            name: 'GPT-4o Mini',          provider: 'OpenAI',    category: 'GPT',       accent: '#22d3ee' },
  { id: 'gpt-5-nano',             name: 'GPT-5 Nano',           provider: 'OpenAI',    category: 'GPT',       accent: '#38bdf8' },
  { id: 'gpt-5.3',                name: 'GPT-5.3',              provider: 'OpenAI',    category: 'GPT',       accent: '#0ea5e9' },
  { id: 'gpt-5.4',                name: 'GPT-5.4',              provider: 'OpenAI',    category: 'GPT',       accent: '#0891b2' },
  { id: 'gpt-5.5',                name: 'GPT-5.5',              provider: 'OpenAI',    category: 'GPT',       accent: '#14b8a6' },
  { id: 'gpt-online',             name: 'GPT Online',           provider: 'OpenAI',    category: 'GPT',       accent: '#06b6d4' },

  { id: 'gemini-3-pro',           name: 'Gemini 3 Pro',         provider: 'Google',    category: 'Gemini',    accent: '#6366f1' },
  { id: 'gemini-3.1-pro',         name: 'Gemini 3.1 Pro',       provider: 'Google',    category: 'Gemini',    accent: '#4f46e5' },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', provider: 'Google', category: 'Gemini', accent: '#3b82f6' },
  { id: 'gemini',                 name: 'Gemini',               provider: 'Google',    category: 'Gemini',    accent: '#8b5cf6' },

  { id: 'deepseek-r1',            name: 'DeepSeek R1',          provider: 'Deepseek',  category: 'Deepseek',  accent: '#a855f7' },
  { id: 'deepseek-v3.2-thinking', name: 'DeepSeek V3.2 Thinking', provider: 'Deepseek', category: 'Deepseek', accent: '#c084fc' },
  { id: 'deepseek-v4-flash',      name: 'DeepSeek V4 Flash',    provider: 'Deepseek',  category: 'Deepseek',  accent: '#e879f9' },

  { id: 'llama-4-scout',          name: 'Llama 4 Scout',        provider: 'Meta',      category: 'Llama',     accent: '#818cf8' },
  { id: 'llama4-maverick',        name: 'Llama 4 Maverick',     provider: 'Meta',      category: 'Llama',     accent: '#7c3aed' },

  { id: 'qwen-ai',                name: 'Qwen AI',              provider: 'Alibaba',   category: 'Qwen',      accent: '#fb7185' },
  { id: 'qwen3-max',              name: 'Qwen 3 Max',           provider: 'Alibaba',   category: 'Qwen',      accent: '#f43f5e' },
  { id: 'qwen3-next-80b-a3b-instruct', name: 'Qwen 3 Next 80B', provider: 'Alibaba',   category: 'Qwen',      accent: '#ec4899' },

  { id: 'copilot-ai',             name: 'Copilot AI',           provider: 'Microsoft', category: 'Other',     accent: '#4ade80' },
  { id: 'mistral',                name: 'Mistral',              provider: 'Mistral AI',category: 'Other',     accent: '#fb923c' },
  { id: 'x.ai-grok-4.1',          name: 'xAI Grok 4.1',         provider: 'xAI',       category: 'Other',     accent: '#a1a1aa' },
  { id: 'kimi-k2.6',              name: 'Kimi K2.6',            provider: 'Moonshot',  category: 'Other',     accent: '#84cc16' },
  { id: 'perplexity-ai',          name: 'Perplexity AI',        provider: 'Perplexity',category: 'Other',     accent: '#22d3ee' },
  { id: 'gemma-3-27b-it',         name: 'Gemma 3 27B',          provider: 'Google',    category: 'Other',     accent: '#60a5fa' },
  { id: 'glm47flash',             name: 'GLM-4-Flash',          provider: 'Zhipu AI',  category: 'Other',     accent: '#f87171' },
  { id: 'novaai',                 name: 'Nova AI',              provider: 'Amazon',    category: 'Other',     accent: '#f59e0b' },
  { id: 'sakana',                 name: 'Sakana AI',            provider: 'Sakana',    category: 'Other',     accent: '#f9a8d4' },

  { id: 'doraemon-ai',            name: 'Doraemon AI',          provider: 'Special',   category: 'Specialty', accent: '#38bdf8' },
  { id: 'feelbetter-ai',          name: 'Feelbetter AI',        provider: 'Special',   category: 'Specialty', accent: '#34d399' },
  { id: 'felo-ai',                name: 'Felo AI',              provider: 'Special',   category: 'Specialty', accent: '#a78bfa' },
  { id: 'muslimai',               name: 'Muslim AI',            provider: 'Special',   category: 'Specialty', accent: '#22c55e' },
  { id: 'bibleai',                name: 'Bible AI',             provider: 'Special',   category: 'Specialty', accent: '#eab308' },
  { id: 'mathgpt-ai',             name: 'MathGPT AI',           provider: 'Special',   category: 'Specialty', accent: '#3b82f6' },
  { id: 'gitagpt-ai',             name: 'GitaGPT AI',           provider: 'Special',   category: 'Specialty', accent: '#fb923c' },
  { id: 'naire-ai',               name: 'Naire AI',             provider: 'Special',   category: 'Specialty', accent: '#2dd4bf' },
  { id: 'novacore-ai',            name: 'Novacore AI',          provider: 'Special',   category: 'Specialty', accent: '#f97316' },
  { id: 'powerbrain-ai',          name: 'Powerbrain AI',        provider: 'Special',   category: 'Specialty', accent: '#facc15' },
  { id: 'simsimi-ai',             name: 'Simsimi AI',           provider: 'Special',   category: 'Specialty', accent: '#a3e635' },
  { id: 'teach-anything',         name: 'Teach Anything',       provider: 'Special',   category: 'Specialty', accent: '#10b981' },
  { id: 'turboseek-ai',           name: 'Turboseek AI',         provider: 'Special',   category: 'Specialty', accent: '#0ea5e9' },
  { id: 'uncensored-ai',          name: 'Uncensored AI',        provider: 'Special',   category: 'Specialty', accent: '#ef4444' },
  { id: 'unlimited-ai',           name: 'Unlimited AI',         provider: 'Special',   category: 'Specialty', accent: '#7c3aed' },
  { id: 'arena-ai',               name: 'Arena AI',             provider: 'Special',   category: 'Specialty', accent: '#71717a' },
  { id: 'asynt-ai',               name: 'Asynt AI',             provider: 'Special',   category: 'Specialty', accent: '#78716c' },
  { id: 'ai-coder',               name: 'AI Coder',             provider: 'Special',   category: 'Specialty', accent: '#22c55e' },
  { id: 'ai-rangking',            name: 'AI Ranking',           provider: 'Special',   category: 'Specialty', accent: '#a855f7' },
  { id: 'minimax',                name: 'Minimax',              provider: 'Xylo',      category: 'Specialty', accent: '#0ea5e9' }
]

export const MODEL_CATEGORIES = ['All', 'Claude', 'GPT', 'Gemini', 'Deepseek', 'Llama', 'Qwen', 'Specialty', 'Other']

/* ============================================================
   Image Generation (2 endpoints)
   ============================================================ */
export const IMAGE_GEN = {
  synox: {
    id: 'bms-image',
    name: 'BMS IMAGE',
    method: 'GET',
    url: `${SYNOX_BASE}/ai-generate/text-2-image`,
    params: ['prompt', 'ratio'],
    ratios: ['1:1', '16:9', '9:16'],
    responseField: 'data.url'
  },
  qwen: {
    id: 'qwen-image',
    name: 'Qwen Image AI',
    method: 'POST',
    url: `${XYLO_BASE}/api/ai-image/qwenimage`,
    headers: { 'Content-Type': 'application/json' },
    body: { prompt: 'string', aspect_ratio: '1:1' },
    ratios: ['1:1', '16:9', '9:16'],
    responseField: 'data.image'
  }
}

/* ============================================================
   File & Image Analysis
   ============================================================ */
export const AI_ANALYSIS = [
  { id: 'file-analyze',   name: 'File Analysis',       path: '/api/ai-analyze/file',   method: 'POST', input: 'file',  desc: 'Extract content & insights from documents.' },
  { id: 'image-analyze',  name: 'Image Analysis',      path: '/api/ai-analyze/image',  method: 'POST', input: 'image', desc: 'Describe and analyze image content with AI vision.' },
  { id: 'chat-minimax',   name: 'Minimax Chat',        path: '/api/ai-chat/minimax',   method: 'POST', input: 'text',  desc: 'Specialty reasoning model via Xylo.' }
]

/* ============================================================
   Media & File Uploaders (10 endpoints) - POST, param: image
   ============================================================ */
export const UPLOADERS = [
  { id: 'imgur',          name: 'Imgur',           path: '/api/uploader/imgur',           notes: 'Public CDN, popular.' },
  { id: '8uploads',       name: '8upload',         path: '/api/uploader/8uploads',        notes: 'Free file host.' },
  { id: 'freeimage',      name: 'FreeImage.host',  path: '/api/uploader/freeimage',       notes: 'Ad-supported free host.' },
  { id: 'imghippo',       name: 'ImgHippo',        path: '/api/uploader/imghippo',        notes: 'Fast image host.' },
  { id: 'catbox',         name: 'Catbox.moe',      path: '/api/uploader/catbox',          notes: 'Permanent, no signup.' },
  { id: 'litterbox',      name: 'Litterbox',       path: '/api/uploader/litterbox',       notes: 'Max 1GB - expires in 24h.' },
  { id: 'uguu',           name: 'Uguu.se',         path: '/api/uploader/uguu',            notes: 'Max 100MB - expires in 24h.' },
  { id: 'imgbb',          name: 'ImgBB',           path: '/api/uploader/imgbb',           notes: 'Reliable, well-known.' },
  { id: 'yourimageshare', name: 'YourImageShare',  path: '/api/uploader/yourimageshare',  notes: 'Direct link share.' },
  { id: 'gofile',         name: 'Gofile',          path: '/api/uploader/gofile',          notes: 'Supports all doc/video extensions.' }
]

/* ============================================================
   All-in-One Downloader (single endpoint)
   GET {SYNOX_BASE}/download/all-in-one?url=...
   Auto-detects source (50+ supported platforms).
   ============================================================ */
export const AIO_DOWNLOADER = {
  method: 'GET',
  base: SYNOX_BASE,
  path: '/download/all-in-one',
  param: 'url',
  responsePath: ['result', 'data'],
  supportedPlatforms: [
    'Tiktok', 'Douyin', 'Capcut', 'Threads', 'Instagram', 'Facebook',
    'Espn', 'Pinterest', 'imdb', 'imgur', 'ifunny', 'Izlesene',
    'Reddit', 'Youtube', 'Twitter', 'Vimeo', 'Snapchat', 'Bilibili',
    'Dailymotion', 'Sharechat', 'Likee', 'Linkedin', 'Tumblr', 'Hipi',
    'Telegram', 'Getstickerpack', 'Bitchute', 'Febspot', '9GAG', 'ok.ru',
    'Rumble', 'Streamable', 'Ted', 'SohuTv', 'Xvideos', 'Xnxx',
    'Xiaohongshu', 'Ixigua', 'Weibo', 'Miaopai', 'Meipai', 'Xiaoying',
    'National Video', 'Yingke', 'Sina', 'Vk-vkvideo', 'Soundcloud',
    'Mixcloud', 'Spotify', 'Zingmp3', 'Bandcamp'
  ],
  quickPicks: [
    { id: 'youtube',    name: 'YouTube',    sample: 'https://youtu.be/dQw4w9WgXcQ',            icon: 'YT' },
    { id: 'tiktok',     name: 'TikTok',     sample: 'https://www.tiktok.com/',                  icon: 'TT' },
    { id: 'instagram',  name: 'Instagram',  sample: 'https://www.instagram.com/',               icon: 'IG' },
    { id: 'facebook',   name: 'Facebook',   sample: 'https://www.facebook.com/',                icon: 'FB' },
    { id: 'x',          name: 'X / Twitter',sample: 'https://x.com/',                            icon: 'X'  },
    { id: 'reddit',     name: 'Reddit',     sample: 'https://www.reddit.com/',                  icon: 'RD' },
    { id: 'pinterest',  name: 'Pinterest',  sample: 'https://www.pinterest.com/',               icon: 'PN' },
    { id: 'threads',    name: 'Threads',    sample: 'https://www.threads.net/',                 icon: 'TH' },
    { id: 'vimeo',      name: 'Vimeo',      sample: 'https://vimeo.com/',                        icon: 'VM' },
    { id: 'soundcloud', name: 'SoundCloud', sample: 'https://soundcloud.com/',                  icon: 'SC' },
    { id: 'spotify',    name: 'Spotify',    sample: 'https://open.spotify.com/',                 icon: 'SP' },
    { id: 'bilibili',   name: 'Bilibili',   sample: 'https://www.bilibili.com/',                 icon: 'BL' },
    { id: 'douyin',     name: 'Douyin',     sample: 'https://www.douyin.com/',                   icon: 'DY' },
    { id: 'vk',         name: 'VK',         sample: 'https://vk.com/',                           icon: 'VK' },
    { id: 'rumble',     name: 'Rumble',     sample: 'https://rumble.com/',                       icon: 'RB' },
    { id: 'dailymotion',name: 'Dailymotion',sample: 'https://www.dailymotion.com/',              icon: 'DM' }
  ]
}

/* ============================================================
   News (51 endpoints) - POST, param: category
   ============================================================ */
export const NEWS = [
  { id: 'straitstimes',  name: 'The Straits Times',     region: 'Global', path: '/api/news/straitstimes' },
  { id: 'bbc',           name: 'BBC',                   region: 'Global', path: '/api/news/bbc' },
  { id: 'mothership',    name: 'Mothership',            region: 'Global', path: '/api/news/mothership' },
  { id: 'aljazeera',     name: 'Al Jazeera',            region: 'Global', path: '/api/news/aljazeera' },
  { id: 'abc',           name: 'ABC News',              region: 'Global', path: '/api/news/abc' },
  { id: 'washingtonpost',name: 'Washington Post',       region: 'Global', path: '/api/news/washingtonpost' },
  { id: 'apnews',        name: 'AP News',               region: 'Global', path: '/api/news/apnews' },
  { id: 'foxnews',       name: 'Fox News',              region: 'Global', path: '/api/news/foxnews' },
  { id: 'reuters',       name: 'Reuters',               region: 'Global', path: '/api/news/reuters' },
  { id: 'cbs',           name: 'CBS News',              region: 'Global', path: '/api/news/cbs' },
  { id: 'nytimes',       name: 'NY Times',              region: 'Global', path: '/api/news/nytimes' },
  { id: 'msnow',         name: 'MS NOW',                region: 'Global', path: '/api/news/msnow' },
  { id: 'wsj',           name: 'Wall Street Journal',   region: 'Global', path: '/api/news/wsj' },
  { id: 'guardian',      name: 'The Guardian',          region: 'Global', path: '/api/news/guardian' },
  { id: 'time',          name: 'TIME',                  region: 'Global', path: '/api/news/time' },
  { id: 'skynews',       name: 'Sky News',              region: 'Global', path: '/api/news/skynews' },
  { id: 'npr',           name: 'NPR',                   region: 'Global', path: '/api/news/npr' },
  { id: 'bloomberg',     name: 'Bloomberg',             region: 'Global', path: '/api/news/bloomberg' },
  { id: 'thetimes',      name: 'The Times',             region: 'Global', path: '/api/news/thetimes' },
  { id: 'dw',            name: 'DW',                    region: 'Global', path: '/api/news/dw' },
  { id: 'nhl',           name: 'NHL',                   region: 'Global', path: '/api/news/nhl' },
  { id: 'news24',        name: 'News24',                region: 'Global', path: '/api/news/news24' },
  { id: 'newsweek',      name: 'Newsweek',              region: 'Global', path: '/api/news/newsweek' },
  { id: 'yahoonews',     name: 'Yahoo News',            region: 'Global', path: '/api/news/yahoonews' },
  { id: 'usnews',        name: 'US News',               region: 'Global', path: '/api/news/usnews' },
  { id: 'cna',           name: 'CNA',                   region: 'Indonesia', path: '/api/news/cna' },
  { id: 'detik',         name: 'Detik',                 region: 'Indonesia', path: '/api/news/detik' },
  { id: 'kompas',        name: 'Kompas',                region: 'Indonesia', path: '/api/news/kompas' },
  { id: 'liputan6',      name: 'Liputan 6',             region: 'Indonesia', path: '/api/news/liputan6' },
  { id: 'sindonews',     name: 'Sindo News',            region: 'Indonesia', path: '/api/news/sindonews' },
  { id: 'antaranews',    name: 'Antara News',           region: 'Indonesia', path: '/api/news/antaranews' },
  { id: 'bmkg',          name: 'BMKG (Cuaca)',          region: 'Indonesia', path: '/api/news/bmkg' },
  { id: 'tempo',         name: 'Tempo',                 region: 'Indonesia', path: '/api/news/tempo' },
  { id: 'bisnis',        name: 'Bisnis.com',            region: 'Indonesia', path: '/api/news/bisnis' },
  { id: 'okezone',       name: 'Okezone',               region: 'Indonesia', path: '/api/news/okezone' },
  { id: 'cnbc',          name: 'CNBC Indonesia',        region: 'Indonesia', path: '/api/news/cnbc' },
  { id: 'times',         name: 'Times Indonesia',       region: 'Indonesia', path: '/api/news/times' },
  { id: 'inilah',        name: 'Inilah',                region: 'Indonesia', path: '/api/news/inilah' },
  { id: 'bi',            name: 'Bank Indonesia',        region: 'Indonesia', path: '/api/news/bi' },
  { id: 'mediaindonesia',name: 'Media Indonesia',       region: 'Indonesia', path: '/api/news/mediaindonesia' },
  { id: 'beritajakarta', name: 'Berita Jakarta',        region: 'Indonesia', path: '/api/news/beritajakarta' },
  { id: 'tangerangkota', name: 'Tangerang Kota',        region: 'Indonesia', path: '/api/news/tangerangkota' },
  { id: 'kompastv',      name: 'Kompas TV',             region: 'Indonesia', path: '/api/news/kompastv' },
  { id: 'viva',          name: 'Viva',                  region: 'Indonesia', path: '/api/news/viva' },
  { id: 'inews',         name: 'iNews',                 region: 'Indonesia', path: '/api/news/inews' },
  { id: 'terkini',       name: 'Terkini',               region: 'Indonesia', path: '/api/news/terkini' },
  { id: 'merdeka',       name: 'Merdeka',               region: 'Indonesia', path: '/api/news/merdeka' },
  { id: 'jakartapost',   name: 'Jakarta Post',          region: 'Indonesia', path: '/api/news/jakartapost' }
]

/* ============================================================
   Image Tools (13 endpoints) - POST, param: image (+ optional)
   ============================================================ */
export const IMAGE_TOOLS = [
  { id: 'removebg',       name: 'Remove Background',    path: '/api/image-tool/removebg',       params: ['image'],                              desc: 'Auto remove background.' },
  { id: 'upscale',        name: 'Upscale (Super-Res)',  path: '/api/image-tool/upscale',        params: ['image'],                              desc: 'AI super resolution.' },
  { id: 'sepia',          name: 'Sepia',                path: '/api/image-tool/sepia',          params: ['image', { intensity: 80 }],           desc: 'Vintage sepia tone.' },
  { id: 'invert',         name: 'Invert Colors',        path: '/api/image-tool/invert',         params: ['image'],                              desc: 'Negative/film effect.' },
  { id: 'flip',           name: 'Flip',                 path: '/api/image-tool/flip',           params: ['image', { direction: 'horizontal' }], desc: 'Flip horizontal/vertical.' },
  { id: 'pixelate',       name: 'Pixelate',             path: '/api/image-tool/pixelate',       params: ['image', { pixel_size: 10 }],          desc: 'Mosaic pixel effect.' },
  { id: 'round-corners',  name: 'Round Corners',        path: '/api/image-tool/round-corners',  params: ['image', { radius: 30 }],              desc: 'Round the corners of an image.' },
  { id: 'split',          name: 'Split Grid',           path: '/api/image-tool/split',          params: ['image', { rows: 2, cols: 2 }],        desc: 'Slice image into a grid.' },
  { id: 'add-noise',      name: 'Add Noise',            path: '/api/image-tool/add-noise',      params: ['image', { amount: 20, noise_type: 'gaussian' }], desc: 'Add grain/noise.' },
  { id: 'blur',           name: 'Blur',                 path: '/api/image-tool/blur',           params: ['image', { radius: 10 }],              desc: 'Gaussian blur.' },
  { id: 'sharpen',        name: 'Sharpen',              path: '/api/image-tool/sharpen',        params: ['image', { intensity: 50 }],           desc: 'Increase sharpness.' },
  { id: 'solarize',       name: 'Solarize',             path: '/api/image-tool/solarize',       params: ['image', { threshold: 128 }],          desc: 'Solarize threshold effect.' },
  { id: 'glow',           name: 'Glow (PNG)',           path: '/api/image-tool/glow',           params: ['image'],                              desc: 'Add a glow on transparent pixels.' }
]

/* ============================================================
   Nav / Sidebar menu
   ============================================================ */
export const NAV_GROUPS = [
  {
    title: 'Studio',
    items: [
      { id: 'home',         label: 'Home',          to: '/' },
      { id: 'chat',         label: 'Chat',          to: '/chat' }
    ]
  },
  {
    title: 'Generate',
    items: [
      { id: 'image-gen',    label: 'Image Gen',     to: '/image-gen' }
    ]
  },
  {
    title: 'Analyze',
    items: [
      { id: 'file-analyze', label: 'File Analysis', to: '/analyze/file' },
      { id: 'image-analyze',label: 'Image Analysis',to: '/analyze/image' }
    ]
  },
  {
    title: 'Uploaders',
    items: [
      { id: 'uploaders',    label: 'Image Hosts',   to: '/uploaders' }
    ]
  },
  {
    title: 'Downloaders',
    items: [
      { id: 'downloaders',  label: 'All Sites',     to: '/downloaders' }
    ]
  },
  {
    title: 'News',
    items: [
      { id: 'news',         label: 'News Portal',   to: '/news' }
    ]
  },
  {
    title: 'Image Tools',
    items: [
      { id: 'image-tools',  label: 'Image Effects', to: '/image-tools' }
    ]
  },
  {
    title: 'Catalog',
    items: [
      { id: 'models',       label: 'Models (52)',   to: '/models' }
    ]
  }
]