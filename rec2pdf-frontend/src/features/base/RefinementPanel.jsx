// Aggiungi useRef e useEffect
import { useCallback, useId, useMemo, useRef, useEffect } from "react";
// Aggiungi RefreshCw per lo spinner (o usa Sparkles animate-spin)
import { Sparkles, FileText, ClipboardList, XCircle, RefreshCw } from "../../components/icons";
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
// --- UX FIX 1: Auto-scroll (Interno) ---
const panelRef = useRef(null);

useEffect(() => {
  // Appena questo componente viene montato, scorri verso di lui
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

  const segments = useMemo(() => normalizeSegments(refinedData), [refinedData]);
  const cueCards = useMemo(() => normalizeCueCards(activePrompt, refinedData), [activePrompt, refinedData]);

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

  const handleSubmit = useCallback(() => {
    if (!canSubmit) {
      return;
    }
    processViaBackend();
    // 2. UX FIX: Scroll verso l'alto per mostrare il progresso
    // Usiamo un piccolo timeout per dare tempo a React di renderizzare lo stato "busy"
    setTimeout(() => {
      const statusArea = document.getElementById("pipeline-status-area");
      if (statusArea) {
        // Opzione A: Scroll fluido verso il pannello di progresso
        statusArea.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        // Opzione B (Fallback): Se l'elemento non c'è ancora, scrolla a inizio pagina
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 100);

  }, [canSubmit, processViaBackend]);

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
      <section 
        ref={panelRef} 
        className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-white shadow-subtle animate-pulse"
      >
        <Sparkles className="h-10 w-10 animate-spin text-indigo-400" />
        <div>
          <h3 className="text-lg font-semibold uppercase tracking-widest text-white/80">
            Analisi Audio in Corso
          </h3>
          <p className="mt-2 text-sm text-white/50 max-w-md mx-auto">
            L'AI sta riascoltando la registrazione per estrarre i punti chiave e preparare le Cue Cards. Richiede pochi secondi...
          </p>
        </div>
      </section>
    );
  }
  // ----------------------------------------------------
  return (
    <section 
    ref={panelRef}
    className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-subtle">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-lg font-semibold uppercase tracking-[0.32em] text-white/70">
            <Sparkles className="h-4 w-4" /> Raffina il prompt
          </p>
          <p className="text-sm text-white/60">
            Rivedi la trascrizione, completa le cue cards e genera il PDF finale.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:border-white/30 hover:text-white"
          aria-label="Chiudi pannello di raffinazione"
        >
          <XCircle className="h-4 w-4" /> Chiudi
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="flex flex-col rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.28em] text-white/65">
            <FileText className="h-4 w-4" /> Trascrizione
          </div>
          <div className="mt-3 max-h-[420px] space-y-3 overflow-y-auto pr-1 text-sm text-white/70">
            {segments.length > 0 ? (
              segments.map((segment) => {
                const start = formatTimestamp(segment.start);
                const end = formatTimestamp(segment.end);
                const showTime = Boolean(start || end);
                return (
                  <div
                    key={segment.id}
                    className="rounded-xl border border-white/10 bg-white/[0.04] p-3 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.65)]"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-white/50">
                      {showTime ? (
                        <span>{start}{end ? ` – ${end}` : ""}</span>
                      ) : null}
                      {segment.speaker ? (
                        <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] tracking-[0.2em]">
                          {segment.speaker}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-white/80">{segment.text}</p>
                  </div>
                );
              })
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/5 p-6 text-center text-sm text-white/50">
                Nessuna trascrizione disponibile al momento.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label htmlFor={focusFieldId} className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/60">
              Focus
              <textarea
                id={focusFieldId}
                value={focusValue}
                onChange={handleFocusChange}
                placeholder="Definisci l'obiettivo del documento"
                className="min-h-[96px] rounded-2xl border border-white/12 bg-white/[0.08] px-3 py-2 text-sm text-white/90 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/40"
              />
            </label>
            <label htmlFor={notesFieldId} className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/60">
              Note personali
              <textarea
                id={notesFieldId}
                value={notesValue}
                onChange={handleNotesChange}
                placeholder="Annota richieste, vincoli o messaggi chiave"
                className="min-h-[96px] rounded-2xl border border-white/12 bg-white/[0.08] px-3 py-2 text-sm text-white/90 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-300/40"
              />
            </label>
          </div>

          {cueCards.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.28em] text-white/65">
                <ClipboardList className="h-4 w-4" /> Cue cards
              </div>
              <div className="space-y-4">
                {cueCards.map((cue) => {
                  const fieldId = sanitizeId(sanitizedPrefix || "refine", cue.key || cue.title);
                  const value =
                    cueCardAnswers[cue.key] ??
                    refinedCueCardAnswers[cue.key] ??
                    (cue.value || "");
                  const placeholder = cue.hint || `Aggiungi dettagli per ${cue.title.toLowerCase()}`;

                  return (
                    <label
                      key={cue.key || cue.title}
                      htmlFor={fieldId}
                      className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-4"
                    >
                      <span className="text-xs font-semibold uppercase tracking-[0.28em] text-white/65">{cue.title}</span>
                      <textarea
                        id={fieldId}
                        value={value}
                        onChange={(event) => handleCueChange(cue.key, event.target.value)}
                        placeholder={placeholder}
                        className="min-h-[120px] w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none transition focus:border-brand-200 focus:ring-2 focus:ring-brand-200/40"
                      />
                      {cue.hint ? (
                        <p className="text-xs text-white/55">{cue.hint}</p>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-white/55">
              Nessuna cue card disponibile per il template selezionato.
            </div>
          )}

          <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit} // Nota: busy rende canSubmit false, quindi si disabilita da solo
              className={classNames(
                "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold uppercase tracking-[0.28em] transition",
                canSubmit
                  ? "bg-emerald-400 text-slate-950 shadow-[0_18px_60px_-30px_rgba(16,185,129,0.9)] hover:bg-emerald-300"
                  : "cursor-not-allowed border border-white/15 bg-white/10 text-white/55"
              )}
            >
              {busy ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Generazione in corso...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Genera PDF
                </>
              )}
            </button>
            {helperMessage ? (
              <p className="text-xs text-white/55">{helperMessage}</p>
            ) : (
              <p className="text-xs text-white/60">
                Il PDF verrà generato utilizzando le informazioni compilate sopra.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default RefinementPanel;
