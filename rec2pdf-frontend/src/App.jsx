import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square, Settings, Folder, FileText, Cpu, Download, TimerIcon, Waves, CheckCircle2, AlertCircle, LinkIcon, Upload, RefreshCw, Bug, XCircle, Info, Maximize, Sparkles, Plus, Users } from "./components/icons";
import logo from './assets/logo.svg';
import SetupAssistant from "./components/SetupAssistant";
import { useMicrophoneAccess } from "./hooks/useMicrophoneAccess";
import { useBackendDiagnostics } from "./hooks/useBackendDiagnostics";
import { classNames } from "./utils/classNames";
import { pickBestMime } from "./utils/media";
import WorkspaceNavigator from "./components/WorkspaceNavigator";
import MarkdownEditorModal from "./components/MarkdownEditorModal";

const fmtBytes = (bytes) => { if (!bytes && bytes !== 0) return "—"; const u=["B","KB","MB","GB"]; let i=0,v=bytes; while(v>=1024&&i<u.length-1){v/=1024;i++;} return `${v.toFixed(v<10&&i>0?1:0)} ${u[i]}`; };
const fmtTime = (s) => { const h=Math.floor(s/3600); const m=Math.floor((s%3600)/60); const sec=Math.floor(s%60); return [h,m,sec].map(n=>String(n).padStart(2,'0')).join(":"); };
const HISTORY_STORAGE_KEY = 'rec2pdfHistory';
const HISTORY_LIMIT = 100;
const WORKSPACE_SELECTION_KEY = 'rec2pdfWorkspaceSelection';
const WORKSPACE_FILTERS_KEY = 'rec2pdfWorkspaceFilters';
const DEFAULT_WORKSPACE_STATUSES = ['Bozza', 'In lavorazione', 'Da revisionare', 'Completato'];
const EMPTY_EDITOR_STATE = {
  open: false,
  entry: null,
  path: '',
  backendUrl: '',
  content: '',
  originalContent: '',
  loading: false,
  saving: false,
  error: '',
  success: '',
};

const normalizeBackendUrlValue = (url) => {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

const deriveMarkdownPath = (mdPath, pdfPath) => {
  const candidate = (mdPath || '').trim();
  if (candidate) return candidate;
  if (pdfPath && /\.pdf$/i.test(pdfPath)) {
    return pdfPath.replace(/\.pdf$/i, '.md');
  }
  return '';
};

const buildFileUrl = (backendUrl, filePath) => {
  const normalized = normalizeBackendUrlValue(backendUrl);
  if (!normalized || !filePath) return '';
  return `${normalized}/api/file?path=${encodeURIComponent(filePath)}`;
};

const normalizeWorkspaceEntry = (workspace) => {
  if (!workspace || typeof workspace !== 'object') {
    return null;
  }
  const statusCatalog = Array.isArray(workspace.statusCatalog)
    ? workspace.statusCatalog.filter(Boolean)
    : [];
  return {
    id: workspace.id || '',
    name: workspace.name || workspace.client || 'Workspace',
    client: workspace.client || workspace.name || '',
    color: workspace.color || '#6366f1',
    projectId: workspace.projectId || '',
    projectName: workspace.projectName || '',
    projectColor: workspace.projectColor || workspace.color || '#6366f1',
    status: workspace.status || '',
    statusCatalog,
    versioningPolicy: workspace.versioningPolicy || null,
  };
};

const normalizeStructureMeta = (structure) => {
  if (!structure || typeof structure !== 'object') {
    return null;
  }
  const score = Number.isFinite(structure.score)
    ? Math.min(100, Math.max(0, Number(structure.score)))
    : null;
  return {
    ok: structure.ok !== false,
    score,
    headings: Array.isArray(structure.headings) ? structure.headings : [],
    missingSections: Array.isArray(structure.missingSections) ? structure.missingSections : [],
    totalRecommended: Number.isFinite(structure.totalRecommended) ? Number(structure.totalRecommended) : null,
    bulletPoints: Number.isFinite(structure.bulletPoints) ? Number(structure.bulletPoints) : null,
    hasCallouts: Boolean(structure.hasCallouts),
    wordCount: Number.isFinite(structure.wordCount) ? Number(structure.wordCount) : null,
    error: structure.error || '',
  };
};

const hydrateHistoryEntry = (entry) => {
  if (!entry) return null;
  const pdfPath = entry.pdfPath || '';
  const mdPath = deriveMarkdownPath(entry.mdPath, pdfPath);
  const backendUrl = normalizeBackendUrlValue(entry.backendUrl || '');
  const pdfUrl = entry.pdfUrl || buildFileUrl(backendUrl, pdfPath);
  const mdUrl = entry.mdUrl || buildFileUrl(backendUrl, mdPath);
  const workspace = normalizeWorkspaceEntry(entry.workspace);
  const structure = normalizeStructureMeta(entry.structure);

  return {
    ...entry,
    id: entry.id ?? Date.now(),
    pdfPath,
    mdPath,
    backendUrl,
    pdfUrl,
    mdUrl,
    tags: Array.isArray(entry?.tags) ? entry.tags : [],
    logs: Array.isArray(entry?.logs) ? entry.logs : [],
    stageEvents: Array.isArray(entry?.stageEvents) ? entry.stageEvents : [],
    workspace,
    structure,
    completenessScore: structure?.score ?? null,
  };
};

const PIPELINE_STAGES = [
  {
    key: 'upload',
    label: 'Upload audio',
    description: 'Caricamento e validazione del file di input.',
    help: 'Verifica che il file audio sia selezionato e che il browser abbia i permessi per l\'upload.',
    icon: Upload,
  },
  {
    key: 'transcode',
    label: 'Transcodifica WAV',
    description: 'Conversione in WAV 16k mono tramite ffmpeg.',
    help: 'Assicurati che ffmpeg sia installato e accessibile nel PATH del backend.',
    icon: Cpu,
  },
  {
    key: 'transcribe',
    label: 'Trascrizione Whisper',
    description: 'Generazione testo con Whisper small in italiano.',
    help: 'Controlla modello Whisper e risorse GPU/CPU sul backend.',
    icon: Waves,
  },
  {
    key: 'markdown',
    label: 'Sintesi Markdown',
    description: 'Creazione note tramite genMD.',
    help: 'Verifica che la funzione genMD sia definita nello shell del backend.',
    icon: FileText,
  },
  {
    key: 'publish',
    label: 'Impaginazione PDF',
    description: 'Impaginazione con PPUBR/pandoc e applicazione logo.',
    help: 'Controlla PPUBR/pandoc e i permessi di scrittura sulla cartella di destinazione.',
    icon: Sparkles,
  },
  {
    key: 'complete',
    label: 'Pipeline conclusa',
    description: 'Conferma finale della pipeline.',
    help: '',
    icon: CheckCircle2,
  },
];

const buildInitialPipelineStatus = (initial = 'idle') => {
  return PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.key] = initial;
    return acc;
  }, {});
};

const normalizeStageStatus = (status) => {
  const value = String(status || '').toLowerCase();
  if (['completed', 'done', 'success'].includes(value)) return 'done';
  if (['running', 'in_progress', 'started'].includes(value)) return 'running';
  if (['failed', 'error', 'ko', 'failure'].includes(value)) return 'failed';
  if (['pending', 'queued', 'waiting'].includes(value)) return 'pending';
  if (!value) return 'info';
  return value;
};

const updateStatusWithEvent = (prevStatus, event) => {
  if (!event?.stage || !Object.prototype.hasOwnProperty.call(prevStatus, event.stage)) {
    return prevStatus;
  }
  const next = { ...prevStatus };
  const normalized = normalizeStageStatus(event.status);
  if (normalized === 'done') {
    next[event.stage] = 'done';
  } else if (normalized === 'running') {
    next[event.stage] = 'running';
  } else if (normalized === 'failed') {
    next[event.stage] = 'failed';
  } else if (normalized === 'pending') {
    next[event.stage] = 'pending';
  } else if (normalized !== 'info') {
    next[event.stage] = normalized;
  }

  if (normalized === 'running' || normalized === 'done') {
    const stageIndex = PIPELINE_STAGES.findIndex((stage) => stage.key === event.stage);
    if (stageIndex > 0) {
      for (let i = 0; i < stageIndex; i += 1) {
        const prevKey = PIPELINE_STAGES[i].key;
        if (next[prevKey] === 'pending' || next[prevKey] === 'idle' || next[prevKey] === 'running') {
          next[prevKey] = 'done';
        }
      }
    }
  }

  return next;
};

const STAGE_STATUS_LABELS = {
  idle: 'In attesa',
  pending: 'In coda',
  running: 'In corso',
  done: 'Completato',
  failed: 'Errore',
  info: 'Info',
};

const STAGE_STATUS_STYLES = {
  idle: 'border-zinc-800 bg-zinc-950 text-zinc-500',
  pending: 'border-zinc-700 bg-zinc-900 text-zinc-300',
  running: 'border-indigo-500/60 bg-indigo-500/15 text-indigo-100',
  done: 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200',
  failed: 'border-rose-500/60 bg-rose-500/10 text-rose-200',
  info: 'border-zinc-700 bg-zinc-900 text-zinc-400',
};

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
  const [audioBlob,setAudioBlob]=useState(null);
  const [audioUrl,setAudioUrl]=useState("");
  const [mime,setMime]=useState("");
  const [destDir,setDestDir]=useState("/Users/tuo_utente/Recordings");
  const [slug,setSlug]=useState("meeting");
  const [secondsCap,setSecondsCap]=useState(0);
  const [backendUrl,setBackendUrl]=useState("http://localhost:7788");
  const [busy,setBusy]=useState(false);
  const [logs,setLogs]=useState([]);
  const [pdfPath,setPdfPath]=useState("");
  const [mdPath, setMdPath] = useState("");
  const [errorBanner,setErrorBanner]=useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'zinc');
  const [showDestDetails,setShowDestDetails]=useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [customLogo, setCustomLogo] = useState(null);
  const [customPdfLogo, setCustomPdfLogo] = useState(null);
  const [lastMarkdownUpload,setLastMarkdownUpload]=useState(null);
  const [history, setHistory] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((entry) => hydrateHistoryEntry(entry)).filter(Boolean);
    } catch {
      return [];
    }
  });
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceSelection, setWorkspaceSelection] = useState(() => {
    if (typeof window === 'undefined') {
      return { workspaceId: '', projectId: '', projectName: '', status: '' };
    }
    try {
      const raw = localStorage.getItem(WORKSPACE_SELECTION_KEY);
      if (!raw) {
        return { workspaceId: '', projectId: '', projectName: '', status: '' };
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return { workspaceId: '', projectId: '', projectName: '', status: '' };
      }
      return {
        workspaceId: parsed.workspaceId || '',
        projectId: parsed.projectId || '',
        projectName: parsed.projectName || '',
        status: parsed.status || '',
      };
    } catch {
      return { workspaceId: '', projectId: '', projectName: '', status: '' };
    }
  });
  const [savedWorkspaceFilters, setSavedWorkspaceFilters] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(WORKSPACE_FILTERS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const now = Date.now();
      return parsed.map((item, index) => ({
        id: item?.id || now + index,
        name: item?.name || `Filtro ${index + 1}`,
        workspaceId: item?.workspaceId || '',
        projectId: item?.projectId || '',
        projectName: item?.projectName || '',
        status: item?.status || '',
        search: item?.search || '',
      }));
    } catch {
      return [];
    }
  });
  const [navigatorSelection, setNavigatorSelection] = useState(() => ({
    workspaceId: '',
    projectId: '',
    projectName: '',
    status: '',
  }));
  const [workspaceBuilderOpen, setWorkspaceBuilderOpen] = useState(false);
  const [workspaceBuilder, setWorkspaceBuilder] = useState({
    name: '',
    client: '',
    color: '#6366f1',
    statuses: DEFAULT_WORKSPACE_STATUSES.join(', '),
  });
  const [projectDraft, setProjectDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState('');
  const [projectCreationMode, setProjectCreationMode] = useState(false);
  const [statusCreationMode, setStatusCreationMode] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState(() => buildInitialPipelineStatus('idle'));
  const [activeStageKey, setActiveStageKey] = useState(null);
  const [stageMessages, setStageMessages] = useState({});
  const [showRawLogs, setShowRawLogs] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('');
  const [activePanel, setActivePanel] = useState('doc');
  const [mdEditor, setMdEditor] = useState(() => ({ ...EMPTY_EDITOR_STATE }));
  const {
    secureOK,
    mediaSupported,
    recorderSupported,
    permission,
    setPermission,
    permissionMessage,
    setPermissionMessage,
    lastMicError,
    setLastMicError,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    refreshDevices,
    requestPermission,
  } = useMicrophoneAccess();
  const {
    backendUp,
    setBackendUp,
    checkHealth,
    checkingHealth,
    diagnostics,
    runDiagnostics: runBackendDiagnostics,
    fetchBody,
  } = useBackendDiagnostics(backendUrl);
  const [onboardingComplete, setOnboardingComplete] = useState(() => localStorage.getItem('onboardingComplete') === 'true');
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('onboardingComplete'));
  const [onboardingStep, setOnboardingStep] = useState(0);

  const mediaRecorderRef=useRef(null);
  const chunksRef=useRef([]);
  const startAtRef=useRef(null);
  const rafRef=useRef(null);
  const analyserRef=useRef(null);
  const audioCtxRef=useRef(null);
  const sourceRef=useRef(null);
  const streamRef=useRef(null);
  const fileInputRef=useRef(null);
  const markdownInputRef=useRef(null);
  const stageAnimationTimeoutsRef = useRef([]);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // ignore persistence errors (quota, privacy modes, ...)
    }
  }, [history]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(WORKSPACE_SELECTION_KEY, JSON.stringify(workspaceSelection));
    } catch {
      // Ignore persistence errors
    }
  }, [workspaceSelection]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(WORKSPACE_FILTERS_KEY, JSON.stringify(savedWorkspaceFilters));
    } catch {
      // Ignore persistence errors
    }
  }, [savedWorkspaceFilters]);

  useEffect(() => {
    if (!workspaceSelection.workspaceId) return;
    const exists = workspaces.some((workspace) => workspace.id === workspaceSelection.workspaceId);
    if (!exists) {
      setWorkspaceSelection({ workspaceId: '', projectId: '', projectName: '', status: '' });
    }
  }, [workspaces, workspaceSelection.workspaceId]);

  useEffect(() => {
    if (!navigatorSelection.workspaceId || navigatorSelection.workspaceId === '__unassigned__') return;
    const exists = workspaces.some((workspace) => workspace.id === navigatorSelection.workspaceId);
    if (!exists) {
      setNavigatorSelection((prev) => ({ ...prev, workspaceId: '', projectId: '', projectName: '', status: '' }));
    }
  }, [workspaces, navigatorSelection.workspaceId]);

  useEffect(() => {
    setNavigatorSelection((prev) => {
      if (prev.workspaceId || !workspaceSelection.workspaceId) {
        return prev;
      }
      return {
        workspaceId: workspaceSelection.workspaceId,
        projectId: workspaceSelection.projectId || '',
        projectName: workspaceSelection.projectName || '',
        status: workspaceSelection.status || '',
      };
    });
  }, [workspaceSelection.workspaceId, workspaceSelection.projectId, workspaceSelection.status]);

  useEffect(() => {
    fetchWorkspaces({ silent: true });
  }, [fetchWorkspaces]);

  const clearStageAnimationTimers = useCallback(() => {
    stageAnimationTimeoutsRef.current.forEach(clearTimeout);
    stageAnimationTimeoutsRef.current = [];
  }, []);

  const resetPipelineProgress = useCallback((isRunning = false) => {
    clearStageAnimationTimers();
    setStageMessages({});
    if (isRunning) {
      const base = buildInitialPipelineStatus('pending');
      const firstStageKey = PIPELINE_STAGES[0]?.key;
      if (firstStageKey) {
        base[firstStageKey] = 'running';
      }
      setPipelineStatus(base);
      setActiveStageKey(PIPELINE_STAGES[0]?.key ?? null);
    } else {
      setPipelineStatus(buildInitialPipelineStatus('idle'));
      setActiveStageKey(null);
    }
  }, [clearStageAnimationTimers]);

  const runEventUpdate = useCallback((event) => {
    if (!event || !event.stage) return;
    const normalizedStatus = normalizeStageStatus(event.status);
    const normalizedEvent = { ...event, status: normalizedStatus };
    setPipelineStatus((prev) => updateStatusWithEvent(prev, normalizedEvent));
    if (event.message) {
      setStageMessages((prev) => ({ ...prev, [event.stage]: event.message }));
    }
    setActiveStageKey((prev) => {
      if (normalizedStatus === 'running') return event.stage;
      if (normalizedStatus === 'failed') return event.stage;
      if (normalizedStatus === 'done') {
        const currentIndex = PIPELINE_STAGES.findIndex((stage) => stage.key === event.stage);
        const nextStage = PIPELINE_STAGES[currentIndex + 1];
        return nextStage ? nextStage.key : null;
      }
      return prev;
    });
  }, []);

  const handlePipelineEvents = useCallback((events = [], options = {}) => {
    const eventArray = Array.isArray(events) ? events : [];
    clearStageAnimationTimers();
    setStageMessages({});

    const initialStatus = options?.initialStatus ?? (eventArray.length ? 'pending' : 'idle');
    const baseStatus = buildInitialPipelineStatus(initialStatus);
    if (eventArray.length && initialStatus !== 'idle') {
      const firstKey = PIPELINE_STAGES[0]?.key;
      if (firstKey) {
        baseStatus[firstKey] = 'running';
      }
    }
    setPipelineStatus(baseStatus);
    setActiveStageKey(eventArray.length ? PIPELINE_STAGES[0]?.key ?? null : null);

    if (!eventArray.length) {
      if (!eventArray.length && initialStatus === 'idle') {
        setActiveStageKey(null);
      }
      return;
    }

    if (options?.autoRevealOnFailure !== false) {
      const hasFailure = eventArray.some((evt) => normalizeStageStatus(evt.status) === 'failed');
      if (hasFailure) {
        setShowRawLogs(true);
      }
    }

    let delay = 0;
    const stepDelay = options?.stepDelayMs ?? 500;
    eventArray.forEach((event) => {
      const normalizedEvent = { ...event, status: normalizeStageStatus(event.status) };
      const runner = () => runEventUpdate(normalizedEvent);
      if (options?.animate === false) {
        runner();
      } else {
        const timeoutId = setTimeout(runner, delay);
        stageAnimationTimeoutsRef.current.push(timeoutId);
        delay += stepDelay;
      }
    });
  }, [clearStageAnimationTimers, runEventUpdate]);

  useEffect(() => {
    return () => {
      clearStageAnimationTimers();
    };
  }, [clearStageAnimationTimers]);

  useEffect(()=>{ checkHealth(); },[backendUrl,busy,checkHealth]);
  useEffect(()=>{ if(!recording) return; const id=setInterval(()=>setElapsed(Math.floor((Date.now()-startAtRef.current)/1000)),333); return()=>clearInterval(id); },[recording]);

  const startAnalyser=async(stream)=>{ if(audioCtxRef.current) return; const C=window.AudioContext||window.webkitAudioContext; if(!C) return; const ctx=new C(); const src=ctx.createMediaStreamSource(stream); const analyser=ctx.createAnalyser(); analyser.fftSize=2048; src.connect(analyser); const data=new Uint8Array(analyser.frequencyBinCount); const loop=()=>{ analyser.getByteTimeDomainData(data); let sum=0; for(let i=0;i<data.length;i++){ const v=(data[i]-128)/128; sum+=v*v; } const rms=Math.sqrt(sum/data.length); setLevel(rms); rafRef.current=requestAnimationFrame(loop); }; loop(); analyserRef.current=analyser; audioCtxRef.current=ctx; sourceRef.current=src; };
  const stopAnalyser=()=>{ if(rafRef.current) cancelAnimationFrame(rafRef.current); try{ sourceRef.current&&sourceRef.current.disconnect(); }catch{} try{ analyserRef.current&&analyserRef.current.disconnect(); }catch{} try{ audioCtxRef.current&&audioCtxRef.current.close(); }catch{} rafRef.current=null; analyserRef.current=null; audioCtxRef.current=null; sourceRef.current=null; setLevel(0); };

  const startRecording=async()=>{ setLogs([]); setPdfPath(""); setAudioBlob(null); setAudioUrl(""); setPermissionMessage(""); setErrorBanner(null); if(!recorderSupported){ setPermissionMessage("MediaRecorder non supportato. Usa il caricamento file."); return;} if(permission!=='granted'){ const ok=await requestPermission(); if(!ok) return;} try{ const constraints=selectedDeviceId?{deviceId:{exact:selectedDeviceId}}:true; const stream=await navigator.mediaDevices.getUserMedia({audio:constraints}); streamRef.current=stream; const mimeType=pickBestMime(); const rec=new MediaRecorder(stream,mimeType?{mimeType}:{}); chunksRef.current=[]; rec.ondataavailable=(e)=>{ if(e.data&&e.data.size) chunksRef.current.push(e.data); }; rec.onstop=()=>{ const blob=new Blob(chunksRef.current,{type:rec.mimeType||mimeType||'audio/webm'}); const url=URL.createObjectURL(blob); setAudioBlob(blob); setAudioUrl(url); setMime(rec.mimeType||mimeType||'audio/webm'); stopAnalyser(); stream.getTracks().forEach(t=>t.stop()); streamRef.current=null; }; mediaRecorderRef.current=rec; await startAnalyser(stream); rec.start(250); startAtRef.current=Date.now(); setElapsed(0); setRecording(true); }catch(e){ const name=e?.name||""; const msg=e?.message||String(e); setLastMicError({name,message:msg}); if(name==='NotAllowedError'){ setPermission('denied'); setPermissionMessage("Permesso negato. Abilita il microfono dalle impostazioni del sito e riprova."); } else if(name==='NotFoundError'||name==='OverconstrainedError'){ setPermission('denied'); setPermissionMessage("Nessun microfono disponibile o vincoli non validi."); } else if(name==='NotReadableError'){ setPermission('denied'); setPermissionMessage("Il microfono è occupato da un'altra app. Chiudi Zoom/Teams/OBS e riprova."); } else if(!secureOK){ setPermission('denied'); setPermissionMessage("Serve HTTPS o localhost per usare il microfono."); } else { setPermission('unknown'); setPermissionMessage(`Errore: ${msg}`);} } };

  const stopRecording=()=>{ const rec=mediaRecorderRef.current; if(rec&&rec.state!=="inactive") rec.stop(); setRecording(false); };
  useEffect(()=>{ if(recording&&secondsCap&&elapsed>=secondsCap) stopRecording(); },[recording,secondsCap,elapsed]);
  const resetAll=()=>{ setAudioBlob(null); setAudioUrl(""); setMime(""); setElapsed(0); setLogs([]); setPdfPath(""); setMdPath(""); setPermissionMessage(""); setErrorBanner(null); resetPipelineProgress(false); setShowRawLogs(false); setLastMarkdownUpload(null); };

  const pushLogs=useCallback((arr)=>{ setLogs(ls=>ls.concat((arr||[]).filter(Boolean))); },[]);

  const fetchWorkspaces = useCallback(
    async (options = {}) => {
      const normalized = normalizeBackendUrlValue(options.backendUrlOverride || backendUrl);
      if (!normalized) {
        if (!options?.silent) {
          setWorkspaces([]);
        }
        return { ok: false, status: 0, message: 'Backend non configurato', skipped: true };
      }
      setWorkspaceLoading(true);
      try {
        const result = await fetchBody(`${normalized}/api/workspaces`, { method: 'GET' });
        if (result.ok && Array.isArray(result.data?.workspaces)) {
          setWorkspaces(result.data.workspaces);
        } else if (!result.ok && !options?.silent) {
          const message = result.data?.message || result.raw || 'Impossibile caricare i workspace.';
          pushLogs([`⚠️ API workspace: ${message}`]);
        }
        return result;
      } catch (error) {
        if (!options?.silent) {
          pushLogs([`⚠️ Errore workspace: ${error?.message || String(error)}`]);
        }
        return { ok: false, status: 0, error };
      } finally {
        setWorkspaceLoading(false);
      }
    },
    [backendUrl, fetchBody, pushLogs]
  );

  const handleCreateWorkspace = useCallback(
    async ({ name, client, color, statuses }) => {
      const normalized = normalizeBackendUrlValue(backendUrl);
      if (!normalized) {
        const message = 'Configura un backend valido per creare workspace.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const sanitizedName = String(name || '').trim();
      if (!sanitizedName) {
        const message = 'Il nome del workspace è obbligatorio.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const statusArray = Array.isArray(statuses)
        ? statuses.filter(Boolean)
        : typeof statuses === 'string'
        ? statuses
            .split(',')
            .map((chunk) => chunk.trim())
            .filter(Boolean)
        : [];
      try {
        const response = await fetch(`${normalized}/api/workspaces`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: sanitizedName,
            client: String(client || sanitizedName).trim(),
            color: color || '#6366f1',
            defaultStatuses: statusArray.length ? statusArray : undefined,
          }),
        });
        let payload = {};
        try {
          payload = await response.json();
        } catch {
          payload = {};
        }
        if (!response.ok) {
          const message = payload?.message || `Creazione workspace fallita (HTTP ${response.status})`;
          pushLogs([`❌ ${message}`]);
          return { ok: false, message };
        }
        if (payload?.workspace) {
          setWorkspaces((prev) => [...prev, payload.workspace]);
          pushLogs([`✅ Workspace creato: ${payload.workspace.name}`]);
          if (!workspaceSelection.workspaceId) {
            setWorkspaceSelection({ workspaceId: payload.workspace.id, projectId: '', projectName: '', status: '' });
          }
        }
        return { ok: true, workspace: payload.workspace };
      } catch (error) {
        const message = error?.message || 'Errore creazione workspace';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
    },
    [backendUrl, pushLogs, workspaceSelection.workspaceId]
  );

  const handleEnsureWorkspaceProject = useCallback(
    async (workspaceId, { projectId, projectName, status } = {}) => {
      if (!workspaceId) {
        return { ok: false, message: 'Workspace mancante' };
      }
      const normalized = normalizeBackendUrlValue(backendUrl);
      if (!normalized) {
        const message = 'Configura un backend valido per aggiornare i workspace.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }

      const ensureWorkspaceAvailable = async () => {
        let target = workspaces.find((ws) => ws.id === workspaceId);
        if (!target) {
          const refreshed = await fetchWorkspaces({ silent: true });
          if (Array.isArray(refreshed?.data?.workspaces)) {
            target = refreshed.data.workspaces.find((ws) => ws.id === workspaceId) || null;
          }
        }
        return target;
      };

      const targetWorkspace = await ensureWorkspaceAvailable();
      if (!targetWorkspace) {
        const message = 'Workspace non trovato sul backend.';
        pushLogs([`⚠️ ${message}`]);
        return { ok: false, message };
      }

      const projectNameTrimmed = String(projectName || '').trim();
      const projectIdTrimmed = String(projectId || '').trim();
      const statusTrimmed = String(status || '').trim();

      if (!projectNameTrimmed && !projectIdTrimmed && !statusTrimmed) {
        return { ok: true, workspace: targetWorkspace, updated: false };
      }

      const projects = Array.isArray(targetWorkspace.projects)
        ? targetWorkspace.projects.map((proj) => ({
            ...proj,
            statuses: Array.isArray(proj.statuses) ? [...proj.statuses] : [],
          }))
        : [];

      let existingProject = null;
      if (projectIdTrimmed) {
        existingProject = projects.find((proj) => proj.id === projectIdTrimmed) || null;
      }
      if (!existingProject && projectNameTrimmed) {
        existingProject = projects.find(
          (proj) => proj.name && proj.name.toLowerCase() === projectNameTrimmed.toLowerCase()
        ) || null;
      }

      let changed = false;

      if (!existingProject && projectNameTrimmed) {
        const defaultStatuses = Array.isArray(targetWorkspace.defaultStatuses) && targetWorkspace.defaultStatuses.length
          ? targetWorkspace.defaultStatuses
          : DEFAULT_WORKSPACE_STATUSES;
        existingProject = {
          id: projectIdTrimmed || `proj_${Date.now()}`,
          name: projectNameTrimmed,
          color: targetWorkspace.color || '#6366f1',
          statuses: statusTrimmed ? [statusTrimmed] : [...defaultStatuses],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        projects.push(existingProject);
        changed = true;
      } else if (existingProject && statusTrimmed && !existingProject.statuses.includes(statusTrimmed)) {
        existingProject.statuses = [...existingProject.statuses, statusTrimmed];
        existingProject.updatedAt = Date.now();
        changed = true;
      }

      if (!changed) {
        return { ok: true, workspace: targetWorkspace, updated: false };
      }

      try {
        const response = await fetch(`${normalized}/api/workspaces/${workspaceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projects }),
        });
        let payload = {};
        try {
          payload = await response.json();
        } catch {
          payload = {};
        }
        if (!response.ok) {
          const message = payload?.message || `Aggiornamento workspace fallito (HTTP ${response.status})`;
          pushLogs([`❌ ${message}`]);
          return { ok: false, message };
        }
        if (payload?.workspace) {
          setWorkspaces((prev) => prev.map((ws) => (ws.id === workspaceId ? payload.workspace : ws)));
        }
        return { ok: true, workspace: payload.workspace || targetWorkspace, updated: true };
      } catch (error) {
        const message = error?.message || 'Errore aggiornamento workspace';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
    },
    [backendUrl, workspaces, fetchWorkspaces, pushLogs]
  );

  const handleAssignEntryWorkspace = useCallback(
    async (entry, assignment, options = {}) => {
      if (!entry) return;
      setHistory((prev) =>
        prev.map((item) => (item.id === entry.id ? hydrateHistoryEntry({ ...item, workspace: assignment }) : item))
      );
      if (options.ensureMetadata && assignment?.id) {
        await handleEnsureWorkspaceProject(assignment.id, {
          projectId: assignment.projectId,
          projectName: assignment.projectName,
          status: assignment.status,
        });
        fetchWorkspaces({ silent: true });
      }
    },
    [handleEnsureWorkspaceProject, fetchWorkspaces]
  );

  const fetchEntryPreview = useCallback(
    async (entry) => {
      if (!entry) {
        return { ok: false, message: 'Nessun documento selezionato.' };
      }
      const mdPathResolved = deriveMarkdownPath(entry?.mdPath, entry?.pdfPath);
      if (!mdPathResolved) {
        return { ok: false, message: 'Markdown non disponibile per questa sessione.' };
      }
      const backendTarget = normalizeBackendUrlValue(entry?.backendUrl || backendUrl);
      if (!backendTarget) {
        return { ok: false, message: 'Backend non configurato per il documento selezionato.' };
      }
      try {
        const response = await fetch(`${backendTarget}/api/markdown?path=${encodeURIComponent(mdPathResolved)}`);
        let payload = {};
        try {
          payload = await response.json();
        } catch {
          payload = {};
        }
        if (!response.ok) {
          const message = payload?.message || `Anteprima Markdown non disponibile (HTTP ${response.status})`;
          return { ok: false, message };
        }
        const markdown = typeof payload?.content === 'string' ? payload.content : '';
        return {
          ok: true,
          markdown,
          pdfUrl: buildFileUrl(backendTarget, entry.pdfPath),
          mdUrl: buildFileUrl(backendTarget, mdPathResolved),
        };
      } catch (error) {
        return { ok: false, message: error?.message || 'Errore durante il recupero dell\'anteprima.' };
      }
    },
    [backendUrl]
  );

  const handleSaveWorkspaceFilter = useCallback(
    (filter) => {
      const name = filter?.name?.trim() || `Filtro ${savedWorkspaceFilters.length + 1}`;
      const entry = {
        id: Date.now(),
        name,
        workspaceId: filter?.workspaceId || '',
        projectId: filter?.projectId || '',
        projectName: filter?.projectName || '',
        status: filter?.status || '',
        search: filter?.search || '',
      };
      setSavedWorkspaceFilters((prev) => [...prev, entry]);
      pushLogs([`✅ Filtro salvato: ${name}`]);
    },
    [savedWorkspaceFilters.length, pushLogs]
  );

  const handleDeleteWorkspaceFilter = useCallback((id) => {
    setSavedWorkspaceFilters((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleApplyWorkspaceFilter = useCallback((filter) => {
    if (!filter) return;
    setNavigatorSelection({
      workspaceId: filter.workspaceId || '',
      projectId: filter.projectId || '',
      projectName: filter.projectName || '',
      status: filter.status || '',
    });
    setHistoryFilter(filter.search || '');
  }, []);

  const handleRefreshWorkspaces = useCallback(() => {
    fetchWorkspaces({ silent: false });
  }, [fetchWorkspaces]);

  const handleAdoptNavigatorSelection = useCallback(() => {
    if (!navigatorSelection.workspaceId || navigatorSelection.workspaceId === '__unassigned__') {
      setWorkspaceSelection({ workspaceId: '', projectId: '', projectName: '', status: '' });
      setProjectCreationMode(false);
      setStatusCreationMode(false);
      setProjectDraft('');
      setStatusDraft('');
      return;
    }
    const workspace = workspaces.find((ws) => ws.id === navigatorSelection.workspaceId);
    if (!workspace) {
      setWorkspaceSelection({ workspaceId: '', projectId: '', projectName: '', status: '' });
      return;
    }
    const workspaceProjectsArray = Array.isArray(workspace.projects) ? workspace.projects : [];
    let matchedProject = null;
    if (navigatorSelection.projectId) {
      matchedProject = workspaceProjectsArray.find((proj) => proj.id === navigatorSelection.projectId) || null;
      if (!matchedProject && navigatorSelection.projectName) {
        const targetName = navigatorSelection.projectName.toLowerCase();
        matchedProject =
          workspaceProjectsArray.find((proj) => (proj.name || '').toLowerCase() === targetName) || null;
      }
    }
    const candidateStatuses = matchedProject && Array.isArray(matchedProject.statuses) && matchedProject.statuses.length
      ? matchedProject.statuses
      : Array.isArray(workspace.defaultStatuses) && workspace.defaultStatuses.length
      ? workspace.defaultStatuses
      : DEFAULT_WORKSPACE_STATUSES;
    const normalizedStatus =
      navigatorSelection.status && candidateStatuses.includes(navigatorSelection.status)
        ? navigatorSelection.status
        : candidateStatuses[0] || '';
    setWorkspaceSelection({
      workspaceId: workspace.id,
      projectId: matchedProject?.id || '',
      projectName: matchedProject ? '' : navigatorSelection.projectName || '',
      status: normalizedStatus,
    });
    setProjectCreationMode(false);
    setStatusCreationMode(false);
    setProjectDraft('');
    setStatusDraft('');
  }, [navigatorSelection, workspaces]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceSelection.workspaceId) || null,
    [workspaces, workspaceSelection.workspaceId]
  );

  const workspaceProjects = useMemo(
    () => (Array.isArray(activeWorkspace?.projects) ? activeWorkspace.projects : []),
    [activeWorkspace]
  );

  const activeProject = useMemo(
    () => workspaceProjects.find((project) => project.id === workspaceSelection.projectId) || null,
    [workspaceProjects, workspaceSelection.projectId]
  );

  const availableStatuses = useMemo(() => {
    const candidate = (activeProject && Array.isArray(activeProject.statuses) && activeProject.statuses.length
      ? activeProject.statuses
      : Array.isArray(activeWorkspace?.defaultStatuses) && activeWorkspace.defaultStatuses.length
      ? activeWorkspace.defaultStatuses
      : DEFAULT_WORKSPACE_STATUSES);
    return Array.isArray(candidate) && candidate.length ? candidate : DEFAULT_WORKSPACE_STATUSES;
  }, [activeProject, activeWorkspace]);

  const handleSelectWorkspaceForPipeline = useCallback(
    (value) => {
      const workspaceId = value || '';
      if (!workspaceId) {
        setWorkspaceSelection({ workspaceId: '', projectId: '', projectName: '', status: '' });
        setProjectCreationMode(false);
        setStatusCreationMode(false);
        setProjectDraft('');
        setStatusDraft('');
        return;
      }
      const workspace = workspaces.find((ws) => ws.id === workspaceId);
      const firstProject = workspace?.projects?.[0] || null;
      const statuses = firstProject?.statuses && firstProject.statuses.length
        ? firstProject.statuses
        : workspace?.defaultStatuses && workspace.defaultStatuses.length
        ? workspace.defaultStatuses
        : DEFAULT_WORKSPACE_STATUSES;
      setWorkspaceSelection({
        workspaceId,
        projectId: firstProject?.id || '',
        projectName: '',
        status: statuses[0] || '',
      });
      setProjectCreationMode(false);
      setStatusCreationMode(false);
      setProjectDraft('');
      setStatusDraft('');
    },
    [workspaces]
  );

  const handleSelectProjectForPipeline = useCallback(
    (value) => {
      if (value === '__new__') {
        setProjectCreationMode(true);
        setWorkspaceSelection((prev) => ({ ...prev, projectId: '', projectName: '' }));
        setProjectDraft('');
        return;
      }
      setProjectCreationMode(false);
      const project = workspaceProjects.find((proj) => proj.id === value) || null;
      const statuses = project?.statuses && project.statuses.length
        ? project.statuses
        : activeWorkspace?.defaultStatuses && activeWorkspace.defaultStatuses.length
        ? activeWorkspace.defaultStatuses
        : DEFAULT_WORKSPACE_STATUSES;
      setWorkspaceSelection((prev) => ({
        ...prev,
        projectId: value || '',
        projectName: '',
        status: prev.status && statuses.includes(prev.status) ? prev.status : (statuses[0] || ''),
      }));
      setStatusCreationMode(false);
      setStatusDraft('');
    },
    [workspaceProjects, activeWorkspace]
  );

  const handleSelectStatusForPipeline = useCallback((value) => {
    if (value === '__new__') {
      setStatusCreationMode(true);
      setWorkspaceSelection((prev) => ({ ...prev, status: '' }));
      setStatusDraft('');
      return;
    }
    setStatusCreationMode(false);
    setWorkspaceSelection((prev) => ({ ...prev, status: value || '' }));
  }, []);

  const handleCreateProjectFromDraft = useCallback(async () => {
    const name = projectDraft.trim();
    if (!workspaceSelection.workspaceId || !name) {
      return;
    }
    const result = await handleEnsureWorkspaceProject(workspaceSelection.workspaceId, {
      projectName: name,
      status: statusDraft.trim() || workspaceSelection.status,
    });
    if (result.ok && result.workspace) {
      const created = (result.workspace.projects || []).find(
        (proj) => proj.name && proj.name.toLowerCase() === name.toLowerCase()
      );
      const statuses = created?.statuses && created.statuses.length
        ? created.statuses
        : result.workspace.defaultStatuses && result.workspace.defaultStatuses.length
        ? result.workspace.defaultStatuses
        : DEFAULT_WORKSPACE_STATUSES;
      setWorkspaceSelection({
        workspaceId: result.workspace.id,
        projectId: created?.id || '',
        projectName: '',
        status: statusDraft.trim() || statuses[0] || '',
      });
      setProjectCreationMode(false);
      setStatusCreationMode(false);
      setProjectDraft('');
      setStatusDraft('');
      fetchWorkspaces({ silent: true });
    }
  }, [projectDraft, statusDraft, workspaceSelection.workspaceId, workspaceSelection.status, handleEnsureWorkspaceProject, fetchWorkspaces]);

  const handleCreateStatusFromDraft = useCallback(async () => {
    const newStatus = statusDraft.trim();
    if (!newStatus || !workspaceSelection.workspaceId) {
      return;
    }
    await handleEnsureWorkspaceProject(workspaceSelection.workspaceId, {
      projectId: workspaceSelection.projectId,
      projectName: workspaceSelection.projectName,
      status: newStatus,
    });
    setWorkspaceSelection((prev) => ({ ...prev, status: newStatus }));
    setStatusDraft('');
    setStatusCreationMode(false);
    fetchWorkspaces({ silent: true });
  }, [statusDraft, workspaceSelection.workspaceId, workspaceSelection.projectId, workspaceSelection.projectName, handleEnsureWorkspaceProject, fetchWorkspaces]);

  const handleWorkspaceBuilderSubmit = useCallback(async () => {
    const result = await handleCreateWorkspace({
      name: workspaceBuilder.name,
      client: workspaceBuilder.client,
      color: workspaceBuilder.color,
      statuses: workspaceBuilder.statuses
        .split(',')
        .map((chunk) => chunk.trim())
        .filter(Boolean),
    });
    if (result.ok) {
      setWorkspaceBuilder({
        name: '',
        client: '',
        color: '#6366f1',
        statuses: DEFAULT_WORKSPACE_STATUSES.join(', '),
      });
      setWorkspaceBuilderOpen(false);
      fetchWorkspaces({ silent: true });
    }
  }, [handleCreateWorkspace, workspaceBuilder, fetchWorkspaces]);

  const processViaBackend=async(customBlob)=>{
    const blob=customBlob||audioBlob;
    if(!blob) return;
    if(!backendUrl){
      setErrorBanner({title:'Backend URL mancante',details:'Imposta http://localhost:7788 o il tuo endpoint.'});
      return;
    }
    resetPipelineProgress(true);
    setShowRawLogs(false);
    setBusy(true);
    setLogs([]);
    setPdfPath("");
    setMdPath("");
    setErrorBanner(null);
    const runStartedAt=new Date();
    const durationSeconds=Number.isFinite(elapsed)?elapsed:null;
    const sessionLogs=[];
    const appendLogs=(entries)=>{
      const sanitized=(entries||[]).filter(Boolean);
      if(!sanitized.length) return;
      sessionLogs.push(...sanitized);
      setLogs(ls=>ls.concat(sanitized));
    };
    try{
      const fd=new FormData();
      const m=(mime||blob.type||"").toLowerCase();
      const ext=m.includes('webm')?'webm':m.includes('ogg')?'ogg':m.includes('wav')?'wav':'m4a';
      fd.append('audio',blob,`recording.${ext}`);
      if (customPdfLogo) {
        fd.append('pdfLogo', customPdfLogo);
      }
      const isPlaceholder=!destDir.trim()||destDir.includes('tuo_utente');
      if (!isPlaceholder) {
        fd.append('dest',destDir);
      } else {
        appendLogs(["ℹ️ Cartella destinazione non specificata o segnaposto: il backend userà la sua cartella predefinita."]);
      }
      fd.append('slug',slug||'meeting');
      if (workspaceSelection.workspaceId) {
        fd.append('workspaceId', workspaceSelection.workspaceId);
        if (workspaceSelection.projectId) {
          fd.append('workspaceProjectId', workspaceSelection.projectId);
        }
        if (workspaceSelection.projectName) {
          fd.append('workspaceProjectName', workspaceSelection.projectName);
        }
        if (workspaceSelection.status) {
          fd.append('workspaceStatus', workspaceSelection.status);
        }
      }
      const cap=Number(secondsCap||0);
      if(cap>0) fd.append('seconds',String(cap));
      const {ok,status,data,raw}=await fetchBody(`${backendUrl}/api/rec2pdf`,{method:'POST',body:fd});
      const stageEventsPayload = Array.isArray(data?.stageEvents) ? data.stageEvents : [];
      if(!ok){
        if (stageEventsPayload.length) {
          handlePipelineEvents(stageEventsPayload, { animate: false });
        } else {
          const fallbackMessage = data?.message || (raw ? raw.slice(0, 120) : status === 0 ? 'Connessione fallita/CORS' : 'Errore backend');
          handlePipelineEvents([
            { stage: 'complete', status: 'failed', message: fallbackMessage },
          ], { animate: false });
        }
        if(data?.logs?.length) appendLogs(data.logs);
        if(data?.message) appendLogs([`❌ ${data.message}`]);
        if(!data&&raw) appendLogs([`❌ Risposta server: ${raw.slice(0,400)}${raw.length>400?'…':''}`]);
        appendLogs([`Errore backend: HTTP ${status||'0 (rete)'}`]);
        setErrorBanner({title:`Errore backend (HTTP ${status||'0'})`,details:data?.message||(raw?raw.slice(0,400):(status===0?'Connessione fallita/CORS':'Errore sconosciuto'))});
        return;
      }
      const successEvents = stageEventsPayload.length
        ? stageEventsPayload
        : [{ stage: 'complete', status: 'done', message: 'Pipeline completata' }];
      handlePipelineEvents(successEvents, { animate: true });
      if(data?.logs) appendLogs(data.logs);
      if(data?.pdfPath){
        setPdfPath(data.pdfPath);
        setMdPath(data.mdPath || "");
        const normalizedBackend = normalizeBackendUrlValue(backendUrl || '');
        const pdfUrl = buildFileUrl(normalizedBackend, data.pdfPath);
        const mdUrl = buildFileUrl(normalizedBackend, data?.mdPath || '');
        const logosUsed={
          frontend: customLogo?'custom':'default',
          pdf: customPdfLogo?(customPdfLogo.name||'custom'):'default',
        };
        const structureMeta = data?.structure || null;
        if (structureMeta && Number.isFinite(structureMeta.score)) {
          appendLogs([`📊 Completezza stimata: ${structureMeta.score}%`]);
          if (Array.isArray(structureMeta.missingSections) && structureMeta.missingSections.length) {
            appendLogs([`🧩 Sezioni mancanti: ${structureMeta.missingSections.join(', ')}`]);
          }
        }
        const historyEntry=hydrateHistoryEntry({
          id:Date.now(),
          timestamp:runStartedAt.toISOString(),
          slug:slug||'meeting',
          title:slug||'Sessione',
          duration:durationSeconds,
          pdfPath:data.pdfPath,
          pdfUrl,
          mdPath:data?.mdPath||'',
          mdUrl,
          backendUrl:normalizedBackend,
          logos:logosUsed,
          tags:[],
          logs:sessionLogs,
          stageEvents: successEvents,
          source:customBlob?'upload':'recording',
          bytes:blob.size||null,
          workspace: data?.workspace || (workspaceSelection.workspaceId
            ? {
                id: workspaceSelection.workspaceId,
                name: '',
                client: '',
                color: '#6366f1',
                projectId: workspaceSelection.projectId || '',
                projectName: workspaceSelection.projectName || '',
                status: workspaceSelection.status || '',
              }
            : null),
          structure: structureMeta,
        });
        setHistory(prev=>{
          const next=[historyEntry,...prev];
          return next.slice(0,HISTORY_LIMIT);
        });
        fetchWorkspaces({ silent: true });
        appendLogs([`💾 Sessione salvata nella Libreria (${historyEntry.title}).`]);
      } else {
        appendLogs(["⚠️ Risposta senza pdfPath."]);
      }
    } finally{
      setBusy(false);
    }
  };

  const processMarkdownUpload=async(file)=>{
    if(!file) return;
    if(!backendUrl){
      setErrorBanner({title:'Backend URL mancante',details:'Imposta http://localhost:7788 o il tuo endpoint.'});
      return;
    }
    resetPipelineProgress(true);
    setShowRawLogs(false);
    setBusy(true);
    setLogs([]);
    setPdfPath("");
    setMdPath("");
    setErrorBanner(null);
    const sessionLogs=[];
    const appendLogs=(entries)=>{
      const sanitized=(entries||[]).filter(Boolean);
      if(!sanitized.length) return;
      sessionLogs.push(...sanitized);
      setLogs(ls=>ls.concat(sanitized));
    };
    const isPlaceholder=!destDir.trim()||destDir.includes('tuo_utente');
    if(isPlaceholder){
      appendLogs(["ℹ️ Cartella destinazione non specificata o segnaposto: il backend userà la sua cartella predefinita."]); 
    }
    appendLogs([`🚀 Avvio impaginazione da Markdown: ${file.name}`]);
    try{
      const fd=new FormData();
      fd.append('markdown',file,file.name);
      if(customPdfLogo){
        fd.append('pdfLogo',customPdfLogo);
      }
      if(!isPlaceholder){
        fd.append('dest',destDir);
      }
      const slugValue=(slug||file.name.replace(/\.[^.]+$/i,'')||'documento').trim();
      if(slugValue){
        fd.append('slug',slugValue);
      }
      if (workspaceSelection.workspaceId) {
        fd.append('workspaceId', workspaceSelection.workspaceId);
        if (workspaceSelection.projectId) {
          fd.append('workspaceProjectId', workspaceSelection.projectId);
        }
        if (workspaceSelection.projectName) {
          fd.append('workspaceProjectName', workspaceSelection.projectName);
        }
        if (workspaceSelection.status) {
          fd.append('workspaceStatus', workspaceSelection.status);
        }
      }
      const {ok,status,data,raw,contentType}=await fetchBody(`${backendUrl}/api/ppubr-upload`,{method:'POST',body:fd});
      const stageEventsPayload=Array.isArray(data?.stageEvents)?data.stageEvents:[];
      if(!ok){
        if(stageEventsPayload.length){
          handlePipelineEvents(stageEventsPayload,{animate:false});
        }else{
          let fallbackMessage=data?.message||(raw?raw.slice(0,200):status===0?'Connessione fallita/CORS':'Errore backend');
          if(status===404&&(raw.includes('Endpoint')||raw.includes('Cannot POST'))){
            fallbackMessage='Endpoint /api/ppubr-upload non disponibile sul backend. Riavvia o aggiorna il server.';
          }
          handlePipelineEvents([
            {stage:'publish',status:'failed',message:fallbackMessage},
            {stage:'complete',status:'failed',message:'Pipeline interrotta'},
          ],{animate:false});
        }
        if(data?.logs?.length) appendLogs(data.logs);
        let message=data?.message||(raw?raw.slice(0,200):status===0?'Connessione fallita/CORS':'Errore backend');
        if(status===404&&(raw.includes('Endpoint')||raw.includes('Cannot POST'))){
          message='Endpoint /api/ppubr-upload non disponibile sul backend. Riavvia o aggiorna il server.';
        } else if(status===404&&!contentType?.includes('application/json')){
          message='Risposta non valida dal backend (HTML/404). Controlla la versione del server.';
        }
        appendLogs([`❌ ${message}`]);
        setErrorBanner({title:'Impaginazione fallita',details:message});
        return;
      }
      const successEvents=stageEventsPayload.length?stageEventsPayload:[
        {stage:'upload',status:'completed',message:'Markdown caricato manualmente.'},
        {stage:'transcode',status:'completed',message:'Step non necessario.'},
        {stage:'transcribe',status:'completed',message:'Trascrizione non richiesta.'},
        {stage:'markdown',status:'completed',message:'Markdown fornito.'},
        {stage:'publish',status:'completed',message:'PPUBR completato.'},
        {stage:'complete',status:'completed',message:'Pipeline conclusa.'},
      ];
      handlePipelineEvents(successEvents,{animate:true});
      if(data?.logs?.length) appendLogs(data.logs);
      if(data?.pdfPath){
        setPdfPath(data.pdfPath);
        setMdPath(data?.mdPath||"");
        appendLogs([`✅ PDF generato: ${data.pdfPath}`]);
        const normalizedBackend=normalizeBackendUrlValue(backendUrl||'');
        const pdfUrl=buildFileUrl(normalizedBackend,data.pdfPath);
        const mdUrl=buildFileUrl(normalizedBackend,data?.mdPath||'');
        const logosUsed={
          frontend:customLogo?'custom':'default',
          pdf:customPdfLogo?(customPdfLogo.name||'custom'):'default',
        };
        const structureMeta = data?.structure || null;
        if (structureMeta && Number.isFinite(structureMeta.score)) {
          appendLogs([`📊 Completezza stimata: ${structureMeta.score}%`]);
          if (Array.isArray(structureMeta.missingSections) && structureMeta.missingSections.length) {
            appendLogs([`🧩 Sezioni mancanti: ${structureMeta.missingSections.join(', ')}`]);
          }
        }
        const historyEntry=hydrateHistoryEntry({
          id:Date.now(),
          timestamp:new Date().toISOString(),
          slug:slugValue||'documento',
          title:slugValue||file.name,
          duration:null,
          pdfPath:data.pdfPath,
          pdfUrl,
          mdPath:data?.mdPath||'',
          mdUrl,
          backendUrl:normalizedBackend,
          logos:logosUsed,
          tags:[],
          logs:sessionLogs,
          stageEvents:successEvents,
          source:'markdown-upload',
          bytes:file.size||null,
          workspace: data?.workspace || (workspaceSelection.workspaceId
            ? {
                id: workspaceSelection.workspaceId,
                name: '',
                client: '',
                color: '#6366f1',
                projectId: workspaceSelection.projectId || '',
                projectName: workspaceSelection.projectName || '',
                status: workspaceSelection.status || '',
              }
            : null),
          structure: structureMeta,
        });
        setHistory(prev=>{
          const next=[historyEntry,...prev];
          return next.slice(0,HISTORY_LIMIT);
        });
        setActivePanel('doc');
        appendLogs([`💾 Sessione Markdown salvata nella Libreria (${historyEntry.title}).`]);
        fetchWorkspaces({ silent: true });
      }else{
        appendLogs(['⚠️ Risposta backend senza percorso PDF.']);
      }
    }catch(err){
      const message=err?.message||String(err);
      appendLogs([`❌ ${message}`]);
      handlePipelineEvents([
        {stage:'publish',status:'failed',message},
        {stage:'complete',status:'failed',message:'Pipeline interrotta'},
      ],{animate:false});
      setErrorBanner({title:'Impaginazione fallita',details:message});
    }finally{
      setBusy(false);
      if(markdownInputRef.current){
        markdownInputRef.current.value='';
      }
    }
  };

  const handleMarkdownFilePicked=(event)=>{
    const file=event.target?.files?.[0];
    if(!file) return;
    if(!/\.md$/i.test(file.name)){
      setErrorBanner({title:'Formato non supportato',details:'Seleziona un file con estensione .md'});
      if(markdownInputRef.current){
        markdownInputRef.current.value='';
      }
      return;
    }
    setLastMarkdownUpload({name:file.name,size:file.size,ts:Date.now()});
    processMarkdownUpload(file);
  };

  const runDiagnostics=useCallback(async()=>{ setBusy(true); setLogs([]); setErrorBanner(null); try{ const {ok,status,data,raw}=await runBackendDiagnostics(); if(data?.logs?.length) pushLogs(data.logs); if(!ok){ pushLogs([`❌ Diagnostica fallita (HTTP ${status||'0'})`]); if(!data&&raw) pushLogs([raw.slice(0,400)]); setErrorBanner({title:`Diagnostica fallita (HTTP ${status||'0'})`,details:data?.message||raw||'Errore rete/CORS'}); setBackendUp(false); } else { pushLogs([data?.ok?'✅ Ambiente OK':'❌ Ambiente con problemi']); } } finally{ setBusy(false); } },[pushLogs, runBackendDiagnostics, setBackendUp]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (onboardingComplete) {
      localStorage.setItem('onboardingComplete', 'true');
    } else {
      localStorage.removeItem('onboardingComplete');
    }
  }, [onboardingComplete]);

  const backendUrlValid = useMemo(() => {
    if (!backendUrl) return false;
    try {
      const parsed = new URL(backendUrl);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, [backendUrl]);

  const diagUrl = useMemo(() => {
    if (!backendUrlValid || !backendUrl) return '';
    const trimmed = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
    return `${trimmed}/api/diag`;
  }, [backendUrl, backendUrlValid]);

  const openMicSettings = useCallback(() => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator?.userAgent || '';
    if (ua.includes('Firefox')) {
      window.open('about:preferences#privacy', '_blank');
    } else if (ua.includes('Edg/')) {
      window.open('edge://settings/content/microphone', '_blank');
    } else if (ua.includes('OPR/') || ua.includes('Opera')) {
      window.open('opera://settings/content/microphone', '_blank');
    } else {
      window.open('chrome://settings/content/microphone', '_blank');
    }
  }, []);

  const handleBackendDefault = useCallback(() => {
    setBackendUrl('http://localhost:7788');
  }, [setBackendUrl]);

  const handleBackendSettings = useCallback(() => {
    setShowSettings(true);
  }, [setShowSettings]);

  const onboardingSteps = useMemo(() => {
    const micStatus = permission==='granted'?'success':permission==='denied'?'error':'pending';
    const micMessage = permissionMessage || (micStatus==='success'?'Il permesso microfono è attivo.':'Concedi il permesso microfono per registrare direttamente dall\'app.');
    const micActions = [
      { label:'Richiedi accesso microfono', onClick:requestPermission, disabled:permission==='granted' },
      { label:'Aggiorna dispositivi', onClick:refreshDevices, variant:'secondary' },
    ];
    if(permission==='denied'){
      micActions.push({ label:'Apri impostazioni browser', onClick:openMicSettings, variant:'subtle' });
    }

    const urlStatus = !backendUrl ? 'pending' : backendUrlValid ? 'success' : 'error';
    const urlMessage = !backendUrl
      ? 'Inserisci l\'URL del backend (es. http://localhost:7788).'
      : backendUrlValid
        ? 'URL valido: il frontend può contattare il backend.'
        : 'Controlla che l\'URL includa protocollo (http/https) e porta corretti.';
    const urlActions = [
      { label:'Imposta localhost', onClick:handleBackendDefault, variant:'secondary' },
      { label:'Apri impostazioni backend', onClick:handleBackendSettings, variant:'subtle' },
    ];

    const healthStatus = backendUp===null?'pending':backendUp?'success':'error';
    const healthMessage = backendUp===null
      ? 'Esegui una verifica per assicurarti che il backend risponda a /api/health.'
      : backendUp
        ? 'Il backend risponde correttamente all\'endpoint /api/health.'
        : 'Backend non raggiungibile. Avvia il servizio e riprova.';
    const healthActions = [
      { label:checkingHealth?'Verifica in corso…':'Verifica connessione', onClick:checkHealth, disabled:checkingHealth, variant:'primary' },
    ];
    if(backendUrlValid){
      healthActions.push({ label:'Apri backend', href:backendUrl, variant:'subtle' });
    }

    const diagStatusKey = diagnostics.status;
    const diagStatus = diagStatusKey==='success'?'success':diagStatusKey==='error'?'error':'pending';
    const diagMessage = diagStatusKey==='success'
      ? 'La diagnostica ha confermato che l\'ambiente è pronto.'
      : diagStatusKey==='error'
        ? (diagnostics.message || 'La diagnostica ha rilevato problemi nella toolchain.')
        : 'Esegui /api/diag per verificare ffmpeg, template e permessi filesystem.';
    const diagActions = [
      { label:busy?'Diagnostica in corso…':'Esegui diagnostica', onClick:runDiagnostics, disabled:busy, variant:'primary' },
    ];
    if(diagUrl){
      diagActions.push({ label:'Apri /api/diag', href:diagUrl, variant:'subtle' });
    }

    const diagLogsPreview = diagnostics.logs?.slice(-3) || [];

    return [
      {
        key:'microphone',
        title:'Permessi microfono',
        subtitle:'Browser & hardware',
        icon:Mic,
        status:micStatus,
        statusLabel:micStatus==='success'?'OK':micStatus==='error'?'Bloccato':'In attesa',
        headline:micStatus==='success'?'Microfono pronto alla registrazione':'Consenti l\'accesso al microfono',
        body:(
          <>
            <p>{micMessage}</p>
            <ul className="mt-3 space-y-1 text-xs text-zinc-200">
              <li>Permesso attuale: <code className="text-zinc-100">{permission}</code></li>
              <li>HTTPS / localhost: {secureOK?'✅':'⚠️ richiesto'}</li>
              <li>getUserMedia: {mediaSupported?'✅ supportato':'⚠️ non disponibile'}</li>
              <li>MediaRecorder: {recorderSupported?'✅ supportato':'⚠️ non disponibile (usa il caricamento file)'}</li>
            </ul>
          </>
        ),
        extra:lastMicError?(<div className="text-xs text-rose-200">Ultimo errore: {lastMicError.name}{lastMicError.message?` – ${lastMicError.message}`:''}</div>):null,
        actions:micActions,
      },
      {
        key:'backend-url',
        title:'URL backend',
        subtitle:'Connessione',
        icon:LinkIcon,
        status:urlStatus,
        statusLabel:urlStatus==='success'?'OK':urlStatus==='error'?'Correggi':'In attesa',
        headline:urlStatus==='success'?'Endpoint configurato':'Configura l\'URL del backend',
        body:(
          <>
            <p>{urlMessage}</p>
            <div className="mt-3 rounded-lg border border-zinc-700/60 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-300">{backendUrl || '—'}</div>
          </>
        ),
        actions:urlActions,
      },
      {
        key:'health',
        title:'/api/health',
        subtitle:'Stato servizio',
        icon:CheckCircle2,
        status:healthStatus,
        statusLabel:healthStatus==='success'?'Online':healthStatus==='error'?'Offline':'In attesa',
        headline:healthStatus==='success'?'Backend raggiungibile':'Verifica salute del backend',
        body:(
          <>
            <p>{healthMessage}</p>
            <p className="text-xs text-zinc-300">Ultimo risultato: {backendUp===null?'—':backendUp?'✅ OK':'❌ Offline'}</p>
          </>
        ),
        actions:healthActions,
      },
      {
        key:'diagnostics',
        title:'/api/diag',
        subtitle:'Toolchain',
        icon:Bug,
        status:diagStatus,
        statusLabel:diagStatusKey==='running'?'In corso':diagStatus==='success'?'OK':diagStatus==='error'?'Problemi':'In attesa',
        headline:diagStatus==='success'?'Ambiente validato':'Esegui la diagnostica del backend',
        body:(
          <>
            <p>{diagMessage}</p>
          </>
        ),
        extra:diagLogsPreview.length?(<div className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-3 text-xs text-zinc-300 space-y-1">{diagLogsPreview.map((log,index)=>(<div key={index} className="font-mono">{log}</div>))}</div>):null,
        actions:diagActions,
      },
    ];
  }, [permission, permissionMessage, secureOK, mediaSupported, recorderSupported, lastMicError, requestPermission, refreshDevices, openMicSettings, backendUrl, backendUrlValid, handleBackendDefault, handleBackendSettings, backendUp, checkingHealth, checkHealth, diagnostics.status, diagnostics.message, diagnostics.logs, busy, runDiagnostics, diagUrl]);

  useEffect(() => {
    if (!onboardingSteps.length) return;
    if (onboardingSteps.every(step => step.status === 'success')) {
      setOnboardingComplete(true);
    }
  }, [onboardingSteps]);

  useEffect(() => {
    if (!showOnboarding || !onboardingSteps.length) return;
    const firstIncomplete = onboardingSteps.findIndex(step => step.status !== 'success');
    const targetIndex = firstIncomplete === -1 ? onboardingSteps.length - 1 : firstIncomplete;
    if (targetIndex !== onboardingStep) {
      setOnboardingStep(targetIndex);
    }
  }, [showOnboarding, onboardingSteps, onboardingStep]);

  const openSetupAssistant = useCallback(() => {
    const firstIncomplete = onboardingSteps.findIndex(step => step.status !== 'success');
    setOnboardingStep(firstIncomplete === -1 ? onboardingSteps.length - 1 : firstIncomplete);
    setShowOnboarding(true);
  }, [onboardingSteps, setOnboardingStep]);

  const handleOnboardingFinish = useCallback(() => {
    setOnboardingComplete(true);
    setShowOnboarding(false);
  }, [setOnboardingComplete, setShowOnboarding]);

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

  const normalizedBackendUrl = useMemo(() => normalizeBackendUrlValue(backendUrl), [backendUrl]);

  const pdfDownloadUrl = useMemo(() => {
    if (!pdfPath || !normalizedBackendUrl) return '';
    return `${normalizedBackendUrl}/api/file?path=${encodeURIComponent(pdfPath)}`;
  }, [pdfPath, normalizedBackendUrl]);

  const mdDownloadUrl = useMemo(() => {
    if (!mdPath || !normalizedBackendUrl) return '';
    return `${normalizedBackendUrl}/api/file?path=${encodeURIComponent(mdPath)}`;
  }, [mdPath, normalizedBackendUrl]);

  const mdEditorDownloadUrl = useMemo(() => {
    if (!mdEditor?.path || !mdEditor?.backendUrl) return '';
    return `${mdEditor.backendUrl}/api/file?path=${encodeURIComponent(mdEditor.path)}`;
  }, [mdEditor?.path, mdEditor?.backendUrl]);

  const mdEditorDirty = useMemo(() => mdEditor.content !== mdEditor.originalContent, [mdEditor.content, mdEditor.originalContent]);

  const handleOpenHistoryPdf = useCallback((entry) => {
    if (!entry?.pdfPath) return;
    if (typeof window === 'undefined') return;
    const directUrl = entry.pdfUrl && entry.pdfUrl.startsWith('http') ? entry.pdfUrl : '';
    const fallbackBackend = entry.backendUrl || normalizedBackendUrl;
    const target = directUrl || buildFileUrl(fallbackBackend, entry.pdfPath);
    if (!target) return;
    window.open(target, '_blank', 'noopener,noreferrer');
  }, [normalizedBackendUrl, handlePipelineEvents]);

  const handleOpenHistoryMd = useCallback(async (entry, overrideMdPath) => {
    const mdPathResolved = overrideMdPath || deriveMarkdownPath(entry?.mdPath, entry?.pdfPath);
    if (!mdPathResolved) {
      const label = entry?.title || entry?.slug || 'sessione';
      pushLogs([`❌ Percorso Markdown non disponibile per ${label}.`]);
      return;
    }

    const backendTarget = entry?.backendUrl || normalizedBackendUrl;
    const normalizedBackend = normalizeBackendUrlValue(backendTarget);
    if (!normalizedBackend) {
      const message = 'Configura un backend valido per modificare il Markdown.';
      pushLogs([`❌ ${message}`]);
      setErrorBanner({ title: 'Backend non configurato', details: message });
      return;
    }

    setMdEditor({
      ...EMPTY_EDITOR_STATE,
      open: true,
      entry,
      path: mdPathResolved,
      backendUrl: normalizedBackend,
      loading: true,
    });
    pushLogs([`✏️ Apertura editor Markdown (${mdPathResolved})`]);

    try {
      const response = await fetch(`${normalizedBackend}/api/markdown?path=${encodeURIComponent(mdPathResolved)}`);
      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      if (!response.ok) {
        const message = payload?.message || `Impossibile caricare il Markdown (HTTP ${response.status})`;
        throw new Error(message);
      }

      const content = typeof payload?.content === 'string' ? payload.content : '';
      setMdEditor((prev) => {
        if (prev.path !== mdPathResolved) {
          return prev;
        }
        return {
          ...prev,
          loading: false,
          content,
          originalContent: content,
          error: '',
          success: '',
        };
      });
      setHistory((prev) =>
        prev.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                mdPath: mdPathResolved,
                backendUrl: normalizedBackend,
              }
            : item
        )
      );
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      pushLogs([`❌ ${message}`]);
      setMdEditor((prev) => {
        if (prev.path !== mdPathResolved) {
          return prev;
        }
        return { ...prev, loading: false, error: message };
      });
    }
  }, [normalizedBackendUrl, pushLogs, setHistory, setErrorBanner]);

  const handleRepublishFromMd = useCallback(async (entry, overrideMdPath) => {
    const mdPathResolved = overrideMdPath || deriveMarkdownPath(entry?.mdPath, entry?.pdfPath);
    if (!mdPathResolved) {
      pushLogs(['❌ Percorso Markdown non disponibile per la rigenerazione.']);
      return;
    }
    if (busy) {
      pushLogs(['⚠️ Attendere il termine della pipeline corrente prima di rigenerare il PDF.']);
      return;
    }

    const backendTarget = entry?.backendUrl || normalizedBackendUrl;
    if (!backendTarget) {
      const message = 'Configura un backend valido per rigenerare il PDF dal Markdown.';
      pushLogs([`❌ ${message}`]);
      setErrorBanner({ title: 'Backend non configurato', details: message });
      return;
    }

    const backendUsed = normalizeBackendUrlValue(backendTarget);
    if (!backendUsed) {
      const message = "Impossibile normalizzare l'URL del backend per PPUBR.";
      pushLogs([`❌ ${message}`]);
      setErrorBanner({ title: 'Backend non configurato', details: message });
      return;
    }

    setBusy(true);
    setErrorBanner(null);
    pushLogs([`♻️ Rigenerazione PDF da Markdown (${entry.title || entry.slug || mdPathResolved})`]);

    try {
      const response = await fetch(`${backendUsed}/api/ppubr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mdPath: mdPathResolved }),
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      if (Array.isArray(payload.logs) && payload.logs.length) {
        pushLogs(payload.logs);
      }

      if (!response.ok || !payload?.pdfPath) {
        const message = payload?.message || `Rigenerazione fallita (HTTP ${response.status || 0})`;
        pushLogs([`❌ ${message}`]);
        setErrorBanner({ title: 'Rigenerazione PDF fallita', details: message });
        return;
      }

      const pdfUrl = buildFileUrl(backendUsed, payload.pdfPath) || entry.pdfUrl;
      const mdUrl = buildFileUrl(backendUsed, mdPathResolved) || entry.mdUrl;

      setPdfPath(payload.pdfPath);
      setMdPath(mdPathResolved);
      setHistory(prev => prev.map(item => item.id === entry.id ? hydrateHistoryEntry({
        ...item,
        pdfPath: payload.pdfPath,
        pdfUrl,
        mdPath: mdPathResolved,
        mdUrl,
        backendUrl: backendUsed || item.backendUrl,
        logs: Array.isArray(item.logs) ? item.logs.concat(payload.logs || []) : (payload.logs || []),
      }) : item));

      pushLogs([`✅ PDF rigenerato: ${payload.pdfPath}`]);
      setActivePanel('doc');
    } catch (err) {
      const message = err?.message || String(err);
      pushLogs([`❌ ${message}`]);
      setErrorBanner({ title: 'Rigenerazione PDF fallita', details: message });
    } finally {
      setBusy(false);
    }
  }, [busy, normalizedBackendUrl, pushLogs, setErrorBanner, setBusy, setPdfPath, setMdPath, setHistory, setActivePanel]);

  const handleMdEditorChange = useCallback((nextValue) => {
    setMdEditor((prev) => ({
      ...prev,
      content: nextValue,
      error: '',
      success: '',
    }));
  }, []);

  const handleMdEditorClose = useCallback(() => {
    setMdEditor(() => ({ ...EMPTY_EDITOR_STATE }));
  }, []);

  const handleMdEditorSave = useCallback(async (nextContent) => {
    const targetPath = mdEditor?.path;
    const backendTarget = mdEditor?.backendUrl;
    const entryId = mdEditor?.entry?.id;

    if (!targetPath || !backendTarget) {
      pushLogs(['❌ Nessun backend configurato per salvare il Markdown.']);
      return;
    }

    setMdEditor((prev) => ({ ...prev, saving: true, error: '', success: '' }));
    try {
      const response = await fetch(`${backendTarget}/api/markdown`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath, content: nextContent }),
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      if (!response.ok) {
        const message = payload?.message || `Salvataggio Markdown fallito (HTTP ${response.status})`;
        throw new Error(message);
      }

      setMdEditor((prev) => {
        if (prev.path !== targetPath) {
          return prev;
        }
        return {
          ...prev,
          saving: false,
          content: nextContent,
          originalContent: nextContent,
          success: 'Markdown salvato con successo',
          error: '',
        };
      });
      setHistory((prev) =>
        prev.map((item) =>
          item.id === entryId
            ? {
                ...item,
                mdPath: targetPath,
                backendUrl: backendTarget,
                lastEditedAt: new Date().toISOString(),
              }
            : item
        )
      );
      pushLogs([`💾 Markdown salvato (${targetPath})`]);
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      pushLogs([`❌ ${message}`]);
      setMdEditor((prev) => {
        if (prev.path !== targetPath) {
          return prev;
        }
        return { ...prev, saving: false, error: message, success: '' };
      });
    }
  }, [mdEditor, pushLogs, setHistory]);

  const handleRepublishFromEditor = useCallback(() => {
    if (!mdEditor?.entry) return;
    handleRepublishFromMd(mdEditor.entry, mdEditor.path);
  }, [mdEditor, handleRepublishFromMd]);

  const handleShowHistoryLogs = useCallback((entry) => {
    if (!entry) return;
    const stageEventsFromHistory = Array.isArray(entry.stageEvents) ? entry.stageEvents : [];
    handlePipelineEvents(stageEventsFromHistory, { animate: false, autoRevealOnFailure: false });
    setLogs(() => {
      const baseLogs = Array.isArray(entry.logs) ? entry.logs : [];
      const extras = [];
      if (entry.backendUrl && entry.backendUrl !== normalizedBackendUrl) {
        extras.push(`ℹ️ PDF creato con backend ${entry.backendUrl}.`);
      }
      extras.push('ℹ️ Log caricati dalla Libreria.');
      return baseLogs.concat(extras);
    });
    if (entry.pdfPath) {
      setPdfPath(entry.pdfPath);
    }
    setMdPath(deriveMarkdownPath(entry.mdPath, entry.pdfPath));
    setActivePanel('doc');
    setErrorBanner(null);
    setShowRawLogs(true);
  }, [normalizedBackendUrl, handlePipelineEvents]);

  const handleRenameHistoryEntry = useCallback((id, title) => {
    setHistory(prev => prev.map(entry => entry.id === id ? { ...entry, title } : entry));
  }, []);

  const handleUpdateHistoryTags = useCallback((id, tags) => {
    setHistory(prev => prev.map(entry => entry.id === id ? { ...entry, tags } : entry));
  }, []);

  const handleDeleteHistoryEntry = useCallback((id) => {
    setHistory(prev => prev.filter(entry => entry.id !== id));
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
  }, []);

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

  const totalStages = PIPELINE_STAGES.length;
  const completedStagesCount = useMemo(() => PIPELINE_STAGES.reduce((acc, stage) => acc + (pipelineStatus[stage.key] === 'done' ? 1 : 0), 0), [pipelineStatus]);
  const progressPercent = totalStages ? Math.min(100, Math.max(0, Math.round((completedStagesCount / totalStages) * 100))) : 0;
  const failedStage = useMemo(() => PIPELINE_STAGES.find((stage) => pipelineStatus[stage.key] === 'failed'), [pipelineStatus]);
  const pipelineComplete = useMemo(() => totalStages > 0 && PIPELINE_STAGES.every((stage) => pipelineStatus[stage.key] === 'done'), [pipelineStatus, totalStages]);
  const activeStageDefinition = useMemo(() => PIPELINE_STAGES.find((stage) => stage.key === activeStageKey), [activeStageKey]);

  const headerStatus = useMemo(() => {
    if (failedStage) {
      return {
        text: `${failedStage.label}: errore`,
        className: 'border border-rose-500/40 bg-rose-500/10 text-rose-200',
        icon: AlertCircle,
      };
    }
    if (pipelineComplete) {
      return {
        text: 'Pipeline completata',
        className: 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
        icon: CheckCircle2,
      };
    }
    if (activeStageDefinition) {
      return {
        text: `${activeStageDefinition.label}: in corso`,
        className: 'border border-indigo-500/40 bg-indigo-500/10 text-indigo-100',
        icon: activeStageDefinition.icon,
      };
    }
    if (busy) {
      return {
        text: 'Pipeline in esecuzione…',
        className: 'border border-indigo-500/40 bg-indigo-500/10 text-indigo-100',
        icon: Cpu,
      };
    }
    return {
      text: 'In attesa di avvio',
      className: 'border border-zinc-700 bg-zinc-900 text-zinc-300',
      icon: Cpu,
    };
  }, [failedStage, pipelineComplete, activeStageDefinition, busy]);
  const HeaderIcon = headerStatus.icon || Cpu;


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
            <button onClick={openSetupAssistant} className={classNames("px-3 py-2 rounded-xl text-sm flex items-center gap-2 border shadow-sm", themes[theme].button)}>
              <Sparkles className="w-4 h-4"/> Setup assistant
            </button>
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
              <button onClick={requestPermission} className={classNames("px-4 py-2 rounded-xl text-sm border", themes[theme].button)}>Concedi microfono</button>
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
            <div className={classNames("mt-4 rounded-xl p-4 border", themes[theme].input)}>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Users className="w-4 h-4" />
                    <span>Workspace &amp; progetto</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRefreshWorkspaces}
                      className={classNames(
                        "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs border",
                        themes[theme].input,
                        themes[theme].input_hover,
                        workspaceLoading && "opacity-60 cursor-not-allowed"
                      )}
                      disabled={workspaceLoading}
                    >
                      <RefreshCw className={classNames("w-3.5 h-3.5", workspaceLoading ? "animate-spin" : "")} />
                      Aggiorna
                    </button>
                    <button
                      onClick={() => setWorkspaceBuilderOpen((prev) => !prev)}
                      className={classNames(
                        "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs border",
                        themes[theme].input,
                        themes[theme].input_hover
                      )}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {workspaceBuilderOpen ? 'Chiudi builder' : 'Nuovo workspace'}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500">Workspace</label>
                    <select
                      value={workspaceSelection.workspaceId}
                      onChange={(event) => handleSelectWorkspaceForPipeline(event.target.value)}
                      className={classNames("mt-2 w-full rounded-lg border px-3 py-2 bg-transparent text-sm", themes[theme].input)}
                    >
                      <option value="">Nessun workspace</option>
                      {workspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id} className="bg-zinc-900">
                          {workspace.name} · {workspace.client || '—'}
                        </option>
                      ))}
                    </select>
                  </div>
                  {workspaceSelection.workspaceId && (
                    <div>
                      <label className="text-xs text-zinc-500">Policy di versioning</label>
                      <div className="mt-2 text-xs text-zinc-400">
                        {activeWorkspace?.versioningPolicy
                          ? `${activeWorkspace.versioningPolicy.namingConvention || 'timestamped'} · retention ${activeWorkspace.versioningPolicy.retentionLimit || 10}`
                          : 'Timestamp standard'}
                      </div>
                    </div>
                  )}
                </div>
                {workspaceBuilderOpen && (
                  <div className="rounded-lg border border-dashed border-zinc-700 p-3 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-zinc-500">Nome</label>
                        <input
                          value={workspaceBuilder.name}
                          onChange={(event) => setWorkspaceBuilder((prev) => ({ ...prev, name: event.target.value }))}
                          className={classNames("mt-2 w-full rounded-lg border px-3 py-2 bg-transparent text-sm", themes[theme].input)}
                          placeholder="Es. Portfolio Clienti"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">Cliente</label>
                        <input
                          value={workspaceBuilder.client}
                          onChange={(event) => setWorkspaceBuilder((prev) => ({ ...prev, client: event.target.value }))}
                          className={classNames("mt-2 w-full rounded-lg border px-3 py-2 bg-transparent text-sm", themes[theme].input)}
                          placeholder="Es. Acme Corp"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">Colore</label>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="color"
                            value={workspaceBuilder.color}
                            onChange={(event) => setWorkspaceBuilder((prev) => ({ ...prev, color: event.target.value }))}
                            className="h-9 w-12 rounded border border-zinc-700 bg-transparent"
                          />
                          <span className="text-xs text-zinc-400 font-mono">{workspaceBuilder.color}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">Stati suggeriti (comma-separated)</label>
                        <input
                          value={workspaceBuilder.statuses}
                          onChange={(event) => setWorkspaceBuilder((prev) => ({ ...prev, statuses: event.target.value }))}
                          className={classNames("mt-2 w-full rounded-lg border px-3 py-2 bg-transparent text-sm", themes[theme].input)}
                          placeholder="Bozza, In lavorazione, In review"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={handleWorkspaceBuilderSubmit}
                        className={classNames(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
                          themes[theme].button,
                          !workspaceBuilder.name.trim() && "opacity-60 cursor-not-allowed"
                        )}
                        disabled={!workspaceBuilder.name.trim()}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Crea workspace
                      </button>
                    </div>
                  </div>
                )}
                {workspaceSelection.workspaceId && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-500">Progetto</label>
                      <select
                        value={projectCreationMode ? '__new__' : workspaceSelection.projectId}
                        onChange={(event) => handleSelectProjectForPipeline(event.target.value)}
                        className={classNames("mt-2 w-full rounded-lg border px-3 py-2 bg-transparent text-sm", themes[theme].input)}
                      >
                        <option value="">Nessun progetto</option>
                        {workspaceProjects.map((project) => (
                          <option key={project.id} value={project.id} className="bg-zinc-900">
                            {project.name}
                          </option>
                        ))}
                        <option value="__new__">+ Nuovo progetto…</option>
                      </select>
                      {projectCreationMode && (
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                          <input
                            value={projectDraft}
                            onChange={(event) => setProjectDraft(event.target.value)}
                            placeholder="Nome progetto"
                            className={classNames("rounded-lg border px-3 py-2 bg-transparent text-sm", themes[theme].input)}
                          />
                          <div className="flex gap-2">
                            <input
                              value={statusDraft}
                              onChange={(event) => setStatusDraft(event.target.value)}
                              placeholder="Stato iniziale"
                              className={classNames("w-full rounded-lg border px-3 py-2 bg-transparent text-sm", themes[theme].input)}
                            />
                            <button
                              onClick={handleCreateProjectFromDraft}
                              className={classNames(
                                "flex items-center gap-1 rounded-lg px-3 py-2 text-xs",
                                themes[theme].button,
                                !projectDraft.trim() && "opacity-60 cursor-not-allowed"
                              )}
                              disabled={!projectDraft.trim()}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Crea
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500">Stato</label>
                      <select
                        value={statusCreationMode ? '__new__' : (workspaceSelection.status || '')}
                        onChange={(event) => handleSelectStatusForPipeline(event.target.value)}
                        className={classNames("mt-2 w-full rounded-lg border px-3 py-2 bg-transparent text-sm", themes[theme].input)}
                      >
                        <option value="">Nessun stato</option>
                        {availableStatuses.map((statusValue) => (
                          <option key={statusValue} value={statusValue} className="bg-zinc-900">
                            {statusValue}
                          </option>
                        ))}
                        <option value="__new__">+ Nuovo stato…</option>
                      </select>
                      {statusCreationMode && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            value={statusDraft}
                            onChange={(event) => setStatusDraft(event.target.value)}
                            placeholder="Es. In revisione"
                            className={classNames("w-full rounded-lg border px-3 py-2 bg-transparent text-sm", themes[theme].input)}
                          />
                          <button
                            onClick={handleCreateStatusFromDraft}
                            className={classNames(
                              "flex items-center gap-1 rounded-lg px-3 py-2 text-xs",
                              themes[theme].button,
                              !statusDraft.trim() && "opacity-60 cursor-not-allowed"
                            )}
                            disabled={!statusDraft.trim()}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Aggiungi
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
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
            <div className={classNames("rounded-xl p-4 border", themes[theme].input)}>
              <div className="flex items-center gap-2 text-sm text-zinc-400"><FileText className="w-4 h-4"/> Carica un Markdown pronto</div>
              <p className="text-xs text-zinc-500 mt-1">Se hai già un documento .md verrà impaginato subito con PPUBR.</p>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <input ref={markdownInputRef} type="file" accept=".md,text/markdown" onChange={handleMarkdownFilePicked} className="hidden" disabled={busy}/>
                <button onClick={()=>markdownInputRef.current?.click()} className={classNames("px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2", themes[theme].button, busy&&"opacity-60 cursor-not-allowed")} disabled={busy}>
                  <Upload className="w-4 h-4"/>
                  Seleziona Markdown
                </button>
                {lastMarkdownUpload&&(
                  <div className="text-xs text-zinc-500 flex items-center gap-2">
                    <span className="truncate max-w-[180px]" title={lastMarkdownUpload.name}>{lastMarkdownUpload.name}</span>
                    <span>· {fmtBytes(lastMarkdownUpload.size)}</span>
                  </div>
                )}
              </div>
              <div className="text-xs text-zinc-500 mt-2">Supporta solo file .md. L'impaginazione usa PPUBR con fallback Pandoc.</div>
            </div>
          </div>
          <div className="md:col-span-1 flex flex-col gap-6">
            <div className={classNames("rounded-2xl p-5 shadow-lg border", themes[theme].card)}><div className="flex items-center justify-between"><h3 className="text-lg font-medium flex items-center gap-2"><Settings className="w-4 h-4"/> Stato</h3></div><div className="mt-4 text-sm text-zinc-300 space-y-1"><div className="flex items-center gap-2"><span className={classNames("w-2 h-2 rounded-full",secureOK?"bg-emerald-500":"bg-rose-500")}/> HTTPS/localhost: {secureOK?"OK":"Richiesto"}</div><div className="flex items-center gap-2"><span className={classNames("w-2 h-2 rounded-full",mediaSupported?"bg-emerald-500":"bg-rose-500")}/> getUserMedia: {mediaSupported?"Supportato":"No"}</div><div className="flex items-center gap-2"><span className={classNames("w-2 h-2 rounded-full",recorderSupported?"bg-emerald-500":"bg-rose-500")}/> MediaRecorder: {recorderSupported?"Supportato":"No"}</div><div className="flex items-center gap-2"><span className={classNames("w-2 h-2 rounded-full",backendUp?"bg-emerald-500":"bg-rose-500")}/> Backend: {backendUp===null?"—":backendUp?"Online":"Offline"}</div><div className="flex items-center gap-2"><span className={classNames("w-2 h-2 rounded-full",busy?"bg-yellow-400":"bg-zinc-600")}/> Pipeline: {busy?"In esecuzione…":"Pronta"}</div></div></div>
            <div className={classNames("rounded-2xl p-5 shadow-lg border", themes[theme].card)}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  {activePanel==='doc'?<FileText className="w-4 h-4"/>:<Folder className="w-4 h-4"/>}
                  <h3 className="text-lg font-medium">{activePanel==='doc'?'DOC':'Library'}</h3>
                </div>
                <div className="flex items-center gap-1 rounded-xl border border-zinc-700/60 bg-black/20 p-1">
                  <button
                    onClick={()=>setActivePanel('doc')}
                    className={classNames(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition",
                      activePanel==='doc'?"bg-indigo-600 text-white shadow":"text-zinc-300 hover:text-white"
                    )}
                  >
                    DOC
                  </button>
                  <button
                    onClick={()=>setActivePanel('library')}
                    className={classNames(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition",
                      activePanel==='library'?"bg-indigo-600 text-white shadow":"text-zinc-300 hover:text-white"
                    )}
                  >
                    Library
                  </button>
                </div>
              </div>
              <div className="mt-3 text-sm">
                {activePanel==='doc' ? (
                  <div className="space-y-3">
                    {busy && (
                      <div>
                        <div className="text-zinc-400">Creazione PDF in corso...</div>
                        <div className="w-full bg-zinc-700 rounded-full h-2.5 mt-2 overflow-hidden">
                          <div className="h-2.5 rounded-full progress-bar-animated"></div>
                        </div>
                      </div>
                    )}
                    {mdPath && (
                      <div className={classNames("rounded-lg p-3 break-all border", themes[theme].input)}>
                        <div className="text-zinc-400">Markdown sorgente:</div>
                        <div className="text-sky-300 font-mono text-xs mt-1">{mdPath}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <a
                            href={mdDownloadUrl || '#'}
                            className={classNames(
                              "px-3 py-2 rounded-lg text-xs",
                              themes[theme].button,
                              !mdDownloadUrl && "pointer-events-none opacity-60"
                            )}
                            target={mdDownloadUrl ? '_blank' : undefined}
                            rel={mdDownloadUrl ? 'noreferrer' : undefined}
                          >
                            Apri/Scarica MD
                          </a>
                        </div>
                      </div>
                    )}
                    {pdfPath ? (
                      <div className={classNames("rounded-lg p-3 break-all border", themes[theme].input)}>
                        <div className="text-zinc-400">PDF creato:</div>
                        <div className="text-emerald-300 font-mono text-xs mt-1">{pdfPath}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <a href={pdfDownloadUrl} className={classNames("px-3 py-2 rounded-lg text-xs", themes[theme].button)} target="_blank" rel="noreferrer">
                            Apri/Scarica PDF
                          </a>
                        </div>
                      </div>
                    ) : (
                      !busy && <div className="text-zinc-500">Nessun file ancora creato.</div>
                    )}
                    {history.length>0 && (
                      <div className="text-xs text-zinc-500">
                        Cronologia disponibile nella Libreria: {history.length} sessione{history.length===1?'':'i'} salvate.
                      </div>
                    )}
                  </div>
                ) : (
                  <LibraryPanel
                    entries={history}
                    filter={historyFilter}
                    onFilterChange={setHistoryFilter}
                    onOpenPdf={handleOpenHistoryPdf}
                    onOpenMd={handleOpenHistoryMd}
                    onShowLogs={handleShowHistoryLogs}
                    onRename={handleRenameHistoryEntry}
                    onUpdateTags={handleUpdateHistoryTags}
                    onDeleteEntry={handleDeleteHistoryEntry}
                    onClearAll={handleClearHistory}
                    themeStyles={themes[theme]}
                    activePdfPath={pdfPath}
                    onRepublish={handleRepublishFromMd}
                    busy={busy}
                  />
                )}
              </div>
            </div>
            <div className={classNames("rounded-2xl p-5 shadow-lg border space-y-4", themes[theme].card)}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-medium flex items-center gap-2"><Cpu className="w-4 h-4"/> Pipeline</h3>
                <div className="flex items-center gap-2">
                  <span className={classNames("inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-medium transition", headerStatus.className)}>
                    <HeaderIcon className="h-4 w-4"/>
                    {headerStatus.text}
                  </span>
                  <button
                    onClick={() => setShowRawLogs(prev => !prev)}
                    className={classNames(
                      "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                      themes[theme].input,
                      themes[theme].input_hover
                    )}
                  >
                    <Bug className="h-3.5 w-3.5"/>
                    {showRawLogs ? 'Nascondi log grezzi' : 'Mostra log grezzi'}
                  </button>
                </div>
              </div>
              <div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-indigo-300 to-emerald-300 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                  <span>{completedStagesCount}/{totalStages} step completati</span>
                  <span>{progressPercent}%</span>
                </div>
              </div>
              <div className="space-y-4">
                {PIPELINE_STAGES.map((stage, index) => {
                  const status = pipelineStatus[stage.key] || 'idle';
                  const Icon = stage.icon || Cpu;
                  const prevStatus = index > 0 ? (pipelineStatus[PIPELINE_STAGES[index - 1].key] || 'idle') : null;
                  const connectorClass = prevStatus === 'done' ? 'bg-emerald-500/40' : prevStatus === 'failed' ? 'bg-rose-500/40' : 'bg-zinc-700/60';
                  const stageStyle = STAGE_STATUS_STYLES[status] || STAGE_STATUS_STYLES.idle;
                  const isActive = failedStage ? failedStage.key === stage.key : activeStageKey === stage.key;
                  const stageMessage = stageMessages[stage.key];
                  return (
                    <div key={stage.key} className="relative pl-10">
                      {index !== 0 && (
                        <div className={classNames('absolute left-3 top-0 h-full w-px transition-colors', connectorClass)} />
                      )}
                      <div className={classNames(
                        'absolute left-0 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border text-xs transition-all',
                        stageStyle,
                        isActive && 'ring-2 ring-indigo-400/60'
                      )}>
                        <Icon className="h-3.5 w-3.5"/>
                      </div>
                      <div className={classNames(
                        'rounded-lg border px-3 py-2 transition-all',
                        stageStyle,
                        isActive && 'shadow-lg shadow-indigo-500/10'
                      )}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-zinc-100">{stage.label}</div>
                          <span className={classNames(
                            'rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                            stageStyle,
                            status === 'running' && 'animate-pulse'
                          )}>
                            {STAGE_STATUS_LABELS[status] || status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-300">{stage.description}</p>
                        {stageMessage && (
                          <div
                            className={classNames(
                              'mt-2 rounded-md border px-3 py-2 text-xs font-mono leading-relaxed whitespace-pre-wrap',
                              status === 'failed' ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-zinc-700/60 bg-black/20 text-zinc-200'
                            )}
                          >
                            {stageMessage}
                          </div>
                        )}
                        {status === 'failed' && stage.help && (
                          <div className="mt-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                            {stage.help}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {!showRawLogs && logs?.length > 0 && (
                <div className="text-xs text-zinc-500">
                  {logs.length} righe di log disponibili. Apri i log grezzi per i dettagli completi.
                </div>
              )}
              {showRawLogs && (
                <div className={classNames('mt-2 max-h-56 overflow-auto rounded-xl border p-3 font-mono text-xs leading-relaxed', themes[theme].log)}>
                  {logs?.length ? (
                    logs.map((ln, i) => (
                      <div key={i} className="whitespace-pre-wrap">
                        {ln}
                      </div>
                    ))
                  ) : (
                    <div className="text-zinc-500">Nessun log ancora.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="mt-8">
          <WorkspaceNavigator
            entries={history}
            workspaces={workspaces}
            selection={navigatorSelection}
            onSelectionChange={setNavigatorSelection}
            savedFilters={savedWorkspaceFilters}
            onSaveFilter={handleSaveWorkspaceFilter}
            onDeleteFilter={handleDeleteWorkspaceFilter}
            onApplyFilter={handleApplyWorkspaceFilter}
            searchTerm={historyFilter}
            onSearchChange={setHistoryFilter}
            fetchPreview={fetchEntryPreview}
            onOpenPdf={handleOpenHistoryPdf}
            onOpenMd={handleOpenHistoryMd}
            onRepublish={handleRepublishFromMd}
            onShowLogs={handleShowHistoryLogs}
            onAssignWorkspace={handleAssignEntryWorkspace}
            themeStyles={themes[theme]}
            loading={workspaceLoading}
            onRefresh={handleRefreshWorkspaces}
            pipelineSelection={workspaceSelection}
            onAdoptSelection={handleAdoptNavigatorSelection}
          />
        </div>
        {!onboardingComplete && (
          <div className="mt-10 text-xs text-zinc-500">
            <p>Assicurati che il backend sia attivo su http://localhost:7788 e che ffmpeg e la toolchain siano configurati nella shell di esecuzione.</p>
          </div>
        )}
      </div>
      <SetupAssistant
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        steps={onboardingSteps}
        currentStep={onboardingStep}
        onStepChange={setOnboardingStep}
        onFinish={handleOnboardingFinish}
      />
      <MarkdownEditorModal
        open={mdEditor.open}
        title={mdEditor?.entry?.title || mdEditor?.entry?.slug || ''}
        path={mdEditor.path}
        value={mdEditor.content}
        onChange={handleMdEditorChange}
        onClose={handleMdEditorClose}
        onSave={handleMdEditorSave}
        onRepublish={handleRepublishFromEditor}
        loading={mdEditor.loading}
        saving={mdEditor.saving}
        error={mdEditor.error}
        success={mdEditor.success}
        hasUnsavedChanges={mdEditorDirty}
        downloadUrl={mdEditorDownloadUrl}
        busy={busy}
        themeStyles={themes[theme]}
      />
    </div>
  );
}


