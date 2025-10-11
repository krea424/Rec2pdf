import { useMemo, useRef } from "react";
import Drawer from "../ui/Drawer";
import SetupAssistant from "../SetupAssistant";
import {
  AlertCircle,
  Bug,
  CheckCircle2,
  Cpu,
  Folder,
  Info,
  LinkIcon,
  Mic,
  Palette,
  RefreshCw,
  Sparkles,
  TimerIcon,
  Users,
} from "../icons";
import { useAppContext } from "../../hooks/useAppContext";
import { classNames } from "../../utils/classNames";
import logoAsset from "../../assets/logo.svg";
import { Button, Select } from "../ui";
import PermissionBanner from "../PermissionBanner";
import WorkspaceProfilesManager from "../workspaces/WorkspaceProfilesManager";

const sectionNav = [
  { key: "recording", label: "Registrazione", icon: Mic },
  { key: "diagnostics", label: "Diagnostics", icon: Bug },
  { key: "workspace", label: "Workspace", icon: Folder },
  { key: "branding", label: "Branding", icon: Palette },
  { key: "advanced", label: "Advanced", icon: Cpu },
  { key: "account", label: "Account", icon: Users },
];

const statusTone = {
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  error: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  running: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  idle: "border-zinc-700/60 bg-zinc-900/40 text-zinc-200",
};

const backendTone = {
  true: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  false: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  null: "border-zinc-700/60 bg-zinc-900/40 text-zinc-200",
};

export default function SettingsDrawer({ open, onClose }) {
  const {
    theme,
    themes,
    cycleTheme,
    customLogo,
    customPdfLogo,
    setCustomLogo,
    setCustomPdfLogo,
    backendUp,
    backendUrl,
    setBackendUrl,
    runDiagnostics,
    diagnostics,
    session,
    handleLogout,
    DEFAULT_BACKEND_URL,
    showSetupAssistant,
    setShowSetupAssistant,
    onboardingSteps,
    onboardingStep,
    setOnboardingStep,
    handleOnboardingFinish,
    activeSettingsSection,
    setActiveSettingsSection,
    onboardingComplete,
    normalizedBackendUrl,
    requestPermission,
    permission,
    refreshDevices,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    mediaSupported,
    recorderSupported,
    level,
    secondsCap,
    setSecondsCap,
  } = useAppContext();

  const logoInputRef = useRef(null);

  const diagnosticsStatus = diagnostics?.status || "idle";
  const diagnosticsMessage = diagnosticsStatus === "error"
    ? diagnostics?.message || "La diagnostica ha rilevato problemi nella toolchain."
    : diagnosticsStatus === "success"
    ? "Ultima diagnostica completata con successo."
    : diagnosticsStatus === "running"
    ? "Diagnostica in corso…"
    : "Esegui la diagnostica del backend per verificare la toolchain.";

  const backendStateLabel = backendUp === true
    ? "Backend online"
    : backendUp === false
    ? "Backend offline"
    : "Stato sconosciuto";

  const backendStateTone = backendTone[String(backendUp)] || backendTone.null;

  const statusCardTone = statusTone[diagnosticsStatus] || statusTone.idle;

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

  const clearStateOnClose = () => {
    setShowSetupAssistant(false);
    setActiveSettingsSection(null);
    onClose?.();
  };

  const sections = useMemo(() => {
    return {
      recording: (
        <div className="space-y-6 text-sm text-zinc-200">
          <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <Mic className="h-4 w-4" /> Controlli registrazione
              </div>
              <div className="text-xs text-zinc-400">
                Permesso: <span className="font-mono">{permission}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className={themes[theme].button}
                onClick={requestPermission}
              >
                Concedi microfono
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className={classNames("gap-2", themes[theme].button)}
                onClick={refreshDevices}
                leadingIcon={RefreshCw}
              >
                Dispositivi
              </Button>
            </div>
            {(!mediaSupported || !recorderSupported) && (
              <div className="text-xs text-rose-300">
                {!mediaSupported
                  ? "getUserMedia non supportato dal browser."
                  : "MediaRecorder non supportato dal browser."}
              </div>
            )}
            {permission === "granted" && devices.length > 0 && (
              <Select
                label="Sorgente microfono"
                value={selectedDeviceId}
                onChange={(event) => setSelectedDeviceId(event.target.value)}
                containerClassName="mt-4"
                className={themes[theme].input}
              >
                {devices.map((device, index) => (
                  <option key={device.deviceId || index} value={device.deviceId}>
                    {device.label || `Dispositivo ${index + 1}`}
                  </option>
                ))}
              </Select>
            )}
            {permission !== "granted" && (
              <div className="mt-4">
                <PermissionBanner />
              </div>
            )}
            <div className="mt-6">
              <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-900">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300"
                  style={{ width: `${Math.min(100, Math.round(level * 120))}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-zinc-500">Livello input</div>
            </div>
          </div>

          <div className={classNames("rounded-xl border p-4", themes[theme].input)}>
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <TimerIcon className="h-4 w-4" /> Durata massima (s)
            </label>
            <input
              type="number"
              min={0}
              className="mt-2 w-full rounded-lg border-zinc-800 bg-transparent px-3 py-2 outline-none"
              value={secondsCap}
              onChange={(event) =>
                setSecondsCap(Math.max(0, parseInt(event.target.value || "0", 10) || 0))
              }
            />
            <div className="mt-2 text-xs text-zinc-500">0 = senza limite</div>
          </div>


        </div>
      ),
      diagnostics: (
        <div className="space-y-4">
          <div className={classNames("rounded-2xl border p-4 text-sm", backendStateTone)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{backendStateLabel}</div>
                <p className="mt-1 text-xs leading-relaxed text-inherit">
                  Configura l'endpoint backend e verifica che l'API sia raggiungibile prima di avviare le pipeline.
                </p>
              </div>
              <button
                type="button"
                onClick={runDiagnostics}
                className="rounded-lg border border-current px-3 py-1.5 text-xs font-medium hover:bg-white/5"
              >
                Esegui diagnostica
              </button>
            </div>
          </div>

          <div className={classNames("rounded-2xl border p-4 text-sm", statusCardTone)}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bug className="h-4 w-4" /> Stato diagnostica
            </div>
            <p className="mt-2 text-xs leading-relaxed text-inherit">{diagnosticsMessage}</p>
            {diagnostics.logs?.length ? (
              <div className="mt-3 space-y-1 rounded-lg border border-current/40 bg-black/10 p-3 font-mono text-[11px] leading-relaxed">
                {diagnostics.logs.slice(-4).map((log, index) => (
                  <div key={index} className="truncate" title={log}>
                    {log}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                  <Sparkles className="h-4 w-4 text-indigo-300" /> Assistente di configurazione
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  Completa i passaggi guidati per terminare l'onboarding ({onboardingComplete ? "completato" : "in corso"}).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSetupAssistant((prev) => !prev)}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-900"
              >
                {showSetupAssistant ? "Nascondi" : "Apri"}
              </button>
            </div>
            {showSetupAssistant && (
              <div className="mt-4">
                <SetupAssistant
                  embedded
                  onClose={() => setShowSetupAssistant(false)}
                  steps={onboardingSteps}
                  currentStep={onboardingStep}
                  onStepChange={setOnboardingStep}
                  onFinish={handleOnboardingFinish}
                />
              </div>
            )}
          </div>
        </div>
      ),
      workspace: <WorkspaceProfilesManager />,
      branding: (
        <div className="space-y-5 text-sm text-zinc-200">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-100">Tema interfaccia</div>
                <p className="mt-1 text-xs text-zinc-400">Alterna rapidamente i temi disponibili.</p>
              </div>
              <button
                type="button"
                onClick={cycleTheme}
                className={classNames("rounded-lg px-3 py-1.5 text-xs font-medium", themes[theme].button)}
              >
                Cambia tema ({theme})
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="text-sm font-semibold text-zinc-100">Logo frontend</div>
            <p className="mt-1 text-xs text-zinc-400">Carica un logo personalizzato per il branding dell'interfaccia.</p>
            <div className="mt-3 flex items-center gap-2">
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
                className={classNames("rounded-lg px-3 py-1.5 text-xs font-medium", themes[theme].button)}
              >
                Carica
              </button>
              {customLogo && (
                <button
                  type="button"
                  onClick={() => setCustomLogo(null)}
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-500"
                >
                  Rimuovi
                </button>
              )}
            </div>
            <div className={classNames("mt-4 flex items-center justify-center rounded-xl border p-4", themes[theme].input)}>
              <img
                src={customLogo || logoAsset}
                alt="Anteprima logo"
                className="max-h-16 w-auto object-contain"
              />
            </div>
          </div>

        </div>
      ),
      advanced: (
        <div className="space-y-4 text-sm text-zinc-200">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <LinkIcon className="h-4 w-4" /> URL backend
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Definisci l'endpoint del servizio backend usato per l'elaborazione e il download dei file.
            </p>
            <input
              value={backendUrl}
              onChange={(event) => setBackendUrl(event.target.value)}
              placeholder={DEFAULT_BACKEND_URL}
              className={classNames(
                "mt-3 w-full rounded-lg border px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500",
                themes[theme].input
              )}
            />
            <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 font-mono">{normalizedBackendUrl || "—"}</span>
              <button
                type="button"
                onClick={() => setBackendUrl(DEFAULT_BACKEND_URL)}
                className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] font-medium text-zinc-300 hover:bg-zinc-900"
              >
                Usa default
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <CheckCircle2 className="h-4 w-4" /> Suggerimenti
            </div>
            <ul className="mt-2 space-y-1 text-xs text-zinc-400">
              <li>Verifica che ffmpeg sia installato e presente nel PATH del backend.</li>
              <li>Assicurati che il token Supabase sia valido per eseguire chiamate autenticate.</li>
              <li>Esegui la diagnostica dopo ogni aggiornamento della toolchain.</li>
            </ul>
          </div>
        </div>
      ),
      account: (
        <div className="space-y-4 text-sm text-zinc-200">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <Users className="h-4 w-4" /> Account
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              Accesso effettuato come <span className="font-medium text-zinc-100">{session?.user?.email || "utente"}</span>.
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-900"
            >
              Logout
            </button>
          </div>

          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-100">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
              <AlertCircle className="h-4 w-4" /> Suggerimento sicurezza
            </div>
            <p className="mt-1 leading-relaxed">
              Ricorda di uscire dall'account quando condividi il dispositivo o concludi una sessione di lavoro.
            </p>
          </div>
        </div>
      ),
    };
  }, [
    backendStateLabel,
    backendStateTone,
    diagnosticsMessage,
    statusCardTone,
    diagnostics?.logs,
    runDiagnostics,
    showSetupAssistant,
    onboardingComplete,
    onboardingSteps,
    onboardingStep,
    setOnboardingStep,
    handleOnboardingFinish,
    setShowSetupAssistant,
    theme,
    themes,
    cycleTheme,
    customLogo,
    customPdfLogo,
    backendUrl,
    setBackendUrl,
    DEFAULT_BACKEND_URL,
    session?.user?.email,
    handleLogout,
    normalizedBackendUrl,
    permission,
    requestPermission,
    refreshDevices,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    mediaSupported,
    recorderSupported,
    level,
    secondsCap,
    setSecondsCap,
  ]);

  const activeSection = sectionNav.find((item) => item.key === activeSettingsSection);
  const ActiveIcon = activeSection?.icon ?? Bug;

  return (
    <Drawer
      open={open}
      onClose={clearStateOnClose}
      title="Impostazioni"
      description="Configura Rec2pdf e monitora lo stato del backend."
      className="max-w-3xl"
    >
      <div>
        <nav className="grid grid-cols-2 gap-2 text-sm">
          {sectionNav.map((item) => {
            const Icon = item.icon;
            const active = item.key === activeSettingsSection;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveSettingsSection(item.key)}
                className={classNames(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
                  active
                    ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-100"
                    : "border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:bg-zinc-900/50"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-5">
          {activeSection ? (
            <>
              <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                <ActiveIcon className="h-3.5 w-3.5" />
                {activeSection.label}
              </div>
              {sections[activeSettingsSection]}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/20 p-6 text-center text-sm text-zinc-400">
              Seleziona una categoria per visualizzare le impostazioni disponibili.
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

