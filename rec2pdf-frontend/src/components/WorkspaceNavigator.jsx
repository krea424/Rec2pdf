import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { classNames } from "../utils/classNames";
import {
  Users,
  Folder,
  FileText,
  FilterIcon,
  Bookmark,
  RefreshCw,
  Sparkles,
  LinkIcon,
  ChevronRight,
  Plus,
  ExternalLink,
  Palette,
  XCircle,
} from "./icons";

const DEFAULT_STATUSES = ["Bozza", "In lavorazione", "Da revisionare", "Completato"];
const UNASSIGNED_KEY = "__unassigned__";

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

  const normalizedSelection = selection || {
    workspaceId: "",
    projectId: "",
    projectName: "",
    status: "",
  };

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
    const project = projectCatalog.find((item) => item.key === normalizedSelection.projectId) || null;
    return {
      id: selectedWorkspace.id,
      name: selectedWorkspace.name,
      client: selectedWorkspace.client,
      color: selectedWorkspace.color,
      projectId: project?.id || "",
      projectName: project ? project.name : normalizedSelection.projectName || "",
      projectColor: project?.color || selectedWorkspace.color,
      status: normalizedSelection.status || "",
      versioningPolicy: selectedWorkspace.versioningPolicy || null,
      statusCatalog: statusLabels,
    };
  }, [selectedWorkspace, normalizedSelection.workspaceId, normalizedSelection.projectId, normalizedSelection.projectName, normalizedSelection.status, projectCatalog, statusLabels]);

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
      const project = projectCatalog.find((item) => item.key === selectionProjectKey);
      if (project) {
        parts.push({ label: project.name, color: project.color });
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
  }, [normalizedSelection.workspaceId, normalizedSelection.projectName, normalizedSelection.status, selectedWorkspace, projectCatalog, selectionProjectKey]);

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

  return (
    <div className={classNames("rounded-2xl border shadow-lg p-6", themeStyles?.card)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-indigo-200">
            <Users className="h-4 w-4" /> Workspace Navigator
          </div>
          <p className="text-sm text-zinc-400">
            Organizza deliverable per cliente, progetto e stato, con anteprime istantanee e indicatori di completezza.
          </p>
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

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <FilterIcon className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
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
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
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

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={`${crumb.label}-${index}`}>
            {index > 0 && <ChevronRight className="h-3 w-3 text-zinc-600" />}
            <span className="inline-flex items-center gap-1">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: crumb.color || "#6366f1" }}
              />
              <span>{crumb.label}</span>
            </span>
          </React.Fragment>
        ))}
        {pipelineAligned && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
            <Sparkles className="h-3 w-3" /> Form sincronizzato
          </span>
        )}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(220px,260px)_minmax(220px,240px)_minmax(0,1fr)]">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Workspace</span>
            <button onClick={handleWorkspaceReset} className="text-zinc-500 hover:text-zinc-200">
              Mostra tutti
            </button>
          </div>
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
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: workspace.color }}
                      />
                      <div>
                        <div className="font-medium text-zinc-200">{workspace.name}</div>
                        {workspace.client && (
                          <div className="text-xs text-zinc-500">{workspace.client}</div>
                        )}
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
              <div className="mt-2 flex flex-wrap gap-2">
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
                {projectCatalog.length === 0 && (
                  <div className="text-xs text-zinc-500">Nessun progetto registrato.</div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border px-3 py-3 text-sm">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Stato</span>
              {normalizedSelection.status && (
                <button
                  onClick={() => handleStatusSelect("")}
                  className="text-zinc-500 hover:text-zinc-200"
                >
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
                      "rounded-full border px-3 py-1 text-xs",
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
              {statusCatalog.length === 0 && (
                <div className="text-xs text-zinc-500">Nessuno stato disponibile.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border px-3 py-3">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Documenti</span>
              <span>{filteredEntries.length} risultati</span>
            </div>
            <div className="mt-2 max-h-[320px] space-y-2 overflow-auto pr-1">
              {filteredEntries.length === 0 && (
                <div className="rounded-xl border border-dashed border-zinc-700/60 p-4 text-sm text-zinc-500">
                  Nessun documento corrispondente ai filtri selezionati.
                </div>
              )}
              {filteredEntries.map((entry) => {
                const isActive = selectedEntry?.id === entry.id;
                const completeness = formatCompleteness(entry?.completenessScore);
                const entryProjectKey = computeProjectKey(entry?.workspace?.projectId, entry?.workspace?.projectName);
                return (
                  <button
                    type="button"
                    key={entry.id}
                    onClick={() => setSelectedEntryId(entry.id)}
                    className={classNames(
                      "w-full rounded-xl border px-4 py-3 text-left text-sm transition",
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
                  </button>
                );
              })}
            </div>
          </div>

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
                    <FileText className="h-3.5 w-3.5" /> Apri MD
                  </button>
                  <button
                    onClick={() => onRepublish?.(selectedEntry)}
                    className={classNames("flex items-center gap-2 rounded-lg px-3 py-2 text-xs", themeStyles?.button)}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Rigenera PDF
                  </button>
                  <button
                    onClick={() => onShowLogs?.(selectedEntry)}
                    className={classNames("flex items-center gap-2 rounded-lg px-3 py-2 text-xs", themeStyles?.input, themeStyles?.input_hover)}
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
        </div>
      </div>
    </div>
  );
}
