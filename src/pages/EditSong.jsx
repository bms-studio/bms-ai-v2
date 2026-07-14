import { useRef, useState, useCallback } from "react"
import { Upload, UploadCloud, Music2, ExternalLink, KeyRound, Eye, EyeOff, ShieldAlert, Download, FileAudio, Settings2, Info, RefreshCw, Sparkles } from "lucide-react"
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
const SK='bms.roblox.apiKey',UK='bms.roblox.userId',GK='bms.roblox.groupId',MK='bms_bp_mode',NK='bms.displayName',DK='bms.description'

export default function EditSong() {
  const [file,setFile]=useState(null)
  const [mode,setMode]=useState(()=>localStorage.getItem(MK)||'shield')
  const [format,setFormat]=useState('ogg')
  const [decoy,setDecoy]=useState(true)
  const [ak,setAk]=useState(()=>localStorage.getItem(SK)||'')
  const [showAk,setShowAk]=useState(false)
  const [uid,setUid]=useState(()=>localStorage.getItem(UK)||'')
  const [gid,setGid]=useState(()=>localStorage.getItem(GK)||'')
  const [dName,setDName]=useState(()=>localStorage.getItem(NK)||'')
  const [desc,setDesc]=useState(()=>localStorage.getItem(DK)||'')
  const [loading,setLoading]=useState(false)
  const [loadPct,setLoadPct]=useState(0)
  const [loadText,setLoadText]=useState('')
  const [previewUrl,setPreviewUrl]=useState(null)
  const [previewDur,setPreviewDur]=useState(0)
  const [result,setResult]=useState(null)
  const [error,setError]=useState('')
  const [imgErr,setImgErr]=useState({avatar:0,group:0})
  const [dragOver,setDragOver]=useState(false)
  const fileRef=useRef(null)
  const audioRef=useRef(null)

  const decodeFile=useCallback(async f=>{const b=await f.arrayBuffer();const c=new AudioContext();const a=await c.decodeAudioData(b);await c.close();return a},[])
  function makeNoise(l){const o=new Float32Array(l);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;for(let i=0;i<l;i++){const w=Math.random()*2-1;b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;o[i]=b0+b1+b2+b3+b4+b5+b6+w*.5362;b6=w*.115926};let mx=0;for(let i=0;i<l;i++){const a=Math.abs(o[i]);if(a>mx)mx=a};if(mx>0)for(let i=0;i<l;i++)o[i]/=mx;return o}
  function eq(ctx,src,fr,gn){let c=src;for(let i=0;i<fr.length;i++){const f=ctx.createBiquadFilter();f.type='peaking';f.frequency.value=fr[i];f.Q.value=.5;f.gain.value=gn[i];c.connect(f);c=f}return c}
  function pert(ctx,src,v){return eq(ctx,src,PF,PV[v%PV.length])}
  function phaser(ctx,src){const d=ctx.createDelay(1);d.delayTime.value=.005;const l=ctx.createOscillator();l.frequency.value=.5;const lg=ctx.createGain();lg.gain.value=.005;l.connect(lg);lg.connect(d.delayTime);l.start();const fb=ctx.createGain();fb.gain.value=.3;src.connect(d);d.connect(fb);fb.connect(d);return d}
  function chorus(ctx,src){const d1=ctx.createDelay(1),d2=ctx.createDelay(1);d1.delayTime.value=.02;d2.delayTime.value=.03;const l=ctx.createOscillator();l.frequency.value=.3;const lg=ctx.createGain();lg.gain.value=.005;l.connect(lg);lg.connect(d1.delayTime);lg.connect(d2.delayTime);l.start();const dy=ctx.createGain();dy.gain.value=.6;const wt=ctx.createGain();wt.gain.value=.4;src.connect(dy);src.connect(d1);src.connect(d2);d1.connect(wt);d2.connect(wt);const s=ctx.createGain();dy.connect(s);wt.connect(s);return s}

  const processAudio=useCallback(async()=>{
    if(!file)return
    setLoading(true);setLoadPct(0);setLoadText('Decoding...');setError('');setPreviewUrl(null);setPreviewDur(0);setResult(null)
    try{
      let buf=await decodeFile(file);const sr=buf.sampleRate,ch=buf.numberOfChannels;const dm=decoy?4000:0,pad=Math.floor(sr*dm/1000)
      if(mode==='shield'){
        setLoadText('Shield...');setLoadPct(5);await new Promise(r=>setTimeout(r,0))
        const total=buf.length+pad;const o=new OfflineAudioContext(ch,total,sr)
        const nd=makeNoise(Math.max(Math.floor(sr*(buf.duration+dm/1000)),sr*30))
        const nb=o.createBuffer(1,nd.length,sr);nb.getChannelData(0).set(nd)
        const ns=o.createBufferSource();ns.buffer=nb;ns.loop=nd.length<total
        const ng=o.createGain();ng.gain.value=.001;ns.connect(ng)
        const src=o.createBufferSource();src.buffer=buf
        const g2=o.createGain();pert(o,src,0).connect(g2);ng.connect(g2);g2.connect(o.destination)
        src.start(pad/sr);ns.start(0)
        setLoadText('Rendering...');setLoadPct(40);buf=await o.startRendering();setLoadPct(70)
      }else if(mode==='stealth'){
        setLoadText('Segments...');setLoadPct(5);await new Promise(r=>setTimeout(r,0))
        const seg=Math.floor(sr*5),n=Math.ceil(buf.length/seg),total=buf.length+pad
        const o=new OfflineAudioContext(ch,total,sr)
        const nd=makeNoise(Math.max(Math.floor(sr*(buf.duration+dm/1000)),sr*30))
        const nb=o.createBuffer(1,nd.length,sr);nb.getChannelData(0).set(nd)
        const ns=o.createBufferSource();ns.buffer=nb;ns.loop=nd.length<total
        const ng=o.createGain();ng.gain.value=.001;ns.connect(ng);const ng2=o.createGain();ng.connect(ng2);ng2.connect(o.destination);ns.start(0)
        for(let s=0;s<n;s++){const st=s*seg,en=Math.min((s+1)*seg,buf.length),ss=en-st;if(ss<=0)continue;const sg=o.createBuffer(ch,ss,sr);for(let c=0;c<ch;c++){const sd=buf.getChannelData(c),dd=sg.getChannelData(c);for(let i=0;i<ss;i++)dd[i]=sd[st+i]||0};const src=o.createBufferSource();src.buffer=sg;let ch2=pert(o,src,s);const tv=TV[s%TV.length];if(tv!==1.0)src.playbackRate.value=tv;const gg=o.createGain();ch2.connect(gg);gg.connect(o.destination);src.start((pad+st)/sr);setLoadPct(5+Math.round(s/n*50));if(s%5===0)await new Promise(r=>setTimeout(r,0))}
        setLoadText('Rendering...');setLoadPct(55);buf=await o.startRendering();setLoadPct(70)
      }else{
        const c=LG[mode];if(!c)throw new Error('Unknown')
        setLoadText(`${mode}...`);setLoadPct(5);await new Promise(r=>setTimeout(r,0))
        const ch2=c.m?1:ch,total=buf.length+pad
        const o=new OfflineAudioContext(ch2,total,sr);const src=o.createBufferSource();src.buffer=buf
        let chain=src;chain=eq(o,chain,c.eq,c.g);if(c.tempo!==1.0)src.playbackRate.value=c.tempo
        if(c.p)chain=phaser(o,chain);if(c.c)chain=chorus(o,chain)
        if(c.m&&ch>1){const m=o.createChannelMerger(1);chain.connect(m);chain=m}
        const gg=o.createGain();chain.connect(gg);gg.connect(o.destination);src.start(pad/sr)
        await new Promise(r=>setTimeout(r,0));setLoadPct(25)
        let p=await o.startRendering();setLoadPct(55)
        const kb=mode==='ringan'?160:mode==='sedang'?128:mode==='berat'?96:64
        setLoadText(`Re-encode ${kb}k...`);setLoadPct(65);await new Promise(r=>setTimeout(r,0))
        const m=await encodeMp3Blob(p,kb);const ac2=new AudioContext()
        buf=await ac2.decodeAudioData((await m.arrayBuffer()).slice(0));await ac2.close();setLoadPct(75)
      }
      setLoadText(`Encode ${format}...`);setLoadPct(85);await new Promise(r=>setTimeout(r,0))
      let out
      if(format==='mp3')out=await encodeMp3Blob(buf,192)
      else if(format==='ogg'){try{out=await encodeOggBlob(buf)}catch(e){console.warn(e);out=encodeWavBlob(buf)}}
      else out=encodeWavBlob(buf)
      setPreviewDur(buf.duration)
      const url=URL.createObjectURL(out);setPreviewUrl(url)
      if(audioRef.current){audioRef.current.src=url;audioRef.current.load()}
      setLoadPct(100);setLoadText('Selesai!');setLoading(false)
    }catch(e){setError('Error: '+(e.message||e));setLoading(false)}
  },[file,mode,format,decoy,decodeFile])

  const handleUpload=useCallback(async()=>{
    if(!previewUrl){setError('Proses dulu!');return}
    if(!ak){setError('API Key kosong!');return}
    if(!uid&&!gid){setError('Isi User ID atau Group ID!');return}
    setLoading(true);setLoadPct(0);setLoadText('Uploading...');setError('');setResult(null)
    try{
      const r=await fetch(previewUrl);const b=await r.blob();const name=(dName||file?.name||'Audio').replace(/\.[^.]+$/,'').slice(0,50)
      const fd=new FormData()
      fd.append('request',JSON.stringify({displayName:name,description:desc||`Uploaded via BMS Studio — Mode: ${mode}`,assetType:'Audio',creationContext:{creator:gid.trim()?{groupId:Number(gid)}:{userId:Number(uid)}}}))
      fd.append('fileContent',b,`${name}.${format}`)
      const x=new XMLHttpRequest()
      x.open('POST','https://apis.roblox.com/assets/v1/assets',true)
      x.setRequestHeader('x-api-key',ak);x.timeout=180000
      x.upload.onprogress=e=>{if(e.lengthComputable)setLoadPct(Math.round(10+(e.loaded/e.total)*80))}
      await new Promise((res,rej)=>{
        x.onload=()=>{
          if(x.status>=200&&x.status<300){let d;try{d=JSON.parse(x.responseText)}catch{d={}}const id=d.assetId||d.path?.split('/')?.pop()||'?';setResult({assetId:id,url:`https://www.roblox.com/library/${id}/`});setLoadPct(100);res()}
          else{let m=x.responseText;try{const d=JSON.parse(x.responseText);m=d?.error?.message||d?.errors?.[0]?.message||m}catch{};rej(new Error(m||`HTTP ${x.status}`))}}
        x.onerror=()=>rej(new Error('Network error'));x.ontimeout=()=>rej(new Error('Timeout'));x.send(fd)
      })
      setLoading(false)
    }catch(e){setError('Upload error: '+(e.message||e));setLoading(false)}
  },[previewUrl,ak,uid,gid,file,mode,format,dName,desc])

  function saveAll(){localStorage.setItem(SK,ak);localStorage.setItem(UK,uid);localStorage.setItem(GK,gid);localStorage.setItem(NK,dName);localStorage.setItem(DK,desc);setResult({saved:true});setTimeout(()=>setResult(null),2000)}
  function onDragOver(e){e.preventDefault();setDragOver(true)}
  function onDragLeave(){setDragOver(false)}
  function onDrop(e){e.preventDefault();setDragOver(false);if(e.dataTransfer.files?.[0])pickFile(e.dataTransfer.files[0])}
  function pickFile(f){setFile(f);setPreviewUrl(null);setPreviewDur(0);setResult(null);setError('')}

  const mc=MODES.find(m=>m.id===mode)?.color||'#d4af37'
  const avatarUrl=uid?`https://www.roblox.com/Thumbs/Avatar.ashx?userId=${uid}&x=150&y=150&format=png`:null
  const groupUrl=gid?`https://www.roblox.com/Thumbs/GroupIcon.ashx?groupId=${gid}&x=150&y=150&format=png`:null

  return (<div className="page-pad" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
    <SectionHead kicker="// studio" title="Bypass Audible Magic"
      sub="Proses audio di browser via Web Audio API, upload ke Roblox. 100% client-side.">
      <StatusBadge variant="gold" dot>Client-side</StatusBadge>
    </SectionHead>
    {error&&<div className="mb-4"><ErrorBox title="Error" message={error}/></div>}

    <div className="grid lg:grid-cols-5 gap-5">

      {/* ===== MAIN (3/5) ===== */}
      <div className="lg:col-span-3 space-y-5">

        {/* FILE + INFO */}
        <div className="relative">
          <div className={`relative overflow-hidden rounded-2xl backdrop-blur-xl ${dragOver?'scale-[1.01]':''} transition-all duration-300`}
            style={{background:dragOver?'rgba(212,175,55,0.04)':'rgba(18,18,24,0.5)',border:`1px solid ${dragOver?'rgba(212,175,55,0.3)':'rgba(255,255,255,0.04)'}`,boxShadow:dragOver?'0 0 40px rgba(212,175,55,0.06)':'0 4px 24px rgba(0,0,0,0.2)'}}>
            <div className="absolute inset-0 bg-gradient-to-br from-gold/[0.02] to-transparent pointer-events-none"/>
            <div className="p-5 relative">
              <div className="flex items-center gap-2 mb-4"><Sparkles size={15} className="text-gold"/><span className="text-[10px] font-mono uppercase tracking-[0.15em] text-gold/70 font-bold">Source</span></div>
              <div className="grid md:grid-cols-5 gap-4">
                <div className="md:col-span-3">
                  <div className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-300`}
                    style={{borderColor:dragOver?'rgba(212,175,55,0.4)':'rgba(255,255,255,0.06)',background:dragOver?'rgba(212,175,55,0.04)':'rgba(0,0,0,0.15)'}}
                    onClick={()=>fileRef.current?.click()}>
                    <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={e=>e.target.files?.[0]&&pickFile(e.target.files[0])}/>
                    <div className="text-3xl mb-2 opacity-40">{file?'🎵':'🎵'}</div>
                    {file?<><div className="font-semibold text-white text-sm">{file.name}</div><div className="text-[10px] font-mono text-white/40 mt-1">{fmtBytes(file.size)}</div></>
                      :<><div className="font-semibold text-white text-sm">Drop audio file here</div><div className="text-[10px] font-mono text-white/40 mt-1">mp3 · wav · ogg · flac · m4a</div></>}
                  </div>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <div className="flex items-center gap-2 mb-1"><Settings2 size={12} className="text-gold/60"/><span className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/40">Detail</span></div>
                  <input value={dName} onChange={e=>setDName(e.target.value)} placeholder="Nama lagu" className="input text-sm"/>
                  <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Deskripsi (opsional)" className="input text-xs" rows={2} style={{resize:'none'}}/>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MODE */}
        <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl transition-all duration-300"
          style={{background:'rgba(18,18,24,0.5)',border:'1px solid rgba(255,255,255,0.04)',boxShadow:'0 4px 24px rgba(0,0,0,0.2)'}}>
          <div className="absolute inset-0 bg-gradient-to-br from-gold/[0.02] to-transparent pointer-events-none"/>
          <div className="p-5 relative">
            <div className="flex items-center gap-2 mb-4"><ShieldAlert size={15} className="text-gold"/><span className="text-[10px] font-mono uppercase tracking-[0.15em] text-gold/70 font-bold">Bypass Mode</span></div>
            <div className="flex flex-wrap gap-2 mb-4">
              {MODES.map(m=>
                <button key={m.id} onClick={()=>{setMode(m.id);localStorage.setItem(MK,m.id)}}
                  className="px-4 py-2.5 text-xs font-mono text-center transition-all duration-200 rounded-xl whitespace-nowrap"
                  style={{background:mode===m.id?`${m.color}18`:'rgba(255,255,255,0.03)',border:`1px solid ${mode===m.id?`${m.color}40`:'rgba(255,255,255,0.04)'}`,color:mode===m.id?m.color:'rgba(255,255,255,0.45)',boxShadow:mode===m.id?`0 0 30px ${m.color}15`:'none'}}>
                  <div className="font-bold">{m.label}</div>
                  <div className="opacity-60" style={{fontSize:9}}>{m.desc}</div>
                </button>
              )}
            </div>
            <div className="flex items-center gap-5 flex-wrap">
              <div className="flex items-center gap-2"><span className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/40">Output</span>
                <select value={format} onChange={e=>setFormat(e.target.value)} className="input text-xs font-mono" style={{width:80,borderRadius:8}}>
                  <option value="ogg">OGG</option><option value="mp3">MP3</option><option value="wav">WAV</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={decoy} onChange={e=>setDecoy(e.target.checked)} className="accent-gold" style={{width:14,height:14}}/>
                <span className="text-xs text-white/50">Decoy Start 4s</span>
              </label>
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex gap-3">
          <button onClick={processAudio} disabled={loading||!file}
            className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-[0.1em] transition-all duration-200 disabled:opacity-30 border"
            style={{background:'rgba(212,175,55,0.08)',borderColor:'rgba(212,175,55,0.25)',color:'#d4af37'}}>
            {loading&&loadText!=='Selesai!'?'⏳':<UploadCloud size={14} className="inline mr-1.5"/>} Process</button>
          <button onClick={handleUpload} disabled={loading||!previewUrl}
            className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-[0.1em] transition-all duration-200 disabled:opacity-30 border"
            style={{background:'rgba(16,185,129,0.08)',borderColor:'rgba(16,185,129,0.25)',color:'#34d399'}}>
            {loading&&loadText==='Uploading...'?'⏳':<Upload size={14} className="inline mr-1.5"/>} Upload</button>
        </div>

        {/* PROGRESS */}
        {loading&&<div className="rounded-xl backdrop-blur-xl p-4" style={{background:'rgba(18,18,24,0.4)',border:'1px solid rgba(255,255,255,0.04)'}}>
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-mono text-white/50">{loadText}</span><span className="text-xs font-mono text-gold">{loadPct}%</span></div>
          <div className="h-2 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,0.04)'}}>
            <div className="h-full rounded-full transition-all duration-500 ease-out" style={{width:`${loadPct}%`,background:`linear-gradient(90deg,${mc},#f0d68a)`}}/>
          </div>
        </div>}

        {/* PREVIEW */}
        {previewUrl&&<div className="rounded-xl backdrop-blur-xl p-5" style={{background:'rgba(18,18,24,0.5)',border:'1px solid rgba(255,255,255,0.04)',boxShadow:'0 4px 24px rgba(0,0,0,0.2)'}}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Music2 size={14} className="text-gold"/><span className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/50">Preview{previewDur>0?` · ${fmtTime(Math.round(previewDur))}`:''}</span></div>
            <a href={previewUrl} download={`bypassed_${mode}.${format}`} className="btn-ghost btn-xs flex items-center gap-1 rounded-lg"><Download size={11}/> Download</a>
          </div>
          <audio ref={audioRef} controls preload="auto" className="w-full rounded-lg"/>
        </div>}

        {/* RESULT */}
        {result&&result.assetId&&<div className="relative overflow-hidden rounded-2xl p-5" style={{background:'linear-gradient(135deg,rgba(16,185,129,0.06),transparent)',border:'1px solid rgba(16,185,129,0.2)'}}>
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-20" style={{background:'radial-gradient(circle,rgba(16,185,129,0.3),transparent 70%)',transform:'translate(30%,-30%)'}}/>
          <div className="relative flex items-center gap-3"><div className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:'rgba(16,185,129,0.1)'}}><svg viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" className="w-5 h-5"><path d="M20 6L9 17l-5-5"/></svg></div>
            <div><div className="text-emerald-400 font-bold">Upload Berhasil!</div><div className="text-xs font-mono text-white/50 mt-0.5">Asset ID: {result.assetId}</div></div>
          </div>
          {result.url&&<a href={result.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-gold text-xs mt-3 hover:underline relative" style={{marginLeft:52}}>Lihat di Roblox <ExternalLink size={11}/></a>}
        </div>}
        {result&&result.saved&&<div className="text-emerald-400 text-xs font-mono">✓ Disimpan</div>}
      </div>

      {/* ===== SIDEBAR (2/5) ===== */}
      <div className="lg:col-span-2 space-y-5">

        {/* AVATAR + GROUP */}
        <div className="rounded-2xl backdrop-blur-xl p-5 transition-all duration-300"
          style={{background:'rgba(18,18,24,0.5)',border:'1px solid rgba(255,255,255,0.04)',boxShadow:'0 4px 24px rgba(0,0,0,0.2)'}}>
          <div className="flex items-center gap-2 mb-4"><Sparkles size={14} className="text-gold"/><span className="text-[10px] font-mono uppercase tracking-[0.15em] text-gold/70 font-bold">Roblox Preview</span></div>
          <div className="flex gap-4 mb-3">
            <div className="flex-1 text-center">
              <div className="w-20 h-20 mx-auto rounded-2xl overflow-hidden flex items-center justify-center transition-all duration-300"
                style={{background:'rgba(0,0,0,0.25)',border:'1px solid rgba(255,255,255,0.04)',boxShadow:!imgErr.avatar&&avatarUrl?'0 0 30px rgba(212,175,55,0.15)':'none'}}>
                {avatarUrl&&!imgErr.avatar?<img src={avatarUrl} onError={()=>setImgErr(p=>({...p,avatar:1}))} className="w-full h-full object-cover"/>:<div className="text-white/15"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>}
              </div>
              <div className="text-[9px] font-mono text-white/40 mt-2">User</div>
            </div>
            <div className="flex-1 text-center">
              <div className="w-20 h-20 mx-auto rounded-2xl overflow-hidden flex items-center justify-center transition-all duration-300"
                style={{background:'rgba(0,0,0,0.25)',border:'1px solid rgba(255,255,255,0.04)',boxShadow:!imgErr.group&&groupUrl?'0 0 30px rgba(212,175,55,0.15)':'none'}}>
                {groupUrl&&!imgErr.group?<img src={groupUrl} onError={()=>setImgErr(p=>({...p,group:1}))} className="w-full h-full object-cover"/>:<div className="text-white/15"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>}
              </div>
              <div className="text-[9px] font-mono text-white/40 mt-2">Group</div>
            </div>
          </div>
          <div className="text-[10px] font-mono text-white/30 text-center">Masukkan ID, gambar otomatis tampil</div>
        </div>

        {/* CREDENTIALS */}
        <div className="rounded-2xl backdrop-blur-xl p-5"
          style={{background:'rgba(18,18,24,0.5)',border:'1px solid rgba(255,255,255,0.04)',boxShadow:'0 4px 24px rgba(0,0,0,0.2)'}}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><KeyRound size={14} className="text-gold"/><span className="text-[10px] font-mono uppercase tracking-[0.15em] text-gold/70 font-bold">Credentials</span></div>
            <div className={`w-2 h-2 rounded-full ${ak?'bg-emerald-400':'bg-red-400'}`}/>
          </div>
          <div className="space-y-2">
            <div className="flex gap-1.5">
              <input type={showAk?'text':'password'} value={ak} onChange={e=>setAk(e.target.value)} placeholder="API Key rbx_..." className="input text-xs flex-1 font-mono" style={{borderRadius:8}}/>
              <button onClick={()=>setShowAk(s=>!s)} className="btn-ghost btn-xs px-2" style={{borderRadius:8}}>{showAk?<EyeOff size={12}/>:<Eye size={12}/>}</button>
            </div>
            <input value={uid} onChange={e=>setUid(e.target.value)} placeholder="User ID" className="input text-xs font-mono" style={{borderRadius:8}}/>
            <input value={gid} onChange={e=>setGid(e.target.value)} placeholder="Group ID" className="input text-xs font-mono" style={{borderRadius:8}}/>
            <button onClick={saveAll} className="w-full py-2 rounded-xl font-bold text-xs uppercase tracking-[0.1em] transition-all duration-200 border"
              style={{background:'rgba(212,175,55,0.08)',borderColor:'rgba(212,175,55,0.25)',color:'#d4af37'}}><KeyRound size={11} className="inline mr-1.5"/> Simpan</button>
          </div>
        </div>

        {/* INFO */}
        <div className="rounded-2xl backdrop-blur-xl p-5"
          style={{background:'rgba(18,18,24,0.5)',border:'1px solid rgba(255,255,255,0.04)',boxShadow:'0 4px 24px rgba(0,0,0,0.2)'}}>
          <div className="flex items-center gap-2 mb-3"><Info size={14} className="text-gold"/><span className="text-[10px] font-mono uppercase tracking-[0.15em] text-gold/70 font-bold">Info</span></div>
          <div className="text-xs text-white/40 leading-relaxed space-y-1.5">
            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>100% browser processing</div>
            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-gold"/>Upload via Roblox Open Cloud</div>
            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-gold"/>Avatar/group via Roblox CDN</div>
            <div className="border-t border-white/5 pt-2 mt-2 text-[11px] text-white/25 leading-relaxed">Shield/Stealth = metode spektral baru. Ringan s/d Extreme = legacy EQ + MP3 re-encode.</div>
          </div>
        </div>
      </div>
    </div>
  </div>)
}

function encodeWavBlob(buf){const nc=buf.numberOfChannels,sr=buf.sampleRate,len=buf.length,ba=nc*2,byr=sr*ba,ds=len*ba;const ab=new ArrayBuffer(44+ds),v=new DataView(ab);let p=0;const ws=s=>{for(let i=0;i<s.length;i++)v.setUint8(p++,s.charCodeAt(i))};ws('RIFF');v.setUint32(p,36+ds,true);p+=4;ws('WAVE');ws('fmt ');v.setUint32(p,16,true);p+=4;v.setUint16(p,1,true);p+=2;v.setUint16(p,nc,true);p+=2;v.setUint32(p,sr,true);p+=4;v.setUint32(p,byr,true);p+=4;v.setUint16(p,ba,true);p+=2;v.setUint16(p,16,true);p+=2;ws('data');v.setUint32(p,ds,true);p+=4;const chs=[];for(let c=0;c<nc;c++)chs.push(buf.getChannelData(c));for(let i=0;i<len;i++){for(let c=0;c<nc;c++){let s=Math.max(-1,Math.min(1,chs[c][i]||0));v.setInt16(p,s<0?s*0x8000:s*0x7fff,true);p+=2}};return new Blob([ab],{type:'audio/wav'})}
let _lm=0;async function loadLame(){if(_lm||typeof lamejs!=='undefined'){_lm=1;return};return new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';s.onload=()=>{_lm=1;res()};s.onerror=()=>rej(new Error('load lamejs failed'));document.head.appendChild(s)})}
async function encodeMp3Blob(buf,kbps=192){await loadLame();const nc=Math.min(buf.numberOfChannels,2),sr=buf.sampleRate;const enc=new lamejs.Mp3Encoder(nc,sr,kbps);const l=f32(buf.getChannelData(0)),r=nc>1?f32(buf.getChannelData(1)):l;const ch=[];const B=1152;for(let i=0;i<l.length;i+=B){const lc=l.subarray(i,i+B),rc=r.subarray(i,i+B);const e=nc>1?enc.encodeBuffer(lc,rc):enc.encodeBuffer(lc);if(e.length)ch.push(e)};const t=enc.flush();if(t.length)ch.push(t);return new Blob(ch,{type:'audio/mpeg'})}
function f32(f32){const o=new Int16Array(f32.length);for(let i=0;i<f32.length;i++){let s=Math.max(-1,Math.min(1,f32[i]||0));o[i]=s<0?s*0x8000:s*0x7fff}return o}
async function encodeOggBlob(buf){const m=['audio/ogg;codecs=opus','audio/ogg','audio/webm;codecs=opus'].find(m=>MediaRecorder.isTypeSupported(m));if(!m)throw new Error('OGG not supported');const ctx=new AudioContext({sampleRate:buf.sampleRate});const dest=ctx.createMediaStreamDestination();const src=ctx.createBufferSource();src.buffer=buf;src.connect(dest);const rec=new MediaRecorder(dest.stream,{mimeType:m,audioBitsPerSecond:192000});const ch=[];rec.ondataavailable=e=>{if(e.data.size)ch.push(e.data)};const done=new Promise(r=>rec.onstop=r);rec.start(100);src.start();await new Promise(r=>{src.onended=r;setTimeout(r,(buf.duration+1)*1000)});rec.stop();await done;await ctx.close();return new Blob(ch,{type:m.startsWith('audio/webm')?'audio/ogg':m.split(';')[0]})}
