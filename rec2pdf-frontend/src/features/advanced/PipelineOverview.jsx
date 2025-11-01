import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Bug, CheckCircle2, Cpu } from "../../components/icons";
import { classNames } from "../../utils/classNames";

const PipelineOverview = ({
  context,
  theme,
  themes,
  isBoardroom,
  boardroomPrimarySurface,
  boardroomStageStyles,
  boardroomStageMessageSurface,
  boardroomConnectorColors,
  HeaderIcon,
}) => {
  // TODO(Task 5): Gate or remove this pipeline visualization when Advanced is
  // trimmed to configuration-only controls.
  const [showCompletionHighlight, setShowCompletionHighlight] = useState(false);

  useEffect(() => {
    if (!context.pipelineComplete) {
      setShowCompletionHighlight(false);
      return;
    }
    setShowCompletionHighlight(true);
    const timeout = setTimeout(() => setShowCompletionHighlight(false), 1600);
    return () => clearTimeout(timeout);
  }, [context.pipelineComplete]);

  const shouldNeutralizePipelineStages =
    context.pipelineComplete && !showCompletionHighlight;

  return (
    <div className="md:col-span-1">
      <div
        className={classNames(
          "space-y-4 rounded-2xl border p-5 shadow-lg",
          isBoardroom ? boardroomPrimarySurface : themes[theme].card
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
                context.headerStatus?.className
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
                themes[theme].input_hover
              )}
            >
              <Bug className="h-3.5 w-3.5" />
              {context.showRawLogs ? "Nascondi log grezzi" : "Mostra log grezzi"}
            </button>
          </div>
        </div>
        <div>
          <div
            className={classNames(
              "h-2 w-full overflow-hidden rounded-full",
              isBoardroom ? "bg-white/12" : "bg-zinc-800"
            )}
          >
            <div
              className={classNames(
                "h-full rounded-full transition-all duration-500",
                isBoardroom
                  ? "bg-gradient-to-r from-[#39b0ff] via-[#5dd5c4] to-[#7b5dff]"
                  : "bg-gradient-to-r from-indigo-400 via-indigo-300 to-emerald-300"
              )}
              style={{ width: `${context.progressPercent}%` }}
            />
          </div>
          <div
            className={classNames(
              "mt-2 flex items-center justify-between text-xs",
              isBoardroom ? "text-white/70" : "text-zinc-400"
            )}
          >
            <span>
              {context.completedStagesCount}/{context.totalStages} step completati
            </span>
            <span>{context.progressPercent}%</span>
          </div>
        </div>

        {context.pipelineComplete && (
          <div
            className={classNames(
              "space-y-3 rounded-xl border px-4 py-3 text-sm shadow-md transition",
              isBoardroom
                ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-100 shadow-[0_28px_70px_-45px_rgba(16,185,129,0.9)]"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={classNames(
                  "flex h-9 w-9 items-center justify-center rounded-full border",
                  isBoardroom
                    ? "border-emerald-300/60 bg-emerald-400/20 text-emerald-50"
                    : "border-emerald-400/60 bg-emerald-500/20 text-emerald-50"
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
                    isBoardroom ? "text-emerald-100/90" : "text-emerald-100/85"
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
                    : "border border-emerald-400/60 bg-emerald-500/20 text-emerald-50 hover:bg-emerald-500/30 focus-visible:ring-emerald-200/70"
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
                ? context.pipelineStatus[context.PIPELINE_STAGES[index - 1].key] || "idle"
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
            const connectorAnimationClass =
              isBoardroom && prevStatus === "running"
                ? "boardroom-connector-progress"
                : "";
            const baseStageStyle = isBoardroom
              ? boardroomStageStyles[status] || boardroomStageStyles.idle
              : context.STAGE_STATUS_STYLES[status] || context.STAGE_STATUS_STYLES.idle;
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
              <div key={stage.key} className="relative pl-12">
                {index !== 0 && (
                  <div
                    className={classNames(
                      "absolute left-4 top-0 h-full w-px transition-all duration-300",
                      connectorClass,
                      connectorAnimationClass
                    )}
                  />
                )}
                <div
                  className={classNames(
                    "absolute left-0 top-1.5 flex h-9 w-9 items-center justify-center rounded-full border text-xs transition-all duration-300",
                    stageStyle,
                    isActive &&
                      (isBoardroom
                        ? "ring-2 ring-brand-200/70"
                        : "ring-2 ring-indigo-400/60")
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div
                  className={classNames(
                    "rounded-3xl border px-5 py-4 transition-all duration-300",
                    stageStyle,
                    isActive &&
                      (isBoardroom
                        ? "shadow-[0_32px_90px_-55px_rgba(63,163,255,0.6)]"
                        : "shadow-lg shadow-indigo-500/10")
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={classNames(
                        "text-sm font-medium",
                        isBoardroom ? "font-display text-white/90" : "text-zinc-100"
                      )}
                    >
                      {stage.label}
                    </div>
                    <span
                      className={classNames(
                        "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase transition-all duration-300",
                        isBoardroom ? "font-display tracking-[0.28em]" : "tracking-wide",
                        stageStyle,
                        status === "running" && "animate-pulse"
                      )}
                    >
                      {context.STAGE_STATUS_LABELS[status] || status}
                    </span>
                  </div>
                  <p
                    className={classNames(
                      "mt-1 text-xs",
                      isBoardroom ? "text-white/70" : "text-zinc-300"
                    )}
                  >
                    {stage.description}
                  </p>
                  {stageMessage && (
                    <div
                      className={classNames(
                        "mt-2 whitespace-pre-wrap text-xs font-mono leading-relaxed transition-all duration-300",
                        isBoardroom ? "rounded-2xl border px-4 py-3" : "rounded-md border px-3 py-2",
                        status === "failed"
                          ? isBoardroom
                            ? "border-rose-500/50 bg-rose-500/15 text-rose-100"
                            : "border-rose-500/40 bg-rose-500/10 text-rose-200"
                          : isBoardroom
                            ? boardroomStageMessageSurface
                            : "border-zinc-700/60 bg-black/20 text-zinc-200"
                      )}
                    >
                      {stageMessage}
                    </div>
                  )}
                  {status === "failed" && stage.help && (
                    <div
                      className={classNames(
                        "mt-2 text-xs transition-all duration-300",
                        isBoardroom
                          ? "rounded-2xl border border-rose-500/40 bg-rose-500/12 px-4 py-3 text-rose-100"
                          : "rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-rose-200"
                      )}
                    >
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
              isBoardroom ? "text-white/60" : "text-zinc-500"
            )}
          >
            {context.logs.length} righe di log disponibili. Apri i log grezzi per i
            dettagli completi.
          </div>
        )}
        {context.showRawLogs && (
          <div
            className={classNames(
              "mt-2 max-h-56 overflow-auto rounded-xl border p-3 font-mono text-xs leading-relaxed",
              themes[theme].log
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
  );
};

export default PipelineOverview;
