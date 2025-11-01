import { useMemo } from "react";
import { Folder, Target, Sparkles, Users } from "../../components/icons.jsx";
import { useAppContext } from "../../hooks/useAppContext";
import { classNames } from "../../utils/classNames";

const SummaryCard = ({ title, icon: Icon, accent = "bg-white/10 text-white", headline, action = null }) => {
  return (
    <article className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/5 p-5 text-white shadow-subtle">
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
          <p className="mt-1 text-lg font-semibold leading-snug text-white">{headline}</p>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </article>
  );
};

const BaseSummaryCards = () => {
  const context = useAppContext();
  const {
    workspaceLoading,
    workspaceSelection,
    activeWorkspace,
    workspaceProjects,
    promptLoading,
    promptState,
    activePrompt,
    activeWorkspaceProfile,
    workspaceProfileSelection,
  } = context;

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

  const profileHeadline = useMemo(() => {
    if (activeWorkspaceProfile) {
      return activeWorkspaceProfile.label || activeWorkspaceProfile.id || "Profilo attivo";
    }
    if (workspaceProfileSelection?.profileId) {
      return "Profilo non disponibile";
    }
    return "Nessun profilo attivo";
  }, [activeWorkspaceProfile, workspaceProfileSelection?.profileId]);

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Stato workspace e sessione">
      <SummaryCard
        title="Workspace"
        icon={Folder}
        accent="bg-emerald-500/15 text-emerald-200"
        headline={workspaceLoading ? "Caricamento…" : activeWorkspace?.name || "Nessun workspace"}
      />

      <SummaryCard
        title="Progetto"
        icon={Target}
        accent="bg-sky-500/15 text-sky-200"
        headline={selectedProject?.name || "Nessun progetto"}
      />

      <SummaryCard
        title="Prompt guida"
        icon={Sparkles}
        accent="bg-violet-500/20 text-violet-100"
        headline={
          promptLoading
            ? "Caricamento…"
            : activePrompt?.title || activePrompt?.id || promptState?.promptId || "Nessun prompt attivo"
        }
      />

      <SummaryCard
        title="Profilo"
        icon={Users}
        accent="bg-rose-500/15 text-rose-200"
        headline={profileHeadline}
      />
    </section>
  );
};

export default BaseSummaryCards;
