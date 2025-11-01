import { Button } from "../../components/ui";
import { Library } from "../../components/icons";
import { classNames } from "../../utils/classNames";

const SetupPanel = ({
  isBoardroom,
  theme,
  themes,
  boardroomPrimarySurface,
  labelToneClass,
  heroTitleClass,
  heroSubtitleClass,
  summaryItems = [],
  onOpenLibrary,
}) => {
  return (
    <section className="mt-6">
      <div
        className={classNames(
          "rounded-4xl border p-6 md:p-7 shadow-xl transition-all",
          isBoardroom ? boardroomPrimarySurface : themes[theme].card,
          "space-y-6"
        )}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p
              className={classNames(
                "text-xs font-semibold uppercase tracking-[0.32em]",
                labelToneClass
              )}
            >
              Control room avanzata
            </p>
            <h1
              className={classNames(
                "text-2xl font-display font-semibold tracking-tight md:text-[28px]",
                heroTitleClass
              )}
            >
              Configura parametri e criteri.
            </h1>
            <p
              className={classNames(
                "max-w-2xl text-sm leading-relaxed md:text-base",
                heroSubtitleClass
              )}
            >
              Seleziona workspace, profili e prompt. L&apos;esecuzione della pipeline avviene dalla Library avanzata una volta
              salvate le preferenze.
            </p>
          </div>
          {typeof onOpenLibrary === "function" && (
            <Button
              type="button"
              variant="primary"
              size="lg"
              leadingIcon={Library}
              className="w-full justify-center md:w-auto"
              onClick={onOpenLibrary}
            >
              Apri Library avanzata
            </Button>
          )}
        </div>

        {summaryItems.length > 0 && (
          <div
            className={classNames(
              "grid gap-4",
              summaryItems.length > 2
                ? "md:grid-cols-2 xl:grid-cols-3"
                : "md:grid-cols-2"
            )}
          >
            {summaryItems.map((item) => (
              <div
                key={item.key}
                className={classNames(
                  "rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-all",
                  isBoardroom
                    ? "border-white/18 bg-white/[0.08] text-white/85"
                    : "border-surface-600/60 bg-surface-900/40 text-surface-100"
                )}
              >
                <div
                  className={classNames(
                    "text-[11px] font-semibold uppercase tracking-[0.28em]",
                    labelToneClass
                  )}
                >
                  {item.label}
                </div>
                <div
                  className={classNames(
                    "mt-2 text-base font-semibold leading-tight",
                    heroTitleClass
                  )}
                >
                  {item.value}
                </div>
                {item.meta ? (
                  <p className={classNames("mt-2 text-xs leading-relaxed", heroSubtitleClass)}>
                    {item.meta}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default SetupPanel;
