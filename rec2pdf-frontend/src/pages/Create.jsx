import { useMemo } from "react";
import { useAppContext } from "../hooks/useAppContext";
import { Button, Toast } from "../components/ui";
import BaseHome from "../features/base/BaseHome";
import { useAnalytics } from "../context/AnalyticsContext";
import InputManager from "../features/advanced/InputManager";

const truncateText = (value, limit = 80) => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, limit)}…`;
};

const ErrorBanner = () => {
  const { errorBanner, setErrorBanner } = useAppContext();

  if (!errorBanner) {
    return null;
  }

  return (
    <Toast
      tone="danger"
      title={errorBanner.title}
      description={errorBanner.details}
      className="mt-4"
      action={
        <Button size="sm" variant="ghost" onClick={() => setErrorBanner(null)}>
          Chiudi
        </Button>
      }
    />
  );
};

const AdvancedCreatePage = ({ context, trackEvent }) => {
  const { theme, themes } = context;
  const isBoardroom = theme === "boardroom";
  const boardroomPrimarySurface =
    "border-white/20 bg-gradient-to-br from-white/[0.14] via-white/[0.05] to-transparent backdrop-blur-3xl shadow-[0_45px_120px_-60px_rgba(4,20,44,0.95)]";
  const boardroomSecondarySurface =
    "border-white/14 bg-white/[0.05] backdrop-blur-2xl shadow-[0_32px_90px_-58px_rgba(9,33,68,0.85)]";
  const boardroomChipSurface =
    "border-white/20 bg-white/[0.08] text-white/90";
  const boardroomInfoSurface =
    "border-white/16 bg-white/[0.05] text-white/80";
  const audioDownloadExtension = useMemo(() => {
    const mime = context.mime || "";
    if (mime.includes("webm")) return "webm";
    if (mime.includes("ogg")) return "ogg";
    if (mime.includes("wav")) return "wav";
    return "m4a";
  }, [context.mime]);

  const activeProject = useMemo(
    () =>
      context.workspaceProjects.find(
        (project) => project.id === context.workspaceSelection.projectId
      ) || null,
    [context.workspaceProjects, context.workspaceSelection.projectId]
  );

  const workspaceName = context.activeWorkspace?.name || "Workspace non selezionato";
  const workspaceClient = context.activeWorkspace?.client || "—";
  const projectLabel =
    activeProject?.name || context.workspaceSelection.projectName || "Nessun progetto";
  // TODO(Task 5): Swap out the SetupPanel/InputManager duo with a
  // parameters-only surface once Advanced mode is slimmed down.

  return (
    <div>
      {!context.secureOK && (
        <div className="mt-4 rounded-xl border border-rose-900/40 bg-rose-950/40 p-3 text-sm text-rose-200">
          ⚠️ Per accedere al microfono serve HTTPS (o localhost in sviluppo).
        </div>
      )}

      <ErrorBanner />
      <div className="mt-10">
        <InputManager
          context={context}
          theme={theme}
          themes={themes}
          isBoardroom={isBoardroom}
          boardroomPrimarySurface={boardroomPrimarySurface}
          boardroomSecondarySurface={boardroomSecondarySurface}
          boardroomChipSurface={boardroomChipSurface}
          boardroomInfoSurface={boardroomInfoSurface}
          trackEvent={trackEvent}
          audioDownloadExtension={audioDownloadExtension}
        />
      </div>
    </div>
  );
};

const CreatePage = () => {
  const context = useAppContext();
  const { trackEvent } = useAnalytics();

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
            all'attributo <code className="mx-1 font-mono text-xs">modeFlags</code> insieme a <code className="mx-1 rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-xs">MODE_ADVANCED</code>. In locale puoi settare <code className="mx-1 font-mono text-xs">VITE_DEFAULT_MODE_FLAGS=MODE_BASE,MODE_ADVANCED,MODE_ADVANCED_V2</code>.
          </p>
        </div>
        <BaseHome />
      </div>
    );
  }

  return <AdvancedCreatePage context={context} trackEvent={trackEvent} />;
};

export default CreatePage;
