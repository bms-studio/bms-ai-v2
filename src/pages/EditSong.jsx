import { useRef, useState, useCallback } from "react"
import {
  Upload, UploadCloud, Music2, ExternalLink,
  KeyRound, Eye, EyeOff, ShieldAlert
} from "lucide-react"
import { SectionHead, ErrorBox } from "../components/UI.jsx"
import StatusBadge from "../components/StatusBadge.jsx"
import { fmtBytes, fmtTime } from "../lib/utils.js"

// 14-band spectral perturbation frequencies
const PERTURB_FREQS = [40,80,120,200,350,500,800,1200,2000,3000,5000,8000,12000,16000]
const PERTURB_VARIANTS = [
  [0.3,-0.4,0.5,-0.3,0.4,-0.5,0.3,-0.4,0.5,-0.3,0.4,-0.5,0.3,-0.4],
  [-0.4,0.5,-0.3,0.4,-0.5,0.3,-0.4,0.5,-0.3,0.4,-0.5,0.3,-0.4,0.5],
  [0.3,-0.5,0.4,-0.4,0.5,-0.3,0.4,-0.5,0.3,-0.4,0.5,-0.3,0.4,-0.5],
]
const TEMPO_VARS = [1.0,0.997,1.003]

const MODES = [
  { id:'shield',   label:'Shield',   desc:'Spektral + noise floor' },
  { id:'stealth',  label:'Stealth',  desc:'Segment-based variant cycling' },
  { id:'ringan',   label:'Ringan',   desc:'EQ notches + tempo' },
  { id:'sedang',   label:'Sedang',   desc:'EQ + phaser' },
  { id:'berat',    label:'Berat',    desc:'EQ + phaser + chorus' },
  { id:'extreme',  label:'Extreme',  desc:'Semua efek + mono' },
]

// Legacy preset configs
const LEGACY = {
  ringan:{eq:[40,2000,14000],g:[-1,-1,-1],tempo:.998,phaser:!1,chorus:!1,mono:!1},
  sedang:{eq:[40,100,1000,4000,14000],g:[-1.5,-1,-1.5,-1.5,-1],tempo:.995,phaser:!0,chorus:!1,mono:!1},
  berat:{eq:[30,60,120,500,2000,6000,14000],g:[-2,-1.5,-1.5,-2,-2,-2,-1.5],tempo:.99,phaser:!0,chorus:!0,mono:!1},
  extreme:{eq:[20,40,80,160,400,1000,3000,8000,16000],g:[-3,-2.5,-2,-2,-2.5,-2.5,-3,-2,-2],tempo:.985,phaser:!0,chorus:!0,mono:!0},
}

const API_KEY_STORAGE='bms.roblox.apiKey'
const UID_STORAGE='bms.roblox.userId'
const GID_STORAGE='bms.roblox.groupId'

export default function EditSong() {
  const [file,setFile]=useState(null)
  const [mode,setMode]=useState(()=>localStorage.getItem('bms_bp_mode')||'shield')
  const [format,setFormat]=useState('ogg')
  const [decoy,setDecoy]=useState(true)
  const [ak,setAk]=useState(()=>localStorage.getItem(API_KEY_STORAGE)||'')
  const [showAk,setShowAk]=useState(false)
  const [uid,setUid]=useState(()=>localStorage.getItem(UID_STORAGE)||'')
  const [gid,setGid]=useState(()=>localStorage.getItem(GID_STORAGE)||'')
  const [loading,setLoading]=useState(false)
  const [loadText,setLoadText]=useState('')
  const [previewUrl,setPreviewUrl]=useState(null)
  const [result,setResult]=useState(null)
  const [error,setError]=useState('')
  const [dur,setDur]=useState(0)
  const fileRef=useRef(null)
  const audioRef=useRef(null)

  // ---- Client-side processing ----
  const decodeFile=useCallback(async f=>{
    const buf=await f.arrayBuffer()
    const ctx=new AudioContext()
    const ab=await ctx.decodeAudioData(buf)
    await ctx.close()
    return ab
  },[])

  // Pink noise buffer generation (Paul Kellet method)
  function makeNoise(len,sr){
    const buf=new Float32Array(len)
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0
    for(let i=0;i<len;i++){
      const w=Math.random()*2-1
      b0=.99886*b0+w*.0555179
      b1=.99332*b1+w*.0750759
      b2=.969*b2+w*.153852
      b3=.8665*b3+w*.3104856
      b4=.55*b4+w*.5329522
      b5=-.7616*b5-w*.016898
      buf[i]=b0+b1+b2+b3+b4+b5+b6+w*.5362
      b6=w*.115926
    }
    // normalize
    let mx=0;for(let i=0;i<len;i++){const a=Math.abs(buf[i]);if(a>mx)mx=a}
    if(mx>0)for(let i=0;i<len;i++)buf[i]/=mx
    return buf
  }

  // Apply peaking EQ filters
  function applyEQ(ctx,src,freqs,gains){
    let chain=src
    for(let i=0;i<freqs.length;i++){
      const f=ctx.createBiquadFilter()
      f.type='peaking'
      f.frequency.value=freqs[i]
      f.Q.value=.5
      f.gain.value=gains[i]
      chain.connect(f)
      chain=f
    }
    return chain
  }

  // Spectral perturbation: 14-band random EQ
  function applyPerturbation(ctx,src,variantIdx){
    const idx=variantIdx%PERTURB_VARIANTS.length
    const gains=PERTURB_VARIANTS[idx]
    return applyEQ(ctx,src,PERTURB_FREQS,gains)
  }

  // Phaser effect using allpass chain
  function applyPhaser(ctx,src){
    const depth=.005,rate=.5,fb=.3
    const delay=ctx.createDelay(1)
    delay.delayTime.value=.005
    const lfo=ctx.createOscillator()
    lfo.frequency.value=rate
    const lfoGain=ctx.createGain()
    lfoGain.gain.value=depth
    lfo.connect(lfoGain)
    lfoGain.connect(delay.delayTime)
    lfo.start()
    const fbNode=ctx.createGain()
    fbNode.gain.value=fb
    src.connect(delay)
    delay.connect(fbNode)
    fbNode.connect(delay)
    return delay
  }

  // Chorus effect
  function applyChorus(ctx,src){
    const d1=ctx.createDelay(1),d2=ctx.createDelay(1)
    d1.delayTime.value=.02;d2.delayTime.value=.03
    const lfo=ctx.createOscillator()
    lfo.frequency.value=.3
    const lg=ctx.createGain()
    lg.gain.value=.005
    lfo.connect(lg);lg.connect(d1.delayTime);lfo.connect(d2.delayTime);lfo.start()
    const dry=ctx.createGain();dry.gain.value=.6
    const wet=ctx.createGain();wet.gain.value=.4
    src.connect(dry);src.connect(d1);src.connect(d2)
    d1.connect(wet);d2.connect(wet)
    const sum=ctx.createGain()
    dry.connect(sum);wet.connect(sum)
    return sum
  }

  // Add decoy silence (pad at start)
  function addDecoy(buffer,ms){
    const sr=buffer.sampleRate
    const padSamples=Math.floor(sr*ms/1000)
    const newLen=buffer.length+padSamples
    const ctx=new OfflineAudioContext(buffer.numberOfChannels,newLen,sr)
    const src=ctx.createBufferSource()
    src.buffer=buffer
    src.connect(ctx.destination)
    src.start(padSamples/sr)
    return ctx.startRendering()
  }

  // Main processing
  const processAudio=useCallback(async()=>{
    if(!file)return
    setLoading(true);setLoadText('Decoding audio...');setError('');setPreviewUrl(null);setResult(null)
    try{
      const decoyMs=decoy?4000:0
      let buffer=await decodeFile(file)
      const sr=buffer.sampleRate

      if(mode==='shield'){
        setLoadText('Applying Shield processing...')
        const channels=buffer.numberOfChannels
        const padSamples=Math.floor(sr*decoyMs/1000)
        const totalLen=buffer.length+padSamples
        const offline=new OfflineAudioContext(channels,totalLen,sr)
        const src=offline.createBufferSource()
        src.buffer=buffer
        let chain=applyPerturbation(offline,src,0)
        // noise floor
        const noiseDur=Math.max(buffer.duration+decoyMs/1000,10)
        const noiseLen=Math.floor(sr*noiseDur)
        const noiseData=makeNoise(noiseLen,sr)
        const noiseBuf=offline.createBuffer(1,noiseLen,sr)
        noiseBuf.getChannelData(0).set(noiseData)
        const noiseSrc=offline.createBufferSource()
        noiseSrc.buffer=noiseBuf
        noiseSrc.loop=noiseLen<totalLen
        const ng=offline.createGain()
        ng.gain.value=.001 // -60dB
        noiseSrc.connect(ng)
        // mix
        const gain=offline.createGain()
        chain.connect(gain)
        ng.connect(gain)
        gain.connect(offline.destination)
        src.start(padSamples/sr)
        noiseSrc.start(0)
        buffer=await offline.startRendering()
      }
      else if(mode==='stealth'){
        setLoadText('Applying Stealth processing (segments)...')
        const channels=buffer.numberOfChannels
        const segLen=Math.floor(sr*5) // 5s segments
        const numSegs=Math.ceil(buffer.length/segLen)
        const padSamples=Math.floor(sr*decoyMs/1000)
        const totalLen=buffer.length+padSamples
        const offline=new OfflineAudioContext(channels,totalLen,sr)
        // Process each segment with alternating variants
        for(let s=0;s<numSegs;s++){
          const start=s*segLen
          const end=Math.min((s+1)*segLen,buffer.length)
          const segSamples=end-start
          if(segSamples<=0)continue
          const seg=offline.createBuffer(channels,segSamples,sr)
          for(let c=0;c<channels;c++){
            const sd=buffer.getChannelData(c)
            const dd=seg.getChannelData(c)
            for(let i=0;i<segSamples;i++)dd[i]=sd[start+i]||0
          }
          const segSrc=offline.createBufferSource()
          segSrc.buffer=seg
          const variant=s%PERTURB_VARIANTS.length
          let chain=applyPerturbation(offline,segSrc,variant)
          // tempo variant
          const tv=TEMPO_VARS[variant%TEMPO_VARS.length]
          if(tv!==1.0){
            segSrc.playbackRate.value=tv
          }
          const g=offline.createGain()
          chain.connect(g)
          g.connect(offline.destination)
          segSrc.start((padSamples+start)/sr)
        }
        // noise floor
        const noiseDur=Math.max(buffer.duration+decoyMs/1000,10)
        const noiseLen=Math.floor(sr*noiseDur)
        const noiseData=makeNoise(noiseLen,sr)
        const noiseBuf=offline.createBuffer(1,noiseLen,sr)
        noiseBuf.getChannelData(0).set(noiseData)
        const noiseSrc=offline.createBufferSource()
        noiseSrc.buffer=noiseBuf
        noiseSrc.loop=noiseLen<totalLen
        const ng=offline.createGain()
        ng.gain.value=.001
        noiseSrc.connect(ng)
        const ng2=offline.createGain()
        ng.connect(ng2)
        ng2.connect(offline.destination)
        noiseSrc.start(0)
        buffer=await offline.startRendering()
      }
      else{
        // Legacy modes
        const cfg=LEGACY[mode]
        if(!cfg)throw new Error('Unknown mode: '+mode)
        setLoadText(`Applying ${mode} processing...`)

        // Step 1: Apply EQ + effects
        const padSamples=Math.floor(sr*decoyMs/1000)
        const totalLen=buffer.length+padSamples
        const ch=cfg.mono?1:buffer.numberOfChannels
        const offline=new OfflineAudioContext(ch,totalLen,sr)
        const src=offline.createBufferSource()
        src.buffer=buffer
        let chain=src

        // EQ notches
        chain=applyEQ(offline,chain,cfg.eq,cfg.g)

        // Tempo
        if(cfg.tempo!==1.0)src.playbackRate.value=cfg.tempo

        // Phaser
        if(cfg.phaser)chain=applyPhaser(offline,chain)

        // Chorus
        if(cfg.chorus)chain=applyChorus(offline,chain)

        // Mono downmix
        if(cfg.mono){
          const merger=offline.createChannelMerger(ch)
          chain.connect(merger)
          chain=merger
        }

        const g2=offline.createGain()
        chain.connect(g2)
        g2.connect(offline.destination)
        src.start(padSamples/sr)
        let processed=await offline.startRendering()

        // Step 2: Re-encode through low-bitrate MP3 (Audible Magic trick)
        setLoadText('Re-encoding through MP3...')
        const reencodeKbps=mode==='ringan'?160:mode==='sedang'?128:mode==='berat'?96:64
        const mp3Blob=await encodeMp3Blob(processed,reencodeKbps)
        // Decode MP3 back to AudioBuffer
        const ctx2=new AudioContext()
        const mp3ArrBuf=await mp3Blob.arrayBuffer()
        buffer=await ctx2.decodeAudioData(mp3ArrBuf.slice(0))
        await ctx2.close()
      }

      // Step 3: Encode to final format
      setLoadText(`Encoding to ${format.toUpperCase()}...`)
      let outBlob
      if(format==='mp3'){
        outBlob=await encodeMp3Blob(buffer,192)
      }else if(format==='ogg'){
        // OGG via MediaRecorder or fallback to WAV
        try{
          outBlob=await encodeOggBlob(buffer)
        }catch(e){
          console.warn('OGG encoder failed, using WAV:',e)
          outBlob=encodeWavBlob(buffer)
        }
      }else{
        outBlob=encodeWavBlob(buffer)
      }

      const url=URL.createObjectURL(outBlob)
      setPreviewUrl(url)
      setDur(buffer.duration)
      if(audioRef.current){audioRef.current.src=url;audioRef.current.load()}
      setLoading(false)
    }catch(e){
      setError('Processing error: '+(e.message||e))
      setLoading(false)
    }
  },[file,mode,format,decoy,decodeFile])

  // ---- Upload direct ke Roblox Open Cloud ----
  const handleUpload=useCallback(async()=>{
    if(!previewUrl){setError('Proses dulu audio nya!');return}
    if(!ak){setError('API Key belum diisi!');return}
    if(!uid&&!gid){setError('Isi User ID (pribadi) atau Group ID (upload ke group)!');return}
    setLoading(true);setLoadText('Uploading to Roblox...');setError('');setResult(null)
    try{
      const resp=await fetch(previewUrl)
      const blob=await resp.blob()
      const name=(file?.name||'audio').replace(/\.[^.]+$/,'').slice(0,50)
      const fd=new FormData()
      fd.append('request',JSON.stringify({
        displayName:name,
        description:`Uploaded via BMS Studio — Mode: ${mode}`,
        assetType:'Audio',
        creationContext:{creator:gid.trim()?{groupId:Number(gid)}:{userId:Number(uid)}}
      }))
      fd.append('fileContent',blob,`${name}.${format}`)

      const xhr=new XMLHttpRequest()
      xhr.open('POST','https://apis.roblox.com/assets/v1/assets',true)
      xhr.setRequestHeader('x-api-key',ak)
      xhr.timeout=180000

      await new Promise((resolve,reject)=>{
        xhr.onload=()=>{
          if(xhr.status>=200&&xhr.status<300){
            let d
            try{d=JSON.parse(xhr.responseText)}catch{d={}}
            setResult({assetId:d.assetId||d.path?.split('/')?.pop()||'?',url:`https://www.roblox.com/library/${d.assetId||d.path?.split('/')?.pop()||'?'}/`})
            resolve()
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
    }catch(e){
      setError('Upload error: '+(e.message||e))
      setLoading(false)
    }
  },[previewUrl,ak,uid,file,mode,format])

  function saveKey(){
    localStorage.setItem(API_KEY_STORAGE,ak)
    localStorage.setItem(UID_STORAGE,uid)
    localStorage.setItem(GID_STORAGE,gid)
    setResult({saved:true})
    setTimeout(()=>setResult(null),2000)
  }

  return (
    <div className="page-pad">
      <SectionHead kicker="// studio" title="Bypass Audible Magic"
        sub="Proses audio langsung di browser untuk bypass Audible Magic, lalu upload ke Roblox. Tidak perlu server.">
        <StatusBadge variant="gold" dot>Client-side</StatusBadge>
      </SectionHead>

      {error&&<div className="mb-4"><ErrorBox title="Error" message={error}/></div>}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* File upload */}
          <div className="panel p-4">
            <div className="card-title mb-3">File Audio</div>
            <div className="border-2 border-dashed border-white/10 bg-jet/30 p-8 text-center cursor-pointer hover:border-gold/40 hover:bg-gold/5 transition-colors"
              onClick={()=>fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept="audio/*" className="hidden"
                onChange={e=>e.target.files?.[0]&&(setFile(e.target.files[0]),setPreviewUrl(null),setResult(null),setDur(0),setError(''))}/>
              <div className="text-2xl mb-1 opacity-40">🎵</div>
              {file?<div><div className="font-bold text-white text-sm">{file.name}</div>
                <div className="text-[10px] font-mono text-white/40 mt-1">{fmtBytes(file.size)}{dur>0?' · '+fmtTime(Math.round(dur)):''}</div></div>
                :<div><div className="font-bold text-white text-sm">Klik atau drop file audio</div>
                <div className="text-[10px] font-mono text-white/40 mt-1">mp3 · wav · ogg · flac · m4a</div></div>}
            </div>
          </div>

          {/* Mode selector */}
          <div className="panel p-4">
            <div className="card-title mb-3">Mode Bypass &amp; Format</div>
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {MODES.map(m=>
                <button key={m.id} onClick={()=>{setMode(m.id);localStorage.setItem('bms_bp_mode',m.id)}}
                  className={`px-2 py-2 border text-[10px] font-mono text-left transition-colors ${
                    mode===m.id?'border-gold bg-gold/10 text-gold':'border-white/10 bg-jet/30 text-white/60 hover:border-white/20'}`}>
                  <div className="font-bold text-xs">{m.label}</div>
                  <div className="text-[8px] opacity-60">{m.desc}</div>
                </button>
              )}
            </div>
            <div className="flex gap-3 items-center">
              <div className="w-28">
                <label className="text-[9px] font-mono uppercase text-white/40 tracking-wider block mb-1">Format</label>
                <select value={format} onChange={e=>setFormat(e.target.value)} className="input text-xs font-mono">
                  <option value="ogg">OGG</option><option value="mp3">MP3</option><option value="wav">WAV</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-4">
                <input type="checkbox" checked={decoy} onChange={e=>setDecoy(e.target.checked)}
                  className="accent-gold" style={{width:14,height:14}}/>
                <span className="text-[11px] text-white/60">4s Decoy Start</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={processAudio} disabled={loading||!file} className="btn-primary btn flex-1">
              {loading&&loadText.includes('Decod')?'⏳':<UploadCloud size={13}/>} Process
            </button>
            <button onClick={handleUpload} disabled={loading||!previewUrl} className="btn flex-1"
              style={{background:'rgba(16,185,129,0.12)',border:'1px solid rgba(16,185,129,0.3)',color:'#34d399'}}>
              {loading&&loadText.includes('Upload')?'⏳':<Upload size={13}/>} Upload ke Roblox
            </button>
          </div>

          {/* Progress */}
          {loading&&<div className="panel p-3 text-center">
            <div className="h-1 bg-white/5 rounded mb-2 overflow-hidden">
              <div className="h-full bg-gold rounded" style={{width:'100%',animation:'pulse 1.5s infinite'}}/></div>
            <div className="text-[11px] font-mono text-white/50">{loadText}</div>
          </div>}

          {/* Preview player */}
          {previewUrl&&<div className="panel p-3">
            <div className="flex items-center gap-2 mb-2">
              <Music2 size={12} className="text-gold"/>
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Preview — {dur>0?fmtTime(Math.round(dur)):''}</span>
            </div>
            <audio ref={audioRef} controls preload="auto" className="w-full" style={{borderRadius:4}}/>
          </div>}

          {/* Result */}
          {result&&result.assetId&&<div className="panel p-3" style={{borderColor:'rgba(16,185,129,0.3)'}}>
            <div className="text-emerald-400 font-bold text-sm mb-1">✓ Upload Berhasil!</div>
            <div className="text-[11px] font-mono text-white/60">Asset ID: {result.assetId}</div>
            {result.url&&<a href={result.url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-gold text-[11px] mt-2 hover:underline">
              Lihat di Roblox <ExternalLink size={10}/></a>}
          </div>}
          {result&&result.saved&&<div className="text-emerald-400 text-[11px] font-mono">API Key saved!</div>}
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {/* API Key */}
          <div className="panel p-4">
            <div className="card-title flex items-center gap-2">
              <KeyRound size={13} className="text-gold"/> Roblox API Key
              {ak?<StatusBadge variant="success" dot>saved</StatusBadge>
                :<StatusBadge variant="destructive" dot>missing</StatusBadge>}
            </div>
            <div className="mt-3 space-y-2">
              <label className="text-[9px] font-mono uppercase text-white/40 tracking-wider block">API Key</label>
              <div className="flex gap-1.5">
                <input type={showAk?'text':'password'} value={ak}
                  onChange={e=>setAk(e.target.value)} placeholder="rbx_..." className="input text-xs flex-1 min-w-0 font-mono"/>
                <button onClick={()=>setShowAk(s=>!s)} className="btn-ghost btn-xs">
                  {showAk?<EyeOff size={11}/>:<Eye size={11}/>}</button>
              </div>
              <label className="text-[9px] font-mono uppercase text-white/40 tracking-wider block pt-1">User ID</label>
              <input value={uid} onChange={e=>setUid(e.target.value)} placeholder="User ID (pribadi)" className="input text-xs font-mono"/>
              <label className="text-[9px] font-mono uppercase text-white/40 tracking-wider block pt-1">Group ID</label>
              <input value={gid} onChange={e=>setGid(e.target.value)} placeholder="Group ID (upload ke group)" className="input text-xs font-mono"/>
              <button onClick={saveKey} className="btn-primary btn-xs btn-full"><KeyRound size={11}/> Save</button>
            </div>
          </div>

          {/* Info */}
          <div className="panel p-4">
            <div className="card-title flex items-center gap-2"><ShieldAlert size={13} className="text-gold"/> Info</div>
            <div className="mt-2 text-[10px] font-mono text-white/50 space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/>
                <span>Proses 100% client-side (Web Audio API)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gold inline-block"/>
                <span>Upload langsung ke Roblox Open Cloud</span>
              </div>
              <div className="text-white/30 text-[9px] mt-2">Shield/Stealth = metode spektral baru. Ringan s/d Extreme = legacy EQ + MP3 re-encode.</div>
            </div>
          </div>

          {/* Tips */}
          <div className="panel p-4">
            <div className="card-title mb-2">Tips</div>
            <ul className="text-[10px] font-mono text-white/50 space-y-1 list-disc pl-4">
              <li>Buat API Key di create.roblox.com/dashboard/credentials</li>
              <li>Shield/Stealth = subtle, kualitas terjaga</li>
              <li>Extreme = agresif, kualitas turun</li>
              <li>File besar butuh waktu lebih lama di browser</li>
            </ul>
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
    </div>
  )
}

// ===== WAV Encoder =====
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

// ===== MP3 Encoder (lamejs from CDN) =====
let _lameLoaded=false
async function loadLame(){
  if(_lameLoaded||typeof lamejs!=='undefined'){_lameLoaded=true;return}
  return new Promise((res,rej)=>{
    const s=document.createElement('script')
    s.src='https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js'
    s.onload=()=>{_lameLoaded=true;res()}
    s.onerror=()=>rej(new Error('Failed to load MP3 encoder'))
    document.head.appendChild(s)
  })
}

async function encodeMp3Blob(buf,kbps=192){
  await loadLame()
  const nc=Math.min(buf.numberOfChannels,2),sr=buf.sampleRate
  const enc=new lamejs.Mp3Encoder(nc,sr,kbps)
  const left=f32to16(buf.getChannelData(0))
  const right=nc>1?f32to16(buf.getChannelData(1)):left
  const chunks=[];const BLOCK=1152
  for(let i=0;i<left.length;i+=BLOCK){
    const lc=left.subarray(i,i+BLOCK),rc=right.subarray(i,i+BLOCK)
    const e=nc>1?enc.encodeBuffer(lc,rc):enc.encodeBuffer(lc)
    if(e.length)chunks.push(e)
  }
  const t=enc.flush();if(t.length)chunks.push(t)
  return new Blob(chunks,{type:'audio/mpeg'})
}

function f32to16(f32){const o=new Int16Array(f32.length);for(let i=0;i<f32.length;i++){let s=Math.max(-1,Math.min(1,f32[i]||0));o[i]=s<0?s*0x8000:s*0x7fff}return o}

// ===== OGG Encoder (MediaRecorder) =====
async function encodeOggBlob(buf){
  const mime=['audio/ogg;codecs=opus','audio/ogg','audio/webm;codecs=opus'].find(m=>MediaRecorder.isTypeSupported(m))
  if(!mime)throw new Error('OGG/Opus not supported in this browser')
  const ctx=new AudioContext({sampleRate:buf.sampleRate})
  const dest=ctx.createMediaStreamDestination()
  const src=ctx.createBufferSource()
  src.buffer=buf
  src.connect(dest)
  const rec=new MediaRecorder(dest.stream,{mimeType:mime,audioBitsPerSecond:192000})
  const chunks=[]
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}
  const done=new Promise(r=>rec.onstop=r)
  rec.start(100)
  src.start()
  await new Promise(r=>{src.onended=r;setTimeout(r,(buf.duration+1)*1000)})
  rec.stop()
  await done
  await ctx.close()
  const mt=mime.startsWith('audio/webm')?'audio/ogg':mime.split(';')[0]
  return new Blob(chunks,{type:mt})
}
