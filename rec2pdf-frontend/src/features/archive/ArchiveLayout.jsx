import React, { useState, useMemo, useEffect } from "react";
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
  ChevronDown,
  ChevronLeft, // Icona per il tasto "Indietro"
  XCircle, // Icona per chiudere i filtri
  Trash2,
  Lightbulb, // <--- AGGIUNGI QUESTA
} from "../../components/icons";

// --- SOTTOCOMPONENTI UI ---

const FilterButton = ({ label, count, active, onClick, icon: Icon, indent = false }) => (
  <button
    onClick={onClick}
    className={classNames(
      "flex w-full items-center justify-between rounded-lg py-3 md:py-2 text-sm md:text-xs font-medium transition-all", // Più grande su mobile
      indent ? "pl-8 pr-3" : "px-3",
      active
        ? "bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/20"
        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
    )}
  >
    <div className="flex items-center gap-3 md:gap-2 truncate">
      {Icon && <Icon className="h-4 w-4 md:h-3.5 md:w-3.5 shrink-0" />}
      <span className="truncate">{label}</span>
    </div>
    {count !== undefined && (
      <span className={classNames(
        "ml-2 rounded-full px-2 py-0.5 text-[10px]",
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
        "group relative mb-3 cursor-pointer rounded-xl border p-4 transition-all duration-200 active:scale-[0.98]",
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

      <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
        <div className="flex items-center justify-between text-[10px] text-zinc-600">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(doc.created_at).toLocaleDateString()}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 truncate max-w-[80px] sm:max-w-[100px]">
              <Folder className="h-3 w-3" />
              {doc.workspace || "No Workspace"}
            </span>
          </div>
          {doc.status && (
             <span className="hidden sm:flex items-center gap-1 text-zinc-500">
               <CheckCircle2 className="h-3 w-3" /> {doc.status}
             </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ... (Assicurati di avere gli import in alto, inclusi Trash2, ChevronLeft, XCircle)
const DocumentInspector = ({ doc, onOpen, onOpenAudio, onDownloadAudio, onEdit, onDelete, onPromote, onBack }) => {
  if (!doc) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-10 text-center text-zinc-500">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
          <LayoutDashboard className="h-8 w-8 opacity-20" />
        </div>
        <p className="text-sm font-medium">Seleziona un documento</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#121214] animate-in slide-in-from-right-10 duration-300">
      
      {/* Mobile Back Header */}
      <div className="md:hidden flex items-center gap-2 border-b border-white/10 p-4 bg-[#121214] sticky top-0 z-20">
        <button onClick={onBack} className="p-2 -ml-2 text-zinc-400 hover:text-white">
            <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-bold text-white">Dettagli Documento</span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        
        {/* HEADER con Titolo, ID e Azioni (Memorizza + Elimina) */}
        <div className="border-b border-white/10 p-6">
          <div className="mb-4 flex items-center justify-between">
              {/* Badge e ID */}
              <div className="flex items-center gap-2">
                  <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300 ring-1 ring-inset ring-indigo-500/30">
                      {doc.intent || "DOCUMENTO"}
                  </span>
                  <span className="text-xs text-zinc-500">
                      ID: {doc.id.toString().slice(0, 8)}...
                  </span>
              </div>
              
              {/* GRUPPO AZIONI: MEMORIZZA + ELIMINA */}
              <div className="flex gap-2">
                  {/* PULSANTE MEMORIZZA */}
                  <button 
                      onClick={() => onPromote(doc.id)}
                      className="group flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 transition-all hover:bg-indigo-500/20 hover:text-indigo-200 hover:shadow-lg hover:shadow-indigo-500/10"
                      title="Aggiungi alla Knowledge Base"
                  >
                      <Lightbulb className="h-4 w-4" />
                      <span className="hidden sm:inline">Memorizza</span>
                  </button>

                  {/* PULSANTE ELIMINA */}
                  <button 
                      onClick={() => onDelete(doc.id)}
                      className="group flex items-center gap-2 rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-zinc-500 transition-all hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-400"
                      title="Elimina definitivamente"
                  >
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Elimina</span>
                  </button>
              </div>
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

        {/* AZIONI PRINCIPALI (PDF, Audio Split, Edit) */}
        <div className="grid grid-cols-3 gap-3 border-b border-white/10 p-4">
            <button
                onClick={onOpen}
                className="flex flex-col md:flex-row items-center justify-center gap-2 rounded-lg bg-white px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-black transition hover:bg-zinc-200 active:scale-95"
            >
                <Download className="h-4 w-4" /> PDF
            </button>
            
            {/* PULSANTE AUDIO SPLIT */}
            <div className={classNames(
                "flex items-stretch rounded-lg border border-white/10 bg-white/5 overflow-hidden transition hover:border-white/20",
                !doc.paths?.audio && "opacity-50 cursor-not-allowed"
            )}>
                <button 
                    className="flex-1 flex flex-col md:flex-row items-center justify-center gap-2 px-2 py-2.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-white/10 active:bg-white/20"
                    onClick={() => doc.paths?.audio && onOpenAudio(doc.paths.audio)}
                    disabled={!doc.paths?.audio}
                    title="Riproduci Audio"
                >
                   <div className={classNames("h-2 w-2 rounded-full shrink-0", doc.paths?.audio ? "bg-rose-500 animate-pulse" : "bg-zinc-600")} /> 
                   <span>Audio</span>
                </button>
                <div className="w-px bg-white/10 my-1"></div>
                <button 
                    className="px-3 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (doc.paths?.audio) {
                            const ext = doc.paths.audio.split('.').pop();
                            const fileName = `${doc.title.replace(/[^a-z0-9]/gi, '_')}.${ext}`;
                            if (onDownloadAudio) onDownloadAudio(doc.paths.audio, fileName);
                        }
                    }}
                    disabled={!doc.paths?.audio}
                    title="Scarica file audio"
                >
                    <Download className="h-3.5 w-3.5" />
                </button>
            </div>

            <button 
                className="flex flex-col md:flex-row items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-white/10 active:scale-95"
                onClick={() => onEdit(doc)}
            >
                <Edit3 className="h-4 w-4" /> Edit
            </button>
        </div>

        {/* CONTENUTO (Sintesi e Metadati) */}
        <div className="p-6 space-y-6">
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

// ... (tutto il codice sopra rimane uguale)

export default function ArchiveLayout({
  documents = [],
  onSelect,
  selectedDoc,
  onOpen,
  loading,
  onOpenAudio,
  onDownloadAudio,
  onEdit,
  onDelete,
  onPromote // <--- 1. AGGIUNTO QUI (Riceve la funzione da Library.jsx)
}) {
  // Stati filtri
  const [activeIntent, setActiveIntent] = useState("ALL");
  const [activeWorkspace, setActiveWorkspace] = useState("ALL");
  const [activeProject, setActiveProject] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Stati UI
  const [expandedWorkspaces, setExpandedWorkspaces] = useState({});
  const [mobileView, setMobileView] = useState('list');

  useEffect(() => {
    if (selectedDoc) {
      setMobileView('details');
    }
  }, [selectedDoc]);

  // 1. AGGREGAZIONE DATI
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

    if (activeIntent !== "ALL") {
      result = result.filter(doc => {
        const intent = (doc.intent || "").toUpperCase();
        if (activeIntent === "STRATEGIC") return intent.includes("STRATEGIC") || intent.includes("BUSINESS");
        if (activeIntent === "OPERATIONAL") return intent.includes("OPERATIONAL") || intent.includes("MEETING");
        return true;
      });
    }

    if (activeWorkspace !== "ALL") {
      result = result.filter(doc => (doc.workspace || "Non Assegnato") === activeWorkspace);
    }

    if (activeProject) {
      result = result.filter(doc => (doc.project || "Generale") === activeProject);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(doc => 
        (doc.title || "").toLowerCase().includes(q) ||
        (doc.summary || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [documents, activeIntent, activeWorkspace, activeProject, searchTerm]);

  const counts = useMemo(() => ({
    all: documents.length,
    strategic: documents.filter(d => (d.intent || "").includes("STRATEGIC")).length,
    operational: documents.filter(d => (d.intent || "").includes("OPERATIONAL")).length,
  }), [documents]);

  const toggleWorkspace = (wsName) => {
    setExpandedWorkspaces(prev => ({ ...prev, [wsName]: !prev[wsName] }));
  };

  const goBackToList = () => {
    setMobileView('list');
  };

  return (
    <div className="flex h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-[#09090b] shadow-2xl ring-1 ring-white/5 relative">
      
      {/* PANE 1: SIDEBAR (FILTRI) */}
      <div className={classNames(
        "flex-col border-r border-white/10 bg-[#0e0e11] transition-transform duration-300 absolute inset-0 z-30 md:relative md:w-64 md:translate-x-0 md:flex",
        mobileView === 'filters' ? "translate-x-0 flex" : "-translate-x-full hidden"
      )}>
        {/* ... (Contenuto Sidebar invariato) ... */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-white/10 bg-[#0e0e11]">
            <h3 className="text-sm font-bold text-white">Filtri</h3>
            <button onClick={() => setMobileView('list')} className="text-zinc-400 hover:text-white">
                <XCircle className="h-6 w-6" />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
            <div className="mb-6 px-2 pt-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Libreria</h3>
            <nav className="space-y-0.5">
                <FilterButton 
                label="Tutti i documenti" 
                count={counts.all} 
                active={activeIntent === 'ALL' && activeWorkspace === 'ALL'} 
                onClick={() => { setActiveIntent('ALL'); setActiveWorkspace('ALL'); setActiveProject(null); setMobileView('list'); }} 
                icon={LayoutDashboard}
                />
                <FilterButton 
                label="Strategia & Business" 
                count={counts.strategic} 
                active={activeIntent === 'STRATEGIC'} 
                onClick={() => { setActiveIntent('STRATEGIC'); setMobileView('list'); }} 
                icon={Sparkles}
                />
                <FilterButton 
                label="Operativi & Meeting" 
                count={counts.operational} 
                active={activeIntent === 'OPERATIONAL'} 
                onClick={() => { setActiveIntent('OPERATIONAL'); setMobileView('list'); }} 
                icon={CheckCircle2}
                />
            </nav>
            </div>
            
            <div className="px-2 mb-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Workspace</h3>
            </div>
            <div className="space-y-1">
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
                        onClick={() => { setActiveWorkspace(wsName); setActiveProject(null); setActiveIntent('ALL'); setMobileView('list'); }}
                        icon={Folder}
                    />
                </div>
                
                {expandedWorkspaces[wsName] && (
                    <div className="ml-4 border-l border-white/5 pl-2 mt-1 space-y-0.5">
                        {Object.entries(data.projects).map(([projName, count]) => (
                            <FilterButton 
                                key={projName}
                                label={projName}
                                count={count}
                                active={activeWorkspace === wsName && activeProject === projName}
                                onClick={() => { setActiveWorkspace(wsName); setActiveProject(projName); setActiveIntent('ALL'); setMobileView('list'); }}
                                indent
                            />
                        ))}
                    </div>
                )}
                </div>
            ))}
            </div>
        </div>
      </div>

      {/* PANE 2: MASTER LIST */}
      <div className={classNames(
        "flex w-full flex-col border-r border-white/10 bg-[#09090b] md:w-[420px]",
        mobileView === 'list' ? "flex" : "hidden md:flex"
      )}>
        <div className="border-b border-white/10 p-4 bg-[#09090b]/50 backdrop-blur sticky top-0 z-10 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cerca..." 
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
          <button 
            onClick={() => setMobileView('filters')}
            className="md:hidden flex items-center justify-center h-10 w-10 rounded-xl border border-white/10 bg-white/5 text-zinc-400 active:bg-white/10 active:text-white"
          >
            <FilterIcon className="h-5 w-5" />
          </button>
        </div>

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

      {/* PANE 3: INSPECTOR (DETTAGLIO) */}
      <div className={classNames(
        "flex-1 flex-col bg-[#121214] absolute inset-0 z-40 md:relative md:flex md:inset-auto md:z-auto",
        mobileView === 'details' ? "flex" : "hidden"
      )}>
        <DocumentInspector 
            doc={selectedDoc} 
            onOpen={onOpen} 
            onOpenAudio={onOpenAudio} 
            onDownloadAudio={onDownloadAudio}
            onEdit={onEdit} 
            onDelete={onDelete}
            onPromote={onPromote} // <--- 2. PASSATO QUI AL FIGLIO
            onBack={goBackToList} 
        />
      </div>

    </div>
  );
}