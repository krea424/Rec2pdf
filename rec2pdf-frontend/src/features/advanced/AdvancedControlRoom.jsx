import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Toast } from "../../components/ui";
import SetupPanel from "./SetupPanel";
import InputManager from "./InputManager";

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

const ErrorBanner = ({ errorBanner, onDismiss }) => {
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
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Chiudi
        </Button>
      }
    />
  );
};

const AdvancedControlRoom = ({ context }) => {
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

      <ErrorBanner errorBanner={context.errorBanner} onDismiss={() => context.setErrorBanner(null)} />

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

export default AdvancedControlRoom;
