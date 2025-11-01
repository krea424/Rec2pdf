import { Button } from "../../components/ui";
import { Cpu } from "../../components/icons";
import { classNames } from "../../utils/classNames";

const SetupPanel = ({
  isBoardroom,
  theme,
  themes,
  heroSteps,
  stageLabel,
  stageDescription,
  statusBadgeLabel,
  stageStyleBadge,
  progressPercent,
  highlightSurface,
  mutedTextClass,
  heroTitleClass,
  heroSubtitleClass,
  labelToneClass,
  boardroomPrimarySurface,
  onStartPipeline,
  canStartPipeline,
  HeaderIcon,
}) => {
  // TODO(Task 5): Retire the executive hero and pipeline progress when
  // advanced mode becomes parameters-only.
  return (
    <section className="mt-6 space-y-4">
      <div
        className={classNames(
          "rounded-4xl border p-6 md:p-7 shadow-xl transition-all",
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
                  "text-2xl font-display font-semibold tracking-tight md:text-[28px]",
                  heroTitleClass
                )}
              >
                Orchestrazione end-to-end in un pannello essenziale.
              </h1>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <span
                  className={classNames(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all duration-300",
                    stageStyleBadge,
                    "shadow-sm"
                  )}
                >
                  <HeaderIcon className="h-4 w-4" />
                  {statusBadgeLabel}
                </span>
              </div>
            </div>
            <p className={classNames("text-sm leading-relaxed md:text-base", heroSubtitleClass)}>
              Imposta il contesto, registra o carica la sessione e lascia che l&apos;AI generi un PDF executive con effetto wow.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {heroSteps.map((step) => (
              <div
                key={step.key}
                className={classNames(
                  "rounded-3xl border px-4.5 py-3.25 text-sm transition-all",
                  highlightSurface,
                  "hover:border-brand-300/50 hover:shadow-[0_26px_70px_-45px_rgba(31,139,255,0.6)]"
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
          <div className={classNames("rounded-3xl border p-4.5", highlightSurface)}>
            <div className="flex items-center justify-between">
              <div className={classNames("text-[11px] font-semibold uppercase tracking-[0.3em]", labelToneClass)}>
                Pipeline
              </div>
              <div className={classNames("text-xs font-semibold", heroSubtitleClass)}>
                {progressPercent}%
              </div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className={classNames(
                  "h-full rounded-full bg-gradient-to-r from-brand-400 via-[#1f9bbd] to-[#6b6bff] transition-all",
                  progressPercent
                    ? "shadow-[0_0_22px_-8px_rgba(63,163,255,0.65)] animate-boardroom-progress"
                    : ""
                )}
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
            <div className="mt-4 space-y-1">
              <div className={classNames("text-base font-semibold", heroTitleClass)}>{stageLabel}</div>
              <p className={classNames("text-xs leading-relaxed", heroSubtitleClass)}>{stageDescription}</p>
            </div>
          </div>
          <Button
            size="lg"
            variant="primary"
            leadingIcon={Cpu}
            onClick={onStartPipeline}
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
    </section>
  );
};

export default SetupPanel;
