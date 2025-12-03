import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { classNames } from "../utils/classNames";
import { useAppContext } from "../hooks/useAppContext";
import {
  Users,
  Folder,
  FileText,
  FilterIcon,
  Bookmark,
  RefreshCw,
  Download,
  Sparkles,
  LinkIcon,
  ChevronRight,
  Plus,
  ExternalLink,
  Palette,
  XCircle,
  Info
} from "./icons";
import { EmptyState, Skeleton } from "./ui";

const DEFAULT_STATUSES = ["Bozza", "In lavorazione", "Da revisionare", "Completato"];
const UNASSIGNED_KEY = "__unassigned__";
const ADVANCED_FILTERS_FLAG = "ADVANCED_WORKSPACE_FILTERS";
const ADVANCED_MODE_FLAGS = ["MODE_ADVANCED", "MODE_ADVANCED_V2"];

// --- STILI BOARDROOM (Design System Unificato) ---
const CARD_STYLE = "rounded-2xl border border-white/10 bg-[#121214] text-white shadow-sm transition-all";
const PANEL_HEADER = "border-b border-white/5 bg-white/[0.02] p-4 flex items-center justify-between backdrop-blur-xl";
const PANEL_BODY = "p-4";
const INPUT_STYLE = "w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all";
const BUTTON_SECONDARY = "flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition-all";
const BUTTON_PRIMARY = "flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/20 transition-all";
const LIST_ITEM_BASE = "w-full text-left p-3 rounded-xl border transition-all group mb-2";
const LIST_ITEM_ACTIVE = "border-indigo-500/50 bg-indigo-500/10 ring-1 ring-indigo-500/20";
const LIST_ITEM_INACTIVE = "border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10";
const BADGE_STYLE = "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400";

const computeProjectKey = (id, name) => {
  if (id) return String(id);
  if (name) return `name:${String(name).toLowerCase()}`;
  return "";
};

const formatTimestamp = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatCompleteness = (score) => {
  if (!Number.isFinite(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score)));
};

const buildSearchHaystack = (entry) => {
  const parts = [];
  if (entry?.title) parts.push(entry.title);
  if (entry?.slug) parts.push(entry.slug);
  if (entry?.workspace?.name) parts.push(entry.workspace.name);
  if (entry?.workspace?.client) parts.push(entry.workspace.client);
  if (entry?.workspace?.projectName) parts.push(entry.workspace.projectName);
  if (entry?.workspace?.status) parts.push(entry.workspace.status);
  if (Array.isArray(entry?.tags)) parts.push(entry.tags.join(" "));
  if (Array.isArray(entry?.structure?.missingSections)) {
    parts.push(entry.structure.missingSections.join(" "));
  }
  if (entry?.prompt?.title) parts.push(entry.prompt.title);
  if (entry?.prompt?.persona) parts.push(entry.prompt.persona);
  if (Array.isArray(entry?.prompt?.tags)) parts.push(entry.prompt.tags.join(" "));
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

// ==========================================
// COMPONENTE BASE (Semplificato)
// ==========================================
const BaseWorkspaceNavigator = ({
  entries = [],
  onSelectionChange,
  searchTerm = "",
  onSearchChange,
  onOpenPdf,
  onOpenMd,
  onRepublish,
  onShowLogs,
  onAssignWorkspace,
  onAdoptSelection,
  onRefresh,
  loading = false,
}) => {
  const [selectedEntryKey, setSelectedEntryKey] = useState(null);

  const normalizedSearchTerm = useMemo(() => (searchTerm || "").toLowerCase().trim(), [searchTerm]);

  const filteredEntries = useMemo(() => {
    if (!normalizedSearchTerm) {
      return entries;
    }
    return entries.filter((entry) => buildSearchHaystack(entry).includes(normalizedSearchTerm));
  }, [entries, normalizedSearchTerm]);

  useEffect(() => {
    if (!filteredEntries.length) {
      setSelectedEntryKey(null);
      if (typeof onSelectionChange === "function") {
        onSelectionChange({ workspaceId: "", projectId: "", projectName: "", status: "" });
      }
      return;
    }

    if (
      selectedEntryKey &&
      filteredEntries.some((entry) => {
        const key = String(entry?.id || entry?.slug || "");
        return key && key === selectedEntryKey;
      })
    ) {
      return;
    }

    const nextEntry = filteredEntries[0];
    const nextKey = String(nextEntry?.id || nextEntry?.slug || "");
    setSelectedEntryKey(nextKey || null);
    if (typeof onSelectionChange === "function") {
      if (nextEntry?.workspace) {
        onSelectionChange({
          workspaceId: nextEntry.workspace.id || "",
          projectId: nextEntry.workspace.projectId || "",
          projectName: nextEntry.workspace.projectName || "",
          status: nextEntry.workspace.status || "",
        });
      } else {
        onSelectionChange({ workspaceId: "", projectId: "", projectName: "", status: "" });
      }
    }
  }, [filteredEntries, onSelectionChange, selectedEntryKey]);

  const selectedEntry = useMemo(() => {
    if (!filteredEntries.length) return null;
    if (!selectedEntryKey) return filteredEntries[0];
    return (
      filteredEntries.find((entry) => {
        const key = String(entry?.id || entry?.slug || "");
        return key && key === selectedEntryKey;
      }) || filteredEntries[0]
    );
  }, [filteredEntries, selectedEntryKey]);

  const handleSelect = useCallback(
    (entry) => {
      const entryKey = String(entry?.id || entry?.slug || "");
      setSelectedEntryKey(entryKey || null);
      if (typeof onSelectionChange === "function") {
        if (entry?.workspace) {
          onSelectionChange({
            workspaceId: entry.workspace.id || "",
            projectId: entry.workspace.projectId || "",
            projectName: entry.workspace.projectName || "",
            status: entry.workspace.status || "",
          });
        } else {
          onSelectionChange({ workspaceId: "", projectId: "", projectName: "", status: "" });
        }
      }
    },
    [onSelectionChange]
  );

  const entryTitle = selectedEntry?.title || selectedEntry?.slug || "Documento";
  const workspace = selectedEntry?.workspace || null;
  const prompt = selectedEntry?.prompt || null;
  const updatedAt = selectedEntry?.timestamp || selectedEntry?.updatedAt;

  const handlePdfOpen = useCallback(() => {
    if (selectedEntry && typeof onOpenPdf === "function") {
      onOpenPdf(selectedEntry);
    }
  }, [onOpenPdf, selectedEntry]);

  const handleMdOpen = useCallback(() => {
    if (selectedEntry && typeof onOpenMd === "function") {
      onOpenMd(selectedEntry);
    }
  }, [onOpenMd, selectedEntry]);

  const handleRepublishEntry = useCallback(() => {
    if (selectedEntry && typeof onRepublish === "function") {
      onRepublish(selectedEntry);
    }
  }, [onRepublish, selectedEntry]);

  const handleShowLogs = useCallback(() => {
    if (selectedEntry && typeof onShowLogs === "function") {
      onShowLogs(selectedEntry);
    }
  }, [onShowLogs, selectedEntry]);

  const handleAssignWorkspaceClick = useCallback(() => {
    if (selectedEntry && typeof onAssignWorkspace === "function") {
      onAssignWorkspace(selectedEntry);
    }
  }, [onAssignWorkspace, selectedEntry]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(300px,1fr)_1.5fr] h-[calc(100vh-180px)]">
      <div className="flex flex-col gap-4 h-full">
        <div className="relative">
            <FilterIcon className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
            <input
                type="search"
                value={searchTerm}
                onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                placeholder="Cerca documenti..."
                className={INPUT_STYLE + " pl-10"}
            />
        </div>

        <div className={classNames(CARD_STYLE, "flex-1 overflow-hidden flex flex-col p-0")}>
            <div className={PANEL_HEADER}>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    {filteredEntries.length} Risultati
                </span>
                {typeof onRefresh === "function" && (
                    <button onClick={onRefresh} className="text-zinc-500 hover:text-white transition">
                        <RefreshCw className={classNames("h-3.5 w-3.5", loading && "animate-spin")} />
                    </button>
                )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {loading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={`base-skeleton-${index}`} className="h-20 w-full rounded-xl bg-white/5 mb-2" />
                    ))
                ) : filteredEntries.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-2">
                        <Folder className="h-8 w-8 opacity-20" />
                        <p className="text-xs">Nessun documento trovato</p>
                    </div>
                ) : (
                    filteredEntries.map((entry, index) => {
                        const entryKey = String(entry?.id || entry?.slug || `entry-${index}`);
                        const isActive = (selectedEntry?.id || selectedEntry?.slug || "") === (entry?.id || entry?.slug || "");
                        const workspaceName = entry?.workspace?.name || entry?.workspace?.client || "Workspace";
                        
                        return (
                            <button
                                key={entryKey}
                                onClick={() => handleSelect(entry)}
                                className={classNames(LIST_ITEM_BASE, isActive ? LIST_ITEM_ACTIVE : LIST_ITEM_INACTIVE)}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={classNames("font-semibold text-sm truncate pr-2", isActive ? "text-white" : "text-zinc-300")}>
                                        {entry.title || entry.slug || "Senza titolo"}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                                        {new Date(entry.timestamp || entry.updatedAt || Date.now()).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                                    <span className="flex items-center gap-1">
                                        <Folder className="h-3 w-3" />
                                        {workspaceName}
                                    </span>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
      </div>

      <div className={classNames(CARD_STYLE, "flex flex-col h-full overflow-hidden relative")}>
         {selectedEntry ? (
             <>
                <div className="flex items-start justify-between border-b border-white/5 p-5 pb-4">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-1">{entryTitle}</h2>
                        <div className="flex items-center gap-3 text-xs text-zinc-400">
                            <span className="bg-white/5 px-2 py-0.5 rounded text-zinc-300 border border-white/5">
                                {selectedEntry.identifier || selectedEntry.id}
                            </span>
                            <span>{prompt?.title || "Prompt Base"}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {selectedEntry?.pdfPath && (
                            <button onClick={handlePdfOpen} className={BUTTON_PRIMARY}>
                                <Download className="h-3.5 w-3.5" /> PDF
                            </button>
                        )}
                        {selectedEntry?.mdPath && (
                            <button onClick={handleMdOpen} className={BUTTON_SECONDARY}>
                                <FileText className="h-3.5 w-3.5" /> Editor
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                    <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-2">
                            <Sparkles className="h-3.5 w-3.5" /> Analisi AI
                        </h4>
                        <p className="text-sm text-zinc-300 leading-relaxed">
                            {selectedEntry.summary || "Nessun sommario disponibile per questo documento."}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-black/20 border border-white/5">
                            <span className="block text-[10px] uppercase text-zinc-500 mb-1">Workspace</span>
                            <span className="text-sm text-zinc-200">{workspace?.name || "-"}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-black/20 border border-white/5">
                            <span className="block text-[10px] uppercase text-zinc-500 mb-1">Progetto</span>
                            <span className="text-sm text-zinc-200">{workspace?.projectName || "-"}</span>
                        </div>
                    </div>

                    {Array.isArray(selectedEntry?.tags) && selectedEntry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {selectedEntry.tags.map((tag, i) => (
                                <span key={i} className="px-2 py-1 rounded-md bg-white/5 text-[10px] text-zinc-400 border border-white/5">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-auto p-4 border-t border-white/5 flex justify-end gap-2 bg-[#18181b]">
                    {typeof onRepublish === "function" && (
                        <button onClick={handleRepublishEntry} className={BUTTON_SECONDARY}>
                            <RefreshCw className="h-3.5 w-3.5" /> Rigenera
                        </button>
                    )}
                    {typeof onAssignWorkspace === "function" && (
                        <button onClick={handleAssignWorkspaceClick} className={BUTTON_SECONDARY}>
                            <Plus className="h-3.5 w-3.5" /> Assegna
                        </button>
                    )}
                    {typeof onAdoptSelection === "function" && (
                        <button onClick={onAdoptSelection} className={BUTTON_SECONDARY}>
                            <LinkIcon className="h-3.5 w-3.5" /> Usa nel form
                        </button>
                    )}
                     {typeof onShowLogs === "function" && (
                        <button onClick={handleShowLogs} className={BUTTON_SECONDARY}>
                            <FileText className="h-3.5 w-3.5" /> Log
                        </button>
                    )}
                </div>
             </>
         ) : (
             <EmptyState title="Seleziona un documento" description="Scegli un file dalla lista per vedere i dettagli." />
         )}
      </div>
    </div>
  );
};

// ==========================================
// COMPONENTE AVANZATO (Logica Completa)
// ==========================================
const AdvancedWorkspaceNavigator = ({
  entries = [],
  workspaces = [],
  selection,
  onSelectionChange,
  savedFilters = [],
  onSaveFilter,
  onDeleteFilter,
  onApplyFilter,
  searchTerm = "",
  onSearchChange,
  fetchPreview,
  fetchPreAnalysis,
  onOpenPdf,
  onOpenMd,
  onRepublish,
  onShowLogs,
  onAssignWorkspace,
  loading = false,
  onRefresh,
  pipelineSelection,
  onAdoptSelection,
}) => {
  const normalizedSelection = selection || {
    workspaceId: "",
    projectId: "",
    projectName: "",
    status: "",
  };
  const [filterName, setFilterName] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [previewState, setPreviewState] = useState({
    loading: false,
    markdown: "",
    error: "",
    mdUrl: "",
    pdfUrl: "",
  });
  const [preAnalysisState, setPreAnalysisState] = useState({
    loading: false,
    error: "",
    result: null,
  });
  const [assigning, setAssigning] = useState(false);
  const previewCache = useRef(new Map());
  const preAnalysisCache = useRef(new Map());
  
  // Pannelli collassabili
  const [expandedPanels, setExpandedPanels] = useState(() => ({
    navigator: Boolean(normalizedSelection.workspaceId),
    filters: Boolean((searchTerm || "").trim()) || savedFilters.length > 0,
    documents: true,
    inspector: false,
  }));

  const togglePanel = (panelKey) => {
    setExpandedPanels((prev) => ({ ...prev, [panelKey]: !prev[panelKey] }));
  };

  // Auto-expand logic
  useEffect(() => {
    if (!normalizedSelection.workspaceId) return;
    setExpandedPanels((prev) => (prev.navigator ? prev : { ...prev, navigator: true }));
  }, [normalizedSelection.workspaceId]);

  useEffect(() => {
    if (!(searchTerm || "").trim()) return;
    setExpandedPanels((prev) => (prev.filters ? prev : { ...prev, filters: true }));
  }, [searchTerm]);

  // --- LOGICA DI RAGGRUPPAMENTO (Il cuore della modalità avanzata) ---
  const entryGroups = useMemo(() => {
    const groups = new Map();
    entries.forEach((entry) => {
      const workspaceId = entry?.workspace?.id || UNASSIGNED_KEY;
      if (!groups.has(workspaceId)) {
        groups.set(workspaceId, {
          entries: [],
          projects: new Map(),
          statuses: new Map(),
        });
      }
      const group = groups.get(workspaceId);
      group.entries.push(entry);

      const projectKey = computeProjectKey(entry?.workspace?.projectId, entry?.workspace?.projectName);
      if (projectKey) {
        if (!group.projects.has(projectKey)) {
          group.projects.set(projectKey, {
            key: projectKey,
            id: entry?.workspace?.projectId || "",
            name: entry?.workspace?.projectName || entry?.workspace?.projectId || "Progetto",
            color: entry?.workspace?.projectColor || entry?.workspace?.color || "#6366f1",
            count: 0,
            statuses: new Set(),
          });
        }
        const projectMeta = group.projects.get(projectKey);
        projectMeta.count += 1;
        if (entry?.workspace?.status) {
          projectMeta.statuses.add(entry.workspace.status);
        }
      }

      if (entry?.workspace?.status) {
        const label = entry.workspace.status;
        const key = label.toLowerCase();
        const current = group.statuses.get(key) || { label, count: 0 };
        group.statuses.set(key, { label: current.label || label, count: current.count + 1 });
      }
    });
    return groups;
  }, [entries]);

  const workspaceCatalog = useMemo(() => {
    const map = new Map();
    workspaces.forEach((workspace) => {
      const group = entryGroups.get(workspace.id);
      map.set(workspace.id, {
        id: workspace.id,
        name: workspace.name || workspace.client || "Workspace",
        client: workspace.client || workspace.name || "",
        color: workspace.color || "#6366f1",
        versioningPolicy: workspace.versioningPolicy || null,
        defaultStatuses:
          Array.isArray(workspace.defaultStatuses) && workspace.defaultStatuses.length
            ? workspace.defaultStatuses
            : DEFAULT_STATUSES,
        projects: Array.isArray(workspace.projects)
          ? workspace.projects.map((project) => {
              const key = computeProjectKey(project.id, project.name);
              const groupProject = group?.projects?.get(key);
              return {
                id: project.id || "",
                key,
                name: project.name || project.id || "Progetto",
                color: project.color || workspace.color || "#6366f1",
                statuses: Array.isArray(project.statuses) ? project.statuses : [],
                count: groupProject?.count || 0,
              };
            })
          : [],
        count: group?.entries?.length || 0,
        lastUpdated: workspace.updatedAt || null,
      });
    });

    entries.forEach((entry) => {
      const ws = entry?.workspace;
      if (!ws?.id) return;
      if (!map.has(ws.id)) {
        const group = entryGroups.get(ws.id);
        map.set(ws.id, {
          id: ws.id,
          name: ws.name || ws.client || "Workspace",
          client: ws.client || ws.name || "",
          color: ws.color || "#6366f1",
          versioningPolicy: ws.versioningPolicy || null,
          defaultStatuses:
            Array.isArray(ws.statusCatalog) && ws.statusCatalog.length ? ws.statusCatalog : DEFAULT_STATUSES,
          projects: group
            ? Array.from(group.projects.values()).map((project) => ({
                id: project.id || "",
                key: project.key,
                name: project.name,
                color: project.color,
                statuses: Array.from(project.statuses),
                count: project.count,
              }))
            : [],
          count: group?.entries?.length || 0,
          lastUpdated: entry.timestamp || null,
        });
      }
    });

    const list = Array.from(map.values());
    const unassignedCount = entryGroups.get(UNASSIGNED_KEY)?.entries.length || 0;
    if (unassignedCount || normalizedSelection.workspaceId === UNASSIGNED_KEY) {
      list.push({
        id: UNASSIGNED_KEY,
        name: "Non assegnati",
        client: "",
        color: "#52525b",
        versioningPolicy: null,
        defaultStatuses: DEFAULT_STATUSES,
        projects: [],
        count: unassignedCount,
        lastUpdated: null,
      });
    }

    return list.sort((a, b) => a.name.localeCompare(b.name, "it", { sensitivity: "base" }));
  }, [workspaces, entries, entryGroups, normalizedSelection.workspaceId]);

  const selectedWorkspace = useMemo(
    () => workspaceCatalog.find((workspace) => workspace.id === normalizedSelection.workspaceId) || null,
    [workspaceCatalog, normalizedSelection.workspaceId]
  );

  const projectCatalog = useMemo(() => {
    if (!normalizedSelection.workspaceId || normalizedSelection.workspaceId === UNASSIGNED_KEY) {
      return [];
    }
    const baseProjects = selectedWorkspace?.projects ? [...selectedWorkspace.projects] : [];
    const group = entryGroups.get(normalizedSelection.workspaceId);
    if (group) {
      group.projects.forEach((project) => {
        if (!baseProjects.some((item) => item.key === project.key)) {
          baseProjects.push({
            id: project.id || "",
            key: project.key,
            name: project.name,
            color: project.color,
            statuses: Array.from(project.statuses),
            count: project.count,
          });
        } else {
          baseProjects.forEach((item) => {
            if (item.key === project.key) {
              item.count = project.count;
            }
          });
        }
      });
    }
    return baseProjects.sort((a, b) => a.name.localeCompare(b.name, "it", { sensitivity: "base" }));
  }, [normalizedSelection.workspaceId, selectedWorkspace, entryGroups]);

  const activeProject = useMemo(() => {
    if (!normalizedSelection.projectId) return null;
    return projectCatalog.find((item) => item.key === normalizedSelection.projectId) || null;
  }, [projectCatalog, normalizedSelection.projectId]);

  const statusCatalog = useMemo(() => {
    if (!normalizedSelection.workspaceId) return [];
    if (normalizedSelection.workspaceId === UNASSIGNED_KEY) {
      const group = entryGroups.get(UNASSIGNED_KEY);
      if (!group) return [];
      return Array.from(group.statuses.values()).sort((a, b) =>
        a.label.localeCompare(b.label, "it", { sensitivity: "base" })
      );
    }
    const map = new Map();
    const defaults = selectedWorkspace?.defaultStatuses || DEFAULT_STATUSES;
    defaults.forEach((status) => {
      if (!status) return;
      const key = status.toLowerCase();
      map.set(key, { label: status, count: 0 });
    });
    const group = entryGroups.get(normalizedSelection.workspaceId);
    if (group) {
      group.statuses.forEach((status) => {
        const key = status.label.toLowerCase();
        map.set(key, { label: status.label, count: status.count });
      });
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "it", { sensitivity: "base" }));
  }, [normalizedSelection.workspaceId, selectedWorkspace, entryGroups]);

  const filteredEntries = useMemo(() => {
    const query = (searchTerm || "").trim().toLowerCase();
    return entries
      .filter((entry) => {
        const entryWorkspaceId = entry?.workspace?.id || UNASSIGNED_KEY;
        if (normalizedSelection.workspaceId) {
          if (normalizedSelection.workspaceId === UNASSIGNED_KEY) {
            if (entryWorkspaceId !== UNASSIGNED_KEY) return false;
          } else if (entryWorkspaceId !== normalizedSelection.workspaceId) {
            return false;
          }
        }
        if (normalizedSelection.projectId) {
          const entryProjectKey = computeProjectKey(
            entry?.workspace?.projectId,
            entry?.workspace?.projectName
          );
          if (entryProjectKey !== normalizedSelection.projectId) {
            return false;
          }
        }
        if (normalizedSelection.status) {
          if ((entry?.workspace?.status || "") !== normalizedSelection.status) {
            return false;
          }
        }
        if (!query) return true;
        return buildSearchHaystack(entry).includes(query);
      })
      .sort((a, b) => {
        const aTime = new Date(a?.timestamp || 0).getTime();
        const bTime = new Date(b?.timestamp || 0).getTime();
        return Number.isNaN(bTime) - Number.isNaN(aTime) || bTime - aTime;
      });
  }, [entries, normalizedSelection.workspaceId, normalizedSelection.projectId, normalizedSelection.status, searchTerm]);

  const selectedEntry = useMemo(() => {
    if (!filteredEntries.length) return null;
    if (selectedEntryId && filteredEntries.some((entry) => entry.id === selectedEntryId)) {
      return filteredEntries.find((entry) => entry.id === selectedEntryId) || null;
    }
    return filteredEntries[0];
  }, [filteredEntries, selectedEntryId]);

  // --- EFFETTI DI SELEZIONE ---
  useEffect(() => {
    if (!filteredEntries.length) {
      setSelectedEntryId(null);
      setPreviewState({ loading: false, markdown: "", error: "", mdUrl: "", pdfUrl: "" });
      return;
    }
    if (!selectedEntryId || !filteredEntries.some((entry) => entry.id === selectedEntryId)) {
      setSelectedEntryId(filteredEntries[0].id);
    }
  }, [filteredEntries, selectedEntryId]);

  useEffect(() => {
    setExpandedPanels((prev) => {
      if (selectedEntry && !prev.inspector) {
        return { ...prev, inspector: true };
      }
      if (!selectedEntry && prev.inspector) {
        return { ...prev, inspector: false };
      }
      return prev;
    });
  }, [selectedEntry]);

  // --- PREVIEW FETCHING ---
  useEffect(() => {
    if (!selectedEntry || !fetchPreview) {
      setPreviewState((prev) => ({ ...prev, loading: false, error: "", markdown: "", mdUrl: "", pdfUrl: "" }));
      return;
    }
    const cacheKey = selectedEntry.id;
    if (previewCache.current.has(cacheKey)) {
      const payload = previewCache.current.get(cacheKey);
      setPreviewState({ loading: false, error: "", ...payload });
      return;
    }
    let active = true;
    setPreviewState((prev) => ({ ...prev, loading: true, error: "", markdown: "", mdUrl: "", pdfUrl: "" }));
    Promise.resolve(fetchPreview(selectedEntry))
      .then((result) => {
        if (!active) return;
        if (result?.ok) {
          const payload = {
            markdown: result.markdown || "",
            mdUrl: result.mdUrl || "",
            pdfUrl: result.pdfUrl || "",
          };
          previewCache.current.set(cacheKey, payload);
          setPreviewState({ loading: false, error: "", ...payload });
        } else {
          setPreviewState({
            loading: false,
            markdown: "",
            mdUrl: "",
            pdfUrl: "",
            error: result?.message || "Anteprima non disponibile.",
          });
        }
      })
      .catch((error) => {
        if (!active) return;
        setPreviewState({
          loading: false,
          markdown: "",
          mdUrl: "",
          pdfUrl: "",
          error: error?.message || "Errore durante il recupero dell'anteprima.",
        });
      });
    return () => {
      active = false;
    };
  }, [selectedEntry, fetchPreview]);

  // --- PRE-ANALYSIS FETCHING ---
  useEffect(() => {
    if (!selectedEntry || typeof fetchPreAnalysis !== "function") {
      setPreAnalysisState((prev) => ({ ...prev, loading: false, error: "", result: null }));
      return;
    }
    const cacheKey = selectedEntry.id;
    if (preAnalysisCache.current.has(cacheKey)) {
      const cached = preAnalysisCache.current.get(cacheKey);
      setPreAnalysisState({ loading: false, error: "", result: cached });
      return;
    }
    let active = true;
    setPreAnalysisState({ loading: true, error: "", result: null });
    Promise.resolve(fetchPreAnalysis(selectedEntry))
      .then((response) => {
        if (!active) return;
        if (response?.ok) {
          const payload = response?.data && typeof response.data === "object" ? response.data : null;
          preAnalysisCache.current.set(cacheKey, payload);
          setPreAnalysisState({ loading: false, error: "", result: payload });
        } else {
          const message = response?.message || 'Pre-analisi non disponibile.';
          setPreAnalysisState({ loading: false, error: message, result: null });
        }
      })
      .catch((error) => {
        if (!active) return;
        setPreAnalysisState({
          loading: false,
          error: error?.message || 'Errore durante la pre-analisi.',
          result: null,
        });
      });
    return () => {
      active = false;
    };
  }, [selectedEntry, fetchPreAnalysis]);

  // --- HANDLERS ---
  const statusLabels = useMemo(() => statusCatalog.map((status) => status.label), [statusCatalog]);

  const workspaceAssignment = useMemo(() => {
    if (!selectedWorkspace || normalizedSelection.workspaceId === UNASSIGNED_KEY) return null;
    return {
      id: selectedWorkspace.id,
      name: selectedWorkspace.name,
      client: selectedWorkspace.client,
      color: selectedWorkspace.color,
      projectId: activeProject?.id || "",
      projectName: activeProject ? activeProject.name : normalizedSelection.projectName || "",
      projectColor: activeProject?.color || selectedWorkspace.color,
      status: normalizedSelection.status || "",
      versioningPolicy: selectedWorkspace.versioningPolicy || null,
      statusCatalog: statusLabels,
    };
  }, [selectedWorkspace, normalizedSelection.workspaceId, normalizedSelection.projectName, normalizedSelection.status, activeProject, statusLabels]);

  const selectionProjectKey = normalizedSelection.projectId;

  const pipelineAligned = useMemo(() => {
    if (!pipelineSelection) return false;
    return (
      (pipelineSelection.workspaceId || "") === (normalizedSelection.workspaceId || "") &&
      (pipelineSelection.projectId || "") === (normalizedSelection.projectId || "") &&
      (pipelineSelection.status || "") === (normalizedSelection.status || "")
    );
  }, [pipelineSelection, normalizedSelection.workspaceId, normalizedSelection.projectId, normalizedSelection.status]);

  const canAssign = useMemo(() => {
    if (!selectedEntry || !workspaceAssignment) return false;
    const entryWorkspaceId = selectedEntry?.workspace?.id || "";
    if (entryWorkspaceId !== workspaceAssignment.id) return true;
    const entryProjectKey = computeProjectKey(
      selectedEntry?.workspace?.projectId,
      selectedEntry?.workspace?.projectName
    );
    if (selectionProjectKey && entryProjectKey !== selectionProjectKey) return true;
    const entryStatus = selectedEntry?.workspace?.status || "";
    if (workspaceAssignment.status && entryStatus !== workspaceAssignment.status) return true;
    if (!workspaceAssignment.status && entryStatus) return true;
    return false;
  }, [selectedEntry, workspaceAssignment, selectionProjectKey]);

  const canUnassign = useMemo(() => {
    if (!selectedEntry) return false;
    return normalizedSelection.workspaceId === UNASSIGNED_KEY && Boolean(selectedEntry.workspace?.id);
  }, [normalizedSelection.workspaceId, selectedEntry]);

  const breadcrumbs = useMemo(() => {
    const parts = [];
    if (normalizedSelection.workspaceId === UNASSIGNED_KEY) {
      parts.push({ label: "Non assegnati", color: "#52525b" });
      return parts;
    }
    if (selectedWorkspace) {
      parts.push({ label: selectedWorkspace.name, color: selectedWorkspace.color, client: selectedWorkspace.client });
    }
    if (selectionProjectKey) {
      if (activeProject) {
        parts.push({ label: activeProject.name, color: activeProject.color });
      } else if (normalizedSelection.projectName) {
        parts.push({ label: normalizedSelection.projectName, color: selectedWorkspace?.color || "#6366f1" });
      }
    }
    if (normalizedSelection.status) {
      parts.push({ label: normalizedSelection.status, color: "#a855f7" });
    }
    if (!parts.length) {
      parts.push({ label: "Tutti i workspace", color: "#6366f1" });
    }
    return parts;
  }, [normalizedSelection.workspaceId, normalizedSelection.projectName, normalizedSelection.status, selectedWorkspace, selectionProjectKey, activeProject]);

  const handleWorkspaceReset = useCallback(() => {
    onSelectionChange?.({ workspaceId: "", projectId: "", projectName: "", status: "" });
  }, [onSelectionChange]);

  const handleWorkspaceSelect = useCallback(
    (workspaceId) => {
      if (workspaceId === normalizedSelection.workspaceId) return;
      onSelectionChange?.({ workspaceId, projectId: "", projectName: "", status: "" });
    },
    [normalizedSelection.workspaceId, onSelectionChange]
  );

  const handleProjectSelect = useCallback(
    (project) => {
      if (!normalizedSelection.workspaceId || normalizedSelection.workspaceId === UNASSIGNED_KEY) return;
      const candidateStatuses = project?.statuses?.length
        ? project.statuses
        : statusCatalog.map((status) => status.label);
      const fallbackStatuses = candidateStatuses.length ? candidateStatuses : DEFAULT_STATUSES;
      const nextStatus =
        normalizedSelection.status && fallbackStatuses.includes(normalizedSelection.status)
          ? normalizedSelection.status
          : fallbackStatuses[0] || "";
      onSelectionChange?.({
        workspaceId: normalizedSelection.workspaceId,
        projectId: project?.key || "",
        projectName: project?.id ? "" : project?.name || "",
        status: nextStatus,
      });
    },
    [normalizedSelection.workspaceId, normalizedSelection.status, onSelectionChange, statusCatalog]
  );

  const handleStatusSelect = useCallback(
    (statusLabel) => {
      onSelectionChange?.({
        workspaceId: normalizedSelection.workspaceId,
        projectId: normalizedSelection.projectId,
        projectName: normalizedSelection.projectName,
        status: statusLabel,
      });
    },
    [normalizedSelection.workspaceId, normalizedSelection.projectId, normalizedSelection.projectName, onSelectionChange]
  );

  const handleFilterSave = useCallback(() => {
    if (!onSaveFilter) return;
    onSaveFilter({
      name: filterName,
      workspaceId: normalizedSelection.workspaceId,
      projectId: normalizedSelection.projectId,
      projectName: normalizedSelection.projectName,
      status: normalizedSelection.status,
      search: searchTerm,
    });
    setFilterName("");
  }, [filterName, normalizedSelection.workspaceId, normalizedSelection.projectId, normalizedSelection.projectName, normalizedSelection.status, onSaveFilter, searchTerm]);

  const handleAssign = useCallback(() => {
    if (!selectedEntry || !workspaceAssignment || !onAssignWorkspace) return;
    setAssigning(true);
    Promise.resolve(onAssignWorkspace(selectedEntry, workspaceAssignment, { ensureMetadata: true }))
      .catch(() => null)
      .finally(() => setAssigning(false));
  }, [onAssignWorkspace, selectedEntry, workspaceAssignment]);

  const handleUnassign = useCallback(() => {
    if (!selectedEntry || !onAssignWorkspace) return;
    setAssigning(true);
    Promise.resolve(onAssignWorkspace(selectedEntry, null, { ensureMetadata: false }))
      .catch(() => null)
      .finally(() => setAssigning(false));
  }, [onAssignWorkspace, selectedEntry]);

  const workspaceBadgeColor = useMemo(() => {
    if (normalizedSelection.workspaceId === UNASSIGNED_KEY) return "#52525b";
    if (selectedWorkspace?.color) return selectedWorkspace.color;
    return "#6366f1";
  }, [normalizedSelection.workspaceId, selectedWorkspace]);

  const workspaceBadgeLabel = useMemo(() => {
    if (normalizedSelection.workspaceId === UNASSIGNED_KEY) return "Non assegnati";
    if (selectedWorkspace) return selectedWorkspace.name;
    if (normalizedSelection.workspaceId) return "Workspace selezionato";
    return "Tutti i workspace";
  }, [normalizedSelection.workspaceId, selectedWorkspace]);

  const projectBadgeLabel = useMemo(() => {
    if (!normalizedSelection.projectId) return null;
    return activeProject?.name || normalizedSelection.projectName || "Progetto selezionato";
  }, [normalizedSelection.projectId, normalizedSelection.projectName, activeProject]);

  const statusBadgeLabel = useMemo(() => normalizedSelection.status || null, [normalizedSelection.status]);

  const documentsCountLabel = useMemo(() => {
    const count = filteredEntries.length;
    if (count === 1) return "1 documento";
    return `${count} documenti`;
  }, [filteredEntries.length]);

  const searchActive = useMemo(() => Boolean((searchTerm || "").trim()), [searchTerm]);

  // ==========================================
  // RENDERIZZAZIONE AVANZATA (Layout Boardroom)
  // ==========================================
  return (
    <div className={classNames("overflow-hidden rounded-3xl border border-white/10 shadow-lg", CARD_STYLE)}>
      
      {/* HEADER PRINCIPALE */}
      <div className="flex flex-col gap-4 border-b border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-indigo-200">
            <Users className="h-4 w-4" /> Workspace Navigator
          </div>
          <p className="text-sm text-zinc-400">
            Gestione avanzata dei documenti con filtri per workspace, progetti e stati.
          </p>
        </div>
        
        {/* TOOLBAR AZIONI */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => togglePanel("navigator")}
              className={classNames(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition",
                expandedPanels.navigator
                  ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-100"
                  : "border-zinc-700 bg-transparent text-zinc-300 hover:border-indigo-400/50 hover:text-indigo-100"
              )}
            >
              <Users className="h-3.5 w-3.5" />
              {expandedPanels.navigator ? "Nascondi Albero" : "Mostra Albero"}
            </button>
            <button
              type="button"
              onClick={() => togglePanel("filters")}
              className={classNames(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition",
                expandedPanels.filters
                  ? "border-zinc-600 bg-zinc-800/70 text-zinc-100"
                  : "border-zinc-700 bg-transparent text-zinc-300 hover:border-indigo-400/50 hover:text-indigo-100"
              )}
            >
              <FilterIcon className="h-3.5 w-3.5" />
              {expandedPanels.filters ? "Nascondi Filtri" : "Filtri"}
            </button>
            <button
              type="button"
              onClick={() => togglePanel("documents")}
              className={classNames(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition",
                expandedPanels.documents
                  ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-100"
                  : "border-zinc-700 bg-transparent text-zinc-300 hover:border-indigo-400/50 hover:text-indigo-100"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              Documenti
            </button>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {typeof onRefresh === "function" && (
                <button onClick={onRefresh} className={BUTTON_SECONDARY}>
                    <RefreshCw className={classNames("h-3.5 w-3.5", loading && "animate-spin")} /> Aggiorna
                </button>
            )}
            {typeof onAdoptSelection === "function" && (
                <button onClick={onAdoptSelection} className={classNames(BUTTON_SECONDARY, pipelineAligned && "ring-2 ring-emerald-400/70")}>
                    <Sparkles className="h-3.5 w-3.5" /> Usa nel form
                </button>
            )}
          </div>
        </div>

        {/* BREADCRUMBS & BADGES */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span
            className="inline-flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-900/60 px-3 py-1"
            style={{ borderColor: workspaceBadgeColor }}
          >
            <span className="flex items-center gap-1 text-zinc-300">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: workspaceBadgeColor }} />
              {workspaceBadgeLabel}
            </span>
          </span>
          {projectBadgeLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-indigo-100">
              <Folder className="h-3 w-3" /> {projectBadgeLabel}
            </span>
          )}
          {statusBadgeLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-100">
              <Sparkles className="h-3 w-3" /> {statusBadgeLabel}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700/60 bg-zinc-900/60 px-3 py-1">
            <FileText className="h-3 w-3" /> {documentsCountLabel}
          </span>
        </div>
      </div>

      {/* PANNELLO FILTRI */}
      {expandedPanels.filters && (
        <div className="space-y-4 border-b border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1 min-w-[220px]">
              <FilterIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                value={searchTerm}
                onChange={(event) => onSearchChange?.(event.target.value)}
                placeholder="Cerca per titolo, cliente, progetto o stato..."
                className={classNames(INPUT_STYLE, "pl-9")}
              />
              {searchTerm && (
                <button
                  onClick={() => onSearchChange?.("")}
                  className="absolute right-2 top-2 rounded-lg px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  X
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={filterName}
                onChange={(event) => setFilterName(event.target.value)}
                placeholder="Nome filtro..."
                className={classNames(INPUT_STYLE, "w-40")}
              />
              <button onClick={handleFilterSave} className={BUTTON_SECONDARY}>
                <Bookmark className="h-3.5 w-3.5" /> Salva
              </button>
            </div>
          </div>

          {savedFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {savedFilters.map((filter) => (
                <span
                  key={filter.id}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-900/60 px-3 py-1"
                >
                  <button
                    onClick={() => onApplyFilter?.(filter)}
                    className="flex items-center gap-1 text-zinc-300 hover:text-white"
                  >
                    <LinkIcon className="h-3.5 w-3.5" /> {filter.name}
                  </button>
                  <button
                    onClick={() => onDeleteFilter?.(filter.id)}
                    className="text-zinc-500 hover:text-zinc-200 ml-1"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CORPO PRINCIPALE: NAVIGATOR + DOCUMENTI */}
      {expandedPanels.navigator && (
        <div className="border-b border-white/10 bg-white/[0.025] p-6 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between text-xs text-zinc-400">
            <span>ALBERO WORKSPACE</span>
            <button onClick={handleWorkspaceReset} className="text-zinc-500 hover:text-zinc-200">
              Mostra tutti
            </button>
          </div>
          
          <div className="grid gap-6 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
            
            {/* COLONNA SINISTRA: ALBERO */}
            <div className="space-y-4">
                {/* Lista Workspace */}
                <div className="max-h-[300px] space-y-2 overflow-auto pr-1 custom-scrollbar">
                {workspaceCatalog.map((workspace) => {
                    const isActive = workspace.id === normalizedSelection.workspaceId;
                    return (
                    <button
                        type="button"
                        key={workspace.id}
                        onClick={() => handleWorkspaceSelect(workspace.id)}
                        className={classNames(
                        "w-full rounded-xl border px-3 py-2 text-left text-sm transition",
                        isActive ? "border-indigo-500/50 bg-indigo-500/10 text-white ring-1 ring-indigo-500/20" : "border-white/5 bg-white/[0.02] text-zinc-400 hover:bg-white/[0.05]"
                        )}
                    >
                        <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: workspace.color }} />
                            <div>
                            <div className="font-medium">{workspace.name}</div>
                            {workspace.client && <div className="text-[10px] text-zinc-500">{workspace.client}</div>}
                            </div>
                        </div>
                        <div className="text-[10px] text-zinc-600">{workspace.count}</div>
                        </div>
                    </button>
                    );
                })}
                </div>

                {/* Lista Progetti (Visibile se Workspace selezionato) */}
                {normalizedSelection.workspaceId && normalizedSelection.workspaceId !== UNASSIGNED_KEY && (
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                            <span className="font-bold uppercase tracking-wider">Progetti</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                             <button
                                onClick={() => handleProjectSelect({ key: "", name: "", id: "", statuses: [] })}
                                className={classNames(
                                    "rounded-lg border px-2 py-1 text-[10px]",
                                    !normalizedSelection.projectId ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-200" : "border-white/5 bg-white/[0.02] text-zinc-500"
                                )}
                                >
                                Tutti
                            </button>
                            {projectCatalog.map((project) => {
                                const isActive = project.key === normalizedSelection.projectId;
                                return (
                                    <button
                                    type="button"
                                    key={project.key}
                                    onClick={() => handleProjectSelect(project)}
                                    className={classNames(
                                        "rounded-lg border px-2 py-1 text-[10px] transition",
                                        isActive ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-200" : "border-white/5 bg-white/[0.02] text-zinc-400 hover:text-zinc-200"
                                    )}
                                    >
                                    {project.name} <span className="opacity-50">({project.count})</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Lista Stati */}
                {normalizedSelection.workspaceId && (
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                             <span className="font-bold uppercase tracking-wider">Stato</span>
                             {normalizedSelection.status && (
                                <button onClick={() => handleStatusSelect("")} className="text-[10px] text-zinc-500 hover:text-zinc-300">
                                Reset
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {statusCatalog.map((status) => {
                                const isActive = status.label === normalizedSelection.status;
                                return (
                                <button
                                    type="button"
                                    key={status.label}
                                    onClick={() => handleStatusSelect(status.label)}
                                    className={classNames(
                                    "rounded-full border px-2 py-0.5 text-[10px] transition",
                                    isActive ? "border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-200" : "border-white/5 bg-white/[0.02] text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    {status.label} {status.count > 0 && <span className="opacity-50">({status.count})</span>}
                                </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* COLONNA DESTRA: DOCUMENTI & INSPECTOR */}
            <div className={classNames(
              "grid gap-4",
              expandedPanels.inspector ? "lg:grid-cols-[minmax(240px,1fr)_minmax(300px,1.2fr)]" : "lg:grid-cols-1"
            )}>
                
                {/* LISTA DOCUMENTI */}
                {expandedPanels.documents && (
                    <div className="rounded-xl border border-white/10 bg-black/20 flex flex-col overflow-hidden h-[500px]">
                        <div className="p-3 border-b border-white/5 bg-white/[0.02]">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Elenco File</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2">
                            {loading ? (
                                Array.from({ length: 4 }).map((_, index) => (
                                    <Skeleton key={`skel-${index}`} className="h-16 w-full rounded-lg bg-white/5" />
                                ))
                            ) : filteredEntries.length === 0 ? (
                                <EmptyState title="Nessun documento" description="Modifica i filtri per vedere i risultati." className="h-full border-none bg-transparent" />
                            ) : (
                                filteredEntries.map((entry) => {
                                    const isActive = selectedEntry?.id === entry.id;
                                    return (
                                        <button
                                            key={entry.id}
                                            onClick={() => setSelectedEntryId(entry.id)}
                                            className={classNames(
                                                "w-full text-left p-3 rounded-lg border transition-all",
                                                isActive ? "border-indigo-500/50 bg-indigo-500/10 text-white" : "border-white/5 bg-white/[0.02] text-zinc-400 hover:bg-white/[0.05]"
                                            )}
                                        >
                                            <div className="flex justify-between items-start">
                                                <span className="font-medium text-sm truncate pr-2">{entry.title || entry.slug}</span>
                                                <span className="text-[10px] opacity-50 shrink-0">{formatTimestamp(entry.timestamp)}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 text-[10px] opacity-60">
                                                <Folder className="h-3 w-3" />
                                                {entry.workspace?.name || "No Workspace"}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* INSPECTOR (DETTAGLI) */}
                {expandedPanels.inspector && (
                    <div className="rounded-xl border border-white/10 bg-[#18181b] flex flex-col h-[500px]">
                        {selectedEntry ? (
                            <>
                                <div className="p-5 border-b border-white/10">
                                    <h3 className="text-lg font-bold text-white leading-tight mb-1">{selectedEntry.title || "Senza Titolo"}</h3>
                                    <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                                        <span>ID: {selectedEntry.id}</span>
                                    </div>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                                    {/* AI Summary */}
                                    <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2 flex items-center gap-2">
                                            <Sparkles className="h-3.5 w-3.5" /> Analisi AI
                                        </h4>
                                        <p className="text-sm text-zinc-300 leading-relaxed">
                                            {selectedEntry.summary || "Nessun sommario disponibile."}
                                        </p>
                                    </div>

                                    {/* Metadati */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 rounded-lg bg-black/20 border border-white/5">
                                            <span className="block text-[10px] uppercase text-zinc-500 mb-1">Workspace</span>
                                            <span className="text-sm text-zinc-200">{workspace?.name || "-"}</span>
                                        </div>
                                        <div className="p-3 rounded-lg bg-black/20 border border-white/5">
                                            <span className="block text-[10px] uppercase text-zinc-500 mb-1">Progetto</span>
                                            <span className="text-sm text-zinc-200">{workspace?.projectName || "-"}</span>
                                        </div>
                                    </div>

                                    {/* Tags */}
                                    {Array.isArray(selectedEntry?.tags) && selectedEntry.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {selectedEntry.tags.map((tag, i) => (
                                                <span key={i} className="px-2 py-1 rounded-md bg-white/5 text-[10px] text-zinc-400 border border-white/5">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Footer Actions */}
                                <div className="p-4 border-t border-white/10 bg-white/[0.02] flex flex-wrap justify-end gap-2">
                                    {selectedEntry?.pdfPath && (
                                        <button onClick={handlePdfOpen} className={BUTTON_PRIMARY}>
                                            <Download className="h-3.5 w-3.5" /> PDF
                                        </button>
                                    )}
                                    {selectedEntry?.mdPath && (
                                        <button onClick={handleMdOpen} className={BUTTON_SECONDARY}>
                                            <FileText className="h-3.5 w-3.5" /> Editor
                                        </button>
                                    )}
                                    {typeof onRepublish === "function" && (
                                        <button onClick={handleRepublishEntry} className={BUTTON_SECONDARY}>
                                            <RefreshCw className="h-3.5 w-3.5" /> Rigenera
                                        </button>
                                    )}
                                    {typeof onAssignWorkspace === "function" && (
                                        <button onClick={handleAssignWorkspaceClick} className={BUTTON_SECONDARY}>
                                            <Plus className="h-3.5 w-3.5" /> Assegna
                                        </button>
                                    )}
                                </div>
                            </>
                        ) : (
                            <EmptyState title="Seleziona un documento" description="Clicca su un file nella lista." className="h-full border-none" />
                        )}
                    </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function WorkspaceNavigator(props) {
  const appContext = useAppContext();
  const hasFeatureFlag =
    typeof appContext?.hasFeatureFlag === "function"
      ? appContext.hasFeatureFlag
      : typeof appContext?.hasModeFlag === "function"
        ? appContext.hasModeFlag
        : null;

  const canUseAdvancedNavigator =
    !hasFeatureFlag ||
    hasFeatureFlag(ADVANCED_FILTERS_FLAG) ||
    ADVANCED_MODE_FLAGS.some((flag) => {
      try {
        return hasFeatureFlag(flag);
      } catch (error) {
        return false;
      }
    });

  if (!canUseAdvancedNavigator) {
    return <BaseWorkspaceNavigator {...props} />;
  }

  return <AdvancedWorkspaceNavigator {...props} />;
}