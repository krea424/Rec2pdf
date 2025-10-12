import { useCallback, useMemo } from "react";
import { Mic, Square, Upload } from "../../components/icons";
import { useAppContext } from "../../hooks/useAppContext";
import { classNames } from "../../utils/classNames";

const UploadCard = () => {
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
  } = context;

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

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-subtle">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold uppercase tracking-[0.32em] text-white/70">
          <Mic className="h-4 w-4" /> REC
        </h2>
        <span className="text-sm font-mono text-white/80">{fmtTime(elapsed)}</span>
      </div>

      <div className="mt-6 space-y-5">
        <button
          type="button"
          onClick={handleToggleRecording}
          disabled={!canRecord}
          className={classNames(
            "relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl px-4 py-5 text-lg font-semibold",
            "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-9",
            recording
              ? "bg-rose-500/90 text-white shadow-[0_18px_60px_-30px_rgba(244,63,94,0.9)]"
              : "bg-emerald-500/80 text-white shadow-[0_18px_60px_-30px_rgba(16,185,129,0.8)] hover:bg-emerald-400/90",
            !canRecord && "cursor-not-allowed opacity-60"
          )}
          title={micStatusLabel}
        >
          {recording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          {recording ? "Stop" : "Avvia REC"}
        </button>

        <div className="space-y-3">
          <div>
            <input
              ref={fileInputRef}
              id="base-upload-input"
              type="file"
              accept="audio/*"
              onChange={onPickFile}
              className="hidden"
            />
            <label
              htmlFor="base-upload-input"
              className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-4 text-sm transition hover:border-white/40 hover:bg-white/10"
            >
              <span className="flex items-center gap-2 font-medium">
                <Upload className="h-4 w-4" /> Carica audio
              </span>
              <span className="text-xs text-white/60">MP3, WAV, M4A…</span>
            </label>
          </div>

          {audioDetails ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
              {audioDetails}
            </div>
          ) : (
            <p className="text-xs text-white/50">Carica un file o registra per attivare la pipeline.</p>
          )}
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
