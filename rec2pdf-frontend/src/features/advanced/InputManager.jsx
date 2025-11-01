import { useMemo, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  CheckCircle2,
  Cpu,
  Download,
  FileCode,
  FileText,
  Info,
  Mic,
  Plus,
  RefreshCw,
  Sparkles,
  Square,
  TimerIcon,
  Upload,
  Users,
} from "../../components/icons";
import PromptLibrary from "../../components/PromptLibrary";
import { classNames } from "../../utils/classNames";

const InputManager = ({
  context,
  theme,
  themes,
  isBoardroom,
  boardroomPrimarySurface,
  boardroomSecondarySurface,
  boardroomChipSurface,
  boardroomInfoSurface,
  trackEvent,
  canStartPipeline,
  audioDownloadExtension,
}) => {
  // TODO(Task 5): Strip recording/upload widgets from Advanced mode so this
  // component focuses on parameter selectors and criteria controls only.
  const {
    activeWorkspaceProfiles = [],
    activeWorkspaceProfile,
    workspaceProfileSelection,
    workspaceProfileLocked,
    applyWorkspaceProfile,
    clearWorkspaceProfile,
  } = context;

  const [openInfo, setOpenInfo] = useState(null);
  const pdfLogoInputRef = useRef(null);

  const toggleInfo = (section) => {
    setOpenInfo((prev) => (prev === section ? null : section));
  };

  const handlePdfLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      context.setCustomPdfLogo(file);
      event.target.value = "";
    }
  };

  const pdfLogoLabel = useMemo(() => {
    const { customPdfLogo } = context;
    if (!customPdfLogo) return null;
    if (typeof customPdfLogo === "string") {
      return customPdfLogo;
    }
    if (
      typeof customPdfLogo === "object" &&
      customPdfLogo &&
      customPdfLogo.source === "workspace-profile"
    ) {
      return (
        customPdfLogo.label ||
        customPdfLogo.profileId ||
        "Logo profilo workspace"
      );
    }
    if (customPdfLogo?.name) {
      return customPdfLogo.name;
    }
    return "Logo personalizzato";
  }, [context.customPdfLogo]);

  const pdfLogoPreviewUrl = useMemo(() => {
    const value = context.customPdfLogo;
    if (value && typeof value === "object" && value.source === "workspace-profile") {
      if (value.downloadUrl && /^https?:\/\//i.test(value.downloadUrl)) {
        return value.downloadUrl;
      }
      if (value.path && /^https?:\/\//i.test(value.path)) {
        return value.path;
      }
    }
    if (typeof value === "string" && /^https?:\/\//i.test(value)) {
      return value;
    }
    return "";
  }, [context.customPdfLogo]);

  const hasWorkspaceProfiles = activeWorkspaceProfiles.length > 0;

  const handleWorkspaceProfileSelect = (event) => {
    const value = event.target.value;
    if (!value) {
      clearWorkspaceProfile();
      return;
    }
    const result = applyWorkspaceProfile(value);
    if (!result.ok && result.message) {
      context.setErrorBanner({
        title: "Profilo non applicabile",
        details: result.message,
      });
    } else if (result.ok) {
      context.setErrorBanner(null);
    }
  };

  return (
    <div
      className={classNames(
        "md:col-span-2 rounded-2xl border p-6 shadow-lg",
        isBoardroom ? boardroomPrimarySurface : themes[theme].card
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-medium">
          <Mic className="h-5 w-5" /> Registrazione
        </h2>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <TimerIcon className="h-4 w-4" /> {context.fmtTime(context.elapsed)}
        </div>
      </div>

      <div className="mt-8 flex items-center justify-center">
        <button
          type="button"
          aria-pressed={context.recording}
          onClick={context.recording ? context.stopRecording : context.startRecording}
          className={classNames(
            "group relative flex h-44 w-44 items-center justify-center overflow-hidden rounded-full text-center text-white transition-all duration-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
            "before:absolute before:inset-[7%] before:rounded-full before:border before:border-white/15 before:opacity-90 before:transition-opacity before:content-['']",
            context.recording
              ? "bg-gradient-to-br from-rose-500 via-rose-600 to-rose-700 shadow-[0_28px_55px_-28px_rgba(244,63,94,0.95)] focus-visible:ring-4 focus-visible:ring-rose-300/60 animate-pulse"
              : "bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 shadow-[0_32px_70px_-30px_rgba(16,185,129,0.9)] hover:-translate-y-1 hover:shadow-[0_42px_90px_-32px_rgba(16,185,129,0.95)] focus-visible:ring-4 focus-visible:ring-emerald-300/70"
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
            <div className="pointer-events-none flex flex-col items-center gap-3">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-white/15 shadow-inner shadow-rose-900/30">
                <Square className="h-7 w-7" />
              </span>
              <span className="text-sm font-semibold uppercase tracking-[0.32em] text-white/90">
                Stop
              </span>
              <span className="text-xs font-medium text-white/70">
                Registrazione attiva
              </span>
            </div>
          ) : (
            <div className="pointer-events-none flex flex-col items-center gap-3">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-inner shadow-emerald-900/30 transition-transform duration-300 group-hover:scale-105 group-active:scale-95">
                <Mic className="h-7 w-7" />
              </span>
              <span className="text-sm font-semibold uppercase tracking-[0.32em] text-white/90">
                Rec
              </span>
              <span className="text-xs font-medium text-white/70">
                Avvia nuova sessione
              </span>
            </div>
          )}
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div
          className={classNames(
            "rounded-2xl border p-4 transition-all",
            isBoardroom ? boardroomSecondarySurface : themes[theme].input
          )}
        >
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <Sparkles className="h-4 w-4" /> Profilo preconfigurato
            </label>
            {workspaceProfileLocked && (
              <button
                type="button"
                onClick={() => clearWorkspaceProfile()}
                className="rounded-lg border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
              >
                Scollega
              </button>
            )}
          </div>
          <select
            className={classNames(
              "mt-3 w-full rounded-lg border px-3 py-2 text-sm text-surface-50 outline-none transition-colors",
              "focus:border-brand-400 focus:ring-2 focus:ring-brand-300/40 focus:ring-offset-0",
              "disabled:cursor-not-allowed disabled:opacity-60",
              themes[theme].input,
              !hasWorkspaceProfiles || !context.workspaceSelection.workspaceId
                ? "cursor-not-allowed opacity-60"
                : ""
            )}
            value={workspaceProfileSelection?.profileId || ""}
            onChange={handleWorkspaceProfileSelect}
            disabled={!context.workspaceSelection.workspaceId || !hasWorkspaceProfiles}
          >
            <option value="">Nessun profilo</option>
            {activeWorkspaceProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label || profile.id}
              </option>
            ))}
          </select>
          {!context.workspaceSelection.workspaceId && (
            <div className="mt-2 text-xs text-zinc-500">
              Seleziona un workspace per visualizzare i profili salvati.
            </div>
          )}
          {context.workspaceSelection.workspaceId && !hasWorkspaceProfiles && (
            <div className="mt-2 text-xs text-zinc-500">
              Nessun profilo configurato per questo workspace.
            </div>
          )}
          {workspaceProfileLocked && activeWorkspaceProfile && (
            <div className="mt-3 space-y-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-100">
              <div className="text-sm font-medium text-emerald-200">
                Profilo attivo: {activeWorkspaceProfile.label || activeWorkspaceProfile.id}
              </div>
              <div>Cartella: {activeWorkspaceProfile.destDir || "—"}</div>
              <div>Slug: {activeWorkspaceProfile.slug || "—"}</div>
              <div>Prompt: {activeWorkspaceProfile.promptId || "—"}</div>
            </div>
          )}
        </div>
        <div
          className={classNames(
            "rounded-2xl border p-4 transition-all",
            isBoardroom ? boardroomSecondarySurface : themes[theme].input
          )}
        >
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <FileText className="h-4 w-4" /> Cartella
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => context.setDestDir(context.DEFAULT_DEST_DIR)}
                className={classNames(
                  "rounded-lg border px-2 py-1 text-xs",
                  themes[theme].input,
                  themes[theme].input_hover,
                  workspaceProfileLocked && "cursor-not-allowed opacity-50"
                )}
                disabled={workspaceProfileLocked}
              >
                Reimposta
              </button>
              <button
                type="button"
                onClick={() => context.setShowDestDetails((prev) => !prev)}
                className="text-zinc-400 hover:text-zinc-200"
                aria-label="Mostra dettagli cartella"
                aria-expanded={context.showDestDetails}
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
          </div>
          <input
            className={classNames(
              "mt-2 w-full rounded-lg border px-3 py-2 outline-none",
              themes[theme].input,
              context.destIsPlaceholder &&
                "border-rose-600 focus:border-rose-500 focus:ring-rose-500/30"
            )}
            value={context.destDir}
            onChange={(event) => context.setDestDir(event.target.value)}
            placeholder="Es. /Users/mario/Recordings"
            type="text"
            autoComplete="off"
            spellCheck={false}
            disabled={workspaceProfileLocked}
          />
          {context.showDestDetails && (
            <div
              className={classNames(
                "mt-2 text-xs",
                context.destIsPlaceholder ? "text-rose-400" : "text-zinc-500"
              )}
            >
              {context.destIsPlaceholder
                ? `Completa il percorso partendo da "${context.DEFAULT_DEST_DIR}" con il tuo username e la cartella finale (es. /Users/mario/Recordings). Lascia "${context.DEFAULT_DEST_DIR}" o il campo vuoto per usare la cartella predefinita del backend.`
                : `Lascia "${context.DEFAULT_DEST_DIR}" o il campo vuoto per usare la cartella predefinita del backend.`}
            </div>
          )}
        </div>
        <div
          className={classNames(
            "rounded-2xl border p-4 transition-all",
            isBoardroom ? boardroomSecondarySurface : themes[theme].input
          )}
        >
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <FileText className="h-4 w-4" /> Slug
          </label>
          <input
            className={classNames(
              "mt-2 w-full rounded-lg border bg-transparent px-3 py-2 outline-none",
              themes[theme].input
            )}
            value={context.slug}
            onChange={(event) => context.setSlug(event.target.value)}
            placeholder="meeting"
            disabled={workspaceProfileLocked}
          />
        </div>
      </div>

      <div
        className={classNames(
          "mt-4 space-y-3 rounded-2xl border p-5 transition-all",
          isBoardroom ? boardroomSecondarySurface : themes[theme].input
        )}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Users className="h-4 w-4" />
              <span>Workspace &amp; progetto</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={context.handleRefreshWorkspaces}
                className={classNames(
                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
                  themes[theme].input,
                  themes[theme].input_hover,
                  context.workspaceLoading && "opacity-60 cursor-not-allowed"
                )}
                disabled={context.workspaceLoading}
              >
                <RefreshCw
                  className={classNames(
                    "h-3.5 w-3.5",
                    context.workspaceLoading ? "animate-spin" : ""
                  )}
                />
                Aggiorna
              </button>
              <button
                type="button"
                onClick={() => context.openSettingsDrawer?.("workspace")}
                className={classNames(
                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
                  themes[theme].input,
                  themes[theme].input_hover
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                Gestisci workspace
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs text-zinc-500">Workspace</label>
              <select
                value={context.workspaceSelection.workspaceId}
                onChange={(event) =>
                  context.handleSelectWorkspaceForPipeline(event.target.value)
                }
                className={classNames(
                  "mt-2 w-full rounded-lg border px-3 py-2 text-sm text-surface-50 outline-none transition-colors",
                  "focus:border-brand-400 focus:ring-2 focus:ring-brand-300/40 focus:ring-offset-0",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  themes[theme].input
                )}
              >
                <option value="">Nessun workspace</option>
                {context.workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name} · {workspace.client || "—"}
                  </option>
                ))}
              </select>
            </div>
            {context.workspaceSelection.workspaceId && (
              <div>
                <label className="text-xs text-zinc-500">Policy di versioning</label>
                <div className="mt-2 text-xs text-zinc-400">
                  {context.activeWorkspace?.versioningPolicy
                    ? `${
                        context.activeWorkspace.versioningPolicy.namingConvention || "timestamped"
                      } · retention ${
                        context.activeWorkspace.versioningPolicy.retentionLimit || 10
                      }`
                    : "Timestamp standard"}
                </div>
              </div>
            )}
          </div>

          {context.workspaceSelection.workspaceId && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-zinc-500">Progetto</label>
                <select
                  value={
                    context.projectCreationMode
                      ? "__new__"
                      : context.workspaceSelection.projectId
                  }
                  onChange={(event) =>
                    context.handleSelectProjectForPipeline(event.target.value)
                  }
                  className={classNames(
                    "mt-2 w-full rounded-lg border px-3 py-2 text-sm text-surface-50 outline-none transition-colors",
                    "focus:border-brand-400 focus:ring-2 focus:ring-brand-300/40 focus:ring-offset-0",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    themes[theme].input
                  )}
                >
                  <option value="">Nessun progetto</option>
                  {context.workspaceProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                  <option value="__new__">+ Nuovo progetto…</option>
                </select>
                {context.projectCreationMode && (
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                    <input
                      value={context.projectDraft}
                      onChange={(event) => context.setProjectDraft(event.target.value)}
                      placeholder="Nome progetto"
                      className={classNames(
                        "rounded-lg border bg-transparent px-3 py-2 text-sm",
                        themes[theme].input
                      )}
                    />
                    <input
                      value={context.projectStatusDraft}
                      onChange={(event) =>
                        context.setProjectStatusDraft(event.target.value)
                      }
                      placeholder="Stato"
                      className={classNames(
                        "rounded-lg border bg-transparent px-3 py-2 text-sm",
                        themes[theme].input
                      )}
                    />
                    <div className="md:col-span-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={context.handleCancelProjectDraft}
                        className={classNames(
                          "rounded-lg border px-3 py-1.5 text-xs",
                          themes[theme].input,
                          themes[theme].input_hover
                        )}
                      >
                        Annulla
                      </button>
                      <button
                        type="button"
                        onClick={context.handleCreateProjectFromDraft}
                        className={classNames(
                          "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
                          themes[theme].input,
                          themes[theme].input_hover,
                          (!context.projectDraft.trim() || context.projectCreationMode) &&
                            "cursor-not-allowed opacity-60"
                        )}
                        disabled={!context.projectDraft.trim() || context.projectCreationMode}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Salva progetto
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-zinc-500">Stato</label>
                <select
                  value={
                    context.statusCreationMode
                      ? "__new__"
                      : context.workspaceSelection.status || ""
                  }
                  onChange={(event) =>
                    context.handleSelectStatusForPipeline(event.target.value)
                  }
                  className={classNames(
                    "mt-2 w-full rounded-lg border px-3 py-2 text-sm text-surface-50 outline-none transition-colors",
                    "focus:border-brand-400 focus:ring-2 focus:ring-brand-300/40 focus:ring-offset-0",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    themes[theme].input
                  )}
                >
                  <option value="">Nessuno stato</option>
                  {context.availableStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                  <option value="__new__">+ Nuovo stato…</option>
                </select>
                {context.statusCreationMode && (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={context.statusDraft}
                      onChange={(event) => context.setStatusDraft(event.target.value)}
                      placeholder="Nuovo stato"
                      className={classNames(
                        "flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm",
                        themes[theme].input
                      )}
                    />
                    <button
                      type="button"
                      onClick={context.handleCreateStatusFromDraft}
                      className={classNames(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                        themes[theme].input,
                        themes[theme].input_hover,
                        (!context.statusDraft.trim() || context.statusCreationMode) &&
                          "cursor-not-allowed opacity-60"
                      )}
                      disabled={!context.statusDraft.trim() || context.statusCreationMode}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Aggiungi stato
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-zinc-400">Clip registrata / caricata</div>
          <div className="text-xs text-zinc-500">
            {context.mime || "—"} · {context.fmtBytes(context.audioBlob?.size)}
          </div>
        </div>
        <div>
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
            disabled={!canStartPipeline}
            className={classNames(
              "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
              isBoardroom
                ? "shadow-[0_26px_60px_-32px_rgba(61,176,255,0.85)] focus-visible:ring-sky-200/70 hover:shadow-[0_34px_80px_-36px_rgba(61,176,255,0.95)]"
                : "text-white shadow-sm focus-visible:ring-indigo-300 hover:shadow",
              themes[theme].button,
              !canStartPipeline && "cursor-not-allowed opacity-60"
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
              !context.audioUrl && "pointer-events-none opacity-50"
            )}
            onClick={() => {
              if (!context.audioUrl) {
                return;
              }
              trackEvent("pipeline.export_audio", {
                mime: context.mime || "",
                size: context.audioBlob?.size ?? 0,
                extension: audioDownloadExtension,
              });
            }}
          >
            <Download className="h-4 w-4" /> Scarica audio
          </a>
          <button
            type="button"
            onClick={context.resetAll}
            disabled={context.busy}
            className={classNames(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm",
              themes[theme].button,
              context.busy && "cursor-not-allowed opacity-60"
            )}
          >
            <RefreshCw className="h-4 w-4" /> Nuova sessione
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div
          className={classNames(
            "rounded-2xl border p-4 transition-all",
            isBoardroom ? boardroomSecondarySurface : themes[theme].input
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => context.fileInputRef.current?.click()}
              className={classNames(
                "flex flex-1 items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold text-zinc-100 transition focus:outline-none focus:ring-2 focus:ring-indigo-400",
                themes[theme].button
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
              className={classNames(
                "flex h-9 w-9 items-center justify-center rounded-full transition",
                isBoardroom
                  ? "border border-white/20 bg-white/[0.02] text-slate-200 hover:border-white/45 hover:bg-white/[0.06]"
                  : "border border-zinc-700/60 bg-zinc-900/40 text-zinc-300 hover:border-indigo-400 hover:text-indigo-300"
              )}
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
          {openInfo === "audio" && (
            <div
              id="upload-audio-info"
              className={classNames(
                "mt-3 space-y-2 rounded-xl border p-3 text-xs",
                isBoardroom
                  ? boardroomInfoSurface
                  : "border-zinc-700/60 bg-zinc-900/40 text-zinc-400"
              )}
            >
              <p>Usa un file audio esistente come sorgente alternativa alla registrazione.</p>
              <p>
                Avvia la pipeline dalla card «Clip registrata / caricata» per elaborare questo audio una volta caricato.
              </p>
              <p>
                Supporta formati comuni (webm/ogg/m4a/wav). Verrà convertito in WAV lato server.
              </p>
            </div>
          )}
          {context.audioBlob && (
            <div
              className={classNames(
                "mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs",
                isBoardroom
                  ? boardroomChipSurface
                  : "border-zinc-700/50 bg-zinc-900/30 text-zinc-400"
              )}
            >
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
            isBoardroom ? boardroomSecondarySurface : themes[theme].input
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => context.markdownInputRef.current?.click()}
              className={classNames(
                "flex flex-1 items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold text-zinc-100 transition focus:outline-none focus:ring-2 focus:ring-emerald-400",
                themes[theme].button,
                context.busy && "cursor-not-allowed opacity-60"
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
              className={classNames(
                "flex h-9 w-9 items-center justify-center rounded-full transition",
                isBoardroom
                  ? "border border-white/20 bg-white/[0.02] text-slate-200 hover:border-white/45 hover:bg-white/[0.06]"
                  : "border border-zinc-700/60 bg-zinc-900/40 text-zinc-300 hover:border-emerald-400 hover:text-emerald-300"
              )}
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
          {openInfo === "markdown" && (
            <div
              id="upload-markdown-info"
              className={classNames(
                "mt-3 space-y-2 rounded-xl border p-3 text-xs",
                isBoardroom
                  ? boardroomInfoSurface
                  : "border-zinc-700/60 bg-zinc-900/40 text-zinc-400"
              )}
            >
              <p>Carica un documento .md già strutturato per impaginarlo subito con PPUBR.</p>
              <p>Supporta solo file Markdown. L&apos;impaginazione usa PPUBR con fallback Pandoc.</p>
            </div>
          )}
          {context.lastMarkdownUpload && (
            <div
              className={classNames(
                "mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs",
                isBoardroom
                  ? boardroomChipSurface
                  : "border-zinc-700/50 bg-zinc-900/30 text-zinc-400"
              )}
            >
              <span
                className="max-w-[160px] truncate"
                title={context.lastMarkdownUpload.name}
              >
                {context.lastMarkdownUpload.name}
              </span>
              <span>· {context.fmtBytes(context.lastMarkdownUpload.size)}</span>
            </div>
          )}
        </div>

        <div
          className={classNames(
            "rounded-2xl border p-4 transition-all",
            isBoardroom ? boardroomSecondarySurface : themes[theme].input
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => context.textInputRef.current?.click()}
              className={classNames(
                "flex flex-1 items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold text-zinc-100 transition focus:outline-none focus:ring-2 focus:ring-sky-400",
                themes[theme].button,
                context.busy && "cursor-not-allowed opacity-60"
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
              className={classNames(
                "flex h-9 w-9 items-center justify-center rounded-full transition",
                isBoardroom
                  ? "border border-white/20 bg-white/[0.02] text-slate-200 hover:border-white/45 hover:bg-white/[0.06]"
                  : "border border-zinc-700/60 bg-zinc-900/40 text-zinc-300 hover:border-sky-400 hover:text-sky-300"
              )}
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
          {openInfo === "text" && (
            <div
              id="upload-text-info"
              className={classNames(
                "mt-3 space-y-2 rounded-xl border p-3 text-xs",
                isBoardroom
                  ? boardroomInfoSurface
                  : "border-zinc-700/60 bg-zinc-900/40 text-zinc-400"
              )}
            >
              <p>Carica un file .txt: lo convertiamo in Markdown e avviamo l&apos;impaginazione.</p>
              <p>
                Supporta file UTF-8 .txt. Il contenuto viene ripulito e salvato come Markdown prima dell&apos;upload.
              </p>
            </div>
          )}
          {context.lastTextUpload && (
            <div
              className={classNames(
                "mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs",
                isBoardroom
                  ? boardroomChipSurface
                  : "border-zinc-700/50 bg-zinc-900/30 text-zinc-400"
              )}
            >
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

      <div
        className={classNames(
          "mt-6 rounded-2xl border p-4 transition-all",
          isBoardroom ? boardroomSecondarySurface : themes[theme].input
        )}
      >
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <FileCode className="h-4 w-4" /> Logo per PDF
          </label>
          {pdfLogoLabel && (
            <span className="max-w-[55%] truncate text-[11px] text-zinc-500" title={pdfLogoLabel}>
              {pdfLogoLabel}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            ref={pdfLogoInputRef}
            type="file"
            accept=".pdf,.svg,.png,.jpg,.jpeg"
            onChange={handlePdfLogoUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => pdfLogoInputRef.current?.click()}
            className={classNames(
              "rounded-lg px-3 py-1.5 text-xs font-medium",
              themes[theme].button,
              workspaceProfileLocked && "cursor-not-allowed opacity-50"
            )}
            disabled={workspaceProfileLocked}
          >
            Carica
          </button>
          {context.customPdfLogo && (
            <button
              type="button"
              onClick={() => context.setCustomPdfLogo(null)}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-500"
              disabled={workspaceProfileLocked}
            >
              Rimuovi
            </button>
          )}
        </div>
        {pdfLogoLabel && (
          <div className="mt-2 truncate text-xs text-zinc-500" title={pdfLogoLabel}>
            {pdfLogoLabel}
          </div>
        )}
        {pdfLogoPreviewUrl && (
          <div className="mt-3 rounded-lg border border-zinc-700/60 bg-zinc-900/60 p-3">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">Anteprima logo</div>
            <img
              src={pdfLogoPreviewUrl}
              alt="Anteprima logo profilo PDF"
              className="mt-2 h-16 w-auto max-w-full object-contain"
            />
          </div>
        )}
      </div>

      <div id="prompt-library" className="mt-6">
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
          themeName={theme}
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
      </div>

      {context.pipelineComplete && (
        <div
          className={classNames(
            "mt-6 space-y-3 rounded-xl border px-4 py-3 text-sm shadow-md transition",
            isBoardroom
              ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-100 shadow-[0_28px_70px_-45px_rgba(16,185,129,0.9)]"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
          )}
        >
          <div className="flex items-start gap-3">
            <span
              className={classNames(
                "flex h-9 w-9 items-center justify-center rounded-full border",
                isBoardroom
                  ? "border-emerald-300/60 bg-emerald-400/20 text-emerald-50"
                  : "border-emerald-400/60 bg-emerald-500/20 text-emerald-50"
              )}
            >
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold tracking-tight">
                Pipeline completata
              </p>
              <p
                className={classNames(
                  "text-xs leading-relaxed",
                  isBoardroom ? "text-emerald-100/90" : "text-emerald-100/85"
                )}
              >
                Il documento generato è stato salvato nella Library con i
                riferimenti della sessione.
              </p>
            </div>
          </div>
          <div>
            <RouterLink
              to="/library"
              className={classNames(
                "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
                isBoardroom
                  ? "border border-emerald-300/60 bg-emerald-400/15 text-emerald-50 hover:bg-emerald-400/25 focus-visible:ring-emerald-200/60"
                  : "border border-emerald-400/60 bg-emerald-500/20 text-emerald-50 hover:bg-emerald-500/30 focus-visible:ring-emerald-200/70"
              )}
            >
              Vai alla Library
            </RouterLink>
          </div>
        </div>
      )}
    </div>
  );
};

export default InputManager;
