import { NavLink, Outlet } from "react-router-dom";
import {
  AlertCircle,
  Bug,
  CheckCircle2,
  LinkIcon,
  Maximize,
  Settings as SettingsIcon,
  Sparkles,
} from "../../components/icons";
import logoAsset from "../../assets/logo.svg";
import { classNames } from "../../utils/classNames";
import { useAppContext } from "../../hooks/useAppContext";
import SettingsDrawer from "./SettingsDrawer";

const NAV_ITEMS = [
  { to: "/create", label: "Create" },
  { to: "/library", label: "Library" },
  { to: "/editor", label: "Editor" },
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
    <div className="rounded-2xl border border-amber-900/50 bg-amber-950/40 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 text-sm text-amber-100">
          <AlertCircle className="mt-1 h-5 w-5 text-amber-300" />
          <div>
            <div className="font-semibold text-amber-200">
              {hasDiagnosticsError ? "La diagnostica richiede attenzione" : "Completa l'onboarding"}
            </div>
            <p className="mt-1 text-amber-100/80">{description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openSetupAssistant}
          className="inline-flex items-center justify-center rounded-lg border border-amber-500/40 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/10"
        >
          <Sparkles className="mr-2 h-4 w-4" /> Apri assistente
        </button>
      </div>
    </div>
  );
};

const AppShell = () => {
  const {
    customLogo,
    backendUp,
    backendUrl,
    setBackendUrl,
    runDiagnostics,
    openSetupAssistant,
    settingsOpen,
    setSettingsOpen,
    setActiveSettingsSection,
    toggleFullScreen,
    session,
    handleLogout,
    theme,
    themes,
    DEFAULT_BACKEND_URL,
  } = useAppContext();

  const cx = classNames;

  const backendStatus = (() => {
    if (backendUp === true) {
      return {
        label: "Backend OK",
        tone: "bg-emerald-950 text-emerald-300",
        icon: CheckCircle2,
      };
    }
    if (backendUp === false) {
      return {
        label: "Backend OFF",
        tone: "bg-rose-950 text-rose-300",
        icon: AlertCircle,
      };
    }
    return {
      label: "—",
      tone: "bg-zinc-800 text-zinc-300",
      icon: null,
    };
  })();

  const StatusIcon = backendStatus.icon;

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
                className="h-20 w-auto object-contain md:h-28 lg:h-32"
              />
            </div>
            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
              <span
                className={cx(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm",
                  backendStatus.tone,
                )}
              >
                {StatusIcon ? <StatusIcon className="h-4 w-4" /> : null}
                {backendStatus.label}
              </span>
              <div
                className={cx(
                  "flex items-center gap-2 rounded-xl border px-3 py-2",
                  themes[theme].input,
                )}
              >
                <LinkIcon className="h-4 w-4 text-zinc-400" />
                <input
                  value={backendUrl}
                  onChange={(event) => setBackendUrl(event.target.value)}
                  placeholder={DEFAULT_BACKEND_URL}
                  className="w-[220px] bg-transparent text-sm outline-none"
                />
              </div>
              <button
                type="button"
                onClick={runDiagnostics}
                className={cx(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                  themes[theme].input,
                  themes[theme].input_hover,
                )}
              >
                <Bug className="h-4 w-4" />
                Diagnostica
              </button>
              <button
                type="button"
                onClick={openSetupAssistant}
                className={cx(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm shadow-sm",
                  themes[theme].button,
                )}
              >
                <Sparkles className="h-4 w-4" />
                Setup assistant
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveSettingsSection("diagnostics");
                  setSettingsOpen(true);
                }}
                className={cx(
                  "rounded-xl border p-2 text-sm",
                  themes[theme].input,
                  themes[theme].input_hover,
                )}
                aria-label="Apri impostazioni"
              >
                <SettingsIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={toggleFullScreen}
                className={cx(
                  "rounded-xl border p-2 text-sm",
                  themes[theme].input,
                  themes[theme].input_hover,
                )}
                aria-label="Attiva schermo intero"
              >
                <Maximize className="h-4 w-4" />
              </button>
              {session?.user?.email && (
                <span className="hidden text-sm text-zinc-300 md:inline">
                  {session.user.email}
                </span>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className={cx(
                  "rounded-xl border px-3 py-2 text-sm",
                  themes[theme].input,
                  themes[theme].input_hover,
                )}
              >
                Logout
              </button>
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

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

export default AppShell;

