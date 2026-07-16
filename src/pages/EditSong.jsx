import { useRef, useState, useCallback } from "react"
import { Upload, Download, Music, ExternalLink, Shield, Sparkles, UploadCloud, Eye, EyeOff } from "lucide-react"
import { SectionHead, ErrorBox } from "../components/UI.jsx"
import StatusBadge from "../components/StatusBadge.jsx"
import { fmtBytes, fmtTime } from "../lib/utils.js"

const PF=[40,80,120,200,350,500,800,1200,2000,3000,5000,8000,12000,16000]
const PV=[[0.3,-0.4,0.5,-0.3,0.4,-0.5,0.3,-0.4,0.5,-0.3,0.4,-0.5,0.3,-0.4],[-0.4,0.5,-0.3,0.4,-0.5,0.3,-0.4,0.5,-0.3,0.4,-0.5,0.3,-0.4,0.5],[0.3,-0.5,0.4,-0.4,0.5,-0.3,0.4,-0.5,0.3,-0.4,0.5,-0.3,0.4,-0.5]]
const TV=[1.0,0.997,1.003]
const MODES=[
  {id:'shield',label:'Shield',desc:'Spektral + noise',color:'#d4af37'},
  {id:'stealth',label:'Stealth',desc:'Segment variants',color:'#a78bfa'},
  {id:'ringan',label:'Ringan',desc:'EQ + tempo',color:'#34d399'},
  {id:'sedang',label:'Sedang',desc:'EQ + phaser',color:'#60a5fa'},
  {id:'berat',label:'Berat',desc:'EQ + chorus',color:'#fb923c'},
  {id:'extreme',label:'Extreme',desc:'All + mono',color:'#ef4444'}]
const LG={ringan:{eq:[40,2000,14000],g:[-1,-1,-1],tempo:.998,p:0,c:0,m:0},sedang:{eq:[40,100,1000,4000,14000],g:[-1.5,-1,-1.5,-1.5,-1],tempo:.995,p:1,c:0,m:0},berat:{eq:[30,60,120,500,2000,6000,14000],g:[-2,-1.5,-1.5,-2,-2,-2,-1.5],tempo:.99,p:1,c:1,m:0},extreme:{eq:[20,40,80,160,400,1000,3000,8000,16000],g:[-3,-2.5,-2,-2,-2.5,-2.5,-3,-2,-2],tempo:.985,p:1,c:1,m:1}}
const SK='bms.rblx.apikey',SU='bms.rblx.userid',SG='bms.rblx.groupid',SM='bms.rblx.mode',SN='bms.rblx.dname',SD='bms.rblx.desc'
const ROBLOX_API='https://apis.roblox.com/assets/v1/assets'
const PROXY_API='/api/roblox/upload'

export default function EditSong(){
  const [f,setF]=useState(null)
  const [mode,setMode]=useState(()=>localStorage.getItem(SM)||'shield')
  const [fmt,setFmt]=useState('ogg')
  const [decoy,setDecoy]=useState(true)
  const [key,setKey]=useState(()=>localStorage.getItem(SK)||'')
  const [showKey,setShowKey]=useState(false)
  const [uid,setUid]=useState(()=>localStorage.getItem(SU)||'')
  const [gid,setGid]=useState(()=>localStorage.getItem(SG)||'')
  const [dn,setDn]=useState(()=>localStorage.getItem(SN)||'')
  const [desc,setDesc]=useState(()=>localStorage.getItem(SD)||'')
  const [loading,setLoading]=useState(false)
  const [pct,setPct]=useState(0)
  const [lt,setLt]=useState('')
  const [pv,setPv]=useState(null)
  const [pd,setPd]=useState(0)
  const [res,setRes]=useState(null)
  const [err,setErr]=useState('')
  const [drag,setDrag]=useState(false)
  const fr=useRef(null)
  const ar=useRef(null)

  // Get duration from audio element when metadata loads
  const onMeta=useCallback(()=>{
    if(ar.current&&isFinite(ar.current.duration)&&ar.current.duration>0){
      setPd(ar.current.duration)
    }
  },[])

  const dec=useCallback(async f=>{const b=await f.arrayBuffer();const c=new AudioContext();const a=await c.decodeAudioData(b);await c.close();return a},[])
  function mn(l){const o=new Float32Array(l);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;for(let i=0;i<l;i++){const w=Math.random()*2-1;b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;o[i]=b0+b1+b2+b3+b4+b5+b6+w*.5362;b6=w*.115926};let mx=0;for(let i=0;i<l;i++){const a=Math.abs(o[i]);if(a>mx)mx=a};if(mx>0)for(let i=0;i<l;i++)o[i]/=mx;return o}
  function eqFil(ctx,src,fr,gn){let c=src;for(let i=0;i<fr.length;i++){const f=ctx.createBiquadFilter();f.type='peaking';f.frequency.value=fr[i];f.Q.value=.5;f.gain.value=gn[i];c.connect(f);c=f}return c}
  function ptFil(ctx,src,v){return eqFil(ctx,src,PF,PV[v%PV.length])}
  function phFil(ctx,src){const d=ctx.createDelay(1);d.delayTime.value=.005;const l=ctx.createOscillator();l.frequency.value=.5;const lg=ctx.createGain();lg.gain.value=.005;l.connect(lg);lg.connect(d.delayTime);l.start();const fb=ctx.createGain();fb.gain.value=.3;src.connect(d);d.connect(fb);fb.connect(d);return d}
  function chFil(ctx,src){const d1=ctx.createDelay(1),d2=ctx.createDelay(1);d1.delayTime.value=.02;d2.delayTime.value=.03;const l=ctx.createOscillator();l.frequency.value=.3;const lg=ctx.createGain();lg.gain.value=.005;l.connect(lg);lg.connect(d1.delayTime);lg.connect(d2.delayTime);l.start();const dy=ctx.createGain();dy.gain.value=.6;const wt=ctx.createGain();wt.gain.value=.4;src.connect(dy);src.connect(d1);src.connect(d2);d1.connect(wt);d2.connect(wt);const s=ctx.createGain();dy.connect(s);wt.connect(s);return s}

  const proc=useCallback(async()=>{
    if(!f)return;setLoading(true);setPct(0);setLt('Decoding...');setErr('');setPv(null);setPd(0);setRes(null)
    try{
      let b=await dec(f);const sr=b.sampleRate,nch=b.numberOfChannels;const dm=decoy?4000:0,pad=Math.floor(sr*dm/1000)
      if(mode==='shield'){
        setLt('Shield...');setPct(5);await new Promise(r=>setTimeout(r,0))
        const t=b.length+pad;const o=new OfflineAudioContext(nch,t,sr)
        const nd=mn(Math.max(Math.floor(sr*(b.duration+dm/1000)),sr*30));const nb=o.createBuffer(1,nd.length,sr);nb.getChannelData(0).set(nd)
        const ns=o.createBufferSource();ns.buffer=nb;ns.loop=nd.length<t;const ng=o.createGain();ng.gain.value=.001;ns.connect(ng)
        const src=o.createBufferSource();src.buffer=b;const g2=o.createGain();ptFil(o,src,0).connect(g2);ng.connect(g2);g2.connect(o.destination)
        src.start(pad/sr);ns.start(0);setLt('Rendering...');setPct(40);b=await o.startRendering();setPct(70)
      }else if(mode==='stealth'){
        setLt('Segments...');setPct(5);await new Promise(r=>setTimeout(r,0))
        const seg=Math.floor(sr*5),ns=Math.ceil(b.length/seg),t=b.length+pad
        const o=new OfflineAudioContext(nch,t,sr)
        const nd=mn(Math.max(Math.floor(sr*(b.duration+dm/1000)),sr*30));const nb=o.createBuffer(1,nd.length,sr);nb.getChannelData(0).set(nd)
        const nsrc=o.createBufferSource();nsrc.buffer=nb;nsrc.loop=nd.length<t;const ng=o.createGain();ng.gain.value=.001;nsrc.connect(ng);const ng2=o.createGain();ng.connect(ng2);ng2.connect(o.destination);nsrc.start(0)
        for(let s=0;s<ns;s++){const st=s*seg,en=Math.min((s+1)*seg,b.length),ss=en-st;if(ss<=0)continue;const sg=o.createBuffer(nch,ss,sr);for(let c=0;c<nch;c++){const sd=b.getChannelData(c),dd=sg.getChannelData(c);for(let i=0;i<ss;i++)dd[i]=sd[st+i]||0};const src=o.createBufferSource();src.buffer=sg;let c2=ptFil(o,src,s);const tv=TV[s%TV.length];if(tv!==1.0)src.playbackRate.value=tv;const gg=o.createGain();c2.connect(gg);gg.connect(o.destination);src.start((pad+st)/sr);setPct(5+Math.round(s/ns*50));if(s%5===0)await new Promise(r=>setTimeout(r,0))}
        setLt('Rendering...');setPct(55);b=await o.startRendering();setPct(70)
      }else{
        const c=LG[mode];if(!c)throw new Error('Unknown mode')
        setLt(`${mode}...`);setPct(5);await new Promise(r=>setTimeout(r,0))
        const ch2=c.m?1:nch,t=b.length+pad;const o=new OfflineAudioContext(ch2,t,sr);const src=o.createBufferSource();src.buffer=b
        let chain=src;chain=eqFil(o,chain,c.eq,c.g);if(c.tempo!==1.0)src.playbackRate.value=c.tempo
        if(c.p)chain=phFil(o,chain);if(c.c)chain=chFil(o,chain)
        if(c.m&&nch>1){const m=o.createChannelMerger(1);chain.connect(m);chain=m}
        const gg=o.createGain();chain.connect(gg);gg.connect(o.destination);src.start(pad/sr)
        await new Promise(r=>setTimeout(r,0));setPct(25);let p=await o.startRendering();setPct(55)
        const kb=mode==='ringan'?160:mode==='sedang'?128:mode==='berat'?96:64
        setLt(`MP3 re-encode ${kb}k...`);setPct(65);await new Promise(r=>setTimeout(r,0))
        const m=await encMp3(p,kb);const ac2=new AudioContext();b=await ac2.decodeAudioData((await m.arrayBuffer()).slice(0));await ac2.close();setPct(75)
      }
      setLt(`Encode ${fmt}...`);setPct(85);await new Promise(r=>setTimeout(r,0))
      let out;if(fmt==='mp3')out=await encMp3(b,192);else if(fmt==='ogg'){try{out=await encOgg(b)}catch(e){console.warn(e);out=encWav(b)}}else out=encWav(b)
      setPd(b.duration);const u=URL.createObjectURL(out);setPv(u);setPct(100);setLt('Done!')
      if(ar.current){ar.current.src=u;ar.current.load()}
      setLoading(false)
    }catch(e){console.error(e);setErr('Process error: '+(e.message||e));setLoading(false)}
  },[f,mode,fmt,decoy,dec])

  const upl=useCallback(async()=>{
    if(!pv){setErr('Process audio first!');return}
    if(!key){setErr('API Key empty!');return}
    if(!uid&&!gid){setErr('Fill User ID or Group ID!');return}
    setLoading(true);setPct(0);setLt('Uploading...');setErr('');setRes(null)
    try{
      // Fetch blob from preview URL
      const r=await fetch(pv)
      const blob=await r.blob()
      const name=(dn||f?.name||'Audio').replace(/\.[^.]+$/,'').slice(0,50)
      const requestPayload={
        displayName:name,
        description:desc||`Uploaded via BMS Studio — Mode: ${mode}`,
        assetType:'Audio',
        creationContext:{creator:gid.trim()?{groupId:Number(gid)}:{userId:Number(uid)}}
      }
      const fd=new FormData()
      fd.append('request',JSON.stringify(requestPayload))
      fd.append('fileContent',blob,`${name}.${fmt}`)
      // Upload via server proxy (same-origin, no CORS issues)
      const uploadRes=await fetch(PROXY_API,{
        method:'POST',
        headers:{'x-api-key':key},
        body:fd,
      })
      const data=await uploadRes.json()
      if(!data.success){
        const msg=data?.error||JSON.stringify(data)||`HTTP ${uploadRes.status}`
        throw new Error(msg)
      }
      const resData=data.data||data
      const assetId=resData?.assetId||resData?.path?.split('/')?.pop()||'?'
      const url=`https://www.roblox.com/library/${assetId}/`
      setRes({assetId,url})
      setPct(100)
      setLoading(false)
    }catch(e){
      console.error('Upload error:',e)
      let msg=e.message||String(e)
      if(msg.includes('Failed to fetch')||msg.includes('NetworkError')){
        msg='Server proxy tidak bisa dijangkau. Jalankan: node server.js\nLalu upload dari http://localhost:3000'
      }
      setErr('Upload error: '+msg);setLoading(false)
    }
  },[pv,key,uid,gid,f,mode,fmt,dn,desc])

  function saveAll(){localStorage.setItem(SK,key);localStorage.setItem(SU,uid);localStorage.setItem(SG,gid);localStorage.setItem(SN,dn);localStorage.setItem(SD,desc);setRes({saved:true});setTimeout(()=>setRes(null),2000)}
  function od(e){e.preventDefault();setDrag(true)}
  function ol(){setDrag(false)}
  function dp(e){e.preventDefault();setDrag(false);if(e.dataTransfer.files?.[0])pk(e.dataTransfer.files[0])}
  function pk(fi){setF(fi);setPv(null);setPd(0);setRes(null);setErr('')}

  const mc=MODES.find(m=>m.id===mode)?.color||'#d4af37'

  return (<div className="min-h-screen" onDragOver={od} onDragLeave={ol} onDrop={dp}>
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold/60 mb-1">// Bypass Audible Magic</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Edit Song</h1>
          <p className="text-sm text-white/40 mt-1">Proses audio di browser, upload ke Roblox.</p>
        </div>
        <StatusBadge variant="gold" dot>Client-side</StatusBadge>
      </div>
      <div className="h-px w-full mb-6" style={{background:'linear-gradient(90deg,transparent,rgba(212,175,55,0.15),transparent)'}}/>
      {err&&<div className="mb-6"><ErrorBox title="Error" message={err}/></div>}

      <div className="grid lg:grid-cols-12 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-7 space-y-5">
          {/* FILE + INFO */}
          <div className="p-5 rounded-xl" style={{background:'#0c0c12',border:'1px solid rgba(255,255,255,0.04)'}}>
            <div className="grid sm:grid-cols-5 gap-4">
              <div className="sm:col-span-3">
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/40 mb-2">File Audio</div>
                <div onClick={()=>fr.current?.click()} className="rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200 hover:border-gold/30"
                  style={{borderColor:drag?'rgba(212,175,55,0.5)':'rgba(255,255,255,0.06)',background:drag?'rgba(212,175,55,0.03)':'rgba(0,0,0,0.3)'}}>
                  <input ref={fr} type="file" accept="audio/*" className="hidden" onChange={e=>e.target.files?.[0]&&pk(e.target.files[0])}/>
                  <div className="text-2xl mb-1">🎵</div>
                  {f?<><div className="font-medium text-white text-sm">{f.name}</div><div className="text-[10px] font-mono text-white/40 mt-1">{fmtBytes(f.size)}</div></>
                    :<><div className="font-medium text-white text-sm">Drop or click to upload</div><div className="text-[10px] font-mono text-white/40 mt-1">mp3 · wav · ogg · flac · m4a</div></>}
                </div>
              </div>
              <div className="sm:col-span-2 space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/40 mb-1">Detail</div>
                <input value={dn} onChange={e=>setDn(e.target.value)} placeholder="Display name" className="w-full px-3 py-2 text-sm rounded-lg" style={{background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.06)',color:'#e8e8ed',outline:'none'}}/>
                <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description" className="w-full px-3 py-2 text-xs rounded-lg" rows={2} style={{resize:'none',background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.06)',color:'#e8e8ed',outline:'none'}}/>
              </div>
            </div>
          </div>

          {/* MODE */}
          <div className="p-5 rounded-xl" style={{background:'#0c0c12',border:'1px solid rgba(255,255,255,0.04)'}}>
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/40 mb-3">Bypass Mode</div>
            <div className="flex flex-wrap gap-2 mb-4">
              {MODES.map(m=><button key={m.id} onClick={()=>{setMode(m.id);localStorage.setItem(SM,m.id)}}
                className="px-3 py-2 text-xs font-mono rounded-lg transition-all duration-200"
                style={{background:mode===m.id?`${m.color}12`:'rgba(255,255,255,0.02)',border:`1px solid ${mode===m.id?`${m.color}30`:'rgba(255,255,255,0.04)'}`,color:mode===m.id?m.color:'rgba(255,255,255,0.4)'}}>
                <div className="font-semibold">{m.label}</div><div style={{fontSize:8,opacity:0.5}}>{m.desc}</div>
              </button>)}
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2"><span className="text-[10px] font-mono uppercase text-white/40">Format</span>
                <select value={fmt} onChange={e=>setFmt(e.target.value)} className="text-xs font-mono px-2.5 py-1.5 rounded-lg" style={{background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.06)',color:'#e8e8ed',outline:'none'}}>
                  <option value="ogg">OGG</option><option value="mp3">MP3</option><option value="wav">WAV</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-white/50">
                <input type="checkbox" checked={decoy} onChange={e=>setDecoy(e.target.checked)} className="accent-gold" style={{width:14,height:14}}/>Decoy Start 4s
              </label>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="flex gap-3">
            <button onClick={proc} disabled={loading||!f}
              className="flex-1 py-2.5 rounded-lg font-semibold text-xs uppercase tracking-[0.1em] transition-all duration-200 disabled:opacity-30 border"
              style={{background:'rgba(212,175,55,0.08)',borderColor:'rgba(212,175,55,0.2)',color:'#d4af37'}}>
              {loading&&lt!=='Done!'?'⏳':<UploadCloud size={13} className="inline mr-1"/>} Process</button>
            <button onClick={upl} disabled={loading||!pv}
              className="flex-1 py-2.5 rounded-lg font-semibold text-xs uppercase tracking-[0.1em] transition-all duration-200 disabled:opacity-30 border"
              style={{background:'rgba(16,185,129,0.08)',borderColor:'rgba(16,185,129,0.2)',color:'#34d399'}}>
              <Upload size={13} className="inline mr-1"/> Upload</button>
          </div>

          {/* PROGRESS */}
          {loading&&<div className="p-3 rounded-lg" style={{background:'rgba(0,0,0,0.2)',border:'1px solid rgba(255,255,255,0.04)'}}>
            <div className="flex justify-between text-xs font-mono mb-1.5"><span className="text-white/50">{lt}</span><span style={{color:mc}}>{pct}%</span></div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,0.03)'}}>
              <div className="h-full rounded-full transition-all duration-500" style={{width:pct+'%',background:`linear-gradient(90deg,${mc},#f0d68a)`}}/>
            </div>
          </div>}

          {/* PREVIEW */}
          {pv&&<div className="p-4 rounded-xl" style={{background:'#0c0c12',border:'1px solid rgba(255,255,255,0.04)'}}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.1em] text-white/40">
                <Music size={12}/> Preview {pd>0?`· ${fmtTime(Math.round(pd))}`:'· loading...'}
              </div>
              <a href={pv} download={`bypassed_${mode}.${fmt}`} className="text-[10px] font-mono flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all"
                style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',color:'#a0a0aa'}}>
                <Download size={10}/> Download</a>
            </div>
            <audio ref={ar} controls preload="auto" className="w-full rounded-lg" onLoadedMetadata={onMeta}/>
          </div>}

          {/* RESULT */}
          {res&&res.assetId&&<div className="p-4 rounded-xl" style={{background:'rgba(16,185,129,0.04)',border:'1px solid rgba(16,185,129,0.15)'}}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{background:'rgba(16,185,129,0.1)'}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" className="w-4 h-4"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div><div className="text-emerald-400 font-semibold text-sm">Upload Berhasil!</div><div className="text-[11px] font-mono text-white/40 mt-0.5">Asset ID: {res.assetId}</div></div>
            </div>
            {res.url&&<a href={res.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-gold mt-2 hover:underline" style={{marginLeft:48}}>Lihat di Roblox <ExternalLink size={10}/></a>}
          </div>}
          {res&&res.saved&&<div className="text-xs text-emerald-400 font-mono">✓ Saved</div>}
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-5 space-y-5">
          <div className="p-5 rounded-xl" style={{background:'#0c0c12',border:'1px solid rgba(255,255,255,0.04)'}}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/40">Credentials</div>
              <div className="w-2 h-2 rounded-full" style={{background:key?'#34d399':'#ef4444',boxShadow:key?'0 0 8px rgba(52,211,153,0.4)':'none'}}/>
            </div>
            <div className="space-y-2.5">
              <div className="flex gap-2">
                <input type={showKey?'text':'password'} value={key} onChange={e=>setKey(e.target.value)} placeholder="API Key" className="flex-1 px-3 py-2 text-xs font-mono rounded-lg" style={{background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.06)',color:'#e8e8ed',outline:'none'}}/>
                <button onClick={()=>setShowKey(s=>!s)} className="px-2.5 rounded-lg" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',color:'#a0a0aa'}}>{showKey?<EyeOff size={12}/>:<Eye size={12}/>}</button>
              </div>
              <input value={uid} onChange={e=>setUid(e.target.value)} placeholder="User ID" className="w-full px-3 py-2 text-xs font-mono rounded-lg" style={{background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.06)',color:'#e8e8ed',outline:'none'}}/>
              <input value={gid} onChange={e=>setGid(e.target.value)} placeholder="Group ID" className="w-full px-3 py-2 text-xs font-mono rounded-lg" style={{background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.06)',color:'#e8e8ed',outline:'none'}}/>
              <button onClick={saveAll} className="w-full py-2 rounded-lg font-semibold text-xs uppercase tracking-[0.1em] transition-all border"
                style={{background:'rgba(212,175,55,0.08)',borderColor:'rgba(212,175,55,0.2)',color:'#d4af37'}}>Save All</button>
            </div>
          </div>
          <div className="p-5 rounded-xl" style={{background:'#0c0c12',border:'1px solid rgba(255,255,255,0.04)'}}>
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/40 mb-3">Info</div>
            <div className="text-xs text-white/40 leading-relaxed space-y-2">
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>100% browser processing</div>
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-gold"/>Upload via Roblox Open Cloud</div>
              <div className="border-t border-white/5 pt-2 mt-2 text-[11px] text-white/25">Shield & Stealth = metode spektral. Ringan s/d Extreme = legacy EQ + MP3 re-encode.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>)
}

function encWav(b){const nc=b.numberOfChannels,sr=b.sampleRate,len=b.length,ba=nc*2,byr=sr*ba,ds=len*ba;const ab=new ArrayBuffer(44+ds),v=new DataView(ab);let p=0;const ws=s=>{for(let i=0;i<s.length;i++)v.setUint8(p++,s.charCodeAt(i))};ws('RIFF');v.setUint32(p,36+ds,true);p+=4;ws('WAVE');ws('fmt ');v.setUint32(p,16,true);p+=4;v.setUint16(p,1,true);p+=2;v.setUint16(p,nc,true);p+=2;v.setUint32(p,sr,true);p+=4;v.setUint32(p,byr,true);p+=4;v.setUint16(p,ba,true);p+=2;v.setUint16(p,16,true);p+=2;ws('data');v.setUint32(p,ds,true);p+=4;const chs=[];for(let c=0;c<nc;c++)chs.push(b.getChannelData(c));for(let i=0;i<len;i++){for(let c=0;c<nc;c++){let s=Math.max(-1,Math.min(1,chs[c][i]||0));v.setInt16(p,s<0?s*0x8000:s*0x7fff,true);p+=2}};return new Blob([ab],{type:'audio/wav'})}
let _lm=0;async function loadLm(){if(_lm||typeof lamejs!=='undefined'){_lm=1;return};return new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';s.onload=()=>{_lm=1;res()};s.onerror=()=>rej(new Error('load lamejs failed'));document.head.appendChild(s)})}
async function encMp3(b,kbps=192){await loadLm();const nc=Math.min(b.numberOfChannels,2),sr=b.sampleRate;const enc=new lamejs.Mp3Encoder(nc,sr,kbps);const l=f32(b.getChannelData(0)),r=nc>1?f32(b.getChannelData(1)):l;const ch=[];const B=1152;for(let i=0;i<l.length;i+=B){const lc=l.subarray(i,i+B),rc=r.subarray(i,i+B);const e=nc>1?enc.encodeBuffer(lc,rc):enc.encodeBuffer(lc);if(e.length)ch.push(e)};const t=enc.flush();if(t.length)ch.push(t);return new Blob(ch,{type:'audio/mpeg'})}
function f32(f32){const o=new Int16Array(f32.length);for(let i=0;i<f32.length;i++){let s=Math.max(-1,Math.min(1,f32[i]||0));o[i]=s<0?s*0x8000:s*0x7fff}return o}
async function encOgg(b){const m=['audio/ogg;codecs=opus','audio/ogg','audio/webm;codecs=opus'].find(m=>MediaRecorder.isTypeSupported(m));if(!m)throw new Error('OGG not supported');const ctx=new AudioContext({sampleRate:b.sampleRate});const dest=ctx.createMediaStreamDestination();const src=ctx.createBufferSource();src.buffer=b;src.connect(dest);const rec=new MediaRecorder(dest.stream,{mimeType:m,audioBitsPerSecond:192000});const ch=[];rec.ondataavailable=e=>{if(e.data.size)ch.push(e.data)};const done=new Promise(r=>rec.onstop=r);rec.start(100);src.start();await new Promise(r=>{src.onended=r;setTimeout(r,(b.duration+1)*1000)});rec.stop();await done;await ctx.close();return new Blob(ch,{type:m.startsWith('audio/webm')?'audio/ogg':m.split(';')[0]})}
