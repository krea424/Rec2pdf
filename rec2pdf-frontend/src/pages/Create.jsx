import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Bug,
  Cpu,
  Download,
  FileCode,
  FileText,
  Mic,
  Square,
  TimerIcon,
  Upload,
  Info,
  CheckCircle2,
  Users,
  RefreshCw,
  Plus,
  Sparkles,
} from "../components/icons";
import PromptLibrary from "../components/PromptLibrary";
import { useAppContext } from "../hooks/useAppContext";
import { classNames } from "../utils/classNames";
import { Button, Toast } from "../components/ui";
import BaseHome from "../features/base/BaseHome";
import { useAnalytics } from "../context/AnalyticsContext";

const AdvancedDashboard = lazy(() => import("../features/advanced/AdvancedDashboard"));

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

const CreatePage = () => {
  const context = useAppContext();
  const { trackEvent } = useAnalytics();

  const hasAdvancedAccess =
    typeof context.hasModeFlag === "function" ? context.hasModeFlag("MODE_ADVANCED") : false;

  if (context.mode === "base") {
    return <BaseHome />;
  }

  if (!hasAdvancedAccess) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6 text-sm text-zinc-300">
        <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-6">
          <h2 className="text-lg font-semibold text-amber-100">Modalità avanzata non disponibile</h2>
          <p className="mt-2 text-amber-100/80">
            Il tuo account non ha ancora accesso alla control room avanzata. Contatta l'amministratore per abilitare il flag
            <code className="mx-1 rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-xs">MODE_ADVANCED</code> oppure torna
            alla modalità base.
          </p>
        </div>
        <BaseHome />
      </div>
    );
  }

  const {
    theme,
    themes,
    activeWorkspaceProfiles = [],
    activeWorkspaceProfile,
    workspaceProfileSelection,
    workspaceProfileLocked,
    applyWorkspaceProfile,
    clearWorkspaceProfile,
  } = context;
  const isBoardroom = theme === "boardroom";
  const boardroomPrimarySurface =
    "border-white/18 bg-white/[0.02] backdrop-blur-2xl shadow-[0_28px_80px_-40px_rgba(6,20,40,0.85)]";
  const boardroomSecondarySurface =
    "border-white/15 bg-white/[0.015] backdrop-blur-2xl";
  const boardroomChipSurface =
    "border-white/15 bg-white/[0.03] text-slate-100";
  const boardroomInfoSurface =
    "border-white/12 bg-white/[0.02] text-slate-200";
  const boardroomStageStyles = {
    idle: "border-white/12 bg-white/[0.01] text-white/60 backdrop-blur-xl",
    pending: "border-white/14 bg-white/[0.02] text-white/80 backdrop-blur-xl",
    running:
      "border-sky-400/40 bg-gradient-to-r from-[#39b0ff1a] via-[#5dd5c41a] to-[#7b5dff1a] text-white/90 backdrop-blur-xl",
    done:
      "border-emerald-400/50 bg-emerald-400/15 text-emerald-100 backdrop-blur-xl",
    failed:
      "border-rose-400/50 bg-rose-500/12 text-rose-100 backdrop-blur-xl",
    info: "border-white/14 bg-white/[0.02] text-white/75 backdrop-blur-xl",
  };
  const boardroomStageMessageSurface =
    "border-white/12 bg-white/[0.02] text-white/75 backdrop-blur-xl";
  const boardroomConnectorColors = {
    done: "bg-emerald-400/60",
    failed: "bg-rose-500/60",
    base: "bg-white/12",
  };

  const HeaderIcon = context.headerStatus?.icon || Cpu;

  const [openInfo, setOpenInfo] = useState(null);
  const [showCompletionHighlight, setShowCompletionHighlight] = useState(false);
  const pdfLogoInputRef = useRef(null);

  const toggleInfo = (section) => {
    setOpenInfo((prev) => (prev === section ? null : section));
  };

  const handlePdfLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      context.setCustomPdfLogo(file);
      event.target.value = "";
    }
  };

  const pdfLogoLabel = useMemo(() => {
    if (!context.customPdfLogo) return null;
    if (typeof context.customPdfLogo === "string") {
      return context.customPdfLogo;
    }
    if (
      context.customPdfLogo &&
      typeof context.customPdfLogo === "object" &&
      context.customPdfLogo.source === "workspace-profile"
    ) {
      return (
        context.customPdfLogo.label ||
        context.customPdfLogo.profileId ||
        "Logo profilo workspace"
      );
    }
    if (context.customPdfLogo.name) {
      return context.customPdfLogo.name;
    }
    return "Logo personalizzato";
  }, [context.customPdfLogo]);

  const hasWorkspaceProfiles = activeWorkspaceProfiles.length > 0;

  const handleWorkspaceProfileSelect = (event) => {
    const value = event.target.value;
    if (!value) {
      clearWorkspaceProfile();
      return;
    }
    const result = applyWorkspaceProfile(value);
    if (!result.ok && result.message) {
      context.setErrorBanner({ title: "Profilo non applicabile", details: result.message });
    } else if (result.ok) {
      context.setErrorBanner(null);
    }
  };

  const audioDownloadExtension = useMemo(() => {
    const mime = context.mime || "";
    if (mime.includes("webm")) return "webm";
    if (mime.includes("ogg")) return "ogg";
    if (mime.includes("wav")) return "wav";
    return "m4a";
  }, [context.mime]);

  useEffect(() => {
    if (!context.pipelineComplete) {
      setShowCompletionHighlight(false);
      return;
    }

    setShowCompletionHighlight(true);
    const timeout = setTimeout(() => {
      setShowCompletionHighlight(false);
    }, 1600);

    return () => clearTimeout(timeout);
  }, [context.pipelineComplete]);

  const shouldNeutralizePipelineStages =
    context.pipelineComplete && !showCompletionHighlight;

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
  const mutedTextClass = isBoardroom ? "text-white/60" : "text-zinc-500";
  const heroTitleClass = isBoardroom ? "text-white" : "text-zinc-100";
  const heroSubtitleClass = isBoardroom ? "text-white/70" : "text-zinc-400";
  const labelToneClass = isBoardroom ? "text-white/55" : "text-zinc-500";
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

      <Suspense
        fallback={
          <div className="mt-6 rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/30 p-6 text-sm text-zinc-400">
            Caricamento control room…
          </div>
        }
      >
        <AdvancedDashboard />
      </Suspense>

      <section className="mt-6 space-y-4">
        <div
          className={classNames(
            "rounded-3xl border p-6 md:p-7 shadow-xl transition-all",
            isBoardroom ? boardroomPrimarySurface : themes[theme].card,
            "grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
          )}
        >
          <div className="space-y-6">
            <div className="space-y-3">
              <p
                className={classNames(
                  "text-xs font-semibold uppercase tracking-[0.32em]",
                  labelToneClass
                )}
              >
                Executive create hub
              </p>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <h1
                  className={classNames(
                    "text-2xl font-semibold tracking-tight md:text-[28px]",
                    heroTitleClass
                  )}
                >
                  Orchestrazione end-to-end in un pannello essenziale.
                </h1>
                <span
                  className={classNames(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
                    stageStyleBadge,
                    "shadow-sm"
                  )}
                >
                  <HeaderIcon className="h-4 w-4" />
                  {context.pipelineComplete
                    ? "Completata"
                    : context.STAGE_STATUS_LABELS[stageStatus] || stageStatus}
                </span>
              </div>
              <p className={classNames("text-sm leading-relaxed md:text-base", heroSubtitleClass)}>
                Imposta il contesto, registra o carica la sessione e lascia che l&apos;AI generi un PDF
                executive con effetto wow.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {heroSteps.map((step) => (
                <div
                  key={step.key}
                  className={classNames(
                    "rounded-2xl border px-4 py-3 text-sm transition-all",
                    highlightSurface,
                    "hover:border-emerald-400/40 hover:shadow-[0_18px_45px_-28px_rgba(16,185,129,0.55)]"
                  )}
                >
                  <p className={classNames("text-[11px] font-semibold uppercase tracking-[0.32em]", labelToneClass)}>
                    {step.label}
                  </p>
                  <p className={classNames("mt-2 text-sm leading-snug", heroSubtitleClass)}>
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className={classNames("rounded-2xl border p-4", highlightSurface)}>
              <div className="flex items-center justify-between">
                <div
                  className={classNames(
                    "text-[11px] font-semibold uppercase tracking-[0.3em]",
                    labelToneClass
                  )}
                >
                  Pipeline
                </div>
                <div className={classNames("text-xs font-semibold", heroSubtitleClass)}>
                  {context.progressPercent}%
                </div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={classNames(
                    "h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-violet-500 transition-all",
                    context.progressPercent ? "shadow-[0_0_16px_-4px_rgba(96,165,250,0.45)]" : ""
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, context.progressPercent))}%` }}
                />
              </div>
              <div className="mt-4 space-y-1">
                <div className={classNames("text-base font-semibold", heroTitleClass)}>{stageLabel}</div>
                <p className={classNames("text-xs leading-relaxed", heroSubtitleClass)}>
                  {stageDescription}
                </p>
              </div>
            </div>
            <Button
              size="lg"
              variant="primary"
              leadingIcon={Cpu}
              onClick={() => context.processViaBackend()}
              disabled={!canStartPipeline}
              className="w-full justify-center"
            >
              Avvia pipeline executive
            </Button>
            {!canStartPipeline && (
              <p className={classNames("text-xs", mutedTextClass)}>
                Registra o carica un audio per attivare l&apos;esecuzione.
              </p>
            )}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {highlightCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.key}
                className={classNames(
                  "rounded-2xl border p-5 transition-all",
                  highlightSurface,
                  card.emphasis &&
                    "border-emerald-400/40 shadow-[0_24px_60px_-35px_rgba(16,185,129,0.65)]"
                )}
              >
                <div
                  className={classNames(
                    "flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em]",
                    labelToneClass
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {card.label}
                </div>
                <div className={classNames("mt-3 text-lg font-semibold leading-tight", heroTitleClass)}>
                  {card.value}
                </div>
                {card.meta ? (
                  <p className={classNames("mt-2 text-sm leading-relaxed", mutedTextClass)}>
                    {card.meta}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div
          className={classNames(
            "md:col-span-2 rounded-2xl border p-6 shadow-lg",
            isBoardroom ? boardroomPrimarySurface : themes[theme].card,
          )}
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-medium">
              <Mic className="h-5 w-5" /> Registrazione
            </h2>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <TimerIcon className="h-4 w-4" />{" "}
              {context.fmtTime(context.elapsed)}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center">
            <button
              type="button"
              aria-pressed={context.recording}
              onClick={
                context.recording
                  ? context.stopRecording
                  : context.startRecording
              }
              className={classNames(
                "group relative flex h-44 w-44 items-center justify-center overflow-hidden rounded-full text-center text-white transition-all duration-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
                "before:absolute before:inset-[7%] before:rounded-full before:border before:border-white/15 before:opacity-90 before:transition-opacity before:content-['']",
                context.recording
                  ? "bg-gradient-to-br from-rose-500 via-rose-600 to-rose-700 shadow-[0_28px_55px_-28px_rgba(244,63,94,0.95)] focus-visible:ring-4 focus-visible:ring-rose-300/60 animate-pulse"
                  : "bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 shadow-[0_32px_70px_-30px_rgba(16,185,129,0.9)] hover:-translate-y-1 hover:shadow-[0_42px_90px_-32px_rgba(16,185,129,0.95)] focus-visible:ring-4 focus-visible:ring-emerald-300/70",
              )}
              disabled={
                context.busy ||
                !context.mediaSupported ||
                !context.recorderSupported
              }
              title={
                !context.mediaSupported
                  ? "getUserMedia non supportato"
                  : !context.recorderSupported
                    ? "MediaRecorder non supportato"
                    : ""
              }
            >
              {context.recording ? (
                <div className="pointer-events-none flex flex-col items-center gap-3">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-white/15 shadow-inner shadow-rose-900/30">
                    <Square className="h-7 w-7" />
                  </span>
                  <span className="text-sm font-semibold uppercase tracking-[0.32em] text-white/90">
                    Stop
                  </span>
                  <span className="text-xs font-medium text-white/70">
                    Registrazione attiva
                  </span>
                </div>
              ) : (
                <div className="pointer-events-none flex flex-col items-center gap-3">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-inner shadow-emerald-900/30 transition-transform duration-300 group-hover:scale-105 group-active:scale-95">
                    <Mic className="h-7 w-7" />
                  </span>
                  <span className="text-sm font-semibold uppercase tracking-[0.32em] text-white/90">
                    Rec
                  </span>
                  <span className="text-xs font-medium text-white/70">
                    Avvia nuova sessione
                  </span>
                </div>
              )}
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div
              className={classNames(
                "rounded-2xl border p-4 transition-all",
                isBoardroom ? boardroomSecondarySurface : themes[theme].input,
              )}
            >
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  <Sparkles className="h-4 w-4" /> Profilo preconfigurato
                </label>
                {workspaceProfileLocked && (
                  <button
                    type="button"
                    onClick={() => clearWorkspaceProfile()}
                    className="rounded-lg border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
                  >
                    Scollega
                  </button>
                )}
              </div>
              <select
                className={classNames(
                  "mt-3 w-full rounded-lg border px-3 py-2 text-sm outline-none",
                  themes[theme].input,
                  !hasWorkspaceProfiles || !context.workspaceSelection.workspaceId ? 'opacity-60' : ''
                )}
                value={workspaceProfileSelection?.profileId || ''}
                onChange={handleWorkspaceProfileSelect}
                disabled={!context.workspaceSelection.workspaceId || !hasWorkspaceProfiles}
              >
                <option value="">Nessun profilo</option>
                {activeWorkspaceProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label || profile.id}
                  </option>
                ))}
              </select>
              {!context.workspaceSelection.workspaceId && (
                <div className="mt-2 text-xs text-zinc-500">
                  Seleziona un workspace per visualizzare i profili salvati.
                </div>
              )}
              {context.workspaceSelection.workspaceId && !hasWorkspaceProfiles && (
                <div className="mt-2 text-xs text-zinc-500">
                  Nessun profilo configurato per questo workspace.
                </div>
              )}
              {workspaceProfileLocked && activeWorkspaceProfile && (
                <div className="mt-3 space-y-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                  <div className="text-sm font-medium text-emerald-200">
                    Profilo attivo: {activeWorkspaceProfile.label || activeWorkspaceProfile.id}
                  </div>
                  <div>Cartella: {activeWorkspaceProfile.destDir || '—'}</div>
                  <div>Slug: {activeWorkspaceProfile.slug || '—'}</div>
                  <div>Prompt: {activeWorkspaceProfile.promptId || '—'}</div>
                </div>
              )}
            </div>
            <div
              className={classNames(
                "rounded-2xl border p-4 transition-all",
                isBoardroom ? boardroomSecondarySurface : themes[theme].input,
              )}
            >
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  <FileText className="h-4 w-4" /> Cartella
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => context.setDestDir(context.DEFAULT_DEST_DIR)}
                    className={classNames(
                      "rounded-lg border px-2 py-1 text-xs",
                      themes[theme].input,
                      themes[theme].input_hover,
                      workspaceProfileLocked && "cursor-not-allowed opacity-50",
                    )}
                    disabled={workspaceProfileLocked}
                  >
                    Reimposta
                  </button>
                  <button
                    type="button"
                    onClick={() => context.setShowDestDetails((prev) => !prev)}
                    className="text-zinc-400 hover:text-zinc-200"
                    aria-label="Mostra dettagli cartella"
                    aria-expanded={context.showDestDetails}
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <input
                className={classNames(
                  "mt-2 w-full rounded-lg border px-3 py-2 outline-none",
                  themes[theme].input,
                  context.destIsPlaceholder &&
                    "border-rose-600 focus:border-rose-500 focus:ring-rose-500/30",
                )}
                value={context.destDir}
                onChange={(event) => context.setDestDir(event.target.value)}
                placeholder="Es. /Users/mario/Recordings"
                type="text"
                autoComplete="off"
                spellCheck={false}
                disabled={workspaceProfileLocked}
              />
              {context.showDestDetails && (
                <div
                  className={classNames(
                    "mt-2 text-xs",
                    context.destIsPlaceholder
                      ? "text-rose-400"
                      : "text-zinc-500",
                  )}
                >
                  {context.destIsPlaceholder
                    ? `Completa il percorso partendo da "${context.DEFAULT_DEST_DIR}" con il tuo username e la cartella finale (es. /Users/mario/Recordings). Lascia "${context.DEFAULT_DEST_DIR}" o il campo vuoto per usare la cartella predefinita del backend.`
                    : `Lascia "${context.DEFAULT_DEST_DIR}" o il campo vuoto per usare la cartella predefinita del backend.`}
                </div>
              )}
            </div>

            <div
              className={classNames(
                "rounded-2xl border p-4 transition-all",
                isBoardroom ? boardroomSecondarySurface : themes[theme].input,
              )}
            >
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <FileText className="h-4 w-4" /> Slug
              </label>
              <input
                className={classNames(
                  "mt-2 w-full rounded-lg border bg-transparent px-3 py-2 outline-none",
                  themes[theme].input,
                )}
                value={context.slug}
                onChange={(event) => context.setSlug(event.target.value)}
                placeholder="meeting"
                disabled={workspaceProfileLocked}
              />
            </div>

            <div
              className={classNames(
                "rounded-2xl border p-4 transition-all",
                isBoardroom ? boardroomSecondarySurface : themes[theme].input,
              )}
            >
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  <FileCode className="h-4 w-4" /> Logo per PDF
                </label>
                {pdfLogoLabel && (
                  <span className="max-w-[55%] truncate text-[11px] text-zinc-500" title={pdfLogoLabel}>
                    {pdfLogoLabel}
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  ref={pdfLogoInputRef}
                  type="file"
                  accept=".pdf,.svg,.png,.jpg,.jpeg"
                  onChange={handlePdfLogoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => pdfLogoInputRef.current?.click()}
                  className={classNames(
                    "rounded-lg px-3 py-1.5 text-xs font-medium",
                    themes[theme].button,
                    workspaceProfileLocked && "cursor-not-allowed opacity-50",
                  )}
                  disabled={workspaceProfileLocked}
                >
                  Carica
                </button>
                {context.customPdfLogo && (
                  <button
                    type="button"
                    onClick={() => context.setCustomPdfLogo(null)}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-500"
                    disabled={workspaceProfileLocked}
                  >
                    Rimuovi
                  </button>
                )}
              </div>
              {pdfLogoLabel && (
                <div className="mt-2 truncate text-xs text-zinc-500" title={pdfLogoLabel}>
                  {pdfLogoLabel}
                </div>
              )}
            </div>
          </div>

          <div
            className={classNames(
              "mt-4 space-y-3 rounded-2xl border p-5 transition-all",
              isBoardroom ? boardroomSecondarySurface : themes[theme].input,
            )}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Users className="h-4 w-4" />
                  <span>Workspace &amp; progetto</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={context.handleRefreshWorkspaces}
                    className={classNames(
                      "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
                      themes[theme].input,
                      themes[theme].input_hover,
                      context.workspaceLoading && "opacity-60 cursor-not-allowed",
                    )}
                    disabled={context.workspaceLoading}
                  >
                    <RefreshCw
                      className={classNames(
                        "h-3.5 w-3.5",
                        context.workspaceLoading ? "animate-spin" : "",
                      )}
                    />
                    Aggiorna
                  </button>
                  <button
                    type="button"
                    onClick={() => context.openSettingsDrawer?.("workspace")}
                    className={classNames(
                      "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
                      themes[theme].input,
                      themes[theme].input_hover,
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Gestisci workspace
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs text-zinc-500">Workspace</label>
                  <select
                    value={context.workspaceSelection.workspaceId}
                    onChange={(event) =>
                      context.handleSelectWorkspaceForPipeline(event.target.value)
                    }
                    className={classNames(
                      "mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm",
                      themes[theme].input,
                    )}
                  >
                    <option value="">Nessun workspace</option>
                    {context.workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id} className="bg-zinc-900">
                        {workspace.name} · {workspace.client || "—"}
                      </option>
                    ))}
                  </select>
                </div>
                {context.workspaceSelection.workspaceId && (
                  <div>
                    <label className="text-xs text-zinc-500">Policy di versioning</label>
                    <div className="mt-2 text-xs text-zinc-400">
                      {context.activeWorkspace?.versioningPolicy
                        ? `${
                            context.activeWorkspace.versioningPolicy.namingConvention || "timestamped"
                          } · retention ${
                            context.activeWorkspace.versioningPolicy.retentionLimit || 10
                          }`
                        : "Timestamp standard"}
                    </div>
                  </div>
                )}
              </div>
              
              {context.workspaceSelection.workspaceId && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-zinc-500">Progetto</label>
                    <select
                      value={context.projectCreationMode
                        ? "__new__"
                        : context.workspaceSelection.projectId}
                      onChange={(event) =>
                        context.handleSelectProjectForPipeline(event.target.value)
                      }
                      className={classNames(
                        "mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm",
                        themes[theme].input,
                      )}
                    >
                      <option value="">Nessun progetto</option>
                      {context.workspaceProjects.map((project) => (
                        <option key={project.id} value={project.id} className="bg-zinc-900">
                          {project.name}
                        </option>
                      ))}
                      <option value="__new__">+ Nuovo progetto…</option>
                    </select>
                    {context.projectCreationMode && (
                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                        <input
                          value={context.projectDraft}
                          onChange={(event) => context.setProjectDraft(event.target.value)}
                          placeholder="Nome progetto"
                          className={classNames(
                            "rounded-lg border bg-transparent px-3 py-2 text-sm",
                            themes[theme].input,
                          )}
                        />
                        <div className="flex gap-2">
                          <input
                            value={context.statusDraft}
                            onChange={(event) => context.setStatusDraft(event.target.value)}
                            placeholder="Stato iniziale"
                            className={classNames(
                              "flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm",
                              themes[theme].input,
                            )}
                          />
                          <button
                            type="button"
                            onClick={context.handleCreateStatusFromDraft}
                            className={classNames(
                              "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                              themes[theme].input,
                              themes[theme].input_hover,
                              (!context.statusDraft.trim() || context.statusCreationMode) &&
                                "cursor-not-allowed opacity-60",
                            )}
                            disabled={!context.statusDraft.trim() || context.statusCreationMode}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Aggiungi stato
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={context.handleCreateProjectFromDraft}
                          className={classNames(
                            "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs",
                            themes[theme].button,
                            !context.projectDraft.trim() && "opacity-60 cursor-not-allowed",
                          )}
                          disabled={!context.projectDraft.trim()}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Salva progetto
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500">Stato</label>
                    <select
                      value={context.statusCreationMode
                        ? "__new__"
                        : context.workspaceSelection.status || ""}
                      onChange={(event) =>
                        context.handleSelectStatusForPipeline(event.target.value)
                      }
                      className={classNames(
                        "mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm",
                        themes[theme].input,
                      )}
                    >
                      <option value="">Nessuno stato</option>
                      {context.availableStatuses.map((status) => (
                        <option key={status} value={status} className="bg-zinc-900">
                          {status}
                        </option>
                      ))}
                      <option value="__new__">+ Nuovo stato…</option>
                    </select>
                    {context.statusCreationMode && (
                      <div className="mt-2 flex gap-2">
                        <input
                          value={context.statusDraft}
                          onChange={(event) => context.setStatusDraft(event.target.value)}
                          placeholder="Nuovo stato"
                          className={classNames(
                            "flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm",
                            themes[theme].input,
                          )}
                        />
                        <button
                          type="button"
                          onClick={context.handleCreateStatusFromDraft}
                          className={classNames(
                            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                            themes[theme].input,
                            themes[theme].input_hover,
                            (!context.statusDraft.trim() || context.statusCreationMode) &&
                              "cursor-not-allowed opacity-60",
                          )}
                          disabled={!context.statusDraft.trim() || context.statusCreationMode}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Aggiungi stato
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div id="prompt-library">
            <PromptLibrary
              prompts={context.prompts}
              loading={context.promptLoading}
              selection={context.promptState}
              onSelectPrompt={context.handleSelectPromptTemplate}
              onClearSelection={context.handleClearPromptSelection}
              favorites={context.promptFavorites}
              onToggleFavorite={context.handleTogglePromptFavorite}
              onRefresh={context.handleRefreshPrompts}
              themeStyles={themes[theme]}
              themeName={theme}
              activePrompt={context.activePrompt}
              focusValue={context.promptState.focus}
              onFocusChange={context.handlePromptFocusChange}
              notesValue={context.promptState.notes}
              onNotesChange={context.handlePromptNotesChange}
              cueProgress={context.promptState.cueProgress || {}}
              onCueToggle={context.handleTogglePromptCue}
              onCreatePrompt={context.handleCreatePrompt}
              onDeletePrompt={context.handleDeletePrompt}
            />
          </div>

          <div
            className={classNames(
              "mt-6 rounded-xl border p-4",
              isBoardroom ? boardroomSecondarySurface : themes[theme].input,
            )}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm text-zinc-400">
                Clip registrata / caricata
              </div>
              <div className="text-xs text-zinc-500">
                {context.mime || "—"} ·{" "}
                {context.fmtBytes(context.audioBlob?.size)}
              </div>
            </div>
            <div className="mt-3">
              {context.audioUrl ? (
                <audio controls src={context.audioUrl} className="w-full" />
              ) : (
                <div className="text-sm text-zinc-500">
                  Nessuna clip disponibile.
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => context.processViaBackend()}
                disabled={!canStartPipeline}
                className={classNames(
                  "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
                  isBoardroom
                    ? "shadow-[0_26px_60px_-32px_rgba(61,176,255,0.85)] focus-visible:ring-sky-200/70 hover:shadow-[0_34px_80px_-36px_rgba(61,176,255,0.95)]"
                    : "text-white shadow-sm focus-visible:ring-indigo-300 hover:shadow",
                  themes[theme].button,
                  !canStartPipeline && "cursor-not-allowed opacity-60",
                )}
              >
                <Cpu className="h-4 w-4" /> Avvia pipeline
              </button>
              <a
                href={context.audioUrl}
                download={`recording.${audioDownloadExtension}`}
                className={classNames(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium",
                  themes[theme].button,
                  !context.audioUrl && "pointer-events-none opacity-50",
                )}
                onClick={() => {
                  if (!context.audioUrl) {
                    return;
                  }
                  trackEvent("pipeline.export_audio", {
                    mime: context.mime || "",
                    size: context.audioBlob?.size ?? 0,
                    extension: audioDownloadExtension,
                  });
                }}
              >
                <Download className="h-4 w-4" /> Scarica audio
              </a>
              <button
                type="button"
                onClick={context.resetAll}
                className={classNames(
                  "rounded-lg px-4 py-2 text-sm",
                  themes[theme].button,
                )}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div
              className={classNames(
                "rounded-2xl border p-4 transition-all",
                isBoardroom ? boardroomSecondarySurface : themes[theme].input,
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => context.fileInputRef.current?.click()}
                  className={classNames(
                    "flex flex-1 items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold text-zinc-100 transition focus:outline-none focus:ring-2 focus:ring-indigo-400",
                    themes[theme].button,
                  )}
                >
                  <Upload className="h-4 w-4" />
                  Carica audio
                </button>
                <input
                  ref={context.fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={context.onPickFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => toggleInfo("audio")}
                  aria-label="Informazioni su Carica audio"
                  aria-expanded={openInfo === "audio"}
                  aria-controls="upload-audio-info"
                  className={classNames(
                    "flex h-9 w-9 items-center justify-center rounded-full transition",
                    isBoardroom
                      ? "border border-white/20 bg-white/[0.02] text-slate-200 hover:border-white/45 hover:bg-white/[0.06]"
                      : "border border-zinc-700/60 bg-zinc-900/40 text-zinc-300 hover:border-indigo-400 hover:text-indigo-300",
                  )}
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              {openInfo === "audio" && (
                <div
                  id="upload-audio-info"
                  className={classNames(
                    "mt-3 space-y-2 rounded-xl border p-3 text-xs",
                    isBoardroom
                      ? boardroomInfoSurface
                      : "border-zinc-700/60 bg-zinc-900/40 text-zinc-400",
                  )}
                >
                  <p>
                    Usa un file audio esistente come sorgente alternativa alla
                    registrazione.
                  </p>
                  <p>
                    Avvia la pipeline dalla card «Clip registrata / caricata»
                    per elaborare questo audio una volta caricato.
                  </p>
                  <p>
                    Supporta formati comuni (webm/ogg/m4a/wav). Verrà convertito
                    in WAV lato server.
                  </p>
                </div>
              )}
              {context.audioBlob && (
                <div
                  className={classNames(
                    "mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs",
                    isBoardroom
                      ? boardroomChipSurface
                      : "border-zinc-700/50 bg-zinc-900/30 text-zinc-400",
                  )}
                >
                  <span
                    className="max-w-[160px] truncate"
                    title={
                      "name" in context.audioBlob && context.audioBlob.name
                        ? context.audioBlob.name
                        : "Registrazione pronta"
                    }
                  >
                    {"name" in context.audioBlob && context.audioBlob.name
                      ? context.audioBlob.name
                      : "Registrazione pronta"}
                  </span>
                  {Number.isFinite(context.audioBlob.size) && (
                    <span>· {context.fmtBytes(context.audioBlob.size)}</span>
                  )}
                </div>
              )}
            </div>

            <div
              className={classNames(
                "rounded-2xl border p-4 transition-all",
                isBoardroom ? boardroomSecondarySurface : themes[theme].input,
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => context.markdownInputRef.current?.click()}
                  className={classNames(
                    "flex flex-1 items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold text-zinc-100 transition focus:outline-none focus:ring-2 focus:ring-emerald-400",
                    themes[theme].button,
                    context.busy && "cursor-not-allowed opacity-60",
                  )}
                  disabled={context.busy}
                >
                  <FileCode className="h-4 w-4" />
                  Carica Markdown
                </button>
                <input
                  ref={context.markdownInputRef}
                  type="file"
                  accept=".md,text/markdown"
                  onChange={context.handleMarkdownFilePicked}
                  className="hidden"
                  disabled={context.busy}
                />
                <button
                  type="button"
                  onClick={() => toggleInfo("markdown")}
                  aria-label="Informazioni su Carica Markdown"
                  aria-expanded={openInfo === "markdown"}
                  aria-controls="upload-markdown-info"
                  className={classNames(
                    "flex h-9 w-9 items-center justify-center rounded-full transition",
                    isBoardroom
                      ? "border border-white/20 bg-white/[0.02] text-slate-200 hover:border-white/45 hover:bg-white/[0.06]"
                      : "border border-zinc-700/60 bg-zinc-900/40 text-zinc-300 hover:border-emerald-400 hover:text-emerald-300",
                  )}
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              {openInfo === "markdown" && (
                <div
                  id="upload-markdown-info"
                  className={classNames(
                    "mt-3 space-y-2 rounded-xl border p-3 text-xs",
                    isBoardroom
                      ? boardroomInfoSurface
                      : "border-zinc-700/60 bg-zinc-900/40 text-zinc-400",
                  )}
                >
                  <p>
                    Carica un documento .md già strutturato per impaginarlo
                    subito con PPUBR.
                  </p>
                  <p>
                    Supporta solo file Markdown. L&apos;impaginazione usa PPUBR
                    con fallback Pandoc.
                  </p>
                </div>
              )}
              {context.lastMarkdownUpload && (
                <div
                  className={classNames(
                    "mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs",
                    isBoardroom
                      ? boardroomChipSurface
                      : "border-zinc-700/50 bg-zinc-900/30 text-zinc-400",
                  )}
                >
                  <span
                    className="max-w-[160px] truncate"
                    title={context.lastMarkdownUpload.name}
                  >
                    {context.lastMarkdownUpload.name}
                  </span>
                  <span>
                    · {context.fmtBytes(context.lastMarkdownUpload.size)}
                  </span>
                </div>
              )}
            </div>

            <div
              className={classNames(
                "rounded-2xl border p-4 transition-all",
                isBoardroom ? boardroomSecondarySurface : themes[theme].input,
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => context.textInputRef.current?.click()}
                  className={classNames(
                    "flex flex-1 items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold text-zinc-100 transition focus:outline-none focus:ring-2 focus:ring-sky-400",
                    themes[theme].button,
                    context.busy && "cursor-not-allowed opacity-60",
                  )}
                  disabled={context.busy}
                >
                  <FileText className="h-4 w-4" />
                  Carica TXT
                </button>
                <input
                  ref={context.textInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  onChange={context.handleTextFilePicked}
                  className="hidden"
                  disabled={context.busy}
                />
                <button
                  type="button"
                  onClick={() => toggleInfo("text")}
                  aria-label="Informazioni su Carica TXT"
                  aria-expanded={openInfo === "text"}
                  aria-controls="upload-text-info"
                  className={classNames(
                    "flex h-9 w-9 items-center justify-center rounded-full transition",
                    isBoardroom
                      ? "border border-white/20 bg-white/[0.02] text-slate-200 hover:border-white/45 hover:bg-white/[0.06]"
                      : "border border-zinc-700/60 bg-zinc-900/40 text-zinc-300 hover:border-sky-400 hover:text-sky-300",
                  )}
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              {openInfo === "text" && (
                <div
                  id="upload-text-info"
                  className={classNames(
                    "mt-3 space-y-2 rounded-xl border p-3 text-xs",
                    isBoardroom
                      ? boardroomInfoSurface
                      : "border-zinc-700/60 bg-zinc-900/40 text-zinc-400",
                  )}
                >
                  <p>
                    Carica un file .txt: lo convertiamo in Markdown e avviamo
                    l&apos;impaginazione.
                  </p>
                  <p>
                    Supporta file UTF-8 .txt. Il contenuto viene ripulito e
                    salvato come Markdown prima dell&apos;upload.
                  </p>
                </div>
              )}
              {context.lastTextUpload && (
                <div
                  className={classNames(
                    "mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs",
                    isBoardroom
                      ? boardroomChipSurface
                      : "border-zinc-700/50 bg-zinc-900/30 text-zinc-400",
                  )}
                >
                  <span
                    className="max-w-[160px] truncate"
                    title={context.lastTextUpload.name}
                  >
                    {context.lastTextUpload.name}
                  </span>
                  <span>· {context.fmtBytes(context.lastTextUpload.size)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="md:col-span-1">
          <div
            className={classNames(
              "space-y-4 rounded-2xl border p-5 shadow-lg",
              isBoardroom ? boardroomPrimarySurface : themes[theme].card,
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-lg font-medium">
                <Cpu className="h-4 w-4" /> Pipeline
              </h3>
              <div className="flex items-center gap-2">
                <span
                  className={classNames(
                    "inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-medium transition",
                    context.headerStatus?.className,
                  )}
                >
                  <HeaderIcon className="h-4 w-4" />
                  {context.headerStatus?.text}
                </span>
                <button
                  type="button"
                  onClick={() => context.setShowRawLogs((prev) => !prev)}
                  className={classNames(
                    "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                    themes[theme].input,
                    themes[theme].input_hover,
                  )}
                >
                  <Bug className="h-3.5 w-3.5" />
                  {context.showRawLogs
                    ? "Nascondi log grezzi"
                    : "Mostra log grezzi"}
                </button>
              </div>
            </div>
            <div>
              <div
                className={classNames(
                  "h-2 w-full overflow-hidden rounded-full",
                  isBoardroom ? "bg-white/12" : "bg-zinc-800",
                )}
              >
                <div
                  className={classNames(
                    "h-full rounded-full transition-all duration-500",
                    isBoardroom
                      ? "bg-gradient-to-r from-[#39b0ff] via-[#5dd5c4] to-[#7b5dff]"
                      : "bg-gradient-to-r from-indigo-400 via-indigo-300 to-emerald-300",
                  )}
                  style={{ width: `${context.progressPercent}%` }}
                />
              </div>
              <div
                className={classNames(
                  "mt-2 flex items-center justify-between text-xs",
                  isBoardroom ? "text-white/70" : "text-zinc-400",
                )}
              >
                <span>
                  {context.completedStagesCount}/{context.totalStages} step
                  completati
                </span>
                <span>{context.progressPercent}%</span>
              </div>
            </div>
            {context.pipelineComplete && (
              <div
                className={classNames(
                  "mt-4 space-y-3 rounded-xl border px-4 py-3 text-sm shadow-md transition",
                  isBoardroom
                    ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-100 shadow-[0_28px_70px_-45px_rgba(16,185,129,0.9)]"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={classNames(
                      "flex h-9 w-9 items-center justify-center rounded-full border",
                      isBoardroom
                        ? "border-emerald-300/60 bg-emerald-400/20 text-emerald-50"
                        : "border-emerald-400/60 bg-emerald-500/20 text-emerald-50",
                    )}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold tracking-tight">
                      Pipeline completata
                    </p>
                    <p
                      className={classNames(
                        "text-xs leading-relaxed",
                        isBoardroom
                          ? "text-emerald-100/90"
                          : "text-emerald-100/85",
                      )}
                    >
                      Il documento generato è stato salvato nella Library con i
                      riferimenti della sessione.
                    </p>
                  </div>
                </div>
                <div>
                  <RouterLink
                    to="/library"
                    className={classNames(
                      "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
                      isBoardroom
                        ? "border border-emerald-300/60 bg-emerald-400/15 text-emerald-50 hover:bg-emerald-400/25 focus-visible:ring-emerald-200/60"
                        : "border border-emerald-400/60 bg-emerald-500/20 text-emerald-50 hover:bg-emerald-500/30 focus-visible:ring-emerald-200/70",
                    )}
                  >
                    Vai alla Library
                  </RouterLink>
                </div>
              </div>
            )}
            <div className="space-y-4">
              {context.PIPELINE_STAGES.map((stage, index) => {
                const status = context.pipelineStatus[stage.key] || "idle";
                const Icon = stage.icon || Cpu;
                const prevStatus =
                  index > 0
                    ? context.pipelineStatus[
                        context.PIPELINE_STAGES[index - 1].key
                      ] || "idle"
                    : null;
                const baseConnectorClass = isBoardroom
                  ? prevStatus === "done"
                    ? boardroomConnectorColors.done
                    : prevStatus === "failed"
                      ? boardroomConnectorColors.failed
                      : boardroomConnectorColors.base
                  : prevStatus === "done"
                    ? "bg-emerald-500/40"
                    : prevStatus === "failed"
                      ? "bg-rose-500/40"
                      : "bg-zinc-700/60";
                const connectorClass =
                  shouldNeutralizePipelineStages && prevStatus === "done"
                    ? isBoardroom
                      ? boardroomConnectorColors.base
                      : "bg-zinc-700/60"
                    : baseConnectorClass;
                const baseStageStyle = isBoardroom
                  ? boardroomStageStyles[status] || boardroomStageStyles.idle
                  : context.STAGE_STATUS_STYLES[status] ||
                    context.STAGE_STATUS_STYLES.idle;
                const stageStyle =
                  shouldNeutralizePipelineStages && status === "done"
                    ? isBoardroom
                      ? boardroomStageStyles.idle
                      : context.STAGE_STATUS_STYLES.idle
                    : baseStageStyle;
                const isActive = context.failedStage
                  ? context.failedStage.key === stage.key
                  : context.activeStageKey === stage.key;
                const stageMessage = context.stageMessages[stage.key];

                return (
                  <div key={stage.key} className="relative pl-10">
                    {index !== 0 && (
                      <div
                        className={classNames(
                          "absolute left-3 top-0 h-full w-px transition-colors",
                          connectorClass,
                        )}
                      />
                    )}
                    <div
                      className={classNames(
                        "absolute left-0 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border text-xs transition-all",
                        stageStyle,
                        isActive &&
                          (isBoardroom
                            ? "ring-2 ring-sky-400/60"
                            : "ring-2 ring-indigo-400/60"),
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div
                      className={classNames(
                        "rounded-lg border px-3 py-2 transition-all",
                        stageStyle,
                        isActive &&
                          (isBoardroom
                            ? "shadow-lg shadow-sky-500/15"
                            : "shadow-lg shadow-indigo-500/10"),
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div
                          className={classNames(
                            "text-sm font-medium",
                            isBoardroom ? "text-white/90" : "text-zinc-100",
                          )}
                        >
                          {stage.label}
                        </div>
                        <span
                          className={classNames(
                            "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                            stageStyle,
                            status === "running" && "animate-pulse",
                          )}
                        >
                          {context.STAGE_STATUS_LABELS[status] || status}
                        </span>
                      </div>
                      <p
                        className={classNames(
                          "mt-1 text-xs",
                          isBoardroom ? "text-white/70" : "text-zinc-300",
                        )}
                      >
                        {stage.description}
                      </p>
                      {stageMessage && (
                        <div
                          className={classNames(
                            "mt-2 whitespace-pre-wrap rounded-md border px-3 py-2 text-xs font-mono leading-relaxed",
                            status === "failed"
                              ? isBoardroom
                                ? "border-rose-500/50 bg-rose-500/15 text-rose-100"
                                : "border-rose-500/40 bg-rose-500/10 text-rose-200"
                              : isBoardroom
                                ? boardroomStageMessageSurface
                                : "border-zinc-700/60 bg-black/20 text-zinc-200",
                          )}
                        >
                          {stageMessage}
                        </div>
                      )}
                      {status === "failed" && stage.help && (
                        <div className="mt-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                          {stage.help}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {!context.showRawLogs && context.logs?.length > 0 && (
              <div
                className={classNames(
                  "text-xs",
                  isBoardroom ? "text-white/60" : "text-zinc-500",
                )}
              >
                {context.logs.length} righe di log disponibili. Apri i log
                grezzi per i dettagli completi.
              </div>
            )}
            {context.showRawLogs && (
              <div
                className={classNames(
                  "mt-2 max-h-56 overflow-auto rounded-xl border p-3 font-mono text-xs leading-relaxed",
                  themes[theme].log,
                )}
              >
                {context.logs?.length ? (
                  context.logs.map((line, index) => (
                    <div key={index} className="whitespace-pre-wrap">
                      {line}
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-500">Nessun log ancora.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePage;
