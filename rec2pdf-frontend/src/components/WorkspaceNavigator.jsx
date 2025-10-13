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
} from "./icons";
import { EmptyState, Skeleton } from "./ui";

const DEFAULT_STATUSES = ["Bozza", "In lavorazione", "Da revisionare", "Completato"];
const UNASSIGNED_KEY = "__unassigned__";
const ADVANCED_FILTERS_FLAG = "ADVANCED_WORKSPACE_FILTERS";

const computeProjectKey = (id, name) => {
  if (id) return String(id);
  if (name) return `name:${String(name).toLowerCase()}`;
  return "";
};

const formatTimestamp = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
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

export default function WorkspaceNavigator({
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
  onOpenPdf,
  onOpenMd,
  onRepublish,
  onShowLogs,
  onAssignWorkspace,
  themeStyles = {},
  loading = false,
  onRefresh,
  pipelineSelection,
  onAdoptSelection,
}) {
  const appContext = useAppContext();
  const normalizedSelection = selection || {
    workspaceId: "",
    projectId: "",
    projectName: "",
    status: "",
  };
  const mode = appContext?.mode || "advanced";
  const hasModeFlag = appContext?.hasModeFlag;
  const isBaseMode = mode === "base";
  const advancedFiltersEnabled =
    !isBaseMode || (typeof hasModeFlag === "function" && hasModeFlag(ADVANCED_FILTERS_FLAG));
  const [filterName, setFilterName] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [previewState, setPreviewState] = useState({
    loading: false,
    markdown: "",
    error: "",
    mdUrl: "",
    pdfUrl: "",
  });
  const [assigning, setAssigning] = useState(false);
  const previewCache = useRef(new Map());
  const [expandedPanels, setExpandedPanels] = useState(() => ({
    navigator: Boolean(normalizedSelection.workspaceId),
    filters: Boolean((searchTerm || "").trim()) || savedFilters.length > 0,
    documents: true,
    inspector: false,
  }));

  const normalizedSearchTerm = useMemo(
    () => (searchTerm || "").toLowerCase().trim(),
    [searchTerm]
  );

  const baseEntries = useMemo(() => {
    if (!normalizedSearchTerm) {
      return entries;
    }
    return entries.filter((entry) => buildSearchHaystack(entry).includes(normalizedSearchTerm));
  }, [entries, normalizedSearchTerm]);

  useEffect(() => {
    if (!isBaseMode || advancedFiltersEnabled) {
      return;
    }
    if (!baseEntries.length) {
      setSelectedEntryId(null);
      return;
    }
    if (!baseEntries.some((entry) => entry && entry.id === selectedEntryId)) {
      setSelectedEntryId(baseEntries[0]?.id || null);
    }
  }, [advancedFiltersEnabled, baseEntries, isBaseMode, selectedEntryId]);

  const baseSelectedEntry = useMemo(() => {
    if (!isBaseMode || advancedFiltersEnabled) {
      return null;
    }
    if (!selectedEntryId && baseEntries.length) {
      return baseEntries[0];
    }
    return baseEntries.find((entry) => entry?.id === selectedEntryId) || null;
  }, [advancedFiltersEnabled, baseEntries, isBaseMode, selectedEntryId]);

  const togglePanel = (panelKey) => {
    setExpandedPanels((prev) => ({ ...prev, [panelKey]: !prev[panelKey] }));
  };

  useEffect(() => {
    if (!normalizedSelection.workspaceId) return;
    setExpandedPanels((prev) => (prev.navigator ? prev : { ...prev, navigator: true }));
  }, [normalizedSelection.workspaceId]);

  useEffect(() => {
    if (!(searchTerm || "").trim()) return;
    setExpandedPanels((prev) => (prev.filters ? prev : { ...prev, filters: true }));
  }, [searchTerm]);

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

  const handleBaseEntrySelect = useCallback(
    (entry) => {
      const entryId = entry?.id || null;
      setSelectedEntryId(entryId);
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

  const isBaseSimpleMode = isBaseMode && !advancedFiltersEnabled;

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

  const renderBaseView = () => {
    const workspace = baseSelectedEntry?.workspace || null;
    const prompt = baseSelectedEntry?.prompt || null;
    const entryTitle = baseSelectedEntry?.title || baseSelectedEntry?.slug || "Documento";
    const updatedAt = baseSelectedEntry?.timestamp || baseSelectedEntry?.updatedAt;
    const cardClass = classNames(
      "rounded-2xl border border-white/10 bg-white/5 p-5 text-white",
      themeStyles?.card
    );

    const handlePdfOpen = () => {
      if (baseSelectedEntry && typeof onOpenPdf === "function") {
        onOpenPdf(baseSelectedEntry);
      }
    };

    const handleMdOpen = () => {
      if (baseSelectedEntry && typeof onOpenMd === "function") {
        onOpenMd(baseSelectedEntry);
      }
    };

    const handleRepublishEntry = () => {
      if (baseSelectedEntry && typeof onRepublish === "function") {
        onRepublish(baseSelectedEntry);
      }
    };

    const handleShowLogs = () => {
      if (baseSelectedEntry && typeof onShowLogs === "function") {
        onShowLogs(baseSelectedEntry);
      }
    };

    const handleAssignWorkspaceClick = () => {
      if (baseSelectedEntry && typeof onAssignWorkspace === "function") {
        onAssignWorkspace(baseSelectedEntry);
      }
    };

    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className={cardClass}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.32em] text-white/70">Library</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {typeof onRefresh === "function" ? (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-white/70 transition hover:bg-white/10"
                >
                  <RefreshCw className={classNames("h-3.5 w-3.5", loading ? "animate-spin" : "")} />
                  Aggiorna
                </button>
              ) : null}
              {loading ? <span className="text-white/60">Sincronizzazione…</span> : null}
            </div>
          </div>

          <div className="mt-4">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => onSearchChange && onSearchChange(event.target.value)}
              placeholder="Cerca titolo, workspace, tag…"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/80 placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="mt-4 space-y-2">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={`base-skeleton-${index}`} className="h-20 w-full rounded-2xl" />
              ))
            ) : baseEntries.length === 0 ? (
              <EmptyState
                title="Nessun documento disponibile"
                description="Quando carichi o generi un PDF lo troverai qui."
                className="border-white/15 bg-black/20 text-white/70"
              />
            ) : (
              baseEntries.map((entry, index) => {
                const entryKey = entry?.id || entry?.slug || `entry-${index}`;
                const isActive = (baseSelectedEntry?.id || baseSelectedEntry?.slug) === (entry?.id || entry?.slug);
                const workspaceName = entry?.workspace?.name || entry?.workspace?.client || "Workspace";
                const summary = entry?.prompt?.title || entry?.slug || "";
                return (
                  <button
                    type="button"
                    key={entryKey}
                    onClick={() => handleBaseEntrySelect(entry)}
                    className={classNames(
                      "w-full rounded-2xl border px-4 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
                      isActive
                        ? "border-indigo-400/60 bg-indigo-500/15 text-white shadow-[0_12px_40px_-30px_rgba(129,140,248,0.9)]"
                        : "border-white/10 bg-white/5 text-white/80 hover:border-indigo-400/40 hover:bg-indigo-500/10"
                    )}
                  >
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span>{workspaceName}</span>
                      <span>{formatTimestamp(entry?.timestamp || entry?.updatedAt)}</span>
                    </div>
                    <div className="mt-1 text-base font-semibold text-white/90">
                      {entry?.title || entry?.slug || "Documento"}
                    </div>
                    {summary ? <div className="mt-1 text-xs text-white/60">{summary}</div> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className={cardClass}>
          {baseSelectedEntry ? (
            <div className="flex h-full flex-col gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-white/60">Dettagli</p>
                <h4 className="mt-2 text-lg font-semibold text-white">{entryTitle}</h4>
                <p className="text-xs text-white/60">Aggiornato {formatTimestamp(updatedAt)}</p>
              </div>

              <div className="space-y-3 text-sm text-white/80">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/50">Workspace</p>
                  <p className="mt-1 text-sm text-white/80">
                    {workspace ? workspace.name || workspace.client || workspace.id || "Workspace" : "Non assegnato"}
                  </p>
                  {workspace?.status ? (
                    <p className="text-xs text-white/60">Stato · {workspace.status}</p>
                  ) : null}
                </div>
                {prompt ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/50">Prompt</p>
                    <p className="mt-1 text-sm text-white/80">{prompt.title || prompt.slug}</p>
                  </div>
                ) : null}
                {Array.isArray(baseSelectedEntry?.tags) && baseSelectedEntry.tags.length ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/50">Tag</p>
                    <p className="mt-1 text-xs text-white/70">{baseSelectedEntry.tags.join(", ")}</p>
                  </div>
                ) : null}
              </div>

              <div className="mt-auto space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  {baseSelectedEntry?.pdfPath ? (
                    <button
                      type="button"
                      onClick={handlePdfOpen}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/20"
                    >
                      <Download className="h-4 w-4" /> Apri PDF
                    </button>
                  ) : null}
                  {baseSelectedEntry?.mdPath ? (
                    <button
                      type="button"
                      onClick={handleMdOpen}
                      className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white/80 transition hover:bg-white/20"
                    >
                      <FileText className="h-4 w-4" /> Markdown
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {typeof onRepublish === "function" ? (
                    <button
                      type="button"
                      onClick={handleRepublishEntry}
                      className="rounded-xl border border-indigo-400/40 bg-indigo-500/20 px-3 py-1.5 text-indigo-100 transition hover:bg-indigo-500/30"
                    >
                      Ripubblica
                    </button>
                  ) : null}
                  {typeof onShowLogs === "function" ? (
                    <button
                      type="button"
                      onClick={handleShowLogs}
                      className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-white/70 transition hover:bg-white/10"
                    >
                      Log
                    </button>
                  ) : null}
                  {typeof onAssignWorkspace === "function" ? (
                    <button
                      type="button"
                      onClick={handleAssignWorkspaceClick}
                      className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-white/70 transition hover:bg-white/10"
                    >
                      Riassegna workspace
                    </button>
                  ) : null}
                  {typeof onAdoptSelection === "function" ? (
                    <button
                      type="button"
                      onClick={onAdoptSelection}
                      className="rounded-xl border border-emerald-300/40 bg-emerald-500/20 px-3 py-1.5 text-emerald-100 transition hover:bg-emerald-500/30"
                    >
                      Allinea pipeline
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/60">
              Seleziona un documento a sinistra per vedere i dettagli.
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isBaseSimpleMode) {
    return renderBaseView();
  }

  return (
    <div className={classNames("overflow-hidden rounded-2xl border shadow-lg", themeStyles?.card)}>
      <div className="flex flex-col gap-4 border-b border-zinc-800/60 p-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-indigo-200">
            <Users className="h-4 w-4" /> Workspace Navigator
          </div>
          <p className="text-sm text-zinc-400">
            Mantieni la vista essenziale e apri solo le aree di lavoro che ti servono: seleziona workspace, applica filtri e analizza i deliverable quando vuoi.
          </p>
        </div>
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
              {expandedPanels.navigator ? "Compatta navigator" : "Apri navigator"}
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
              {expandedPanels.filters ? "Nascondi filtri" : "Filtri rapidi"}
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
              {expandedPanels.documents ? "Riduci documenti" : "Documenti"}
            </button>
            <button
              type="button"
              onClick={() => togglePanel("inspector")}
              className={classNames(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition",
                expandedPanels.inspector
                  ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-100"
                  : "border-zinc-700 bg-transparent text-zinc-300 hover:border-indigo-400/50 hover:text-indigo-100",
                !selectedEntry && "pointer-events-none opacity-40"
              )}
              disabled={!selectedEntry}
            >
              <Folder className="h-3.5 w-3.5" />
              {expandedPanels.inspector ? "Chiudi dettagli" : "Dettagli documento"}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onRefresh}
              className={classNames(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
                themeStyles?.input,
                themeStyles?.input_hover,
                loading && "opacity-70"
              )}
              disabled={loading}
            >
              <RefreshCw className={classNames("h-3.5 w-3.5", loading && "animate-spin")}
              /> Aggiorna
            </button>
            <button
              onClick={onAdoptSelection}
              className={classNames(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
                themeStyles?.button,
                pipelineAligned && "ring-2 ring-emerald-400/70"
              )}
              disabled={!onAdoptSelection}
            >
              <Sparkles className="h-3.5 w-3.5" /> Usa nel form pipeline
            </button>
          </div>
        </div>
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
          {searchActive && (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700/60 bg-zinc-900/60 px-3 py-1">
              <FilterIcon className="h-3 w-3" /> Ricerca attiva
            </span>
          )}
          {pipelineAligned && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-emerald-200">
              <Sparkles className="h-3 w-3" /> Form sincronizzato
            </span>
          )}
        </div>
      </div>

      {expandedPanels.filters && (
        <div className="space-y-4 border-b border-zinc-800/60 p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1 min-w-[220px]">
              <FilterIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                value={searchTerm}
                onChange={(event) => onSearchChange?.(event.target.value)}
                placeholder="Filtra per titolo, cliente, progetto o stato"
                className={classNames(
                  "w-full rounded-xl border bg-transparent px-9 py-2 text-sm outline-none",
                  themeStyles?.input
                )}
              />
              {searchTerm && (
                <button
                  onClick={() => onSearchChange?.("")}
                  className="absolute right-2 top-2 rounded-lg px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Pulisci
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={filterName}
                onChange={(event) => setFilterName(event.target.value)}
                placeholder="Nome filtro"
                className={classNames(
                  "w-36 rounded-xl border bg-transparent px-3 py-2 text-xs outline-none",
                  themeStyles?.input
                )}
              />
              <button
                onClick={handleFilterSave}
                className={classNames(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
                  themeStyles?.button
                )}
              >
                <Bookmark className="h-3.5 w-3.5" /> Salva filtro
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
                    className="text-zinc-500 hover:text-zinc-200"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={`${crumb.label}-${index}`}>
                {index > 0 && <ChevronRight className="h-3 w-3 text-zinc-600" />}
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: crumb.color || "#6366f1" }} />
                  <span>{crumb.label}</span>
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {expandedPanels.navigator && (
        <div className="border-b border-zinc-800/60 p-6">
          <div className="mb-3 flex items-center justify-between text-xs text-zinc-400">
            <span>Workspace</span>
            <button onClick={handleWorkspaceReset} className="text-zinc-500 hover:text-zinc-200">
              Mostra tutti
            </button>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)]">
            <div className="max-h-[320px] space-y-2 overflow-auto pr-1">
              {workspaceCatalog.map((workspace) => {
                const isActive = workspace.id === normalizedSelection.workspaceId;
                return (
                  <button
                    type="button"
                    key={workspace.id}
                    onClick={() => handleWorkspaceSelect(workspace.id)}
                    className={classNames(
                      "w-full rounded-xl border px-3 py-2 text-left text-sm transition",
                      themeStyles?.input,
                      isActive && "border-indigo-400/70 ring-2 ring-indigo-400/30"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: workspace.color }} />
                        <div>
                          <div className="font-medium text-zinc-200">{workspace.name}</div>
                          {workspace.client && <div className="text-xs text-zinc-500">{workspace.client}</div>}
                        </div>
                      </div>
                      <div className="text-xs text-zinc-500">{workspace.count} doc</div>
                    </div>
                  </button>
                );
              })}
              {workspaceCatalog.length === 0 && (
                <div className="rounded-xl border border-dashed border-zinc-700/60 p-3 text-xs text-zinc-500">
                  Nessun workspace ancora definito.
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border px-3 py-3 text-sm" style={{ borderColor: selectedWorkspace?.color || undefined }}>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Folder className="h-3.5 w-3.5" /> Progetti
                  </span>
                  {selectedWorkspace && (
                    <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                      <Palette className="h-3 w-3" /> {selectedWorkspace.client || "—"}
                    </span>
                  )}
                </div>
                {!normalizedSelection.workspaceId && (
                  <div className="mt-2 text-xs text-zinc-500">Seleziona un workspace per vedere i progetti.</div>
                )}
                {normalizedSelection.workspaceId === UNASSIGNED_KEY && (
                  <div className="mt-2 text-xs text-zinc-500">I documenti non assegnati non hanno progetti collegati.</div>
                )}
                {normalizedSelection.workspaceId && normalizedSelection.workspaceId !== UNASSIGNED_KEY && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleProjectSelect({ key: "", name: "", id: "", statuses: [] })}
                      className={classNames(
                        "rounded-lg border px-3 py-1 text-xs",
                        themeStyles?.input,
                        !normalizedSelection.projectId && "border-indigo-400/70 text-indigo-200"
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
                            "rounded-lg border px-3 py-1 text-xs transition",
                            themeStyles?.input,
                            isActive && "border-indigo-400/70 text-indigo-200"
                          )}
                        >
                          <span className="font-medium">{project.name}</span>
                          <span className="ml-2 text-[10px] text-zinc-500">{project.count} doc</span>
                        </button>
                      );
                    })}
                    {projectCatalog.length === 0 && <div className="text-xs text-zinc-500">Nessun progetto registrato.</div>}
                  </div>
                )}
              </div>

              <div className="rounded-xl border px-3 py-3 text-sm">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Stato</span>
                  {normalizedSelection.status && (
                    <button onClick={() => handleStatusSelect("")} className="text-zinc-500 hover:text-zinc-200">
                      Azzera
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {statusCatalog.map((status) => {
                    const isActive = status.label === normalizedSelection.status;
                    return (
                      <button
                        type="button"
                        key={status.label}
                        onClick={() => handleStatusSelect(status.label)}
                        className={classNames(
                          "rounded-full border px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
                          themeStyles?.input,
                          isActive && "border-indigo-400/70 text-indigo-200"
                        )}
                      >
                        {status.label}
                        {Number.isFinite(status.count) && status.count > 0 && (
                          <span className="ml-2 text-[10px] text-zinc-500">{status.count}</span>
                        )}
                      </button>
                    );
                  })}
                  {statusCatalog.length === 0 && <div className="text-xs text-zinc-500">Nessuno stato disponibile.</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {expandedPanels.documents && (
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
            <span className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" /> Catalogo documenti
            </span>
            <span>{filteredEntries.length} risultati</span>
          </div>
          <div
            className={classNames(
              "mt-3 grid gap-4",
              expandedPanels.inspector ? "lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]" : "lg:grid-cols-1"
            )}
          >
            <div className="rounded-xl border px-3 py-3">
              <div className="max-h-[320px] space-y-2 overflow-auto pr-1">
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={`navigator-entry-skeleton-${index}`} className="h-24 w-full rounded-xl" />
                  ))
                ) : filteredEntries.length === 0 ? (
                  <EmptyState
                    title="Nessun risultato"
                    description="Aggiorna i filtri di workspace o ricerca per mostrare i documenti disponibili."
                    className="border-zinc-700/60 bg-black/20 text-zinc-400"
                  />
                ) : (
                  filteredEntries.map((entry) => {
                    const isActive = selectedEntry?.id === entry.id;
                    const completeness = formatCompleteness(entry?.completenessScore);
                    const entryProjectKey = computeProjectKey(entry?.workspace?.projectId, entry?.workspace?.projectName);
                    return (
                      <button
                        type="button"
                        key={entry.id}
                        onClick={() => setSelectedEntryId(entry.id)}
                        className={classNames(
                          "w-full rounded-xl border px-4 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
                          themeStyles?.input,
                          isActive && "border-indigo-400/70 ring-2 ring-indigo-400/30"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-zinc-200">
                              <FileText className="h-4 w-4" />
                              <span className="font-medium">{entry?.title || entry?.slug || "Documento"}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span>{formatTimestamp(entry?.timestamp)}</span>
                              {entryProjectKey && (
                                <span className="rounded-lg bg-zinc-800/70 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                                  {entry?.workspace?.projectName || entry?.workspace?.projectId || "Progetto"}
                                </span>
                              )}
                              {entry?.workspace?.status && (
                                <span className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-200">
                                  {entry.workspace.status}
                                </span>
                              )}
                              {entry?.prompt?.title && (
                                <span className="flex items-center gap-1 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-200">
                                  <Sparkles className="h-3 w-3" />
                                  {entry.prompt.title}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-xs text-zinc-400">
                            {Number.isFinite(completeness) ? (
                              <div>
                                <div className="text-sm font-semibold text-indigo-200">{completeness}%</div>
                                <div>completezza</div>
                              </div>
                            ) : (
                              <div className="text-zinc-600">—</div>
                            )}
                          </div>
                        </div>
                        {Array.isArray(entry?.structure?.missingSections) && entry.structure.missingSections.length > 0 && (
                          <div className="mt-2 text-xs text-amber-300">
                            Manca: {entry.structure.missingSections.join(", ")}
                          </div>
                        )}
                        {entry?.structure?.promptChecklist?.missing?.length > 0 && (
                          <div className="mt-1 text-xs text-amber-300">
                            Gap template: {entry.structure.promptChecklist.missing.join(", ")}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {expandedPanels.inspector && (
              <div className="rounded-xl border px-4 py-4">
                {selectedEntry ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">{selectedEntry.title || selectedEntry.slug || "Documento"}</div>
                      <div className="text-xs text-zinc-500">{selectedEntry.workspace?.client || selectedEntry.workspace?.name || ""}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      <span>ID: {selectedEntry.id}</span>
                      {selectedEntry.workspace?.projectName && (
                        <span className="rounded-lg bg-zinc-800/60 px-2 py-0.5">{selectedEntry.workspace.projectName}</span>
                      )}
                      {selectedEntry.workspace?.status && (
                        <span className="rounded-lg border border-indigo-500/40 px-2 py-0.5 text-indigo-200">
                          {selectedEntry.workspace.status}
                        </span>
                      )}
                    </div>
                    {selectedEntry.prompt?.title && (
                      <div className="space-y-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs text-indigo-100">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-3.5 w-3.5" />
                          <span className="text-sm font-semibold text-indigo-100">{selectedEntry.prompt.title}</span>
                        </div>
                        {selectedEntry.prompt.persona && (
                          <div className="text-[11px] text-indigo-200/80">Persona: {selectedEntry.prompt.persona}</div>
                        )}
                        {Array.isArray(selectedEntry.prompt.tags) && selectedEntry.prompt.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {selectedEntry.prompt.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-lg bg-black/30 px-2 py-0.5 text-[10px] uppercase tracking-wide text-indigo-200/80"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {Number.isFinite(selectedEntry.structure?.promptChecklist?.score) && (
                          <div className="text-[11px] text-indigo-200/80">
                            Copertura template: {Math.round(selectedEntry.structure.promptChecklist.score)}%
                          </div>
                        )}
                        {selectedEntry.structure?.promptChecklist?.missing?.length > 0 && (
                          <div className="text-[11px] text-amber-200">
                            Gap: {selectedEntry.structure.promptChecklist.missing.join(', ')}
                          </div>
                        )}
                        {selectedEntry.prompt?.focus && (
                          <div className="text-[11px] text-indigo-200/80">Focus: {selectedEntry.prompt.focus}</div>
                        )}
                        {selectedEntry.prompt?.notes && (
                          <div className="text-[11px] text-indigo-200/70">Note: {selectedEntry.prompt.notes}</div>
                        )}
                        {Array.isArray(selectedEntry.prompt?.completedCues) && selectedEntry.prompt.completedCues.length > 0 && (
                          <div className="text-[11px] text-indigo-200/70">
                            Cue completate: {selectedEntry.prompt.completedCues.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="max-h-48 overflow-auto rounded-lg border border-zinc-800/60 bg-black/20 p-3 text-sm text-zinc-200">
                      {previewState.loading ? (
                        <div className="text-xs text-zinc-500">Caricamento anteprima…</div>
                      ) : previewState.error ? (
                        <div className="text-xs text-rose-300">{previewState.error}</div>
                      ) : previewState.markdown ? (
                        <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-200">
                          {previewState.markdown}
                        </pre>
                      ) : (
                        <div className="text-xs text-zinc-500">Anteprima non disponibile.</div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => onOpenPdf?.(selectedEntry)}
                        className={classNames("flex items-center gap-2 rounded-lg px-3 py-2 text-xs", themeStyles?.button)}
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Apri PDF
                      </button>
                      <button
                        onClick={() => onOpenMd?.(selectedEntry)}
                        className={classNames("flex items-center gap-2 rounded-lg px-3 py-2 text-xs", themeStyles?.button)}
                      >
                        <FileText className="h-3.5 w-3.5" /> Modifica PDF
                      </button>
                      <button
                        onClick={() => onRepublish?.(selectedEntry)}
                        className={classNames("flex items-center gap-2 rounded-lg px-3 py-2 text-xs", themeStyles?.button)}
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Rigenera PDF
                      </button>
                      <button
                        onClick={() => onShowLogs?.(selectedEntry)}
                        className={classNames(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
                          themeStyles?.input,
                          themeStyles?.input_hover
                        )}
                      >
                        <Folder className="h-3.5 w-3.5" /> Log pipeline
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {workspaceAssignment && (
                        <button
                          onClick={handleAssign}
                          className={classNames(
                            "flex items-center gap-2 rounded-lg px-3 py-2",
                            themeStyles?.button,
                            assigning && "opacity-70"
                          )}
                          disabled={assigning || !canAssign}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {canAssign ? "Allinea al workspace" : "Workspace allineato"}
                        </button>
                      )}
                      {canUnassign && (
                        <button
                          onClick={handleUnassign}
                          className={classNames(
                            "flex items-center gap-2 rounded-lg px-3 py-2",
                            themeStyles?.input,
                            themeStyles?.input_hover,
                            assigning && "opacity-70"
                          )}
                          disabled={assigning}
                        >
                          <XCircle className="h-3.5 w-3.5" /> Rimuovi workspace
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-zinc-500">Seleziona un documento per visualizzare l'anteprima.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
