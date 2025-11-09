import { useCallback, useEffect, useMemo } from "react";
import CloudLibraryPanel from "../components/CloudLibraryPanel";
import WorkspaceNavigator from "../components/WorkspaceNavigator";
import { useAppContext } from "../hooks/useAppContext";
import { Tabs, TabsList, TabsTrigger } from "../components/ui";
import { supabase } from "../supabaseClient";

const LibraryPage = () => {
  const context = useAppContext();
  // Estraiamo in modo specifico solo ciò che serve ai componenti figli
  const {
    theme, themes, HISTORY_TABS, historyTab, setHistoryTab,
    normalizedBackendUrl, fetchBody, navigatorSelection,
    handleLibraryWorkspaceSelection, workspaces,
    // Props specifiche per WorkspaceNavigator
    history, setNavigatorSelection, savedWorkspaceFilters,
    handleSaveWorkspaceFilter, handleDeleteWorkspaceFilter,
    handleApplyWorkspaceFilter, historyFilter, setHistoryFilter,
    fetchEntryPreview, fetchEntryPreAnalysis, handleOpenHistoryPdf,
    handleOpenHistoryMd, handleRepublishFromMd, handleShowHistoryLogs,
    handleAssignEntryWorkspace, workspaceLoading, handleRefreshWorkspaces,
    workspaceSelection, handleAdoptNavigatorSelection
  } = context;

  const availableTabs = HISTORY_TABS;

  const normalizedHistoryTab = useMemo(() => {
    if (availableTabs.some((tab) => tab.key === historyTab)) {
      return historyTab;
    }
    return availableTabs[0]?.key;
  }, [availableTabs, historyTab]);

  const handleTabChange = useCallback((nextValue) => {
    setHistoryTab(nextValue);
  }, [setHistoryTab]);

  useEffect(() => {
    if (normalizedHistoryTab && historyTab !== normalizedHistoryTab) {
      setHistoryTab(normalizedHistoryTab);
    }
  }, [historyTab, normalizedHistoryTab, setHistoryTab]);

  // ... in Library.jsx ...

  const handleOpenFile = useCallback(async ({ bucket, path }) => { // `path` qui è l'objectPath
    if (!normalizedBackendUrl || !bucket || !path) {
      alert("Errore: Informazioni mancanti per il download del file.");
      return;
    }
    try {
      // ==========================================================
      // ==                  MODIFICA CHIAVE QUI                 ==
      // ==========================================================
      // Passiamo bucket e path come parametri separati
      const params = new URLSearchParams({ bucket, path });
      const targetUrl = `${normalizedBackendUrl}/api/file?${params.toString()}`;
      // ==========================================================
      
      const session = (await supabase.auth.getSession())?.data.session;
      if (!session) throw new Error("Sessione utente non trovata.");
      
      const response = await fetch(targetUrl, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        // Usiamo il messaggio di errore specifico del backend
        throw new Error(data.message || "Impossibile generare l'URL.");
      }
      
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error("Errore durante l'apertura del file:", error);
      alert(`Errore: ${error.message}`);
    }
  }, [normalizedBackendUrl]);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-800 pb-2">
        <Tabs value={normalizedHistoryTab} onValueChange={handleTabChange}>
          <TabsList className="flex gap-2 border-none bg-transparent p-0">
            {availableTabs.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key} className="px-4">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="mt-5">
        {normalizedHistoryTab === "history" ? (
          <WorkspaceNavigator
            // ==========================================================
            // ==                  MODIFICA CHIAVE QUI                 ==
            // ==========================================================
            // Passiamo solo le props necessarie, non l'intero context.
            // Questo stabilizza il componente e previene il loop.
            entries={history}
            workspaces={workspaces}
            selection={navigatorSelection}
            onSelectionChange={setNavigatorSelection}
            savedFilters={savedWorkspaceFilters}
            onSaveFilter={handleSaveWorkspaceFilter}
            onDeleteFilter={handleDeleteWorkspaceFilter}
            onApplyFilter={handleApplyWorkspaceFilter}
            searchTerm={historyFilter}
            onSearchChange={setHistoryFilter}
            fetchPreview={fetchEntryPreview}
            fetchPreAnalysis={fetchEntryPreAnalysis}
            onOpenPdf={handleOpenHistoryPdf}
            onOpenMd={handleOpenHistoryMd}
            onRepublish={handleRepublishFromMd}
            onShowLogs={handleShowHistoryLogs}
            onAssignWorkspace={handleAssignEntryWorkspace}
            themeStyles={themes[theme]}
            loading={workspaceLoading}
            onRefresh={handleRefreshWorkspaces}
            pipelineSelection={workspaceSelection}
            onAdoptSelection={handleAdoptNavigatorSelection}
          />
        ) : (
          <CloudLibraryPanel
            backendUrl={normalizedBackendUrl}
            fetchBody={fetchBody}
            selection={navigatorSelection}
            onAssignWorkspace={handleLibraryWorkspaceSelection}
            onOpenFile={handleOpenFile}
            workspaces={workspaces}
            themeStyles={themes[theme]}
          />
        )}
      </div>
    </div>
  );
};

export default LibraryPage;