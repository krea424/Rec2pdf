import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { classNames } from "../utils/classNames";
import { Folder, RefreshCw, LinkIcon, Info, Users, FilterIcon } from "./icons";
import { Button, Toast, EmptyState, Skeleton } from "./ui";

const DEFAULT_BUCKET = "processed-media";

// --- STILI BOARDROOM (Costanti per coerenza) ---
const CARD_STYLE = "rounded-2xl border border-white/10 bg-[#121214] p-5 text-white shadow-sm transition-all hover:border-white/20";
const INPUT_STYLE = "w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all";
const BUTTON_SECONDARY = "flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition-all";
const TABLE_HEADER = "bg-[#18181b] border-b border-white/5 text-zinc-500 uppercase text-[10px] font-bold tracking-wider";
const TABLE_ROW = "border-b border-white/5 hover:bg-white/[0.02] transition-colors";
const TABLE_CELL = "px-4 py-3 text-sm text-zinc-300";

// --- FUNZIONI HELPER ---
const formatSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = value < 10 && unitIndex > 0 ? 1 : 0;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
};

const formatTimestamp = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const projectOptionsFromWorkspace = (workspace) => {
  if (!workspace || !Array.isArray(workspace.projects)) return [];
  return workspace.projects.map((project) => ({
    value: project.id,
    label: project.name,
    slug: project.slug,
  }));
};
// --- FINE FUNZIONI HELPER ---

export default function CloudLibraryPanel({
  backendUrl,
  fetchBody,
  selection,
  onAssignWorkspace,
  onOpenFile,
  workspaces = [],
  themeStyles = {},
  defaultBucket = DEFAULT_BUCKET,
}) {
  const [bucket, setBucket] = useState(defaultBucket);
  const [allUserFiles, setAllUserFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();
  }, []);

  const loadAllUserFiles = useCallback(async () => {
    if (!backendUrl || !user) {
      return;
    }
    
    const userPrefix = `processed/${user.id}`;
    const params = new URLSearchParams({ bucket: bucket.trim(), prefix: userPrefix });
    
    setLoading(true);
    setError("");
    try {
      const targetUrl = `${backendUrl}/api/storage?${params.toString()}`;
      const result = await fetchBody(targetUrl, { method: "GET" });
      if (!result.ok) {
        throw new Error(result.data?.message || "Errore nel recupero dei file");
      }
      const payloadFiles = (Array.isArray(result.data?.files) ? result.data.files : [])
        .filter(file => file.id !== null); 
      setAllUserFiles(payloadFiles);
    } catch (requestError) {
      setError(requestError.message || "Errore di rete.");
      setAllUserFiles([]);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, bucket, fetchBody, user]);

  useEffect(() => {
    if (user) {
      loadAllUserFiles();
    }
  }, [user, loadAllUserFiles]);

  const selectedWorkspace = useMemo(() => {
    if (!selection?.workspaceId) return null;
    return workspaces.find((ws) => ws.id === selection.workspaceId) || null;
  }, [selection?.workspaceId, workspaces]);

  const projectOptions = useMemo(() => projectOptionsFromWorkspace(selectedWorkspace), [selectedWorkspace]);

  const filteredFiles = useMemo(() => {
    if (!selection?.workspaceId) {
      return allUserFiles;
    }
    if (!selectedWorkspace?.slug) {
      return [];
    }

    return allUserFiles.filter(file => {
      const fileName = file.objectPath.split('/').pop() || '';

      if (!fileName.includes(`_${selectedWorkspace.slug}_`)) {
        return false;
      }
      
      if (selection.projectId) {
        const selectedProject = projectOptions.find(p => p.value === selection.projectId);
        if (selectedProject?.slug && !fileName.includes(`_${selectedProject.slug}_`)) {
          return false;
        }
      }
      return true;
    });
  }, [allUserFiles, selection, selectedWorkspace, projectOptions]);

  const handleWorkspaceChange = useCallback((event) => {
    if (typeof onAssignWorkspace !== 'function') return;
    const value = event.target.value;
    onAssignWorkspace({ workspaceId: value, projectId: "", projectName: "" });
  }, [onAssignWorkspace]);

  const handleProjectChange = useCallback((event) => {
    if (!selection?.workspaceId || typeof onAssignWorkspace !== 'function') return;
    const value = event.target.value;
    const project = projectOptions.find(p => p.value === value);
    onAssignWorkspace({
      workspaceId: selection.workspaceId,
      projectId: project?.value || "",
      projectName: project?.label || "",
    });
  }, [onAssignWorkspace, projectOptions, selection?.workspaceId]);

  return (
    <div className={classNames(CARD_STYLE, "flex flex-col gap-6 min-h-[600px]")}>
      
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400 mb-1">
            <Folder className="h-4 w-4" /> Cloud Library
          </div>
          <p className="text-sm text-zinc-400">
            Archivio centralizzato di tutti gli artefatti generati.
          </p>
        </div>
         <button
          type="button"
          className={BUTTON_SECONDARY}
          onClick={loadAllUserFiles}
          disabled={loading}
        >
          <RefreshCw className={classNames("h-3.5 w-3.5", loading && "animate-spin")} />
          Aggiorna
        </button>
      </div>

      {/* FILTRI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 bg-[#18181b] p-4 rounded-xl border border-white/5">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1">Workspace</label>
          <div className="relative">
             <select
                value={selection?.workspaceId || ""}
                onChange={handleWorkspaceChange}
                className={INPUT_STYLE + " appearance-none pr-8"}
             >
                <option value="">Tutti i file</option>
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
             </select>
             <FilterIcon className="pointer-events-none absolute right-3 top-3 h-3.5 w-3.5 text-zinc-500" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1">Progetto</label>
          <div className="relative">
             <select
                value={selection?.projectId || ""}
                onChange={handleProjectChange}
                disabled={!selection?.workspaceId}
                className={INPUT_STYLE + " appearance-none pr-8 disabled:opacity-50"}
             >
                <option value="">Tutti</option>
                {projectOptions.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
             </select>
             <FilterIcon className="pointer-events-none absolute right-3 top-3 h-3.5 w-3.5 text-zinc-500" />
          </div>
        </div>
      </div>

      {/* INFO BAR */}
      <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5" />
          <span>
            Visualizzando <strong className="text-zinc-300">{filteredFiles.length}</strong> di <strong className="text-zinc-300">{allUserFiles.length}</strong> file.
          </span>
        </div>
        {selectedWorkspace && (
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            <span>Filtro attivo: <span className="text-indigo-300">{selectedWorkspace.name}</span></span>
          </div>
        )}
      </div>

      {error && (
        <Toast tone="danger" description={error} className="text-xs" />
      )}

      {/* TABELLA */}
      <div className="flex-1 overflow-hidden rounded-xl border border-white/5 bg-black/20">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className={TABLE_HEADER}>
              <tr>
                <th className="px-4 py-3 font-medium">Nome File</th>
                <th className="px-4 py-3 font-medium text-right">Dimensione</th>
                <th className="px-4 py-3 font-medium text-right">Data</th>
                <th className="px-4 py-3 font-medium text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`skeleton-${index}`}>
                    <td colSpan={4} className="px-4 py-3">
                      <Skeleton className="h-6 w-full rounded bg-white/5" />
                    </td>
                  </tr>
                ))
              ) : filteredFiles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10">
                    <EmptyState
                      title="Nessun file trovato"
                      description="Modifica i filtri per vedere i risultati."
                      className="bg-transparent border-none"
                    />
                  </td>
                </tr>
              ) : (
                filteredFiles.map((file) => {
                  const objectPathForApi = file.objectPath;
                  const displayName = file.name;
                  
                  return (
                    <tr key={file.id || objectPathForApi} className={TABLE_ROW}>
                      <td className={TABLE_CELL}>
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded bg-white/5 flex items-center justify-center text-zinc-500">
                                <LinkIcon className="h-4 w-4" />
                            </div>
                            <span className="font-medium text-zinc-200 truncate max-w-[200px] sm:max-w-[300px]" title={displayName}>
                                {displayName}
                            </span>
                        </div>
                      </td>
                      <td className={classNames(TABLE_CELL, "text-right font-mono text-xs text-zinc-500")}>
                        {formatSize(file.metadata?.size)}
                      </td>
                      <td className={classNames(TABLE_CELL, "text-right font-mono text-xs text-zinc-500")}>
                        {formatTimestamp(file.updated_at)}
                      </td>
                      <td className={classNames(TABLE_CELL, "text-right")}>
                        {typeof onOpenFile === 'function' && (
                          <button
                            type="button"
                            className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                            onClick={() => onOpenFile({ bucket, path: objectPathForApi, label: displayName })}
                          >
                            Apri
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}