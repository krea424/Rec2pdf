import { NavLink, Outlet } from "react-router-dom";
import { AlertCircle, LogOut, Maximize, Settings, Sparkles } from "../../components/icons";
import logoAsset from "../../assets/thinkDOC3.svg";
import { classNames } from "../../utils/classNames";
import { useAppContext } from "../../hooks/useAppContext";
import { Button, IconButton } from "../ui";
import SettingsDrawer from "./SettingsDrawer";
import CommandPalette from "../CommandPalette";

// === 1. NUOVA NOMENCLATURA ===
const NAV_ITEMS = [
  { to: "/create", label: "Home" },      // Era Create
  { to: "/library", label: "Archivio" },  // Era Library
  { to: "/advanced", label: "Configura" }, // Era Advanced A
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

  // Fallback di sicurezza: se il tema corrente non esiste, usa 'boardroom'
  const currentTheme = themes[theme] ? themes[theme] : themes['boardroom'];

  return (
    <div
      className={cx(
        "min-h-screen w-full transition-colors duration-700 ease-in-out",
        // Usiamo bg-gradient-to-br (Bottom Right) per matchare lo stile della Login
        "bg-gradient-to-br", 
        currentTheme.bg,
        "text-zinc-100",
      )}
    >
      {/* ... resto del contenuto (Header, Main, etc.) invariato ... */}
      <div className="mx-auto max-w-[1920px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-6">
            {/* ... codice header esistente ... */}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            
            {/* LOGO */}
            <div className="flex items-center gap-3">
              <img
                src={customLogo || logoAsset}
                alt="ThinkDoc Logo"
                className="h-10 w-auto object-contain"
              />
              <div className="hidden sm:block h-6 w-px bg-white/10 mx-2" />
              <span className="hidden sm:block text-sm font-medium text-zinc-400 tracking-wide">
                Intelligence Platform
              </span>
            </div>

            {/* NAVIGAZIONE & AZIONI */}
            <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
              
              {/* MENU CENTRALE */}
              <nav
                aria-label="Sezioni applicazione"
                className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 shadow-subtle backdrop-blur"
              >
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cx(
                        "rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all duration-200",
                        isActive
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20"
                          : "text-zinc-400 hover:bg-white/5 hover:text-white",
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />

              {/* PULSANTE IMPOSTAZIONI */}
              <Button
                type="button"
                variant="ghost"
                className="gap-2 px-3 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5"
                onClick={() => openSettingsDrawer?.()}
                leadingIcon={Settings}
              >
                Impostazioni
              </Button>

              {/* LOGOUT */}
              <Button
                type="button"
                variant="ghost"
                className="gap-2 px-3 text-xs font-medium text-zinc-400 hover:text-rose-400 hover:bg-white/5"
                onClick={handleLogout}
                leadingIcon={LogOut}
              >
                Esci
              </Button>

              {/* FULLSCREEN */}
              <IconButton
                variant="ghost"
                onClick={toggleFullScreen}
                aria-label="Attiva schermo intero"
                className="text-zinc-400 hover:text-white"
              >
                <Maximize className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        </header>

        <div className="mt-8 space-y-6">
          <OnboardingBanner />

          <main className="animate-in fade-in duration-500">
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
