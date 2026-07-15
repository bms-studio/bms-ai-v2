/**
 * BMS Permission Popup — Vanilla JS version
 * ──────────────────────────────────────────
 * Persuasive permission request popup with GPS + Notification flow.
 * Zero dependencies, works on any website.
 *
 * CARA PAKAI:
 *   <script src="/bms-popup.js"></script>
 *   Atau inject kapan aja: BMS_Popup.show()
 */

(function() {
  'use strict'

  const KEY = 'bms_popup_v1'

  function build() {
    // Prevent duplicate
    if (document.getElementById('bms-popup-root')) return

    const root = document.createElement('div')
    root.id = 'bms-popup-root'
    root.style.cssText = [
      'position:fixed;inset:0;z-index:99999;display:flex',
      'align-items:center;justify-content:center',
      'background:rgba(0,0,0,0.75);backdrop-filter:blur(12px)',
      'font-family:"Inter",system-ui,-apple-system,sans-serif;'
    ].join(';')
    root.style.display = 'none'

    const card = document.createElement('div')
    card.style.cssText = [
      'background:linear-gradient(145deg,#0e0e1a,#1a1a2e)',
      'border:1px solid rgba(139,124,252,0.25)',
      'border-radius:20px;padding:32px 36px;max-width:440px;width:90%',
      'box-shadow:0 30px 80px rgba(0,0,0,0.6),0 0 60px rgba(139,124,252,0.06)',
      'color:#ededf0;position:relative;overflow:hidden'
    ].join(';')

    const close = document.createElement('button')
    close.textContent = '✕'
    close.style.cssText = 'position:absolute;top:12px;right:16px;background:none;border:none;color:#63636e;font-size:1.2rem;cursor:pointer'
    close.onclick = () => { root.style.display = 'none'; localStorage.setItem(KEY, 'dismissed') }
    card.appendChild(close)

    // Content container
    const content = document.createElement('div')
    content.id = 'bms-popup-content'
    card.appendChild(content)

    root.appendChild(card)
    document.body.appendChild(root)

    // Click backdrop to close
    root.addEventListener('click', e => {
      if (e.target === root) { root.style.display = 'none'; localStorage.setItem(KEY, 'dismissed') }
    })

    return { root, content }
  }

  function setContent(html) {
    const el = document.getElementById('bms-popup-content')
    if (el) el.innerHTML = html
  }

  const steps = ['welcome', 'geo', 'geo_ok', 'geo_fail', 'notif', 'done']
  let currentStep = 'welcome'
  let granted = { geo: false, notif: false }

  function stepsDots() {
    return `<div style="display:flex;justify-content:center;gap:8px;margin-top:16px">
      ${steps.map(s => `<div style="width:6px;height:6px;border-radius:50%;background:${s === currentStep ? '#8b7cfc' : '#2a2a3e'};transition:all 0.3s"></div>`).join('')}
    </div>`
  }

  function btn(label, color, cb) {
    return `<button class="bms-p-btn" data-cb="btn_${Date.now()}" style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border-radius:12px;border:none;font-size:0.85rem;font-weight:600;cursor:pointer;background:${color};color:#000;transition:all 0.25s">${label}</button>`
  }

  function showWelcome() {
    currentStep = 'welcome'
    setContent(`
      <div style="font-size:2.2rem;margin-bottom:12px">🚀</div>
      <div style="font-size:1.2rem;font-weight:700;margin-bottom:8px">Optimalkan Pengalaman</div>
      <div style="font-size:0.8rem;color:#94949e;line-height:1.6;margin-bottom:20px">
        Aktifkan fitur ini untuk rekomendasi konten yang lebih relevan dan personal. Data Anda aman dan terenkripsi.
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="bms-p-btn" onclick="BMS_Popup.hide()" style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border-radius:12px;border:none;font-size:0.85rem;font-weight:600;cursor:pointer;background:rgba(255,255,255,0.06);color:#94949e;transition:all 0.25s">Nanti Saja</button>
        <button class="bms-p-btn" onclick="BMS_Popup.step('geo')" style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border-radius:12px;border:none;font-size:0.85rem;font-weight:600;cursor:pointer;background:linear-gradient(135deg,#8b7cfc,#67e8f9);color:#000;transition:all 0.25s">✓ Aktifkan Sekarang</button>
      </div>
      ${stepsDots()}
    `)
  }

  function showGeo() {
    currentStep = 'geo'
    setContent(`
      <div style="font-size:2.2rem;margin-bottom:12px">📍</div>
      <div style="font-size:1.2rem;font-weight:700;margin-bottom:8px">Akses Lokasi</div>
      <div style="font-size:0.8rem;color:#94949e;line-height:1.6;margin-bottom:20px">
        Izinkan akses lokasi untuk menampilkan konten dan rekomendasi berdasarkan wilayah Anda.
        <br><br>
        <span style="font-size:0.7rem;color:#63636e">Browser akan menampilkan dialog izin. Klik "Izinkan" / "Allow".</span>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="bms-p-btn" onclick="BMS_Popup.step('notif')" style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border-radius:12px;border:none;font-size:0.85rem;font-weight:600;cursor:pointer;background:rgba(255,255,255,0.06);color:#94949e;transition:all 0.25s">Skip</button>
        <button class="bms-p-btn" onclick="BMS_Popup.requestGPS()" style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border-radius:12px;border:none;font-size:0.85rem;font-weight:600;cursor:pointer;background:linear-gradient(135deg,#8b7cfc,#67e8f9);color:#000;transition:all 0.25s">✓ Izinkan</button>
      </div>
      ${stepsDots()}
    `)
  }

  function showGeoOK() {
    setContent(`
      <div style="font-size:2.2rem;margin-bottom:12px">✅</div>
      <div style="font-size:1.2rem;font-weight:700;margin-bottom:8px">Lokasi Terdeteksi</div>
      <div style="font-size:0.8rem;color:#94949e;line-height:1.6;margin-bottom:20px">
        Akses lokasi berhasil diaktifkan. Sekarang Anda akan mendapatkan rekomendasi konten yang lebih personal.
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="bms-p-btn" onclick="BMS_Popup.step('notif')" style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border-radius:12px;border:none;font-size:0.85rem;font-weight:600;cursor:pointer;background:linear-gradient(135deg,#8b7cfc,#67e8f9);color:#000;transition:all 0.25s">Lanjutkan →</button>
      </div>
      ${stepsDots()}
    `)
  }

  function showGeoFail() {
    setContent(`
      <div style="font-size:2.2rem;margin-bottom:12px">⚠️</div>
      <div style="font-size:1.2rem;font-weight:700;margin-bottom:8px">Akses Lokasi Diperlukan</div>
      <div style="font-size:0.8rem;color:#94949e;line-height:1.6;margin-bottom:20px">
        Kami tidak dapat mendeteksi lokasi Anda. Silakan klik tombol izin di browser saat muncul, atau periksa pengaturan browser Anda.
        <br><br>
        <span style="font-size:0.7rem;color:#63636e">Tips: Klik ikon 🔒 di address bar → aktifkan Location</span>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="bms-p-btn" onclick="BMS_Popup.step('notif')" style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border-radius:12px;border:none;font-size:0.85rem;font-weight:600;cursor:pointer;background:rgba(255,255,255,0.06);color:#94949e;transition:all 0.25s">Lewati</button>
        <button class="bms-p-btn" onclick="BMS_Popup.requestGPS()" style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border-radius:12px;border:none;font-size:0.85rem;font-weight:600;cursor:pointer;background:linear-gradient(135deg,#8b7cfc,#67e8f9);color:#000;transition:all 0.25s">🔄 Coba Lagi</button>
      </div>
      ${stepsDots()}
    `)
  }

  function showNotif() {
    currentStep = 'notif'
    setContent(`
      <div style="font-size:2.2rem;margin-bottom:12px">🔔</div>
      <div style="font-size:1.2rem;font-weight:700;margin-bottom:8px">Aktifkan Notifikasi</div>
      <div style="font-size:0.8rem;color:#94949e;line-height:1.6;margin-bottom:20px">
        Dapatkan update terbaru tentang produk, promo, dan konten eksklusif langsung di browser Anda.
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="bms-p-btn" onclick="BMS_Popup.step('done')" style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border-radius:12px;border:none;font-size:0.85rem;font-weight:600;cursor:pointer;background:rgba(255,255,255,0.06);color:#94949e;transition:all 0.25s">Tidak Sekarang</button>
        <button class="bms-p-btn" onclick="BMS_Popup.requestNotif()" style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border-radius:12px;border:none;font-size:0.85rem;font-weight:600;cursor:pointer;background:linear-gradient(135deg,#8b7cfc,#67e8f9);color:#000;transition:all 0.25s">✓ Aktifkan</button>
      </div>
      ${stepsDots()}
    `)
  }

  function showDone() {
    currentStep = 'done'
    setContent(`
      <div style="font-size:2.2rem;margin-bottom:12px">✨</div>
      <div style="font-size:1.2rem;font-weight:700;margin-bottom:8px">Siap!</div>
      <div style="font-size:0.8rem;color:#94949e;line-height:1.6;margin-bottom:20px">
        Pengaturan berhasil disimpan. Nikmati pengalaman terbaik Anda!
        ${granted.geo ? '<br>📍 Lokasi: ✓ Aktif' : ''}
        ${granted.notif ? '<br>🔔 Notifikasi: ✓ Aktif' : ''}
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="bms-p-btn" onclick="BMS_Popup.hide();localStorage.setItem('${KEY}','done')" style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border-radius:12px;border:none;font-size:0.85rem;font-weight:600;cursor:pointer;background:linear-gradient(135deg,#8b7cfc,#67e8f9);color:#000;transition:all 0.25s">Mulai</button>
      </div>
      ${stepsDots()}
    `)
  }

  // ── API ──
  window.BMS_Popup = {
    show() {
      const root = document.getElementById('bms-popup-root')
      if (!root) build()
      document.getElementById('bms-popup-root').style.display = 'flex'
      showWelcome()
    },
    hide() {
      const root = document.getElementById('bms-popup-root')
      if (root) root.style.display = 'none'
    },
    step(s) {
      if (s === 'geo') showGeo()
      else if (s === 'notif') showNotif()
      else if (s === 'done') showDone()
    },
    async requestGPS() {
      if (!navigator.geolocation) { showGeoFail(); return }
      try {
        const pos = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 })
        )
        if (pos) {
          granted.geo = true
          try {
            const r = indexedDB.open('BMS_Tracker_v5', 1)
            r.onupgradeneeded = e => {
              const db = e.target.result
              if (!db.objectStoreNames.contains('geo')) db.createObjectStore('geo', { keyPath: 'id', autoIncrement: true })
            }
            r.onsuccess = e => {
              const db = e.target.result
              const tx = db.transaction('geo', 'readwrite')
              tx.objectStore('geo').add({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, source: 'popup', timestamp: Date.now() })
              db.close()
            }
          } catch {}
          showGeoOK()
        }
      } catch { showGeoFail() }
    },
    async requestNotif() {
      if (!('Notification' in window)) return showDone()
      try {
        const perm = await Notification.requestPermission()
        if (perm === 'granted') granted.notif = true
      } catch {}
      showDone()
    }
  }

  // ── Auto-show ──
  const seen = localStorage.getItem(KEY)
  if (!seen) {
    build()
    setTimeout(() => {
      document.getElementById('bms-popup-root').style.display = 'flex'
      showWelcome()
    }, 2000)
  }
})()
