import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Mic, Square, Settings, Folder, FileText, FileCode, Cpu, Download, TimerIcon, Waves, CheckCircle2, AlertCircle, LinkIcon, Upload, RefreshCw, Bug, XCircle, Info, Maximize, Sparkles, Plus, Users } from "./components/icons";
import AppShell from "./components/layout/AppShell";
import CreatePage from "./pages/Create";
import LibraryPage from "./pages/Library";
import EditorPage from "./pages/Editor";
import { useMicrophoneAccess } from "./hooks/useMicrophoneAccess";
import { useBackendDiagnostics } from "./hooks/useBackendDiagnostics";
import { pickBestMime } from "./utils/media";
import LoginPage from "./components/LoginPage";
import supabase from "./supabaseClient";
import { AppProvider } from "./hooks/useAppContext";

const DEFAULT_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:7788';

const fmtBytes = (bytes) => { if (!bytes && bytes !== 0) return "—"; const u=["B","KB","MB","GB"]; let i=0,v=bytes; while(v>=1024&&i<u.length-1){v/=1024;i++;} return `${v.toFixed(v<10&&i>0?1:0)} ${u[i]}`; };
const fmtTime = (s) => { const h=Math.floor(s/3600); const m=Math.floor((s%3600)/60); const sec=Math.floor(s%60); return [h,m,sec].map(n=>String(n).padStart(2,'0')).join(":"); };
const HISTORY_STORAGE_KEY = 'rec2pdfHistory';
const HISTORY_LIMIT = 100;
const WORKSPACE_SELECTION_KEY = 'rec2pdfWorkspaceSelection';
const WORKSPACE_FILTERS_KEY = 'rec2pdfWorkspaceFilters';
const PROMPT_SELECTION_KEY = 'rec2pdfPromptSelection';
const PROMPT_FAVORITES_KEY = 'rec2pdfPromptFavorites';
const HISTORY_TABS = [
  { key: 'history', label: 'Cronologia' },
  { key: 'cloud', label: 'Cloud library' },
];
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

const buildFileUrl = (backendUrl, filePath, options = {}) => {
  const normalized = normalizeBackendUrlValue(backendUrl);
  if (!normalized || !filePath) return '';
  const params = new URLSearchParams({ path: filePath });
  const token = typeof options?.token === 'string' ? options.token.trim() : '';
  if (token) {
    params.set('token', token);
  }
  return `${normalized}/api/file?${params.toString()}`;
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
    promptChecklist: structure.promptChecklist
      ? {
          sections: Array.isArray(structure.promptChecklist.sections)
            ? structure.promptChecklist.sections
            : [],
          missing: Array.isArray(structure.promptChecklist.missing)
            ? structure.promptChecklist.missing
            : [],
          score: Number.isFinite(structure.promptChecklist.score)
            ? Math.min(100, Math.max(0, Number(structure.promptChecklist.score)))
            : null,
          completed: Number.isFinite(structure.promptChecklist.completed)
            ? Number(structure.promptChecklist.completed)
            : null,
          total: Number.isFinite(structure.promptChecklist.total)
            ? Number(structure.promptChecklist.total)
            : null,
        }
      : null,
  };
};

const normalizePromptEntry = (prompt) => {
  if (!prompt || typeof prompt !== 'object') {
    return null;
  }
  const cueCards = Array.isArray(prompt.cueCards)
    ? prompt.cueCards
        .map((card, index) => {
          if (!card || typeof card !== 'object') return null;
          const title = String(card.title || card.label || '').trim();
          if (!title) return null;
          return {
            key: card.key || card.id || `cue_${index}`,
            title,
            hint: String(card.hint || card.description || '').trim(),
          };
        })
        .filter(Boolean)
    : [];
  const checklistSections = Array.isArray(prompt?.checklist?.sections)
    ? prompt.checklist.sections.map((section) => String(section || '').trim()).filter(Boolean)
    : Array.isArray(prompt?.checklist)
    ? prompt.checklist.map((section) => String(section || '').trim()).filter(Boolean)
    : [];
  const completedCues = Array.isArray(prompt.completedCues)
    ? prompt.completedCues.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  return {
    id: prompt.id || '',
    slug: prompt.slug || '',
    title: prompt.title || '',
    summary: typeof prompt.summary === 'string' ? prompt.summary.trim() : '',
    description: prompt.description || '',
    persona: prompt.persona || '',
    color: prompt.color || '#6366f1',
    tags: Array.isArray(prompt.tags) ? prompt.tags.filter(Boolean) : [],
    cueCards,
    checklist: { sections: checklistSections },
    markdownRules: prompt.markdownRules || null,
    pdfRules: prompt.pdfRules || null,
    focus: prompt.focus || '',
    notes: prompt.notes || '',
    completedCues,
    builtIn: Boolean(prompt.builtIn),
  };
};

const buildPromptState = (overrides = {}) => ({
  promptId: '',
  focus: '',
  notes: '',
  cueProgress: {},
  expandPromptDetails: true,
  ...overrides,
});

const isFileLike = (value) => {
  if (!value) return false;
  const FileCtor = typeof File !== 'undefined' ? File : null;
  const BlobCtor = typeof Blob !== 'undefined' ? Blob : null;
  if (FileCtor && value instanceof FileCtor) return true;
  if (BlobCtor && value instanceof BlobCtor) return true;
  return false;
};

const appendPdfLogoIfPresent = (formData, logo) => {
  if (!formData || !isFileLike(logo)) {
    return false;
  }
  const fallbackName = 'custom-logo';
  const fileName = typeof logo.name === 'string' && logo.name.trim() ? logo.name : fallbackName;
  formData.append('pdfLogo', logo, fileName);
  return true;
};

const resolvePdfLogoLabel = (logo) => {
  if (!isFileLike(logo)) {
    return 'default';
  }
  const label = typeof logo.name === 'string' && logo.name.trim() ? logo.name.trim() : '';
  return label || 'custom';
};

const hydrateHistoryEntry = (entry) => {
  if (!entry) return null;
  const pdfPath = entry.pdfPath || '';
  const mdPath = deriveMarkdownPath(entry.mdPath, pdfPath);
  const backendUrl = normalizeBackendUrlValue(entry.backendUrl || '');
  const pdfUrl =
    entry.pdfUrl && entry.pdfUrl.startsWith('http') && !entry.pdfUrl.includes('/api/file?')
      ? entry.pdfUrl
      : '';
  const mdUrl =
    entry.mdUrl && entry.mdUrl.startsWith('http') && !entry.mdUrl.includes('/api/file?')
      ? entry.mdUrl
      : '';
  const workspace = normalizeWorkspaceEntry(entry.workspace);
  const structure = normalizeStructureMeta(entry.structure);
  const prompt = normalizePromptEntry(entry.prompt);

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
    prompt,
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
  },
  executive: {
    bg: "from-[#030712] via-[#0b1220] to-[#0f172a]",
    card: "bg-slate-900/60 border-emerald-500/20 backdrop-blur",
    input: "bg-slate-900/50 border-emerald-500/30 backdrop-blur",
    input_hover: "hover:bg-slate-900/40",
    button: "bg-emerald-500 hover:bg-emerald-400 text-slate-900 border-emerald-300 font-semibold",
    log: "bg-slate-950/70 border-emerald-500/20",
  },
  boardroom: {
    bg: "from-[#020817] via-[#0b1a33] to-[#123552]",
    card: "border-white/18 bg-gradient-to-br from-white/[0.08] via-white/[0.02] to-transparent backdrop-blur-2xl shadow-[0_30px_80px_-45px_rgba(7,23,45,0.9)]",
    input: "border-white/15 bg-white/[0.015] backdrop-blur-2xl",
    input_hover: "hover:border-white/35 hover:bg-white/[0.04]",
    button: "bg-gradient-to-r from-[#5dd5c4] via-[#39b0ff] to-[#5a78ff] text-slate-950 border-transparent font-semibold shadow-md shadow-black/20 hover:from-[#39b0ff] hover:via-[#5a78ff] hover:to-[#7b5dff]",
    log: "border-white/15 bg-[#061226]/70 backdrop-blur-xl",
  },
};

function AppContent(){
  const [session, setSession] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [recording,setRecording]=useState(false);
  const [elapsed,setElapsed]=useState(0);
  const [level,setLevel]=useState(0);
  const [audioBlob,setAudioBlob]=useState(null);
  const [audioUrl,setAudioUrl]=useState("");
  const [mime,setMime]=useState("");
  const [destDir,setDestDir]=useState("/Users/tuo_utente/Recordings");
  const [slug,setSlug]=useState("meeting");
  const [secondsCap,setSecondsCap]=useState(0);
  const [backendUrl,setBackendUrl]=useState(DEFAULT_BACKEND_URL);
  const [busy,setBusy]=useState(false);
  const [logs,setLogs]=useState([]);
  const [pdfPath,setPdfPath]=useState("");
  const [mdPath, setMdPath] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const initializeSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!isMounted) {
          return;
        }
        if (error) {
          console.error('Errore recupero sessione Supabase:', error);
        }
        setSession(data?.session ?? null);
      } catch (error) {
        if (isMounted) {
          console.error('Errore recupero sessione Supabase:', error);
        }
      } finally {
        if (isMounted) {
          setSessionChecked(true);
        }
      }
    };

    initializeSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setSessionChecked(true);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);
  const [errorBanner,setErrorBanner]=useState(null);
  const handleLogout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setErrorBanner({ title: 'Logout fallito', details: error.message || 'Errore sconosciuto.' });
      }
    } catch (error) {
      setErrorBanner({ title: 'Logout fallito', details: error.message || 'Errore sconosciuto.' });
    }
  }, [setErrorBanner]);
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') {
      return 'boardroom';
    }
    const saved = localStorage.getItem('theme');
    return saved && themes[saved] ? saved : 'boardroom';
  });
  const [showDestDetails,setShowDestDetails]=useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeSettingsSection, setActiveSettingsSection] = useState(null);
  const [showSetupAssistant, setShowSetupAssistant] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('onboardingComplete');
  });
  const openSettingsDrawer = useCallback(
    (section = null, options = {}) => {
      const { showAssistant = false } = options;
      setActiveSettingsSection(section);
      setShowSetupAssistant(showAssistant);
      setSettingsOpen(true);
    },
    [setActiveSettingsSection, setShowSetupAssistant, setSettingsOpen],
  );
  const [customLogo, setCustomLogo] = useState(null);
  const [customPdfLogo, setCustomPdfLogo] = useState(null);
  const [lastMarkdownUpload,setLastMarkdownUpload]=useState(null);
  const [lastTextUpload, setLastTextUpload] = useState(null);
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
  const [prompts, setPrompts] = useState([]);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptState, setPromptState] = useState(() => {
    if (typeof window === 'undefined') {
      return buildPromptState();
    }
    try {
      const raw = localStorage.getItem(PROMPT_SELECTION_KEY);
      if (!raw) {
        return buildPromptState();
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return buildPromptState();
      }
      return buildPromptState({
        promptId: parsed.promptId || '',
        focus: parsed.focus || '',
        notes: parsed.notes || '',
        cueProgress:
          parsed.cueProgress && typeof parsed.cueProgress === 'object'
            ? parsed.cueProgress
            : {},
        expandPromptDetails: parsed.expandPromptDetails === false ? false : true,
      });
    } catch {
      return buildPromptState();
    }
  });
  const [promptFavorites, setPromptFavorites] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(PROMPT_FAVORITES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(Boolean);
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
  const [historyTab, setHistoryTab] = useState('history');
  const [activePanel, setActivePanel] = useState('doc');
  const [mdEditor, setMdEditor] = useState(() => ({ ...EMPTY_EDITOR_STATE }));
  const [sessionToken, setSessionToken] = useState('');
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
  } = useBackendDiagnostics(backendUrl, session);
  const [onboardingComplete, setOnboardingComplete] = useState(() => localStorage.getItem('onboardingComplete') === 'true');
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
  const textInputRef = useRef(null);
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
    if (!themes[theme]) {
      setTheme('boardroom');
      return;
    }
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
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(PROMPT_SELECTION_KEY, JSON.stringify(promptState));
    } catch {
      // ignore persistence errors
    }
  }, [promptState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(PROMPT_FAVORITES_KEY, JSON.stringify(promptFavorites));
    } catch {
      // ignore persistence errors
    }
  }, [promptFavorites]);

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
    if (!promptState.promptId) return;
    const exists = prompts.some((prompt) => prompt.id === promptState.promptId);
    if (!exists) {
      setPromptState(buildPromptState());
    }
  }, [prompts, promptState.promptId]);

  useEffect(() => {
    if (!Array.isArray(prompts) || prompts.length === 0) return;
    setPromptState((prev) => {
      if (prev.promptId) {
        return prev;
      }
      const defaultPrompt = prompts.find((prompt) => {
        const slugMatch = typeof prompt.slug === 'string' && prompt.slug === 'format_base';
        const titleMatch =
          typeof prompt.title === 'string' && prompt.title.trim().toLowerCase() === 'format base';
        return slugMatch || titleMatch;
      });
      if (!defaultPrompt || !defaultPrompt.id) {
        return prev;
      }
      return buildPromptState({
        promptId: defaultPrompt.id,
        focus: prev.focus || '',
        notes: prev.notes || '',
        cueProgress: {},
        expandPromptDetails: false,
      });
    });
  }, [prompts, setPromptState]);

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

  const getSessionToken = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      return data?.session?.access_token || null;
    } catch (error) {
      console.warn('Unable to retrieve session token', error);
      return null;
    }
  }, []);

  const applyAuthToOptions = useCallback(
    async (options = {}) => {
      const token = await getSessionToken();
      if (!token) {
        return { ...options };
      }
      const headers = new Headers(options.headers || {});
      headers.set('Authorization', `Bearer ${token}`);
      return { ...options, headers };
    },
    [getSessionToken]
  );

  const fetchBodyWithAuth = useCallback(
    async (url, options = {}) => {
      const optsWithAuth = await applyAuthToOptions(options);
      return fetchBody(url, optsWithAuth);
    },
    [applyAuthToOptions, fetchBody]
  );

  const fetchWithAuth = useCallback(
    async (url, options = {}) => {
      const optsWithAuth = await applyAuthToOptions(options);
      return fetch(url, optsWithAuth);
    },
    [applyAuthToOptions]
  );

  const requestSignedFileUrl = useCallback(
    async (backendUrl, filePath) => {
      const normalizedBackend = normalizeBackendUrlValue(backendUrl);
      if (!normalizedBackend) {
        throw new Error('Backend non configurato.');
      }
      const trimmedPath = typeof filePath === 'string' ? filePath.trim() : '';
      if (!trimmedPath) {
        throw new Error('Percorso file non disponibile.');
      }

      const token = sessionToken || (await getSessionToken()) || '';
      const target = buildFileUrl(normalizedBackend, trimmedPath, token ? { token } : undefined);
      const response = await fetchWithAuth(target, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      if (!response.ok) {
        const message = payload?.message || `Impossibile generare URL firmato (HTTP ${response.status})`;
        throw new Error(message);
      }

      const signedUrl = typeof payload?.url === 'string' ? payload.url.trim() : '';
      if (!signedUrl) {
        throw new Error('URL firmato non disponibile.');
      }

      return signedUrl;
    },
    [fetchWithAuth, getSessionToken, sessionToken]
  );

  const openSignedFileInNewTab = useCallback(
    async ({ backendUrl, path, label = 'file', directUrl = '' }) => {
      const normalizedPath = typeof path === 'string' ? path.trim() : '';
      if (!normalizedPath) {
        throw new Error(`Percorso ${label} non disponibile.`);
      }

      if (typeof window === 'undefined') {
        throw new Error(`Impossibile aprire il ${label} in questo ambiente.`);
      }

      const newTab = window.open('about:blank', '_blank');
      if (!newTab) {
        throw new Error(`Apertura del ${label} bloccata dal browser. Abilita i pop-up e riprova.`);
      }

      try {
        if (directUrl) {
          newTab.location.href = directUrl;
          return { url: directUrl, tab: newTab };
        }

        const normalizedBackend = normalizeBackendUrlValue(backendUrl);
        if (!normalizedBackend) {
          throw new Error(`Backend non configurato per aprire il ${label}.`);
        }

        const signedUrl = await requestSignedFileUrl(normalizedBackend, normalizedPath);
        newTab.location.href = signedUrl;
        return { url: signedUrl, tab: newTab };
      } catch (error) {
        if (!newTab.closed) {
          newTab.close();
        }
        throw error;
      }
    },
    [requestSignedFileUrl]
  );

  const fetchPrompts = useCallback(
    async (options = {}) => {
      const normalized = normalizeBackendUrlValue(options.backendUrlOverride || backendUrl);
      if (!normalized) {
        if (!options?.silent) {
          setPrompts([]);
        }
        return { ok: false, status: 0, message: 'Backend non configurato', skipped: true };
      }
      if (!options?.silent) {
        setPromptLoading(true);
      }
      try {
        const result = await fetchBodyWithAuth(`${normalized}/api/prompts`, { method: 'GET' });
        if (result.ok && Array.isArray(result.data?.prompts)) {
          setPrompts(result.data.prompts);
        } else if (!result.ok && !options?.silent) {
          const message = result.data?.message || result.raw || 'Impossibile caricare i prompt.';
          pushLogs([`⚠️ API prompt: ${message}`]);
        }
        return result;
      } catch (error) {
        if (!options?.silent) {
          pushLogs([`⚠️ Errore prompt: ${error?.message || String(error)}`]);
        }
        return { ok: false, status: 0, error };
      } finally {
        if (!options?.silent) {
          setPromptLoading(false);
        }
      }
    },
    [backendUrl, fetchBodyWithAuth, pushLogs]
  );

  useEffect(() => {
    if (!backendUrl || !sessionChecked) {
      setPrompts([]);
      return;
    }
    fetchPrompts({ silent: true });
  }, [backendUrl, fetchPrompts, sessionChecked]);

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
        const result = await fetchBodyWithAuth(`${normalized}/api/workspaces`, { method: 'GET' });
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
    [backendUrl, fetchBodyWithAuth, pushLogs]
  );

  useEffect(() => {
    if (!sessionChecked) return;
    fetchWorkspaces({ silent: true });
  }, [fetchWorkspaces, sessionChecked]);

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
        const response = await fetchWithAuth(`${normalized}/api/workspaces`, {
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
    [backendUrl, fetchWithAuth, pushLogs, workspaceSelection.workspaceId]
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
        const response = await fetchWithAuth(`${normalized}/api/workspaces/${workspaceId}`, {
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
    [backendUrl, fetchWithAuth, workspaces, fetchWorkspaces, pushLogs]
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

  const handleLibraryWorkspaceSelection = useCallback(
    (assignment = {}) => {
      const nextSelection = {
        workspaceId: assignment?.workspaceId || assignment?.id || '',
        projectId: assignment?.projectId || '',
        projectName: assignment?.projectName || '',
        status: assignment?.status || '',
      };
      setNavigatorSelection((prev) => {
        if (
          prev.workspaceId === nextSelection.workspaceId &&
          prev.projectId === nextSelection.projectId &&
          (prev.projectName || '') === (nextSelection.projectName || '') &&
          (prev.status || '') === (nextSelection.status || '')
        ) {
          return prev;
        }
        return nextSelection;
      });
    },
    [setNavigatorSelection]
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
        const response = await fetchWithAuth(
          `${backendTarget}/api/markdown?path=${encodeURIComponent(mdPathResolved)}`,
          { method: 'GET' }
        );
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
        const token = await getSessionToken();
        return {
          ok: true,
          markdown,
          pdfUrl: buildFileUrl(backendTarget, entry.pdfPath, token ? { token } : undefined),
          mdUrl: buildFileUrl(backendTarget, mdPathResolved, token ? { token } : undefined),
        };
      } catch (error) {
        return { ok: false, message: error?.message || 'Errore durante il recupero dell\'anteprima.' };
      }
    },
    [backendUrl, fetchWithAuth, getSessionToken]
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

  const handleSelectPromptTemplate = useCallback((prompt) => {
    if (!prompt || !prompt.id) {
      setPromptState(buildPromptState());
      return;
    }
    setPromptState((prev) => {
      if (prev.promptId === prompt.id) {
        return prev;
      }
      return buildPromptState({ promptId: prompt.id });
    });
  }, []);

  const handleClearPromptSelection = useCallback(() => {
    setPromptState(buildPromptState());
  }, []);

  const handlePromptFocusChange = useCallback((value) => {
    setPromptState((prev) => ({ ...prev, focus: value }));
  }, []);

  const handlePromptNotesChange = useCallback((value) => {
    setPromptState((prev) => ({ ...prev, notes: value }));
  }, []);

  const handleTogglePromptCue = useCallback((cueKey) => {
    setPromptState((prev) => {
      const next = {
        ...prev,
        cueProgress: { ...(prev.cueProgress || {}) },
      };
      next.cueProgress[cueKey] = !next.cueProgress[cueKey];
      return next;
    });
  }, []);

  const handleTogglePromptFavorite = useCallback((promptId) => {
    setPromptFavorites((prev) => {
      const set = new Set(prev);
      if (set.has(promptId)) {
        set.delete(promptId);
      } else {
        set.add(promptId);
      }
      return Array.from(set);
    });
  }, []);

  const handleRefreshPrompts = useCallback(() => {
    fetchPrompts({ silent: false });
  }, [fetchPrompts]);

  const handleCreatePrompt = useCallback(
    async (payload) => {
      const normalized = normalizeBackendUrlValue(backendUrl);
      if (!normalized) {
        return { ok: false, message: 'Configura un backend valido prima di creare prompt.' };
      }
      const result = await fetchBodyWithAuth(`${normalized}/api/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (result.ok && result.data?.prompt) {
        setPrompts((prev) => {
          const next = prev.filter((item) => item.id !== result.data.prompt.id);
          next.unshift(result.data.prompt);
          return next;
        });
        return { ok: true, prompt: result.data.prompt };
      }
      const message = result.data?.message || result.raw || 'Impossibile creare il prompt.';
      return { ok: false, message };
    },
    [backendUrl, fetchBodyWithAuth]
  );

  const handleDeletePrompt = useCallback(
    async (promptId) => {
      const normalized = normalizeBackendUrlValue(backendUrl);
      if (!normalized) {
        return { ok: false, message: 'Backend non configurato' };
      }
      const result = await fetchBodyWithAuth(`${normalized}/api/prompts/${encodeURIComponent(promptId)}`, {
        method: 'DELETE',
      });
      if (result.ok) {
        setPrompts((prev) => prev.filter((prompt) => prompt.id !== promptId));
        setPromptFavorites((prev) => prev.filter((id) => id !== promptId));
        setPromptState((prev) => (prev.promptId === promptId ? buildPromptState() : prev));
      }
      return result;
    },
    [backendUrl, fetchBodyWithAuth]
  );

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

  const processViaBackend=async()=>{
    const blob=audioBlob;
    if(!blob) return;
    const blobSource='name'in blob?'upload':'recording';
    if(!backendUrl){
      setErrorBanner({title:'Backend URL mancante',details:`Imposta ${DEFAULT_BACKEND_URL} o il tuo endpoint.`});
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
      fd.append('audio',blob,`${blobSource}.${ext}`);
      appendPdfLogoIfPresent(fd, customPdfLogo);
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
      if (promptState.promptId) {
        fd.append('promptId', promptState.promptId);
        if (promptState.focus && promptState.focus.trim()) {
          fd.append('promptFocus', promptState.focus.trim());
        }
        if (promptState.notes && promptState.notes.trim()) {
          fd.append('promptNotes', promptState.notes.trim());
        }
        if (promptCompletedCues.length) {
          fd.append('promptCuesCompleted', JSON.stringify(promptCompletedCues));
        }
      }
      const cap=Number(secondsCap||0);
      if(cap>0) fd.append('seconds',String(cap));
      const {ok,status,data,raw}=await fetchBodyWithAuth(`${backendUrl}/api/rec2pdf`,{method:'POST',body:fd});
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
          pdf: resolvePdfLogoLabel(customPdfLogo),
        };
        const structureMeta = data?.structure || null;
        if (structureMeta && Number.isFinite(structureMeta.score)) {
          appendLogs([`📊 Completezza stimata: ${structureMeta.score}%`]);
          if (Array.isArray(structureMeta.missingSections) && structureMeta.missingSections.length) {
            appendLogs([`🧩 Sezioni mancanti: ${structureMeta.missingSections.join(', ')}`]);
          }
        }
        const fallbackPrompt = promptState.promptId
          ? {
              id: promptState.promptId,
              title: activePrompt?.title || '',
              slug: activePrompt?.slug || '',
              description: activePrompt?.description || '',
              persona: activePrompt?.persona || '',
              color: activePrompt?.color || '#6366f1',
              tags: Array.isArray(activePrompt?.tags) ? activePrompt.tags : [],
              cueCards: Array.isArray(activePrompt?.cueCards) ? activePrompt.cueCards : [],
              checklist: activePrompt?.checklist || null,
              markdownRules: activePrompt?.markdownRules || null,
              pdfRules: activePrompt?.pdfRules || null,
              focus: promptState.focus || '',
              notes: promptState.notes || '',
              completedCues: promptCompletedCues,
              builtIn: Boolean(activePrompt?.builtIn),
            }
          : null;
        const promptSummary = data?.prompt || fallbackPrompt;
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
          source:blobSource,
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
          prompt: promptSummary,
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

  const processMarkdownUpload=async(file,options={})=>{
    if(!file) return;
    if(!backendUrl){
      setErrorBanner({title:'Backend URL mancante',details:`Imposta ${DEFAULT_BACKEND_URL} o il tuo endpoint.`});
      return;
    }
    const endpointOverride=options.endpoint;
    const fileFieldName=options.fileFieldName||'markdown';
    const startMessage=options.startMessage||`🚀 Avvio impaginazione da Markdown: ${file.name}`;
    const fallbackEventsOverride=Array.isArray(options.fallbackEvents)?options.fallbackEvents:null;
    const extraFormData=options.extraFormData||null;
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
    appendLogs([startMessage]);
    try{
      const fd=new FormData();
      fd.append(fileFieldName,file,file.name);
      appendPdfLogoIfPresent(fd, customPdfLogo);
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
      if (promptState.promptId) {
        fd.append('promptId', promptState.promptId);
        if (promptState.focus && promptState.focus.trim()) {
          fd.append('promptFocus', promptState.focus.trim());
        }
        if (promptState.notes && promptState.notes.trim()) {
          fd.append('promptNotes', promptState.notes.trim());
        }
        if (promptCompletedCues.length) {
          fd.append('promptCuesCompleted', JSON.stringify(promptCompletedCues));
        }
      }
      if(extraFormData&&typeof extraFormData==='object'){
        Object.entries(extraFormData).forEach(([key,value])=>{
          if(typeof value==='undefined'||value===null) return;
          fd.append(key,value);
        });
      }
      const targetEndpoint=endpointOverride||`${backendUrl}/api/ppubr-upload`;
      let endpointLabel='/api/ppubr-upload';
      try{
        const parsed=new URL(targetEndpoint);
        endpointLabel=parsed.pathname||endpointLabel;
      }catch{
        const match=targetEndpoint.match(/\/api\/[a-zA-Z0-9_-]+/);
        if(match&&match[0]) endpointLabel=match[0];
        else endpointLabel=targetEndpoint;
      }
      const {ok,status,data,raw,contentType}=await fetchBodyWithAuth(targetEndpoint,{method:'POST',body:fd});
      const stageEventsPayload=Array.isArray(data?.stageEvents)?data.stageEvents:[];
      if(!ok){
        if(stageEventsPayload.length){
          handlePipelineEvents(stageEventsPayload,{animate:false});
        }else{
          let fallbackMessage=data?.message||(raw?raw.slice(0,200):status===0?'Connessione fallita/CORS':'Errore backend');
          if(status===404&&(raw.includes('Endpoint')||raw.includes('Cannot POST'))){
            fallbackMessage=`Endpoint ${endpointLabel} non disponibile sul backend. Riavvia o aggiorna il server.`;
          }
          handlePipelineEvents([
            {stage:'publish',status:'failed',message:fallbackMessage},
            {stage:'complete',status:'failed',message:'Pipeline interrotta'},
          ],{animate:false});
        }
        if(data?.logs?.length) appendLogs(data.logs);
        let message=data?.message||(raw?raw.slice(0,200):status===0?'Connessione fallita/CORS':'Errore backend');
        if(status===404&&(raw.includes('Endpoint')||raw.includes('Cannot POST'))){
          message=`Endpoint ${endpointLabel} non disponibile sul backend. Riavvia o aggiorna il server.`;
        } else if(status===404&&!contentType?.includes('application/json')){
          message='Risposta non valida dal backend (HTML/404). Controlla la versione del server.';
        }
        appendLogs([`❌ ${message}`]);
        setErrorBanner({title:'Impaginazione fallita',details:message});
        return;
      }
      const fallbackEvents=fallbackEventsOverride&&fallbackEventsOverride.length?fallbackEventsOverride:[
        {stage:'upload',status:'completed',message:'Markdown caricato manualmente.'},
        {stage:'transcode',status:'completed',message:'Step non necessario.'},
        {stage:'transcribe',status:'completed',message:'Trascrizione non richiesta.'},
        {stage:'markdown',status:'completed',message:'Markdown fornito.'},
        {stage:'publish',status:'completed',message:'PPUBR completato.'},
        {stage:'complete',status:'completed',message:'Pipeline conclusa.'},
      ];
      const successEvents=stageEventsPayload.length?stageEventsPayload:fallbackEvents;
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
          pdf:resolvePdfLogoLabel(customPdfLogo),
        };
        const structureMeta = data?.structure || null;
        if (structureMeta && Number.isFinite(structureMeta.score)) {
          appendLogs([`📊 Completezza stimata: ${structureMeta.score}%`]);
          if (Array.isArray(structureMeta.missingSections) && structureMeta.missingSections.length) {
            appendLogs([`🧩 Sezioni mancanti: ${structureMeta.missingSections.join(', ')}`]);
          }
        }
        const fallbackPrompt = promptState.promptId
          ? {
              id: promptState.promptId,
              title: activePrompt?.title || '',
              slug: activePrompt?.slug || '',
              description: activePrompt?.description || '',
              persona: activePrompt?.persona || '',
              color: activePrompt?.color || '#6366f1',
              tags: Array.isArray(activePrompt?.tags) ? activePrompt.tags : [],
              cueCards: Array.isArray(activePrompt?.cueCards) ? activePrompt.cueCards : [],
              checklist: activePrompt?.checklist || null,
              markdownRules: activePrompt?.markdownRules || null,
              pdfRules: activePrompt?.pdfRules || null,
              focus: promptState.focus || '',
              notes: promptState.notes || '',
              completedCues: promptCompletedCues,
              builtIn: Boolean(activePrompt?.builtIn),
            }
          : null;
        const promptSummary = data?.prompt || fallbackPrompt;
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
          prompt: promptSummary,
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

  const processTextUpload = async (file) => {
    if (!file) return;
    try {
      await processMarkdownUpload(file,{
        endpoint:`${backendUrl}/api/text-upload`,
        fileFieldName:'transcript',
        startMessage:`🚀 Avvio conversione da TXT: ${file.name}`,
        fallbackEvents:[
          {stage:'upload',status:'completed',message:'File TXT caricato.'},
          {stage:'transcode',status:'completed',message:'Step non necessario.'},
          {stage:'transcribe',status:'completed',message:'Trascrizione fornita come testo.'},
          {stage:'markdown',status:'completed',message:'Markdown generato dal TXT.'},
          {stage:'publish',status:'completed',message:'PPUBR completato.'},
          {stage:'complete',status:'completed',message:'Pipeline conclusa.'},
        ],
        extraFormData:{ sourceType:'txt' },
      });
    } catch (error) {
      const message = error?.message || String(error);
      setErrorBanner({ title: 'Conversione testo fallita', details: message });
    } finally {
      if (textInputRef.current) {
        textInputRef.current.value = '';
      }
    }
  };

  const handleTextFilePicked = async (event) => {
    const file = event.target?.files?.[0];
    if (!file) return;
    if (!/\.txt$/i.test(file.name)){
      setErrorBanner({title:'Formato non supportato',details:'Seleziona un file con estensione .txt'});
      if(textInputRef.current){
        textInputRef.current.value='';
      }
      return;
    }
    setLastTextUpload({ name: file.name, size: file.size, ts: Date.now() });
    await processTextUpload(file);
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

  const shouldShowOnboardingBanner = useMemo(() => {
    if (diagnostics.status === 'error') {
      return true;
    }
    return !onboardingComplete;
  }, [diagnostics.status, onboardingComplete]);

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
    setBackendUrl(DEFAULT_BACKEND_URL);
  }, [setBackendUrl]);

  const handleBackendSettings = useCallback(() => {
    openSettingsDrawer('advanced');
  }, [openSettingsDrawer]);

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
      ? `Inserisci l'URL del backend (es. ${DEFAULT_BACKEND_URL}).`
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
      setShowSetupAssistant(false);
    }
  }, [onboardingSteps, setShowSetupAssistant]);

  useEffect(() => {
    if (!showSetupAssistant || !onboardingSteps.length) return;
    const firstIncomplete = onboardingSteps.findIndex(step => step.status !== 'success');
    const targetIndex = firstIncomplete === -1 ? onboardingSteps.length - 1 : firstIncomplete;
    if (targetIndex !== onboardingStep) {
      setOnboardingStep(targetIndex);
    }
  }, [showSetupAssistant, onboardingSteps, onboardingStep]);

  const openSetupAssistant = useCallback(() => {
    const firstIncomplete = onboardingSteps.findIndex(step => step.status !== 'success');
    setOnboardingStep(firstIncomplete === -1 ? onboardingSteps.length - 1 : firstIncomplete);
    openSettingsDrawer('diagnostics', { showAssistant: true });
  }, [
    onboardingSteps,
    setOnboardingStep,
    openSettingsDrawer,
  ]);

  const handleOnboardingFinish = useCallback(() => {
    setOnboardingComplete(true);
    setShowSetupAssistant(false);
  }, [setOnboardingComplete, setShowSetupAssistant]);

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

  const mdEditorDirty = useMemo(() => mdEditor.content !== mdEditor.originalContent, [mdEditor.content, mdEditor.originalContent]);

  useEffect(() => {
    let isActive = true;
    const syncToken = async () => {
      const token = await getSessionToken();
      if (isActive) {
        setSessionToken(token || '');
      }
    };
    syncToken();

    let subscription = null;
    if (supabase?.auth?.onAuthStateChange) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (isActive) {
          setSessionToken(session?.access_token || '');
        }
      });
      subscription = data?.subscription || data || null;
    }

    return () => {
      isActive = false;
      if (subscription) {
        if (typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        } else if (typeof subscription === 'function') {
          subscription();
        }
      }
    };
  }, [getSessionToken]);

  const handleOpenHistoryPdf = useCallback(
    async (entry) => {
      if (!entry?.pdfPath) return;

      const rawPdfUrl = typeof entry.pdfUrl === 'string' ? entry.pdfUrl : '';
      const isBackendProxyUrl = rawPdfUrl.includes('/api/file?');
      const directUrl = rawPdfUrl.startsWith('http') && !isBackendProxyUrl ? rawPdfUrl : '';

      const backendTarget = entry?.backendUrl || normalizedBackendUrl;
      if (!directUrl && !normalizeBackendUrlValue(backendTarget)) {
        pushLogs(['❌ Backend non configurato per aprire il PDF.']);
        return;
      }

      try {
        await openSignedFileInNewTab({
          backendUrl: backendTarget,
          path: entry.pdfPath,
          label: 'PDF',
          directUrl,
        });
      } catch (error) {
        const message = error?.message || 'Impossibile aprire il PDF.';
        pushLogs([`❌ ${message}`]);
      }
    },
    [normalizedBackendUrl, openSignedFileInNewTab, pushLogs]
  );

  const handleOpenHistoryMd = useCallback(
    async (entry, overrideMdPath, options = {}) => {
      const { openInNewTab = false, skipEditor = false, backendUrlOverride, directUrlOverride } = options || {};

      const mdPathResolved = overrideMdPath || deriveMarkdownPath(entry?.mdPath, entry?.pdfPath);
      if (!mdPathResolved) {
        const label = entry?.title || entry?.slug || 'sessione';
        pushLogs([`❌ Percorso Markdown non disponibile per ${label}.`]);
        return;
      }

      const backendTarget = backendUrlOverride || entry?.backendUrl || normalizedBackendUrl;
      const normalizedBackend = normalizeBackendUrlValue(backendTarget);

      const rawMdUrl = typeof directUrlOverride === 'string' ? directUrlOverride : typeof entry?.mdUrl === 'string' ? entry.mdUrl : '';
      const isProxyUrl = rawMdUrl.includes('/api/file?');
      const directUrl = rawMdUrl.startsWith('http') && !isProxyUrl ? rawMdUrl : '';

      if (openInNewTab) {
        if (!directUrl && !normalizedBackend) {
          pushLogs(['❌ Backend non configurato per aprire il Markdown.']);
          if (skipEditor) {
            return;
          }
        } else {
          try {
            await openSignedFileInNewTab({
              backendUrl: backendTarget,
              path: mdPathResolved,
              label: 'Markdown',
              directUrl,
            });
          } catch (error) {
            const message = error?.message || 'Impossibile aprire il Markdown.';
            pushLogs([`❌ ${message}`]);
            return;
          }
        }

        if (skipEditor) {
          return;
        }
      }

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

      if (!skipEditor) {
        navigate("/editor");
      }

      try {
        const response = await fetchWithAuth(
          `${normalizedBackend}/api/markdown?path=${encodeURIComponent(mdPathResolved)}`,
          { method: 'GET' }
        );
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
    },
    [fetchWithAuth, normalizedBackendUrl, openSignedFileInNewTab, pushLogs, setErrorBanner, setHistory]
  );

  const handleOpenMdInNewTab = useCallback(() => {
    if (!mdEditor?.path) {
      return;
    }

    void handleOpenHistoryMd(mdEditor.entry, mdEditor.path, {
      openInNewTab: true,
      skipEditor: true,
      backendUrlOverride: mdEditor.backendUrl,
      directUrlOverride: mdEditor?.entry?.mdUrl || '',
    });
  }, [handleOpenHistoryMd, mdEditor]);

  const handleOpenLibraryFile = useCallback(
    async ({ backendUrl: backendOverride, path, label }) => {
      const resolvedPath = typeof path === 'string' ? path.trim() : '';
      if (!resolvedPath) {
        pushLogs(['❌ Percorso file non disponibile.']);
        return;
      }

      const backendTarget = backendOverride || normalizedBackendUrl;
      if (!normalizeBackendUrlValue(backendTarget)) {
        pushLogs(['❌ Backend non configurato per aprire il file selezionato.']);
        return;
      }

      try {
        await openSignedFileInNewTab({
          backendUrl: backendTarget,
          path: resolvedPath,
          label: label || 'file',
        });
      } catch (error) {
        const message = error?.message || 'Impossibile aprire il file selezionato.';
        pushLogs([`❌ ${message}`]);
      }
    },
    [normalizedBackendUrl, openSignedFileInNewTab, pushLogs]
  );

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
      const fd = new FormData();
      fd.append('mdPath', mdPathResolved);
      if (customPdfLogo) {
        fd.append('pdfLogo', customPdfLogo);
      }

      const response = await fetchWithAuth(`${backendUsed}/api/ppubr`, {
        method: 'POST',
        body: fd,
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
      const pdfLogoLabel = customPdfLogo ? (customPdfLogo.name || 'custom') : 'default';
      setHistory(prev => prev.map(item => item.id === entry.id ? hydrateHistoryEntry({
        ...item,
        pdfPath: payload.pdfPath,
        pdfUrl,
        mdPath: mdPathResolved,
        mdUrl,
        backendUrl: backendUsed || item.backendUrl,
        logs: Array.isArray(item.logs) ? item.logs.concat(payload.logs || []) : (payload.logs || []),
        logos: {
          ...(item.logos || {}),
          pdf: pdfLogoLabel,
        },
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
  }, [busy, customPdfLogo, fetchWithAuth, normalizedBackendUrl, pushLogs, setActivePanel, setBusy, setErrorBanner, setHistory, setMdPath, setPdfPath]);

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
      const response = await fetchWithAuth(`${backendTarget}/api/markdown`, {
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
  }, [fetchWithAuth, mdEditor, pushLogs, setHistory]);

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

  const defaultDest="/Users/tuo_utente/Recordings";
  const destIsPlaceholder=!destDir.trim()||destDir===defaultDest||destDir.includes('tuo_utente');

  const totalStages = PIPELINE_STAGES.length;
  const completedStagesCount = useMemo(() => PIPELINE_STAGES.reduce((acc, stage) => acc + (pipelineStatus[stage.key] === 'done' ? 1 : 0), 0), [pipelineStatus]);
  const progressPercent = totalStages ? Math.min(100, Math.max(0, Math.round((completedStagesCount / totalStages) * 100))) : 0;
  const failedStage = useMemo(() => PIPELINE_STAGES.find((stage) => pipelineStatus[stage.key] === 'failed'), [pipelineStatus]);
  const pipelineComplete = useMemo(() => totalStages > 0 && PIPELINE_STAGES.every((stage) => pipelineStatus[stage.key] === 'done'), [pipelineStatus, totalStages]);
  const activeStageDefinition = useMemo(() => PIPELINE_STAGES.find((stage) => stage.key === activeStageKey), [activeStageKey]);
  const promptCompletedCues = useMemo(() => {
    if (!promptState?.cueProgress) return [];
    return Object.entries(promptState.cueProgress)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key);
  }, [promptState.cueProgress]);
  const activePrompt = useMemo(
    () => prompts.find((prompt) => prompt.id === promptState.promptId) || null,
    [prompts, promptState.promptId]
  );

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

  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-6 py-4 text-sm text-zinc-300">
          Verifica sessione in corso…
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  const contextValue = {
    DEFAULT_BACKEND_URL,
    theme,
    themes,
    cycleTheme,
    customLogo,
    setCustomLogo,
    customPdfLogo,
    setCustomPdfLogo,
    backendUp,
    backendUrl,
    setBackendUrl,
    diagnostics,
    runDiagnostics,
    openSetupAssistant,
    openSettingsDrawer,
    settingsOpen,
    setSettingsOpen,
    activeSettingsSection,
    setActiveSettingsSection,
    showSetupAssistant,
    setShowSetupAssistant,
    shouldShowOnboardingBanner,
    toggleFullScreen,
    session,
    handleLogout,
    onboardingSteps,
    onboardingStep,
    setOnboardingStep,
    handleOnboardingFinish,
    secureOK,
    errorBanner,
    setErrorBanner,
    permissionMessage,
    lastMicError,
    fmtTime,
    fmtBytes,
    elapsed,
    requestPermission,
    permission,
    refreshDevices,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    recording,
    stopRecording,
    startRecording,
    busy,
    mediaSupported,
    recorderSupported,
    level,
    showDestDetails,
    setShowDestDetails,
    destDir,
    setDestDir,
    destIsPlaceholder,
    slug,
    setSlug,
    secondsCap,
    setSecondsCap,
    handleRefreshWorkspaces,
    workspaceLoading,
    setWorkspaceBuilderOpen,
    workspaceBuilderOpen,
    workspaceBuilder,
    setWorkspaceBuilder,
    handleWorkspaceBuilderSubmit,
    handleSelectWorkspaceForPipeline,
    workspaceSelection,
    workspaces,
    activeWorkspace,
    projectCreationMode,
    workspaceProjects,
    handleSelectProjectForPipeline,
    projectDraft,
    setProjectDraft,
    handleCreateProjectFromDraft,
    statusCreationMode,
    statusDraft,
    setStatusDraft,
    handleCreateStatusFromDraft,
    availableStatuses,
    handleSelectStatusForPipeline,
    prompts,
    promptLoading,
    promptState,
    handleSelectPromptTemplate,
    handleClearPromptSelection,
    promptFavorites,
    handleTogglePromptFavorite,
    handleRefreshPrompts,
    activePrompt,
    handlePromptFocusChange,
    handlePromptNotesChange,
    handleTogglePromptCue,
    handleCreatePrompt,
    handleDeletePrompt,
    mime,
    audioBlob,
    audioUrl,
    processViaBackend,
    resetAll,
    fileInputRef,
    onPickFile,
    markdownInputRef,
    handleMarkdownFilePicked,
    lastMarkdownUpload,
    textInputRef,
    handleTextFilePicked,
    lastTextUpload,
    showRawLogs,
    setShowRawLogs,
    PIPELINE_STAGES,
    pipelineStatus,
    stageMessages,
    STAGE_STATUS_STYLES,
    STAGE_STATUS_LABELS,
    failedStage,
    activeStageKey,
    progressPercent,
    completedStagesCount,
    totalStages,
    logs,
    onboardingComplete,
    HISTORY_TABS,
    historyTab,
    setHistoryTab,
    history,
    navigatorSelection,
    setNavigatorSelection,
    savedWorkspaceFilters,
    handleSaveWorkspaceFilter,
    handleDeleteWorkspaceFilter,
    handleApplyWorkspaceFilter,
    historyFilter,
    setHistoryFilter,
    fetchEntryPreview,
    handleOpenHistoryPdf,
    handleOpenHistoryMd,
    handleRepublishFromMd,
    handleShowHistoryLogs,
    handleAssignEntryWorkspace,
    handleAdoptNavigatorSelection,
    normalizedBackendUrl,
    fetchBody,
    handleLibraryWorkspaceSelection,
    handleOpenLibraryFile,
    mdEditor,
    handleMdEditorChange,
    handleMdEditorClose,
    handleMdEditorSave,
    handleRepublishFromEditor,
    mdEditorDirty,
    handleOpenMdInNewTab,
    headerStatus,
    promptCompletedCues,
  };

  return (
    <AppProvider value={contextValue}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/create" replace />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="*" element={<Navigate to="/create" replace />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}

export default AppContent;

