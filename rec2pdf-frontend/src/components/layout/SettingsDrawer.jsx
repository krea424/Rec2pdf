import { lazy, Suspense, useMemo } from "react";
import Drawer from "../ui/Drawer";
import { Bug, Cpu, Folder, Mic, Palette, Users } from "../icons";
import { useAppContext } from "../../hooks/useAppContext";
import { classNames } from "../../utils/classNames";
import RecordingSection from "../../features/settings/sections/RecordingSection";
import DiagnosticsSection from "../../features/settings/sections/DiagnosticsSection";
import WorkspaceSection from "../../features/settings/sections/WorkspaceSection";
import BrandingSection from "../../features/settings/sections/BrandingSection";
import AccountSection from "../../features/settings/sections/AccountSection";
import { trackEvent } from "../../utils/analytics";

const AdvancedBackendSection = lazy(
  () => import("../../features/settings/sections/AdvancedBackendSection"),
);

const BASE_NAV = [
  { key: "recording", label: "Registrazione", icon: Mic },
  { key: "diagnostics", label: "Diagnostics", icon: Bug },
  { key: "workspace", label: "Workspace", icon: Folder },
  { key: "branding", label: "Branding", icon: Palette },
  { key: "account", label: "Account", icon: Users },
];

const ADVANCED_ITEM = { key: "advanced", label: "Advanced", icon: Cpu };

const AdvancedSectionFallback = () => (
  <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-400">
    Caricamento modulo avanzato…
  </div>
);

export default function SettingsDrawer({ open, onClose }) {
  const { setShowSetupAssistant, activeSettingsSection, setActiveSettingsSection, hasModeFlag } =
    useAppContext();

  const hasAdvancedAccess = typeof hasModeFlag === "function" && hasModeFlag("MODE_ADVANCED");

  const navigation = useMemo(() => {
    if (hasAdvancedAccess) {
      return [...BASE_NAV.slice(0, 4), ADVANCED_ITEM, BASE_NAV[4]];
    }
    return [...BASE_NAV];
  }, [hasAdvancedAccess]);

  const clearStateOnClose = () => {
    setShowSetupAssistant?.(false);
    setActiveSettingsSection?.(null);
    onClose?.();
  };

  const sectionComponents = {
    recording: <RecordingSection />,
    diagnostics: <DiagnosticsSection />,
    workspace: <WorkspaceSection />,
    branding: <BrandingSection />,
    advanced: hasAdvancedAccess ? (
      <Suspense fallback={<AdvancedSectionFallback />}>
        <AdvancedBackendSection />
      </Suspense>
    ) : null,
    account: <AccountSection />,
  };

  const activeSection = navigation.find((item) => item.key === activeSettingsSection);
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
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = item.key === activeSettingsSection;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setActiveSettingsSection?.(item.key);
                  trackEvent("settings.section_opened", { section: item.key });
                }}
                className={classNames(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
                  active
                    ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-100"
                    : "border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:bg-zinc-900/50",
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
              {sectionComponents[activeSection.key] ?? (
                <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/20 p-6 text-sm text-zinc-400">
                  Modulo non disponibile.
                </div>
              )}
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
