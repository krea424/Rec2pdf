import React, { useEffect, useMemo, useState } from "react";
import { classNames } from "../utils/classNames";
import { FileText, FileCode, Cpu, Trash2, Search, ExternalLink, TagIcon, TimerIcon, Folder, RefreshCw, Sparkles } from "./icons";

const formatTimestamp = (iso) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((val) => String(val).padStart(2, "0")).join(":");
};

export default function LibraryPanel({
  entries,
  filter,
  onFilterChange,
  onOpenPdf,
  onOpenMd,
  onShowLogs,
  onRename,
  onUpdateTags,
  onDeleteEntry,
  onClearAll,
  themeStyles,
  activePdfPath,
  onRepublish,
  busy,
}) {
  const [titleDrafts, setTitleDrafts] = useState({});
  const [tagDrafts, setTagDrafts] = useState({});
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    if (!confirmingClear) return;
    const timeout = setTimeout(() => setConfirmingClear(false), 4000);
    return () => clearTimeout(timeout);
  }, [confirmingClear]);

  useEffect(() => {
    setTitleDrafts((prev) => {
      const next = {};
      (entries || []).forEach((entry) => {
        const key = String(entry.id);
        if (Object.prototype.hasOwnProperty.call(prev, key)) {
          next[key] = prev[key];
        }
      });
      return next;
    });
    setTagDrafts((prev) => {
      const next = {};
      (entries || []).forEach((entry) => {
        const key = String(entry.id);
        if (Object.prototype.hasOwnProperty.call(prev, key)) {
          next[key] = prev[key];
        }
      });
      return next;
    });
  }, [entries]);

  const normalizedEntries = useMemo(() => {
    if (!Array.isArray(entries)) return [];
    return [...entries].sort((a, b) => {
      const aTime = new Date(a?.timestamp || 0).getTime();
      const bTime = new Date(b?.timestamp || 0).getTime();
      return Number.isNaN(bTime) - Number.isNaN(aTime) || bTime - aTime;
    });
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (!filter) return normalizedEntries;
    const query = filter.toLowerCase();
    return normalizedEntries.filter((entry) => {
      const haystack = [
        entry?.title,
        entry?.slug,
        entry?.pdfPath,
        entry?.mdPath,
        Array.isArray(entry?.tags) ? entry.tags.join(" ") : "",
        entry?.logos?.frontend,
        entry?.logos?.pdf,
        entry?.prompt?.title,
        entry?.prompt?.persona,
        Array.isArray(entry?.prompt?.tags) ? entry.prompt.tags.join(" ") : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [normalizedEntries, filter]);

  const handleClearAll = () => {
    if (!Array.isArray(entries) || entries.length === 0) return;
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    onClearAll?.();
    setConfirmingClear(false);
    setTitleDrafts({});
    setTagDrafts({});
  };

  const renderTagBadges = (entry) => {
    if (!Array.isArray(entry?.tags) || entry.tags.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {entry.tags.map((tag) => (
          <span
            key={`${entry.id}-${tag}`}
            className="px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-lg border border-zinc-700/60 bg-black/20 text-zinc-300"
          >
            #{tag}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
            <input
              value={filter}
              onChange={(event) => onFilterChange?.(event.target.value)}
              placeholder="Cerca per titolo, slug, tag o percorso"
              className={classNames(
                "w-full rounded-xl border bg-transparent px-9 py-2 text-sm outline-none",
                themeStyles?.input
              )}
            />
            {filter && (
              <button
                onClick={() => onFilterChange?.("")}
                className="absolute right-2 top-2 rounded-lg px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Pulisci
              </button>
            )}
          </div>
          {Array.isArray(entries) && entries.length > 0 && (
            <button
              onClick={handleClearAll}
              className={classNames(
                "flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium transition",
                confirmingClear ? "bg-rose-600 text-white" : "bg-rose-900/40 text-rose-200 hover:bg-rose-800/50"
              )}
            >
              <Trash2 className="w-4 h-4" /> {confirmingClear ? "Conferma" : "Svuota"}
            </button>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>
            {filteredEntries.length} di {normalizedEntries.length} sessioni mostrate
          </span>
          {filter && (
            <button
              onClick={() => onFilterChange?.("")}
              className="text-zinc-400 hover:text-zinc-200"
            >
              Mostra tutte
            </button>
          )}
        </div>
      </div>
      <div className="max-h-80 overflow-auto pr-1 space-y-3">
        {filteredEntries.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-500">
            Nessuna sessione salvata. Esegui una pipeline per popolare la Libreria.
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const entryId = String(entry.id);
            const titleValue = titleDrafts[entryId] ?? entry?.title ?? entry?.slug ?? "Sessione";
            const tagsDraft = tagDrafts[entryId] ?? (Array.isArray(entry?.tags) ? entry.tags.join(", ") : "");
            const isActive = activePdfPath && entry?.pdfPath && activePdfPath === entry.pdfPath;
            const resolvedMdPath = entry?.mdPath?.trim?.() || (entry?.pdfPath && /\.pdf$/i.test(entry.pdfPath) ? entry.pdfPath.replace(/\.pdf$/i, '.md') : '');
            const canOpenMd = Boolean(resolvedMdPath);
            const canRepublish = canOpenMd && !busy;
            const frontendLogo = entry?.logos?.frontend === 'custom' ? 'Frontend personalizzato' : 'Frontend default';
            const pdfLogo = entry?.logos?.pdf && entry.logos.pdf !== 'default' ? `PDF: ${entry.logos.pdf}` : 'PDF default';
            return (
              <article
                key={entry.id}
                className={classNames(
                  "rounded-xl border p-3 text-sm transition",
                  themeStyles?.input,
                  isActive && "border-emerald-400/70"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        className={classNames(
                          "flex-1 rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none",
                          themeStyles?.input
                        )}
                        value={titleValue}
                        onChange={(event) =>
                          setTitleDrafts((prev) => ({ ...prev, [entryId]: event.target.value }))
                        }
                        onBlur={() => {
                          const finalValue = (titleDrafts[entryId] ?? titleValue).trim() || entry?.slug || "Sessione";
                          setTitleDrafts((prev) => ({ ...prev, [entryId]: finalValue }));
                          onRename?.(entry.id, finalValue);
                        }}
                      />
                      <span className="text-xs text-zinc-500 whitespace-nowrap">
                        {formatTimestamp(entry?.timestamp)}
                      </span>
                      <button
                        onClick={() => onDeleteEntry?.(entry.id)}
                        className="rounded-lg bg-rose-900/40 px-2 py-1 text-xs text-rose-200 hover:bg-rose-800/60"
                      >
                        Elimina
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-400">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5" /> {entry?.slug || '—'}
                      </div>
                      <div className="flex items-center gap-2">
                        <TimerIcon className="w-3.5 h-3.5" /> {formatDuration(entry?.duration)}
                      </div>
                      <div className="flex items-start gap-2 sm:col-span-2 break-words">
                        <Folder className="mt-0.5 w-3.5 h-3.5" />
                        <span className="font-mono text-[11px] text-zinc-300">{entry?.pdfPath || '—'}</span>
                      </div>
                      <div className="flex items-start gap-2 sm:col-span-2 break-words">
                        <FileCode className="mt-0.5 w-3.5 h-3.5" />
                        <span className="font-mono text-[11px] text-zinc-300">{entry?.mdPath || '—'}</span>
                      </div>
                      <div className="flex items-start gap-2 sm:col-span-2">
                        <TagIcon className="mt-0.5 w-3.5 h-3.5" />
                        <span className="text-xs text-zinc-300">
                          {frontendLogo} · {pdfLogo}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => onOpenPdf?.(entry)}
                        className={classNames(
                          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition",
                          entry?.pdfPath ? "bg-indigo-600 text-white hover:bg-indigo-500" : "bg-zinc-800/60 text-zinc-500 cursor-not-allowed"
                        )}
                        disabled={!entry?.pdfPath}
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Apri PDF
                      </button>
                      <button
                        onClick={() => onOpenMd?.(entry, resolvedMdPath)}
                        className={classNames(
                          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition",
                          canOpenMd ? "bg-sky-700 text-white hover:bg-sky-600" : "bg-zinc-800/60 text-zinc-500 cursor-not-allowed"
                        )}
                        disabled={!canOpenMd}
                      >
                        <FileCode className="w-3.5 h-3.5" /> Modifica MD
                      </button>
                      <button
                        onClick={() => onRepublish?.(entry, resolvedMdPath)}
                        className={classNames(
                          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition",
                          canRepublish
                            ? "bg-emerald-600 text-white hover:bg-emerald-500"
                            : "bg-zinc-800/60 text-zinc-500 cursor-not-allowed"
                        )}
                        disabled={!canRepublish}
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> {busy ? 'Attendi…' : 'Rigenera PDF'}
                      </button>
                      <button
                        onClick={() => onShowLogs?.(entry)}
                        className={classNames(
                          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition",
                          Array.isArray(entry?.logs) && entry.logs.length
                            ? "bg-zinc-800/70 text-zinc-100 hover:bg-zinc-700/80"
                            : "bg-zinc-800/40 text-zinc-500 cursor-not-allowed"
                        )}
                        disabled={!entry?.logs || entry.logs.length === 0}
                      >
                        <Cpu className="w-3.5 h-3.5" /> Riapri log
                      </button>
                      <input
                        value={tagsDraft}
                        onChange={(event) =>
                          setTagDrafts((prev) => ({ ...prev, [entryId]: event.target.value }))
                        }
                        onBlur={() => {
                          const raw = tagDrafts[entryId] ?? '';
                          const tags = raw
                            .split(',')
                            .map((chunk) => chunk.trim())
                            .filter(Boolean);
                          setTagDrafts((prev) => ({ ...prev, [entryId]: tags.join(', ') }));
                          onUpdateTags?.(entry.id, tags);
                        }}
                        placeholder="tag1, tag2"
                        className={classNames(
                          "min-w-[160px] flex-1 rounded-lg border bg-transparent px-3 py-1.5 text-xs outline-none",
                          themeStyles?.input
                        )}
                      />
                    </div>
                    {renderTagBadges(entry)}
                    {entry?.prompt?.title && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-indigo-200">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>{entry.prompt.title}</span>
                        {Number.isFinite(entry?.structure?.promptChecklist?.score) && (
                          <span className="rounded-full border border-indigo-400/40 bg-indigo-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                            Template {Math.round(entry.structure.promptChecklist.score)}%
                          </span>
                        )}
                      </div>
                    )}
                    {entry?.structure?.promptChecklist?.missing?.length > 0 && (
                      <div className="mt-1 text-xs text-amber-300">
                        Gap template: {entry.structure.promptChecklist.missing.join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}