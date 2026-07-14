import { useRef, useState, useCallback } from "react"
import {
  Upload, UploadCloud, Music2, ExternalLink,
  KeyRound, Eye, EyeOff, ShieldAlert, Download, User, Users, RefreshCw
} from "lucide-react"
import { SectionHead, ErrorBox } from "../components/UI.jsx"
import StatusBadge from "../components/StatusBadge.jsx"
import { fmtBytes, fmtTime } from "../lib/utils.js"

const PF=[40,80,120,200,350,500,800,1200,2000,3000,5000,8000,12000,16000]
const PV=[[0.3,-0.4,0.5,-0.3,0.4,-0.5,0.3,-0.4,0.5,-0.3,0.4,-0.5,0.3,-0.4],
  [-0.4,0.5,-0.3,0.4,-0.5,0.3,-0.4,0.5,-0.3,0.4,-0.5,0.3,-0.4,0.5],
  [0.3,-0.5,0.4,-0.4,0.5,-0.3,0.4,-0.5,0.3,-0.4,0.5,-0.3,0.4,-0.5]]
const TV=[1.0,0.997,1.003]
const MODES=[
  {id:'shield',label:'Shield',desc:'Spektral + noise floor',color:'#d4af37'},
  {id:'stealth',label:'Stealth',desc:'Segment-based variant',color:'#a78bfa'},
  {id:'ringan',label:'Ringan',desc:'EQ notches + tempo',color:'#34d399'},
  {id:'sedang',label:'Sedang',desc:'EQ + phaser',color:'#60a5fa'},
  {id:'berat',label:'Berat',desc:'EQ + phaser + chorus',color:'#fb923c'},
  {id:'extreme',label:'Extreme',desc:'Semua efek + mono',color:'#ef4444'}]
const LG={
  ringan:{eq:[40,2000,14000],g:[-1,-1,-1],tempo:.998,p:0,c:0,m:0},
  sedang:{eq:[40,100,1000,4000,14000],g:[-1.5,-1,-1.5,-1.5,-1],tempo:.995,p:1,c:0,m:0},
  berat:{eq:[30,60,120,500,2000,6000,14000],g:[-2,-1.5,-1.5,-2,-2,-2,-1.5],tempo:.99,p:1,c:1,m:0},
  extreme:{eq:[20,40,80,160,400,1000,3000,8000,16000],g:[-3,-2.5,-2,-2,-2.5,-2.5,-3,-2,-2],tempo:.985,p:1,c:1,m:1}}
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
  const [avatarUrl,setAvatarUrl]=useState('')
  const [avatarErr,setAvatarErr]=useState('')
  const [giconUrl,setGiconUrl]=useState('')
  const [giconErr,setGiconErr]=useState('')
  const [dragOver,setDragOver]=useState(false)
  const fileRef=useRef(null)
  const audioRef=useRef(null)

  async function fetchAvatar(){
    setAvatarUrl('');setAvatarErr('')
    if(!uid.trim()||!/^\d+$/.test(uid.trim())){setAvatarErr('ID tidak valid');return}
    try{
      const r=await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${uid.trim()}&size=150x150&format=Png&isCircular=false`)
      const d=await r.json()
      if(d?.data?.[0]?.imageUrl)setAvatarUrl(d.data[0].imageUrl)
      else if(d?.data?.[0]?.error)setAvatarErr(d.data[0].error||'Not found')
      else setAvatarErr('No data')
    }catch(e){setAvatarErr('Fetch failed:'+(e.message||e))}
  }
  async function fetchGicon(){
    setGiconUrl('');setGiconErr('')
    if(!gid.trim()||!/^\d+$/.test(gid.trim())){setGiconErr('ID tidak valid');return}
    try{
      const r=await fetch(`https://thumbnails.roblox.com/v1/groups/icon?groupIds=${gid.trim()}&size=150x150&format=Png`)
      const d=await r.json()
      if(d?.data?.[0]?.imageUrl)setGiconUrl(d.data[0].imageUrl)
      else if(d?.data?.[0]?.error)setGiconErr(d.data[0].error||'Not found')
      else setGiconErr('No data')
    }catch(e){setGiconErr('Fetch failed:'+(e.message||e))}
  }

  const decodeFile=useCallback(async f=>{
    const b=await f.arrayBuffer();const c=new AudioContext();const a=await c.decodeAudioData(b);await c.close();return a
  },[])

  function makeNoise(l){
    const o=new Float32Array(l);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0
    for(let i=0;i<l;i++){const w=Math.random()*2-1
      b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852
      b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898
      o[i]=b0+b1+b2+b3+b4+b5+b6+w*.5362;b6=w*.115926}
    let mx=0;for(let i=0;i<l;i++){const a=Math.abs(o[i]);if(a>mx)mx=a}
    if(mx>0)for(let i=0;i<l;i++)o[i]/=mx;return o
  }

  function eq(ctx,src,freqs,gains){
    let c=src
    for(let i=0;i<freqs.length;i++){const f=ctx.createBiquadFilter();f.type='peaking';f.frequency.value=freqs[i];f.Q.value=.5;f.gain.value=gains[i];c.connect(f);c=f}
    return c
  }
  function pert(ctx,src,v){return eq(ctx,src,PF,PV[v%PV.length])}
  function phaser(ctx,src){
    const d=ctx.createDelay(1);d.delayTime.value=.005
    const l=ctx.createOscillator();l.frequency.value=.5;const lg=ctx.createGain();lg.gain.value=.005
    l.connect(lg);lg.connect(d.delayTime);l.start()
    const fb=ctx.createGain();fb.gain.value=.3;src.connect(d);d.connect(fb);fb.connect(d);return d
  }
  function chorus(ctx,src){
    const d1=ctx.createDelay(1),d2=ctx.createDelay(1);d1.delayTime.value=.02;d2.delayTime.value=.03
    const l=ctx.createOscillator();l.frequency.value=.3;const lg=ctx.createGain();lg.gain.value=.005
    l.connect(lg);lg.connect(d1.delayTime);lg.connect(d2.delayTime);l.start()
    const dy=ctx.createGain();dy.gain.value=.6;const wt=ctx.createGain();wt.gain.value=.4
    src.connect(dy);src.connect(d1);src.connect(d2);d1.connect(wt);d2.connect(wt)
    const s=ctx.createGain();dy.connect(s);wt.connect(s);return s
  }

  const processAudio=useCallback(async()=>{
    if(!file)return
    setLoading(true);setLoadPct(0);setLoadText('Decoding...');setError('');setPreviewUrl(null);setPreviewDur(0);setResult(null)
    try{
      let buffer=await decodeFile(file);const sr=buffer.sampleRate,ch=buffer.numberOfChannels
      const dm=decoy?4000:0,pad=Math.floor(sr*dm/1000)

      if(mode==='shield'){
        setLoadText('Shield: processing...');setLoadPct(5);await new Promise(r=>setTimeout(r,0))
        const total=buffer.length+pad
        const offline=new OfflineAudioContext(ch,total,sr)
        const nd=makeNoise(Math.max(Math.floor(sr*(buffer.duration+dm/1000)),sr*30))
        const nb=offline.createBuffer(1,nd.length,sr);nb.getChannelData(0).set(nd)
        const ns=offline.createBufferSource();ns.buffer=nb;ns.loop=nd.length<total
        const ng=offline.createGain();ng.gain.value=.001;ns.connect(ng)
        const src=offline.createBufferSource();src.buffer=buffer
        let chain=pert(offline,src,0);await new Promise(r=>setTimeout(r,0));setLoadPct(20)
        const g2=offline.createGain();chain.connect(g2);ng.connect(g2);g2.connect(offline.destination)
        src.start(pad/sr);ns.start(0)
        setLoadText('Shield: rendering...');setLoadPct(40)
        buffer=await offline.startRendering();setLoadPct(70)
      }
      else if(mode==='stealth'){
        setLoadText('Stealth: segments...');setLoadPct(5);await new Promise(r=>setTimeout(r,0))
        const segLen=Math.floor(sr*5),numSegs=Math.ceil(buffer.length/segLen),total=buffer.length+pad
        const offline=new OfflineAudioContext(ch,total,sr)
        const nd=makeNoise(Math.max(Math.floor(sr*(buffer.duration+dm/1000)),sr*30))
        const nb=offline.createBuffer(1,nd.length,sr);nb.getChannelData(0).set(nd)
        const ns=offline.createBufferSource();ns.buffer=nb;ns.loop=nd.length<total
        const ng=offline.createGain();ng.gain.value=.001;ns.connect(ng)
        const ng2=offline.createGain();ng.connect(ng2);ng2.connect(offline.destination);ns.start(0)
        for(let s=0;s<numSegs;s++){
          const st=s*segLen,en=Math.min((s+1)*segLen,buffer.length),ss=en-st
          if(ss<=0)continue
          const seg=offline.createBuffer(ch,ss,sr)
          for(let c=0;c<ch;c++){const sd=buffer.getChannelData(c),dd=seg.getChannelData(c);for(let i=0;i<ss;i++)dd[i]=sd[st+i]||0}
          const segSrc=offline.createBufferSource();segSrc.buffer=seg;const v=s%PV.length
          let chain=pert(offline,segSrc,v)
          const tv=TV[v%TV.length];if(tv!==1.0)segSrc.playbackRate.value=tv
          const gg=offline.createGain();chain.connect(gg);gg.connect(offline.destination)
          segSrc.start((pad+st)/sr)
          setLoadPct(5+Math.round(s/numSegs*50));if(s%5===0)await new Promise(r=>setTimeout(r,0))
        }
        setLoadText('Stealth: rendering...');setLoadPct(55)
        buffer=await offline.startRendering();setLoadPct(70)
      }
      else{
        const cfg=LG[mode];if(!cfg)throw new Error('Unknown mode')
        setLoadText(`${mode}: EQ+effects...`);setLoadPct(5);await new Promise(r=>setTimeout(r,0))
        const ch2=cfg.m?1:ch,total=buffer.length+pad
        const offline=new OfflineAudioContext(ch2,total,sr)
        const src=offline.createBufferSource();src.buffer=buffer
        let chain=src;chain=eq(offline,chain,cfg.eq,cfg.g)
        if(cfg.tempo!==1.0)src.playbackRate.value=cfg.tempo
        if(cfg.p)chain=phaser(offline,chain)
        if(cfg.c)chain=chorus(offline,chain)
        if(cfg.m&&ch>1){const m=offline.createChannelMerger(1);chain.connect(m);chain=m}
        const gg=offline.createGain();chain.connect(gg);gg.connect(offline.destination)
        src.start(pad/sr);await new Promise(r=>setTimeout(r,0));setLoadPct(25)
        let processed=await offline.startRendering();setLoadPct(55)
        const kb=mode==='ringan'?160:mode==='sedang'?128:mode==='berat'?96:64
        setLoadText(`MP3 re-encode ${kb}kbps...`);setLoadPct(65);await new Promise(r=>setTimeout(r,0))
        const mp3=await encodeMp3Blob(processed,kb);const ac2=new AudioContext()
        buffer=await ac2.decodeAudioData((await mp3.arrayBuffer()).slice(0));await ac2.close();setLoadPct(75)
      }

      setLoadText(`Encoding ${format.toUpperCase()}...`);setLoadPct(85);await new Promise(r=>setTimeout(r,0))
      let outBlob
      if(format==='mp3')outBlob=await encodeMp3Blob(buffer,192)
      else if(format==='ogg'){try{outBlob=await encodeOggBlob(buffer)}catch(e){console.warn(e);outBlob=encodeWavBlob(buffer)}}
      else outBlob=encodeWavBlob(buffer)

      setPreviewDur(buffer.duration)
      const url=URL.createObjectURL(outBlob);setPreviewUrl(url)
      if(audioRef.current){audioRef.current.src=url;audioRef.current.load()}
      setLoadPct(100);setLoadText('Selesai!');setLoading(false)
    }catch(e){setError('Error: '+(e.message||e));setLoading(false)}
  },[file,mode,format,decoy,decodeFile])

  const handleUpload=useCallback(async()=>{
    if(!previewUrl){setError('Proses dulu!');return}
    if(!ak){setError('API Key belum diisi!');return}
    if(!uid&&!gid){setError('Isi User ID atau Group ID!');return}
    setLoading(true);setLoadPct(0);setLoadText('Uploading...');setError('');setResult(null)
    try{
      const resp=await fetch(previewUrl);const blob=await resp.blob()
      const name=(dName||file?.name||'Audio').replace(/\.[^.]+$/,'').slice(0,50)
      const fd=new FormData()
      fd.append('request',JSON.stringify({
        displayName:name,description:desc||`Uploaded via BMS Studio — Mode: ${mode}`,
        assetType:'Audio',
        creationContext:{creator:gid.trim()?{groupId:Number(gid)}:{userId:Number(uid)}}
      }))
      fd.append('fileContent',blob,`${name}.${format}`)
      const xhr=new XMLHttpRequest()
      xhr.open('POST','https://apis.roblox.com/assets/v1/assets',true)
      xhr.setRequestHeader('x-api-key',ak)
      xhr.timeout=180000
      xhr.upload.onprogress=e=>{if(e.lengthComputable)setLoadPct(Math.round(10+(e.loaded/e.total)*80))}
      await new Promise((resolve,reject)=>{
        xhr.onload=()=>{
          if(xhr.status>=200&&xhr.status<300){
            let d;try{d=JSON.parse(xhr.responseText)}catch{d={}}
            const id=d.assetId||d.path?.split('/')?.pop()||'?'
            setResult({assetId:id,url:`https://www.roblox.com/library/${id}/`});setLoadPct(100);resolve()
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
  },[previewUrl,ak,uid,gid,file,mode,format,dName,desc])

  function saveAll(){
    localStorage.setItem(SK,ak);localStorage.setItem(UK,uid)
    localStorage.setItem(GK,gid);localStorage.setItem(NK,dName);localStorage.setItem(DK,desc)
    setResult({saved:true});setTimeout(()=>setResult(null),2000)
  }

  function onDragOver(e){e.preventDefault();setDragOver(true)}
  function onDragLeave(){setDragOver(false)}
  function onDrop(e){e.preventDefault();setDragOver(false);if(e.dataTransfer.files?.[0])pickFile(e.dataTransfer.files[0])}
  function pickFile(f){setFile(f);setPreviewUrl(null);setPreviewDur(0);setResult(null);setError('')}

  const mc=MODES.find(m=>m.id===mode)?.color||'#d4af37'

  return (<div className="page-pad" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
    <SectionHead kicker="// studio" title="Bypass Audible Magic"
      sub="Proses audio di browser via Web Audio API, upload ke Roblox. 100% client-side.">
      <StatusBadge variant="gold" dot>Client-side</StatusBadge>
    </SectionHead>

    {error&&<div className="mb-4"><ErrorBox title="Error" message={error}/></div>}

    <div className="grid lg:grid-cols-3 gap-4">
      {/* MAIN */}
      <div className="lg:col-span-2 space-y-4">

        {/* FILE */}
        <div className={`panel p-4 transition-all duration-300 ${dragOver?'scale-[1.01]':''}`}
          style={dragOver?{borderColor:'rgba(212,175,55,0.6)'}:{}}>
          <div className="card-title mb-3">File Audio</div>
          <div className="border-2 border-dashed border-white/10 bg-jet/30 p-8 text-center cursor-pointer
            hover:border-gold/40 hover:bg-gold/5 transition-all duration-300 relative overflow-hidden"
            onClick={()=>fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept="audio/*" className="hidden"
              onChange={e=>e.target.files?.[0]&&pickFile(e.target.files[0])}/>
            <div className="text-3xl mb-2 opacity-40">{file?'🎵':'🎵'}</div>
            {file?<div><div className="font-bold text-white text-sm">{file.name}</div>
              <div className="text-[10px] font-mono text-white/40 mt-1">{fmtBytes(file.size)}</div></div>
              :<div><div className="font-bold text-white text-sm">Klik atau drop file audio</div>
              <div className="text-[10px] font-mono text-white/40 mt-1">mp3 · wav · ogg · flac · m4a</div></div>}
          </div>
        </div>

        {/* NAME + DESC */}
        <div className="panel p-4">
          <div className="card-title mb-3">Info Upload</div>
          <div className="space-y-2">
            <input value={dName} onChange={e=>setDName(e.target.value)} placeholder="Nama lagu (display name)"
              className="input text-sm font-mono"/>
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Deskripsi (opsional)"
              className="input text-xs font-mono" rows={2}/>
          </div>
        </div>

        {/* MODE */}
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
              <span className="text-[11px] text-white/60">Decoy Start (4s)</span>
            </label>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex gap-3">
          <button onClick={processAudio} disabled={loading||!file}
            className="btn-primary btn flex-1">{loading&&loadText!=='Selesai!'?'⏳':<UploadCloud size={13}/>} Process</button>
          <button onClick={handleUpload} disabled={loading||!previewUrl} className="btn flex-1"
            style={{background:'rgba(16,185,129,0.12)',border:'1px solid rgba(16,185,129,0.3)',color:'#34d399'}}>
            {loading&&loadText==='Uploading...'?'⏳':<Upload size={13}/>} Upload</button>
        </div>

        {loading&&<div className="panel p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono text-white/50">{loadText}</span>
            <span className="text-[10px] font-mono text-gold">{loadPct}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500 ease-out"
              style={{width:`${loadPct}%`,background:`linear-gradient(90deg,${mc},#f0d68a)`}}/>
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
              <Download size={10}/> Download</a>
          </div>
          <audio ref={audioRef} controls preload="auto" className="w-full rounded"/>
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
        {result&&result.saved&&<div className="text-emerald-400 text-[11px] font-mono">Disimpan!</div>}
      </div>

      {/* SIDEBAR */}
      <div className="space-y-3">

        {/* AVATAR / GROUP */}
        <div className="panel p-4">
          <div className="card-title mb-3">Roblox Preview</div>
          <div className="flex gap-3 mb-2">
            <div className="flex-1 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-jet border border-white/10 overflow-hidden flex items-center justify-center text-white/20 transition-all duration-300"
                style={avatarUrl?{boxShadow:'0 0 20px rgba(212,175,55,0.2)'}:{}}>
                {avatarUrl?<img src={avatarUrl} alt="" className="w-full h-full object-cover"/>
                  :<User size={24}/>}
              </div>
              <div className="text-[9px] font-mono text-white/40 mt-1">User</div>
              {avatarErr&&<div className="text-[8px] font-mono text-red-400">{avatarErr}</div>}
            </div>
            <div className="flex-1 text-center">
              <div className="w-16 h-16 mx-auto rounded-lg bg-jet border border-white/10 overflow-hidden flex items-center justify-center text-white/20 transition-all duration-300"
                style={giconUrl?{boxShadow:'0 0 20px rgba(212,175,55,0.2)'}:{}}>
                {giconUrl?<img src={giconUrl} alt="" className="w-full h-full object-cover"/>
                  :<Users size={24}/>}
              </div>
              <div className="text-[9px] font-mono text-white/40 mt-1">Group</div>
              {giconErr&&<div className="text-[8px] font-mono text-red-400">{giconErr}</div>}
            </div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={fetchAvatar} className="btn-ghost btn-xs flex-1"><RefreshCw size={10}/> Ambil Avatar</button>
            <button onClick={fetchGicon} className="btn-ghost btn-xs flex-1"><RefreshCw size={10}/> Ambil Group</button>
          </div>
        </div>

        {/* API KEY */}
        <div className="panel p-4">
          <div className="card-title flex items-center gap-2 mb-3">
            <KeyRound size={13} className="text-gold"/> Roblox API
            {ak?<StatusBadge variant="success" dot/>:<StatusBadge variant="destructive" dot/>}
          </div>
          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              <input type={showAk?'text':'password'} value={ak} onChange={e=>setAk(e.target.value)}
                placeholder="API Key" className="input text-xs flex-1 font-mono"/>
              <button onClick={()=>setShowAk(s=>!s)} className="btn-ghost btn-xs">
                {showAk?<EyeOff size={11}/>:<Eye size={11}/>}</button>
            </div>
            <input value={uid} onChange={e=>setUid(e.target.value)} placeholder="User ID" className="input text-xs font-mono"/>
            <input value={gid} onChange={e=>setGid(e.target.value)} placeholder="Group ID" className="input text-xs font-mono"/>
            <button onClick={saveAll} className="btn-primary btn-xs btn-full"><KeyRound size={11}/> Simpan Semua</button>
          </div>
        </div>

        {/* INFO */}
        <div className="panel p-4">
          <div className="card-title flex items-center gap-2 mb-2"><ShieldAlert size={13} className="text-gold"/> Info</div>
          <div className="text-[10px] font-mono text-white/50 leading-relaxed">
            <div className="flex items-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-emerald-400"/>100% client-side</div>
            <div className="flex items-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-gold"/>Upload via Roblox Open Cloud</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gold"/>Avatar/group dari Roblox API</div>
          </div>
        </div>
      </div>
    </div>
  </div>)
}

function encodeWavBlob(buf){
  const nc=buf.numberOfChannels,sr=buf.sampleRate,len=buf.length,ba=nc*2,byr=sr*ba,ds=len*ba
  const ab=new ArrayBuffer(44+ds),v=new DataView(ab);let p=0
  const ws=s=>{for(let i=0;i<s.length;i++)v.setUint8(p++,s.charCodeAt(i))}
  ws('RIFF');v.setUint32(p,36+ds,true);p+=4;ws('WAVE');ws('fmt ');v.setUint32(p,16,true);p+=4
  v.setUint16(p,1,true);p+=2;v.setUint16(p,nc,true);p+=2;v.setUint32(p,sr,true);p+=4;v.setUint32(p,byr,true);p+=4
  v.setUint16(p,ba,true);p+=2;v.setUint16(p,16,true);p+=2;ws('data');v.setUint32(p,ds,true);p+=4
  const chs=[];for(let c=0;c<nc;c++)chs.push(buf.getChannelData(c))
  for(let i=0;i<len;i++){for(let c=0;c<nc;c++){let s=Math.max(-1,Math.min(1,chs[c][i]||0));v.setInt16(p,s<0?s*0x8000:s*0x7fff,true);p+=2}}
  return new Blob([ab],{type:'audio/wav'})
}
let _lm=0
async function loadLame(){if(_lm||typeof lamejs!=='undefined'){_lm=1;return}
  return new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js'
    s.onload=()=>{_lm=1;res()};s.onerror=()=>rej(new Error('load lamejs failed'));document.head.appendChild(s)})}
async function encodeMp3Blob(buf,kbps=192){
  await loadLame();const nc=Math.min(buf.numberOfChannels,2),sr=buf.sampleRate
  const enc=new lamejs.Mp3Encoder(nc,sr,kbps)
  const l=f32(buf.getChannelData(0)),r=nc>1?f32(buf.getChannelData(1)):l
  const ch=[];const B=1152
  for(let i=0;i<l.length;i+=B){const lc=l.subarray(i,i+B),rc=r.subarray(i,i+B);const e=nc>1?enc.encodeBuffer(lc,rc):enc.encodeBuffer(lc);if(e.length)ch.push(e)}
  const t=enc.flush();if(t.length)ch.push(t);return new Blob(ch,{type:'audio/mpeg'})}
function f32(f32){const o=new Int16Array(f32.length);for(let i=0;i<f32.length;i++){let s=Math.max(-1,Math.min(1,f32[i]||0));o[i]=s<0?s*0x8000:s*0x7fff}return o}
async function encodeOggBlob(buf){
  const m=['audio/ogg;codecs=opus','audio/ogg','audio/webm;codecs=opus'].find(m=>MediaRecorder.isTypeSupported(m))
  if(!m)throw new Error('OGG not supported')
  const ctx=new AudioContext({sampleRate:buf.sampleRate});const dest=ctx.createMediaStreamDestination()
  const src=ctx.createBufferSource();src.buffer=buf;src.connect(dest)
  const rec=new MediaRecorder(dest.stream,{mimeType:m,audioBitsPerSecond:192000})
  const ch=[];rec.ondataavailable=e=>{if(e.data.size)ch.push(e.data)}
  const done=new Promise(r=>rec.onstop=r);rec.start(100);src.start()
  await new Promise(r=>{src.onended=r;setTimeout(r,(buf.duration+1)*1000)})
  rec.stop();await done;await ctx.close()
  return new Blob(ch,{type:m.startsWith('audio/webm')?'audio/ogg':m.split(';')[0]})}
