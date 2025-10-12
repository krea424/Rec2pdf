import { lazy, Suspense, useMemo, useState } from "react";
import type { SVGProps } from "react";
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
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
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
        <div className="rounded-2xl border border-indigo-500/40 bg-indigo-500/10 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-indigo-200">Prompt totali</p>
          <p className="mt-2 text-2xl font-semibold text-indigo-50">{promptCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-200">Preferiti</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-50">{favoriteCount}</p>
        </div>
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900/40 p-4">
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
  const { hasModeFlag } = useAppContext();
  const [tab, setTab] = useState("destinations");

  const hasAdvancedAccess = typeof hasModeFlag === "function" && hasModeFlag("MODE_ADVANCED");

  if (!hasAdvancedAccess) {
    return null;
  }

  const handleTabChange = (value: string) => {
    setTab(value);
    trackEvent("advanced.dashboard.tab", { tab: value });
  };

  return (
    <div className="rounded-3xl border border-indigo-500/40 bg-zinc-950/50 p-6 text-sm text-zinc-200 shadow-[0_24px_60px_-40px_rgba(99,102,241,0.6)]">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-indigo-200">Advanced workspace</p>
          <h2 className="text-2xl font-semibold text-zinc-100">Control room</h2>
        </div>
        <p className="text-xs text-zinc-400 md:max-w-sm">
          Gestisci destinazioni, branding, prompt e diagnostica da un unico pannello. I moduli sono caricati on-demand per
          ottimizzare le prestazioni.
        </p>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="mt-5 flex flex-wrap">
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
    </div>
  );
};

export default AdvancedDashboard;
