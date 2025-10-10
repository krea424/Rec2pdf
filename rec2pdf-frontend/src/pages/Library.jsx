import CloudLibraryPanel from "../components/CloudLibraryPanel";
import WorkspaceNavigator from "../components/WorkspaceNavigator";
import { useAppContext } from "../hooks/useAppContext";
import { Tabs, TabsList, TabsTrigger } from "../components/ui";

const LibraryPage = () => {
  const context = useAppContext();
  const { theme, themes } = context;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-800 pb-2">
        <Tabs value={context.historyTab} onValueChange={context.setHistoryTab}>
          <TabsList className="flex gap-2 border-none bg-transparent p-0">
            {context.HISTORY_TABS.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key} className="px-4">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="mt-5">
        {context.historyTab === "history" ? (
          <WorkspaceNavigator
            entries={context.history}
            workspaces={context.workspaces}
            selection={context.navigatorSelection}
            onSelectionChange={context.setNavigatorSelection}
            savedFilters={context.savedWorkspaceFilters}
            onSaveFilter={context.handleSaveWorkspaceFilter}
            onDeleteFilter={context.handleDeleteWorkspaceFilter}
            onApplyFilter={context.handleApplyWorkspaceFilter}
            searchTerm={context.historyFilter}
            onSearchChange={context.setHistoryFilter}
            fetchPreview={context.fetchEntryPreview}
            onOpenPdf={context.handleOpenHistoryPdf}
            onOpenMd={context.handleOpenHistoryMd}
            onRepublish={context.handleRepublishFromMd}
            onShowLogs={context.handleShowHistoryLogs}
            onAssignWorkspace={context.handleAssignEntryWorkspace}
            themeStyles={themes[theme]}
            loading={context.workspaceLoading}
            onRefresh={context.handleRefreshWorkspaces}
            pipelineSelection={context.workspaceSelection}
            onAdoptSelection={context.handleAdoptNavigatorSelection}
          />
        ) : (
          <CloudLibraryPanel
            backendUrl={context.normalizedBackendUrl}
            fetchBody={context.fetchBody}
            selection={context.navigatorSelection}
            onAssignWorkspace={context.handleLibraryWorkspaceSelection}
            onOpenFile={context.handleOpenLibraryFile}
            workspaces={context.workspaces}
            themeStyles={themes[theme]}
          />
        )}
      </div>
    </div>
  );
};

export default LibraryPage;
