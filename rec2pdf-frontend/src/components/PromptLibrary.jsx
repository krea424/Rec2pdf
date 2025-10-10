import React, { useEffect, useMemo, useState } from "react";
import { classNames } from "../utils/classNames";
import {
  Sparkles,
  Bookmark,
  RefreshCw,
  FilterIcon,
  Lightbulb,
  Target,
  ClipboardList,
  Trash2,
  Plus,
} from "./icons";

const parseList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((chunk) => String(chunk || "").trim())
      .filter(Boolean);
  }
  return [];
};

const parseCueCards = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((card, index) => {
        if (!card || typeof card !== "object") return null;
        const title = String(card.title || card.label || "").trim();
        if (!title) return null;
        return {
          key: card.key || card.id || `cue_${index}`,
          title,
          hint: String(card.hint || card.description || "").trim(),
        };
      })
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((line, index) => {
        const parts = line.split("|");
        const title = String(parts[0] || "").trim();
        if (!title) return null;
        const hint = String(parts[1] || "").trim();
        return { key: `cue_${index}`, title, hint };
      })
      .filter(Boolean);
  }
  return [];
};

const DEFAULT_BUILDER_STATE = {
  title: "",
  description: "",
  persona: "",
  tags: "",
  cues: "Focus principale | Qual è il contesto da raccontare?\nDeliverable | Che output finale ti serve?",
  checklist: "Executive summary\nAnalisi\nNext steps",
  tone: "Professionale ma empatico",
  voice: "Prima persona plurale",
  bulletStyle: "Elenchi con verbi d'azione",
  pdfLayout: "consulting",
  accentColor: "#6366f1",
  includeCover: true,
  includeToc: false,
  focusPrompts: "",
};

export default function PromptLibrary({
  prompts = [],
  loading = false,
  selection,
  onSelectPrompt,
  onClearSelection,
  favorites = [],
  onToggleFavorite,
  onRefresh,
  themeStyles = {},
  themeName = "",
  activePrompt,
  focusValue = "",
  onFocusChange,
  notesValue = "",
  onNotesChange,
  cueProgress = {},
  onCueToggle,
  onCreatePrompt,
  onDeletePrompt,
}) {
  const hasActivePrompt = Boolean(activePrompt && selection?.promptId);
  const shouldAutoExpandActive = hasActivePrompt && selection?.expandPromptDetails !== false;
  const isBoardroom = themeName === "boardroom";
  const boardroomContainerSurface =
    "border-white/15 bg-white/[0.015] backdrop-blur-2xl";
  const boardroomControlIdle =
    "border border-white/18 bg-transparent text-slate-200 hover:border-white/35 hover:text-white";
  const boardroomControlActive = "border-white/35 bg-white/[0.06] text-white";
  const [expandedSections, setExpandedSections] = useState(() => ({
    library: false,
    active: shouldAutoExpandActive,
    builder: false,
  }));
  const [searchTerm, setSearchTerm] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [builderState, setBuilderState] = useState({ ...DEFAULT_BUILDER_STATE });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const builderOpen = expandedSections.builder;

  useEffect(() => {
    if (!hasActivePrompt) return;
    if (selection?.expandPromptDetails === false) return;
    setExpandedSections((prev) => ({ ...prev, active: true }));
  }, [hasActivePrompt, selection?.expandPromptDetails]);

  const toggleSection = (key) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const favoritesSet = useMemo(() => new Set(favorites || []), [favorites]);

  const filteredPrompts = useMemo(() => {
    let list = Array.isArray(prompts) ? [...prompts] : [];
    if (onlyFavorites) {
      list = list.filter((prompt) => favoritesSet.has(prompt.id));
    }
    const query = searchTerm.trim().toLowerCase();
    if (query) {
      list = list.filter((prompt) => {
        const haystack = [
          prompt?.title,
          prompt?.description,
          prompt?.persona,
          Array.isArray(prompt?.tags) ? prompt.tags.join(" ") : "",
          Array.isArray(prompt?.checklist?.sections) ? prompt.checklist.sections.join(" ") : "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
    }
    return list.sort((a, b) => {
      const favDelta = Number(favoritesSet.has(b.id)) - Number(favoritesSet.has(a.id));
      if (favDelta !== 0) return favDelta;
      const updatedA = a?.updatedAt || 0;
      const updatedB = b?.updatedAt || 0;
      return updatedB - updatedA;
    });
  }, [prompts, onlyFavorites, searchTerm, favoritesSet]);

  const activeCueKeys = useMemo(() => new Set(Object.keys(cueProgress || {}).filter((key) => cueProgress[key])), [cueProgress]);

  const handleBuilderFieldChange = (field, value) => {
    setBuilderState((prev) => ({ ...prev, [field]: value }));
  };

  const handleBuilderSubmit = async (event) => {
    event.preventDefault();
    if (!builderState.title.trim()) {
      setFeedback({ type: "error", message: "Il titolo del template è obbligatorio." });
      return;
    }
    const cueCards = parseCueCards(builderState.cues);
    if (cueCards.length === 0) {
      setFeedback({ type: "error", message: "Aggiungi almeno una cue card (titolo e suggerimento)." });
      return;
    }
    const checklistSections = parseList(builderState.checklist);
    if (checklistSections.length === 0) {
      setFeedback({ type: "error", message: "Specifica almeno una voce nella checklist del template." });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    const payload = {
      title: builderState.title.trim(),
      description: builderState.description.trim(),
      persona: builderState.persona.trim(),
      color: builderState.accentColor || "#6366f1",
      tags: parseList(builderState.tags),
      cueCards,
      checklist: { sections: checklistSections },
      markdownRules: {
        tone: builderState.tone.trim(),
        voice: builderState.voice.trim(),
        bulletStyle: builderState.bulletStyle.trim(),
      },
      pdfRules: {
        accentColor: builderState.accentColor || "#6366f1",
        layout: builderState.pdfLayout.trim(),
        includeCover: Boolean(builderState.includeCover),
        includeToc: Boolean(builderState.includeToc),
      },
      focusPrompts: parseList(builderState.focusPrompts),
    };
    try {
      const result = await onCreatePrompt?.(payload);
      if (result?.ok) {
        setFeedback({ type: "success", message: "Template creato con successo." });
        setBuilderState({ ...DEFAULT_BUILDER_STATE });
        setExpandedSections((prev) => ({ ...prev, builder: false }));
        if (result.prompt) {
          onSelectPrompt?.(result.prompt);
        }
      } else {
        setFeedback({ type: "error", message: result?.message || "Impossibile creare il template." });
      }
    } catch (error) {
      setFeedback({ type: "error", message: error?.message || "Errore inatteso durante la creazione." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (event, prompt) => {
    event.stopPropagation();
    event.preventDefault();
    if (!onDeletePrompt) return;
    const result = await onDeletePrompt(prompt.id);
    if (!result?.ok) {
      setFeedback({ type: "error", message: result?.message || "Impossibile eliminare il template." });
    } else if (selection?.promptId === prompt.id) {
      onClearSelection?.();
    }
  };

  const renderPromptCard = (prompt) => {
    const isSelected = selection?.promptId === prompt.id;
    const isFavorite = favoritesSet.has(prompt.id);
    const checklistSections = Array.isArray(prompt?.checklist?.sections)
      ? prompt.checklist.sections
      : [];
    const summaryText = typeof prompt.summary === "string" && prompt.summary.trim()
      ? prompt.summary.trim()
      : typeof prompt.description === "string"
        ? prompt.description.trim()
        : "";

    return (
      <div
        key={prompt.id}
        className={classNames(
          "rounded-xl border p-4 transition",
          themeStyles?.input,
          "hover:border-indigo-400/60 hover:bg-indigo-500/5",
          isSelected && "border-indigo-400/70 ring-2 ring-indigo-400/20"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-zinc-100">
              <span
                className="h-3 w-3 rounded-full border border-white/40"
                style={{ backgroundColor: prompt.color || "#6366f1" }}
              />
              <span className="text-sm font-semibold">{prompt.title || "Template"}</span>
            </div>
            {prompt.persona && (
              <div className="text-[11px] text-zinc-400">Persona: {prompt.persona}</div>
            )}
            {summaryText && (
              <p className="text-xs text-zinc-400">{summaryText}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleFavorite?.(prompt.id);
              }}
              className={classNames(
                "rounded-lg border px-2 py-1 text-xs transition",
                isFavorite
                  ? "border-amber-400/60 bg-amber-500/10 text-amber-200"
                  : "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-amber-400/40 hover:text-amber-200"
              )}
            >
              <Bookmark className="h-3.5 w-3.5" />
            </button>
            {onDeletePrompt && !prompt.builtIn && (
              <button
                type="button"
                onClick={(event) => handleDelete(event, prompt)}
                className="rounded-lg border border-rose-500/40 bg-rose-600/20 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        {Array.isArray(prompt.cueCards) && prompt.cueCards.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
              <Lightbulb className="h-3 w-3" /> Cue cards
            </div>
            <div className="flex flex-wrap gap-2">
              {prompt.cueCards.map((cue) => (
                <span
                  key={cue.key || cue.title}
                  className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[11px] text-indigo-100"
                >
                  {cue.title}
                </span>
              ))}
            </div>
          </div>
        )}
        {checklistSections.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
              <ClipboardList className="h-3 w-3" /> Checklist
            </div>
            <ul className="list-disc space-y-1 pl-4 text-[12px] text-zinc-300">
              {checklistSections.map((section) => (
                <li key={section}>{section}</li>
              ))}
            </ul>
          </div>
        )}
        {Array.isArray(prompt.tags) && prompt.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {prompt.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-zinc-800/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
        {Array.isArray(prompt.focusPrompts) && prompt.focusPrompts.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
              <Target className="h-3 w-3" /> Focus suggeriti
            </div>
            <div className="flex flex-wrap gap-1 text-[11px] text-zinc-300">
              {prompt.focusPrompts.map((item) => (
                <span key={item} className="rounded-lg bg-zinc-800/70 px-2 py-0.5">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectPrompt?.(prompt)}
            className={classNames(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition",
              isSelected
                ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-100"
                : "border-indigo-500/40 bg-indigo-500/10 text-indigo-100 hover:border-indigo-400"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" /> {isSelected ? "In uso" : "Usa template"}
          </button>
        </div>
      </div>
    );
  };

  const renderActivePrompt = () => {
    if (!activePrompt || !selection?.promptId) {
      return (
        <div className="rounded-lg border border-dashed border-zinc-700/60 bg-black/10 p-4 text-xs text-zinc-400">
          Seleziona un template per ricevere cue cards e checklist guidate.
        </div>
      );
    }

    const checklistSections = Array.isArray(activePrompt?.checklist?.sections)
      ? activePrompt.checklist.sections
      : [];
    const summaryText = typeof activePrompt.summary === "string" && activePrompt.summary.trim()
      ? activePrompt.summary.trim()
      : typeof activePrompt.description === "string"
        ? activePrompt.description.trim()
        : "";
    const descriptionText = typeof activePrompt.description === "string"
      ? activePrompt.description.trim()
      : "";
    let detailedDescription = "";
    if (descriptionText) {
      detailedDescription = descriptionText;
      if (summaryText && descriptionText.startsWith(summaryText)) {
        detailedDescription = descriptionText.slice(summaryText.length).trim();
      }
    }
    const showDetailedDescription = Boolean(detailedDescription);

    return (
      <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-4 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-sm text-indigo-100">
              <Sparkles className="h-4 w-4" />
              <span className="font-semibold">{activePrompt.title || "Template"}</span>
            </div>
            {summaryText && (
              <p className="mt-1 text-xs text-indigo-200/80">{summaryText}</p>
            )}
          </div>
          {onClearSelection && (
            <button
              type="button"
              onClick={onClearSelection}
              className="rounded-lg border border-zinc-600/70 bg-zinc-800/60 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-400/70"
            >
              Rimuovi
            </button>
          )}
        </div>
        {showDetailedDescription && (
          <div className="rounded-lg border border-indigo-400/30 bg-indigo-400/10 p-3 text-[11px] leading-relaxed text-indigo-50/90 whitespace-pre-wrap">
            {detailedDescription}
          </div>
        )}
        {Array.isArray(activePrompt.cueCards) && activePrompt.cueCards.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-indigo-200/80">Cue cards</div>
            <div className="flex flex-wrap gap-2">
              {activePrompt.cueCards.map((cue) => {
                const isDone = activeCueKeys.has(cue.key);
                return (
                  <button
                    key={cue.key || cue.title}
                    type="button"
                    onClick={() => onCueToggle?.(cue.key)}
                    className={classNames(
                      "flex min-w-[140px] flex-col rounded-xl border px-3 py-2 text-left text-xs transition",
                      isDone
                        ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-100"
                        : "border-indigo-500/40 bg-indigo-500/10 text-indigo-100 hover:border-indigo-400"
                    )}
                  >
                    <span className="font-semibold">{cue.title}</span>
                    {cue.hint && <span className="mt-1 text-[11px] text-indigo-200/80">{cue.hint}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {checklistSections.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-indigo-200/80">Checklist</div>
            <ul className="grid grid-cols-1 gap-1 text-xs text-indigo-100 sm:grid-cols-2">
              {checklistSections.map((section) => (
                <li key={section} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" /> {section}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col text-xs text-indigo-200/80">
            Focus del monologo
            <textarea
              value={focusValue}
              onChange={(event) => onFocusChange?.(event.target.value)}
              placeholder="Es. Preparare un executive summary per il cliente X"
              className="mt-1 min-h-[68px] rounded-lg border border-indigo-500/40 bg-black/20 px-3 py-2 text-sm text-indigo-100 outline-none"
            />
          </label>
          <label className="flex flex-col text-xs text-indigo-200/80">
            Note personali
            <textarea
              value={notesValue}
              onChange={(event) => onNotesChange?.(event.target.value)}
              placeholder="Aggiungi appunti o remind specifici"
              className="mt-1 min-h-[68px] rounded-lg border border-indigo-500/40 bg-black/20 px-3 py-2 text-sm text-indigo-100 outline-none"
            />
          </label>
        </div>
      </div>
    );
  };

  return (
    <div
      className={classNames(
        "mt-6 overflow-hidden rounded-xl border",
        isBoardroom ? boardroomContainerSurface : themeStyles?.input,
      )}
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Sparkles className="h-4 w-4" />
            <span>Prompt Library modulare</span>
          </div>
          <p className="text-xs text-zinc-500">
            Mantieni l'interfaccia essenziale e apri solo le aree che ti servono: filtra i template oppure consulta i dettagli del template attivo quando vuoi.
          </p>
          <div className="flex flex-wrap gap-2 text-[11px] text-zinc-400">
            {hasActivePrompt ? (
              <span
                className={classNames(
                  "flex items-center gap-2 rounded-full border px-3 py-1",
                  isBoardroom
                    ? "border-white/25 bg-white/[0.05] text-slate-100"
                    : "border-indigo-500/40 bg-indigo-500/10 text-indigo-100",
                )}
              >
                <Target className="h-3 w-3" /> In uso: {activePrompt?.title || "Template"}
              </span>
            ) : (
              <span className="rounded-full border border-dashed border-zinc-600/60 px-3 py-1 text-zinc-400">
                Nessun template attivo
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => toggleSection("library")}
            className={classNames(
              "flex items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition",
              isBoardroom
                ? expandedSections.library
                  ? boardroomControlActive
                  : boardroomControlIdle
                : expandedSections.library
                    ? "border-zinc-600 bg-zinc-800/70 text-zinc-100"
                    : "border-zinc-700 bg-transparent text-zinc-300 hover:border-indigo-400/50 hover:text-indigo-100"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {expandedSections.library ? "Nascondi libreria" : "Esplora template"}
          </button>
          <button
            type="button"
            onClick={() => toggleSection("active")}
            className={classNames(
              "flex items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition",
              isBoardroom
                ? expandedSections.active
                  ? boardroomControlActive
                  : boardroomControlIdle
                : expandedSections.active
                    ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-100"
                    : "border-zinc-700 bg-transparent text-zinc-300 hover:border-indigo-400/50 hover:text-indigo-100"
            )}
          >
            <Target className="h-3.5 w-3.5" />
            {expandedSections.active ? "Chiudi dettagli" : "Vedi template attivo"}
          </button>
        </div>
      </div>

      {expandedSections.library && (
        <div
          className={classNames(
            "space-y-4 border-t p-4",
            isBoardroom ? "border-white/12" : "border-zinc-800/60",
          )}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 min-w-[200px]">
                <FilterIcon className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Cerca per titolo, persona, tag"
                  className="w-full rounded-lg border border-zinc-700 bg-transparent px-9 py-2 text-sm text-zinc-100 outline-none"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-2 rounded-lg px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Pulisci
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOnlyFavorites((prev) => !prev)}
                className={classNames(
                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition",
                  onlyFavorites
                    ? "border-amber-400/60 bg-amber-500/10 text-amber-200"
                    : "border-zinc-700 bg-zinc-900/40 text-zinc-300 hover:border-amber-400/40 hover:text-amber-200"
                )}
              >
                <Bookmark className="h-3.5 w-3.5" /> {onlyFavorites ? "Solo preferiti" : "Tutti i template"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onClearSelection && selection?.promptId && (
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-300 hover:border-indigo-400/50 hover:text-indigo-100"
                >
                  Sgancia template
                </button>
              )}
              <button
                type="button"
                onClick={() => onRefresh?.()}
                className={classNames(
                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition",
                  loading
                    ? "border-zinc-700 bg-zinc-900/40 text-zinc-500 cursor-not-allowed"
                    : "border-indigo-500/40 bg-indigo-500/10 text-indigo-100 hover:border-indigo-400"
                )}
                disabled={loading}
              >
                <RefreshCw className={classNames("h-3.5 w-3.5", loading && "animate-spin")} />
                Aggiorna
              </button>
              <button
                type="button"
                onClick={() => toggleSection("builder")}
                className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-200 hover:border-indigo-400/50"
              >
                <Plus className="h-3.5 w-3.5" /> {builderOpen ? "Chiudi builder" : "Nuovo template"}
              </button>
            </div>
          </div>

          {feedback && (
            <div
              className={classNames(
                "rounded-lg border px-3 py-2 text-xs",
                feedback.type === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-200"
              )}
            >
              {feedback.message}
            </div>
          )}

          {builderOpen && (
            <form onSubmit={handleBuilderSubmit} className="space-y-3 rounded-lg border border-dashed border-zinc-700/60 bg-black/10 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex flex-col text-xs text-zinc-400">
                  Titolo template
              <input
                value={builderState.title}
                onChange={(event) => handleBuilderFieldChange("title", event.target.value)}
                className="mt-1 rounded-lg border border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none"
                placeholder="Es. Brief creativo"
                required
              />
            </label>
            <label className="flex flex-col text-xs text-zinc-400">
              Persona di riferimento
              <input
                value={builderState.persona}
                onChange={(event) => handleBuilderFieldChange("persona", event.target.value)}
                className="mt-1 rounded-lg border border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none"
                placeholder="Es. Business analyst"
              />
            </label>
            <label className="flex flex-col text-xs text-zinc-400 md:col-span-2">
              Descrizione
              <textarea
                value={builderState.description}
                onChange={(event) => handleBuilderFieldChange("description", event.target.value)}
                className="mt-1 rounded-lg border border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none"
                placeholder="Obiettivo del template"
              />
            </label>
            <label className="flex flex-col text-xs text-zinc-400">
              Tag (virgola o newline)
              <textarea
                value={builderState.tags}
                onChange={(event) => handleBuilderFieldChange("tags", event.target.value)}
                className="mt-1 rounded-lg border border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none"
              />
            </label>
            <label className="flex flex-col text-xs text-zinc-400">
              Checklist (una per riga)
              <textarea
                value={builderState.checklist}
                onChange={(event) => handleBuilderFieldChange("checklist", event.target.value)}
                className="mt-1 rounded-lg border border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none"
              />
            </label>
            <label className="flex flex-col text-xs text-zinc-400 md:col-span-2">
              Cue cards (Titolo | Suggerimento)
              <textarea
                value={builderState.cues}
                onChange={(event) => handleBuilderFieldChange("cues", event.target.value)}
                className="mt-1 rounded-lg border border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none"
              />
            </label>
            <label className="flex flex-col text-xs text-zinc-400">
              Tono
              <input
                value={builderState.tone}
                onChange={(event) => handleBuilderFieldChange("tone", event.target.value)}
                className="mt-1 rounded-lg border border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none"
              />
            </label>
            <label className="flex flex-col text-xs text-zinc-400">
              Voice
              <input
                value={builderState.voice}
                onChange={(event) => handleBuilderFieldChange("voice", event.target.value)}
                className="mt-1 rounded-lg border border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none"
              />
            </label>
            <label className="flex flex-col text-xs text-zinc-400">
              Bullet style
              <input
                value={builderState.bulletStyle}
                onChange={(event) => handleBuilderFieldChange("bulletStyle", event.target.value)}
                className="mt-1 rounded-lg border border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none"
              />
            </label>
            <label className="flex flex-col text-xs text-zinc-400">
              Layout PDF
              <input
                value={builderState.pdfLayout}
                onChange={(event) => handleBuilderFieldChange("pdfLayout", event.target.value)}
                className="mt-1 rounded-lg border border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none"
              />
            </label>
            <label className="flex flex-col text-xs text-zinc-400">
              Colore accento
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={builderState.accentColor}
                  onChange={(event) => handleBuilderFieldChange("accentColor", event.target.value)}
                  className="h-9 w-12 rounded border border-zinc-700 bg-transparent"
                />
                <span className="text-[11px] text-zinc-400">{builderState.accentColor}</span>
              </div>
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={builderState.includeCover}
                onChange={(event) => handleBuilderFieldChange("includeCover", event.target.checked)}
              />
              Copertina PDF
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={builderState.includeToc}
                onChange={(event) => handleBuilderFieldChange("includeToc", event.target.checked)}
              />
              Sommario PDF
            </label>
            <label className="flex flex-col text-xs text-zinc-400 md:col-span-2">
              Focus suggeriti (una voce per riga)
              <textarea
                value={builderState.focusPrompts}
                onChange={(event) => handleBuilderFieldChange("focusPrompts", event.target.value)}
                className="mt-1 rounded-lg border border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none"
              />
            </label>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="submit"
              className={classNames(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
                submitting
                  ? "border-zinc-700 bg-zinc-800/60 text-zinc-500 cursor-not-allowed"
                  : "border-emerald-500/40 bg-emerald-500/15 text-emerald-100 hover:border-emerald-400"
              )}
              disabled={submitting}
            >
              <Sparkles className={classNames("h-3.5 w-3.5", submitting && "animate-spin")} />
              {submitting ? "Creazione…" : "Crea template"}
            </button>
          </div>
        </form>
      )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filteredPrompts.length === 0 ? (
              <div className="col-span-full rounded-lg border border-dashed border-zinc-700/60 bg-black/10 p-6 text-sm text-zinc-400">
                Nessun template disponibile. Crea un nuovo prompt o aggiorna la libreria.
              </div>
            ) : (
              filteredPrompts.map(renderPromptCard)
            )}
          </div>
        </div>
      )}

      {expandedSections.active && (
        <div className="space-y-3 border-t border-zinc-800/60 p-4">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Target className="h-4 w-4" />
            <span>Template attivo</span>
          </div>
          {renderActivePrompt()}
        </div>
      )}
    </div>
  );
}

