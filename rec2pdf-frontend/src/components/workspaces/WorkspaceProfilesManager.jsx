import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "../../hooks/useAppContext";
import { classNames } from "../../utils/classNames";
import { Button, Input, Select } from "../ui";
import {
  AlertCircle,
  FileText,
  Folder,
  Lightbulb,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from "../icons";

const emptyForm = {
  label: "",
  slug: "",
  destDir: "",
  promptId: "",
  pdfTemplate: "",
  pdfTemplateType: "",
  pdfTemplateCss: "",
};

const WorkspaceProfilesManager = () => {
  const {
    workspaces,
    workspaceSelection,
    prompts,
    handleRefreshWorkspaces,
    refreshPdfTemplates,
    createWorkspaceProfile,
    updateWorkspaceProfile,
    deleteWorkspaceProfile,
    pdfTemplates,
    pdfTemplatesLoading,
    pdfTemplatesError,
    DEFAULT_DEST_DIR,
    openSetupAssistant,
    handleSelectWorkspaceForPipeline,
  } = useAppContext();

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
    workspaceSelection.workspaceId || (workspaces[0]?.id ?? "")
  );
  const [formState, setFormState] = useState(emptyForm);
  const [useCustomTemplate, setUseCustomTemplate] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [removePdfLogo, setRemovePdfLogo] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState({ success: "", error: "", details: [] });
  const logoInputRef = useRef(null);

  const resetForm = useCallback(() => {
    setFormState(emptyForm);
    setUseCustomTemplate(false);
    setLogoFile(null);
    setRemovePdfLogo(false);
    setEditingProfileId("");
    setFeedback({ success: "", error: "", details: [] });
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  }, []);

  useEffect(() => {
    const current = workspaces.find((workspace) => workspace.id === selectedWorkspaceId);
    if (!current && workspaces.length) {
      setSelectedWorkspaceId(
        workspaces.find((workspace) => workspace.id === workspaceSelection.workspaceId)?.id || workspaces[0].id
      );
      resetForm();
    }
    if (!workspaces.length) {
      setSelectedWorkspaceId("");
      resetForm();
    }
  }, [workspaces, selectedWorkspaceId, workspaceSelection.workspaceId, resetForm]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) || null,
    [workspaces, selectedWorkspaceId]
  );

  const profiles = useMemo(
    () => (Array.isArray(activeWorkspace?.profiles) ? activeWorkspace.profiles : []),
    [activeWorkspace]
  );

  const projectCount = useMemo(
    () => (Array.isArray(activeWorkspace?.projects) ? activeWorkspace.projects.length : 0),
    [activeWorkspace]
  );

  const promptMap = useMemo(() => {
    const map = new Map();
    (prompts || []).forEach((prompt) => {
      if (prompt?.id) {
        map.set(prompt.id, prompt);
      }
    });
    return map;
  }, [prompts]);

  const selectedTemplate = useMemo(
    () => pdfTemplates.find((template) => template.fileName === formState.pdfTemplate) || null,
    [pdfTemplates, formState.pdfTemplate]
  );

  const templateSelectValue = useMemo(() => {
    if (useCustomTemplate) {
      return "__custom__";
    }
    return selectedTemplate ? selectedTemplate.fileName : "";
  }, [selectedTemplate, useCustomTemplate]);

  const templateCount = pdfTemplates.length;

  const templateHelperText = useMemo(() => {
    if (pdfTemplatesLoading) {
      return "Caricamento template in corso…";
    }
    if (selectedTemplate?.description) {
      return selectedTemplate.description;
    }
    if (useCustomTemplate) {
      return "Inserisci manualmente il file del template e, se necessario, specifica tipo e CSS.";
    }
    if (templateCount === 0) {
      return "Nessun template disponibile dal backend. Usa l'opzione personalizzata per indicarne uno.";
    }
    return "Seleziona un template predefinito o scegli l'opzione personalizzata.";
  }, [pdfTemplatesLoading, selectedTemplate, templateCount, useCustomTemplate]);

  useEffect(() => {
    if (!formState.pdfTemplate) {
      return;
    }
    if (!selectedTemplate && !useCustomTemplate) {
      setUseCustomTemplate(true);
    }
  }, [formState.pdfTemplate, selectedTemplate, useCustomTemplate]);

  useEffect(() => {
    if (selectedTemplate && useCustomTemplate) {
      setUseCustomTemplate(false);
    }
  }, [selectedTemplate, useCustomTemplate]);

  const handleWorkspaceChange = useCallback(
    (event) => {
      const nextId = event.target.value;
      setSelectedWorkspaceId(nextId);
      resetForm();
    },
    [resetForm]
  );

  const handleFieldChange = useCallback((field) => (event) => {
    const value = event.target.value;
    setFormState((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleTemplateSelect = useCallback(
    (event) => {
      const value = event.target.value;
      if (value === "__custom__") {
        setUseCustomTemplate(true);
        setFormState((prev) => ({
          ...prev,
          pdfTemplateType: prev.pdfTemplateType || "",
          pdfTemplateCss: prev.pdfTemplateCss || "",
        }));
        return;
      }

      setUseCustomTemplate(false);

      if (!value) {
        setFormState((prev) => ({
          ...prev,
          pdfTemplate: "",
          pdfTemplateType: "",
          pdfTemplateCss: "",
        }));
        return;
      }

      const template = pdfTemplates.find((item) => item.fileName === value) || null;
      setFormState((prev) => ({
        ...prev,
        pdfTemplate: value,
        pdfTemplateType: template?.type || "",
        pdfTemplateCss: template?.cssFileName || "",
      }));
    },
    [pdfTemplates]
  );

  const handleLogoChange = useCallback((event) => {
    const file = event.target.files?.[0] || null;
    setLogoFile(file);
    if (file) {
      setRemovePdfLogo(false);
    }
  }, []);

  const handleEditProfile = useCallback(
    (profile) => {
      if (!profile) return;
      setEditingProfileId(profile.id);
      setFormState({
        label: profile.label || "",
        slug: profile.slug || "",
        destDir: profile.destDir || "",
        promptId: profile.promptId || "",
        pdfTemplate: profile.pdfTemplate || "",
        pdfTemplateType: profile.pdfTemplateType || "",
        pdfTemplateCss: profile.pdfTemplateCss || "",
      });
      const knownTemplate = pdfTemplates.some((item) => item.fileName === (profile.pdfTemplate || ""));
      setUseCustomTemplate(Boolean(profile.pdfTemplate && !knownTemplate));
      setLogoFile(null);
      setRemovePdfLogo(false);
      setFeedback({ success: "", error: "", details: [] });
    },
    [pdfTemplates]
  );

  const handleDeleteProfile = useCallback(
    async (profile) => {
      if (!profile || !selectedWorkspaceId) {
        return;
      }
      const confirmed = window.confirm(`Eliminare il profilo "${profile.label || profile.id}"?`);
      if (!confirmed) {
        return;
      }
      setPending(true);
      setFeedback({ success: "", error: "", details: [] });
      try {
        const result = await deleteWorkspaceProfile(selectedWorkspaceId, profile.id);
        if (!result.ok) {
          setFeedback({ success: "", error: result.message || "Eliminazione fallita", details: result.details || [] });
          return;
        }
        setFeedback({ success: `Profilo eliminato: ${profile.label || profile.id}`, error: "", details: [] });
        if (editingProfileId === profile.id) {
          resetForm();
        }
      } catch (error) {
        setFeedback({ success: "", error: error?.message || "Eliminazione fallita", details: [] });
      } finally {
        setPending(false);
      }
    },
    [deleteWorkspaceProfile, editingProfileId, resetForm, selectedWorkspaceId]
  );

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!selectedWorkspaceId) {
        setFeedback({ success: "", error: "Seleziona un workspace prima di procedere.", details: [] });
        return;
      }
      if (!formState.label.trim()) {
        setFeedback({ success: "", error: "Il nome del profilo è obbligatorio.", details: [] });
        return;
      }

      setPending(true);
      setFeedback({ success: "", error: "", details: [] });

      try {
        if (editingProfileId) {
          const result = await updateWorkspaceProfile(selectedWorkspaceId, editingProfileId, {
            ...formState,
            pdfLogo: logoFile || undefined,
            removePdfLogo,
          });
          if (!result.ok) {
            setFeedback({ success: "", error: result.message || "Aggiornamento fallito", details: result.details || [] });
            return;
          }
          const updated = result.profile || {};
          setFeedback({ success: `Profilo aggiornato: ${updated.label || formState.label}`, error: "", details: [] });
          setFormState({
            label: updated.label || "",
            slug: updated.slug || "",
            destDir: updated.destDir || "",
            promptId: updated.promptId || "",
            pdfTemplate: updated.pdfTemplate || "",
            pdfTemplateType: updated.pdfTemplateType || "",
            pdfTemplateCss: updated.pdfTemplateCss || "",
          });
          const knownTemplate = pdfTemplates.some((item) => item.fileName === (updated.pdfTemplate || ""));
          setUseCustomTemplate(Boolean(updated.pdfTemplate && !knownTemplate));
          setLogoFile(null);
          setRemovePdfLogo(false);
          if (logoInputRef.current) {
            logoInputRef.current.value = "";
          }
        } else {
          const result = await createWorkspaceProfile(selectedWorkspaceId, {
            ...formState,
            pdfLogo: logoFile || undefined,
          });
          if (!result.ok) {
            setFeedback({ success: "", error: result.message || "Creazione fallita", details: result.details || [] });
            return;
          }
          const created = result.profile || {};
          setFeedback({ success: `Profilo creato: ${created.label || formState.label}`, error: "", details: [] });
          resetForm();
        }
      } catch (error) {
        setFeedback({ success: "", error: error?.message || "Operazione non riuscita", details: [] });
      } finally {
        setPending(false);
      }
    },
    [
      createWorkspaceProfile,
      editingProfileId,
      formState,
      logoFile,
      pdfTemplates,
      removePdfLogo,
      resetForm,
      selectedWorkspaceId,
      updateWorkspaceProfile,
    ]
  );

  const currentProfile = useMemo(
    () => profiles.find((profile) => profile.id === editingProfileId) || null,
    [profiles, editingProfileId]
  );

  const currentLogoLabel = currentProfile?.pdfLogo?.originalName || "";

  const hierarchyCards = useMemo(
    () => [
      {
        key: "workspace",
        title: "Workspace",
        icon: Users,
        description:
          "Contenitore per cliente o business unit: raccoglie palette, stati di default e progetti collegati.",
        meta: activeWorkspace
          ? `Attivo: ${activeWorkspace.name || activeWorkspace.client || activeWorkspace.id}`
          : "Seleziona un workspace per iniziare.",
      },
      {
        key: "project",
        title: "Progetto",
        icon: Folder,
        description:
          "Raggruppa i deliverable all'interno del workspace e definisce cataloghi di stato specifici.",
        meta:
          projectCount > 0
            ? `${projectCount} progetto${projectCount === 1 ? "" : "i"} configurat${
                projectCount === 1 ? "o" : "i"
              }`
            : "Nessun progetto ancora registrato: verrà creato automaticamente dalla pipeline.",
      },
      {
        key: "profile",
        title: "Profilo",
        icon: Sparkles,
        description:
          "Preset riutilizzabile per slug, cartella di destinazione, prompt e template PDF della pipeline.",
        meta:
          profiles.length > 0
            ? `${profiles.length} profil${profiles.length === 1 ? "o" : "i"} salvati`
            : "Crea un profilo per velocizzare i prossimi documenti.",
      },
    ],
    [activeWorkspace, profiles.length, projectCount]
  );

  const prdPrompt = useMemo(() => promptMap.get("prompt_prd") || null, [promptMap]);

  const quickPresets = useMemo(() => {
    if (!prdPrompt) {
      return [];
    }
    const normalizedDefaultDir =
      typeof DEFAULT_DEST_DIR === "string" && DEFAULT_DEST_DIR.trim()
        ? DEFAULT_DEST_DIR.replace(/\/$/, "")
        : "";
    return [
      {
        key: "consulting_prd",
        label: "Profilo PRD consulting",
        description:
          "Precompila con prompt PRD, template consulting e cartella dedicata per i requisiti prodotto.",
        promptId: "prompt_prd",
        slug: "prd_consulting",
        destDir: normalizedDefaultDir ? `${normalizedDefaultDir}/Consulting-PRD` : "",
        pdfTemplate: "default.tex",
        pdfTemplateType: "tex",
      },
    ];
  }, [DEFAULT_DEST_DIR, prdPrompt]);

  const handleApplyPreset = useCallback(
    (preset) => {
      if (!preset) return;
      resetForm();
      setFormState({
        label: preset.label || "",
        slug: preset.slug || "",
        destDir: preset.destDir || "",
        promptId: preset.promptId || "",
        pdfTemplate: preset.pdfTemplate || "",
        pdfTemplateType: preset.pdfTemplateType || "",
        pdfTemplateCss: preset.pdfTemplateCss || "",
      });
      setUseCustomTemplate(Boolean(preset.useCustomTemplate));
      setFeedback({
        success: `Preset applicato: ${preset.label}`,
        error: "",
        details: [],
      });
    },
    [resetForm, setFormState, setUseCustomTemplate, setFeedback]
  );

  return (
    <div className="space-y-6 text-sm text-surface-200">
      <div className="rounded-2xl border border-surface-700 bg-surface-900/60 p-5 shadow-sm shadow-black/20">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-surface-100">
              Pianifica il setup prima di registrare un nuovo progetto
            </div>
            <p className="mt-1 text-xs text-surface-400">
              Utilizza workspace, progetti e profili per mantenere branding, percorsi e prompt coerenti
              con le aspettative del cliente.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leadingIcon={Lightbulb}
              onClick={() => openSetupAssistant?.()}
            >
              Avvia setup guidato
            </Button>
            {selectedWorkspaceId ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leadingIcon={Folder}
                onClick={() => handleSelectWorkspaceForPipeline?.(selectedWorkspaceId)}
              >
                Usa nel form pipeline
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {hierarchyCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.key}
                className="flex h-full flex-col gap-2 rounded-xl border border-surface-700/80 bg-surface-900/70 p-4"
              >
                <Icon className="h-6 w-6 text-surface-300" />
                <div className="text-sm font-semibold text-surface-100">{card.title}</div>
                <p className="text-xs text-surface-400">{card.description}</p>
                {card.meta ? (
                  <div className="text-[11px] font-medium uppercase tracking-wide text-surface-500">
                    {card.meta}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {quickPresets.length ? (
          <div className="mt-4 rounded-xl border border-brand-400/50 bg-brand-500/10 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-brand-200" />
                <div>
                  <div className="text-sm font-semibold text-brand-100">
                    Acceleratore per nuovi PRD Consulting
                  </div>
                  <p className="mt-1 text-xs text-brand-100/80">
                    Precompila il form con il prompt PRD in stile major consulting firm, includendo il
                    template PDF dedicato.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {quickPresets.map((preset) => (
                  <Button
                    key={preset.key}
                    type="button"
                    size="sm"
                    leadingIcon={Sparkles}
                    onClick={() => handleApplyPreset(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Select
          label="Workspace"
          value={selectedWorkspaceId}
          onChange={handleWorkspaceChange}
          className="bg-transparent"
        >
          <option value="">Seleziona workspace</option>
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name || workspace.client || workspace.id}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRefreshWorkspaces}
          leadingIcon={RefreshCw}
        >
          Aggiorna
        </Button>
      </div>

      {!selectedWorkspaceId ? (
        <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900/30 p-6 text-center text-sm text-surface-400">
          Seleziona un workspace per gestire i profili associati.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-surface-100">Profili configurati</div>
              <p className="mt-1 text-xs text-surface-400">
                I profili applicano automaticamente slug, cartella, prompt e template alla pipeline.
              </p>
            </div>
            <Button type="button" size="sm" variant="secondary" leadingIcon={Plus} onClick={resetForm}>
              Nuovo profilo
            </Button>
          </div>

          {profiles.length ? (
            <ul className="space-y-3">
              {profiles.map((profile) => {
                const prompt = promptMap.get(profile.promptId);
                const isEditing = profile.id === editingProfileId;
                return (
                  <li
                    key={profile.id}
                    className={classNames(
                      "rounded-2xl border border-surface-700 bg-surface-900/40 p-4 transition",
                      isEditing && "border-brand-400/70 bg-brand-500/10"
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-surface-100">{profile.label || profile.id}</div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] uppercase tracking-wide text-surface-400">
                          <span>
                            Slug:
                            <span className="ml-1 rounded bg-surface-800 px-1.5 py-0.5 text-[11px] text-surface-100 normal-case">
                              {profile.slug || "—"}
                            </span>
                          </span>
                          <span className="normal-case">Cartella: {profile.destDir || "—"}</span>
                          <span className="normal-case">
                            Prompt: {prompt?.title || profile.promptId || "—"}
                          </span>
                          <span className="normal-case">
                            Template: {profile.pdfTemplate || "—"}
                            {profile.pdfTemplateType ? ` (${profile.pdfTemplateType})` : ""}
                          </span>
                          {profile.pdfTemplateCss ? (
                            <span className="normal-case">CSS: {profile.pdfTemplateCss}</span>
                          ) : null}
                          <span className="normal-case">
                            Logo: {profile.pdfLogo?.originalName || (profile.pdfLogoPath ? "Caricato" : "—")}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          leadingIcon={FileText}
                          onClick={() => handleEditProfile(profile)}
                          disabled={pending}
                        >
                          Modifica
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-feedback-danger hover:text-white"
                          leadingIcon={Trash2}
                          onClick={() => handleDeleteProfile(profile)}
                          disabled={pending}
                        >
                          Elimina
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900/30 p-6 text-center text-sm text-surface-400">
              Nessun profilo configurato per questo workspace.
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-2xl border border-surface-700 bg-surface-900/40 p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-surface-100">
                  {editingProfileId ? "Modifica profilo" : "Nuovo profilo"}
                </div>
                <p className="mt-1 text-xs text-surface-400">
                  Compila i campi per salvare un profilo riutilizzabile. Tutti i valori sono opzionali tranne il nome.
                </p>
              </div>
              {editingProfileId && (
                <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
                  Annulla modifica
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Nome profilo"
                value={formState.label}
                onChange={handleFieldChange("label")}
                placeholder="Es. Verbale standard"
                required
              />
              <Input
                label="Slug"
                value={formState.slug}
                onChange={handleFieldChange("slug")}
                placeholder="es. verbale_standard"
                helperText="Lascia vuoto per generarlo dal nome"
              />
              <Input
                label="Cartella destinazione"
                value={formState.destDir}
                onChange={handleFieldChange("destDir")}
                placeholder="/Users/nomeutente/Documenti"
                helperText="Cartella sul backend dove salvare PDF e Markdown"
              />
              <Select
                label="Prompt"
                value={formState.promptId}
                onChange={handleFieldChange("promptId")}
                className="bg-transparent"
              >
                <option value="">Nessun prompt predefinito</option>
                {prompts.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.title || prompt.slug || prompt.id}
                  </option>
                ))}
              </Select>
              <Select
                label="Template PDF"
                value={templateSelectValue}
                onChange={handleTemplateSelect}
                helperText={templateHelperText}
                error={pdfTemplatesError || undefined}
                className="bg-transparent"
                containerClassName="md:col-span-2"
                disabled={pdfTemplatesLoading && !pdfTemplates.length}
              >
                <option value="">Nessun template predefinito</option>
                {pdfTemplates.map((template) => (
                  <option
                    key={template.fileName}
                    value={template.fileName}
                    title={template.description || undefined}
                  >
                    {template.name || template.fileName}
                    {template.type ? ` (${template.type.toUpperCase()})` : ""}
                  </option>
                ))}
                <option value="__custom__">Template personalizzato…</option>
              </Select>
              <div className="md:col-span-2 flex flex-wrap items-center gap-3 text-xs text-surface-400">
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  leadingIcon={RefreshCw}
                  onClick={refreshPdfTemplates}
                >
                  Aggiorna template
                </Button>
                {pdfTemplatesLoading ? <span>Caricamento…</span> : null}
              </div>
              {!useCustomTemplate && selectedTemplate ? (
                <div className="md:col-span-2 space-y-2 rounded-2xl border border-surface-700/60 bg-surface-900/30 p-4 text-xs text-surface-300">
                  <div className="text-sm font-semibold text-surface-100">{selectedTemplate.name}</div>
                  {selectedTemplate.description ? (
                    <p className="text-surface-300">{selectedTemplate.description}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-4 text-[11px] uppercase tracking-wide text-surface-500">
                    <span>
                      Tipo:
                      <span className="ml-1 text-surface-100 normal-case">
                        {selectedTemplate.type || "—"}
                      </span>
                    </span>
                    <span>
                      CSS:
                      <span className="ml-1 text-surface-100 normal-case">
                        {selectedTemplate.cssFileName || "—"}
                      </span>
                    </span>
                    {selectedTemplate.engine ? (
                      <span>
                        Motore:
                        <span className="ml-1 text-surface-100 normal-case">
                          {selectedTemplate.engine}
                        </span>
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {useCustomTemplate ? (
                <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Input
                    label="Nome file template"
                    value={formState.pdfTemplate}
                    onChange={handleFieldChange("pdfTemplate")}
                    placeholder="nome-template.html"
                    helperText="Percorso relativo nella cartella templates del backend"
                  />
                  <Input
                    label="Tipo template"
                    value={formState.pdfTemplateType}
                    onChange={handleFieldChange("pdfTemplateType")}
                    placeholder="es. html, docx"
                    helperText="Indica il formato atteso dal backend"
                  />
                  <Input
                    label="Foglio di stile CSS"
                    value={formState.pdfTemplateCss}
                    onChange={handleFieldChange("pdfTemplateCss")}
                    placeholder="stili/report.css"
                    helperText="Opzionale. Percorso relativo del CSS associato"
                    containerClassName="md:col-span-2"
                  />
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-surface-200">Logo PDF</span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.svg"
                      onChange={handleLogoChange}
                      disabled={pending}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      leadingIcon={Upload}
                      onClick={() => logoInputRef.current?.click()}
                      disabled={pending}
                    >
                      Carica logo
                    </Button>
                  </label>
                  {logoFile && (
                    <span className="text-xs text-surface-300">{logoFile.name}</span>
                  )}
                  {!logoFile && currentLogoLabel && !removePdfLogo && (
                    <span className="text-xs text-surface-300">{currentLogoLabel}</span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLogoFile(null);
                      if (logoInputRef.current) {
                        logoInputRef.current.value = "";
                      }
                    }}
                    disabled={pending || !logoFile}
                  >
                    Rimuovi file
                  </Button>
                </div>
                {editingProfileId && (
                  <label className="flex items-center gap-2 text-xs text-surface-300">
                    <input
                      type="checkbox"
                      checked={removePdfLogo}
                      onChange={(event) => setRemovePdfLogo(event.target.checked)}
                      disabled={pending}
                    />
                    Rimuovi il logo salvato
                  </label>
                )}
              </div>
            </div>

            {feedback.error ? (
              <div className="flex items-start gap-2 rounded-xl border border-feedback-danger/50 bg-feedback-danger/10 p-3 text-xs text-feedback-danger">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <div>
                  <div className="font-medium">{feedback.error}</div>
                  {feedback.details?.length ? (
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px]">
                      {feedback.details.map((detail, index) => (
                        <li key={index}>{detail}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ) : null}

            {feedback.success ? (
              <div className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                {feedback.success}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="submit" isLoading={pending}>
                {editingProfileId ? "Salva modifiche" : "Crea profilo"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default WorkspaceProfilesManager;
