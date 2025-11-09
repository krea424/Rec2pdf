import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { classNames } from "../utils/classNames";
import { Folder, RefreshCw, LinkIcon, Info, Users } from "./icons";
import { Button, Input, Select, Toast, EmptyState, Skeleton } from "./ui";

const DEFAULT_BUCKET = "processed-media";

// --- FUNZIONI HELPER ---
const sanitizePrefix = (value) => {
  if (!value) return "";
  return String(value).trim().replace(/^\/+/, "").replace(/\/+$/, "");
};

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
  return date.toLocaleString();
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
        .filter(file => file.id !== null); // Filtra le cartelle (hanno id null)
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
      // `file.objectPath` contiene il percorso completo, es: "processed/user-id/timestamp_workspace-slug_session-slug.pdf"
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

  const themeInput = themeStyles?.input || "bg-zinc-900/60 border-zinc-800";
  const themeButton = themeStyles?.button || "bg-zinc-800 hover:bg-zinc-700 border-zinc-700";

  return (
    <div className={classNames("rounded-2xl border p-5", themeStyles?.card || "bg-zinc-900/50 border-zinc-800") }>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-300">
            <Folder className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">Cloud library</h3>
            <p className="text-xs text-zinc-400">
              Esplora gli artefatti salvati su Supabase per workspace e progetto.
            </p>
          </div>
        </div>
         <Button
          type="button"
          size="sm"
          variant="secondary"
          className={classNames("gap-2", themeButton)}
          onClick={loadAllUserFiles}
          leadingIcon={RefreshCw}
          isLoading={loading}
        >
          Aggiorna
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Filtra per Workspace"
          value={selection?.workspaceId || ""}
          onChange={handleWorkspaceChange}
          containerClassName="text-xs"
          className={classNames("bg-transparent", themeInput)}
        >
          <option value="">Tutti i miei file</option>
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </Select>
        <Select
          label="Filtra per Progetto"
          value={selection?.projectId || ""}
          onChange={handleProjectChange}
          containerClassName="text-xs"
          className={classNames("bg-transparent", themeInput)}
          disabled={!selection?.workspaceId}
        >
          <option value="">Tutti</option>
          {projectOptions.map((project) => (
            <option key={project.value} value={project.value}>
              {project.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-4 text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5" />
          <span>
            Visualizzando {filteredFiles.length} file di {allUserFiles.length} totali.
          </span>
        </div>
        {selectedWorkspace ? (
          <div className="mt-2 flex items-center gap-2 text-zinc-500">
            <Users className="h-3.5 w-3.5" />
            <span>
              Workspace selezionato: <span className="text-zinc-300">{selectedWorkspace.name}</span>
            </span>
          </div>
        ) : null}
      </div>

      {error && (
        <Toast tone="danger" description={error} className="mt-4 text-xs" />
      )}

      <div className="mt-5 overflow-hidden rounded-xl border border-zinc-800/60">
        <table className="min-w-full divide-y divide-zinc-800 text-sm">
          <thead className="bg-black/20 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">File</th>
              <th className="px-4 py-3 text-right font-medium">Dimensione</th>
              <th className="px-4 py-3 text-right font-medium">Aggiornato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 bg-black/10">
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={`skeleton-${index}`}>
                  <td colSpan={3} className="px-4 py-3">
                    <Skeleton className="h-6 w-full rounded-lg bg-zinc-800/60" />
                  </td>
                </tr>
              ))
            ) : filteredFiles.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6">
                  <EmptyState
                    title="Nessun file trovato"
                    description="Nessun artefatto corrisponde ai filtri selezionati."
                  />
                </td>
              </tr>
            ) : (
              filteredFiles.map((file) => {
                // ==========================================================
                // ==                  MODIFICA CHIAVE FINALE              ==
                // ==========================================================
                // Il backend ora ci dà `objectPath` per il download e `name` per la visualizzazione.
                const objectPathForApi = file.objectPath;
                const displayName = file.name;
                
                return (
                  <tr key={file.id || objectPathForApi} className="transition hover:bg-indigo-500/10">
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-zinc-100">{displayName}</span>
                        {typeof onOpenFile === 'function' ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-fit gap-1 text-indigo-300 hover:text-indigo-200"
                            onClick={() => onOpenFile({ bucket, path: objectPathForApi, label: displayName })}
                            leadingIcon={LinkIcon}
                          >
                            Apri file firmato
                          </Button>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-300">{formatSize(file.metadata?.size)}</td>
                    <td className="px-4 py-3 text-right text-zinc-400">{formatTimestamp(file.updated_at)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}