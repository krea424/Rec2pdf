import React from "react";
import { useNavigate } from "react-router-dom";
import { 
  Folder, 
  Target, 
  Sparkles, 
  Users, 
  FileText, 
  ChevronRight 
} from "../../components/icons.jsx";
import { useAppContext } from "../../hooks/useAppContext";
import { classNames } from "../../utils/classNames";

// Sottocomponente Card Compatta (Toolbar Style)
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
        // Stile Base: Più scuro e compatto
        "bg-[#121214] hover:bg-[#1c1c1f]",
        isActive 
          ? "border-white/10 hover:border-white/20 shadow-sm" 
          : "border-transparent hover:border-white/5 opacity-60 hover:opacity-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
      )}
    >
      {/* Icona Piccola */}
      <div className={classNames(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
        isActive ? `${bgClass} ${borderClass}` : "bg-white/5 border-white/5",
        isActive ? colorClass : "text-white/40"
      )}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Testo Compatto */}
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
      
      {/* Chevron Micro */}
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
    pdfTemplateSelection
  } = useAppContext();

  const goToAdvanced = (section) => {
    navigate("/advanced", { state: { scrollTo: section } });
  };

  // Logiche Label (Invariate)
  const workspaceLabel = activeWorkspace?.name || workspaceSelection?.name || "Nessun workspace";
  const isWorkspaceActive = !!workspaceSelection?.workspaceId;

  const projectLabel = workspaceSelection?.projectName || "Nessun progetto";
  const isProjectActive = !!workspaceSelection?.projectId || !!workspaceSelection?.projectName;

  const promptLabel = activePrompt?.title || "Format Base";
  const isPromptActive = !!activePrompt?.id; 

  const profileLabel = activeWorkspaceProfile?.label || "Nessun profilo";
  const isProfileActive = !!activeWorkspaceProfile?.id;

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

  return (
    <section aria-label="Riepilogo Sessione" className="w-full">
      {/* 
         GRID SYSTEM COMPATTO:
         - Gap ridotto a gap-2
         - Su mobile: 2 colonne
         - Su desktop: 5 colonne in una riga
      */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        
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

      </div>
    </section>
  );
};

export default BaseSummaryCards;