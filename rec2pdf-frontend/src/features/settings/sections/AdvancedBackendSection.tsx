import { ChangeEvent, useCallback } from "react";
import { CheckCircle2, LinkIcon } from "../../../components/icons";
import { useAppContext } from "../../../hooks/useAppContext";
import { classNames } from "../../../utils/classNames";
import { trackEvent } from "../../../utils/analytics";

const AdvancedBackendSection = () => {
  const {
    backendUrl,
    setBackendUrl,
    DEFAULT_BACKEND_URL,
    normalizedBackendUrl,
    theme,
    themes,
  } = useAppContext();

  const handleBackendChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setBackendUrl?.(value);
      const isCustom = value.trim() && value !== DEFAULT_BACKEND_URL;
      trackEvent("settings.advanced.backend_url_change", { custom: isCustom });
    },
    [DEFAULT_BACKEND_URL, setBackendUrl],
  );

  const handleReset = useCallback(() => {
    setBackendUrl?.(DEFAULT_BACKEND_URL);
    trackEvent("settings.advanced.backend_url_reset");
  }, [DEFAULT_BACKEND_URL, setBackendUrl]);

  return (
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
          onChange={handleBackendChange}
          placeholder={DEFAULT_BACKEND_URL}
          className={classNames(
            "mt-3 w-full rounded-lg border px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500",
            themes[theme].input,
          )}
        />
        <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 font-mono">{normalizedBackendUrl || "—"}</span>
          <button
            type="button"
            onClick={handleReset}
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
  );
};

export default AdvancedBackendSection;
