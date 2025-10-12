import { useCallback, useMemo } from "react";
import { Cpu, Download, FileText, Sparkles } from "../../components/icons";
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
    logs,
    handleOpenHistoryPdf,
    handleOpenHistoryMd,
  } = context;

  const canPublish = Boolean(audioBlob) && !busy && backendUp !== false;
  const focusPublish = journeyStage === "publish" && !pipelineComplete;
  const focusDownload = journeyStage === "download" && pipelineComplete && latestEntry?.pdfPath;

  const handlePublish = useCallback(() => {
    if (!canPublish) {
      return;
    }
    trackEvent("pipeline.publish_requested", {
      hasAudio: Boolean(audioBlob),
      backendReachable: backendUp !== false,
    });
    processViaBackend();
  }, [audioBlob, backendUp, canPublish, processViaBackend, trackEvent]);

  const handleDownload = useCallback(() => {
    if (!latestEntry?.pdfPath) {
      return;
    }
    trackEvent("pipeline.export_pdf", {
      entryId: latestEntry?.id || null,
      path: latestEntry.pdfPath,
    });
    handleOpenHistoryPdf(latestEntry);
  }, [handleOpenHistoryPdf, latestEntry, trackEvent]);

  const handleOpenMarkdown = useCallback(() => {
    if (!latestEntry) {
      return;
    }
    trackEvent("pipeline.export_markdown", {
      entryId: latestEntry?.id || null,
      path: latestEntry?.mdPath || "",
    });
    handleOpenHistoryMd(latestEntry);
  }, [handleOpenHistoryMd, latestEntry, trackEvent]);

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

  const logsPreview = useMemo(() => logs.slice(-3), [logs]);

  const publishButtonClass = classNames(
    "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-base font-semibold",
    "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
    focusPublish
      ? busy
        ? "bg-indigo-500/50 text-indigo-50 shadow-[0_18px_60px_-30px_rgba(99,102,241,0.65)]"
        : canPublish
          ? "bg-indigo-400 text-slate-950 shadow-[0_20px_60px_-35px_rgba(99,102,241,0.9)] hover:bg-indigo-300"
          : "bg-indigo-500/30 text-indigo-100"
      : canPublish
        ? "border border-white/15 bg-white/5 text-white/75 hover:border-white/25 hover:bg-white/10"
        : "border border-white/10 bg-white/5 text-white/50",
    focusDownload ? "opacity-50" : null,
    !canPublish && "cursor-not-allowed"
  );

  const downloadButtonClass = classNames(
    "flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
    focusDownload
      ? "bg-emerald-400 text-slate-950 shadow-[0_18px_60px_-30px_rgba(16,185,129,0.9)] hover:bg-emerald-300"
      : "border border-emerald-300/50 bg-emerald-400/20 text-emerald-100 hover:bg-emerald-400/30"
  );

  return (
    <div className="flex h-full flex-col gap-5 rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-subtle">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold uppercase tracking-[0.32em] text-white/70">
          <Sparkles className="h-4 w-4" /> Pubblica
        </h2>
        <p className="mt-1 text-sm text-white/70">
          Avvia la pipeline automatizzata e ricevi il PDF pronto da condividere.
        </p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={handlePublish}
          disabled={!canPublish}
          className={publishButtonClass}
        >
          <Cpu className="h-5 w-5" /> Pubblica
        </button>
        {!canPublish ? (
          <p className="text-xs text-white/50">Carica o registra un audio per pubblicare.</p>
        ) : null}

        {pipelineComplete && latestEntry?.pdfPath ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className={downloadButtonClass}
            >
              <Download className="h-4 w-4" /> Scarica PDF
            </button>
            {latestEntry?.mdPath ? (
              <button
                type="button"
                onClick={handleOpenMarkdown}
                className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                <FileText className="h-4 w-4" /> Markdown
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/60">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-violet-500"
              style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
            />
          </div>
        </div>

        <ul className="space-y-3">
          {stages.map((stage) => {
            const Icon = stage.icon;
            return (
              <li
                key={stage.key}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="flex items-center gap-2 text-white/90">
                    <Icon className="h-4 w-4" /> {stage.label}
                  </span>
                  <span className={classNames("text-xs font-semibold", statusTone[stage.status] || "text-white/60")}> 
                    {stage.statusLabel}
                  </span>
                </div>
                <p className="mt-1 text-xs text-white/70">{stage.description}</p>
              </li>
            );
          })}
        </ul>
      </div>

      {logsPreview.length ? (
        <div
          className="mt-auto rounded-2xl border border-white/10 bg-black/30 p-4"
          role="status"
          aria-live="polite"
          aria-relevant="additions text"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Log recenti</p>
          <ul className="mt-2 space-y-1 text-[11px] text-white/70">
            {logsPreview.map((entry, index) => (
              <li key={`${entry}-${index}`}>{entry}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

export default PipelinePanel;
