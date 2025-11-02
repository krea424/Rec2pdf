import { useAppContext } from "../hooks/useAppContext";
import BaseHome from "../features/base/BaseHome";

const CreatePage = () => {
  const context = useAppContext();

  const hasFeatureFlag =
    typeof context.hasFeatureFlag === "function"
      ? context.hasFeatureFlag
      : typeof context.hasModeFlag === "function"
        ? context.hasModeFlag
        : null;

  const hasAdvancedAccess = typeof hasFeatureFlag === "function" ? hasFeatureFlag("MODE_ADVANCED") : false;
  const hasAdvancedV2 = typeof hasFeatureFlag === "function" ? hasFeatureFlag("MODE_ADVANCED_V2") : false;

  return (
    <div className="space-y-6">
      {!hasAdvancedAccess && (
        <div className="mx-auto max-w-5xl rounded-3xl border border-amber-500/40 bg-amber-500/10 p-6 text-sm text-amber-100/80">
          <h2 className="text-lg font-semibold text-amber-100">Modalità avanzata non disponibile</h2>
          <p className="mt-2">
            Il tuo account non ha ancora accesso alla control room avanzata. Contatta l'amministratore per abilitare il flag
            <code className="mx-1 rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-xs">MODE_ADVANCED</code> e usa il pulsante
            <span className="mx-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-100">Advanced A</span> quando sarà disponibile.
          </p>
        </div>
      )}

      {hasAdvancedAccess && !hasAdvancedV2 && (
        <div className="mx-auto max-w-5xl rounded-3xl border border-sky-500/40 bg-sky-500/10 p-6 text-sm text-sky-100/85">
          <h2 className="text-lg font-semibold text-sky-100">Nuova control room in rollout</h2>
          <p className="mt-2">
            Per provare la nuova esperienza avanzata aggiungi
            <code className="mx-1 rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-xs">MODE_ADVANCED_V2</code>
            alle feature flag del profilo insieme a
            <code className="mx-1 rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-xs">MODE_ADVANCED</code>. In locale puoi usare
            <code className="mx-1 font-mono text-xs">VITE_DEFAULT_MODE_FLAGS=MODE_BASE,MODE_ADVANCED,MODE_ADVANCED_V2</code>.
          </p>
        </div>
      )}

      <BaseHome />
    </div>
  );
};

export default CreatePage;
