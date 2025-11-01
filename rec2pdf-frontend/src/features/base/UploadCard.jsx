import { useCallback, useMemo, useState } from "react";
import { FileCode, FileText, Mic, Upload } from "../../components/icons";
import { useAppContext } from "../../hooks/useAppContext";
import { classNames } from "../../utils/classNames";
import RecordingToggleButton from "./RecordingToggleButton";

const UploadCard = ({ journeyStage = "record" }) => {
  const context = useAppContext();
  const {
    recording,
    startRecording,
    stopRecording,
    busy,
    fmtTime,
    elapsed,
    level,
    permission,
    permissionMessage,
    mediaSupported,
    recorderSupported,
    fileInputRef,
    onPickFile,
    audioBlob,
    fmtBytes,
    mime,
    markdownInputRef,
    handleMarkdownFilePicked,
    lastMarkdownUpload,
    textInputRef,
    handleTextFilePicked,
    lastTextUpload,
    setErrorBanner,
  } = context;

  const [isDragging, setIsDragging] = useState(false);

  const handleToggleRecording = useCallback(() => {
    if (recording) {
      stopRecording();
    } else {
      void startRecording();
    }
  }, [recording, startRecording, stopRecording]);

  const canRecord = mediaSupported && recorderSupported && !busy;

  const micStatusLabel = useMemo(() => {
    if (!mediaSupported) {
      return "Microfono non supportato";
    }
    if (!recorderSupported) {
      return "Recorder non disponibile";
    }
    if (permission === "denied") {
      return "Permesso negato";
    }
    if (permission === "granted") {
      return "Permesso attivo";
    }
    return "Permesso da concedere";
  }, [mediaSupported, permission, recorderSupported]);

  const audioDetails = useMemo(() => {
    if (!audioBlob) {
      return "";
    }

    const name = typeof audioBlob.name === "string" && audioBlob.name ? audioBlob.name : "Audio pronto";
    const sizeLabel = audioBlob.size ? fmtBytes(audioBlob.size) : null;
    const mimeLabel = mime || audioBlob.type || "Formato sconosciuto";

    return [name, sizeLabel, mimeLabel].filter(Boolean).join(" • ");
  }, [audioBlob, fmtBytes, mime]);

  const markdownDetails = useMemo(() => {
    if (!lastMarkdownUpload) {
      return "";
    }

    const name = typeof lastMarkdownUpload.name === "string" ? lastMarkdownUpload.name : "Markdown caricato";
    const sizeLabel = lastMarkdownUpload.size ? fmtBytes(lastMarkdownUpload.size) : null;

    return [name, sizeLabel].filter(Boolean).join(" • ");
  }, [fmtBytes, lastMarkdownUpload]);

  const textDetails = useMemo(() => {
    if (!lastTextUpload) {
      return "";
    }

    const name = typeof lastTextUpload.name === "string" ? lastTextUpload.name : "Testo caricato";
    const sizeLabel = lastTextUpload.size ? fmtBytes(lastTextUpload.size) : null;

    return [name, sizeLabel].filter(Boolean).join(" • ");
  }, [fmtBytes, lastTextUpload]);

  const processDroppedFile = useCallback(
    (file) => {
      if (!file) {
        return;
      }

      const name = typeof file.name === "string" ? file.name : "";
      const type = typeof file.type === "string" ? file.type : "";
      const isMarkdown = /\.md$/i.test(name);
      const isText = /\.txt$/i.test(name);
      const isAudio = type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|flac|ogg|oga|opus|wma)$/i.test(name);

      if (isMarkdown) {
        handleMarkdownFilePicked({ target: { files: [file] } });
        return;
      }

      if (isText) {
        void handleTextFilePicked({ target: { files: [file] } });
        return;
      }

      if (isAudio) {
        onPickFile({ target: { files: [file] } });
        return;
      }

      setErrorBanner({
        title: "Formato non supportato",
        details: "Trascina un file audio, .md o .txt valido.",
      });
    },
    [handleMarkdownFilePicked, handleTextFilePicked, onPickFile, setErrorBanner],
  );

  const dropZoneHandlers = useMemo(
    () => {
      const onDragEnter = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer?.items?.length) {
          setIsDragging(true);
        }
      };

      const onDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isDragging) {
          setIsDragging(true);
        }
      };

      const onDragLeave = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.currentTarget.contains(event.relatedTarget)) {
          return;
        }
        setIsDragging(false);
      };

      const onDrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        const file = event.dataTransfer?.files?.[0];
        if (file) {
          processDroppedFile(file);
        }
      };

      return { onDragEnter, onDragOver, onDragLeave, onDrop };
    },
    [isDragging, processDroppedFile],
  );

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-subtle">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold uppercase tracking-[0.32em] text-white/70">
          <Mic className="h-4 w-4" /> Registra
        </h2>
        <span className="text-sm font-mono text-white/80">{fmtTime(elapsed)}</span>
      </div>

      <div className="mt-6 space-y-5">
        <RecordingToggleButton
          onToggle={handleToggleRecording}
          recording={recording}
          disabled={!canRecord}
          journeyStage={journeyStage}
          micStatusLabel={micStatusLabel}
        />

        <div className="space-y-3">
          <div
            className="grid gap-3 sm:grid-cols-3"
            role="group"
            aria-label="Caricamenti rapidi"
          >
            <div>
              <input
                ref={fileInputRef}
                id="base-upload-audio"
                type="file"
                accept="audio/*"
                onChange={onPickFile}
                className="hidden"
              />
              <label
                htmlFor="base-upload-audio"
                className="flex h-full cursor-pointer items-center justify-between rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-4 text-sm transition hover:border-white/40 hover:bg-white/10"
              >
                <span className="flex items-center gap-2 font-medium">
                  <Upload className="h-4 w-4" /> Carica audio
                </span>
                <span className="text-xs text-white/60">MP3, WAV, M4A…</span>
              </label>
            </div>

            <div>
              <input
                ref={markdownInputRef}
                id="base-upload-markdown"
                type="file"
                accept=".md,text/markdown"
                onChange={handleMarkdownFilePicked}
                className="hidden"
              />
              <label
                htmlFor="base-upload-markdown"
                className="flex h-full cursor-pointer items-center justify-between rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-4 text-sm transition hover:border-white/40 hover:bg-white/10"
              >
                <span className="flex items-center gap-2 font-medium">
                  <FileText className="h-4 w-4" /> Carica .md
                </span>
                <span className="text-xs text-white/60">Markdown</span>
              </label>
            </div>

            <div>
              <input
                ref={textInputRef}
                id="base-upload-text"
                type="file"
                accept=".txt,text/plain"
                onChange={handleTextFilePicked}
                className="hidden"
              />
              <label
                htmlFor="base-upload-text"
                className="flex h-full cursor-pointer items-center justify-between rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-4 text-sm transition hover:border-white/40 hover:bg-white/10"
              >
                <span className="flex items-center gap-2 font-medium">
                  <FileCode className="h-4 w-4" /> Carica .txt
                </span>
                <span className="text-xs text-white/60">Testo</span>
              </label>
            </div>
          </div>

          <div
            onDragEnter={dropZoneHandlers.onDragEnter}
            onDragOver={dropZoneHandlers.onDragOver}
            onDragLeave={dropZoneHandlers.onDragLeave}
            onDrop={dropZoneHandlers.onDrop}
            className={classNames(
              "rounded-2xl border border-dashed px-4 py-6 text-center text-sm transition",
              isDragging
                ? "border-emerald-400/70 bg-emerald-500/10 text-white"
                : "border-white/20 bg-white/5 text-white/70 hover:border-white/40 hover:bg-white/10",
            )}
            role="region"
            aria-label="Trascina qui file audio, Markdown o testo"
            tabIndex={0}
          >
            <p className="font-medium">Trascina qui file audio, Markdown (.md) o testo (.txt)</p>
            <p className="mt-2 text-xs text-white/60">Supporta un singolo file alla volta. I pulsanti sopra restano disponibili.</p>
          </div>

          <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
            <div className="flex items-start justify-between gap-3">
              <span className="font-medium uppercase tracking-[0.24em] text-white/50">Audio</span>
              <span className="text-right text-white/80">{audioDetails || "Nessun file audio caricato"}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="font-medium uppercase tracking-[0.24em] text-white/50">Markdown</span>
              <span className="text-right text-white/80">{markdownDetails || "Nessun file .md caricato"}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="font-medium uppercase tracking-[0.24em] text-white/50">Testo</span>
              <span className="text-right text-white/80">{textDetails || "Nessun file .txt caricato"}</span>
            </div>
            <p className="pt-1 text-[11px] text-white/50">
              Carica un file o registra per attivare la pipeline, poi passa a Ottieni PDF.
            </p>
          </div>
        </div>

        <div className="space-y-1 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
          <div className="flex items-center justify-between">
            <span>Livello input</span>
            <span className="font-mono">{Math.round(level * 100)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-violet-500"
              style={{ width: `${Math.max(0, Math.min(100, Math.round(level * 100)))}%` }}
            />
          </div>
          <p className="text-[11px] text-white/60">{micStatusLabel}</p>
          {permissionMessage ? (
            <p className="text-[11px] text-amber-200">{permissionMessage}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default UploadCard;
