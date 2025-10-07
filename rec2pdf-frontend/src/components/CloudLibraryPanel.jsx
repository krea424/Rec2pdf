import React, { useCallback, useEffect, useMemo, useState } from "react";
import { classNames } from "../utils/classNames";
import { Folder, RefreshCw, LinkIcon, AlertCircle, Info, Users } from "./icons";

const DEFAULT_BUCKET = "processed-media";

const sanitizeSegment = (value) => {
  if (!value) return "";
  return String(value)
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9_\-./]/g, "-");
};

const sanitizePrefix = (value) => {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  return trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
};

const formatSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "—";
  }
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
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString();
};

const computeSelectionPrefix = (selection) => {
  if (!selection) return "";
  const parts = [];
  if (selection.workspaceId || selection.id) {
    parts.push(sanitizeSegment(selection.workspaceId || selection.id));
  }
  if (selection.projectId) {
    parts.push(sanitizeSegment(selection.projectId));
  } else if (selection.projectName) {
    parts.push(sanitizeSegment(selection.projectName));
  }
  return parts.filter(Boolean).join("/");
};

const projectOptionsFromWorkspace = (workspace) => {
  if (!workspace || !Array.isArray(workspace.projects)) return [];
  return workspace.projects.map((project) => {
    const value = project.id || project.key || sanitizeSegment(project.name) || "";
    return {
      value,
      label: project.name || project.id || project.key || "Progetto",
      projectId: project.id || value,
      projectName: project.name || "",
    };
  });
};

export default function CloudLibraryPanel({
  backendUrl,
  fetchBody,
  buildFileUrl,
  sessionToken,
  selection,
  onAssignWorkspace,
  workspaces = [],
  themeStyles = {},
  defaultBucket = DEFAULT_BUCKET,
}) {
  const [bucket, setBucket] = useState(defaultBucket);
  const [prefix, setPrefix] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resolvedBucket, setResolvedBucket] = useState(defaultBucket);
  const [resolvedPrefix, setResolvedPrefix] = useState("");
  const [autoRefreshRequested, setAutoRefreshRequested] = useState(true);

  const normalizedPrefix = useMemo(() => sanitizePrefix(prefix), [prefix]);

  const selectionPrefix = useMemo(() => computeSelectionPrefix(selection), [selection]);

  useEffect(() => {
    let didChange = false;
    setPrefix((prev) => {
      const current = sanitizePrefix(prev);
      if (selectionPrefix === current) {
        return prev;
      }
      didChange = true;
      return selectionPrefix;
    });
    if (didChange) {
      setAutoRefreshRequested(true);
    }
  }, [selectionPrefix]);

  const selectedWorkspace = useMemo(() => {
    if (!selection?.workspaceId) return null;
    return workspaces.find((workspace) => workspace.id === selection.workspaceId) || null;
  }, [selection?.workspaceId, workspaces]);

  const projectOptions = useMemo(() => projectOptionsFromWorkspace(selectedWorkspace), [selectedWorkspace]);

  const handleWorkspaceChange = useCallback(
    (event) => {
      const value = event.target.value;
      if (typeof onAssignWorkspace !== "function") return;
      if (!value) {
        onAssignWorkspace({ workspaceId: "", projectId: "", projectName: "" });
        return;
      }
      const workspace = workspaces.find((item) => item.id === value) || null;
      onAssignWorkspace({
        workspaceId: workspace?.id || value,
        projectId: "",
        projectName: "",
      });
    },
    [onAssignWorkspace, workspaces]
  );

  const handleProjectChange = useCallback(
    (event) => {
      if (!selection?.workspaceId || typeof onAssignWorkspace !== "function") return;
      const value = event.target.value;
      if (!value) {
        onAssignWorkspace({ workspaceId: selection.workspaceId, projectId: "", projectName: "" });
        return;
      }
      const project = projectOptions.find((item) => item.value === value);
      onAssignWorkspace({
        workspaceId: selection.workspaceId,
        projectId: project?.projectId || value,
        projectName: project?.projectName || "",
      });
    },
    [onAssignWorkspace, projectOptions, selection?.workspaceId]
  );

  const loadFiles = useCallback(async () => {
    if (!backendUrl) {
      setError("Configura l'URL del backend per interrogare lo storage.");
      setFiles([]);
      return;
    }
    if (!bucket.trim()) {
      setError("Specifica un bucket di Supabase.");
      setFiles([]);
      return;
    }

    const params = new URLSearchParams({ bucket: bucket.trim() });
    if (normalizedPrefix) {
      params.set("prefix", normalizedPrefix);
    }
    setLoading(true);
    setError("");
    try {
      const targetUrl = `${backendUrl}/api/storage?${params.toString()}`;
      const result = await fetchBody(targetUrl, { method: "GET" });
      if (!result.ok) {
        const message = result.data?.message || result.raw || "Errore nel recupero dei file";
        setError(message);
        setFiles([]);
        setResolvedBucket(bucket.trim());
        setResolvedPrefix(normalizedPrefix);
        return;
      }
      const payloadFiles = Array.isArray(result.data?.files) ? result.data.files : [];
      setFiles(payloadFiles);
      setResolvedBucket(result.data?.bucket || bucket.trim());
      setResolvedPrefix(result.data?.prefix || normalizedPrefix);
    } catch (requestError) {
      setError(requestError?.message || "Errore di rete durante il recupero dei file.");
      setFiles([]);
      setResolvedBucket(bucket.trim());
      setResolvedPrefix(normalizedPrefix);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, bucket, fetchBody, normalizedPrefix]);

  useEffect(() => {
    if (!autoRefreshRequested) return;
    setAutoRefreshRequested(false);
    loadFiles();
  }, [autoRefreshRequested, loadFiles]);

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      loadFiles();
    },
    [loadFiles]
  );

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
        <button
          type="button"
          onClick={loadFiles}
          className={classNames(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition",
            themeButton,
            loading && "opacity-60 cursor-wait"
          )}
          disabled={loading}
        >
          <RefreshCw className={classNames("h-4 w-4", loading && "animate-spin")} />
          Aggiorna
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_1fr_1fr]">
        <label className="flex flex-col text-xs text-zinc-500">
          Bucket
          <input
            value={bucket}
            onChange={(event) => setBucket(event.target.value)}
            className={classNames("mt-2 rounded-lg border px-3 py-2 text-sm bg-transparent", themeInput)}
            placeholder="processed-media"
          />
        </label>
        <label className="flex flex-col text-xs text-zinc-500">
          Prefisso
          <input
            value={prefix}
            onChange={(event) => setPrefix(event.target.value)}
            className={classNames("mt-2 rounded-lg border px-3 py-2 text-sm bg-transparent", themeInput)}
            placeholder="workspace-id/progetto"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <label className="flex flex-col text-xs text-zinc-500">
            Workspace
            <select
              value={selection?.workspaceId || ""}
              onChange={handleWorkspaceChange}
              className={classNames("mt-2 rounded-lg border px-3 py-2 text-sm bg-transparent", themeInput)}
            >
              <option value="">Tutti</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id || workspace.name} value={workspace.id || workspace.name} className="bg-zinc-900">
                  {workspace.name || workspace.client || workspace.id || "Workspace"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs text-zinc-500">
            Progetto
            <select
              value={selection?.projectId || ""}
              onChange={handleProjectChange}
              className={classNames("mt-2 rounded-lg border px-3 py-2 text-sm bg-transparent", themeInput)}
              disabled={!selection?.workspaceId}
            >
              <option value="">Tutti</option>
              {projectOptions.map((project) => (
                <option key={project.value} value={project.value} className="bg-zinc-900">
                  {project.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </form>

      <div className="mt-4 text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5" />
          <span>
            Percorso corrente: <span className="text-zinc-300">{resolvedBucket}/{resolvedPrefix || ""}</span>
          </span>
        </div>
        {selection?.workspaceId ? (
          <div className="mt-2 flex items-center gap-2 text-zinc-500">
            <Users className="h-3.5 w-3.5" />
            <span>
              Workspace selezionato: <span className="text-zinc-300">{selectedWorkspace?.name || selection.workspaceId}</span>
            </span>
          </div>
        ) : null}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-100">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
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
            {files.length === 0 && !loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-xs text-zinc-500">
                  Nessun file trovato per il prefisso selezionato.
                </td>
              </tr>
            ) : (
              files.map((file) => {
                const downloadUrl =
                  backendUrl && file?.name
                    ? buildFileUrl(
                        backendUrl,
                        `${resolvedBucket}/${file.name}`,
                        sessionToken ? { token: sessionToken } : undefined
                      )
                    : "";
                return (
                  <tr key={file.name} className="transition hover:bg-indigo-500/10">
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-zinc-100">{file.name}</span>
                        {downloadUrl ? (
                          <a
                            href={downloadUrl}
                            className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200"
                            target="_blank"
                            rel="noreferrer"
                          >
                            <LinkIcon className="h-3 w-3" />
                            Apri file firmato
                          </a>
                        ) : (
                          <span className="text-xs text-zinc-500">URL non disponibile.</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-300">{formatSize(file.size)}</td>
                    <td className="px-4 py-3 text-right text-zinc-400">{formatTimestamp(file.updatedAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="mt-4 text-xs text-zinc-500">Caricamento in corso…</div>
      )}
    </div>
  );
}
