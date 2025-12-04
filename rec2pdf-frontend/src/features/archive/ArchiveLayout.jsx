import React, { useState, useMemo } from "react";
import { classNames } from "../../utils/classNames";
import { 
  Search, 
  FilterIcon, 
  FileText, 
  Folder, 
  Clock, 
  Download, 
  Edit3, 
  CheckCircle2, 
  Sparkles,
  LayoutDashboard,
  Users,
  ChevronRight,
  ChevronDown
} from "../../components/icons";

// --- SOTTOCOMPONENTI UI (Card e Inspector rimangono invariati nella struttura) ---

const FilterButton = ({ label, count, active, onClick, icon: Icon, indent = false }) => (
  <button
    onClick={onClick}
    className={classNames(
      "flex w-full items-center justify-between rounded-lg py-2 text-xs font-medium transition-all",
      indent ? "pl-8 pr-3" : "px-3",
      active
        ? "bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/20"
        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
    )}
  >
    <div className="flex items-center gap-2 truncate">
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{label}</span>
    </div>
    {count !== undefined && (
      <span className={classNames(
        "ml-2 rounded-full px-1.5 py-0.5 text-[9px]",
        active ? "bg-indigo-500/20 text-indigo-200" : "bg-white/5 text-zinc-600"
      )}>
        {count}
      </span>
    )}
  </button>
);

const DocumentCard = ({ doc, isSelected, onClick }) => {
  const intentColor = useMemo(() => {
    const i = (doc.intent || "").toUpperCase();
    if (i.includes("STRATEGIC")) return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    if (i.includes("OPERATIONAL")) return "text-blue-400 bg-blue-400/10 border-blue-400/20";
    if (i.includes("CREATIVE")) return "text-purple-400 bg-purple-400/10 border-purple-400/20";
    return "text-zinc-400 bg-zinc-400/10 border-zinc-400/20";
  }, [doc.intent]);

  return (
    <div
      onClick={onClick}
      className={classNames(
        "group relative mb-2 cursor-pointer rounded-xl border p-4 transition-all duration-200",
        isSelected
          ? "border-indigo-500/50 bg-[#16161a] shadow-lg shadow-indigo-900/10"
          : "border-white/5 bg-[#121214] hover:border-white/10 hover:bg-[#18181b]"
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h4 className={classNames(
            "font-semibold text-sm leading-snug line-clamp-2",
            isSelected ? "text-white" : "text-zinc-300 group-hover:text-white"
        )}>
          {doc.title || doc.name}
        </h4>
        {doc.intent && doc.intent !== 'GENERIC' && (
          <span className={classNames("shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider", intentColor)}>
            {doc.intent.split('_')[0]}
          </span>
        )}
      </div>

      <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-zinc-500 group-hover:text-zinc-400">
        {doc.summary || "Nessun sommario disponibile per questo documento."}
      </p>

      {/* Footer Card - RISTRUTTURATO */}
      <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
        <div className="flex items-center justify-between text-[10px] text-zinc-600">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(doc.created_at).toLocaleDateString()}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 truncate max-w-[100px]">
              <Folder className="h-3 w-3" />
              {doc.workspace || "No Workspace"}
            </span>
          </div>
          {doc.status && (
             <span className="flex items-center gap-1 text-zinc-500">
               <CheckCircle2 className="h-3 w-3" /> {doc.status}
             </span>
          )}
        </div>

        {doc.tags && doc.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
                {doc.tags.slice(0, 3).map((tag, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-zinc-500 border border-white/5">
                        #{tag}
                    </span>
                ))}
                {doc.tags.length > 3 && (
                    <span className="text-[9px] text-zinc-600">+{doc.tags.length - 3}</span>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

const DocumentInspector = ({ doc, onOpen, onOpenAudio, onEdit }) => {
  if (!doc) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-10 text-center text-zinc-500">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
          <LayoutDashboard className="h-8 w-8 opacity-20" />
        </div>
        <p className="text-sm font-medium">Seleziona un documento per visualizzare i dettagli</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#121214]">
      <div className="border-b border-white/10 p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300 ring-1 ring-inset ring-indigo-500/30">
            {doc.intent || "DOCUMENTO"}
          </span>
          <span className="text-xs text-zinc-500">
            ID: {doc.id.toString().slice(0, 8)}...
          </span>
        </div>
        <h2 className="mb-2 text-xl font-bold leading-tight text-white">
          {doc.title || doc.name}
        </h2>
        <div className="flex items-center gap-4 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {new Date(doc.created_at).toLocaleString()}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {doc.author || "AI Assistant"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 border-b border-white/10 p-4">
        <button
          onClick={onOpen}
          className="flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-black transition hover:bg-zinc-200"
          title="Scarica/Apri PDF"
        >
          <Download className="h-4 w-4" /> PDF
        </button>
        
        <button 
            className={classNames(
                "flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-white/10",
                !doc.paths?.audio && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => doc.paths?.audio && onOpenAudio(doc.paths.audio)}
            disabled={!doc.paths?.audio}
            title="Ascolta Audio Originale"
        >
          <div className={classNames("h-2 w-2 rounded-full", doc.paths?.audio ? "bg-rose-500 animate-pulse" : "bg-zinc-600")} /> 
          Audio
        </button>

        <button 
            className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-white/10"
            onClick={() => onEdit(doc)}
            title="Modifica Markdown"
        >
          <Edit3 className="h-4 w-4" /> Edit
        </button>
      </div>

      <div className="flex-1 p-6">
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" /> Sintesi AI
            </h3>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm leading-relaxed text-zinc-300">
              {doc.summary || "Nessun sommario generato per questo documento."}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
              Metadati
            </h3>
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div>
                <span className="block text-[10px] uppercase text-zinc-600">Workspace</span>
                <span className="text-sm font-medium text-zinc-200">{doc.workspace}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-zinc-600">Progetto</span>
                <span className="text-sm font-medium text-zinc-200">{doc.project || "—"}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-zinc-600">Stato</span>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  {doc.status}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-zinc-600">Dimensione</span>
                <span className="text-sm font-medium text-zinc-200">
                  {doc.size ? (doc.size / 1024).toFixed(1) + " KB" : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPALE (LOGICA AVANZATA) ---

export default function ArchiveLayout({
  documents = [],
  onSelect,
  selectedDoc,
  onOpen,
  loading,
  onOpenAudio,
  onEdit
}) {
  // Stato Filtri
  const [activeIntent, setActiveIntent] = useState("ALL");
  const [activeWorkspace, setActiveWorkspace] = useState("ALL");
  const [activeProject, setActiveProject] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Stato UI
  const [expandedWorkspaces, setExpandedWorkspaces] = useState({});

  // 1. AGGREGAZIONE DATI (Costruiamo l'albero dai documenti reali)
  const hierarchy = useMemo(() => {
    const tree = {};
    documents.forEach(doc => {
      const ws = doc.workspace || "Non Assegnato";
      const proj = doc.project || "Generale";
      
      if (!tree[ws]) tree[ws] = { count: 0, projects: {} };
      tree[ws].count++;
      
      if (!tree[ws].projects[proj]) tree[ws].projects[proj] = 0;
      tree[ws].projects[proj]++;
    });
    return tree;
  }, [documents]);

  // 2. LOGICA DI FILTRAGGIO
  const filteredDocs = useMemo(() => {
    let result = documents;

    // Filtro Intento
    if (activeIntent !== "ALL") {
      result = result.filter(doc => {
        const intent = (doc.intent || "").toUpperCase();
        if (activeIntent === "STRATEGIC") return intent.includes("STRATEGIC") || intent.includes("BUSINESS");
        if (activeIntent === "OPERATIONAL") return intent.includes("OPERATIONAL") || intent.includes("MEETING");
        return true;
      });
    }

    // Filtro Workspace
    if (activeWorkspace !== "ALL") {
      result = result.filter(doc => (doc.workspace || "Non Assegnato") === activeWorkspace);
    }

    // Filtro Progetto
    if (activeProject) {
      result = result.filter(doc => (doc.project || "Generale") === activeProject);
    }

    // Filtro Ricerca
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(doc => 
        (doc.title || "").toLowerCase().includes(q) ||
        (doc.summary || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [documents, activeIntent, activeWorkspace, activeProject, searchTerm]);

  // Conteggi per la sidebar
  const counts = useMemo(() => ({
    all: documents.length,
    strategic: documents.filter(d => (d.intent || "").includes("STRATEGIC")).length,
    operational: documents.filter(d => (d.intent || "").includes("OPERATIONAL")).length,
  }), [documents]);

  const toggleWorkspace = (wsName) => {
    setExpandedWorkspaces(prev => ({ ...prev, [wsName]: !prev[wsName] }));
  };

  return (
    <div className="flex h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-[#09090b] shadow-2xl ring-1 ring-white/5">
      
      {/* PANE 1: SIDEBAR (Filtri Dinamici) */}
      <div className="hidden w-64 flex-col border-r border-white/10 bg-[#0e0e11] p-3 md:flex">
        
        {/* Filtri Categoria */}
        <div className="mb-6 px-2 pt-2">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Libreria</h3>
          <nav className="space-y-0.5">
            <FilterButton 
              label="Tutti i documenti" 
              count={counts.all} 
              active={activeIntent === 'ALL' && activeWorkspace === 'ALL'} 
              onClick={() => { setActiveIntent('ALL'); setActiveWorkspace('ALL'); setActiveProject(null); }} 
              icon={LayoutDashboard}
            />
            <FilterButton 
              label="Strategia & Business" 
              count={counts.strategic} 
              active={activeIntent === 'STRATEGIC'} 
              onClick={() => setActiveIntent('STRATEGIC')} 
              icon={Sparkles}
            />
            <FilterButton 
              label="Operativi & Meeting" 
              count={counts.operational} 
              active={activeIntent === 'OPERATIONAL'} 
              onClick={() => setActiveIntent('OPERATIONAL')} 
              icon={CheckCircle2}
            />
          </nav>
        </div>
        
        {/* Filtri Workspace (Dinamici) */}
        <div className="px-2 mb-2">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Workspace</h3>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
           {Object.entries(hierarchy).map(([wsName, data]) => (
             <div key={wsName}>
               <div className="flex items-center gap-1">
                 <button 
                    onClick={() => toggleWorkspace(wsName)}
                    className="p-1 text-zinc-500 hover:text-zinc-300"
                 >
                    {expandedWorkspaces[wsName] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                 </button>
                 <FilterButton 
                    label={wsName}
                    count={data.count}
                    active={activeWorkspace === wsName && !activeProject}
                    onClick={() => { setActiveWorkspace(wsName); setActiveProject(null); setActiveIntent('ALL'); }}
                    icon={Folder}
                 />
               </div>
               
               {/* Sottolista Progetti */}
               {expandedWorkspaces[wsName] && (
                 <div className="ml-4 border-l border-white/5 pl-2 mt-1 space-y-0.5">
                    {Object.entries(data.projects).map(([projName, count]) => (
                        <FilterButton 
                            key={projName}
                            label={projName}
                            count={count}
                            active={activeWorkspace === wsName && activeProject === projName}
                            onClick={() => { setActiveWorkspace(wsName); setActiveProject(projName); setActiveIntent('ALL'); }}
                            indent
                        />
                    ))}
                 </div>
               )}
             </div>
           ))}
        </div>
      </div>

      {/* PANE 2: MASTER LIST */}
      <div className="flex w-full flex-col border-r border-white/10 bg-[#09090b] md:w-[420px]">
        {/* Search Bar */}
        <div className="border-b border-white/10 p-4 bg-[#09090b]/50 backdrop-blur sticky top-0 z-10">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cerca..." 
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          {loading ? (
             <div className="p-4 text-center text-xs text-zinc-500 animate-pulse">Caricamento archivio...</div>
          ) : filteredDocs.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                <FilterIcon className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-xs">Nessun documento trovato.</p>
             </div>
          ) : (
            filteredDocs.map(doc => (
              <DocumentCard 
                key={doc.id} 
                doc={doc} 
                isSelected={selectedDoc?.id === doc.id}
                onClick={() => onSelect(doc)}
              />
            ))
          )}
        </div>
      </div>

      {/* PANE 3: INSPECTOR (Dettaglio) */}
      <div className="hidden flex-1 flex-col bg-[#121214] md:flex">
        <DocumentInspector 
            doc={selectedDoc} 
            onOpen={onOpen} 
            onOpenAudio={onOpenAudio} 
            onEdit={onEdit}           
        />
      </div>

    </div>
  );
}