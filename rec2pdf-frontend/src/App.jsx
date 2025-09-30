import React, { useEffect, useRef, useState } from "react";
import { Mic, Square, Settings, Folder, FileText, Cpu, Download, Timer as TimerIcon, Waves, CheckCircle2, AlertCircle, Link as LinkIcon, Upload, RefreshCw, Bug, XCircle, Info, Maximize } from "lucide-react";
import logo from './assets/logo.svg';

function classNames(...xs) { return xs.filter(Boolean).join(" "); }
const fmtBytes = (bytes) => { if (!bytes && bytes !== 0) return "—"; const u=["B","KB","MB","GB"]; let i=0,v=bytes; while(v>=1024&&i<u.length-1){v/=1024;i++;} return `${v.toFixed(v<10&&i>0?1:0)} ${u[i]}`; };
const fmtTime = (s) => { const h=Math.floor(s/3600); const m=Math.floor((s%3600)/60); const sec=Math.floor(s%60); return [h,m,sec].map(n=>String(n).padStart(2,'0')).join(":"); };
const isLikelySecure = () => { if (typeof window!=="undefined" && window.isSecureContext) return true; const h=typeof window!=="undefined"?window.location.hostname:""; return h==='localhost'||h==='127.0.0.1'||h.endsWith('.localhost'); };
const pickBestMime = () => { const c=["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus","audio/ogg","audio/mp4"]; for (const m of c) if (typeof MediaRecorder!=="undefined"&&MediaRecorder.isTypeSupported?.(m)) return m; return undefined; };

const themes = {
  zinc: {
    bg: "from-zinc-950 via-zinc-900 to-zinc-950",
    card: "bg-zinc-900/50 border-zinc-800",
    input: "bg-zinc-900/60 border-zinc-800",
    input_hover: "hover:bg-zinc-800/60",
    button: "bg-zinc-800 hover:bg-zinc-700 border-zinc-700",
    log: "bg-black/40 border-black/40",
  },
  slate: {
    bg: "from-slate-950 via-slate-900 to-slate-950",
    card: "bg-slate-900/50 border-slate-800",
    input: "bg-slate-900/60 border-slate-800",
    input_hover: "hover:bg-slate-800/60",
    button: "bg-slate-800 hover:bg-slate-700 border-slate-700",
    log: "bg-black/40 border-black/40",
  },
  consulting: {
    bg: "from-gray-900 via-slate-900 to-gray-900",
    card: "bg-white/5 border-white/10",
    input: "bg-white/10 border-white/20",
    input_hover: "hover:bg-white/20",
    button: "bg-slate-700 hover:bg-slate-600 border-slate-600",
    log: "bg-white/5 border-white/10",
  }
};

export default function Rec2PdfApp(){
  const [recording,setRecording]=useState(false);
  const [elapsed,setElapsed]=useState(0);
  const [level,setLevel]=useState(0);
  const [secureOK,setSecureOK]=useState(isLikelySecure());
  const [mediaSupported]=useState(!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia));
  const [recorderSupported]=useState(typeof MediaRecorder!=='undefined');
  const [permission,setPermission]=useState('unknown');
  const [permissionMessage,setPermissionMessage]=useState("");
  const [lastMicError,setLastMicError]=useState(null);
  const [devices,setDevices]=useState([]);
  const [selectedDeviceId,setSelectedDeviceId]=useState("");
  const [audioBlob,setAudioBlob]=useState(null);
  const [audioUrl,setAudioUrl]=useState("");
  const [mime,setMime]=useState("");
  const [destDir,setDestDir]=useState("/Users/tuo_utente/Recordings");
  const [slug,setSlug]=useState("meeting");
  const [secondsCap,setSecondsCap]=useState(0);
  const [backendUrl,setBackendUrl]=useState("http://localhost:7788");
  const [backendUp,setBackendUp]=useState(null);
  const [busy,setBusy]=useState(false);
  const [logs,setLogs]=useState([]);
  const [pdfPath,setPdfPath]=useState("");
  const [errorBanner,setErrorBanner]=useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'zinc');
  const [showDestDetails,setShowDestDetails]=useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [customLogo, setCustomLogo] = useState(null);
  const [customPdfLogo, setCustomPdfLogo] = useState(null);

  const mediaRecorderRef=useRef(null);
  const chunksRef=useRef([]);
  const startAtRef=useRef(null);
  const rafRef=useRef(null);
  const analyserRef=useRef(null);
  const audioCtxRef=useRef(null);
  const sourceRef=useRef(null);
  const streamRef=useRef(null);
  const fileInputRef=useRef(null);

  useEffect(()=>{
    const savedLogo = localStorage.getItem('customLogo');
    if (savedLogo) {
      setCustomLogo(savedLogo);
    }
  }, []);

  useEffect(() => {
    if (customLogo) {
      localStorage.setItem('customLogo', customLogo);
    } else {
      localStorage.removeItem('customLogo');
    }
  }, [customLogo]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(()=>{ let alive=true; (async()=>{ try{ const r=await fetch(`${backendUrl}/api/health`,{cache:'no-store'}); if(!alive)return; setBackendUp(r.ok);}catch{ if(!alive)return; setBackendUp(false);} })(); return()=>{alive=false}; },[backendUrl,busy]);
  useEffect(()=>{ setSecureOK(isLikelySecure()); },[]);
  useEffect(()=>{ let cancelled=false; (async()=>{ if(!navigator.permissions||!mediaSupported){ setPermission('unknown'); return;}
 try{ const p=await navigator.permissions.query({name:'microphone'}); if(cancelled)return; setPermission(p.state||'unknown'); p.onchange=()=>setPermission(p.state||'unknown'); }catch{ setPermission('unknown'); } })(); return()=>{cancelled=true}; },[mediaSupported]);
  useEffect(()=>{ if(!recording) return; const id=setInterval(()=>setElapsed(Math.floor((Date.now()-startAtRef.current)/1000)),333); return()=>clearInterval(id); },[recording]);

  const startAnalyser=async(stream)=>{ if(audioCtxRef.current) return; const C=window.AudioContext||window.webkitAudioContext; if(!C) return; const ctx=new C(); const src=ctx.createMediaStreamSource(stream); const analyser=ctx.createAnalyser(); analyser.fftSize=2048; src.connect(analyser); const data=new Uint8Array(analyser.frequencyBinCount); const loop=()=>{ analyser.getByteTimeDomainData(data); let sum=0; for(let i=0;i<data.length;i++){ const v=(data[i]-128)/128; sum+=v*v; } const rms=Math.sqrt(sum/data.length); setLevel(rms); rafRef.current=requestAnimationFrame(loop); }; loop(); analyserRef.current=analyser; audioCtxRef.current=ctx; sourceRef.current=src; };
  const stopAnalyser=()=>{ if(rafRef.current) cancelAnimationFrame(rafRef.current); try{ sourceRef.current&&sourceRef.current.disconnect(); }catch{} try{ analyserRef.current&&analyserRef.current.disconnect(); }catch{} try{ audioCtxRef.current&&audioCtxRef.current.close(); }catch{} rafRef.current=null; analyserRef.current=null; audioCtxRef.current=null; sourceRef.current=null; setLevel(0); };

  const refreshDevices=async()=>{ try{ const list=await navigator.mediaDevices?.enumerateDevices?.(); const mics=(list||[]).filter(d=>d.kind==='audioinput'); setDevices(mics.map(d=>({deviceId:d.deviceId,label:d.label||'Microfono'}))); if(!selectedDeviceId&&mics[0]) setSelectedDeviceId(mics[0].deviceId); }catch{} };

  const requestMic=async()=>{ setPermissionMessage(""); setLastMicError(null); if(!secureOK){ setPermissionMessage("Il microfono richiede HTTPS oppure localhost."); return false;} if(!mediaSupported){ setPermissionMessage("Browser senza getUserMedia."); return false;} try{ const stream=await navigator.mediaDevices.getUserMedia({audio:true}); stream.getTracks().forEach(t=>t.stop()); setPermission('granted'); setPermissionMessage("Permesso microfono concesso."); await refreshDevices(); return true; }catch(e){ const name=e?.name||""; const msg=e?.message||String(e); setLastMicError({name,message:msg}); if(name==='NotAllowedError'||name==='SecurityError'){ setPermission('denied'); setPermissionMessage("Accesso al microfono negato. Abilitalo dalle impostazioni del sito (icona lucchetto) e riprova."); } else if(name==='NotFoundError'||name==='OverconstrainedError'){ setPermission('denied'); setPermissionMessage("Nessun microfono rilevato o vincoli non soddisfatti."); } else if(name==='NotReadableError'){ setPermission('denied'); setPermissionMessage("Il microfono è occupato da un'altra app (Zoom/Teams/OBS). Chiudila e riprova."); } else if(name==='AbortError'){ setPermission('prompt'); setPermissionMessage("Richiesta annullata. Riprova e accetta il prompt del browser."); } else { setPermission('unknown'); setPermissionMessage(`Impossibile accedere al microfono: ${msg}`);} return false; } };

  const startRecording=async()=>{ setLogs([]); setPdfPath(""); setAudioBlob(null); setAudioUrl(""); setPermissionMessage(""); setErrorBanner(null); if(!recorderSupported){ setPermissionMessage("MediaRecorder non supportato. Usa il caricamento file."); return;} if(permission!=='granted'){ const ok=await requestMic(); if(!ok) return;} try{ const constraints=selectedDeviceId?{deviceId:{exact:selectedDeviceId}}:true; const stream=await navigator.mediaDevices.getUserMedia({audio:constraints}); streamRef.current=stream; const mimeType=pickBestMime(); const rec=new MediaRecorder(stream,mimeType?{mimeType}:{}); chunksRef.current=[]; rec.ondataavailable=(e)=>{ if(e.data&&e.data.size) chunksRef.current.push(e.data); }; rec.onstop=()=>{ const blob=new Blob(chunksRef.current,{type:rec.mimeType||mimeType||'audio/webm'}); const url=URL.createObjectURL(blob); setAudioBlob(blob); setAudioUrl(url); setMime(rec.mimeType||mimeType||'audio/webm'); stopAnalyser(); stream.getTracks().forEach(t=>t.stop()); streamRef.current=null; }; mediaRecorderRef.current=rec; await startAnalyser(stream); rec.start(250); startAtRef.current=Date.now(); setElapsed(0); setRecording(true); }catch(e){ const name=e?.name||""; const msg=e?.message||String(e); setLastMicError({name,message:msg}); if(name==='NotAllowedError'){ setPermission('denied'); setPermissionMessage("Permesso negato. Abilita il microfono dalle impostazioni del sito e riprova."); } else if(name==='NotFoundError'||name==='OverconstrainedError'){ setPermission('denied'); setPermissionMessage("Nessun microfono disponibile o vincoli non validi."); } else if(name==='NotReadableError'){ setPermission('denied'); setPermissionMessage("Il microfono è occupato da un'altra app. Chiudi Zoom/Teams/OBS e riprova."); } else if(!secureOK){ setPermission('denied'); setPermissionMessage("Serve HTTPS o localhost per usare il microfono."); } else { setPermission('unknown'); setPermissionMessage(`Errore: ${msg}`);} } };

  const stopRecording=()=>{ const rec=mediaRecorderRef.current; if(rec&&rec.state!=="inactive") rec.stop(); setRecording(false); };
  useEffect(()=>{ if(recording&&secondsCap&&elapsed>=secondsCap) stopRecording(); },[recording,secondsCap,elapsed]);
  const resetAll=()=>{ setAudioBlob(null); setAudioUrl(""); setMime(""); setElapsed(0); setLogs([]); setPdfPath(""); setPermissionMessage(""); setErrorBanner(null); };

  const fetchBody=async(url,opts)=>{
    try{
      const r=await fetch(url,opts);
      const ct=r.headers.get('content-type')||"";
      const raw=await r.text();
      let data=null;
      if(ct.includes('application/json')){
        try{ data=raw?JSON.parse(raw):null; }catch{}
      }
      return {ok:r.ok,status:r.status,data,raw,contentType:ct};
    }catch(e){
      return {ok:false,status:0,data:null,raw:"",contentType:"",error:e};
    }
  };
  const pushLogs=(arr)=>setLogs(ls=>ls.concat((arr||[]).filter(Boolean)));

  const processViaBackend=async(customBlob)=>{
    const blob=customBlob||audioBlob;
    if(!blob) return;
    if(!backendUrl){
      setErrorBanner({title:'Backend URL mancante',details:'Imposta http://localhost:7788 o il tuo endpoint.'});
      return;
    }
    setBusy(true);
    setLogs([]);
    setPdfPath("");
    setErrorBanner(null);
    try{
      const fd=new FormData();
      const m=(mime||blob.type||"").toLowerCase();
      const ext=m.includes('webm')?'webm':m.includes('ogg')?'ogg':m.includes('wav')?'wav':'m4a';
      fd.append('audio',blob,`recording.${ext}`);
      if (customPdfLogo) {
        fd.append('pdfLogo', customPdfLogo);
      }
      const isPlaceholder = !destDir.trim() || destDir.includes('tuo_utente');
      if (!isPlaceholder) {
        fd.append('dest',destDir);
      } else {
        pushLogs(["ℹ️ Cartella destinazione non specificata o segnaposto: il backend userà la sua cartella predefinita."]);
      }
      fd.append('slug',slug||'meeting');
      const cap=Number(secondsCap||0);
      if(cap>0) fd.append('seconds',String(cap));
      const {ok,status,data,raw}=await fetchBody(`${backendUrl}/api/rec2pdf`,{method:'POST',body:fd});
      if(!ok){
        if(data?.logs?.length) pushLogs(data.logs);
        if(data?.message) pushLogs([`❌ ${data.message}`]);
        if(!data&&raw) pushLogs([`❌ Risposta server: ${raw.slice(0,400)}${raw.length>400?'…':''}`]);
        pushLogs([`Errore backend: HTTP ${status||'0 (rete)'}`]);
        setErrorBanner({title:`Errore backend (HTTP ${status||'0'})`,details:data?.message||(raw?raw.slice(0,400):(status===0?'Connessione fallita/CORS':'Errore sconosciuto'))});
        return;
      }
      if(data?.logs) pushLogs(data.logs);
      if(data?.pdfPath) setPdfPath(data.pdfPath);
      else pushLogs(["⚠️ Risposta senza pdfPath."]);
    } finally{
      setBusy(false);
    }
  };

  const runDiagnostics=async()=>{ setBusy(true); setLogs([]); setErrorBanner(null); try{ const {ok,status,data,raw}=await fetchBody(`${backendUrl}/api/diag`,{method:'GET'}); if(data?.logs?.length) pushLogs(data.logs); if(!ok){ pushLogs([`❌ Diagnostica fallita (HTTP ${status||'0'})`]); if(!data&&raw) pushLogs([raw.slice(0,400)]); setErrorBanner({title:`Diagnostica fallita (HTTP ${status||'0'})`,details:data?.message||raw||'Errore rete/CORS'}); } else { pushLogs([data?.ok?'✅ Ambiente OK':'❌ Ambiente con problemi']); } } finally{ setBusy(false); } };

  const onPickFile=(e)=>{ const f=e.target.files?.[0]; if(!f) return; setAudioBlob(f); setAudioUrl(URL.createObjectURL(f)); setMime(f.type||""); setErrorBanner(null); };

  const cycleTheme = () => {
    const themeKeys = Object.keys(themes);
    const currentIndex = themeKeys.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themeKeys.length;
    setTheme(themeKeys[nextIndex]);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const PermissionBanner=()=>{
    const ua=navigator.userAgent||"";
    const isChromium = ua.includes('Chrome/') && !ua.includes('Edg/') && !ua.includes('OPR/');
    const isEdge = ua.includes('Edg/');
    const isBrave = isChromium && ua.includes('Brave/');
    const site=encodeURIComponent(location.origin);
    const chromeSiteSettings=`chrome://settings/content/siteDetails?site=${site}`;
    const chromeMicSettings=`chrome://settings/content/microphone`;
    return (
      <div className="mt-3 text-sm bg-amber-950/40 border border-amber-900/40 rounded-xl p-3 text-amber-200">
        <div className="font-medium">Permesso microfono necessario</div>
        {permissionMessage&&<div className="mt-1 text-amber-100">{permissionMessage}</div>}
        {lastMicError&&(
          <div className="mt-1 text-amber-100">
            Dettagli ultimo errore: <code className="text-amber-100">{lastMicError.name}</code>
            {lastMicError.message?`: ${lastMicError.message}`:''}
          </div>
        )}
        <ul className="list-disc pl-5 mt-2 space-y-1">
          {!secureOK&&<li>Servi l'app in HTTPS o usa <code>http://localhost</code>.</li>}
          <li>Quando il browser chiede il permesso, scegli <strong>Consenti</strong>.</li>
          <li>Se in passato hai negato il permesso, apri le impostazioni del sito (icona lucchetto → Permessi) e abilita il microfono.</li>
          <li>Su macOS: Sistema → Privacy e Sicurezza → Microfono → abilita il browser.</li>
          {(isChromium||isEdge||isBrave)&&(
            <li className="mt-1 space-x-3">
              <a href={chromeSiteSettings} className="underline" target="_blank" rel="noreferrer">Apri permessi sito</a>
              <a href={chromeMicSettings} className="underline" target="_blank" rel="noreferrer">Apri impostazioni microfono</a>
            </li>
          )}
        </ul>
      </div>
    );
  };

  const ErrorBanner=()=>(!errorBanner?null:(
    <div className="mt-4 bg-rose-950/40 border border-rose-900/50 text-rose-100 rounded-xl p-3 text-sm flex items-start gap-3">
      <XCircle className="w-5 h-5 mt-0.5"/>
      <div className="flex-1">
        <div className="font-medium">{errorBanner.title}</div>
        {errorBanner.details&&<div className="text-rose-200/90 whitespace-pre-wrap mt-1">{errorBanner.details}</div>}
      </div>
      <button onClick={()=> setErrorBanner(null)} className="text-rose-200/80 hover:text-rose-100 text-xs">Chiudi</button>
    </div>
  ));

  const SettingsPanel = () => {
    const logoInputRef = useRef(null);
    const pdfLogoInputRef = useRef(null);

    const handleLogoUpload = (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setCustomLogo(e.target.result);
        };
        reader.readAsDataURL(file);
      }
    };

    const handlePdfLogoUpload = (event) => {
      const file = event.target.files[0];
      if (file) {
        setCustomPdfLogo(file);
      }
    };

    return (
      <div className={classNames("p-4 mt-4 rounded-2xl border", themes[theme].card)}>
        <h3 className="text-lg font-medium">Impostazioni</h3>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-zinc-400">Tema</label>
            <button onClick={cycleTheme} className={classNames("w-full mt-2 px-3 py-2 rounded-xl text-sm border", themes[theme].input, themes[theme].input_hover)}>
              Cycle Theme ({theme})
            </button>
          </div>
          <div>
            <label className="text-sm text-zinc-400">Logo Frontend</label>
            <div className="flex items-center gap-2 mt-2">
              <input type="file" accept="image/*" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" />
              <button onClick={() => logoInputRef.current.click()} className={classNames("px-3 py-2 rounded-xl text-sm", themes[theme].button)}>
                Carica
              </button>
              {customLogo && (
                <button onClick={() => setCustomLogo(null)} className={classNames("px-3 py-2 rounded-xl text-sm bg-rose-600 hover:bg-rose-500")}>
                  Rimuovi
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm text-zinc-400">Logo per PDF</label>
            <div className="flex items-center gap-2 mt-2">
              <input type="file" accept=".pdf,.svg,.png,.jpg" ref={pdfLogoInputRef} onChange={handlePdfLogoUpload} className="hidden" />
              <button onClick={() => pdfLogoInputRef.current.click()} className={classNames("px-3 py-2 rounded-xl text-sm", themes[theme].button)}>
                Carica
              </button>
              {customPdfLogo && (
                <button onClick={() => setCustomPdfLogo(null)} className={classNames("px-3 py-2 rounded-xl text-sm bg-rose-600 hover:bg-rose-500")}>
                  Rimuovi
                </button>
              )}
            </div>
            {customPdfLogo && <div className="text-xs text-zinc-400 mt-1 truncate">{customPdfLogo.name}</div>}
          </div>
        </div>
        <div className="mt-4">
          <label className="text-sm text-zinc-400">Anteprima Logo Frontend</label>
          <div className={classNames("mt-2 p-4 rounded-xl flex items-center justify-center", themes[theme].input)}>
            <img src={customLogo || logo} alt="Logo Preview" style={{ maxHeight: '60px', maxWidth: '200px' }} />
          </div>
        </div>
      </div>
    );
  };

  const defaultDest="/Users/tuo_utente/Recordings";
  const destIsPlaceholder=!destDir.trim()||destDir===defaultDest||destDir.includes('tuo_utente');

  const pdfDownloadUrl = pdfPath ? `${backendUrl}/api/file?path=${encodeURIComponent(pdfPath)}` : '';

  return (
    <div className={classNames("min-h-screen w-full","bg-gradient-to-b", themes[theme].bg,"text-zinc-100")}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <img src={customLogo || logo} alt="ThinkDoc Logo" style={{ width: '200px', height: '60px' }} />
          </div>
          <div className="flex items-center gap-2">
            <span className={classNames("inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm", backendUp?"bg-emerald-950 text-emerald-300":backendUp===false?"bg-rose-950 text-rose-300":"bg-zinc-800 text-zinc-300")}>{backendUp?<><CheckCircle2 className="w-4 h-4"/> Backend OK</>:backendUp===false?<><AlertCircle className="w-4 h-4"/> Backend OFF</>:<>—</>}
            </span>
            <div className={classNames("flex items-center gap-2 rounded-xl px-3 py-2 border", themes[theme].input)}><LinkIcon className="w-4 h-4 text-zinc-400"/><input value={backendUrl} onChange={e=>setBackendUrl(e.target.value)} placeholder="http://localhost:7788" className="bg-transparent outline-none text-sm w-[220px]"/></div>
            <button onClick={runDiagnostics} className={classNames("px-3 py-2 rounded-xl text-sm flex items-center gap-2 border", themes[theme].input, themes[theme].input_hover)}><Bug className="w-4 h-4"/> Diagnostica</button>
            <button onClick={() => setShowSettings(!showSettings)} className={classNames("p-2 rounded-xl text-sm border", themes[theme].input, themes[theme].input_hover)}>
              <Settings className="w-4 h-4"/>
            </button>
            <button onClick={toggleFullScreen} className={classNames("p-2 rounded-xl text-sm border", themes[theme].input, themes[theme].input_hover)}>
              <Maximize className="w-4 h-4"/>
            </button>
          </div>
        </div>
        {showSettings && <SettingsPanel />} 
        {!secureOK&&(<div className="mt-4 bg-rose-950/40 border border-rose-900/40 text-rose-200 rounded-xl p-3 text-sm">⚠️ Per accedere al microfono serve HTTPS (o localhost in sviluppo).</div>)}
        <ErrorBanner/>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className={classNames("md:col-span-2 rounded-2xl p-6 shadow-lg border", themes[theme].card)}>
            <div className="flex items-center justify-between"><h2 className="text-xl font-medium flex items-center gap-2"><Mic className="w-5 h-5"/> Registrazione</h2><div className="text-sm text-zinc-400 flex items-center gap-2"><TimerIcon className="w-4 h-4"/> {fmtTime(elapsed)}</div></div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <button onClick={requestMic} className={classNames("px-4 py-2 rounded-xl text-sm border", themes[theme].button)}>Concedi microfono</button>
              <div className="text-sm text-zinc-400">Permesso: <span className="font-mono">{permission}</span></div>
              <button onClick={refreshDevices} className={classNames("px-3 py-2 rounded-xl text-sm flex items-center gap-2 border", themes[theme].button)}><RefreshCw className="w-4 h-4"/> Dispositivi</button>
            </div>
            {permission!=='granted'&&<PermissionBanner/>}
            {permission==='granted'&&devices.length>0&&(
              <div className="mt-4"><label className="text-sm text-zinc-400">Sorgente microfono</label><select value={selectedDeviceId} onChange={(e)=>setSelectedDeviceId(e.target.value)} className={classNames("mt-2 w-full rounded-lg px-3 py-2 border bg-transparent", themes[theme].input)}>{devices.map((d,i)=>(<option key={d.deviceId||i} value={d.deviceId} className="bg-zinc-900">{d.label||`Dispositivo ${i+1}`}</option>))}</select></div>
            )}
            <div className="mt-4 flex items-center justify-center">
              <button onClick={recording?stopRecording:startRecording} className={classNames("w-40 h-40 rounded-full flex items-center justify-center text-lg font-semibold transition shadow-xl", recording?"bg-rose-600 hover:bg-rose-500":"bg-emerald-600 hover:bg-emerald-500")} disabled={busy||!mediaSupported||!recorderSupported} title={!mediaSupported?"getUserMedia non supportato":!recorderSupported?"MediaRecorder non supportato":""}>{recording?<div className="flex flex-col items-center gap-2"><Square className="w-8 h-8"/> Stop</div>:<div className="flex flex-col items-center gap-2"><Mic className="w-8 h-8"/> Rec</div>}</button>
            </div>
            <div className="mt-6"><div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300" style={{width:`${Math.min(100,Math.round(level*120))}%`}}/></div><div className="text-xs text-zinc-500 mt-1">Input level</div></div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={classNames("rounded-xl p-4 border", themes[theme].input)}>
              <div className="flex items-center justify-between">
                <label className="text-sm text-zinc-400 flex items-center gap-2"><Folder className="w-4 h-4"/> Cartella destinazione</label>
                <button onClick={()=>setShowDestDetails(!showDestDetails)} className="text-zinc-400 hover:text-zinc-200"><Info className="w-4 h-4"/></button>
              </div>
              <input className={classNames("w-full mt-2 bg-transparent border rounded-lg px-3 py-2 outline-none", destIsPlaceholder?"border-rose-600":themes[theme].input)} value={destDir} onChange={e=>setDestDir(e.target.value)} placeholder="/Users/tuo_utente/Recordings"/>
              {showDestDetails && <div className={classNames("text-xs mt-2", destIsPlaceholder?"text-rose-400":"text-zinc-500")}>{destIsPlaceholder?"Sostituisci \"tuo_utente\" con il tuo username macOS oppure lascia vuoto per usare la cartella predefinita del backend.":"Lascia vuoto per usare la cartella predefinita del backend."}</div>}
            </div>
              <div className={classNames("rounded-xl p-4 border", themes[theme].input)}><label className="text-sm text-zinc-400 flex items-center gap-2"><FileText className="w-4 h-4"/> Slug</label><input className="w-full mt-2 bg-transparent border-zinc-800 rounded-lg px-3 py-2 outline-none" value={slug} onChange={e=>setSlug(e.target.value)} placeholder="meeting"/></div>
              <div className={classNames("rounded-xl p-4 border", themes[theme].input)}><label className="text-sm text-zinc-400 flex items-center gap-2"><TimerIcon className="w-4 h-4"/> Durata massima (s)</label><input type="number" min={0} className="w-full mt-2 bg-transparent border-zinc-800 rounded-lg px-3 py-2 outline-none" value={secondsCap} onChange={e=>setSecondsCap(Math.max(0, parseInt(e.target.value||"0",10) || 0))}/><div className="text-xs text-zinc-500 mt-2">0 = senza limite</div></div>
            </div>
            <div className={classNames("mt-6 rounded-xl p-4 border", themes[theme].input)}>
              <div className="flex items-center justify-between"><div className="text-sm text-zinc-400">Clip registrata / caricata</div><div className="text-xs text-zinc-500">{mime||"—"} · {fmtBytes(audioBlob?.size)}</div></div>
              <div className="mt-3">{audioUrl?<audio controls src={audioUrl} className="w-full"/>:<div className="text-zinc-500 text-sm">Nessuna clip disponibile.</div>}</div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button onClick={()=>processViaBackend()} disabled={!audioBlob||busy||backendUp===false} className={classNames("px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium flex items-center gap-2",(!audioBlob||busy||backendUp===false)&&"opacity-60 cursor-not-allowed")}> <Cpu className="w-4 h-4"/> Avvia pipeline</button>
                <a href={audioUrl} download={`recording.${((mime||"").includes("webm")?"webm":(mime||"").includes("ogg")?"ogg":(mime||"").includes("wav")?"wav":"m4a")}`} className={classNames("px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2", themes[theme].button, !audioUrl&&"pointer-events-none opacity-50")}> <Download className="w-4 h-4"/> Scarica audio</a>
                <button onClick={resetAll} className={classNames("px-4 py-2 rounded-lg text-sm", themes[theme].button)}>Reset</button>
              </div>
            </div>
            <div className={classNames("mt-4 rounded-xl p-4 border", themes[theme].input)}>
              <div className="flex items-center gap-2 text-sm text-zinc-400"><Upload className="w-4 h-4"/> Carica un file audio (fallback)</div>
              <div className="mt-2 flex items-center gap-2"><input ref={fileInputRef} type="file" accept="audio/*" onChange={onPickFile} className="text-sm"/><button onClick={()=>processViaBackend(audioBlob)} disabled={!audioBlob||busy||backendUp===false} className={classNames("px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm",(!audioBlob||busy||backendUp===false)&&"opacity-60 cursor-not-allowed")}>Invia</button></div>
              <div className="text-xs text-zinc-500 mt-1">Supporta formati comuni (webm/ogg/m4a/wav). Verrà convertito in WAV lato server.</div>
            </div>
          </div>
          <div className="md:col-span-1 flex flex-col gap-6">
            <div className={classNames("rounded-2xl p-5 shadow-lg border", themes[theme].card)}><div className="flex items-center justify-between"><h3 className="text-lg font-medium flex items-center gap-2"><Settings className="w-4 h-4"/> Stato</h3></div><div className="mt-4 text-sm text-zinc-300 space-y-1"><div className="flex items-center gap-2"><span className={classNames("w-2 h-2 rounded-full",secureOK?"bg-emerald-500":"bg-rose-500")}/> HTTPS/localhost: {secureOK?"OK":"Richiesto"}</div><div className="flex items-center gap-2"><span className={classNames("w-2 h-2 rounded-full",mediaSupported?"bg-emerald-500":"bg-rose-500")}/> getUserMedia: {mediaSupported?"Supportato":"No"}</div><div className="flex items-center gap-2"><span className={classNames("w-2 h-2 rounded-full",recorderSupported?"bg-emerald-500":"bg-rose-500")}/> MediaRecorder: {recorderSupported?"Supportato":"No"}</div><div className="flex items-center gap-2"><span className={classNames("w-2 h-2 rounded-full",backendUp?"bg-emerald-500":"bg-rose-500")}/> Backend: {backendUp===null?"—":backendUp?"Online":"Offline"}</div><div className="flex items-center gap-2"><span className={classNames("w-2 h-2 rounded-full",busy?"bg-yellow-400":"bg-zinc-600")}/> Pipeline: {busy?"In esecuzione…":"Pronta"}</div></div></div>
            <div className={classNames("rounded-2xl p-5 shadow-lg border", themes[theme].card)}><h3 className="text-lg font-medium flex items-center gap-2"><FileText className="w-4 h-4"/> DOC</h3><div className="mt-3 text-sm">{busy && (<div><div className="text-zinc-400">Creazione PDF in corso...</div><div className="w-full bg-zinc-700 rounded-full h-2.5 mt-2 overflow-hidden"><div className="h-2.5 rounded-full progress-bar-animated"></div></div></div>)}{pdfPath?(<div className={classNames("rounded-lg p-3 break-all border", themes[theme].input)}><div className="text-zinc-400">PDF creato:</div><div className="text-emerald-300 font-mono text-xs mt-1">{pdfPath}</div><div className="mt-2 flex items-center gap-2"><a href={pdfDownloadUrl} className={classNames("px-3 py-2 rounded-lg text-xs", themes[theme].button)} target="_blank" rel="noreferrer">Apri/Scarica PDF</a></div></div>):(!busy && <div className="text-zinc-500">Nessun file ancora creato.</div>)}</div></div>
            <div className={classNames("rounded-2xl p-5 shadow-lg border", themes[theme].card)}><h3 className="text-lg font-medium flex items-center gap-2"><Cpu className="w-4 h-4"/> Log</h3><div className={classNames("mt-3 h-56 overflow-auto rounded-lg p-3 font-mono text-xs text-zinc-300 border", themes[theme].log)}>{logs?.length?logs.map((ln,i)=>(<div key={i} className="whitespace-pre-wrap leading-relaxed">{ln}</div>)):<div className="text-zinc-500">Nessun log ancora.</div>}</div></div>
          </div>
        </div>
        <div className="mt-10 text-xs text-zinc-500"><p>Assicurati che il backend sia attivo su http://localhost:7788 e che ffmpeg e la toolchain siano configurati nella shell di esecuzione.</p></div>
      </div>
    </div>
  );
}