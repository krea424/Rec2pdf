import React from "react";
import { useNavigate } from "react-router-dom"; // <--- CRUCIALE
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

// Sottocomponente Card Interattiva
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
      type="button" // Esplicito per evitare submit accidentali
      onClick={(e) => {
        e.preventDefault(); // Previene comportamenti strani
        onClick();
      }}
      className={classNames(
        "group relative flex flex-col items-start justify-between rounded-2xl border p-5 text-left transition-all duration-200 ease-out w-full h-full",
        // Stile Base
        "bg-[#121214] hover:bg-[#18181b] cursor-pointer", // cursor-pointer forzato
        // Bordo: Attivo vs Inattivo
        isActive 
          ? "border-white/10 hover:border-white/20" 
          : "border-white/5 hover:border-white/10 opacity-70 hover:opacity-100",
        // Focus ring per accessibilità
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
      )}
    >
      <div className="flex w-full items-start justify-between pointer-events-none"> {/* pointer-events-none per evitare che i figli rubino il click */}
        {/* Icona con sfondo colorato tenue */}
        <div className={classNames(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
          isActive ? `${bgClass} ${borderClass}` : "bg-white/5 border-white/5",
          isActive ? colorClass : "text-white/40"
        )}>
          <Icon className="h-5 w-5" />
        </div>
        
        {/* Freccina che appare all'hover */}
        <ChevronRight className="h-4 w-4 text-white/20 opacity-0 transition-all transform group-hover:translate-x-1 group-hover:opacity-100" />
      </div>

      <div className="mt-4 w-full pointer-events-none">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 transition-colors group-hover:text-white/60">
          {label}
        </p>
        <p className={classNames(
          "mt-1 truncate text-sm font-semibold",
          isActive ? "text-white" : "text-white/50 italic"
        )}>
          {value}
        </p>
      </div>
    </button>
  );
};

const BaseSummaryCards = () => {
  const navigate = useNavigate(); // Hook per la navigazione
  const { 
    workspaceSelection, 
    activeWorkspace,
    activePrompt, 
    activeWorkspaceProfile,
    pdfTemplateSelection
  } = useAppContext();

  // Funzione helper per navigare ad Advanced con un "focus" (opzionale per il futuro)
  const goToAdvanced = (section) => {
    console.log("Navigazione verso Advanced -> Sezione:", section); // Debug log
    navigate("/advanced", { state: { scrollTo: section } });
  };

  // 1. Logica Workspace
  const workspaceLabel = activeWorkspace?.name || workspaceSelection?.name || "Nessun workspace";
  const isWorkspaceActive = !!workspaceSelection?.workspaceId;

  // 2. Logica Progetto
  const projectLabel = workspaceSelection?.projectName || "Nessun progetto";
  const isProjectActive = !!workspaceSelection?.projectId || !!workspaceSelection?.projectName;

  // 3. Logica Prompt
  const promptLabel = activePrompt?.title || "Format Base";
  const isPromptActive = !!activePrompt?.id; 

  // 4. Logica Profilo
  const profileLabel = activeWorkspaceProfile?.label || "Nessun profilo attivo";
  const isProfileActive = !!activeWorkspaceProfile?.id;

  // 5. Logica Template
  const getTemplateLabel = () => {
    if (pdfTemplateSelection?.fileName) return pdfTemplateSelection.fileName;
    if (activeWorkspaceProfile?.pdfTemplate) return activeWorkspaceProfile.pdfTemplate;
    if (activePrompt?.pdfRules?.template) return activePrompt.pdfRules.template;
    return "Default (Standard)";
  };

  const rawTemplate = getTemplateLabel();
  const templateLabel = rawTemplate
    .replace(/\.(html|tex)$/i, '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ');
    
  const isTemplateActive = rawTemplate !== "Default (Standard)";

  return (
    <section aria-label="Riepilogo Sessione">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        
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
          onClick={() => goToAdvanced("workspace")} // Progetti e Workspace sono vicini
        />

        <SummaryCard
          icon={Sparkles}
          label="Prompt Guida"
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
          label="Template PDF"
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