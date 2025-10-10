import { useMemo } from "react";
import {
  Bug,
  Cpu,
  Download,
  FileCode,
  FileText,
  Info,
  Mic,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  Sparkles,
  Square,
  TimerIcon,
  Upload,
  Users,
  XCircle,
} from "../components/icons";
import PromptLibrary from "../components/PromptLibrary";
import { useAppContext } from "../hooks/useAppContext";
import { classNames } from "../utils/classNames";

const PermissionBanner = () => {
  const {
    permissionMessage,
    lastMicError,
    secureOK,
  } = useAppContext();

  const ua = navigator.userAgent || "";
  const isChromium = ua.includes("Chrome/") && !ua.includes("Edg/") && !ua.includes("OPR/");
  const isEdge = ua.includes("Edg/");
  const isBrave = isChromium && ua.includes("Brave/");
  const site = encodeURIComponent(window.location.origin);
  const chromeSiteSettings = `chrome://settings/content/siteDetails?site=${site}`;
  const chromeMicSettings = `chrome://settings/content/microphone`;

  return (
    <div className="mt-3 rounded-xl border border-amber-900/40 bg-amber-950/40 p-3 text-sm text-amber-200">
      <div className="font-medium">Permesso microfono necessario</div>
      {permissionMessage && <div className="mt-1 text-amber-100">{permissionMessage}</div>}
      {lastMicError && (
        <div className="mt-1 text-amber-100">
          Dettagli ultimo errore: <code className="text-amber-100">{lastMicError.name}</code>
          {lastMicError.message ? `: ${lastMicError.message}` : ""}
        </div>
      )}
      <ul className="mt-2 space-y-1 list-disc pl-5">
        {!secureOK && (
          <li>
            Servi l'app in HTTPS o usa <code>http://localhost</code>.
          </li>
        )}
        <li>Quando il browser chiede il permesso, scegli <strong>Consenti</strong>.</li>
        <li>
          Se in passato hai negato il permesso, apri le impostazioni del sito (icona lucchetto → Permessi) e abilita il
          microfono.
        </li>
        <li>Su macOS: Sistema → Privacy e Sicurezza → Microfono → abilita il browser.</li>
        {(isChromium || isEdge || isBrave) && (
          <li className="mt-1 space-x-3">
            <a href={chromeSiteSettings} className="underline" target="_blank" rel="noreferrer">
              Apri permessi sito
            </a>
            <a href={chromeMicSettings} className="underline" target="_blank" rel="noreferrer">
              Apri impostazioni microfono
            </a>
          </li>
        )}
      </ul>
    </div>
  );
};

const ErrorBanner = () => {
  const { errorBanner, setErrorBanner } = useAppContext();

  if (!errorBanner) {
    return null;
  }

  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-900/50 bg-rose-950/40 p-3 text-sm text-rose-100">
      <XCircle className="mt-0.5 h-5 w-5" />
      <div className="flex-1">
        <div className="font-medium">{errorBanner.title}</div>
        {errorBanner.details && (
          <div className="mt-1 whitespace-pre-wrap text-rose-200/90">{errorBanner.details}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => setErrorBanner(null)}
        className="text-xs text-rose-200/80 hover:text-rose-100"
      >
        Chiudi
      </button>
    </div>
  );
};

const CreatePage = () => {
  const context = useAppContext();
  const { theme, themes } = context;

  const HeaderIcon = context.headerStatus?.icon || Cpu;

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
        <div className={classNames("md:col-span-2 rounded-2xl border p-6 shadow-lg", themes[theme].card)}>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-medium">
              <Mic className="h-5 w-5" /> Registrazione
            </h2>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <TimerIcon className="h-4 w-4" /> {context.fmtTime(context.elapsed)}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={context.requestPermission}
              className={classNames("rounded-xl border px-4 py-2 text-sm", themes[theme].button)}
            >
              Concedi microfono
            </button>
            <div className="text-sm text-zinc-400">
              Permesso: <span className="font-mono">{context.permission}</span>
            </div>
            <button
              type="button"
              onClick={context.refreshDevices}
              className={classNames(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                themes[theme].button,
              )}
            >
              <RefreshCw className="h-4 w-4" /> Dispositivi
            </button>
          </div>

          {context.permission !== "granted" && <PermissionBanner />}

          {context.permission === "granted" && context.devices.length > 0 && (
            <div className="mt-4">
              <label className="text-sm text-zinc-400">Sorgente microfono</label>
              <select
                value={context.selectedDeviceId}
                onChange={(event) => context.setSelectedDeviceId(event.target.value)}
                className={classNames(
                  "mt-2 w-full rounded-lg border bg-transparent px-3 py-2",
                  themes[theme].input,
                )}
              >
                {context.devices.map((device, index) => (
                  <option key={device.deviceId || index} value={device.deviceId} className="bg-zinc-900">
                    {device.label || `Dispositivo ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-4 flex items-center justify-center">
            <button
              type="button"
              onClick={context.recording ? context.stopRecording : context.startRecording}
              className={classNames(
                "flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-full text-lg font-semibold shadow-xl transition",
                context.recording ? "bg-rose-600 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-500",
              )}
              disabled={
                context.busy || !context.mediaSupported || !context.recorderSupported
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

          <div className="mt-6">
            <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300"
                style={{ width: `${Math.min(100, Math.round(context.level * 120))}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-zinc-500">Input level</div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className={classNames("rounded-xl border p-4", themes[theme].input)}>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  <FileText className="h-4 w-4" /> Cartella destinazione
                </label>
                <button
                  type="button"
                  onClick={() => context.setShowDestDetails((prev) => !prev)}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              <input
                type="text"
                className={classNames(
                  "mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none",
                  themes[theme].input,
                  context.destIsPlaceholder &&
                    "border-rose-600 focus:border-rose-400 focus:ring-rose-400/40",
                )}
                value={context.destDir}
                onChange={(event) => context.setDestDir(event.target.value)}
                placeholder="/Users/tuo_utente/Recordings"
              />
              {context.showDestDetails && (
                <div
                  className={classNames(
                    "mt-2 text-xs",
                    context.destIsPlaceholder ? "text-rose-400" : "text-zinc-500",
                  )}
                >
                  {context.destIsPlaceholder
                    ? "Sostituisci \"tuo_utente\" con il tuo username macOS oppure lascia vuoto per usare la cartella predefinita del backend."
                    : "Lascia vuoto per usare la cartella predefinita del backend."}
                </div>
              )}
            </div>
            <div className={classNames("rounded-xl border p-4", themes[theme].input)}>
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <FileText className="h-4 w-4" /> Slug
              </label>
              <input
                className="mt-2 w-full rounded-lg border-zinc-800 bg-transparent px-3 py-2 outline-none"
                value={context.slug}
                onChange={(event) => context.setSlug(event.target.value)}
                placeholder="meeting"
              />
            </div>
            <div className={classNames("rounded-xl border p-4", themes[theme].input)}>
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <TimerIcon className="h-4 w-4" /> Durata massima (s)
              </label>
              <input
                type="number"
                min={0}
                className="mt-2 w-full rounded-lg border-zinc-800 bg-transparent px-3 py-2 outline-none"
                value={context.secondsCap}
                onChange={(event) =>
                  context.setSecondsCap(
                    Math.max(0, parseInt(event.target.value || "0", 10) || 0),
                  )
                }
              />
              <div className="mt-2 text-xs text-zinc-500">0 = senza limite</div>
            </div>
          </div>

          <div className={classNames("mt-4 rounded-xl border p-4", themes[theme].input)}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Users className="h-4 w-4" />
                  <span>Workspace &amp; progetto</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={context.handleRefreshWorkspaces}
                    className={classNames(
                      "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
                      themes[theme].input,
                      themes[theme].input_hover,
                      context.workspaceLoading && "opacity-60 cursor-not-allowed",
                    )}
                    disabled={context.workspaceLoading}
                  >
                    <RefreshCw
                      className={classNames(
                        "h-3.5 w-3.5",
                        context.workspaceLoading ? "animate-spin" : "",
                      )}
                    />
                    Aggiorna
                  </button>
                  <button
                    type="button"
                    onClick={() => context.setWorkspaceBuilderOpen((prev) => !prev)}
                    className={classNames(
                      "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
                      themes[theme].input,
                      themes[theme].input_hover,
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {context.workspaceBuilderOpen ? "Chiudi builder" : "Nuovo workspace"}
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
                      "mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm",
                      themes[theme].input,
                    )}
                  >
                    <option value="">Nessun workspace</option>
                    {context.workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id} className="bg-zinc-900">
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
              {context.workspaceBuilderOpen && (
                <div className="space-y-3 rounded-lg border border-dashed border-zinc-700 p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs text-zinc-500">Nome</label>
                      <input
                        value={context.workspaceBuilder.name}
                        onChange={(event) =>
                          context.setWorkspaceBuilder((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                        className={classNames(
                          "mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm",
                          themes[theme].input,
                        )}
                        placeholder="Es. Portfolio Clienti"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500">Cliente</label>
                      <input
                        value={context.workspaceBuilder.client}
                        onChange={(event) =>
                          context.setWorkspaceBuilder((prev) => ({
                            ...prev,
                            client: event.target.value,
                          }))
                        }
                        className={classNames(
                          "mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm",
                          themes[theme].input,
                        )}
                        placeholder="Es. Acme Corp"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500">Colore</label>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="color"
                          value={context.workspaceBuilder.color}
                          onChange={(event) =>
                            context.setWorkspaceBuilder((prev) => ({
                              ...prev,
                              color: event.target.value,
                            }))
                          }
                          className="h-9 w-12 rounded border border-zinc-700 bg-transparent"
                        />
                        <span className="font-mono text-xs text-zinc-400">
                          {context.workspaceBuilder.color}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500">Stati suggeriti (comma-separated)</label>
                      <input
                        value={context.workspaceBuilder.statuses}
                        onChange={(event) =>
                          context.setWorkspaceBuilder((prev) => ({
                            ...prev,
                            statuses: event.target.value,
                          }))
                        }
                        className={classNames(
                          "mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm",
                          themes[theme].input,
                        )}
                        placeholder="Bozza, In lavorazione, In review"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={context.handleWorkspaceBuilderSubmit}
                      className={classNames(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
                        themes[theme].button,
                        !context.workspaceBuilder.name.trim() && "opacity-60 cursor-not-allowed",
                      )}
                      disabled={!context.workspaceBuilder.name.trim()}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Crea workspace
                    </button>
                  </div>
                </div>
              )}
              {context.workspaceSelection.workspaceId && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-zinc-500">Progetto</label>
                    <select
                      value={context.projectCreationMode ? "__new__" : context.workspaceSelection.projectId}
                      onChange={(event) =>
                        context.handleSelectProjectForPipeline(event.target.value)
                      }
                      className={classNames(
                        "mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm",
                        themes[theme].input,
                      )}
                    >
                      <option value="">Nessun progetto</option>
                      {context.workspaceProjects.map((project) => (
                        <option key={project.id} value={project.id} className="bg-zinc-900">
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
                            themes[theme].input,
                          )}
                        />
                        <div className="flex gap-2">
                          <input
                            value={context.statusDraft}
                            onChange={(event) => context.setStatusDraft(event.target.value)}
                            placeholder="Stato iniziale"
                            className={classNames(
                              "w-full rounded-lg border bg-transparent px-3 py-2 text-sm",
                              themes[theme].input,
                            )}
                          />
                          <button
                            type="button"
                            onClick={context.handleCreateProjectFromDraft}
                            className={classNames(
                              "flex items-center gap-1 rounded-lg px-3 py-2 text-xs",
                              themes[theme].button,
                              !context.projectDraft.trim() && "opacity-60 cursor-not-allowed",
                            )}
                            disabled={!context.projectDraft.trim()}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Crea
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500">Stato</label>
                    <select
                      value={context.statusCreationMode ? "__new__" : context.workspaceSelection.status || ""}
                      onChange={(event) =>
                        context.handleSelectStatusForPipeline(event.target.value)
                      }
                      className={classNames(
                        "mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm",
                        themes[theme].input,
                      )}
                    >
                      <option value="">Nessun stato</option>
                      {context.availableStatuses.map((statusValue) => (
                        <option key={statusValue} value={statusValue} className="bg-zinc-900">
                          {statusValue}
                        </option>
                      ))}
                      <option value="__new__">+ Nuovo stato…</option>
                    </select>
                    {context.statusCreationMode && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          value={context.statusDraft}
                          onChange={(event) => context.setStatusDraft(event.target.value)}
                          placeholder="Es. In revisione"
                          className={classNames(
                            "w-full rounded-lg border bg-transparent px-3 py-2 text-sm",
                            themes[theme].input,
                          )}
                        />
                        <button
                          type="button"
                          onClick={context.handleCreateStatusFromDraft}
                          className={classNames(
                            "flex items-center gap-1 rounded-lg px-3 py-2 text-xs",
                            themes[theme].button,
                            !context.statusDraft.trim() && "opacity-60 cursor-not-allowed",
                          )}
                          disabled={!context.statusDraft.trim()}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Aggiungi
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
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

          <div className={classNames("mt-6 rounded-xl border p-4", themes[theme].input)}>
            <div className="flex items-center justify-between">
              <div className="text-sm text-zinc-400">Clip registrata / caricata</div>
              <div className="text-xs text-zinc-500">
                {context.mime || "—"} · {context.fmtBytes(context.audioBlob?.size)}
              </div>
            </div>
            <div className="mt-3">
              {context.audioUrl ? (
                <audio controls src={context.audioUrl} className="w-full" />
              ) : (
                <div className="text-sm text-zinc-500">Nessuna clip disponibile.</div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => context.processViaBackend()}
                disabled={!context.audioBlob || context.busy || context.backendUp === false}
                className={classNames(
                  "flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500",
                  (!context.audioBlob || context.busy || context.backendUp === false) &&
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
                className={classNames("rounded-lg px-4 py-2 text-sm", themes[theme].button)}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className={classNames("space-y-4 rounded-2xl border p-5 transition-all", themes[theme].input)}>
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-300">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-100">Carica audio</h4>
                  <p className="text-xs text-zinc-400">
                    Usa un file audio esistente come sorgente alternativa alla registrazione.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={context.fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={context.onPickFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => context.fileInputRef.current?.click()}
                  className={classNames(
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
                    themes[theme].button,
                  )}
                >
                  <Upload className="h-4 w-4" />
                  Seleziona audio
                </button>
              </div>
              {context.audioBlob && (
                <>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span
                      className="max-w-[180px] truncate"
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
                  <p className="text-xs text-zinc-500">
                    Avvia la pipeline dalla card "Clip registrata / caricata" per elaborare questo audio.
                  </p>
                </>
              )}
              <p className="text-xs text-zinc-500">
                Supporta formati comuni (webm/ogg/m4a/wav). Verrà convertito in WAV lato server.
              </p>
            </div>

            <div className={classNames("space-y-4 rounded-2xl border p-5 transition-all", themes[theme].input)}>
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-300">
                  <FileCode className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-100">Carica Markdown</h4>
                  <p className="text-xs text-zinc-400">
                    Carica un documento .md già strutturato per impaginarlo subito con PPUBR.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                  onClick={() => context.markdownInputRef.current?.click()}
                  className={classNames(
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
                    themes[theme].button,
                    context.busy && "cursor-not-allowed opacity-60",
                  )}
                  disabled={context.busy}
                >
                  <Upload className="h-4 w-4" />
                  Seleziona Markdown
                </button>
                {context.lastMarkdownUpload && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span
                      className="max-w-[180px] truncate"
                      title={context.lastMarkdownUpload.name}
                    >
                      {context.lastMarkdownUpload.name}
                    </span>
                    <span>· {context.fmtBytes(context.lastMarkdownUpload.size)}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                Supporta solo file .md. L'impaginazione usa PPUBR con fallback Pandoc.
              </p>
            </div>

            <div className={classNames("space-y-4 rounded-2xl border p-5 transition-all", themes[theme].input)}>
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-sky-500/10 p-2 text-sky-300">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-100">Carica TXT</h4>
                  <p className="text-xs text-zinc-400">
                    Carica un file .txt: lo convertiamo in Markdown e avviamo l'impaginazione.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                  onClick={() => context.textInputRef.current?.click()}
                  className={classNames(
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
                    themes[theme].button,
                    context.busy && "cursor-not-allowed opacity-60",
                  )}
                  disabled={context.busy}
                >
                  <Upload className="h-4 w-4" />
                  Seleziona testo
                </button>
                {context.lastTextUpload && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span
                      className="max-w-[180px] truncate"
                      title={context.lastTextUpload.name}
                    >
                      {context.lastTextUpload.name}
                    </span>
                    <span>· {context.fmtBytes(context.lastTextUpload.size)}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                Supporta file UTF-8 .txt. Il contenuto viene ripulito e salvato come Markdown prima dell'upload.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 md:col-span-1">
          <div className={classNames("rounded-2xl border p-5 shadow-lg", themes[theme].card)}>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-medium">
                <SettingsIcon className="h-4 w-4" /> Stato
              </h3>
            </div>
            <div className="mt-4 space-y-1 text-sm text-zinc-300">
              <div className="flex items-center gap-2">
                <span
                  className={classNames(
                    "h-2 w-2 rounded-full",
                    context.secureOK ? "bg-emerald-500" : "bg-rose-500",
                  )}
                />
                HTTPS/localhost: {context.secureOK ? "OK" : "Richiesto"}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={classNames(
                    "h-2 w-2 rounded-full",
                    context.mediaSupported ? "bg-emerald-500" : "bg-rose-500",
                  )}
                />
                getUserMedia: {context.mediaSupported ? "Supportato" : "No"}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={classNames(
                    "h-2 w-2 rounded-full",
                    context.recorderSupported ? "bg-emerald-500" : "bg-rose-500",
                  )}
                />
                MediaRecorder: {context.recorderSupported ? "Supportato" : "No"}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={classNames(
                    "h-2 w-2 rounded-full",
                    context.backendUp ? "bg-emerald-500" : "bg-rose-500",
                  )}
                />
                Backend: {context.backendUp === null ? "—" : context.backendUp ? "Online" : "Offline"}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={classNames(
                    "h-2 w-2 rounded-full",
                    context.busy ? "bg-yellow-400" : "bg-zinc-600",
                  )}
                />
                Pipeline: {context.busy ? "In esecuzione…" : "Pronta"}
              </div>
            </div>
          </div>

          <div className={classNames("space-y-4 rounded-2xl border p-5 shadow-lg", themes[theme].card)}>
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
                  {context.showRawLogs ? "Nascondi log grezzi" : "Mostra log grezzi"}
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
                  {context.completedStagesCount}/{context.totalStages} step completati
                </span>
                <span>{context.progressPercent}%</span>
              </div>
            </div>
            <div className="space-y-4">
              {context.PIPELINE_STAGES.map((stage, index) => {
                const status = context.pipelineStatus[stage.key] || "idle";
                const Icon = stage.icon || Cpu;
                const prevStatus =
                  index > 0 ? context.pipelineStatus[context.PIPELINE_STAGES[index - 1].key] || "idle" : null;
                const connectorClass =
                  prevStatus === "done"
                    ? "bg-emerald-500/40"
                    : prevStatus === "failed"
                    ? "bg-rose-500/40"
                    : "bg-zinc-700/60";
                const stageStyle = context.STAGE_STATUS_STYLES[status] || context.STAGE_STATUS_STYLES.idle;
                const isActive = context.failedStage
                  ? context.failedStage.key === stage.key
                  : context.activeStageKey === stage.key;
                const stageMessage = context.stageMessages[stage.key];

                return (
                  <div key={stage.key} className="relative pl-10">
                    {index !== 0 && (
                      <div className={classNames("absolute left-3 top-0 h-full w-px transition-colors", connectorClass)} />
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
                        <div className="text-sm font-medium text-zinc-100">{stage.label}</div>
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
                      <p className="mt-1 text-xs text-zinc-300">{stage.description}</p>
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
                {context.logs.length} righe di log disponibili. Apri i log grezzi per i dettagli completi.
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

      {!context.onboardingComplete && (
        <div className="mt-10 text-xs text-zinc-500">
          <p>
            Assicurati che il backend sia attivo su {context.DEFAULT_BACKEND_URL} e che ffmpeg e la toolchain siano configurati
            nella shell di esecuzione.
          </p>
        </div>
      )}
    </div>
  );
};

export default CreatePage;
