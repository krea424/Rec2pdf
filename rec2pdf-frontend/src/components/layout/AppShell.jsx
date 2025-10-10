import { useRef } from "react";
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
import SetupAssistant from "../SetupAssistant";
import { classNames } from "../../utils/classNames";
import { useAppContext } from "../../hooks/useAppContext";

const NAV_ITEMS = [
  { to: "/create", label: "Create" },
  { to: "/library", label: "Library" },
  { to: "/editor", label: "Editor" },
];

const SettingsPanel = () => {
  const {
    theme,
    themes,
    cycleTheme,
    customLogo,
    setCustomLogo,
    customPdfLogo,
    setCustomPdfLogo,
  } = useAppContext();

  const logoInputRef = useRef(null);
  const pdfLogoInputRef = useRef(null);

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setCustomLogo(e.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePdfLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setCustomPdfLogo(file);
    }
  };

  return (
    <div className={classNames("p-4 mt-4 rounded-2xl border", themes[theme].card)}>
      <h3 className="text-lg font-medium">Impostazioni</h3>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="text-sm text-zinc-400">Tema</label>
          <button
            type="button"
            onClick={cycleTheme}
            className={classNames(
              "w-full mt-2 px-3 py-2 rounded-xl text-sm border",
              themes[theme].input,
              themes[theme].input_hover,
            )}
          >
            Cycle Theme ({theme})
          </button>
        </div>
        <div>
          <label className="text-sm text-zinc-400">Logo Frontend</label>
          <div className="mt-2 flex items-center gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className={classNames("px-3 py-2 rounded-xl text-sm", themes[theme].button)}
            >
              Carica
            </button>
            {customLogo && (
              <button
                type="button"
                onClick={() => setCustomLogo(null)}
                className="px-3 py-2 rounded-xl text-sm bg-rose-600 hover:bg-rose-500"
              >
                Rimuovi
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="text-sm text-zinc-400">Logo per PDF</label>
          <div className="mt-2 flex items-center gap-2">
            <input
              ref={pdfLogoInputRef}
              type="file"
              accept=".pdf,.svg,.png,.jpg"
              onChange={handlePdfLogoUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => pdfLogoInputRef.current?.click()}
              className={classNames("px-3 py-2 rounded-xl text-sm", themes[theme].button)}
            >
              Carica
            </button>
            {customPdfLogo && (
              <button
                type="button"
                onClick={() => setCustomPdfLogo(null)}
                className="px-3 py-2 rounded-xl text-sm bg-rose-600 hover:bg-rose-500"
              >
                Rimuovi
              </button>
            )}
          </div>
          {customPdfLogo && (
            <div className="mt-1 truncate text-xs text-zinc-400">{customPdfLogo.name}</div>
          )}
        </div>
      </div>
      <div className="mt-4">
        <label className="text-sm text-zinc-400">Anteprima Logo Frontend</label>
        <div className={classNames("mt-2 flex items-center justify-center rounded-xl p-4", themes[theme].input)}>
          <img
            src={customLogo || logoAsset}
            alt="Logo Preview"
            className="max-h-24 w-auto object-contain md:max-h-32 lg:max-h-40"
          />
        </div>
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
    showSettings,
    setShowSettings,
    toggleFullScreen,
    session,
    handleLogout,
    theme,
    themes,
    DEFAULT_BACKEND_URL,
    showOnboarding,
    setShowOnboarding,
    onboardingSteps,
    onboardingStep,
    setOnboardingStep,
    handleOnboardingFinish,
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
                onClick={() => setShowSettings((prev) => !prev)}
                className={cx(
                  "rounded-xl border p-2 text-sm",
                  themes[theme].input,
                  themes[theme].input_hover,
                )}
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

        {showSettings && <SettingsPanel />}

        <main className="mt-6">
          <Outlet />
        </main>
      </div>

      <SetupAssistant
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        steps={onboardingSteps}
        currentStep={onboardingStep}
        onStepChange={setOnboardingStep}
        onFinish={handleOnboardingFinish}
      />
    </div>
  );
};

export default AppShell;
