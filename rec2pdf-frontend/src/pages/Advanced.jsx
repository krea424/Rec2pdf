import React from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../hooks/useAppContext";
import { Button, Toast } from "../components/ui";
import { Plus, Sparkles, CheckCircle2, Cpu, Settings } from "../components/icons";
import { classNames } from "../utils/classNames";
// Reimportiamo il manager delle impostazioni
import InputManager from "../features/advanced/InputManager";

const ErrorBanner = () => {
  const { errorBanner, setErrorBanner } = useAppContext();

  if (!errorBanner) {
    return null;
  }

  return (
    <Toast
      tone="danger"
      title={errorBanner.title}
      description={errorBanner.details}
      className="mt-4"
      action={
        <Button size="sm" variant="ghost" onClick={() => setErrorBanner(null)}>
          Chiudi
        </Button>
      }
    />
  );
};

const AdvancedCreatePage = ({ context }) => {
  const { 
    prompts, 
    promptState, 
    handleSelectPromptTemplate, 
    openSettingsDrawer,
    theme,
    themes 
  } = context;

  // Stili per InputManager (ereditati dal vecchio codice per coerenza)
  const isBoardroom = theme === "boardroom";
  const boardroomPrimarySurface =
    "border-white/20 bg-gradient-to-br from-white/[0.14] via-white/[0.05] to-transparent backdrop-blur-3xl shadow-[0_45px_120px_-60px_rgba(4,20,44,0.95)]";
  const boardroomSecondarySurface =
    "border-white/14 bg-white/[0.05] backdrop-blur-2xl shadow-[0_32px_90px_-58px_rgba(9,33,68,0.85)]";
  const boardroomChipSurface =
    "border-white/20 bg-white/[0.08] text-white/90";
  const boardroomInfoSurface =
    "border-white/16 bg-white/[0.05] text-white/80";

  return (
    <div className="mx-auto max-w-6xl p-6 pb-20">
      {!context.secureOK && (
        <div className="mb-6 rounded-xl border border-rose-900/40 bg-rose-950/40 p-3 text-sm text-rose-200">
          ⚠️ Per accedere al microfono serve HTTPS (o localhost in sviluppo).
        </div>
      )}

      <ErrorBanner />

      <div className="space-y-12">
        
        {/* Header Sezione */}
        <div className="flex items-end justify-between border-b border-white/10 pb-6">
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Cpu className="h-6 w-6 text-indigo-400" />
                    Configurazione Avanzata
                </h1>
                <p className="mt-2 text-sm text-zinc-400 max-w-2xl">
                    Definisci il "Cervello AI" e il contesto operativo per la tua sessione.
                </p>
            </div>
            <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => openSettingsDrawer('library')}
                leadingIcon={Plus}
            >
                Nuovo Prompt
            </Button>
        </div>

        {/* SEZIONE 1: Prompt Intelligence */}
        <section className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> 1. Seleziona Prompt Guida
            </h3>
            
            {prompts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/30 p-10 text-center">
                    <p className="text-zinc-400">Nessun prompt trovato nella libreria.</p>
                    <Button 
                        variant="primary" 
                        className="mt-4"
                        onClick={() => openSettingsDrawer('library')}
                    >
                        Crea il primo Prompt
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {prompts.map(prompt => {
                        const isActive = promptState.promptId === prompt.id;
                        return (
                            <button 
                                key={prompt.id}
                                onClick={() => handleSelectPromptTemplate(prompt)}
                                className={classNames(
                                    "relative flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all duration-200 group",
                                    isActive 
                                    ? "border-indigo-500/50 bg-indigo-500/10 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-900/20" 
                                    : "border-white/10 bg-[#121214] hover:bg-[#18181b] hover:border-white/20"
                                )}
                            >
                                <div className="flex w-full items-start justify-between">
                                    <div className={classNames(
                                        "p-2 rounded-lg transition-colors",
                                        isActive ? "bg-indigo-500/20 text-indigo-300" : "bg-white/5 text-zinc-400 group-hover:text-zinc-200"
                                    )}>
                                        <Sparkles className="h-5 w-5" />
                                    </div>
                                    {isActive && <CheckCircle2 className="h-5 w-5 text-indigo-400 animate-in zoom-in duration-200" />}
                                </div>

                                <div>
                                    <h4 className={classNames(
                                        "font-semibold text-base",
                                        isActive ? "text-white" : "text-zinc-200"
                                    )}>
                                        {prompt.title}
                                    </h4>
                                    <p className="text-xs text-zinc-500 mt-1 font-mono uppercase tracking-wide">
                                        {prompt.persona || "Assistente Generico"}
                                    </p>
                                </div>

                                {prompt.description && (
                                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                                        {prompt.description}
                                    </p>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </section>

        {/* SEZIONE 2: Contesto & Output (InputManager Reintrodotto) */}
        <section className="space-y-4 pt-4 border-t border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                <Settings className="h-4 w-4" /> 2. Configurazione Contesto & Output
            </h3>
            
            {/* Qui inseriamo il vecchio InputManager che gestisce Workspace, Template, Logo, etc. */}
            <InputManager
                context={context}
                theme={theme}
                themes={themes}
                isBoardroom={isBoardroom}
                boardroomPrimarySurface={boardroomPrimarySurface}
                boardroomSecondarySurface={boardroomSecondarySurface}
                boardroomChipSurface={boardroomChipSurface}
                boardroomInfoSurface={boardroomInfoSurface}
            />
        </section>

        {/* Footer Flottante */}
        <div className="fixed bottom-6 right-6 z-20">
             <Link 
                to="/create" 
                className="flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-slate-900 shadow-xl hover:bg-emerald-400 hover:scale-105 transition-all"
            >
                Torna alla Pipeline &rarr;
            </Link>
        </div>

      </div>
    </div>
  );
};

const AdvancedPage = () => {
  const context = useAppContext();

  const hasFeatureFlag =
    typeof context.hasFeatureFlag === "function"
      ? context.hasFeatureFlag
      : typeof context.hasModeFlag === "function"
        ? context.hasModeFlag
        : null;

  const hasAdvancedAccess = typeof hasFeatureFlag === "function" ? hasFeatureFlag("MODE_ADVANCED") : false;
  const hasAdvancedV2 = typeof hasFeatureFlag === "function" ? hasFeatureFlag("MODE_ADVANCED_V2") : false;

  if (!hasAdvancedAccess) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6 text-sm text-zinc-300">
        <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-6">
          <h2 className="text-lg font-semibold text-amber-100">Modalità avanzata non disponibile</h2>
          <p className="mt-2 text-amber-100/80">
            Il tuo account non ha ancora accesso alle funzionalità avanzate.
          </p>
          <p className="mt-3 text-amber-100/70">
            <Link to="/create" className="ml-1 underline">
              Torna alla Home
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (!hasAdvancedV2) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6 text-sm text-zinc-300">
        <div className="rounded-3xl border border-sky-500/40 bg-sky-500/10 p-6">
          <h2 className="text-lg font-semibold text-sky-100">Nuova control room in rollout</h2>
          <p className="mt-3 text-sky-100/70">
            <Link to="/create" className="ml-1 underline">
              Torna alla Home
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return <AdvancedCreatePage context={context} />;
};

export default AdvancedPage;