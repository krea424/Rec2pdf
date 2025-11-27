import React from "react";
import { useNavigate } from "react-router-dom";
import { 
  Folder, 
  Target, 
  Sparkles, 
  Users, 
  FileText, 
  Image as ImageIcon, // Importiamo l'icona immagine
  ChevronRight 
} from "../../components/icons.jsx";
import { useAppContext } from "../../hooks/useAppContext";
import { classNames } from "../../utils/classNames";

// Sottocomponente Card Compatta (Invariato, per riferimento)
const SummaryCard = ({ 
  icon: Icon, 
  label, 
  value, 
  isActive, 
  onClick, 
  colorClass = "text-white",
  bgClass = "bg-white/5",
  borderClass = "border-white/5"
}) => {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={classNames(
        "group relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 ease-out w-full",
        "bg-[#121214] hover:bg-[#1c1c1f]",
        isActive 
          ? "border-white/10 hover:border-white/20 shadow-sm" 
          : "border-transparent hover:border-white/5 opacity-60 hover:opacity-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
      )}
    >
      <div className={classNames(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
        isActive ? `${bgClass} ${borderClass}` : "bg-white/5 border-white/5",
        isActive ? colorClass : "text-white/40"
      )}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-wider text-white/40 transition-colors group-hover:text-white/60">
          {label}
        </p>
        <p className={classNames(
          "truncate text-xs font-semibold",
          isActive ? "text-white" : "text-white/50 italic"
        )}>
          {value}
        </p>
      </div>
      
      <ChevronRight className="h-3 w-3 text-white/10 opacity-0 transition-all transform group-hover:translate-x-0.5 group-hover:opacity-100" />
    </button>
  );
};

const BaseSummaryCards = () => {
  const navigate = useNavigate();
  const { 
    workspaceSelection, 
    activeWorkspace,
    activePrompt, 
    activeWorkspaceProfile,
    pdfTemplateSelection,
    customPdfLogo, // Recuperiamo il logo custom
    customLogo     // Recuperiamo il logo UI (opzionale, se vuoi mostrare quello)
  } = useAppContext();

  const goToAdvanced = (section) => {
    navigate("/advanced", { state: { scrollTo: section } });
  };

  // --- LOGICHE LABEL ---

  // 1. Workspace
  const workspaceLabel = activeWorkspace?.name || workspaceSelection?.name || "Nessun workspace";
  const isWorkspaceActive = !!workspaceSelection?.workspaceId;

  // 2. Progetto
  const projectLabel = workspaceSelection?.projectName || "Nessun progetto";
  const isProjectActive = !!workspaceSelection?.projectId || !!workspaceSelection?.projectName;

  // 3. Prompt
  const promptLabel = activePrompt?.title || "Format Base";
  const isPromptActive = !!activePrompt?.id; 

  // 4. Profilo
  const profileLabel = activeWorkspaceProfile?.label || "Nessun profilo";
  const isProfileActive = !!activeWorkspaceProfile?.id;

  // 5. Template
  const getTemplateLabel = () => {
    if (pdfTemplateSelection?.fileName) return pdfTemplateSelection.fileName;
    if (activeWorkspaceProfile?.pdfTemplate) return activeWorkspaceProfile.pdfTemplate;
    if (activePrompt?.pdfRules?.template) return activePrompt.pdfRules.template;
    return "Default";
  };
  const rawTemplate = getTemplateLabel();
  const templateLabel = rawTemplate
    .replace(/\.(html|tex)$/i, '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ');
  const isTemplateActive = rawTemplate !== "Default";

  // 6. Logo (NUOVA LOGICA)
  const getLogoLabel = () => {
    // Priorità 1: Upload manuale in sessione
    if (customPdfLogo) {
        // Se è un File object (upload manuale)
        if (customPdfLogo.name) return "Custom Upload"; 
        // Se è un descrittore (es. da profilo)
        if (customPdfLogo.label) return customPdfLogo.label;
        return "Custom";
    }
    // Priorità 2: Dal profilo workspace attivo
    if (activeWorkspaceProfile?.pdfLogo) {
        return activeWorkspaceProfile.pdfLogo.originalName || "Da Profilo";
    }
    // Priorità 3: Default
    return "Default (ThinkDOC)";
  };
  const logoLabel = getLogoLabel();
  const isLogoActive = logoLabel !== "Default (ThinkDOC)";

  return (
    <section aria-label="Riepilogo Sessione" className="w-full flex justify-center">
      {/* 
         MODIFICA UI: 
         1. Aggiunto 'max-w-7xl' per limitare la larghezza su schermi ultra-wide.
         2. Aggiunto 'w-full' per occupare lo spazio disponibile fino al max-w.
         3. Mantenuta la griglia responsive.
      */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6 w-full max-w-7xl">
        
        <SummaryCard
          icon={Folder}
          label="Workspace"
          value={workspaceLabel}
          isActive={isWorkspaceActive}
          colorClass="text-emerald-400"
          bgClass="bg-emerald-400/10"
          borderClass="border-emerald-400/20"
          onClick={() => goToAdvanced("workspace")}
        />

        <SummaryCard
          icon={Target}
          label="Progetto"
          value={projectLabel}
          isActive={isProjectActive}
          colorClass="text-blue-400"
          bgClass="bg-blue-400/10"
          borderClass="border-blue-400/20"
          onClick={() => goToAdvanced("workspace")}
        />

        <SummaryCard
          icon={Sparkles}
          label="Prompt"
          value={promptLabel}
          isActive={isPromptActive}
          colorClass="text-purple-400"
          bgClass="bg-purple-400/10"
          borderClass="border-purple-400/20"
          onClick={() => goToAdvanced("prompt")}
        />

        <SummaryCard
          icon={Users}
          label="Profilo"
          value={profileLabel}
          isActive={isProfileActive}
          colorClass="text-rose-400"
          bgClass="bg-rose-400/10"
          borderClass="border-rose-400/20"
          onClick={() => goToAdvanced("profile")}
        />

        <SummaryCard
          icon={FileText}
          label="Template"
          value={templateLabel}
          isActive={isTemplateActive}
          colorClass="text-amber-400"
          bgClass="bg-amber-400/10"
          borderClass="border-amber-400/20"
          onClick={() => goToAdvanced("template")}
        />

        <SummaryCard
          icon={ImageIcon}
          label="Logo PDF"
          value={logoLabel}
          isActive={isLogoActive}
          colorClass="text-cyan-400"
          bgClass="bg-cyan-400/10"
          borderClass="border-cyan-400/20"
          onClick={() => goToAdvanced("branding")}
        />

      </div>
    </section>
  );
};

export default BaseSummaryCards;