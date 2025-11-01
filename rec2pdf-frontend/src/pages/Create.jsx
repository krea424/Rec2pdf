import { useMemo } from "react";
import { useAppContext } from "../hooks/useAppContext";
import { Button, Toast } from "../components/ui";
import BaseHome from "../features/base/BaseHome";
import SetupPanel from "../features/advanced/SetupPanel";
import InputManager from "../features/advanced/InputManager";
import { useNavigate } from "react-router-dom";

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

const AdvancedCreatePage = ({ context }) => {
  const { theme, themes } = context;
  const isBoardroom = theme === "boardroom";
  const navigate = useNavigate();
  const boardroomPrimarySurface =
    "border-white/20 bg-gradient-to-br from-white/[0.14] via-white/[0.05] to-transparent backdrop-blur-3xl shadow-[0_45px_120px_-60px_rgba(4,20,44,0.95)]";
  const boardroomSecondarySurface =
    "border-white/14 bg-white/[0.05] backdrop-blur-2xl shadow-[0_32px_90px_-58px_rgba(9,33,68,0.85)]";
  const boardroomChipSurface =
    "border-white/20 bg-white/[0.08] text-white/90";
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
  const mutedTextClass = isBoardroom ? "text-white/75" : "text-zinc-500";
  const heroTitleClass = isBoardroom ? "text-white" : "text-zinc-100";
  const heroSubtitleClass = isBoardroom ? "text-white/80" : "text-zinc-400";
  const labelToneClass = isBoardroom ? "text-white/65" : "text-zinc-500";

  const summaryItems = useMemo(() => {
    const promptTitle =
      typeof context.activePrompt?.title === "string"
        ? context.activePrompt.title
        : "Nessun template attivo";
    const focusNotes =
      typeof context.promptState?.focus === "string" && context.promptState.focus.trim()
        ? truncateText(context.promptState.focus, 72)
        : null;

    return [
      {
        key: "workspace",
        label: "Workspace",
        value: workspaceName,
        meta:
          workspaceClient && workspaceClient !== "—"
            ? `Cliente · ${workspaceClient}`
            : "Seleziona il contesto operativo prima di salvare i parametri.",
      },
      {
        key: "project",
        label: "Progetto",
        value: projectLabel,
        meta: context.workspaceSelection.status
          ? `Stato · ${context.workspaceSelection.status}`
          : "Abbina stato e progetto per organizzare la sessione.",
      },
      {
        key: "prompt",
        label: "Prompt guida",
        value: promptTitle,
        meta:
          focusNotes || context.activePrompt?.persona
            ? focusNotes || `Persona · ${context.activePrompt.persona}`
            : "Attiva un prompt per controllare tono e checklist.",
      },
    ];
  }, [
    context.activePrompt?.persona,
    context.activePrompt?.title,
    context.promptState?.focus,
    context.workspaceSelection.projectId,
    context.workspaceSelection.projectName,
    context.workspaceSelection.status,
    projectLabel,
    workspaceClient,
    workspaceName,
  ]);

  const handleOpenLibrary = () => {
    navigate("/library");
  };

  return (
    <div>
      {!context.secureOK && (
        <div className="mt-4 rounded-xl border border-rose-900/40 bg-rose-950/40 p-3 text-sm text-rose-200">
          ⚠️ Per accedere al microfono serve HTTPS (o localhost in sviluppo).
        </div>
      )}

      <ErrorBanner />

      <SetupPanel
        isBoardroom={isBoardroom}
        theme={theme}
        themes={themes}
        boardroomPrimarySurface={boardroomPrimarySurface}
        labelToneClass={labelToneClass}
        heroTitleClass={heroTitleClass}
        heroSubtitleClass={heroSubtitleClass}
        summaryItems={summaryItems}
        onOpenLibrary={handleOpenLibrary}
      />

      <div className="mt-10">
        <InputManager
          context={context}
          theme={theme}
          themes={themes}
          isBoardroom={isBoardroom}
          boardroomPrimarySurface={boardroomPrimarySurface}
          boardroomSecondarySurface={boardroomSecondarySurface}
          boardroomChipSurface={boardroomChipSurface}
        />
      </div>
    </div>
  );
};

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
            all'attributo <code className="mx-1 font-mono text-xs">modeFlags</code> insieme a <code className="mx-1 rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-xs">MODE_ADVANCED</code>. In locale puoi settare <code className="mx-1 font-mono text-xs">VITE_DEFAULT_MODE_FLAGS=MODE_BASE,MODE_ADVANCED,MODE_ADVANCED_V2</code>.
          </p>
        </div>
        <BaseHome />
      </div>
    );
  }

  return <AdvancedCreatePage context={context} />;
};

export default CreatePage;
