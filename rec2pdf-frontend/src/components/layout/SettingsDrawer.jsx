import { lazy, Suspense, useMemo, useState } from "react";
import Drawer from "../ui/Drawer";
import { Bug, Cpu, Folder, Mic, Palette, Sparkles, Users, FileText, Edit3 } from "../icons";
import { useAppContext } from "../../hooks/useAppContext";
import { classNames } from "../../utils/classNames";
import { trackEvent } from "../../utils/analytics";

// Import Sezioni
import RecordingSection from "../../features/settings/sections/RecordingSection";
import DiagnosticsSection from "../../features/settings/sections/DiagnosticsSection";
import WorkspaceSection from "../../features/settings/sections/WorkspaceSection";
import BrandingSection from "../../features/settings/sections/BrandingSection";
import AccountSection from "../../features/settings/sections/AccountSection";
import PromptInsightsSection from "../../features/settings/sections/PromptInsightsSection";
import PromptBuilder from "../prompts/PromptBuilder"; 

const AdvancedBackendSection = lazy(
  () => import("../../features/settings/sections/AdvancedBackendSection"),
);

// Configurazione Navigazione (Traduzioni e Icone)
const BASE_NAV = [
  { key: "recording", label: "Registrazione", icon: Mic },
  { key: "diagnostics", label: "Diagnostica", icon: Bug }, // Tradotto
  { key: "workspace", label: "Workspace", icon: Folder },
  { key: "branding", label: "Branding", icon: Palette },
  { key: "prompts", label: "Prompt Intelligence", icon: Sparkles }, 
  { key: "library", label: "Libreria Prompt", icon: FileText },     
  { key: "account", label: "Account", icon: Users },
];

const ADVANCED_ITEM = { key: "advanced", label: "Advanced", icon: Cpu };

const AdvancedSectionFallback = () => (
  <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-400">
    Caricamento modulo avanzato…
  </div>
);

export default function SettingsDrawer({ open, onClose }) {
  const { 
    setShowSetupAssistant, 
    activeSettingsSection, 
    setActiveSettingsSection, 
    hasFeatureFlag, 
    hasModeFlag,
    prompts // Recuperiamo i prompt dal context per la lista di modifica
  } = useAppContext();

  // Stato locale per gestire quale prompt si sta modificando
  const [editingPrompt, setEditingPrompt] = useState(null);

  const featureFlagChecker =
    typeof hasFeatureFlag === "function"
      ? hasFeatureFlag
      : typeof hasModeFlag === "function"
        ? hasModeFlag
        : null;

  const hasAdvancedAccess = typeof featureFlagChecker === "function" && featureFlagChecker("MODE_ADVANCED");

  const navigation = useMemo(() => {
    if (hasAdvancedAccess) {
      const items = BASE_NAV.slice();
      const accountItem = items.pop();
      return accountItem ? [...items, ADVANCED_ITEM, accountItem] : [...items, ADVANCED_ITEM];
    }
    return [...BASE_NAV];
  }, [hasAdvancedAccess]);

  const clearStateOnClose = () => {
    setShowSetupAssistant?.(false);
    setActiveSettingsSection?.(null);
    setEditingPrompt(null); // Reset editing quando si chiude
    onClose?.();
  };

  // Mappa dei componenti per ogni sezione
  const sectionComponents = {
    recording: <RecordingSection />,
    diagnostics: <DiagnosticsSection />,
    workspace: <WorkspaceSection />,
    branding: <BrandingSection />,
    prompts: <PromptInsightsSection />, 
    
    // === SEZIONE LIBRERIA (Builder + Lista) ===
    library: (
      <div className="space-y-8">
        
        {/* 1. FORM DI CREAZIONE / MODIFICA */}
        <div className="rounded-2xl border border-white/10 bg-[#121214] p-6 shadow-lg">
            <div className="mb-4">
                <h3 className="text-lg font-bold text-white">
                    {editingPrompt ? "Modifica Prompt" : "Crea Nuovo Prompt"}
                </h3>
                <p className="text-sm text-zinc-400">
                    {editingPrompt 
                        ? `Stai modificando "${editingPrompt.title}".` 
                        : "Definisci un nuovo assistente AI riutilizzabile."}
                </p>
            </div>
            <PromptBuilder 
                initialData={editingPrompt} 
                onClose={() => setEditingPrompt(null)} // Reset dopo save/cancel
            />
        </div>

        {/* 2. LISTA PROMPT ESISTENTI */}
        <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-2">
                <Edit3 className="h-4 w-4" /> Modifica Prompt Esistenti
            </h3>
            
            <div className="grid grid-cols-1 gap-3">
                {prompts && prompts.length > 0 ? (
                    prompts.map(prompt => (
                        <button
                            key={prompt.id}
                            onClick={() => {
                                setEditingPrompt(prompt);
                                // Scroll dolce verso l'alto per mostrare il form
                                document.querySelector('.max-w-3xl')?.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className={classNames(
                                "flex items-center justify-between p-4 rounded-xl border text-left transition-all duration-200 group",
                                editingPrompt?.id === prompt.id 
                                ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/50" 
                                : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                            )}
                        >
                            <div>
                                <div className={classNames(
                                    "font-semibold text-sm",
                                    editingPrompt?.id === prompt.id ? "text-white" : "text-zinc-300"
                                )}>
                                    {prompt.title}
                                </div>
                                <div className="text-xs text-zinc-500 font-mono mt-0.5 uppercase tracking-wide">
                                    {prompt.persona}
                                </div>
                            </div>
                            <div className={classNames(
                                "p-2 rounded-lg transition-colors",
                                editingPrompt?.id === prompt.id ? "bg-indigo-500/20 text-indigo-300" : "bg-black/20 text-zinc-500 group-hover:text-zinc-300"
                            )}>
                                <Edit3 className="h-4 w-4" />
                            </div>
                        </button>
                    ))
                ) : (
                    <p className="text-sm text-zinc-500 italic">Nessun prompt salvato.</p>
                )}
            </div>
        </div>
      </div>
    ),
    // ==========================================

    advanced: hasAdvancedAccess ? (
      <Suspense fallback={<AdvancedSectionFallback />}>
        <AdvancedBackendSection />
      </Suspense>
    ) : null,
    account: <AccountSection />,
  };

  const activeSection = navigation.find((item) => item.key === activeSettingsSection);
  const ActiveIcon = activeSection?.icon ?? Bug;

  return (
    <Drawer
      open={open}
      onClose={clearStateOnClose}
      title="Impostazioni"
      description="Gestisci le preferenze globali e monitora lo stato del sistema."
      className="max-w-3xl"
    >
      <div>
        <nav className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = item.key === activeSettingsSection;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setActiveSettingsSection?.(item.key);
                  setEditingPrompt(null); // Reset editing quando cambi tab
                  trackEvent("settings.section_opened", { section: item.key });
                }}
                className={classNames(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
                  active
                    ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-100"
                    : "border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:bg-zinc-900/50",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-6 border-t border-white/5 pt-6">
          {activeSection ? (
            <>
              <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                <ActiveIcon className="h-4 w-4" />
                {activeSection.label}
              </div>
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {sectionComponents[activeSection.key] ?? (
                  <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/20 p-6 text-sm text-zinc-400">
                    Modulo non disponibile.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/20 p-6 text-center text-sm text-zinc-400">
              Seleziona una categoria sopra per iniziare.
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}