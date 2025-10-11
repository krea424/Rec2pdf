import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "../../hooks/useAppContext";
import { classNames } from "../../utils/classNames";
import { Button, Input, Select } from "../ui";
import { AlertCircle, FileText, Plus, RefreshCw, Trash2, Upload } from "../icons";

const emptyForm = {
  label: "",
  slug: "",
  destDir: "",
  promptId: "",
  pdfTemplate: "",
};

const WorkspaceProfilesManager = () => {
  const {
    workspaces,
    workspaceSelection,
    prompts,
    handleRefreshWorkspaces,
    createWorkspaceProfile,
    updateWorkspaceProfile,
    deleteWorkspaceProfile,
  } = useAppContext();

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
    workspaceSelection.workspaceId || (workspaces[0]?.id ?? "")
  );
  const [formState, setFormState] = useState(emptyForm);
  const [logoFile, setLogoFile] = useState(null);
  const [removePdfLogo, setRemovePdfLogo] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState({ success: "", error: "", details: [] });
  const logoInputRef = useRef(null);

  const resetForm = useCallback(() => {
    setFormState(emptyForm);
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

  const promptMap = useMemo(() => {
    const map = new Map();
    (prompts || []).forEach((prompt) => {
      if (prompt?.id) {
        map.set(prompt.id, prompt);
      }
    });
    return map;
  }, [prompts]);

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
      });
      setLogoFile(null);
      setRemovePdfLogo(false);
      setFeedback({ success: "", error: "", details: [] });
    },
    []
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
          });
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

  return (
    <div className="space-y-6 text-sm text-surface-200">
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
                          <span className="normal-case">Template: {profile.pdfTemplate || "—"}</span>
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
              <Input
                label="Template PDF"
                value={formState.pdfTemplate}
                onChange={handleFieldChange("pdfTemplate")}
                placeholder="nome-template.pdf"
                helperText="Nome del file presente nella cartella templates del backend"
              />
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
