import { useMemo } from "react";
import { Cpu, FileText, Mic, Sparkles, Users } from "../components/icons";
import { useAppContext } from "../hooks/useAppContext";
import { Button, Toast } from "../components/ui";
import BaseHome from "../features/base/BaseHome";
import { useAnalytics } from "../context/AnalyticsContext";
import SetupPanel from "../features/advanced/SetupPanel";
import InputManager from "../features/advanced/InputManager";
import PipelineOverview from "../features/advanced/PipelineOverview";

const truncateText = (value, limit = 80) => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, limit)}…`;
};

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

const AdvancedCreatePage = ({ context, trackEvent }) => {
  const { theme, themes } = context;
  const isBoardroom = theme === "boardroom";
  const boardroomPrimarySurface =
    "border-white/20 bg-gradient-to-br from-white/[0.14] via-white/[0.05] to-transparent backdrop-blur-3xl shadow-[0_45px_120px_-60px_rgba(4,20,44,0.95)]";
  const boardroomSecondarySurface =
    "border-white/14 bg-white/[0.05] backdrop-blur-2xl shadow-[0_32px_90px_-58px_rgba(9,33,68,0.85)]";
  const boardroomChipSurface =
    "border-white/20 bg-white/[0.08] text-white/90";
  const boardroomInfoSurface =
    "border-white/16 bg-white/[0.05] text-white/80";
  const boardroomStageStyles = {
    idle:
      "border-white/12 bg-[#0d1f3d]/75 text-slate-100 backdrop-blur-2xl shadow-[0_18px_60px_-48px_rgba(7,29,60,0.55)]",
    pending:
      "border-brand-300/60 bg-[#10345a]/80 text-slate-100 backdrop-blur-2xl shadow-[0_24px_70px_-52px_rgba(31,139,255,0.65)]",
    running:
      "border-brand-400/70 bg-gradient-to-r from-[#1f8bff26] via-[#1f9bbd26] to-[#6b6bff26] text-white backdrop-blur-2xl shadow-[0_30px_80px_-55px_rgba(63,163,255,0.6)]",
    done:
      "border-emerald-300/60 bg-emerald-400/20 text-emerald-50 backdrop-blur-2xl shadow-[0_28px_80px_-55px_rgba(16,185,129,0.5)]",
    failed:
      "border-rose-400/60 bg-rose-500/18 text-rose-50 backdrop-blur-2xl shadow-[0_24px_70px_-52px_rgba(244,63,94,0.5)]",
    info:
      "border-brand-200/45 bg-white/[0.05] text-white/90 backdrop-blur-2xl shadow-[0_20px_64px_-48px_rgba(36,119,198,0.45)]",
  };
  const boardroomStageMessageSurface =
    "border-brand-200/40 bg-white/[0.05] text-white/80 backdrop-blur-2xl shadow-[0_18px_60px_-48px_rgba(31,139,255,0.45)]";
  const boardroomConnectorColors = {
    done: "bg-emerald-400/60",
    failed: "bg-rose-500/60",
    base: "bg-white/14",
  };

  const HeaderIcon = context.headerStatus?.icon || Cpu;

  const audioDownloadExtension = useMemo(() => {
    const mime = context.mime || "";
    if (mime.includes("webm")) return "webm";
    if (mime.includes("ogg")) return "ogg";
    if (mime.includes("wav")) return "wav";
    return "m4a";
  }, [context.mime]);

  const activeProject = useMemo(
    () =>
      context.workspaceProjects.find(
        (project) => project.id === context.workspaceSelection.projectId
      ) || null,
    [context.workspaceProjects, context.workspaceSelection.projectId]
  );

  const workspaceName = context.activeWorkspace?.name || "Workspace non selezionato";
  const workspaceClient = context.activeWorkspace?.client || "—";
  const projectLabel =
    activeProject?.name || context.workspaceSelection.projectName || "Nessun progetto";
  const stageKey = context.failedStage?.key || context.activeStageKey;
  const currentStage =
    context.PIPELINE_STAGES.find((stage) => stage.key === stageKey) || null;
  const stageStatus = stageKey
    ? context.pipelineStatus[stageKey] || (context.pipelineComplete ? "done" : "idle")
    : context.pipelineComplete
      ? "done"
      : "idle";
  const stageLabel = context.pipelineComplete
    ? "Pipeline completata"
    : currentStage?.label || "In attesa di avvio";
  const stageDescription = context.pipelineComplete
    ? "Sessione elaborata e disponibile nella Library."
    : currentStage?.description || "Carica o registra una clip per iniziare.";
  const stageStyleBadge = isBoardroom
    ? boardroomStageStyles[stageStatus] || boardroomStageStyles.idle
    : context.STAGE_STATUS_STYLES[stageStatus] || context.STAGE_STATUS_STYLES.idle;
  const canStartPipeline =
    Boolean(context.audioBlob) && !context.busy && context.backendUp !== false;
  const highlightSurface = isBoardroom ? boardroomSecondarySurface : themes[theme].input;
  const mutedTextClass = isBoardroom ? "text-white/75" : "text-zinc-500";
  const heroTitleClass = isBoardroom ? "text-white" : "text-zinc-100";
  const heroSubtitleClass = isBoardroom ? "text-white/80" : "text-zinc-400";
  const labelToneClass = isBoardroom ? "text-white/65" : "text-zinc-500";
  const heroSteps = useMemo(
    () => [
      {
        key: "setup",
        label: "Setup",
        description: "Workspace, progetto e prompt",
      },
      {
        key: "record",
        label: "Rec / Upload",
        description: "Registra o importa la sessione",
      },
      {
        key: "deliver",
        label: "PDF Wow",
        description: "Report strutturato in pochi secondi",
      },
    ],
    []
  );

  const highlightCards = useMemo(() => {
    const promptTitle = typeof context.activePrompt?.title === "string"
      ? context.activePrompt.title
      : "";
    const focusNotes =
      typeof context.promptState?.focus === "string" && context.promptState.focus.trim()
        ? truncateText(context.promptState.focus, 72)
        : null;
    const persona =
      typeof context.activePrompt?.persona === "string" && context.activePrompt.persona
        ? context.activePrompt.persona
        : null;

    return [
      {
        key: "workspace",
        label: "Workspace",
        value: workspaceName,
        meta:
          workspaceClient && workspaceClient !== "—"
            ? `Cliente · ${workspaceClient}`
            : "Scegli il contesto operativo per allineare automazioni e permessi.",
        icon: Users,
      },
      {
        key: "project",
        label: "Progetto",
        value: projectLabel,
        meta: context.workspaceSelection.status
          ? `Stato · ${context.workspaceSelection.status}`
          : "Definisci lo stato per monitorare milestone e priorità.",
        icon: FileText,
      },
      {
        key: "prompt",
        label: "Prompt guida",
        value: promptTitle || "Nessun template attivo",
        meta:
          focusNotes || persona
            ? focusNotes || `Persona · ${persona}`
            : "Attiva un prompt dalla libreria per orchestrare tono e struttura.",
        icon: Sparkles,
      },
      {
        key: "audio",
        label: "Input sessione",
        value: context.audioBlob ? "Audio pronto" : "In attesa di input",
        meta: context.audioBlob
          ? `${context.mime || "Formato sconosciuto"} · ${context.fmtBytes(
              context.audioBlob.size
            )}`
          : "Registra o carica una clip per sbloccare la pipeline automatizzata.",
        icon: Mic,
        emphasis: Boolean(context.audioBlob),
      },
    ];
  }, [
    context.activePrompt?.persona,
    context.activePrompt?.title,
    context.audioBlob,
    context.mime,
    context.promptState?.focus,
    context.workspaceSelection.status,
    context.workspaceSelection.projectId,
    context.workspaceSelection.projectName,
    context.fmtBytes,
    workspaceClient,
    workspaceName,
    projectLabel,
  ]);

  return (
    <div>
      {!context.secureOK && (
        <div className="mt-4 rounded-xl border border-rose-900/40 bg-rose-950/40 p-3 text-sm text-rose-200">
          ⚠️ Per accedere al microfono serve HTTPS (o localhost in sviluppo).
        </div>
      )}

      <ErrorBanner />

      <SetupPanel
        isBoardroom={isBoardroom}
        theme={theme}
        themes={themes}
        heroSteps={heroSteps}
        highlightCards={highlightCards}
        stageLabel={stageLabel}
        stageDescription={stageDescription}
        statusBadgeLabel={
          context.pipelineComplete
            ? "Completata"
            : context.STAGE_STATUS_LABELS[stageStatus] || stageStatus
        }
        stageStyleBadge={stageStyleBadge}
        progressPercent={context.progressPercent}
        highlightSurface={highlightSurface}
        mutedTextClass={mutedTextClass}
        heroTitleClass={heroTitleClass}
        heroSubtitleClass={heroSubtitleClass}
        labelToneClass={labelToneClass}
        boardroomPrimarySurface={boardroomPrimarySurface}
        onStartPipeline={context.processViaBackend}
        canStartPipeline={canStartPipeline}
        HeaderIcon={HeaderIcon}
      />

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        <InputManager
          context={context}
          theme={theme}
          themes={themes}
          isBoardroom={isBoardroom}
          boardroomPrimarySurface={boardroomPrimarySurface}
          boardroomSecondarySurface={boardroomSecondarySurface}
          boardroomChipSurface={boardroomChipSurface}
          boardroomInfoSurface={boardroomInfoSurface}
          trackEvent={trackEvent}
          canStartPipeline={canStartPipeline}
          audioDownloadExtension={audioDownloadExtension}
        />
        <PipelineOverview
          context={context}
          theme={theme}
          themes={themes}
          isBoardroom={isBoardroom}
          boardroomPrimarySurface={boardroomPrimarySurface}
          boardroomStageStyles={boardroomStageStyles}
          boardroomStageMessageSurface={boardroomStageMessageSurface}
          boardroomConnectorColors={boardroomConnectorColors}
          HeaderIcon={HeaderIcon}
        />
      </div>
    </div>
  );
};

const CreatePage = () => {
  const context = useAppContext();
  const { trackEvent } = useAnalytics();

  const hasAdvancedAccess =
    typeof context.hasModeFlag === "function" ? context.hasModeFlag("MODE_ADVANCED") : false;
  const hasAdvancedV2 =
    typeof context.hasModeFlag === "function" ? context.hasModeFlag("MODE_ADVANCED_V2") : false;

  if (context.mode === "base") {
    return <BaseHome />;
  }

  if (!hasAdvancedAccess) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6 text-sm text-zinc-300">
        <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-6">
          <h2 className="text-lg font-semibold text-amber-100">Modalità avanzata non disponibile</h2>
          <p className="mt-2 text-amber-100/80">
            Il tuo account non ha ancora accesso alle funzionalità avanzate. Contatta l'amministratore per abilitare il flag
            <code className="mx-1 rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-xs">MODE_ADVANCED</code> oppure torna
            alla modalità base.
          </p>
        </div>
        <BaseHome />
      </div>
    );
  }

  if (!hasAdvancedV2) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6 text-sm text-zinc-300">
        <div className="rounded-3xl border border-sky-500/40 bg-sky-500/10 p-6">
          <h2 className="text-lg font-semibold text-sky-100">Nuova control room in rollout</h2>
          <p className="mt-2 text-sky-100/85">
            Stai usando la vista avanzata classica. Per provare la nuova control room apri Supabase → Authentication → Users,
            modifica il tuo profilo e aggiungi <code className="mx-1 rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-xs">MODE_ADVANCED_V2</code>
            all'attributo <code className="mx-1 font-mono text-xs">modeFlags</code> insieme a <code className="mx-1 rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-xs">MODE_ADVANCED</code>. In locale puoi settare <code className="mx-1 font-mono text-xs">VITE_DEFAULT_MODE_FLAGS=MODE_BASE,MODE_ADVANCED,MODE_ADVANCED_V2</code>.
          </p>
        </div>
        <BaseHome />
      </div>
    );
  }

  return <AdvancedCreatePage context={context} trackEvent={trackEvent} />;
};

export default CreatePage;
