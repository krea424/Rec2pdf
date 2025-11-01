import { classNames } from "../../utils/classNames";

const SetupPanel = ({
  isBoardroom,
  theme,
  themes,
  heroSteps,
  statusBadgeLabel,
  stageStyleBadge,
  highlightSurface,
  heroTitleClass,
  heroSubtitleClass,
  labelToneClass,
  boardroomPrimarySurface,
  HeaderIcon,
}) => {
  return (
    <section className="mt-6 space-y-4">
      <div
        className={classNames(
          "rounded-4xl border p-6 md:p-7 shadow-xl transition-all",
          isBoardroom ? boardroomPrimarySurface : themes[theme].card,
          "space-y-6"
        )}
      >
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
            Imposta il contesto, monitora la pipeline e lascia che l&apos;AI generi un PDF executive con effetto wow.
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
    </section>
  );
};

export default SetupPanel;
