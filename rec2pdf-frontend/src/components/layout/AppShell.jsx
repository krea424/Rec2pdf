import { NavLink, Outlet } from "react-router-dom";
import { AlertCircle, LogOut, Maximize, Sparkles } from "../../components/icons";
import logoAsset from "../../assets/logo.svg";
import { classNames } from "../../utils/classNames";
import { useAppContext } from "../../hooks/useAppContext";
import { useMode } from "../../context/ModeContext";
import { Button, IconButton } from "../ui";
import SettingsDrawer from "./SettingsDrawer";
import CommandPalette from "../CommandPalette";

const NAV_ITEMS = [
  { to: "/create", label: "Create" },
  { to: "/library", label: "Library" },
];

const OnboardingBanner = () => {
  const { shouldShowOnboardingBanner, diagnostics, openSetupAssistant } = useAppContext();

  if (!shouldShowOnboardingBanner) {
    return null;
  }

  const hasDiagnosticsError = diagnostics.status === "error";
  const description = hasDiagnosticsError
    ? diagnostics.message ||
      "La diagnostica ha evidenziato problemi. Apri l'assistente per seguire i passaggi di risoluzione."
    : "Completa la procedura guidata per terminare l'onboarding e assicurarti che tutto sia configurato correttamente.";

  return (
    <div className="rounded-3xl border border-feedback-warning/30 bg-feedback-warning/10 p-4 shadow-subtle">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 text-sm text-feedback-warning">
          <AlertCircle className="mt-1 h-5 w-5" />
          <div>
            <div className="font-semibold text-feedback-warning">
              {hasDiagnosticsError ? "La diagnostica richiede attenzione" : "Completa l'onboarding"}
            </div>
            <p className="mt-1 text-feedback-warning/80">{description}</p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="border border-feedback-warning/50 bg-feedback-warning/10 text-feedback-warning hover:bg-feedback-warning/20"
          onClick={openSetupAssistant}
          leadingIcon={Sparkles}
        >
          Apri assistente
        </Button>
      </div>
    </div>
  );
};

const MODE_OPTIONS = [
  { value: "base", label: "Base", shortcut: "B" },
  { value: "advanced", label: "Advanced", shortcut: "A" },
];

const ModeSegmentedControl = () => {
  const { mode, setMode, availableModes, isModeSelectionVisible, isModePersisting } = useMode();

  const options = MODE_OPTIONS.filter((option) => availableModes.includes(option.value));

  if (!isModeSelectionVisible || options.length < 2) {
    return null;
  }

  const cx = classNames;

  return (
    <div
      role="group"
      aria-label="Seleziona la modalità applicazione"
      className="flex items-center gap-1 rounded-full border border-zinc-700/60 bg-zinc-900/70 p-1 text-xs font-semibold uppercase tracking-wide shadow-subtle"
      data-current-mode={mode}
    >
      <span className="sr-only" aria-live="polite">
        {isModePersisting ? "Salvataggio preferenza modalità in corso" : `Modalità ${mode}`}
      </span>
      {options.map((option) => {
        const isActive = mode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={cx(
              "flex items-center gap-1 rounded-full px-3 py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
              isActive
                ? "bg-indigo-500 text-white shadow-sm"
                : "text-zinc-300 hover:bg-zinc-800/70",
            )}
            aria-pressed={isActive}
            aria-label={`Modalità ${option.label}`}
            title={`Modalità ${option.label} (scorciatoia ${option.shortcut})`}
            onClick={() => setMode(option.value)}
            disabled={isModePersisting}
          >
            <span>{option.label}</span>
            <span className="hidden text-[10px] font-medium text-zinc-300 sm:inline" aria-hidden="true">
              {option.shortcut}
            </span>
          </button>
        );
      })}
    </div>
  );
};

const AppShell = () => {
  const {
    customLogo,
    settingsOpen,
    setSettingsOpen,
    openSettingsDrawer,
    toggleFullScreen,
    handleLogout,
    theme,
    themes,
  } = useAppContext();

  const cx = classNames;

  return (
    <div
      className={cx(
        "min-h-screen w-full",
        "bg-gradient-to-b",
        themes[theme].bg,
        "text-zinc-100",
      )}
    >
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="flex flex-col gap-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center">
              <img
                src={customLogo || logoAsset}
                alt="ThinkDoc Logo"
                className="h-14 w-auto object-contain md:h-16 lg:h-20"
              />
            </div>
            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
              <ModeSegmentedControl />
              <Button
                type="button"
                variant="ghost"
                className="gap-2 px-3 text-sm font-medium text-surface-200 hover:text-white"
                onClick={() => {
                  openSettingsDrawer();
                }}
                leadingIcon={Sparkles}
              >
                Impostazioni
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="gap-2 px-3 text-sm font-medium text-surface-200 hover:text-white"
                onClick={handleLogout}
                leadingIcon={LogOut}
              >
                Logout
              </Button>
              <IconButton
                variant="ghost"
                onClick={toggleFullScreen}
                aria-label="Attiva schermo intero"
              >
                <Maximize className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cx(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    isActive
                      ? "bg-indigo-500/20 text-indigo-100 border border-indigo-400/60"
                      : cx("border", themes[theme].button),
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <div className="mt-6 space-y-6">
          <OnboardingBanner />

          <main>
            <Outlet />
          </main>
        </div>
      </div>

      <CommandPalette />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

export default AppShell;

