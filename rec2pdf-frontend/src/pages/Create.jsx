import { useMemo, useState } from "react";
import {
  Bug,
  Cpu,
  Download,
  FileCode,
  FileText,
  Mic,
  Square,
  TimerIcon,
  Upload,
  Info,
} from "../components/icons";
import PromptLibrary from "../components/PromptLibrary";
import { useAppContext } from "../hooks/useAppContext";
import { classNames } from "../utils/classNames";
import { Toast } from "../components/ui";

const ErrorBanner = () => {
  const { errorBanner, setErrorBanner } = useAppContext();

  if (!errorBanner) {
    return null;
  }

  return (
    <Toast
      tone="danger"
      title={errorBanner.title}
      description={errorBanner.details}
      className="mt-4"
      action={
        <Button size="sm" variant="ghost" onClick={() => setErrorBanner(null)}>
          Chiudi
        </Button>
      }
    />
  );
};

const CreatePage = () => {
  const context = useAppContext();
  const { theme, themes } = context;

  const HeaderIcon = context.headerStatus?.icon || Cpu;

  const [openInfo, setOpenInfo] = useState(null);

  const toggleInfo = (section) => {
    setOpenInfo((prev) => (prev === section ? null : section));
  };

  const audioDownloadExtension = useMemo(() => {
    const mime = context.mime || "";
    if (mime.includes("webm")) return "webm";
    if (mime.includes("ogg")) return "ogg";
    if (mime.includes("wav")) return "wav";
    return "m4a";
  }, [context.mime]);

  return (
    <div>
      {!context.secureOK && (
        <div className="mt-4 rounded-xl border border-rose-900/40 bg-rose-950/40 p-3 text-sm text-rose-200">
          ⚠️ Per accedere al microfono serve HTTPS (o localhost in sviluppo).
        </div>
      )}

      <ErrorBanner />

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div
          className={classNames(
            "md:col-span-2 rounded-2xl border p-6 shadow-lg",
            themes[theme].card,
          )}
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-medium">
              <Mic className="h-5 w-5" /> Registrazione
            </h2>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <TimerIcon className="h-4 w-4" />{" "}
              {context.fmtTime(context.elapsed)}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center">
            <button
              type="button"
              onClick={
                context.recording
                  ? context.stopRecording
                  : context.startRecording
              }
              className={classNames(
                "flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-full text-lg font-semibold shadow-xl transition",
                context.recording
                  ? "bg-rose-600 hover:bg-rose-500"
                  : "bg-emerald-600 hover:bg-emerald-500",
              )}
              disabled={
                context.busy ||
                !context.mediaSupported ||
                !context.recorderSupported
              }
              title={
                !context.mediaSupported
                  ? "getUserMedia non supportato"
                  : !context.recorderSupported
                    ? "MediaRecorder non supportato"
                    : ""
              }
            >
              {context.recording ? (
                <div className="flex flex-col items-center gap-2">
                  <Square className="h-8 w-8" /> Stop
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Mic className="h-8 w-8" /> Rec
                </div>
              )}
            </button>
          </div>

          <div className="mt-6 text-center text-sm text-zinc-400">
            Configura microfono, cartelle e workspace da{" "}
            <strong>Impostazioni → Registrazione</strong>.
          </div>

          <PromptLibrary
            prompts={context.prompts}
            loading={context.promptLoading}
            selection={context.promptState}
            onSelectPrompt={context.handleSelectPromptTemplate}
            onClearSelection={context.handleClearPromptSelection}
            favorites={context.promptFavorites}
            onToggleFavorite={context.handleTogglePromptFavorite}
            onRefresh={context.handleRefreshPrompts}
            themeStyles={themes[theme]}
            activePrompt={context.activePrompt}
            focusValue={context.promptState.focus}
            onFocusChange={context.handlePromptFocusChange}
            notesValue={context.promptState.notes}
            onNotesChange={context.handlePromptNotesChange}
            cueProgress={context.promptState.cueProgress || {}}
            onCueToggle={context.handleTogglePromptCue}
            onCreatePrompt={context.handleCreatePrompt}
            onDeletePrompt={context.handleDeletePrompt}
          />

          <div
            className={classNames(
              "mt-6 rounded-xl border p-4",
              themes[theme].input,
            )}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm text-zinc-400">
                Clip registrata / caricata
              </div>
              <div className="text-xs text-zinc-500">
                {context.mime || "—"} ·{" "}
                {context.fmtBytes(context.audioBlob?.size)}
              </div>
            </div>
            <div className="mt-3">
              {context.audioUrl ? (
                <audio controls src={context.audioUrl} className="w-full" />
              ) : (
                <div className="text-sm text-zinc-500">
                  Nessuna clip disponibile.
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => context.processViaBackend()}
                disabled={
                  !context.audioBlob ||
                  context.busy ||
                  context.backendUp === false
                }
                className={classNames(
                  "flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500",
                  (!context.audioBlob ||
                    context.busy ||
                    context.backendUp === false) &&
                    "cursor-not-allowed opacity-60",
                )}
              >
                <Cpu className="h-4 w-4" /> Avvia pipeline
              </button>
              <a
                href={context.audioUrl}
                download={`recording.${audioDownloadExtension}`}
                className={classNames(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium",
                  themes[theme].button,
                  !context.audioUrl && "pointer-events-none opacity-50",
                )}
              >
                <Download className="h-4 w-4" /> Scarica audio
              </a>
              <button
                type="button"
                onClick={context.resetAll}
                className={classNames(
                  "rounded-lg px-4 py-2 text-sm",
                  themes[theme].button,
                )}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div
              className={classNames(
                "rounded-2xl border p-4 transition-all",
                themes[theme].input,
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => context.fileInputRef.current?.click()}
                  className={classNames(
                    "flex flex-1 items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold text-zinc-100 transition focus:outline-none focus:ring-2 focus:ring-indigo-400",
                    themes[theme].button,
                  )}
                >
                  <Upload className="h-4 w-4" />
                  Carica audio
                </button>
                <input
                  ref={context.fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={context.onPickFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => toggleInfo("audio")}
                  aria-label="Informazioni su Carica audio"
                  aria-expanded={openInfo === "audio"}
                  aria-controls="upload-audio-info"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700/60 bg-zinc-900/40 text-zinc-300 transition hover:border-indigo-400 hover:text-indigo-300"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              {openInfo === "audio" && (
                <div
                  id="upload-audio-info"
                  className="mt-3 space-y-2 rounded-xl border border-zinc-700/60 bg-zinc-900/40 p-3 text-xs text-zinc-400"
                >
                  <p>
                    Usa un file audio esistente come sorgente alternativa alla
                    registrazione.
                  </p>
                  <p>
                    Avvia la pipeline dalla card «Clip registrata / caricata»
                    per elaborare questo audio una volta caricato.
                  </p>
                  <p>
                    Supporta formati comuni (webm/ogg/m4a/wav). Verrà convertito
                    in WAV lato server.
                  </p>
                </div>
              )}
              {context.audioBlob && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-zinc-700/50 bg-zinc-900/30 px-3 py-2 text-xs text-zinc-400">
                  <span
                    className="max-w-[160px] truncate"
                    title={
                      "name" in context.audioBlob && context.audioBlob.name
                        ? context.audioBlob.name
                        : "Registrazione pronta"
                    }
                  >
                    {"name" in context.audioBlob && context.audioBlob.name
                      ? context.audioBlob.name
                      : "Registrazione pronta"}
                  </span>
                  {Number.isFinite(context.audioBlob.size) && (
                    <span>· {context.fmtBytes(context.audioBlob.size)}</span>
                  )}
                </div>
              )}
            </div>

            <div
              className={classNames(
                "rounded-2xl border p-4 transition-all",
                themes[theme].input,
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => context.markdownInputRef.current?.click()}
                  className={classNames(
                    "flex flex-1 items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold text-zinc-100 transition focus:outline-none focus:ring-2 focus:ring-emerald-400",
                    themes[theme].button,
                    context.busy && "cursor-not-allowed opacity-60",
                  )}
                  disabled={context.busy}
                >
                  <FileCode className="h-4 w-4" />
                  Carica Markdown
                </button>
                <input
                  ref={context.markdownInputRef}
                  type="file"
                  accept=".md,text/markdown"
                  onChange={context.handleMarkdownFilePicked}
                  className="hidden"
                  disabled={context.busy}
                />
                <button
                  type="button"
                  onClick={() => toggleInfo("markdown")}
                  aria-label="Informazioni su Carica Markdown"
                  aria-expanded={openInfo === "markdown"}
                  aria-controls="upload-markdown-info"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700/60 bg-zinc-900/40 text-zinc-300 transition hover:border-emerald-400 hover:text-emerald-300"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              {openInfo === "markdown" && (
                <div
                  id="upload-markdown-info"
                  className="mt-3 space-y-2 rounded-xl border border-zinc-700/60 bg-zinc-900/40 p-3 text-xs text-zinc-400"
                >
                  <p>
                    Carica un documento .md già strutturato per impaginarlo
                    subito con PPUBR.
                  </p>
                  <p>
                    Supporta solo file Markdown. L&apos;impaginazione usa PPUBR
                    con fallback Pandoc.
                  </p>
                </div>
              )}
              {context.lastMarkdownUpload && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-zinc-700/50 bg-zinc-900/30 px-3 py-2 text-xs text-zinc-400">
                  <span
                    className="max-w-[160px] truncate"
                    title={context.lastMarkdownUpload.name}
                  >
                    {context.lastMarkdownUpload.name}
                  </span>
                  <span>
                    · {context.fmtBytes(context.lastMarkdownUpload.size)}
                  </span>
                </div>
              )}
            </div>

            <div
              className={classNames(
                "rounded-2xl border p-4 transition-all",
                themes[theme].input,
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => context.textInputRef.current?.click()}
                  className={classNames(
                    "flex flex-1 items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold text-zinc-100 transition focus:outline-none focus:ring-2 focus:ring-sky-400",
                    themes[theme].button,
                    context.busy && "cursor-not-allowed opacity-60",
                  )}
                  disabled={context.busy}
                >
                  <FileText className="h-4 w-4" />
                  Carica TXT
                </button>
                <input
                  ref={context.textInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  onChange={context.handleTextFilePicked}
                  className="hidden"
                  disabled={context.busy}
                />
                <button
                  type="button"
                  onClick={() => toggleInfo("text")}
                  aria-label="Informazioni su Carica TXT"
                  aria-expanded={openInfo === "text"}
                  aria-controls="upload-text-info"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700/60 bg-zinc-900/40 text-zinc-300 transition hover:border-sky-400 hover:text-sky-300"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              {openInfo === "text" && (
                <div
                  id="upload-text-info"
                  className="mt-3 space-y-2 rounded-xl border border-zinc-700/60 bg-zinc-900/40 p-3 text-xs text-zinc-400"
                >
                  <p>
                    Carica un file .txt: lo convertiamo in Markdown e avviamo
                    l&apos;impaginazione.
                  </p>
                  <p>
                    Supporta file UTF-8 .txt. Il contenuto viene ripulito e
                    salvato come Markdown prima dell&apos;upload.
                  </p>
                </div>
              )}
              {context.lastTextUpload && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-zinc-700/50 bg-zinc-900/30 px-3 py-2 text-xs text-zinc-400">
                  <span
                    className="max-w-[160px] truncate"
                    title={context.lastTextUpload.name}
                  >
                    {context.lastTextUpload.name}
                  </span>
                  <span>· {context.fmtBytes(context.lastTextUpload.size)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="md:col-span-1">
          <div
            className={classNames(
              "space-y-4 rounded-2xl border p-5 shadow-lg",
              themes[theme].card,
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-lg font-medium">
                <Cpu className="h-4 w-4" /> Pipeline
              </h3>
              <div className="flex items-center gap-2">
                <span
                  className={classNames(
                    "inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-medium transition",
                    context.headerStatus?.className,
                  )}
                >
                  <HeaderIcon className="h-4 w-4" />
                  {context.headerStatus?.text}
                </span>
                <button
                  type="button"
                  onClick={() => context.setShowRawLogs((prev) => !prev)}
                  className={classNames(
                    "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                    themes[theme].input,
                    themes[theme].input_hover,
                  )}
                >
                  <Bug className="h-3.5 w-3.5" />
                  {context.showRawLogs
                    ? "Nascondi log grezzi"
                    : "Mostra log grezzi"}
                </button>
              </div>
            </div>
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-indigo-300 to-emerald-300 transition-all duration-500"
                  style={{ width: `${context.progressPercent}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                <span>
                  {context.completedStagesCount}/{context.totalStages} step
                  completati
                </span>
                <span>{context.progressPercent}%</span>
              </div>
            </div>
            <div className="space-y-4">
              {context.PIPELINE_STAGES.map((stage, index) => {
                const status = context.pipelineStatus[stage.key] || "idle";
                const Icon = stage.icon || Cpu;
                const prevStatus =
                  index > 0
                    ? context.pipelineStatus[
                        context.PIPELINE_STAGES[index - 1].key
                      ] || "idle"
                    : null;
                const connectorClass =
                  prevStatus === "done"
                    ? "bg-emerald-500/40"
                    : prevStatus === "failed"
                      ? "bg-rose-500/40"
                      : "bg-zinc-700/60";
                const stageStyle =
                  context.STAGE_STATUS_STYLES[status] ||
                  context.STAGE_STATUS_STYLES.idle;
                const isActive = context.failedStage
                  ? context.failedStage.key === stage.key
                  : context.activeStageKey === stage.key;
                const stageMessage = context.stageMessages[stage.key];

                return (
                  <div key={stage.key} className="relative pl-10">
                    {index !== 0 && (
                      <div
                        className={classNames(
                          "absolute left-3 top-0 h-full w-px transition-colors",
                          connectorClass,
                        )}
                      />
                    )}
                    <div
                      className={classNames(
                        "absolute left-0 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border text-xs transition-all",
                        stageStyle,
                        isActive && "ring-2 ring-indigo-400/60",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div
                      className={classNames(
                        "rounded-lg border px-3 py-2 transition-all",
                        stageStyle,
                        isActive && "shadow-lg shadow-indigo-500/10",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-zinc-100">
                          {stage.label}
                        </div>
                        <span
                          className={classNames(
                            "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                            stageStyle,
                            status === "running" && "animate-pulse",
                          )}
                        >
                          {context.STAGE_STATUS_LABELS[status] || status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-300">
                        {stage.description}
                      </p>
                      {stageMessage && (
                        <div
                          className={classNames(
                            "mt-2 whitespace-pre-wrap rounded-md border px-3 py-2 text-xs font-mono leading-relaxed",
                            status === "failed"
                              ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                              : "border-zinc-700/60 bg-black/20 text-zinc-200",
                          )}
                        >
                          {stageMessage}
                        </div>
                      )}
                      {status === "failed" && stage.help && (
                        <div className="mt-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                          {stage.help}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {!context.showRawLogs && context.logs?.length > 0 && (
              <div className="text-xs text-zinc-500">
                {context.logs.length} righe di log disponibili. Apri i log
                grezzi per i dettagli completi.
              </div>
            )}
            {context.showRawLogs && (
              <div
                className={classNames(
                  "mt-2 max-h-56 overflow-auto rounded-xl border p-3 font-mono text-xs leading-relaxed",
                  themes[theme].log,
                )}
              >
                {context.logs?.length ? (
                  context.logs.map((line, index) => (
                    <div key={index} className="whitespace-pre-wrap">
                      {line}
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-500">Nessun log ancora.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePage;
