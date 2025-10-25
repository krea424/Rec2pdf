import { lazy, Suspense, useMemo, useState } from "react";
import type { ReactNode, SVGProps } from "react";
import { Button } from "../../components/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/Tabs";
import { Folder, Target } from "../../components/icons";
import { useAppContext } from "../../hooks/useAppContext";
import { trackEvent } from "../../utils/analytics";

const WorkspaceSection = lazy(() => import("../settings/sections/WorkspaceSection"));
const BrandingSection = lazy(() => import("../settings/sections/BrandingSection"));
const DiagnosticsSection = lazy(() => import("../settings/sections/DiagnosticsSection"));

const SectionSkeleton = ({ label }: { label: string }) => (
  <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/30 p-6 text-sm text-zinc-400">
    Caricamento {label}…
  </div>
);

const SummaryField = ({ label, value }: { label: string; value: ReactNode }) => (
  <div>
    <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-zinc-400">{label}</dt>
    <dd className="mt-1 text-base text-zinc-100">{value}</dd>
  </div>
);

const ControlRoomSection = ({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) => (
  <section className="rounded-3xl border border-zinc-800/70 bg-zinc-950/60 p-5 shadow-[0_30px_70px_-60px_rgba(99,102,241,0.65)]">
    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-indigo-200">{eyebrow}</p>
        <h3 className="mt-1 text-lg font-semibold text-zinc-100">{title}</h3>
        {description ? <p className="text-xs text-zinc-400 md:max-w-sm">{description}</p> : null}
      </div>
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

const ENABLE_FS_PLACEHOLDER = ["true", "1", "yes"].includes(
  String(import.meta.env.VITE_ENABLE_FS_INTEGRATION_PLACEHOLDER || "").toLowerCase(),
);

const ENABLE_RAG_PLACEHOLDER = ["true", "1", "yes"].includes(
  String(import.meta.env.VITE_ENABLE_RAG_PLACEHOLDER || "").toLowerCase(),
);

const PromptOverview = () => {
  const {
    prompts = [],
    promptFavorites = [],
    promptState,
    activePrompt,
    handleRefreshPrompts,
  } = useAppContext();

  const promptCount = Array.isArray(prompts) ? prompts.length : 0;
  const favoriteCount = Array.isArray(promptFavorites) ? promptFavorites.length : 0;
  const activeTitle = activePrompt?.title || "Nessun prompt selezionato";
  const persona = activePrompt?.persona || "Persona non definita";
  const focus = promptState?.focus || "—";

  const handleRefresh = () => {
    trackEvent("advanced.dashboard.prompt_refresh");
    handleRefreshPrompts?.();
  };

  const handleScrollToLibrary = () => {
    trackEvent("advanced.dashboard.prompt_library_open");
    if (typeof document !== "undefined") {
      const element = document.getElementById("prompt-library");
      element?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="space-y-4 text-sm text-zinc-200">
      <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-indigo-200">Prompt attivo</p>
            <h3 className="mt-1 text-lg font-semibold text-zinc-100">{activeTitle}</h3>
            <p className="text-xs text-zinc-400">Persona: {persona}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handleRefresh}>
              Aggiorna libreria
            </Button>
            <Button size="sm" variant="primary" onClick={handleScrollToLibrary}>
              Vai alla libreria
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-indigo-200">Prompt totali</p>
          <p className="mt-2 text-2xl font-semibold text-indigo-50">{promptCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-200">Preferiti</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-50">{favoriteCount}</p>
        </div>
        <div className="rounded-2xl border border-zinc-700/70 bg-zinc-900/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-400">Focus attivo</p>
          <p className="mt-2 text-base text-zinc-200">{focus || "—"}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 text-xs text-zinc-400">
        <p>
          Suggerimento: usa la libreria prompt per clonare template esistenti, salvare checklist personalizzate e condividere le
          configurazioni con il team. Questa panoramica mostra lo stato corrente senza modificare la sessione in corso.
        </p>
      </div>
    </div>
  );
};

const PlaceholderCard = ({
  title,
  description,
  icon: Icon,
  eventName,
}: {
  title: string;
  description: string;
  icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
  eventName: string;
}) => (
  <div className="space-y-3 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/30 p-5 text-sm text-zinc-200">
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400">
      <Icon className="h-4 w-4" />
      In arrivo
    </div>
    <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
    <p className="text-sm leading-relaxed text-zinc-400">{description}</p>
    <Button
      size="sm"
      variant="secondary"
      onClick={() => {
        trackEvent(eventName);
      }}
    >
      Invia feedback
    </Button>
  </div>
);

const ContextPackPlaceholder = () => {
  const cards = useMemo(
    () =>
      [
        ENABLE_FS_PLACEHOLDER
          ? {
              key: "fs",
              title: "Integrazione file system",
              description:
                "Sincronizza automaticamente registrazioni e PDF con repository interni o cartelle condivise.",
              icon: Folder,
              eventName: "advanced.dashboard.placeholder_fs",
            }
          : null,
        ENABLE_RAG_PLACEHOLDER
          ? {
              key: "rag",
              title: "Context packs per RAG",
              description:
                "Collega knowledge base interne per arricchire i prompt con informazioni sempre aggiornate.",
              icon: Target,
              eventName: "advanced.dashboard.placeholder_rag",
            }
          : null,
      ].filter(Boolean) as Array<{
        key: string;
        title: string;
        description: string;
        icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
        eventName: string;
      }>,
    [],
  );

  if (!cards.length) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 text-sm text-zinc-300">
        Nessun placeholder attivo. Configura le variabili di ambiente per mostrare le anteprime delle integrazioni future.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map((card) => (
        <PlaceholderCard key={card.key} {...card} />
      ))}
    </div>
  );
};

const AdvancedDashboard = () => {
  const {
    hasModeFlag,
    activeWorkspace,
    workspaceSelection = {},
    workspaceProjects = [],
    pipelineStatus = {},
    PIPELINE_STAGES = [],
    STAGE_STATUS_LABELS = {},
    failedStage,
    activeStageKey,
    progressPercent = 0,
    pipelineComplete,
  } = useAppContext();
  const [tab, setTab] = useState("destinations");

  const hasAdvancedAccess = typeof hasModeFlag === "function" && hasModeFlag("MODE_ADVANCED");

  if (!hasAdvancedAccess) {
    return null;
  }

  const activeProject = useMemo(
    () =>
      workspaceProjects.find(
        (project) => project?.id && project.id === workspaceSelection?.projectId,
      ) || null,
    [workspaceProjects, workspaceSelection?.projectId],
  );

  const stageKey = failedStage?.key || activeStageKey || PIPELINE_STAGES[0]?.key || null;
  const stageDefinition = useMemo(
    () => (stageKey ? PIPELINE_STAGES.find((stage) => stage.key === stageKey) || null : null),
    [PIPELINE_STAGES, stageKey],
  );
  const stageStatusKey = stageKey ? pipelineStatus?.[stageKey] : null;
  const stageStatusLabel = stageStatusKey
    ? STAGE_STATUS_LABELS?.[stageStatusKey] || stageStatusKey
    : "—";
  const progressValue = Number.isFinite(progressPercent)
    ? Math.max(0, Math.min(100, Math.round(progressPercent)))
    : 0;
  const stageTone = failedStage
    ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
    : pipelineComplete
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
      : "border-sky-500/40 bg-sky-500/10 text-sky-100";

  const handleTabChange = (value: string) => {
    setTab(value);
    trackEvent("advanced.dashboard.tab", { tab: value });
  };

  return (
    <div className="space-y-6 text-sm text-zinc-200">
      <div className="rounded-3xl border border-indigo-500/40 bg-gradient-to-br from-indigo-500/15 via-transparent to-zinc-950/70 p-6 shadow-[0_32px_90px_-60px_rgba(99,102,241,0.75)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-indigo-200">Advanced workspace</p>
            <h2 className="mt-1 text-2xl font-semibold text-zinc-50">Control room</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300 lg:max-w-md">
              Orchestrazione end-to-end in un pannello essenziale: monitora lo stato della pipeline e aggiorna rapidamente
              destinazioni, branding e prompt senza lasciare l&apos;Executive create hub.
            </p>
          </div>
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-4">
            <div className={"rounded-xl border px-4 py-3 text-sm " + stageTone}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em]">Stato pipeline</p>
              <p className="mt-2 text-base font-semibold text-white">{stageStatusLabel}</p>
              <p className="text-xs text-white/70">{stageDefinition?.label || "Pipeline"}</p>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-400">
                <span>Avanzamento</span>
                <span>{progressValue}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progressValue}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <SummaryField label="Workspace" value={activeWorkspace?.name || "—"} />
          <SummaryField label="Cliente" value={activeWorkspace?.client || workspaceSelection?.client || "—"} />
          <SummaryField label="Progetto" value={activeProject?.name || workspaceSelection?.projectName || "Nessun progetto"} />
          <SummaryField label="Stato" value={workspaceSelection?.status || "—"} />
        </dl>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <ControlRoomSection
          eyebrow="Configurazione"
          title="Destinazioni e governance"
          description="Gestisci workspace, upload automatici, asset di brand e diagnostica della piattaforma senza cambiare contesto."
        >
          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList className="mt-1 flex flex-wrap border-indigo-500/30 bg-indigo-500/10">
              <TabsTrigger value="destinations">Destinazioni</TabsTrigger>
              <TabsTrigger value="branding">Branding</TabsTrigger>
              <TabsTrigger value="prompt">Prompt</TabsTrigger>
              <TabsTrigger value="diagnostics">Diagnostica</TabsTrigger>
              <TabsTrigger value="packs">Context Packs</TabsTrigger>
            </TabsList>
            <TabsContent value="destinations" className="mt-6">
              <Suspense fallback={<SectionSkeleton label="destinazioni" />}>
                <WorkspaceSection />
              </Suspense>
            </TabsContent>
            <TabsContent value="branding" className="mt-6">
              <Suspense fallback={<SectionSkeleton label="branding" />}>
                <BrandingSection />
              </Suspense>
            </TabsContent>
            <TabsContent value="prompt" className="mt-6">
              <PromptOverview />
            </TabsContent>
            <TabsContent value="diagnostics" className="mt-6">
              <Suspense fallback={<SectionSkeleton label="diagnostica" />}>
                <DiagnosticsSection />
              </Suspense>
            </TabsContent>
            <TabsContent value="packs" className="mt-6">
              <ContextPackPlaceholder />
            </TabsContent>
          </Tabs>
        </ControlRoomSection>

        <div className="space-y-4">
          <ControlRoomSection
            eyebrow="Insight"
            title="Prompt intelligence"
            description="Statistiche rapide sul materiale creativo e scorciatoie per aggiornare la libreria condivisa."
          >
            <PromptOverview />
          </ControlRoomSection>
          <ControlRoomSection
            eyebrow="Integrazioni"
            title="Context packs & RAG"
            description="Anticipa i connettori che abiliteranno flussi avanzati con knowledge base aziendali e file system."
          >
            <ContextPackPlaceholder />
          </ControlRoomSection>
        </div>
      </div>
    </div>
  );
};

export default AdvancedDashboard;
