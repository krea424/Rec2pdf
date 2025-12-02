import React from "react";
import { useNavigate } from "react-router-dom";
import { 
  Folder, 
  Target, 
  Sparkles, 
  Users, 
  FileText, 
  Image as ImageIcon, 
  ChevronRight 
} from "../../components/icons.jsx";
import { useAppContext } from "../../hooks/useAppContext";
import { classNames } from "../../utils/classNames";

// Sottocomponente Card Compatta (Invariato)
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
    customPdfLogo,
    customLogo,
    pdfTemplates, // <--- 1. AGGIUNTO: Importiamo la lista dei template per avere i nomi ufficiali
    promptState // <--- AGGIUNGI QUESTA RIGA (con la virgola prima)
  } = useAppContext();

  const goToAdvanced = (section) => {
    navigate("/advanced", { state: { scrollTo: section } });
  };

  // --- LOGICHE LABEL ---
  const workspaceLabel = activeWorkspace?.name || workspaceSelection?.name || "Nessun workspace";
  const isWorkspaceActive = !!workspaceSelection?.workspaceId;

  const projectLabel = workspaceSelection?.projectName || "Nessun progetto";
  const isProjectActive = !!workspaceSelection?.projectId || !!workspaceSelection?.projectName;

  // --- LOGICA PROMPT LABEL (FIX AUTO-DETECT) ---
  const promptLabel = (promptState?.promptId === 'auto_detect' || !promptState?.promptId)
      ? "✨ AI Auto-Detect"
      : (activePrompt?.title || "Format Base");

  // La card è attiva se c'è un prompt reale OPPURE se siamo in auto-detect
  const isPromptActive = (promptState?.promptId === 'auto_detect' || !promptState?.promptId) || !!activePrompt?.id;

  const profileLabel = activeWorkspaceProfile?.label || "Nessun profilo";
  const isProfileActive = !!activeWorkspaceProfile?.id;

 // --- 2. NUOVA LOGICA INTELLIGENTE PER IL TEMPLATE ---
 const getTemplateLabel = () => {
  // A. Risoluzione del file attivo
  let fileName = pdfTemplateSelection?.fileName;
  if (!fileName || fileName === 'auto_detect') {
      if (activeWorkspaceProfile?.pdfTemplate) fileName = activeWorkspaceProfile.pdfTemplate;
      else if (activePrompt?.pdfRules?.template) fileName = activePrompt.pdfRules.template;
  }

  // B. Gestione casi speciali (MODIFICATO: Aggiunto ✨)
  if (fileName === 'auto_detect' || !fileName) return "✨ Auto-Detect";
  
  // C. Cerca il nome ufficiale nei metadati
  const officialTemplate = pdfTemplates.find(t => t.fileName === fileName);
  if (officialTemplate && officialTemplate.name) {
      return officialTemplate.name.replace(/^\d+[._]\s*/, '');
  }

  // D. Fix specifico per il vecchio default
  if (fileName === 'default.tex') return "Report Tecnico";

  // E. Fallback generico
  return fileName
    .replace(/\.(html|tex)$/i, '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ');
};

const templateLabel = getTemplateLabel();

// MODIFICATO: La card è attiva se non è il fallback "Default". 
// "✨ Auto-Detect" ora è considerato uno stato ATTIVO.
const isTemplateActive = templateLabel !== "Default";

  const getLogoLabel = () => {
    if (customPdfLogo) {
        if (customPdfLogo.name) return "Custom Upload"; 
        if (customPdfLogo.label) return customPdfLogo.label;
        return "Custom";
    }
    if (activeWorkspaceProfile?.pdfLogo) {
        return activeWorkspaceProfile.pdfLogo.originalName || "Da Profilo";
    }
    return "Default (ThinkDOC)";
  };
  const logoLabel = getLogoLabel();
  const isLogoActive = logoLabel !== "Default (ThinkDOC)";

  return (
    <section aria-label="Riepilogo Sessione" className="w-full flex justify-center">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6 w-full max-w-7xl">
        
        {/* 1. WORKSPACE */}
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

        {/* 2. PROGETTO */}
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

        {/* 3. PROMPT */}
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

        {/* 4. PROFILO */}
        <SummaryCard
          icon={Users}
          label="Profilo"
          value={profileLabel}
          isActive={isProfileActive}
          colorClass="text-rose-400"
          bgClass="bg-rose-400/10"
          borderClass="border-rose-400/20"
          onClick={() => goToAdvanced("workspace")}
        />

        {/* 5. TEMPLATE */}
        <SummaryCard
          icon={FileText}
          label="Template"
          value={templateLabel}
          isActive={isTemplateActive}
          colorClass="text-amber-400"
          bgClass="bg-amber-400/10"
          borderClass="border-amber-400/20"
          onClick={() => goToAdvanced("workspace")}
        />

        {/* 6. LOGO */}
        <SummaryCard
          icon={ImageIcon}
          label="Logo PDF"
          value={logoLabel}
          isActive={isLogoActive}
          colorClass="text-cyan-400"
          bgClass="bg-cyan-400/10"
          borderClass="border-cyan-400/20"
          onClick={() => goToAdvanced("workspace")}
        />

      </div>
    </section>
  );
};

export default BaseSummaryCards;