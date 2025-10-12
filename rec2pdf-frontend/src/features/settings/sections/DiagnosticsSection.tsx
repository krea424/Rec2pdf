import { useCallback, useMemo } from "react";
import SetupAssistant from "../../../components/SetupAssistant";
import { Bug, Sparkles } from "../../../components/icons";
import { useAppContext } from "../../../hooks/useAppContext";
import { classNames } from "../../../utils/classNames";
import { trackEvent, trackToggleEvent } from "../../../utils/analytics";

const STATUS_TONE: Record<string, string> = {
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  error: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  running: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  idle: "border-zinc-700/60 bg-zinc-900/40 text-zinc-200",
};

const BACKEND_TONE: Record<string, string> = {
  true: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  false: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  null: "border-zinc-700/60 bg-zinc-900/40 text-zinc-200",
};

const DiagnosticsSection = () => {
  const {
    backendUp,
    diagnostics,
    runDiagnostics,
    showSetupAssistant,
    setShowSetupAssistant,
    onboardingComplete,
    onboardingSteps,
    onboardingStep,
    setOnboardingStep,
    handleOnboardingFinish,
  } = useAppContext();

  const diagnosticsStatus = diagnostics?.status || "idle";

  const diagnosticsMessage = useMemo(() => {
    if (diagnosticsStatus === "error") {
      return diagnostics?.message || "La diagnostica ha rilevato problemi nella toolchain.";
    }

    if (diagnosticsStatus === "success") {
      return "Ultima diagnostica completata con successo.";
    }

    if (diagnosticsStatus === "running") {
      return "Diagnostica in corso…";
    }

    return "Esegui la diagnostica del backend per verificare la toolchain.";
  }, [diagnostics?.message, diagnosticsStatus]);

  const backendStateLabel = useMemo(() => {
    if (backendUp === true) return "Backend online";
    if (backendUp === false) return "Backend offline";
    return "Stato sconosciuto";
  }, [backendUp]);

  const backendTone = BACKEND_TONE[String(backendUp)] || BACKEND_TONE.null;
  const statusTone = STATUS_TONE[diagnosticsStatus] || STATUS_TONE.idle;

  const handleRunDiagnostics = useCallback(() => {
    trackEvent("settings.diagnostics.run");
    runDiagnostics?.();
  }, [runDiagnostics]);

  const handleToggleAssistant = useCallback(() => {
    const next = !showSetupAssistant;
    trackToggleEvent("settings.diagnostics.setup_assistant", next);
    setShowSetupAssistant?.(next);
  }, [setShowSetupAssistant, showSetupAssistant]);

  return (
    <div className="space-y-4">
      <div className={classNames("rounded-2xl border p-4 text-sm", backendTone)}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{backendStateLabel}</div>
            <p className="mt-1 text-xs leading-relaxed text-inherit">
              Configura l'endpoint backend e verifica che l'API sia raggiungibile prima di avviare le pipeline.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunDiagnostics}
            className="rounded-lg border border-current px-3 py-1.5 text-xs font-medium hover:bg-white/5"
          >
            Esegui diagnostica
          </button>
        </div>
      </div>

      <div className={classNames("rounded-2xl border p-4 text-sm", statusTone)}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Bug className="h-4 w-4" /> Stato diagnostica
        </div>
        <p className="mt-2 text-xs leading-relaxed text-inherit">{diagnosticsMessage}</p>
        {diagnostics?.logs?.length ? (
          <div className="mt-3 space-y-1 rounded-lg border border-current/40 bg-black/10 p-3 font-mono text-[11px] leading-relaxed">
            {diagnostics.logs.slice(-4).map((log, index) => (
              <div key={index} className="truncate" title={log}>
                {log}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <Sparkles className="h-4 w-4 text-indigo-300" /> Assistente di configurazione
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Completa i passaggi guidati per terminare l'onboarding ({onboardingComplete ? "completato" : "in corso"}).
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleAssistant}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-900"
          >
            {showSetupAssistant ? "Nascondi" : "Apri"}
          </button>
        </div>
        {showSetupAssistant && (
          <div className="mt-4">
            <SetupAssistant
              embedded
              onClose={() => {
                trackEvent("settings.diagnostics.setup_assistant_close");
                setShowSetupAssistant?.(false);
              }}
              steps={onboardingSteps}
              currentStep={onboardingStep}
              onStepChange={(step) => {
                setOnboardingStep?.(step);
                trackEvent("settings.diagnostics.setup_step", { step });
              }}
              onFinish={() => {
                handleOnboardingFinish?.();
                trackEvent("settings.diagnostics.setup_finished");
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DiagnosticsSection;
