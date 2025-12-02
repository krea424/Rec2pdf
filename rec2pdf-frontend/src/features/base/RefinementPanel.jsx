import React, { useCallback, useId, useMemo, useRef, useEffect, useState } from "react";
import { Sparkles, FileText, ClipboardList, XCircle, RefreshCw, CheckCircle2, ChevronDown } from "../../components/icons";
import { useAppContext } from "../../hooks/useAppContext";
import { classNames } from "../../utils/classNames";

const sanitizeId = (prefix, key) => {
  const normalizedPrefix = String(prefix || "refine").replace(/[^a-zA-Z0-9_-]/g, "");
  const normalizedKey = String(key || "field").replace(/[^a-zA-Z0-9_-]/g, "-");
  return `${normalizedPrefix}-${normalizedKey}`;
};

const pickNumber = (source, keys = []) => {
  for (const key of keys) {
    const value = source?.[key];
    if (Number.isFinite(value)) {
      return Number(value);
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};

const normalizeSegments = (data) => {
  if (!data) {
    return [];
  }

  const candidateLists = [
    Array.isArray(data?.segments) ? data.segments : null,
    Array.isArray(data?.transcriptSegments) ? data.transcriptSegments : null,
    Array.isArray(data?.transcriptionSegments) ? data.transcriptionSegments : null,
    Array.isArray(data?.chunks) ? data.chunks : null,
  ].filter((list) => Array.isArray(list) && list.length > 0);

  const resolveText = (segment) => {
    if (!segment || typeof segment !== "object") {
      return "";
    }
    const candidates = [segment.text, segment.transcript, segment.content, segment.caption, segment.body];
    return candidates.find((value) => typeof value === "string" && value.trim()) || "";
  };

  if (candidateLists.length > 0) {
    return candidateLists[0]
      .map((raw, index) => {
        if (!raw) {
          return null;
        }
        if (typeof raw === "string") {
          const text = raw.trim();
          if (!text) {
            return null;
          }
          return {
            id: `segment_${index}`,
            text,
            speaker: "",
            start: null,
            end: null,
          };
        }
        if (typeof raw === "object") {
          const text = resolveText(raw).trim();
          if (!text) {
            return null;
          }
          const speaker = [raw.speaker, raw.speakerLabel, raw.speakerName]
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .find((value) => value);
          const start = pickNumber(raw, ["start", "startTime", "begin", "offset"]);
          const end = pickNumber(raw, ["end", "endTime", "finish", "to"]);
          const id = raw.id || raw.key || raw.segmentId || `segment_${index}`;
          return {
            id,
            text,
            speaker: speaker || "",
            start,
            end,
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  const rawTextCandidates = [
    typeof data?.transcription === "string" ? data.transcription : null,
    typeof data?.transcript === "string" ? data.transcript : null,
    typeof data?.text === "string" ? data.text : null,
    typeof data === "string" ? data : null,
  ];
  const textPayload = rawTextCandidates.find((value) => typeof value === "string" && value.trim());
  if (!textPayload) {
    return [];
  }
  return textPayload
    .split(/\r?\n/)
    .map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return null;
      }
      return {
        id: `line_${index}`,
        text: trimmed,
        speaker: "",
        start: null,
        end: null,
      };
    })
    .filter(Boolean);
};

const formatTimestamp = (value) => {
  if (!Number.isFinite(value)) {
    return "";
  }
  const clamped = Math.max(0, Math.floor(value));
  const minutes = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (clamped % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const normalizeCueCards = (activePrompt, refinedData) => {
  const sources = [];
  if (Array.isArray(activePrompt?.cueCards) && activePrompt.cueCards.length > 0) {
    sources.push(activePrompt.cueCards);
  }
  if (Array.isArray(refinedData?.cueCards) && refinedData.cueCards.length > 0) {
    sources.push(refinedData.cueCards);
  }
  const list = sources.length > 0 ? sources[0] : [];
  return list
    .map((cue, index) => {
      if (!cue || typeof cue !== "object") {
        return null;
      }
      const title = [cue.title, cue.label, cue.name]
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .find((value) => value);
      if (!title) {
        return null;
      }
      const key = cue.key || cue.id || `cue_${index}`;
      const hint = [cue.hint, cue.placeholder, cue.description, cue.example]
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .find((value) => value);
      const value = [cue.value, cue.answer, cue.response, cue.text]
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .find((entry) => entry);
      return {
        key,
        title,
        hint: hint || "",
        value: value || "",
      };
    })
    .filter(Boolean);
};

const RefinementPanel = () => {
  const {
    refinedData,
    activePrompt,
    promptState,
    handlePromptFocusChange,
    handlePromptNotesChange,
    setPromptFocus,
    setPromptNotes,
    setCueCardAnswers,
    processViaBackend,
    closeRefinementPanel,
    busy,
    audioBlob,
    backendUp,
  } = useAppContext();

  const panelRef = useRef(null);

  // Full-screen experience: lock background scroll while the panel is open
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (panelRef.current) {
      setTimeout(() => {
        panelRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    }
  }, []);

  const idPrefix = useId();
  const sanitizedPrefix = useMemo(() => idPrefix.replace(/[^a-zA-Z0-9_-]/g, ""), [idPrefix]);

  const focusFieldId = `${sanitizedPrefix || "refine"}-focus`;
  const notesFieldId = `${sanitizedPrefix || "refine"}-notes`;

  const cueCardAnswers = promptState?.cueCardAnswers || {};
  const suggestedAnswers = useMemo(() => {
    const list = Array.isArray(refinedData?.suggestedAnswers) ? refinedData.suggestedAnswers : [];
    return list.reduce((acc, entry) => {
      if (!entry || typeof entry !== "object") return acc;
      const key = typeof entry.key === "string" ? entry.key.trim() : "";
      const answer = typeof entry.answer === "string" ? entry.answer.trim() : "";
      if (key && answer) acc[key] = answer;
      return acc;
    }, {});
  }, [refinedData]);
  const refinedCueCardAnswers = useMemo(() => {
    if (!refinedData || typeof refinedData !== "object") {
      return {};
    }
    const answers = refinedData.cueCardAnswers;
    if (!answers || typeof answers !== "object") {
      return {};
    }
    return Object.entries(answers).reduce((acc, [key, value]) => {
      if (typeof key !== "string") {
        return acc;
      }
      const trimmedKey = key.trim();
      if (!trimmedKey) {
        return acc;
      }
      const text = typeof value === "string" ? value.trim() : "";
      if (!text) {
        return acc;
      }
      acc[trimmedKey] = text;
      return acc;
    }, {});
  }, [refinedData]);
  const focusValue = promptState?.focus || "";
  const notesValue = promptState?.notes || "";
  const [collapsedCues, setCollapsedCues] = useState({});
  const [segmentFilter, setSegmentFilter] = useState("all");

  const segments = useMemo(() => normalizeSegments(refinedData), [refinedData]);
  const cueCards = useMemo(() => normalizeCueCards(activePrompt, refinedData), [activePrompt, refinedData]);
  const answeredCount = useMemo(
    () =>
      cueCards.filter((cue) => {
        const value = cueCardAnswers[cue.key] ?? refinedCueCardAnswers[cue.key] ?? cue.value;
        return typeof value === "string" && value.trim();
      }).length,
    [cueCards, cueCardAnswers, refinedCueCardAnswers],
  );
  const hasSuggestions = useMemo(
    () => cueCards.some((cue) => suggestedAnswers[cue.key]),
    [cueCards, suggestedAnswers],
  );

  const canSubmit = Boolean(audioBlob) && busy !== true && backendUp !== false && typeof processViaBackend === "function";

  const handleFocusChange = useCallback(
    (event) => {
      const value = event?.target?.value ?? "";
      if (typeof handlePromptFocusChange === "function") {
        handlePromptFocusChange(value);
        return;
      }
      if (typeof setPromptFocus === "function") {
        setPromptFocus(value);
      }
    },
    [handlePromptFocusChange, setPromptFocus],
  );

  const handleNotesChange = useCallback(
    (event) => {
      const value = event?.target?.value ?? "";
      if (typeof handlePromptNotesChange === "function") {
        handlePromptNotesChange(value);
        return;
      }
      if (typeof setPromptNotes === "function") {
        setPromptNotes(value);
      }
    },
    [handlePromptNotesChange, setPromptNotes],
  );

  const handleCueChange = useCallback(
    (cueKey, value) => {
      if (typeof setCueCardAnswers !== "function") {
        return;
      }
      setCueCardAnswers((prev) => {
        const draft = prev && typeof prev === "object" ? { ...prev } : {};
        draft[cueKey] = value;
        return draft;
      });
    },
    [setCueCardAnswers],
  );

  const handleCueSuggestion = useCallback(
    (cueKey, answer) => {
      if (!cueKey || !answer || typeof setCueCardAnswers !== "function") return;
      setCueCardAnswers((prev) => {
        const draft = prev && typeof prev === "object" ? { ...prev } : {};
        draft[cueKey] = answer;
        return draft;
      });
      setCollapsedCues((prev) => ({ ...prev, [cueKey]: true }));
    },
    [setCueCardAnswers],
  );

  const toggleCueCollapse = useCallback((cueKey) => {
    setCollapsedCues((prev) => ({ ...prev, [cueKey]: !prev[cueKey] }));
  }, []);

  const applyAllSuggestions = useCallback(() => {
    if (!hasSuggestions || typeof setCueCardAnswers !== "function") return;
    setCueCardAnswers((prev) => {
      const draft = prev && typeof prev === "object" ? { ...prev } : {};
      cueCards.forEach((cue) => {
        if (!cue?.key) return;
        const answer = suggestedAnswers[cue.key];
        const already = typeof draft[cue.key] === "string" && draft[cue.key].trim();
        if (answer && !already) {
          draft[cue.key] = answer;
        }
      });
      return draft;
    });
    setCollapsedCues((prev) => {
      const next = { ...prev };
      cueCards.forEach((cue) => {
        if (suggestedAnswers[cue.key]) next[cue.key] = true;
      });
      return next;
    });
  }, [cueCards, hasSuggestions, setCueCardAnswers, suggestedAnswers]);

  const matchByFilter = useCallback((segment, filterKey) => {
    if (filterKey === "all") return true;
    const text = (segment?.text || "").toLowerCase();
    if (!text) return false;
    const rules = {
      decisions: ["decid", "approv", "scelta", "concord", "deliber"],
      risks: ["risch", "proble", "critic", "blocc", "issue"],
      actions: ["azione", "task", "fare", "prossim", "next step", "attività"],
    };
    const tokens = rules[filterKey] || [];
    return tokens.some((token) => text.includes(token));
  }, []);

  const filteredSegments = useMemo(
    () => segments.filter((segment) => matchByFilter(segment, segmentFilter)),
    [segments, matchByFilter, segmentFilter],
  );
  const segmentCounts = useMemo(() => {
    const base = { all: segments.length, decisions: 0, risks: 0, actions: 0 };
    segments.forEach((seg) => {
      if (matchByFilter(seg, "decisions")) base.decisions += 1;
      if (matchByFilter(seg, "risks")) base.risks += 1;
      if (matchByFilter(seg, "actions")) base.actions += 1;
    });
    return base;
  }, [segments, matchByFilter]);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) {
      return;
    }
    
    // 1. Chiudi il pannello PRIMA di avviare il processo
    if (typeof closeRefinementPanel === "function") {
      closeRefinementPanel();
    }

    // 2. Avvia la pipeline
    processViaBackend();

    // 3. Scroll verso l'alto
    setTimeout(() => {
      const statusArea = document.getElementById("pipeline-status-area");
      if (statusArea) {
        statusArea.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 100);

  }, [canSubmit, processViaBackend, closeRefinementPanel]);

  const handleClose = useCallback(() => {
    if (typeof closeRefinementPanel === "function") {
      closeRefinementPanel();
    }
  }, [closeRefinementPanel]);

  const helperMessage = useMemo(() => {
    if (!audioBlob) {
      return "Carica o registra un audio per avviare la generazione.";
    }
    if (backendUp === false) {
      return "Il backend non è raggiungibile. Controlla la connessione.";
    }
    if (busy) {
      return "Pipeline in corso, attendere il completamento.";
    }
    return "";
  }, [audioBlob, backendUp, busy]);

  if (busy && !refinedData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl px-6">
        <div
          ref={panelRef}
          className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0b0b10] p-8 text-center text-white shadow-2xl shadow-black/30 animate-pulse"
        >
          <RefreshCw className="mx-auto h-10 w-10 animate-spin text-indigo-400" />
          <div className="mt-4">
            <h3 className="text-lg font-semibold uppercase tracking-widest text-white/80">
              Analisi Audio in Corso
            </h3>
            <p className="mt-2 text-sm text-white/60">
              L'AI sta preparando trascrizione e Cue Cards. Attendi qualche secondo...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-stretch">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/95 via-slate-950/90 to-slate-950/92 backdrop-blur-xl" />
      <div
        ref={panelRef}
        className="relative flex h-full w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8 mx-auto"
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-lg shadow-lg shadow-black/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">Raffina il Prompt</p>
              <p className="text-sm font-semibold text-white">
                {activePrompt?.title || "Auto-Detect attivo"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            {helperMessage ? (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-amber-100">
                {helperMessage}
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-100">
                Pronto per generare
              </span>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-300 hover:bg-white/15 hover:text-white transition"
            >
              <XCircle className="h-4 w-4" /> Chiudi
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="relative flex-1 overflow-hidden">
          <div className="absolute inset-0 overflow-y-auto pb-28 custom-scrollbar">
            <div className="grid min-h-[70vh] gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              {/* Left: transcript */}
              <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-[#0b0b10] shadow-xl shadow-black/30 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.03]">
                  <FileText className="h-4 w-4 text-zinc-400" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">
                    Trascrizione Rilevata
                  </span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-white/[0.02]">
                  {["all", "decisions", "risks", "actions"].map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSegmentFilter(key)}
                      className={classNames(
                        "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition",
                        segmentFilter === key
                          ? "border-indigo-400/40 bg-indigo-500/20 text-indigo-50"
                          : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                      )}
                    >
                      {key === "all"
                        ? `Tutti (${segmentCounts.all})`
                        : key === "decisions"
                        ? `Decisioni (${segmentCounts.decisions})`
                        : key === "risks"
                        ? `Rischi (${segmentCounts.risks})`
                        : `Azioni (${segmentCounts.actions})`}
                    </button>
                  ))}
                </div>
                <div className="flex-1 p-4 lg:p-5 space-y-3 overflow-y-auto custom-scrollbar">
                  {filteredSegments.length > 0 ? (
                    filteredSegments.map((segment) => (
                      <div
                        key={segment.id}
                        className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs leading-relaxed text-zinc-200 shadow-inner shadow-black/30"
                      >
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 mb-1 flex-wrap">
                          {segment.speaker ? (
                            <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 font-semibold text-indigo-100 uppercase tracking-[0.08em] border border-indigo-500/30">
                              {segment.speaker}
                            </span>
                          ) : null}
                          {segment.start !== null && (
                            <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-white border border-white/10">
                              {formatTimestamp(segment.start)}
                            </span>
                          )}
                          {segmentFilter !== "all" && (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-100 border border-emerald-500/20">
                              Filtro: {segmentFilter}
                            </span>
                          )}
                        </div>
                        <p>{segment.text}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-xs text-zinc-600 italic">
                      Nessuna trascrizione disponibile.
                    </div>
                  )}
                </div>
              </div>

              {/* Right: inputs */}
              <div className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor={focusFieldId}
                      className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 ml-1"
                    >
                      Focus del Documento
                    </label>
                    <textarea
                      id={focusFieldId}
                      value={focusValue}
                      onChange={handleFocusChange}
                      placeholder="Es. Enfatizza i rischi finanziari..."
                      className="w-full min-h-[110px] rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/50 outline-none transition resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor={notesFieldId}
                      className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 ml-1"
                    >
                      Note Personali
                    </label>
                    <textarea
                      id={notesFieldId}
                      value={notesValue}
                      onChange={handleNotesChange}
                      placeholder="Es. Usa un tono formale, cita il cliente X..."
                      className="w-full min-h-[110px] rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/50 outline-none transition resize-none"
                    />
                  </div>
                </div>

                {cueCards.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 shadow-inner shadow-black/20">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400 mb-3">
                      <span className="inline-flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" /> Domande Guida (Cue Cards)
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200 border border-emerald-500/20">
                          {answeredCount}/{cueCards.length} completate
                        </span>
                        {hasSuggestions && (
                          <button
                            type="button"
                            onClick={applyAllSuggestions}
                            className="rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-1 text-[10px] font-semibold text-indigo-50 hover:bg-indigo-500/25 transition"
                          >
                            Applica suggerimenti
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {cueCards.map((cue) => {
                        const fieldId = sanitizeId(sanitizedPrefix || "refine", cue.key || cue.title);
                        const value = cueCardAnswers[cue.key] ?? refinedCueCardAnswers[cue.key] ?? (cue.value || "");
                        const suggested = suggestedAnswers[cue.key];
                        const isAnswered = typeof value === "string" && value.trim().length > 0;
                        const collapsed =
                          typeof collapsedCues[cue.key] === "boolean"
                            ? collapsedCues[cue.key]
                            : isAnswered;
                        const preview = (isAnswered ? value : suggested || "").slice(0, 120);

                        return (
                          <div
                            key={cue.key || cue.title}
                            className="rounded-xl border border-white/10 bg-[#0f1115] p-3 shadow-inner shadow-black/30"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  {isAnswered ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                  ) : (
                                    <ClipboardList className="h-4 w-4 text-zinc-500" />
                                  )}
                                  <span
                                    className="text-sm font-semibold text-white truncate"
                                    title={cue.title}
                                  >
                                    {cue.title}
                                  </span>
                                </div>
                                <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                                  {cue.hint || "Suggerisci la risposta migliore"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {suggested && !isAnswered ? (
                                  <button
                                    type="button"
                                    onClick={() => handleCueSuggestion(cue.key, suggested)}
                                    className="rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold text-indigo-100 hover:bg-indigo-500/20 transition"
                                  >
                                    Usa suggerimento
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => toggleCueCollapse(cue.key)}
                                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:bg-white/10 transition inline-flex items-center gap-1"
                                >
                                  <ChevronDown
                                    className={classNames(
                                      "h-3 w-3 transition-transform",
                                      collapsed ? "-rotate-90" : "rotate-0"
                                    )}
                                  />
                                  {collapsed ? "Espandi" : "Riduci"}
                                </button>
                              </div>
                            </div>

                            {collapsed ? (
                              <p className="mt-2 text-sm text-zinc-300 line-clamp-2">
                                {preview || "Nessuna risposta ancora."}
                              </p>
                            ) : (
                              <textarea
                                id={fieldId}
                                value={value}
                                onChange={(event) => handleCueChange(cue.key, event.target.value)}
                                placeholder={cue.hint || "Inserisci risposta..."}
                                className="mt-3 w-full min-h-[70px] rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/50 outline-none transition resize-none"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Persistent action bar */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 pb-4">
          <div className="pointer-events-auto w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0b0d14]/85 px-4 py-3 shadow-2xl shadow-black/30 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-zinc-300">
                {helperMessage || "Revisiona i campi e genera il PDF finale."}
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={classNames(
                  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wide transition-all shadow-lg",
                  canSubmit
                    ? "bg-emerald-500 text-slate-900 hover:bg-emerald-400 hover:shadow-emerald-900/30"
                    : "bg-white/5 text-zinc-500 cursor-not-allowed border border-white/10"
                )}
              >
                {busy ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Elaborazione in corso...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Genera PDF Finale
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RefinementPanel;
