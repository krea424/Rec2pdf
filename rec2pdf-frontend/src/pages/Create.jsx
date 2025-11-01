import { useAppContext } from "../hooks/useAppContext";
import BaseHome from "../features/base/BaseHome";
import AdvancedControlRoom from "../features/advanced/AdvancedControlRoom";

const CreatePage = () => {
  const context = useAppContext();
  const hasAdvancedAccess =
    typeof context.hasModeFlag === "function" ? context.hasModeFlag("MODE_ADVANCED") : false;
  const hasAdvancedV2 =
    typeof context.hasModeFlag === "function" ? context.hasModeFlag("MODE_ADVANCED_V2") : false;

  if (context.mode === "base") {
    return <BaseHome />;
  }

  if (!hasAdvancedAccess) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6 text-sm text-zinc-300">
        <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-6">
          <h2 className="text-lg font-semibold text-amber-100">Modalità avanzata non disponibile</h2>
          <p className="mt-2 text-amber-100/80">
            Il tuo account non ha ancora accesso alle funzionalità avanzate. Contatta l'amministratore per abilitare il flag
            <code className="mx-1 rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-xs">MODE_ADVANCED</code> oppure torna
            alla modalità base.
          </p>
        </div>
        <BaseHome />
      </div>
    );
  }

  if (!hasAdvancedV2) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6 text-sm text-zinc-300">
        <div className="rounded-3xl border border-sky-500/40 bg-sky-500/10 p-6">
          <h2 className="text-lg font-semibold text-sky-100">Nuova control room in rollout</h2>
          <p className="mt-2 text-sky-100/85">
            Stai usando la vista avanzata classica. Per provare la nuova control room apri Supabase → Authentication → Users,
            modifica il tuo profilo e aggiungi <code className="mx-1 rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-xs">MODE_ADVANCED_V2</code>
            all'attributo <code className="mx-1 font-mono text-xs">modeFlags</code> insieme a <code className="mx-1 rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-xs">MODE_ADVANCED</code>.
            In locale puoi settare <code className="mx-1 font-mono text-xs">VITE_DEFAULT_MODE_FLAGS=MODE_BASE,MODE_ADVANCED,MODE_ADVANCED_V2</code>.
          </p>
        </div>
        <BaseHome />
      </div>
    );
  }

  return <AdvancedControlRoom context={context} />;
};

export default CreatePage;
