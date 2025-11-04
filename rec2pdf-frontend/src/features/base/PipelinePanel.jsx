import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cpu, Download, FileText, RefreshCw, Sparkles, Users } from "../../components/icons";
import { useAppContext } from "../../hooks/useAppContext";
import { useAnalytics } from "../../context/AnalyticsContext";
import { classNames } from "../../utils/classNames";

const statusTone = {
  idle: "text-white/60",
  pending: "text-sky-200",
  running: "text-sky-100",
  done: "text-emerald-200",
  failed: "text-rose-200",
};

const PipelinePanel = ({ latestEntry, journeyStage = "record" }) => {
  const context = useAppContext();
  const { trackEvent } = useAnalytics();
  const {
    PIPELINE_STAGES,
    pipelineStatus,
    stageMessages,
    STAGE_STATUS_LABELS,
    progressPercent,
    processViaBackend,
    audioBlob,
    backendUp,
    busy,
    pipelineComplete,
    activeStageKey,
    handleOpenHistoryPdf,
    handleOpenHistoryMd,
    resetAll,
    baseJourneyVisibility,
    revealPipelinePanel,
    openRefinementPanel,
    enableDiarization,
    setEnableDiarization,
    workspaceSelection,
    workspaceProfileSelection,
    activeWorkspaceProfiles,
    applyWorkspaceProfile,
    clearWorkspaceProfile,
    workspaces,
    handleSelectWorkspaceForPipeline,
  } = context;

  const pipelineRevealState = baseJourneyVisibility?.pipeline ?? false;
  const refinementPanelOpen = baseJourneyVisibility?.refine ?? false;
  const [hasLaunchedPipeline, setHasLaunchedPipeline] = useState(() => pipelineRevealState);
  const canPublish =
    Boolean(audioBlob) && !busy && backendUp !== false && !hasLaunchedPipeline;
  const publishLocked = hasLaunchedPipeline;
  const focusPublish = journeyStage === "publish" && !pipelineComplete;
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [hasUnlockedNextSteps, setHasUnlockedNextSteps] = useState(false);
  const hasUnlockedNextStepsRef = useRef(false);
  const focusDownload =
    journeyStage === "download" && pipelineComplete && latestEntry?.pdfPath && !hasDownloaded;

  const shouldDimContent = focusPublish || focusDownload;

  const pipelineInFlight = busy && !pipelineComplete;
  const diarizationProfileKey = "nuovo_template_verbale";
  const previousProfileRef = useRef(null);

  const applyMeetingProfileIfAvailable = useCallback(() => {
    const normalize = (value) =>
      (value || "")
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");
    const targetKey = normalize(diarizationProfileKey);

    let targetWorkspaceId = workspaceSelection?.workspaceId || "";
    let candidateProfiles = activeWorkspaceProfiles;

    if (!targetWorkspaceId) {
      const matchingWorkspace = (workspaces || []).find((workspace) => {
        if (!workspace || typeof workspace !== "object") {
          return false;
        }
        const profiles = Array.isArray(workspace.profiles) ? workspace.profiles : [];
        return profiles.some((profile) => {
          const keys = [
            normalize(profile?.id),
            normalize(profile?.slug),
            normalize(profile?.label),
          ].filter(Boolean);
          return keys.includes(targetKey);
        });
      });
      if (!matchingWorkspace) {
        return false;
      }
      targetWorkspaceId = matchingWorkspace.id || "";
      candidateProfiles = Array.isArray(matchingWorkspace?.profiles)
        ? matchingWorkspace.profiles
        : [];
      if (typeof handleSelectWorkspaceForPipeline === "function" && targetWorkspaceId) {
        handleSelectWorkspaceForPipeline(targetWorkspaceId);
      }
    }

    const candidate =
      candidateProfiles.find((profile) => {
        if (!profile || typeof profile !== "object") {
          return false;
        }
        const keys = [
          normalize(profile.id),
          normalize(profile.slug),
          normalize(profile.label),
        ].filter(Boolean);
        return keys.includes(targetKey);
      }) || null;

    if (!candidate) {
      return false;
    }

    const currentProfileId = workspaceProfileSelection?.profileId || "";
    if (currentProfileId === candidate.id) {
      return true;
    }

    previousProfileRef.current = currentProfileId;
    const result = applyWorkspaceProfile(candidate.id, {
      workspaceId: targetWorkspaceId,
    });

    if (!result?.ok) {
      console.warn(
        "Impossibile applicare il profilo diarizzazione:",
        result?.message || "profilo non applicato"
      );
      return false;
    }
    return true;
  }, [
    activeWorkspaceProfiles,
    applyWorkspaceProfile,
    handleSelectWorkspaceForPipeline,
    workspaceProfileSelection?.profileId,
    workspaceSelection?.workspaceId,
    workspaces,
  ]);

  const restorePreviousProfile = useCallback(() => {
    if (!workspaceSelection?.workspaceId) {
      previousProfileRef.current = null;
      return;
    }
    const previousProfileId = previousProfileRef.current;
    previousProfileRef.current = null;
    if (previousProfileId) {
      const result = applyWorkspaceProfile(previousProfileId, {
        workspaceId: workspaceSelection.workspaceId,
      });
      if (!result?.ok) {
        console.warn(
          "Impossibile ripristinare il profilo precedente:",
          result?.message || "profilo non disponibile"
        );
      }
      return;
    }
    if (typeof clearWorkspaceProfile === "function") {
      clearWorkspaceProfile();
    }
  }, [applyWorkspaceProfile, clearWorkspaceProfile, workspaceSelection?.workspaceId]);

  useEffect(() => {
    previousProfileRef.current = null;
  }, [workspaceSelection?.workspaceId]);

  const toggleDiarization = useCallback(() => {
    if (busy) {
      return;
    }
    const nextValue = !enableDiarization;
    setEnableDiarization(nextValue);
    if (!enableDiarization && nextValue) {
      if (audioBlob) {
        const applied = applyMeetingProfileIfAvailable();
        if (!applied) {
          previousProfileRef.current = null;
        }
      } else {
        previousProfileRef.current = null;
      }
    }
    if (enableDiarization && !nextValue) {
      restorePreviousProfile();
    }
  }, [
    applyMeetingProfileIfAvailable,
    audioBlob,
    busy,
    enableDiarization,
    restorePreviousProfile,
    setEnableDiarization,
  ]);

  const entryId = latestEntry?.id ?? null;
  const entryPdfPath = latestEntry?.pdfPath ?? null;

  useEffect(() => {
    setHasDownloaded(false);
    setHasUnlockedNextSteps(hasUnlockedNextStepsRef.current);
  }, [entryId]);

  useEffect(() => {
    if (!pipelineComplete || !entryPdfPath) {
      setHasDownloaded(false);
    }
  }, [entryPdfPath, pipelineComplete]);

  useEffect(() => {
    if (pipelineRevealState) {
      setHasLaunchedPipeline(true);
      return;
    }
    setHasLaunchedPipeline(false);
  }, [pipelineRevealState]);

  const handlePublish = useCallback(() => {
    if (!canPublish) {
      return;
    }
    trackEvent("pipeline.publish_requested", {
      hasAudio: Boolean(audioBlob),
      backendReachable: backendUp !== false,
    });
    revealPipelinePanel();
    setHasLaunchedPipeline(true);
    processViaBackend();
  }, [audioBlob, backendUp, canPublish, processViaBackend, revealPipelinePanel, trackEvent]);

  const handleRefineAndGenerate = useCallback(() => {
    if (!canPublish) {
      return;
    }
    trackEvent("pipeline.refine_panel_requested", {
      hasAudio: Boolean(audioBlob),
      backendReachable: backendUp !== false,
    });
    if (typeof openRefinementPanel === "function") {
      openRefinementPanel();
    }
  }, [audioBlob, backendUp, canPublish, openRefinementPanel, trackEvent]);

  const handleDownload = useCallback(() => {
    if (!latestEntry?.pdfPath) {
      return;
    }
    trackEvent("pipeline.export_pdf", {
      entryId: latestEntry?.id || null,
      path: latestEntry.pdfPath,
    });
    handleOpenHistoryPdf(latestEntry);
    setHasDownloaded(true);
    hasUnlockedNextStepsRef.current = true;
    setHasUnlockedNextSteps(true);
  }, [handleOpenHistoryPdf, latestEntry, trackEvent]);

  const handleModifyPdf = useCallback(() => {
    if (!latestEntry) {
      return;
    }
    trackEvent("pipeline.export_markdown", {
      entryId: latestEntry?.id || null,
      path: latestEntry?.mdPath || "",
    });
    handleOpenHistoryMd(latestEntry);
    setHasDownloaded(true);
    hasUnlockedNextStepsRef.current = true;
    setHasUnlockedNextSteps(true);
  }, [handleOpenHistoryMd, latestEntry, trackEvent]);

  const handleResetSession = useCallback(() => {
    trackEvent("pipeline.reset_session", {
      fromDownload: pipelineComplete,
      hadAudio: Boolean(audioBlob),
    });
    setHasDownloaded(false);
    hasUnlockedNextStepsRef.current = false;
    setHasUnlockedNextSteps(false);
    setHasLaunchedPipeline(false);
    resetAll();
  }, [audioBlob, pipelineComplete, resetAll, trackEvent]);

  const stages = useMemo(
    () =>
      PIPELINE_STAGES.map((stage) => {
        const status = pipelineStatus[stage.key] || "idle";
        const description = stageMessages[stage.key] || stage.description;
        return {
          key: stage.key,
          label: stage.label,
          icon: stage.icon,
          status,
          description,
          statusLabel: STAGE_STATUS_LABELS[status] || status,
        };
      }),
    [PIPELINE_STAGES, STAGE_STATUS_LABELS, pipelineStatus, stageMessages]
  );

  const activeStageDefinition = useMemo(
    () => stages.find((stage) => stage.key === activeStageKey),
    [stages, activeStageKey]
  );

  const nextStageDefinition = useMemo(() => {
    if (!activeStageKey) {
      return null;
    }
    const activeIndex = stages.findIndex((stage) => stage.key === activeStageKey);
    if (activeIndex === -1) {
      return null;
    }
    return stages.slice(activeIndex + 1).find((stage) => stage.status !== "done") || null;
  }, [activeStageKey, stages]);

  const activeStageMessage = useMemo(() => {
    if (pipelineComplete) {
      return "Pipeline completata. Scarica il PDF per continuare.";
    }
    if (!pipelineInFlight) {
      return "Tutto pronto. Premi Ottieni PDF per avviare la pipeline automatica.";
    }
    if (activeStageDefinition) {
      return (
        stageMessages[activeStageDefinition.key] ||
        activeStageDefinition.description ||
        "Pipeline avviata, stiamo preparando il risultato."
      );
    }
    return "Pipeline avviata, stiamo preparando il risultato.";
  }, [activeStageDefinition, pipelineComplete, pipelineInFlight, stageMessages]);

  const activeStageTitle = useMemo(() => {
    if (pipelineComplete) {
      return "Pronto al download";
    }
    if (!pipelineInFlight) {
      return "In attesa di generazione";
    }
    if (activeStageDefinition) {
      return `${activeStageDefinition.label}: in corso`;
    }
    return "Pipeline in corso";
  }, [activeStageDefinition, pipelineComplete, pipelineInFlight]);

  const pipelineStatusAccent = pipelineComplete
    ? "border-white/10 bg-white/5 text-white/80"
    : pipelineInFlight
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
      : "border-white/10 bg-white/5 text-white/80";

  const StatusIcon = activeStageDefinition?.icon || Sparkles;

  const publishCtaClassName = classNames(
    "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-base font-semibold",
    "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
    focusPublish
      ? publishLocked
        ? "border border-white/10 bg-white/5 text-white/45"
        : canPublish
          ? "bg-emerald-400 text-slate-950 shadow-[0_20px_60px_-35px_rgba(16,185,129,0.9)] hover:bg-emerald-300"
          : busy
            ? "bg-emerald-500/40 text-emerald-50 shadow-[0_18px_60px_-30px_rgba(16,185,129,0.6)]"
            : "bg-emerald-500/30 text-emerald-100"
      : canPublish
        ? "border border-white/15 bg-white/5 text-white/75 hover:border-white/25 hover:bg-white/10"
        : publishLocked
          ? "border border-white/10 bg-white/5 text-white/45"
          : "border border-white/10 bg-white/5 text-white/50",
    focusDownload ? "opacity-50" : null,
    (!canPublish || publishLocked) && "cursor-not-allowed"
  );

  const refineCtaClassName = classNames(
    "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-base font-semibold",
    "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
    refinementPanelOpen
      ? "border border-indigo-300/60 bg-indigo-500/30 text-indigo-100 shadow-[0_20px_60px_-35px_rgba(99,102,241,0.8)]"
      : canPublish
        ? "border border-white/15 bg-white/5 text-white/75 hover:border-white/25 hover:bg-white/10"
        : publishLocked
          ? "border border-white/10 bg-white/5 text-white/45"
          : "border border-white/15 bg-white/5 text-white/55",
    (!canPublish || publishLocked) && "cursor-not-allowed"
  );

  const downloadButtonClass = classNames(
    "flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
    focusDownload
      ? "bg-emerald-400 text-slate-950 shadow-[0_18px_60px_-30px_rgba(16,185,129,0.9)] hover:bg-emerald-300"
      : hasDownloaded
        ? "border border-emerald-300/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
        : "border border-emerald-300/50 bg-emerald-400/20 text-emerald-100 hover:bg-emerald-400/30"
  );

  const modifyButtonClass = classNames(
    "flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
    hasDownloaded
      ? "bg-indigo-400 text-slate-950 shadow-[0_18px_60px_-30px_rgba(99,102,241,0.8)] hover:bg-indigo-300"
      : "border border-white/15 bg-white/5 text-white/75 hover:border-white/25 hover:bg-white/10"
  );

  const newSessionButtonClass = classNames(
    "flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
    pipelineComplete
      ? "bg-emerald-400 text-slate-950 shadow-[0_18px_60px_-30px_rgba(16,185,129,0.9)] hover:bg-emerald-300"
      : "border border-white/15 bg-white/5 text-white/70 hover:border-white/25 hover:bg-white/10",
    busy ? "cursor-not-allowed opacity-60" : null
  );

  const showDownloadActions = pipelineComplete && latestEntry?.pdfPath;
  const showNextSteps = showDownloadActions && hasUnlockedNextSteps;
  const showPipelineDetails =
    hasLaunchedPipeline || pipelineInFlight || pipelineComplete || showDownloadActions;

  return (
    <div className="flex h-full flex-col gap-5 rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-subtle">
      <div>
        <h2
          className={classNames(
            "flex items-center gap-2 text-lg font-semibold uppercase tracking-[0.32em]",
            shouldDimContent ? "text-white/50" : "text-white/70"
          )}
        >
          <Sparkles className="h-4 w-4" /> Ottieni PDF
        </h2>
        <p className={classNames("mt-1 text-sm", shouldDimContent ? "text-white/45" : "text-white/70")}>
          Avvia la pipeline automatizzata e ricevi il PDF pronto da condividere.
        </p>
      </div>

      <div className="space-y-3">
        <div
          className={classNames(
            "rounded-2xl border border-white/10 bg-white/5 px-4 py-3",
            shouldDimContent ? "text-white/50" : "text-white"
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                className={classNames(
                  "flex items-center gap-2 text-sm font-semibold",
                  shouldDimContent ? "text-white/60" : "text-white"
                )}
              >
                <Users className="h-4 w-4" /> Identifica speaker multipli (per riunioni)
              </p>
              <p
                className={classNames("mt-1 text-xs", shouldDimContent ? "text-white/40" : "text-white/60")}
              >
                Attiva questa opzione per separare le voci in una conversazione. L&apos;elaborazione potrebbe richiedere più tempo.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enableDiarization}
              aria-label="Attiva diarizzazione degli speaker"
              onClick={toggleDiarization}
              disabled={busy}
              className={classNames(
                "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
                enableDiarization ? "bg-emerald-400" : "bg-white/20",
                busy ? "cursor-not-allowed opacity-50" : "hover:bg-white/30"
              )}
            >
              <span
                className={classNames(
                  "inline-block h-5 w-5 rounded-full bg-white transition-transform",
                  enableDiarization ? "translate-x-5" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handlePublish}
            disabled={!canPublish}
            className={classNames(publishCtaClassName, "sm:flex-1")}
          >
            <Cpu className="h-5 w-5" /> Ottieni PDF
          </button>
          <button
            type="button"
            onClick={handleRefineAndGenerate}
            disabled={!canPublish}
            aria-pressed={refinementPanelOpen}
            className={classNames(refineCtaClassName, "sm:flex-1")}
          >
            <Sparkles className="h-5 w-5" /> Raffina e Genera
          </button>
        </div>
        {pipelineInFlight ? (
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
            Attendere
          </p>
        ) : !canPublish && !publishLocked ? (
          <p className="text-xs text-white/50">Carica o registra un audio per ottenere il PDF.</p>
        ) : null}

        {showDownloadActions ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className={downloadButtonClass}
              >
                <Download className="h-4 w-4" /> Scarica PDF
              </button>
              {latestEntry?.mdPath && !showNextSteps ? (
                <button
                  type="button"
                  onClick={handleModifyPdf}
                  className={modifyButtonClass}
                >
                  <FileText className="h-4 w-4" /> Modifica PDF
                </button>
              ) : null}
            </div>
            {showNextSteps ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-xs text-white/70">
                <p className="text-sm font-semibold text-white">Prossimi passi</p>
                <p className="mt-1">
                  Puoi rifinire il documento nel markdown editor e mantenere a portata di mano il reset della sessione.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {latestEntry?.mdPath ? (
                    <button
                      type="button"
                      onClick={handleModifyPdf}
                      className={modifyButtonClass}
                    >
                      <FileText className="h-4 w-4" /> Modifica PDF
                    </button>
                  ) : null}
                </div>
                <p className="mt-3 text-[11px] text-white/65">
                  Hai finito? Il pulsante «Nuova sessione» qui sotto azzera i caricamenti senza toccare workspace e impostazioni.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          className={classNames(
            "rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition-all",
            pipelineComplete ? "border-emerald-300/50 bg-emerald-500/10" : null,
            shouldDimContent ? "opacity-80" : null
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">Gestione sessione</p>
              <p className="text-xs text-white/70">
                Reimposta i caricamenti mantenendo workspace, prompt e preferenze già configurate.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetSession}
              disabled={busy}
              className={newSessionButtonClass}
            >
              <RefreshCw className="h-4 w-4" /> Nuova sessione
            </button>
          </div>
        </div>
      </div>

      {showPipelineDetails ? (
        <>
          <div
            className={classNames(
              "rounded-2xl border px-4 py-4 text-sm transition-all",
              pipelineStatusAccent
            )}
            role="status"
            aria-live="polite"
          >
              <div className="flex items-start gap-3">
                <div className="relative flex h-11 w-11 flex-none items-center justify-center">
                  {pipelineInFlight ? (
                    <span className="absolute h-11 w-11 animate-ping rounded-full bg-emerald-300/20" aria-hidden="true" />
                  ) : null}
                <span className="absolute inset-0 rounded-full bg-white/5" aria-hidden="true" />
                <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-black/20">
                  <StatusIcon className="h-4 w-4" />
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">{activeStageTitle}</p>
                <p className="text-xs leading-relaxed text-white/75">{activeStageMessage}</p>
                {pipelineInFlight && nextStageDefinition ? (
                  <p className="text-[11px] text-white/60">
                    Prossimo step: {nextStageDefinition.label.toLowerCase()}.
                  </p>
                ) : null}
                {pipelineComplete ? (
                  <p className="text-[11px] text-emerald-200/90">
                    Scarica il PDF o modifica il documento per rifinire il risultato.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {pipelineInFlight ? (
              <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-50">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-200">Attendere</p>
                <p className="mt-1 text-emerald-50/80">
                  Stiamo generando il PDF e aggiorneremo qui ogni fase del processo.
                </p>
              </div>
            ) : null}
            <div>
              <div
                className={classNames(
                  "flex items-center justify-between text-xs uppercase tracking-[0.3em]",
                  shouldDimContent ? "text-white/45" : "text-white/60"
                )}
              >
                <span>Progress</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={classNames(
                    "absolute inset-0 opacity-0 transition-opacity",
                    pipelineInFlight && progressPercent < 15 ? "progress-bar-animated opacity-60" : null
                  )}
                  aria-hidden="true"
                />
                <div
                  className="relative h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-violet-500 transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
                />
              </div>
            </div>

            <ul className="space-y-3">
              {stages.map((stage) => {
                const Icon = stage.icon;
                const status = stage.status;
                const isActive = status === "running";
                const isCompleted = status === "done";
                const isFailed = status === "failed";
                const stageSurfaceClass = pipelineComplete
                  ? "border-white/10 bg-white/5"
                  : isActive
                    ? "border-emerald-400/60 bg-emerald-500/15 shadow-[0_12px_40px_-28px_rgba(16,185,129,0.85)]"
                    : isCompleted
                      ? "border-emerald-400/40 bg-emerald-500/10"
                      : isFailed
                        ? "border-rose-500/50 bg-rose-500/10"
                        : "border-white/10 bg-white/5";
                const statusLabelClass = pipelineComplete
                  ? "text-white/60"
                  : statusTone[stage.status] || "text-white/60";
                const descriptionTone = pipelineComplete
                  ? "text-white/60"
                  : isActive
                    ? "text-white/80"
                    : "text-white/70";
                return (
                  <li
                    key={stage.key}
                    className={classNames(
                      "rounded-2xl border px-4 py-3 transition-all",
                      stageSurfaceClass
                    )}
                    aria-current={isActive ? "step" : undefined}
                  >
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span className="flex items-center gap-2 text-white/90">
                        <Icon className="h-4 w-4" /> {stage.label}
                      </span>
                      <span className={classNames("text-xs font-semibold", statusLabelClass)}>
                        {stage.statusLabel}
                      </span>
                    </div>
                    <p className={classNames("mt-1 text-xs leading-relaxed", descriptionTone)}>
                      {stage.description}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-6 text-sm text-white/60">
          Ottieni PDF per seguire qui lo stato della pipeline e vedere avanzamento e fasi.
        </div>
      )}

    </div>
  );
};

export default PipelinePanel;
