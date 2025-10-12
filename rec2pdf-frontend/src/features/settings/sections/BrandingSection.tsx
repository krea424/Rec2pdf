import { ChangeEvent, useRef } from "react";
import logoAsset from "../../../assets/logo.svg";
import { classNames } from "../../../utils/classNames";
import { useAppContext } from "../../../hooks/useAppContext";
import { trackEvent } from "../../../utils/analytics";

const BrandingSection = () => {
  const {
    theme,
    themes,
    cycleTheme,
    customLogo,
    setCustomLogo,
  } = useAppContext();

  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const handleLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setCustomLogo?.(e.target.result as string);
        trackEvent("settings.branding.logo_upload", { size: file.size, type: file.type });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearLogo = () => {
    setCustomLogo?.(null);
    trackEvent("settings.branding.logo_reset");
  };

  const handleCycleTheme = () => {
    trackEvent("settings.branding.theme_cycle", { current: theme });
    cycleTheme?.();
  };

  return (
    <div className="space-y-5 text-sm text-zinc-200">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-100">Tema interfaccia</div>
            <p className="mt-1 text-xs text-zinc-400">Alterna rapidamente i temi disponibili.</p>
          </div>
          <button
            type="button"
            onClick={handleCycleTheme}
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
              onClick={handleClearLogo}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-500"
            >
              Rimuovi
            </button>
          )}
        </div>
        <div className={classNames("mt-4 flex items-center justify-center rounded-xl border p-4", themes[theme].input)}>
          <img src={customLogo || logoAsset} alt="Anteprima logo" className="max-h-16 w-auto object-contain" />
        </div>
      </div>
    </div>
  );
};

export default BrandingSection;
