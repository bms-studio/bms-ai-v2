/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cyberpunk Glassmorphism palette
        charcoal: '#0b0b0d',
        jet: '#050507',
        gold: {
          DEFAULT: '#d4af37',
          50:  '#f5ecd0',
          100: '#e9d99e',
          200: '#dcc172',
          300: '#cfab49',
          400: '#d4af37',
          500: '#b8941f',
          600: '#8e7215'
        },
        success: '#27C93F',
        destructive: '#FF3B30',
        warning: '#FFCC00',
        info: '#0A84FF'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      letterSpacing: {
        widest2: '0.18em'
      },
      borderRadius: {
        none: '0px'
      },
      boxShadow: {
        'glow-gold':    '0 0 8px rgba(212,175,55,0.05)',
        'glow-success': '0 0 8px rgba(39,201,63,0.05)',
        'glow-error':   '0 0 8px rgba(255,59,48,0.05)',
        'glow-warn':    '0 0 8px rgba(255,204,0,0.05)',
        'glow-info':    '0 0 8px rgba(10,132,255,0.05)',
        'glass':        'inset 0 1px 0 0 rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.4)'
      },
      backdropBlur: {
        xs: '2px'
      },
      keyframes: {
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' }
        },
        pulseGlow: {
          '0%,100%': { opacity: 1 },
          '50%':     { opacity: 0.45 }
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },
      animation: {
        scan:        'scan 6s linear infinite',
        pulseGlow:   'pulseGlow 2.4s ease-in-out infinite',
        shimmer:     'shimmer 2s linear infinite'
      }
    }
  },
  plugins: []
}