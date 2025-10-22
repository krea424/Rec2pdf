import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "../../hooks/useAppContext";
import { classNames } from "../../utils/classNames";
import { Button } from "../ui";
import { FileText, RefreshCw, Trash2, Upload } from "../icons";

const ACCEPTED_TYPES = ".txt,.md,.pdf,.mp3,.m4a,.wav,.aac,.flac,.ogg";

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return null;
  }
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatDateTime = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  try {
    return date.toLocaleString("it-IT", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    return date.toISOString();
  }
};

const KnowledgeBaseManager = ({ workspaceId }) => {
  const { normalizedBackendUrl, fetchBody } = useAppContext();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const backendUrl = useMemo(
    () => (typeof normalizedBackendUrl === "string" ? normalizedBackendUrl.replace(/\/$/, "") : ""),
    [normalizedBackendUrl],
  );

  const canManage = Boolean(workspaceId && backendUrl);

  const loadKnowledge = useCallback(
    async ({ silent = false } = {}) => {
      if (!canManage) {
        setFiles([]);
        return;
      }
      if (!silent) {
        setListError("");
      }
      setLoading(true);
      try {
        const result = await fetchBody(
          `${backendUrl}/api/workspaces/${encodeURIComponent(workspaceId)}/knowledge`,
          { method: "GET" },
        );
        if (result.ok && Array.isArray(result.data?.files)) {
          setFiles(result.data.files);
          if (!silent) {
            setListError("");
          }
        } else {
          const message = result.data?.message || result.raw || "Impossibile recuperare la knowledge base.";
          setListError(message);
        }
      } catch (error) {
        setListError(error?.message || "Errore durante il caricamento della knowledge base.");
      } finally {
        setLoading(false);
      }
    },
    [backendUrl, canManage, fetchBody, workspaceId],
  );

  useEffect(() => {
    setFiles([]);
    setSuccessMessage("");
    setUploadError("");
    if (canManage) {
      loadKnowledge({ silent: true });
    } else {
      setLoading(false);
      if (!workspaceId) {
        setListError("Seleziona un workspace per visualizzare i documenti indicizzati.");
      } else if (!backendUrl) {
        setListError("Configura l'URL del backend per gestire la knowledge base.");
      } else {
        setListError("");
      }
    }
  }, [backendUrl, canManage, loadKnowledge, workspaceId]);

  const handleFilesSelected = useCallback(
    async (fileList) => {
      const selected = Array.from(fileList || []).filter(Boolean);
      if (!selected.length) {
        return;
      }
      if (!canManage) {
        setUploadError("Configura il backend e seleziona un workspace per caricare documenti.");
        return;
      }
      setUploading(true);
      setUploadError("");
      setSuccessMessage("");
      try {
        const formData = new FormData();
        selected.forEach((file) => {
          formData.append("files", file, file.name);
        });
        const result = await fetchBody(
          `${backendUrl}/api/workspaces/${encodeURIComponent(workspaceId)}/ingest`,
          {
            method: "POST",
            body: formData,
          },
        );
        if (result.ok) {
          const message =
            result.data?.message ||
            `Ingestion avviata per ${selected.length} documento${selected.length === 1 ? "" : "i"}.`;
          setSuccessMessage(message);
          setTimeout(() => {
            loadKnowledge({ silent: true });
          }, 1200);
        } else {
          const message = result.data?.message || result.raw || "Upload non riuscito.";
          setUploadError(message);
        }
      } catch (error) {
        setUploadError(error?.message || "Errore durante l'upload dei file.");
      } finally {
        setUploading(false);
        setDragActive(false);
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      }
    },
    [backendUrl, canManage, fetchBody, loadKnowledge, workspaceId],
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragActive(false);
      if (uploading || !canManage) {
        return;
      }
      handleFilesSelected(event.dataTransfer?.files || []);
    },
    [canManage, handleFilesSelected, uploading],
  );

  const handleDragOver = useCallback(
    (event) => {
      event.preventDefault();
      if (!uploading && canManage) {
        setDragActive(true);
      }
    },
    [canManage, uploading],
  );

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    setDragActive(false);
  }, []);

  const handleFileInputChange = useCallback(
    (event) => {
      handleFilesSelected(event.target.files || []);
    },
    [handleFilesSelected],
  );

  return (
    <div className="space-y-4 rounded-2xl border border-surface-700 bg-surface-900/70 p-5 shadow-sm shadow-black/20">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-surface-100">Gestione knowledge base</div>
          <p className="mt-1 text-xs text-surface-400">
            Workspace attivo:{" "}
            <span className="font-mono text-surface-200">{workspaceId || "—"}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            leadingIcon={RefreshCw}
            onClick={() => loadKnowledge()}
            disabled={!canManage || loading}
          >
            Aggiorna elenco
          </Button>
        </div>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={classNames(
          "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition",
          dragActive
            ? "border-brand-400 bg-brand-500/10 text-brand-100"
            : "border-surface-700/70 bg-surface-900/40 text-surface-300",
          uploading && "opacity-60",
        )}
      >
        <FileText className="h-8 w-8" aria-hidden="true" />
        <div className="text-sm font-medium text-surface-200">
          Trascina i file qui oppure utilizza il pulsante sottostante
        </div>
        <p className="text-xs text-surface-400">
          Formati supportati: testo (.txt, .md), PDF e audio (.mp3, .m4a, .wav, .aac, .flac, .ogg)
        </p>
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={handleFileInputChange}
            disabled={!canManage || uploading}
          />
          <Button
            type="button"
            size="sm"
            leadingIcon={Upload}
            onClick={() => inputRef.current?.click()}
            disabled={!canManage || uploading}
          >
            Seleziona file
          </Button>
        </div>
        {!canManage ? (
          <div className="text-xs text-amber-300">
            Configura il backend e seleziona un workspace per attivare l'upload.
          </div>
        ) : null}
        {uploading ? <div className="text-xs text-surface-300">Upload in corso…</div> : null}
        {uploadError ? <div className="text-xs text-rose-300">{uploadError}</div> : null}
        {successMessage ? <div className="text-xs text-emerald-300">{successMessage}</div> : null}
      </div>

      <div className="rounded-xl border border-surface-800/70 bg-surface-950/40">
        <div className="border-b border-surface-800/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-surface-400">
          Documenti indicizzati
        </div>
        <div className="px-4 py-3 text-sm text-surface-200">
          {loading ? (
            <div className="text-xs text-surface-400">Caricamento knowledge base in corso…</div>
          ) : listError ? (
            <div className="text-xs text-rose-300">{listError}</div>
          ) : files.length === 0 ? (
            <div className="text-xs text-surface-400">Nessun documento indicizzato per questo workspace.</div>
          ) : (
            <ul className="divide-y divide-surface-800/60">
              {files.map((file) => {
                const formattedSize = formatBytes(file.size);
                const formattedDate = formatDateTime(file.lastIngestedAt);
                return (
                  <li key={file.name} className="flex items-start justify-between gap-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-surface-100">{file.name}</div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] uppercase tracking-wide text-surface-500">
                        {file.chunkCount ? <span>{file.chunkCount} chunk</span> : null}
                        {file.mimeType ? <span>{file.mimeType}</span> : null}
                        {formattedSize ? <span>{formattedSize}</span> : null}
                        {formattedDate ? <span>Aggiornato il {formattedDate}</span> : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled
                      title="Rimozione non ancora disponibile"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-surface-700/70 text-surface-500"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseManager;
