import { useMemo, useRef } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  CheckCircle2,
  FileCode,
  FileText,
  Info,
  Plus,
  RefreshCw,
  Sparkles,
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
}) => {
  const {
    activeWorkspaceProfiles = [],
    activeWorkspaceProfile,
    workspaceProfileSelection,
    workspaceProfileLocked,
    applyWorkspaceProfile,
    clearWorkspaceProfile,
    resetInputSelections,
  } = context;

  const pdfLogoInputRef = useRef(null);

  const handlePdfLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      context.setCustomPdfLogo(file);
      event.target.value = "";
    }
  };
// --- NUOVO BLOCCO: Preparazione Opzioni Template ---
const templateOptions = useMemo(() => {
  const baseOptions = [
    { value: "", label: "Nessun template predefinito" }
  ];
  
  const templates = Array.isArray(context.pdfTemplates) ? context.pdfTemplates : [];
  const loadedOptions = templates.map((t) => ({
    value: t.fileName,
    // Creiamo un'etichetta leggibile con il tipo (HTML/TEX)
    label: `${t.name || t.fileName}${t.type ? ` (${t.type.toUpperCase()})` : ""}`,
    // Salviamo l'oggetto originale per recuperarlo al change
    original: t 
  }));

  return [...baseOptions, ...loadedOptions];
}, [context.pdfTemplates]);
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

  const selectedPdfTemplate = useMemo(() => {
    if (!context.pdfTemplateSelection?.fileName) {
      return null;
    }
    const templates = Array.isArray(context.pdfTemplates)
      ? context.pdfTemplates
      : [];
    return (
      templates.find(
        (template) => template.fileName === context.pdfTemplateSelection.fileName,
      ) || null
    );
  }, [context.pdfTemplates, context.pdfTemplateSelection?.fileName]);

  const templateSelectValue = context.pdfTemplateSelection?.fileName || "";

  const templateHelperText = useMemo(() => {
    if (context.pdfTemplatesError) {
      return context.pdfTemplatesError;
    }
    if (context.pdfTemplatesLoading) {
      return "Caricamento template in corso…";
    }
    if (selectedPdfTemplate?.description) {
      return selectedPdfTemplate.description;
    }
    if (templateSelectValue) {
      const hints = [];
      if (selectedPdfTemplate?.type) {
        hints.push(`Tipo ${selectedPdfTemplate.type.toUpperCase()}`);
      }
      if (selectedPdfTemplate?.cssFileName) {
        hints.push(`CSS: ${selectedPdfTemplate.cssFileName}`);
      }
      return hints.length ? hints.join(" • ") : "Template selezionato.";
    }
    if (Array.isArray(context.pdfTemplates) && context.pdfTemplates.length) {
      return "Seleziona un template per personalizzare il layout del PDF.";
    }
    return "Nessun template disponibile. Aggiorna per sincronizzare con il backend.";
  }, [
    context.pdfTemplates,
    context.pdfTemplatesError,
    context.pdfTemplatesLoading,
    selectedPdfTemplate,
    templateSelectValue,
  ]);

  // --- VERSIONE AGGIORNATA ---
  const handleTemplateSelect = (event) => {
    const selectedValue = event.target.value;
    
    if (!selectedValue) {
      context.clearPdfTemplateSelection?.();
      return;
    }

    // Cerchiamo l'oggetto template completo dalla lista originale
    // (Nota: templateOptions contiene già tutto, ma per sicurezza cerchiamo nell'array sorgente)
    const fullTemplate = (context.pdfTemplates || []).find(t => t.fileName === selectedValue);
    
    if (fullTemplate) {
      // Passiamo l'oggetto completo ad App.jsx!
      // App.jsx deve essere in grado di ricevere { fileName, type, css }
      // Se la funzione handleSelectPdfTemplate supporta l'oggetto (come abbiamo visto in App.jsx), questo risolve il bug.
      context.handleSelectPdfTemplate?.({
        fileName: fullTemplate.fileName,
        type: fullTemplate.type,
        css: fullTemplate.cssFileName
      });
    } else {
      // Fallback legacy (solo stringa)
      context.handleSelectPdfTemplate?.(selectedValue);
    }
  };

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

  const containerSurface = isBoardroom
    ? boardroomPrimarySurface
    : "border-white/10 bg-white/10 backdrop-blur-xl";
  const panelSurface = isBoardroom
    ? boardroomSecondarySurface
    : "border-white/10 bg-white/5 backdrop-blur-lg";
  const cardSurface = isBoardroom
    ? boardroomSecondarySurface
    : "border-white/10 bg-white/5 backdrop-blur";
  const chipSurface = isBoardroom
    ? boardroomChipSurface
    : "border border-white/10 bg-white/10 text-white/80 hover:bg-white/20";
  const chipGhostSurface = isBoardroom
    ? "border border-white/20 bg-transparent text-white/75 transition hover:bg-white/10 hover:text-white"
    : "border border-white/10 bg-transparent text-white/70 hover:bg-white/10 hover:text-white";
  const controlSurface = isBoardroom
    ? classNames("border", boardroomInfoSurface)
    : "border border-white/10 bg-white/10";
  const subtleMetaText = isBoardroom ? "text-white/75" : "text-white/65";
  const templateHelperTone = context.pdfTemplatesError ? "text-rose-300" : subtleMetaText;
  const primaryButtonSurface = isBoardroom
    ? classNames(
        "border border-white/20 bg-white/[0.85] text-slate-900 transition hover:bg-white",
        "font-semibold"
      )
    : "border border-white/10 bg-white text-slate-900 font-semibold transition hover:bg-white/90";

  return (
    <div
      className={classNames(
        "rounded-3xl border p-6 shadow-subtle text-white transition",
        containerSurface
      )}
    >
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold uppercase tracking-[0.32em] text-white/80">
            <Sparkles className="h-5 w-5" /> Gestione input
          </h2>
          <button
            type="button"
            onClick={() => resetInputSelections?.()}
            className={classNames(
              "flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition",
              chipSurface,
              "shadow-[0_14px_45px_-28px_rgba(13,62,98,0.95)]",
            )}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Azzera selezioni
          </button>
        </div>
        <p className="text-sm leading-relaxed text-white/60">
          Configura workspace, progetto, slug e branding. La pipeline avanzata
          si avvia automaticamente quando riceve nuovi input condivisi.
        </p>
      </div>

      <div
        className={classNames(
          "mt-8 space-y-4 rounded-3xl border p-5 transition-all",
          panelSurface
        )}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.3em] text-white/70">
              <Users className="h-4 w-4" />
              <span>Workspace &amp; progetto</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={context.handleRefreshWorkspaces}
                className={classNames(
                  "flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition",
                  chipSurface,
                  context.workspaceLoading && "cursor-not-allowed opacity-60"
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
                  "flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition",
                  chipGhostSurface
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                Gestisci workspace
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60">
                Workspace
              </label>
              <select
                value={context.workspaceSelection.workspaceId}
                onChange={(event) =>
                  context.handleSelectWorkspaceForPipeline(event.target.value)
                }
                className={classNames(
                  "mt-2 w-full rounded-2xl px-3 py-2 text-sm text-white/90 outline-none transition",
                  "focus:border-brand-300 focus:ring-2 focus:ring-brand-300/40 focus:ring-offset-0",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  controlSurface
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
                <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60">
                  Policy di versioning
                </label>
                <div className={classNames("mt-2 text-xs", subtleMetaText)}>
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60">
                  Progetto
                </label>
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
                    "mt-2 w-full rounded-2xl px-3 py-2 text-sm text-white/90 outline-none transition",
                    "focus:border-brand-300 focus:ring-2 focus:ring-brand-300/40 focus:ring-offset-0",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    controlSurface
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
                        "rounded-2xl px-3 py-2 text-sm text-white/90 outline-none transition",
                        controlSurface
                      )}
                    />
                    <input
                      value={context.projectStatusDraft}
                      onChange={(event) =>
                        context.setProjectStatusDraft(event.target.value)
                      }
                      placeholder="Stato"
                      className={classNames(
                        "rounded-2xl px-3 py-2 text-sm text-white/90 outline-none transition",
                        controlSurface
                      )}
                    />
                    <div className="md:col-span-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={context.handleCancelProjectDraft}
                        className={classNames(
                          "rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition",
                          chipGhostSurface
                        )}
                      >
                        Annulla
                      </button>
                      <button
                        type="button"
                        onClick={context.handleCreateProjectFromDraft}
                        className={classNames(
                          "flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition",
                          chipSurface,
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
                <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60">
                  Stato
                </label>
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
                    "mt-2 w-full rounded-2xl px-3 py-2 text-sm text-white/90 outline-none transition",
                    "focus:border-brand-300 focus:ring-2 focus:ring-brand-300/40 focus:ring-offset-0",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    controlSurface
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
                        "flex-1 rounded-2xl px-3 py-2 text-sm text-white/90 outline-none transition",
                        controlSurface
                      )}
                    />
                    <button
                      type="button"
                      onClick={context.handleCreateStatusFromDraft}
                      className={classNames(
                        "flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition",
                        chipSurface,
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


      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div
          className={classNames(
            "rounded-2xl border p-4 transition-all text-white/80",
            cardSurface
          )}
        >
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.3em] text-white/70">
              <Sparkles className="h-4 w-4" /> Profilo preconfigurato
            </label>
            {workspaceProfileLocked && (
              <button
                type="button"
                onClick={() => clearWorkspaceProfile()}
                className={classNames(
                  "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition",
                  chipGhostSurface
                )}
              >
                Scollega
              </button>
            )}
          </div>
          <select
            className={classNames(
              "mt-3 w-full rounded-2xl px-3 py-2 text-sm text-white/90 outline-none transition",
              "focus:border-brand-300 focus:ring-2 focus:ring-brand-300/40 focus:ring-offset-0",
              "disabled:cursor-not-allowed disabled:opacity-60",
              controlSurface,
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
            <div className={classNames("mt-2 text-xs", subtleMetaText)}>
              Seleziona un workspace per visualizzare i profili salvati.
            </div>
          )}
          {context.workspaceSelection.workspaceId && !hasWorkspaceProfiles && (
            <div className={classNames("mt-2 text-xs", subtleMetaText)}>
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
            "rounded-2xl border p-4 transition-all text-white/80",
            cardSurface
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.3em] text-white/70">
              <FileCode className="h-4 w-4" /> Template PDF
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => context.refreshPdfTemplates?.()}
                className={classNames(
                  "flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition",
                  chipSurface,
                  context.pdfTemplatesLoading && "cursor-not-allowed opacity-60"
                )}
                disabled={context.pdfTemplatesLoading}
              >
                <RefreshCw
                  className={classNames(
                    "h-3.5 w-3.5",
                    context.pdfTemplatesLoading ? "animate-spin" : ""
                  )}
                />
                Aggiorna
              </button>
              {!workspaceProfileLocked && templateSelectValue && (
                <button
                  type="button"
                  onClick={() => context.clearPdfTemplateSelection?.()}
                  className={classNames(
                    "rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition",
                    chipGhostSurface
                  )}
                >
                  Svuota
                </button>
              )}
            </div>
          </div>
          {workspaceProfileLocked && activeWorkspaceProfile ? (
            <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
              <div>
                Template profilo: {activeWorkspaceProfile.pdfTemplate || "—"}
              </div>
              {activeWorkspaceProfile.pdfTemplateType ? (
                <div>
                  Tipo: {activeWorkspaceProfile.pdfTemplateType.toUpperCase()}
                </div>
              ) : null}
              {activeWorkspaceProfile.pdfTemplateCss ? (
                <div>CSS: {activeWorkspaceProfile.pdfTemplateCss}</div>
              ) : null}
              <p className="pt-1 text-[11px] text-white/55">
                Scollega il profilo per modificare manualmente il template.
              </p>
            </div>
          ) : (
            <>
              <select
                value={templateSelectValue}
                onChange={handleTemplateSelect}
                className={classNames(
                  "mt-3 w-full rounded-2xl px-3 py-2 text-sm text-white/90 outline-none transition",
                  "focus:border-brand-300 focus:ring-2 focus:ring-brand-300/40 focus:ring-offset-0",
                  controlSurface,
                  context.pdfTemplatesLoading && "cursor-not-allowed opacity-60"
                )}
                aria-label="Seleziona template PDF"
                disabled={context.pdfTemplatesLoading}
              >
                {/* Mappiamo le opzioni preparate con useMemo */}
                {templateOptions.map((opt) => (
                  <option key={opt.value || "empty"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className={classNames("mt-2 text-xs", templateHelperTone)}>
                {templateHelperText}
              </div>
            </>
          )}
        </div>
        <div
          className={classNames(
            "rounded-2xl border p-4 transition-all text-white/80",
            cardSurface
          )}
        >
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.3em] text-white/70">
              <FileText className="h-4 w-4" /> Cartella
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => context.setDestDir(context.DEFAULT_DEST_DIR)}
                className={classNames(
                  "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition",
                  chipGhostSurface,
                  workspaceProfileLocked && "cursor-not-allowed opacity-60"
                )}
                disabled={workspaceProfileLocked}
              >
                Reimposta
              </button>
              <button
                type="button"
                onClick={() => context.setShowDestDetails((prev) => !prev)}
                className="text-white/60 transition hover:text-white"
                aria-label="Mostra dettagli cartella"
                aria-expanded={context.showDestDetails}
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
          </div>
          <input
            className={classNames(
              "mt-2 w-full rounded-2xl px-3 py-2 text-sm text-white/90 outline-none transition",
              controlSurface,
              context.destIsPlaceholder &&
                "border-rose-500/80 focus:border-rose-400 focus:ring-rose-400/40"
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
                context.destIsPlaceholder ? "text-rose-300" : subtleMetaText
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
            "rounded-2xl border p-4 transition-all text-white/80",
            cardSurface
          )}
        >
          <label className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.3em] text-white/70">
            <FileText className="h-4 w-4" /> Slug
          </label>
          <input
            className={classNames(
              "mt-2 w-full rounded-2xl px-3 py-2 text-sm text-white/90 outline-none transition",
              controlSurface
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
          "mt-6 rounded-2xl border p-4 transition-all text-white/80",
          cardSurface
        )}
      >
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.3em] text-white/70">
            <FileCode className="h-4 w-4" /> Logo per PDF
          </label>
          {pdfLogoLabel && (
            <span className="max-w-[55%] truncate text-[11px] text-white/65" title={pdfLogoLabel}>
              {pdfLogoLabel}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-3">
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
              "rounded-full px-4 py-1.5 text-[11px] uppercase tracking-[0.2em]",
              primaryButtonSurface,
              workspaceProfileLocked && "cursor-not-allowed opacity-60"
            )}
            disabled={workspaceProfileLocked}
          >
            Carica
          </button>
          {context.customPdfLogo && (
            <button
              type="button"
              onClick={() => context.setCustomPdfLogo(null)}
              className={classNames(
                "rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition",
                "bg-rose-500/90 text-white hover:bg-rose-400",
                workspaceProfileLocked && "cursor-not-allowed opacity-60"
              )}
              disabled={workspaceProfileLocked}
            >
              Rimuovi
            </button>
          )}
        </div>
        {pdfLogoLabel && (
          <div className="mt-2 truncate text-xs text-white/65" title={pdfLogoLabel}>
            {pdfLogoLabel}
          </div>
        )}
        {pdfLogoPreviewUrl && (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/10 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60">
              Anteprima logo
            </div>
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
            "mt-6 space-y-3 rounded-2xl border px-4 py-4 text-sm shadow-subtle transition",
            isBoardroom
              ? "border-emerald-300/60 bg-emerald-400/15 text-emerald-50"
              : "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
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
                "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
                isBoardroom
                  ? "border border-emerald-300/60 bg-emerald-400/25 text-emerald-50 hover:bg-emerald-400/35 focus-visible:ring-emerald-200/60"
                  : "border border-emerald-400/60 bg-emerald-500/25 text-emerald-50 hover:bg-emerald-500/35 focus-visible:ring-emerald-200/70"
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
