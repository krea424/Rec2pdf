import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "../../hooks/useAppContext";
import { classNames } from "../../utils/classNames";
import { Button, Input, Select, Tabs, TabsContent, TabsList, TabsTrigger, TextArea } from "../ui";
import {
  AlertCircle,
  FileText,
  Folder,
  Lightbulb,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from "../icons";
import KnowledgeBaseManager from "./KnowledgeBaseManager";

const FALLBACK_WORKSPACE_STATUSES = ["Bozza", "In lavorazione", "Da revisionare", "Completato"];

const parseStatusList = (value) =>
  String(value || "")
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean);

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
    handleCreateWorkspace,
    handleUpdateWorkspace,
    handleDeleteWorkspace,
    refreshPdfTemplates,
    createWorkspaceProfile,
    updateWorkspaceProfile,
    deleteWorkspaceProfile,
    pdfTemplates,
    pdfTemplatesLoading,
    pdfTemplatesError,
    DEFAULT_DEST_DIR,
    DEFAULT_WORKSPACE_STATUSES,
    openSetupAssistant,
    handleSelectWorkspaceForPipeline,
  } = useAppContext();

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
    workspaceSelection.workspaceId || (workspaces[0]?.id ?? "")
  );
  const defaultStatusesString = useMemo(() => {
    if (Array.isArray(DEFAULT_WORKSPACE_STATUSES) && DEFAULT_WORKSPACE_STATUSES.length) {
      return DEFAULT_WORKSPACE_STATUSES.join(", ");
    }
    return FALLBACK_WORKSPACE_STATUSES.join(", ");
  }, [DEFAULT_WORKSPACE_STATUSES]);
  const [workspaceFormMode, setWorkspaceFormMode] = useState(null);
  const [workspaceForm, setWorkspaceForm] = useState(() => ({
    name: "",
    client: "",
    color: "#6366f1",
    statuses: defaultStatusesString,
  }));
  const [workspaceFormPending, setWorkspaceFormPending] = useState(false);
  const [workspaceManagerFeedback, setWorkspaceManagerFeedback] = useState({ type: "", message: "" });
  const [formState, setFormState] = useState(emptyForm);
  const [useCustomTemplate, setUseCustomTemplate] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [removePdfLogo, setRemovePdfLogo] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState({ success: "", error: "", details: [] });
  const [activeTab, setActiveTab] = useState("profiles");
  const logoInputRef = useRef(null);
  const resetWorkspaceForm = useCallback(() => {
    setWorkspaceForm({
      name: "",
      client: "",
      color: "#6366f1",
      statuses: defaultStatusesString,
    });
  }, [defaultStatusesString]);

  const handleWorkspaceFieldChange = useCallback(
    (field) => (event) => {
      const value = event.target.value;
      setWorkspaceForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleWorkspaceColorChange = useCallback((event) => {
    const value = event.target.value;
    setWorkspaceForm((prev) => ({ ...prev, color: value || "#6366f1" }));
  }, []);

  const openCreateWorkspaceForm = useCallback(() => {
    setWorkspaceFormMode("create");
    resetWorkspaceForm();
    setWorkspaceManagerFeedback({ type: "", message: "" });
  }, [resetWorkspaceForm]);

  const handleCloseWorkspaceForm = useCallback(() => {
    setWorkspaceFormMode(null);
    resetWorkspaceForm();
  }, [resetWorkspaceForm]);

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

  useEffect(() => {
    if (workspaceFormMode === "create") {
      setWorkspaceForm((prev) => ({
        ...prev,
        statuses: defaultStatusesString,
      }));
    }
  }, [defaultStatusesString, workspaceFormMode]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) || null,
    [workspaces, selectedWorkspaceId]
  );

  const openEditWorkspaceForm = useCallback(() => {
    if (!activeWorkspace) {
      return;
    }
    setWorkspaceFormMode("edit");
    setWorkspaceForm({
      name: activeWorkspace.name || "",
      client: activeWorkspace.client || "",
      color: activeWorkspace.color || "#6366f1",
      statuses:
        Array.isArray(activeWorkspace.defaultStatuses) && activeWorkspace.defaultStatuses.length
          ? activeWorkspace.defaultStatuses.join(", ")
          : defaultStatusesString,
    });
    setWorkspaceManagerFeedback({ type: "", message: "" });
  }, [activeWorkspace, defaultStatusesString]);

  const workspaceProjects = useMemo(
    () => (Array.isArray(activeWorkspace?.projects) ? activeWorkspace.projects : []),
    [activeWorkspace]
  );

  const profiles = useMemo(
    () => (Array.isArray(activeWorkspace?.profiles) ? activeWorkspace.profiles : []),
    [activeWorkspace]
  );

  const projectCount = useMemo(
    () => workspaceProjects.length,
    [workspaceProjects]
  );

  const handleWorkspaceFormSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!workspaceFormMode) {
        return;
      }
      const trimmedName = workspaceForm.name.trim();
      if (!trimmedName) {
        setWorkspaceManagerFeedback({
          type: "error",
          message: "Il nome del workspace è obbligatorio.",
        });
        return;
      }
      const statusList = parseStatusList(workspaceForm.statuses);
      const normalizedStatuses =
        statusList.length
          ? statusList
          : Array.isArray(DEFAULT_WORKSPACE_STATUSES) && DEFAULT_WORKSPACE_STATUSES.length
          ? DEFAULT_WORKSPACE_STATUSES
          : FALLBACK_WORKSPACE_STATUSES;

      setWorkspaceFormPending(true);
      setWorkspaceManagerFeedback({ type: "", message: "" });

      try {
        if (workspaceFormMode === "create") {
          const result = await handleCreateWorkspace({
            name: trimmedName,
            client: workspaceForm.client,
            color: workspaceForm.color || "#6366f1",
            statuses: normalizedStatuses,
          });
          if (!result.ok) {
            setWorkspaceManagerFeedback({
              type: "error",
              message: result.message || "Creazione workspace non riuscita.",
            });
            return;
          }
          const created = result.workspace || {};
          setWorkspaceManagerFeedback({
            type: "success",
            message: `Workspace creato: ${created.name || trimmedName}`,
          });
          if (created.id) {
            setSelectedWorkspaceId(created.id);
          }
          resetForm();
          handleCloseWorkspaceForm();
        } else if (workspaceFormMode === "edit" && activeWorkspace) {
          const result = await handleUpdateWorkspace(activeWorkspace.id, {
            name: trimmedName,
            client: workspaceForm.client,
            color: workspaceForm.color || "#6366f1",
            defaultStatuses: normalizedStatuses,
          });
          if (!result.ok) {
            setWorkspaceManagerFeedback({
              type: "error",
              message: result.message || "Aggiornamento workspace non riuscito.",
            });
            return;
          }
          const updated = result.workspace || {};
          setWorkspaceManagerFeedback({
            type: "success",
            message: `Workspace aggiornato: ${updated.name || trimmedName}`,
          });
          handleCloseWorkspaceForm();
        }
      } finally {
        setWorkspaceFormPending(false);
      }
    },
    [
      workspaceFormMode,
      workspaceForm,
      handleCreateWorkspace,
      DEFAULT_WORKSPACE_STATUSES,
      handleUpdateWorkspace,
      activeWorkspace,
      resetForm,
      handleCloseWorkspaceForm,
      setSelectedWorkspaceId,
    ]
  );

  const handleDeleteWorkspaceAction = useCallback(async () => {
    if (!selectedWorkspaceId) {
      return;
    }
    const target = workspaces.find((workspace) => workspace.id === selectedWorkspaceId) || null;
    const targetLabel = target?.name || target?.client || target?.id || selectedWorkspaceId;
    const confirmed = window.confirm(`Eliminare il workspace "${targetLabel}"?`);
    if (!confirmed) {
      return;
    }
    setWorkspaceFormPending(true);
    setWorkspaceManagerFeedback({ type: "", message: "" });
    try {
      const result = await handleDeleteWorkspace(selectedWorkspaceId);
      if (!result.ok) {
        setWorkspaceManagerFeedback({
          type: "error",
          message: result.message || "Eliminazione workspace non riuscita.",
        });
        return;
      }
      const nextWorkspace = workspaces.find((workspace) => workspace.id !== selectedWorkspaceId) || null;
      setWorkspaceManagerFeedback({
        type: "success",
        message: `Workspace eliminato: ${targetLabel}`,
      });
      setSelectedWorkspaceId(nextWorkspace?.id || "");
      resetForm();
      handleCloseWorkspaceForm();
    } finally {
      setWorkspaceFormPending(false);
    }
  }, [selectedWorkspaceId, workspaces, handleDeleteWorkspace, resetForm, handleCloseWorkspaceForm, setSelectedWorkspaceId]);

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

  const formatProjectTimestamp = useCallback((value) => {
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
  }, []);

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
  const currentLogoUrl = useMemo(() => {
    const rawPath = typeof currentProfile?.pdfLogoPath === "string" ? currentProfile.pdfLogoPath.trim() : "";
    if (rawPath && /^https?:\/\//i.test(rawPath)) {
      return rawPath;
    }
    return "";
  }, [currentProfile]);

  const hierarchyCards = useMemo(
    () => [
      {
        key: "workspace",
        title: "Workspace",
        icon: Users,
        description:
          "Contenitore per cliente o business unit. Gestiscilo qui: la pipeline lo usa in sola lettura per avviare le sessioni.",
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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm font-semibold text-surface-100">
                Gestione workspace e profili
              </div>
              <p className="mt-1 text-xs text-surface-400">
                Crea, modifica o elimina workspace, progetti e profili prima di lanciare la pipeline.
                Nel form &ldquo;Crea&rdquo; potrai solo scegliere cosa usare.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                leadingIcon={Plus}
                onClick={openCreateWorkspaceForm}
                disabled={workspaceFormPending}
              >
                Nuovo workspace
              </Button>
              {selectedWorkspaceId ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    leadingIcon={Settings}
                    onClick={openEditWorkspaceForm}
                    disabled={workspaceFormPending}
                  >
                    Modifica workspace
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-feedback-danger hover:text-white"
                    leadingIcon={Trash2}
                    onClick={handleDeleteWorkspaceAction}
                    disabled={workspaceFormPending}
                  >
                    Elimina workspace
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    leadingIcon={Folder}
                    onClick={() => handleSelectWorkspaceForPipeline?.(selectedWorkspaceId)}
                    disabled={workspaceFormPending}
                  >
                    Usa nel form pipeline
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leadingIcon={Lightbulb}
                onClick={() => openSetupAssistant?.()}
                disabled={workspaceFormPending}
              >
                Avvia setup guidato
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-4 text-xs text-surface-300">
            Le modifiche a workspace, progetti e profili avvengono qui nelle impostazioni. Prima di
            eseguire la pipeline usa il form rapido per scegliere ciò che hai configurato.
          </div>

          {workspaceManagerFeedback.message ? (
            <div
              className={classNames(
                "rounded-xl border p-3 text-xs transition",
                workspaceManagerFeedback.type === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                  : "border-feedback-danger/60 bg-feedback-danger/10 text-feedback-danger"
              )}
            >
              {workspaceManagerFeedback.message}
            </div>
          ) : null}

          {workspaceFormMode ? (
            <form
              className="space-y-4 rounded-xl border border-surface-700/70 bg-surface-900/50 p-4"
              onSubmit={handleWorkspaceFormSubmit}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-surface-100">
                  {workspaceFormMode === "create" ? "Nuovo workspace" : "Modifica workspace"}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleCloseWorkspaceForm}
                  disabled={workspaceFormPending}
                >
                  Annulla
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  label="Nome workspace"
                  value={workspaceForm.name}
                  onChange={handleWorkspaceFieldChange("name")}
                  placeholder="Es. Portfolio Clienti"
                  required
                  disabled={workspaceFormPending}
                />
                <Input
                  label="Cliente (opzionale)"
                  value={workspaceForm.client}
                  onChange={handleWorkspaceFieldChange("client")}
                  placeholder="Es. ACME Corp"
                  disabled={workspaceFormPending}
                />
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-surface-200">Colore brand</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      aria-label="Colore brand"
                      value={workspaceForm.color}
                      onChange={handleWorkspaceColorChange}
                      className="h-10 w-14 rounded border border-surface-700 bg-transparent"
                      disabled={workspaceFormPending}
                    />
                    <span className="font-mono text-xs text-surface-400">{workspaceForm.color}</span>
                  </div>
                  <span className="text-xs text-surface-400">
                    Utilizzato per badge, timeline e quick actions del workspace.
                  </span>
                </div>
                <TextArea
                  label="Stati di default"
                  value={workspaceForm.statuses}
                  onChange={handleWorkspaceFieldChange("statuses")}
                  helperText="Separali con una virgola; verranno proposti quando crei progetti o stati."
                  rows={3}
                  disabled={workspaceFormPending}
                />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button type="submit" isLoading={workspaceFormPending}>
                  {workspaceFormMode === "create" ? "Crea workspace" : "Salva workspace"}
                </Button>
              </div>
            </form>
          ) : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <Select
          label="Workspace da gestire"
          helperText="Scegli qui cosa modificare; nel form pipeline dovrai solo selezionare il workspace preparato."
          value={selectedWorkspaceId}
          onChange={handleWorkspaceChange}
          className="bg-transparent"
          disabled={workspaceFormPending}
        >
          <option value="">Seleziona workspace</option>
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name || workspace.client || workspace.id}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRefreshWorkspaces}
            leadingIcon={RefreshCw}
            disabled={workspaceFormPending}
          >
            Aggiorna
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mt-3">
          <TabsTrigger value="profiles">Profili</TabsTrigger>
          <TabsTrigger value="projects">Progetti</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles">
          {!selectedWorkspaceId ? (
            <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900/30 p-6 text-center text-sm text-surface-400">
              Seleziona un workspace per gestire i profili associati.
            </div>
          ) : (
            <div className="mt-4 space-y-6">
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
                    const logoPreviewUrl =
                      typeof profile.pdfLogoPath === "string" && /^https?:\/\//i.test(profile.pdfLogoPath)
                        ? profile.pdfLogoPath.trim()
                        : "";
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
                            {logoPreviewUrl ? (
                              <div className="mt-3 rounded-xl border border-surface-700/60 bg-surface-900/30 p-3">
                                <div className="text-[11px] uppercase tracking-wide text-surface-500">Anteprima logo</div>
                                <img
                                  src={logoPreviewUrl}
                                  alt={`Logo salvato per ${profile.label || profile.id}`}
                                  className="mt-2 h-14 w-auto max-w-full object-contain"
                                />
                              </div>
                            ) : null}
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
                    {currentLogoUrl && !logoFile && !removePdfLogo && (
                      <div className="mt-3 rounded-xl border border-surface-700/60 bg-surface-900/30 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-surface-500">Anteprima logo salvato</div>
                        <img
                          src={currentLogoUrl}
                          alt="Anteprima logo profilo"
                          className="mt-2 h-16 w-auto max-w-full object-contain"
                        />
                      </div>
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
        </TabsContent>

        <TabsContent value="projects">
          {!selectedWorkspaceId ? (
            <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900/30 p-6 text-center text-sm text-surface-400">
              Seleziona un workspace per visualizzare i progetti configurati.
            </div>
          ) : workspaceProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900/30 p-6 text-center text-sm text-surface-400">
              Nessun progetto configurato per questo workspace.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-surface-700 bg-surface-900/40 p-5">
                <div className="text-sm font-semibold text-surface-100">Progetti del workspace</div>
                <p className="mt-1 text-xs text-surface-400">
                  Stati e metadati vengono utilizzati per organizzare i deliverable generati dalla pipeline.
                </p>
                <ul className="mt-4 space-y-3">
                  {workspaceProjects.map((project) => {
                    const updatedLabel = formatProjectTimestamp(project.updatedAt || project.createdAt);
                    return (
                      <li
                        key={project.id}
                        className="rounded-2xl border border-surface-700/70 bg-surface-900/30 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-surface-100">{project.name || project.id}</div>
                            <div className="mt-1 text-xs text-surface-400">
                              ID: <span className="font-mono text-surface-200">{project.id}</span>
                            </div>
                            {updatedLabel ? (
                              <div className="text-[11px] uppercase tracking-wide text-surface-500">
                                Aggiornato: {updatedLabel}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-surface-400">
                            <span className="inline-flex items-center gap-2 rounded-full border border-surface-700/60 bg-surface-900/60 px-2 py-0.5">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: project.color || '#6366f1' }}
                                aria-hidden="true"
                              />
                              {project.color || '#6366f1'}
                            </span>
                            <span className="uppercase tracking-wide">
                              {Array.isArray(project.statuses) ? project.statuses.length : 0} stati
                            </span>
                          </div>
                        </div>
                        {Array.isArray(project.statuses) && project.statuses.length ? (
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-surface-300">
                            {project.statuses.map((status) => (
                              <span
                                key={`${project.id}-${status}`}
                                className="rounded-full border border-surface-700/60 bg-surface-900/60 px-2 py-0.5"
                              >
                                {status}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="knowledge">
          <KnowledgeBaseManager workspaceId={selectedWorkspaceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorkspaceProfilesManager;
