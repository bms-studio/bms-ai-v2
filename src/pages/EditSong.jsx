import { useRef, useState, useCallback, useEffect } from "react"
import {
  Upload, UploadCloud, Music2, ExternalLink,
  KeyRound, Eye, EyeOff, ShieldAlert, Download, User, Users
} from "lucide-react"
import { SectionHead, ErrorBox } from "../components/UI.jsx"
import StatusBadge from "../components/StatusBadge.jsx"
import { fmtBytes, fmtTime } from "../lib/utils.js"

const PERTURB_FREQS = [40,80,120,200,350,500,800,1200,2000,3000,5000,8000,12000,16000]
const PERTURB_VARIANTS = [
  [0.3,-0.4,0.5,-0.3,0.4,-0.5,0.3,-0.4,0.5,-0.3,0.4,-0.5,0.3,-0.4],
  [-0.4,0.5,-0.3,0.4,-0.5,0.3,-0.4,0.5,-0.3,0.4,-0.5,0.3,-0.4,0.5],
  [0.3,-0.5,0.4,-0.4,0.5,-0.3,0.4,-0.5,0.3,-0.4,0.5,-0.3,0.4,-0.5],
]
const TEMPO_VARS = [1.0,0.997,1.003]

const MODES = [
  { id:'shield',   label:'Shield',   desc:'Spektral + noise floor', color:'#d4af37' },
  { id:'stealth',  label:'Stealth',  desc:'Segment-based variant',  color:'#a78bfa' },
  { id:'ringan',   label:'Ringan',   desc:'EQ notches + tempo',    color:'#34d399' },
  { id:'sedang',   label:'Sedang',   desc:'EQ + phaser',           color:'#60a5fa' },
  { id:'berat',    label:'Berat',    desc:'EQ + phaser + chorus',  color:'#fb923c' },
  { id:'extreme',  label:'Extreme',  desc:'Semua efek + mono',     color:'#ef4444' },
]

const LEGACY = {
  ringan:{eq:[40,2000,14000],g:[-1,-1,-1],tempo:.998,phaser:0,chorus:0,mono:0},
  sedang:{eq:[40,100,1000,4000,14000],g:[-1.5,-1,-1.5,-1.5,-1],tempo:.995,phaser:1,chorus:0,mono:0},
  berat:{eq:[30,60,120,500,2000,6000,14000],g:[-2,-1.5,-1.5,-2,-2,-2,-1.5],tempo:.99,phaser:1,chorus:1,mono:0},
  extreme:{eq:[20,40,80,160,400,1000,3000,8000,16000],g:[-3,-2.5,-2,-2,-2.5,-2.5,-3,-2,-2],tempo:.985,phaser:1,chorus:1,mono:1},
}

const AK='bms.roblox.apiKey',UK='bms.roblox.userId',GK='bms.roblox.groupId',MK='bms_bp_mode'

export default function EditSong() {
  const [file,setFile]=useState(null)
  const [mode,setMode]=useState(()=>localStorage.getItem(MK)||'shield')
  const [format,setFormat]=useState('ogg')
  const [decoy,setDecoy]=useState(true)
  const [ak,setAk]=useState(()=>localStorage.getItem(AK)||'')
  const [showAk,setShowAk]=useState(false)
  const [uid,setUid]=useState(()=>localStorage.getItem(UK)||'')
  const [gid,setGid]=useState(()=>localStorage.getItem(GK)||'')
  const [loading,setLoading]=useState(false)
  const [loadPct,setLoadPct]=useState(0)
  const [loadText,setLoadText]=useState('')
  const [previewUrl,setPreviewUrl]=useState(null)
  const [previewDur,setPreviewDur]=useState(0)
  const [result,setResult]=useState(null)
  const [error,setError]=useState('')
  const [avatarUrl,setAvatarUrl]=useState('')
  const [groupIconUrl,setGroupIconUrl]=useState('')
  const [dragOver,setDragOver]=useState(false)
  const fileRef=useRef(null)
  const audioRef=useRef(null)

  // Fetch Roblox avatar & group icon
  useEffect(()=>{
    if(uid.trim()&&/^\d+$/.test(uid.trim()))
      fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${uid.trim()}&size=150x150&format=Png&isCircular=false`)
        .then(r=>r.json()).then(d=>{if(d?.data?.[0]?.imageUrl)setAvatarUrl(d.data[0].imageUrl)}).catch(()=>{})
    else setAvatarUrl('')
  },[uid])
  useEffect(()=>{
    if(gid.trim()&&/^\d+$/.test(gid.trim()))
      fetch(`https://thumbnails.roblox.com/v1/groups/icon?groupIds=${gid.trim()}&size=150x150&format=Png`)
        .then(r=>r.json()).then(d=>{if(d?.data?.[0]?.imageUrl)setGroupIconUrl(d.data[0].imageUrl)}).catch(()=>{})
    else setGroupIconUrl('')
  },[gid])

  // Audio duration from metadata
  const onMetaLoaded=useCallback(()=>{
    if(audioRef.current&&isFinite(audioRef.current.duration))
      setPreviewDur(audioRef.current.duration)
  },[])

  const decodeFile=useCallback(async f=>{
    const buf=await f.arrayBuffer()
    const ctx=new AudioContext()
    const ab=await ctx.decodeAudioData(buf)
    await ctx.close()
    return ab
  },[])

  function makeNoise(len){
    const o=new Float32Array(len)
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0
    for(let i=0;i<len;i++){
      const w=Math.random()*2-1
      b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852
      b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898
      o[i]=b0+b1+b2+b3+b4+b5+b6+w*.5362;b6=w*.115926
    }
    let mx=0;for(let i=0;i<len;i++){const a=Math.abs(o[i]);if(a>mx)mx=a}
    if(mx>0)for(let i=0;i<len;i++)o[i]/=mx
    return o
  }

  function applyEQ(ctx,src,freqs,gains){
    let chain=src
    for(let i=0;i<freqs.length;i++){
      const f=ctx.createBiquadFilter()
      f.type='peaking';f.frequency.value=freqs[i];f.Q.value=.5;f.gain.value=gains[i]
      chain.connect(f);chain=f
    }
    return chain
  }

  function applyPerturbation(ctx,src,v){
    const idx=v%PERTURB_VARIANTS.length
    return applyEQ(ctx,src,PERTURB_FREQS,PERTURB_VARIANTS[idx])
  }

  function applyPhaser(ctx,src){
    const delay=ctx.createDelay(1);delay.delayTime.value=.005
    const lfo=ctx.createOscillator();lfo.frequency.value=.5
    const lg=ctx.createGain();lg.gain.value=.005
    lfo.connect(lg);lg.connect(delay.delayTime);lfo.start()
    const fb=ctx.createGain();fb.gain.value=.3
    src.connect(delay);delay.connect(fb);fb.connect(delay)
    return delay
  }

  function applyChorus(ctx,src){
    const d1=ctx.createDelay(1),d2=ctx.createDelay(1)
    d1.delayTime.value=.02;d2.delayTime.value=.03
    const lfo=ctx.createOscillator();lfo.frequency.value=.3
    const lg=ctx.createGain();lg.gain.value=.005
    lfo.connect(lg);lg.connect(d1.delayTime);lg.connect(d2.delayTime);lfo.start()
    const dry=ctx.createGain();dry.gain.value=.6
    const wet=ctx.createGain();wet.gain.value=.4
    src.connect(dry);src.connect(d1);src.connect(d2)
    d1.connect(wet);d2.connect(wet)
    const sum=ctx.createGain();dry.connect(sum);wet.connect(sum)
    return sum
  }

  async function processInChunks(buffer,modeCfg,maxChunkSec=20){
    const sr=buffer.sampleRate,ch=buffer.numberOfChannels
    const chunkSamples=Math.floor(sr*maxChunkSec)
    const totalSamples=buffer.length
    const numChunks=Math.ceil(totalSamples/chunkSamples)
    const outLen=buffer.length
    const offline=new OfflineAudioContext(ch,outLen,sr)
    const src=offline.createBufferSource()
    src.buffer=buffer
    let chain=src

    if(modeCfg.eq)chain=applyEQ(offline,chain,modeCfg.eq,modeCfg.g)
    if(modeCfg.phaser)chain=applyPhaser(offline,chain)
    if(modeCfg.chorus)chain=applyChorus(offline,chain)
    if(modeCfg.mono&&ch>1){
      const merger=offline.createChannelMerger(1)
      chain.connect(merger);chain=merger
    }

    const g=offline.createGain();chain.connect(g);g.connect(offline.destination)
    if(modeCfg.tempo&&modeCfg.tempo!==1.0)src.playbackRate.value=modeCfg.tempo

    const decoyMs=decoy?4000:0
    const pad=Math.floor(sr*decoyMs/1000)
    src.start(pad/sr)

    // process in chunks with progress updates
    for(let c=0;c<numChunks;c++){
      const start=c*chunkSamples
      const end=Math.min((c+1)*chunkSamples,totalSamples)
      // We can't easily render partial with OfflineAudioContext, so we just update progress
      setLoadPct(Math.round((c/numChunks)*80+5))
      // yield to UI thread
      await new Promise(r=>setTimeout(r,0))
    }

    const rendered=await offline.startRendering()
    return rendered
  }

  const processAudio=useCallback(async()=>{
    if(!file)return
    setLoading(true);setLoadPct(0);setLoadText('Decoding audio...')
    setError('');setPreviewUrl(null);setPreviewDur(0);setResult(null)
    try{
      const decoyMs=decoy?4000:0
      let buffer=await decodeFile(file)
      const sr=buffer.sampleRate,ch=buffer.numberOfChannels

      if(mode==='shield'){
        setLoadText('Shield: spectral perturbation...');setLoadPct(5)
        const pad=Math.floor(sr*decoyMs/1000)
        const total=buffer.length+pad
        const offline=new OfflineAudioContext(ch,total,sr)
        const noiseDur=Math.max(buffer.duration+decoyMs/1000,30)
        const noiseLen=Math.floor(sr*noiseDur)
        const nd=makeNoise(noiseLen)
        const nb=offline.createBuffer(1,noiseLen,sr);nb.getChannelData(0).set(nd)
        const ns=offline.createBufferSource();ns.buffer=nb;ns.loop=noiseLen<total
        const ng=offline.createGain();ng.gain.value=.001
        ns.connect(ng)

        const src=offline.createBufferSource();src.buffer=buffer
        let chain=applyPerturbation(offline,src,0)
        // yield
        await new Promise(r=>setTimeout(r,0));setLoadPct(15)

        for(let c=0;c<10;c++){
          await new Promise(r=>setTimeout(r,0))
          setLoadPct(15+Math.round(c/10*55))
        }

        const g2=offline.createGain();chain.connect(g2);ng.connect(g2)
        g2.connect(offline.destination)
        src.start(pad/sr);ns.start(0)

        setLoadText('Shield: rendering...');setLoadPct(70)
        buffer=await offline.startRendering()
      }
      else if(mode==='stealth'){
        setLoadText('Stealth: processing segments...');setLoadPct(5)
        const segLen=Math.floor(sr*5)
        const numSegs=Math.ceil(buffer.length/segLen)
        const pad=Math.floor(sr*decoyMs/1000)
        const total=buffer.length+pad
        const offline=new OfflineAudioContext(ch,total,sr)
        const noiseDur=Math.max(buffer.duration+decoyMs/1000,30)
        const noiseLen=Math.floor(sr*noiseDur)
        const nd=makeNoise(noiseLen)
        const nb=offline.createBuffer(1,noiseLen,sr);nb.getChannelData(0).set(nd)
        const ns=offline.createBufferSource();ns.buffer=nb;ns.loop=noiseLen<total
        const ng=offline.createGain();ng.gain.value=.001
        ns.connect(ng);const ng2=offline.createGain();ng.connect(ng2);ng2.connect(offline.destination)
        ns.start(0)

        for(let s=0;s<numSegs;s++){
          const start=s*segLen
          const end=Math.min((s+1)*segLen,buffer.length)
          const segS=end-start
          if(segS<=0)continue
          const seg=offline.createBuffer(ch,segS,sr)
          for(let c=0;c<ch;c++){
            const sd=buffer.getChannelData(c),dd=seg.getChannelData(c)
            for(let i=0;i<segS;i++)dd[i]=sd[start+i]||0
          }
          const segSrc=offline.createBufferSource();segSrc.buffer=seg
          const variant=s%PERTURB_VARIANTS.length
          let chain=applyPerturbation(offline,segSrc,variant)
          const tv=TEMPO_VARS[variant%TEMPO_VARS.length]
          if(tv!==1.0)segSrc.playbackRate.value=tv
          const gg=offline.createGain();chain.connect(gg);gg.connect(offline.destination)
          segSrc.start((pad+start)/sr)
          setLoadPct(Math.round(5+(s/numSegs)*65))
          if(s%3===0)await new Promise(r=>setTimeout(r,0))
        }

        setLoadText('Stealth: rendering...');setLoadPct(70)
        buffer=await offline.startRendering()
      }
      else{
        const cfg=LEGACY[mode]
        if(!cfg)throw new Error('Unknown mode')
        setLoadText(`${mode}: applying EQ + effects...`);setLoadPct(5)
        await new Promise(r=>setTimeout(r,0))

        const ch2=cfg.mono?1:ch
        const pad=Math.floor(sr*decoyMs/1000)
        const total=buffer.length+pad
        const offline=new OfflineAudioContext(ch2,total,sr)
        const src=offline.createBufferSource();src.buffer=buffer
        let chain=src
        chain=applyEQ(offline,chain,cfg.eq,cfg.g)
        if(cfg.tempo!==1.0)src.playbackRate.value=cfg.tempo
        if(cfg.phaser)chain=applyPhaser(offline,chain)
        if(cfg.chorus)chain=applyChorus(offline,chain)
        if(cfg.mono&&ch>1){
          const m=offline.createChannelMerger(1);chain.connect(m);chain=m
        }
        const gg=offline.createGain();chain.connect(gg);gg.connect(offline.destination)
        src.start(pad/sr)

        await new Promise(r=>setTimeout(r,0));setLoadPct(30)
        let processed=await offline.startRendering()

        // MP3 re-encode trick
        const kb=mode==='ringan'?160:mode==='sedang'?128:mode==='berat'?96:64
        setLoadText(`${mode}: re-encode MP3 ${kb}kbps...`);setLoadPct(70)
        await new Promise(r=>setTimeout(r,0))
        const mp3=await encodeMp3Blob(processed,kb)
        const ctx2=new AudioContext()
        const ab2=await mp3.arrayBuffer()
        buffer=await ctx2.decodeAudioData(ab2.slice(0))
        await ctx2.close()
        setLoadPct(85)
      }

      // Encode final
      setLoadText(`Encoding ${format.toUpperCase()}...`);setLoadPct(90)
      let outBlob
      if(format==='mp3')outBlob=await encodeMp3Blob(buffer,192)
      else if(format==='ogg'){
        try{outBlob=await encodeOggBlob(buffer)}
        catch(e){console.warn('OGG fallback WAV:',e);outBlob=encodeWavBlob(buffer)}
      }else outBlob=encodeWavBlob(buffer)

      setLoadPct(100);setLoadText('Done!')
      const url=URL.createObjectURL(outBlob)
      setPreviewUrl(url)
      if(audioRef.current){audioRef.current.src=url;audioRef.current.load()}
      setLoading(false)
    }catch(e){
      setError('Error: '+(e.message||e));setLoading(false)
    }
  },[file,mode,format,decoy,decodeFile])

  const handleUpload=useCallback(async()=>{
    if(!previewUrl){setError('Proses dulu audio nya!');return}
    if(!ak){setError('API Key belum diisi!');return}
    if(!uid&&!gid){setError('Isi User ID atau Group ID!');return}
    setLoading(true);setLoadPct(0);setLoadText('Uploading to Roblox...')
    setError('');setResult(null)
    try{
      const resp=await fetch(previewUrl);const blob=await resp.blob()
      const name=(file?.name||'audio').replace(/\.[^.]+$/,'').slice(0,50)
      const fd=new FormData()
      fd.append('request',JSON.stringify({
        displayName:name,description:`Uploaded via BMS Studio — Mode: ${mode}`,
        assetType:'Audio',
        creationContext:{creator:gid.trim()?{groupId:Number(gid)}:{userId:Number(uid)}}
      }))
      fd.append('fileContent',blob,`${name}.${format}`)
      const xhr=new XMLHttpRequest()
      xhr.open('POST','https://apis.roblox.com/assets/v1/assets',true)
      xhr.setRequestHeader('x-api-key',ak)
      xhr.timeout=180000
      xhr.upload.onprogress=e=>{
        if(e.lengthComputable)setLoadPct(Math.round(10+(e.loaded/e.total)*80))
      }
      await new Promise((resolve,reject)=>{
        xhr.onload=()=>{
          if(xhr.status>=200&&xhr.status<300){
            let d;try{d=JSON.parse(xhr.responseText)}catch{d={}}
            const id=d.assetId||d.path?.split('/')?.pop()||'?'
            setResult({assetId:id,url:`https://www.roblox.com/library/${id}/`})
            setLoadPct(100);resolve()
          }else{
            let msg=xhr.responseText
            try{const d=JSON.parse(xhr.responseText);msg=d?.error?.message||d?.errors?.[0]?.message||msg}catch{}
            reject(new Error(msg||`HTTP ${xhr.status}`))
          }
        }
        xhr.onerror=()=>reject(new Error('Network error'))
        xhr.ontimeout=()=>reject(new Error('Timeout'))
        xhr.send(fd)
      })
      setLoading(false)
    }catch(e){setError('Upload error: '+(e.message||e));setLoading(false)}
  },[previewUrl,ak,uid,gid,file,mode,format])

  function saveKey(){
    localStorage.setItem(AK,ak);localStorage.setItem(UK,uid);localStorage.setItem(GK,gid)
    setResult({saved:true});setTimeout(()=>setResult(null),2000)
  }

  // Drag & drop
  function onDragOver(e){e.preventDefault();setDragOver(true)}
  function onDragLeave(){setDragOver(false)}
  function onDrop(e){e.preventDefault();setDragOver(false);if(e.dataTransfer.files?.[0])handleFile(e.dataTransfer.files[0])}
  function handleFile(f){setFile(f);setPreviewUrl(null);setPreviewDur(0);setResult(null);setError('')}

  const modeColor=MODES.find(m=>m.id===mode)?.color||'#d4af37'

  return (
    <div className="page-pad" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <SectionHead kicker="// studio" title="Bypass Audible Magic"
        sub="Proses audio langsung di browser via Web Audio API, upload ke Roblox. Tidak perlu server eksternal.">
        <StatusBadge variant="gold" dot>Client-side</StatusBadge>
      </SectionHead>

      {error&&<div className="mb-4"><ErrorBox title="Error" message={error}/></div>}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* MAIN */}
        <div className="lg:col-span-2 space-y-4">

          {/* FILE UPLOAD */}
          <div className={`panel p-4 transition-all duration-300 ${dragOver?'border-gold/60 scale-[1.01]':''}`}
            style={{borderColor:dragOver?'rgba(212,175,55,0.6)':undefined}}>
            <div className="card-title mb-3">File Audio</div>
            <div
              className="border-2 border-dashed border-white/10 bg-jet/30 p-8 text-center cursor-pointer
                hover:border-gold/40 hover:bg-gold/5 transition-all duration-300 relative overflow-hidden group"
              onClick={()=>fileRef.current?.click()}
              style={dragOver?{borderColor:'rgba(212,175,55,0.6)',background:'rgba(212,175,55,0.05)'}:{}}
            >
              <input ref={fileRef} type="file" accept="audio/*" className="hidden"
                onChange={e=>e.target.files?.[0]&&handleFile(e.target.files[0])}/>
              <div className="absolute inset-0 bg-gold/0 group-hover:bg-gold/[0.02] transition-all duration-500"/>
              <div className="relative">
                <div className="text-3xl mb-2 opacity-40 group-hover:scale-110 group-hover:opacity-60 transition-all duration-300"
                  style={{transform:dragOver?'scale(1.2) rotate(-10deg)':undefined}}>🎵</div>
                {file?<div>
                  <div className="font-bold text-white text-sm">{file.name}</div>
                  <div className="text-[10px] font-mono text-white/40 mt-1">{fmtBytes(file.size)}</div>
                </div>:<div>
                  <div className="font-bold text-white text-sm">Klik atau drop file audio</div>
                  <div className="text-[10px] font-mono text-white/40 mt-1">mp3 · wav · ogg · flac · m4a</div>
                </div>}
              </div>
            </div>
          </div>

          {/* MODE + FORMAT */}
          <div className="panel p-4">
            <div className="card-title mb-3">Mode Bypass</div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-4">
              {MODES.map(m=>
                <button key={m.id} onClick={()=>{setMode(m.id);localStorage.setItem(MK,m.id)}}
                  className="px-2 py-2 border text-[9px] font-mono text-center transition-all duration-200"
                  style={{
                    borderColor:mode===m.id?m.color:'rgba(255,255,255,0.08)',
                    background:mode===m.id?`${m.color}15`:'rgba(0,0,0,0.2)',
                    color:mode===m.id?m.color:'rgba(255,255,255,0.5)',
                    boxShadow:mode===m.id?`0 0 20px ${m.color}20`:'none',
                    transform:mode===m.id?'scale(1.05)':'scale(1)',
                  }}>
                  <div className="font-bold text-xs">{m.label}</div>
                  <div className="opacity-60 mt-0.5" style={{fontSize:7,lineHeight:1.2}}>{m.desc}</div>
                </button>
              )}
            </div>
            <div className="flex gap-3 items-center flex-wrap">
              <div className="w-28">
                <label className="text-[9px] font-mono uppercase text-white/40 tracking-wider block mb-1">Output</label>
                <select value={format} onChange={e=>setFormat(e.target.value)} className="input text-xs font-mono">
                  <option value="ogg">OGG</option><option value="mp3">MP3</option><option value="wav">WAV</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-4">
                <input type="checkbox" checked={decoy} onChange={e=>setDecoy(e.target.checked)}
                  className="accent-gold" style={{width:14,height:14}}/>
                <span className="text-[11px] text-white/60">Decoy Start (4s silence)</span>
              </label>
            </div>
          </div>

          {/* ACTIONS + PROGRESS */}
          <div className="flex gap-3">
            <button onClick={processAudio} disabled={loading||!file}
              className="btn-primary btn flex-1 relative overflow-hidden"
              style={{'--mode-color':modeColor}}>
              {loading&&loadText.includes('eco')?'⏳':<UploadCloud size={13}/>} Process
            </button>
            <button onClick={handleUpload} disabled={loading||!previewUrl} className="btn flex-1 relative overflow-hidden"
              style={{background:'rgba(16,185,129,0.12)',border:'1px solid rgba(16,185,129,0.3)',color:'#34d399'}}>
              {loading&&loadText.includes('Uplo')?'⏳':<Upload size={13}/>} Upload
            </button>
          </div>

          {loading&&<div className="panel p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono text-white/50">{loadText}</span>
              <span className="text-[10px] font-mono text-gold">{loadPct}%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500 ease-out"
                style={{width:`${loadPct}%`,background:`linear-gradient(90deg,${modeColor},#f0d68a)`}}/>
            </div>
          </div>}

          {/* PREVIEW + DOWNLOAD */}
          {previewUrl&&<div className="panel p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Music2 size={12} className="text-gold"/>
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                  Preview {previewDur>0?`· ${fmtTime(Math.round(previewDur))}`:''}
                </span>
              </div>
              <a href={previewUrl} download={`bypassed_${mode}.${format}`}
                className="btn-ghost btn-xs flex items-center gap-1">
                <Download size={10}/> Download
              </a>
            </div>
            <audio ref={audioRef} controls preload="auto" className="w-full rounded"
              onLoadedMetadata={onMetaLoaded}/>
          </div>}

          {/* RESULT */}
          {result&&result.assetId&&<div className="panel p-4 relative overflow-hidden"
            style={{borderColor:'rgba(16,185,129,0.3)',background:'linear-gradient(135deg,rgba(16,185,129,0.05),transparent)'}}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/5 rounded-full -translate-y-1/2 translate-x-1/2"/>
            <div className="text-emerald-400 font-bold text-sm mb-1 relative">✓ Upload Berhasil!</div>
            <div className="text-[11px] font-mono text-white/60 relative">Asset ID: {result.assetId}</div>
            {result.url&&<a href={result.url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-gold text-[11px] mt-2 hover:underline relative">
              Lihat di Roblox <ExternalLink size={10}/></a>}
          </div>}
          {result&&result.saved&&<div className="text-emerald-400 text-[11px] font-mono">API Key saved!</div>}
        </div>

        {/* SIDEBAR */}
        <div className="space-y-3">

          {/* AVATAR / GROUP */}
          <div className="panel p-4">
            <div className="card-title mb-3">Roblox Preview</div>
            <div className="flex gap-3">
              <div className="flex-1 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-jet border border-white/10 overflow-hidden flex items-center justify-center text-white/20 transition-all duration-300"
                  style={avatarUrl?{boxShadow:'0 0 20px rgba(212,175,55,0.2)'}:{}}>
                  {avatarUrl?<img src={avatarUrl} alt="" className="w-full h-full object-cover"/>
                    :<User size={24}/>}
                </div>
                <div className="text-[9px] font-mono text-white/40 mt-1">User</div>
              </div>
              <div className="flex-1 text-center">
                <div className="w-16 h-16 mx-auto rounded-lg bg-jet border border-white/10 overflow-hidden flex items-center justify-center text-white/20 transition-all duration-300"
                  style={groupIconUrl?{boxShadow:'0 0 20px rgba(212,175,55,0.2)'}:{}}>
                  {groupIconUrl?<img src={groupIconUrl} alt="" className="w-full h-full object-cover"/>
                    :<Users size={24}/>}
                </div>
                <div className="text-[9px] font-mono text-white/40 mt-1">Group</div>
              </div>
            </div>
          </div>

          {/* API KEY */}
          <div className="panel p-4">
            <div className="card-title flex items-center gap-2 mb-3">
              <KeyRound size={13} className="text-gold"/> Roblox API
              {ak?<StatusBadge variant="success" dot/>:<StatusBadge variant="destructive" dot/>}
            </div>
            <div className="space-y-2">
              <div className="flex gap-1.5">
                <input type={showAk?'text':'password'} value={ak}
                  onChange={e=>setAk(e.target.value)} placeholder="API Key" className="input text-xs flex-1 font-mono"/>
                <button onClick={()=>setShowAk(s=>!s)} className="btn-ghost btn-xs">
                  {showAk?<EyeOff size={11}/>:<Eye size={11}/>}</button>
              </div>
              <input value={uid} onChange={e=>setUid(e.target.value)} placeholder="User ID" className="input text-xs font-mono"/>
              <input value={gid} onChange={e=>setGid(e.target.value)} placeholder="Group ID" className="input text-xs font-mono"/>
              <button onClick={saveKey} className="btn-primary btn-xs btn-full"><KeyRound size={11}/> Save</button>
            </div>
          </div>

          {/* INFO */}
          <div className="panel p-4">
            <div className="card-title flex items-center gap-2 mb-2"><ShieldAlert size={13} className="text-gold"/> Info</div>
            <div className="text-[10px] font-mono text-white/50 space-y-2">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"/>100% client-side</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gold"/>Upload langsung ke Roblox</div>
              <div className="text-white/30 text-[9px] mt-2">Avatar & group icon diambil otomatis dari Roblox Thumbnails API.</div>
            </div>
          </div>

          {/* TIPS */}
          <div className="panel p-4">
            <div className="card-title mb-2">Tips</div>
            <ul className="text-[10px] font-mono text-white/50 space-y-1 list-disc pl-4">
              <li>Buat API Key di create.roblox.com/dashboard/credentials</li>
              <li>Shield/Stealth = kualitas terjaga</li>
              <li>Extreme = agresif, kualitas turun</li>
              <li>File besar butuh waktu lebih lama</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== ENCODERS =====
function encodeWavBlob(buf){
  const nc=buf.numberOfChannels,sr=buf.sampleRate,len=buf.length,ba=nc*2,byr=sr*ba,ds=len*ba
  const ab=new ArrayBuffer(44+ds),v=new DataView(ab)
  let p=0
  const ws=s=>{for(let i=0;i<s.length;i++)v.setUint8(p++,s.charCodeAt(i))}
  ws('RIFF');v.setUint32(p,36+ds,true);p+=4
  ws('WAVE');ws('fmt ');v.setUint32(p,16,true);p+=4
  v.setUint16(p,1,true);p+=2;v.setUint16(p,nc,true);p+=2
  v.setUint32(p,sr,true);p+=4;v.setUint32(p,byr,true);p+=4
  v.setUint16(p,ba,true);p+=2;v.setUint16(p,16,true);p+=2
  ws('data');v.setUint32(p,ds,true);p+=4
  const chs=[];for(let c=0;c<nc;c++)chs.push(buf.getChannelData(c))
  for(let i=0;i<len;i++){for(let c=0;c<nc;c++){let s=Math.max(-1,Math.min(1,chs[c][i]||0));v.setInt16(p,s<0?s*0x8000:s*0x7fff,true);p+=2}}
  return new Blob([ab],{type:'audio/wav'})
}

let _lame=0
async function loadLame(){
  if(_lame||typeof lamejs!=='undefined'){_lame=1;return}
  return new Promise((res,rej)=>{
    const s=document.createElement('script')
    s.src='https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js'
    s.onload=()=>{_lame=1;res()};s.onerror=()=>rej(new Error('Failed MP3 encoder'))
    document.head.appendChild(s)
  })
}

async function encodeMp3Blob(buf,kbps=192){
  await loadLame()
  const nc=Math.min(buf.numberOfChannels,2),sr=buf.sampleRate
  const enc=new lamejs.Mp3Encoder(nc,sr,kbps)
  const left=f32(buf.getChannelData(0))
  const right=nc>1?f32(buf.getChannelData(1)):left
  const ch=[];const B=1152
  for(let i=0;i<left.length;i+=B){
    const lc=left.subarray(i,i+B),rc=right.subarray(i,i+B)
    const e=nc>1?enc.encodeBuffer(lc,rc):enc.encodeBuffer(lc)
    if(e.length)ch.push(e)
  }
  const t=enc.flush();if(t.length)ch.push(t)
  return new Blob(ch,{type:'audio/mpeg'})
}

function f32(f32){const o=new Int16Array(f32.length);for(let i=0;i<f32.length;i++){let s=Math.max(-1,Math.min(1,f32[i]||0));o[i]=s<0?s*0x8000:s*0x7fff}return o}

async function encodeOggBlob(buf){
  const mime=['audio/ogg;codecs=opus','audio/ogg','audio/webm;codecs=opus'].find(m=>MediaRecorder.isTypeSupported(m))
  if(!mime)throw new Error('OGG not supported')
  const ctx=new AudioContext({sampleRate:buf.sampleRate})
  const dest=ctx.createMediaStreamDestination()
  const src=ctx.createBufferSource();src.buffer=buf;src.connect(dest)
  const rec=new MediaRecorder(dest.stream,{mimeType:mime,audioBitsPerSecond:192000})
  const ch=[];rec.ondataavailable=e=>{if(e.data.size)ch.push(e.data)}
  const done=new Promise(r=>rec.onstop=r)
  rec.start(100);src.start()
  await new Promise(r=>{src.onended=r;setTimeout(r,(buf.duration+1)*1000)})
  rec.stop();await done;await ctx.close()
  return new Blob(ch,{type:mime.startsWith('audio/webm')?'audio/ogg':mime.split(';')[0]})
}
