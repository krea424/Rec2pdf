import { useCallback, useMemo } from "react";
import { Folder, Target, Sparkles, Users } from "../../components/icons.jsx";
import { useAppContext } from "../../hooks/useAppContext";
import { classNames } from "../../utils/classNames";

const SummaryCard = ({ title, icon: Icon, accent = "bg-white/10 text-white", headline, children }) => {
  return (
    <article className="flex h-full flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-5 text-white shadow-subtle">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={classNames(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-semibold",
              accent,
            )}
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/60">{title}</p>
            <p className="mt-2 text-lg font-semibold leading-snug text-white">{headline}</p>
          </div>
        </div>
      </header>
      <div className="mt-4 space-y-4 text-sm text-white/70">{children}</div>
    </article>
  );
};

const DetailRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 text-xs text-white/60">
    <span className="font-medium uppercase tracking-[0.24em] text-white/50">{label}</span>
    <span className="truncate text-right text-white/80" title={typeof value === "string" ? value : undefined}>
      {value || "—"}
    </span>
  </div>
);

const BaseSummaryCards = () => {
  const context = useAppContext();
  const {
    workspaceLoading,
    workspaceSelection,
    activeWorkspace,
    workspaceProjects,
    promptLoading,
    prompts,
    promptState,
    handleSelectPromptTemplate,
    handleClearPromptSelection,
    activePrompt,
    promptCompletedCues,
    activeWorkspaceProfile,
    workspaceProfileSelection,
  } = context;

  const workspaceStatus = workspaceSelection?.status || activeWorkspace?.status || "In attesa";
  const workspaceClient = typeof activeWorkspace?.client === "string" ? activeWorkspace.client : "";

  const projectList = useMemo(() => {
    if (!Array.isArray(workspaceProjects)) {
      return [];
    }
    return workspaceProjects.map((project) => ({
      id: project?.id || "",
      name: project?.name || project?.key || "",
    }));
  }, [workspaceProjects]);

  const selectedProject = useMemo(() => {
    if (workspaceSelection?.projectId) {
      return (
        projectList.find((project) => project.id === workspaceSelection.projectId) || {
          id: workspaceSelection.projectId,
          name: workspaceSelection.projectId,
        }
      );
    }
    const draftName = typeof workspaceSelection?.projectName === "string" ? workspaceSelection.projectName.trim() : "";
    if (draftName) {
      return { id: "", name: draftName };
    }
    return null;
  }, [projectList, workspaceSelection?.projectId, workspaceSelection?.projectName]);

  const promptOptions = useMemo(() => {
    if (!Array.isArray(prompts)) {
      return [];
    }
    return prompts.map((prompt) => ({ id: prompt.id, title: prompt.title || prompt.id }));
  }, [prompts]);

  const promptChecklist = useMemo(() => {
    const total = Array.isArray(activePrompt?.cueCards) ? activePrompt.cueCards.length : 0;
    const completed = Array.isArray(promptCompletedCues) ? promptCompletedCues.length : 0;
    if (!total) {
      return null;
    }
    return { completed, total };
  }, [activePrompt?.cueCards, promptCompletedCues]);

  const activeProfilePrompt = useMemo(() => {
    if (!activeWorkspaceProfile?.promptId) {
      return null;
    }
    return prompts.find((prompt) => prompt.id === activeWorkspaceProfile.promptId) || null;
  }, [activeWorkspaceProfile?.promptId, prompts]);

  const profileHeadline = useMemo(() => {
    if (activeWorkspaceProfile) {
      return activeWorkspaceProfile.label || activeWorkspaceProfile.id || "Profilo attivo";
    }
    if (workspaceProfileSelection?.profileId) {
      return "Profilo non disponibile";
    }
    return "Nessun profilo attivo";
  }, [activeWorkspaceProfile, workspaceProfileSelection?.profileId]);

  const handlePromptChange = useCallback(
    (event) => {
      const targetId = event.target.value;
      if (!targetId) {
        handleClearPromptSelection();
        return;
      }
      const selected = prompts.find((prompt) => prompt.id === targetId) || { id: targetId };
      handleSelectPromptTemplate(selected);
    },
    [handleClearPromptSelection, handleSelectPromptTemplate, prompts],
  );

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Stato workspace e sessione">
      <SummaryCard
        title="Workspace"
        icon={Folder}
        accent="bg-emerald-500/15 text-emerald-200"
        headline={workspaceLoading ? "Caricamento…" : activeWorkspace?.name || "Nessun workspace"}
      >
        <div className="space-y-3">
          <DetailRow label="ID" value={workspaceSelection?.workspaceId || "—"} />
          <DetailRow label="Cliente" value={workspaceClient || "—"} />
          <DetailRow label="Stato" value={workspaceStatus} />
        </div>
      </SummaryCard>

      <SummaryCard
        title="Progetto"
        icon={Target}
        accent="bg-sky-500/15 text-sky-200"
        headline={selectedProject?.name || "Nessun progetto"}
      >
        <div className="space-y-3">
          <DetailRow label="ID" value={selectedProject?.id || workspaceSelection?.projectId || "—"} />
          <DetailRow label="Stato" value={workspaceSelection?.status || "—"} />
        </div>
      </SummaryCard>

      <SummaryCard
        title="Prompt guida"
        icon={Sparkles}
        accent="bg-violet-500/20 text-violet-100"
        headline={
          promptLoading ? "Caricamento…" : activePrompt?.title || activePrompt?.id || "Nessun prompt attivo"
        }
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="base-prompt-select" className="text-xs font-medium uppercase tracking-[0.24em] text-white/50">
              Seleziona
            </label>
            <select
              id="base-prompt-select"
              className="w-40 truncate rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-300/70 focus:ring-offset-2 focus:ring-offset-zinc-900"
              value={promptState?.promptId || ""}
              onChange={handlePromptChange}
              disabled={promptLoading || (!promptOptions.length && !promptState?.promptId)}
            >
              <option value="">Nessun prompt</option>
              {promptOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title || option.id}
                </option>
              ))}
            </select>
          </div>
          <DetailRow label="ID" value={activePrompt?.id || promptState?.promptId || "—"} />
          {promptChecklist ? (
            <DetailRow label="Checklist" value={`${promptChecklist.completed}/${promptChecklist.total} cue`} />
          ) : null}
        </div>
      </SummaryCard>

      <SummaryCard
        title="Profilo"
        icon={Users}
        accent="bg-rose-500/15 text-rose-200"
        headline={profileHeadline}
      >
        <div className="space-y-3">
          <DetailRow
            label="ID"
            value={activeWorkspaceProfile?.id || workspaceProfileSelection?.profileId || "—"}
          />
          <DetailRow label="Slug" value={activeWorkspaceProfile?.slug || "—"} />
          <DetailRow label="Cartella" value={activeWorkspaceProfile?.destDir || "—"} />
          <DetailRow
            label="Prompt"
            value={activeProfilePrompt?.title || activeWorkspaceProfile?.promptId || "—"}
          />
          <DetailRow label="Template" value={activeWorkspaceProfile?.pdfTemplate || "—"} />
        </div>
      </SummaryCard>
    </section>
  );
};

export default BaseSummaryCards;
