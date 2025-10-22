import { ChangeEvent, useCallback } from "react";
import { CheckCircle2, LinkIcon, Sparkles } from "../../../components/icons";
import { useAppContext } from "../../../hooks/useAppContext";
import { classNames } from "../../../utils/classNames";
import { trackEvent } from "../../../utils/analytics";
import { Select } from "../../../components/ui/Select";

const AdvancedBackendSection = () => {
  const {
    backendUrl,
    setBackendUrl,
    DEFAULT_BACKEND_URL,
    normalizedBackendUrl,
    theme,
    themes,
    aiProviderCatalog,
    aiProviderSelection,
    setAiProviderSelection,
    resetAiProviderSelection,
    aiProvidersEffective,
    refreshAiProviderCatalog,
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

  const providers = Array.isArray(aiProviderCatalog?.providers) ? aiProviderCatalog.providers : [];
  const providerDefaults = aiProviderCatalog?.defaults ?? { text: "", embedding: "" };
  const providersLoading = Boolean(aiProviderCatalog?.loading);
  const providersError = aiProviderCatalog?.error ? String(aiProviderCatalog.error) : "";
  const textOptions = providers.filter((provider) => Array.isArray(provider.capabilities) && provider.capabilities.includes("text"));
  const embeddingOptions = providers.filter(
    (provider) => Array.isArray(provider.capabilities) && provider.capabilities.includes("embedding"),
  );
  const selection = aiProviderSelection || { text: "", embedding: "" };
  const effectiveTextProvider = aiProvidersEffective?.text || "";
  const effectiveEmbeddingProvider = aiProvidersEffective?.embedding || "";

  const getProviderLabel = useCallback(
    (id: string) => {
      if (!id) return "—";
      const provider = providers.find((candidate) => candidate?.id === id);
      return provider?.label || id;
    },
    [providers],
  );

  const textDefaultLabel = getProviderLabel(providerDefaults.text || "");
  const embeddingDefaultLabel = getProviderLabel(providerDefaults.embedding || "");
  const textEffectiveLabel = getProviderLabel(effectiveTextProvider);
  const embeddingEffectiveLabel = getProviderLabel(effectiveEmbeddingProvider);
  const hasCustomAiSelection = Boolean(selection.text || selection.embedding);

  const handleTextProviderChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      setAiProviderSelection?.((prev: { text?: string; embedding?: string } | null) => ({ ...(prev || {}), text: value }));
      trackEvent("settings.advanced.ai_provider_change", { target: "text", value: value || "default" });
    },
    [setAiProviderSelection],
  );

  const handleEmbeddingProviderChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      setAiProviderSelection?.((prev: { text?: string; embedding?: string } | null) => ({ ...(prev || {}), embedding: value }));
      trackEvent("settings.advanced.ai_provider_change", { target: "embedding", value: value || "default" });
    },
    [setAiProviderSelection],
  );

  const handleResetAiProviders = useCallback(() => {
    resetAiProviderSelection?.();
    trackEvent("settings.advanced.ai_provider_reset");
  }, [resetAiProviderSelection]);

  const handleRefreshAiProviders = useCallback(() => {
    refreshAiProviderCatalog?.({ silent: false });
    trackEvent("settings.advanced.ai_provider_refresh");
  }, [refreshAiProviderCatalog]);

  return (
    <div className="space-y-4 text-sm text-zinc-200">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <Sparkles className="h-4 w-4" /> Motore AI
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <button
                type="button"
                onClick={handleRefreshAiProviders}
                className="rounded border border-zinc-700 px-2 py-0.5 font-medium text-zinc-300 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={providersLoading}
              >
                {providersLoading ? "Aggiornamento..." : "Aggiorna"}
              </button>
              <button
                type="button"
                onClick={handleResetAiProviders}
                className="rounded border border-zinc-700 px-2 py-0.5 font-medium text-zinc-300 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!hasCustomAiSelection}
              >
                Usa default
              </button>
            </div>
          </div>
          {providersError ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-100">
              {providersError}
            </div>
          ) : null}
          {providersLoading ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-300">
              Caricamento stato provider...
            </div>
          ) : !providers.length ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-400">
              Configura le chiavi API nel backend per abilitare i provider AI.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                label="Generatore Markdown"
                value={selection.text || ""}
                onChange={handleTextProviderChange}
                helperText={`Predefinito backend: ${textDefaultLabel}. In uso: ${textEffectiveLabel}.`}
                disabled={providersLoading || !textOptions.length}
                className={themes[theme].input}
              >
                <option value="">Usa default backend</option>
                {textOptions.map((provider) => (
                  <option key={provider.id} value={provider.id} disabled={!provider.configured}>
                    {provider.label}
                    {!provider.configured ? " (API key mancante)" : ""}
                  </option>
                ))}
              </Select>
              <Select
                label="Embedding Knowledge Base"
                value={selection.embedding || ""}
                onChange={handleEmbeddingProviderChange}
                helperText={`Predefinito backend: ${embeddingDefaultLabel}. In uso: ${embeddingEffectiveLabel}.`}
                disabled={providersLoading || !embeddingOptions.length}
                className={themes[theme].input}
              >
                <option value="">Usa default backend</option>
                {embeddingOptions.map((provider) => (
                  <option key={provider.id} value={provider.id} disabled={!provider.configured}>
                    {provider.label}
                    {!provider.configured ? " (API key mancante)" : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </div>

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
