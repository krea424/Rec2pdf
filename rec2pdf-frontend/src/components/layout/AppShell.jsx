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
import { Badge, Button, IconButton, Input } from "../ui";
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
        tone: "success",
        icon: CheckCircle2,
      };
    }
    if (backendUp === false) {
      return {
        label: "Backend OFF",
        tone: "danger",
        icon: AlertCircle,
      };
    }
    return {
      label: "—",
      tone: "info",
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
              <Badge tone={backendStatus.tone} icon={StatusIcon || undefined}>
                {backendStatus.label}
              </Badge>
              <Input
                value={backendUrl}
                onChange={(event) => setBackendUrl(event.target.value)}
                placeholder={DEFAULT_BACKEND_URL}
                prefix={<LinkIcon className="h-4 w-4" />}
                containerClassName="w-[240px]"
                className={cx("bg-transparent", themes[theme].input)}
              />
              <Button
                type="button"
                variant="subtle"
                className={cx("gap-2", themes[theme].input_hover)}
                onClick={runDiagnostics}
                leadingIcon={Bug}
              >
                Diagnostica
              </Button>
              <Button
                type="button"
                variant="primary"
                className="gap-2 shadow-subtle"
                onClick={openSetupAssistant}
                leadingIcon={Sparkles}
              >
                Setup assistant
              </Button>
              <IconButton
                variant="ghost"
                onClick={() => {
                  setActiveSettingsSection("diagnostics");
                  setSettingsOpen(true);
                }}
                aria-label="Apri impostazioni"
              >
                <SettingsIcon className="h-4 w-4" />
              </IconButton>
              <IconButton
                variant="ghost"
                onClick={toggleFullScreen}
                aria-label="Attiva schermo intero"
              >
                <Maximize className="h-4 w-4" />
              </IconButton>
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

