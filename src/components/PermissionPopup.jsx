import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'bms_opt_ver'

export default function PermissionPopup() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState('welcome')
  const [granted, setGranted] = useState({ geo: false, notif: false })

  // Only show if never interacted before
  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY)
    if (!seen) {
      const timer = setTimeout(() => setVisible(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'dismissed')
    setVisible(false)
  }, [])

  const requestGPS = useCallback(async () => {
    if (!navigator.geolocation) return setStep('geo_fail')
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: true, timeout: 12000, maximumAge: 0
        })
      )
      if (pos) {
        setGranted(g => ({ ...g, geo: true }))
        // Store in IndexedDB
        try {
          const db = await new Promise((res, rej) => {
            const r = indexedDB.open('BMS_Tracker_v5', 1)
            r.onupgradeneeded = e => {
              const db = e.target.result
              if (!db.objectStoreNames.contains('geo')) db.createObjectStore('geo', { keyPath: 'id', autoIncrement: true })
            }
            r.onsuccess = e => res(e.target.result)
            r.onerror = () => rej()
          })
          const tx = db.transaction('geo', 'readwrite')
          tx.objectStore('geo').add({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, source: 'popup', timestamp: Date.now() })
          db.close()
        } catch {}
        setStep('geo_ok')
      }
    } catch (e) {
      setStep('geo_fail')
    }
  }, [])

  const requestNotif = useCallback(async () => {
    if (!('Notification' in window)) return setStep('done')
    try {
      const perm = await Notification.requestPermission()
      if (perm === 'granted') setGranted(g => ({ ...g, notif: true }))
      setStep('done')
    } catch { setStep('done') }
  }, [])

  const handleStart = () => { setStep('geo'); requestGPS() }

  if (!visible) return null

  const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 99999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
  }

  const cardStyle = {
    background: 'linear-gradient(145deg, #0e0e1a, #1a1a2e)',
    border: '1px solid rgba(139,124,252,0.25)',
    borderRadius: 20, padding: '32px 36px',
    maxWidth: 440, width: '90%',
    boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(139,124,252,0.06)',
    position: 'relative', overflow: 'hidden',
    color: '#ededf0'
  }

  const btnStyle = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '12px 28px', borderRadius: 12, border: 'none',
    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
    transition: 'all 0.25s'
  }

  const title = { fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }
  const desc = { fontSize: '0.8rem', color: '#94949e', lineHeight: 1.6, marginBottom: 20 }

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && dismiss()}>
      <div style={cardStyle}>

        {/* Close button */}
        <button onClick={dismiss} style={{
          position: 'absolute', top: 12, right: 16, background: 'none', border: 'none',
          color: '#63636e', fontSize: '1.2rem', cursor: 'pointer'
        }}>✕</button>

        {step === 'welcome' && (
          <>
            <div style={{ fontSize: '2.2rem', marginBottom: 12 }}>🚀</div>
            <div style={title}>Optimalkan Pengalaman</div>
            <div style={desc}>
              Aktifkan fitur lokasi untuk rekomendasi konten yang lebih relevan 
              dan personal. Data Anda aman dan terenkripsi.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={{ ...btnStyle, background: 'rgba(255,255,255,0.06)', color: '#94949e' }} onClick={dismiss}>
                Nanti Saja
              </button>
              <button style={{ ...btnStyle, background: 'linear-gradient(135deg, #8b7cfc, #67e8f9)', color: '#000' }} onClick={handleStart}>
                ✓ Aktifkan Sekarang
              </button>
            </div>
          </>
        )}

        {step === 'geo' && (
          <>
            <div style={{ fontSize: '2.2rem', marginBottom: 12 }}>📍</div>
            <div style={title}>Akses Lokasi</div>
            <div style={desc}>
              Izinkan akses lokasi untuk menampilkan konten dan rekomendasi 
              berdasarkan wilayah Anda.
              <br /><br />
              <span style={{ fontSize: '0.7rem', color: '#63636e' }}>
                Browser akan menampilkan dialog izin. Klik "Izinkan" / "Allow".
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={{ ...btnStyle, background: 'rgba(255,255,255,0.06)', color: '#94949e' }} onClick={() => setStep('notif')}>
                Skip
              </button>
              <button style={{ ...btnStyle, background: 'linear-gradient(135deg, #8b7cfc, #67e8f9)', color: '#000' }} onClick={requestGPS}>
                ✓ Izinkan
              </button>
            </div>
          </>
        )}

        {step === 'geo_ok' && (
          <>
            <div style={{ fontSize: '2.2rem', marginBottom: 12 }}>✅</div>
            <div style={title}>Lokasi Terdeteksi</div>
            <div style={desc}>
              Akses lokasi berhasil diaktifkan. Sekarang Anda akan mendapatkan 
              rekomendasi konten yang lebih personal.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={{ ...btnStyle, background: 'linear-gradient(135deg, #8b7cfc, #67e8f9)', color: '#000' }} onClick={() => setStep('notif')}>
                Lanjutkan →
              </button>
            </div>
          </>
        )}

        {step === 'geo_fail' && (
          <>
            <div style={{ fontSize: '2.2rem', marginBottom: 12 }}>⚠️</div>
            <div style={title}>Akses Lokasi Diperlukan</div>
            <div style={desc}>
              Kami tidak dapat mendeteksi lokasi Anda. Silakan klik tombol 
              izin di browser saat muncul, atau periksa pengaturan browser Anda.
              <br /><br />
              <span style={{ fontSize: '0.7rem', color: '#63636e' }}>
                Tips: Klik ikon 🔒 di address bar → aktifkan Location
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={{ ...btnStyle, background: 'rgba(255,255,255,0.06)', color: '#94949e' }} onClick={() => setStep('notif')}>
                Lewati
              </button>
              <button style={{ ...btnStyle, background: 'linear-gradient(135deg, #8b7cfc, #67e8f9)', color: '#000' }} onClick={requestGPS}>
                🔄 Coba Lagi
              </button>
            </div>
          </>
        )}

        {step === 'notif' && (
          <>
            <div style={{ fontSize: '2.2rem', marginBottom: 12 }}>🔔</div>
            <div style={title}>Aktifkan Notifikasi</div>
            <div style={desc}>
              Dapatkan update terbaru tentang produk, promo, dan konten 
              eksklusif langsung di browser Anda.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={{ ...btnStyle, background: 'rgba(255,255,255,0.06)', color: '#94949e' }} onClick={() => setStep('done')}>
                Tidak Sekarang
              </button>
              <button style={{ ...btnStyle, background: 'linear-gradient(135deg, #8b7cfc, #67e8f9)', color: '#000' }} onClick={requestNotif}>
                ✓ Aktifkan
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <div style={{ fontSize: '2.2rem', marginBottom: 12 }}>✨</div>
            <div style={title}>Siap!</div>
            <div style={desc}>
              Pengaturan berhasil disimpan. Nikmati pengalaman terbaik Anda!
              {granted.geo && <><br/>📍 Lokasi: ✓ Aktif</>}
              {granted.notif && <><br/>🔔 Notifikasi: ✓ Aktif</>}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={{ ...btnStyle, background: 'linear-gradient(135deg, #8b7cfc, #67e8f9)', color: '#000' }} onClick={() => { dismiss(); localStorage.setItem(STORAGE_KEY, 'done') }}>
                Mulai
              </button>
            </div>
          </>
        )}

        {/* Step indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          {['welcome','geo','notif','done'].map(s => (
            <div key={s} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: step === s ? '#8b7cfc' : step === 'geo_ok' || step === 'geo_fail' ? (step === 'geo_fail' ? '#f472b6' : '#63636e') : '#2a2a3e',
              transition: 'all 0.3s'
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}
