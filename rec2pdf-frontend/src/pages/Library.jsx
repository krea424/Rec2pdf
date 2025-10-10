import CloudLibraryPanel from "../components/CloudLibraryPanel";
import WorkspaceNavigator from "../components/WorkspaceNavigator";
import { useAppContext } from "../hooks/useAppContext";
import { classNames } from "../utils/classNames";

const LibraryPage = () => {
  const context = useAppContext();
  const { theme, themes } = context;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/60 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          {context.HISTORY_TABS.map((tab) => {
            const isActive = context.historyTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => context.setHistoryTab(tab.key)}
                className={classNames(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition border",
                  isActive ? "bg-indigo-500/20 text-indigo-100 border-indigo-400/60" : themes[theme].button,
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
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
