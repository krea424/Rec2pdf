import React from "react";
import { classNames } from "../utils/classNames";
import { FileCode, Save, RefreshCw, ExternalLink, XCircle } from "./icons";

export default function MarkdownEditorModal({
  open,
  title,
  path,
  value,
  onChange,
  onClose,
  onSave,
  onRepublish,
  loading,
  saving,
  error,
  success,
  hasUnsavedChanges,
  onOpenInNewTab,
  busy,
  themeStyles,
}) {
  if (!open) return null;

  const handleClose = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        "Ci sono modifiche non salvate. Vuoi davvero chiudere l'editor?"
      );
      if (!confirmed) {
        return;
      }
    }
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur">
      <div
        className={classNames(
          "mx-4 flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border shadow-2xl",
          themeStyles?.card
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Modifica Markdown</h2>
            <p className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
              <FileCode className="h-4 w-4" />
              <span className="font-mono text-[11px] text-zinc-300 break-all">{path}</span>
            </p>
            {title && (
              <p className="mt-1 text-xs text-zinc-500">Sessione: {title}</p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="flex items-center gap-1 rounded-lg bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-700/80"
          >
            <XCircle className="h-4 w-4" /> Chiudi
          </button>
        </div>
        <div className="flex-1 overflow-auto px-6 py-4">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-sm text-zinc-400">
              Caricamento del Markdown…
            </div>
          ) : (
            <textarea
              value={value}
              onChange={(event) => onChange?.(event.target.value)}
              className={classNames(
                "h-[420px] w-full resize-none rounded-xl border px-4 py-3 font-mono text-sm leading-relaxed text-zinc-100 shadow-inner",
                themeStyles?.input
              )}
              spellCheck={false}
              disabled={saving}
            />
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            {error && (
              <span className="rounded-lg bg-rose-900/50 px-3 py-1 text-rose-200">❌ {error}</span>
            )}
            {success && !error && (
              <span className="rounded-lg bg-emerald-900/40 px-3 py-1 text-emerald-200">✅ {success}</span>
            )}
            {hasUnsavedChanges && !loading && !saving && (
              <span className="rounded-lg bg-amber-900/40 px-3 py-1 text-amber-200">
                Modifiche non salvate
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-6 py-4 text-xs">
          <div className="flex items-center gap-2 text-zinc-500">
            {typeof onOpenInNewTab === 'function' && (
              <button
                type="button"
                onClick={() => onOpenInNewTab?.()}
                className="flex items-center gap-1 rounded-lg bg-zinc-800/70 px-3 py-1.5 text-xs text-zinc-200 transition hover:bg-zinc-700/80"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Apri in nuova scheda
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onRepublish?.()}
              disabled={busy || hasUnsavedChanges || !onRepublish}
              className={classNames(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition",
                busy || hasUnsavedChanges
                  ? "bg-zinc-800/60 text-zinc-500 cursor-not-allowed"
                  : "bg-emerald-600 text-white hover:bg-emerald-500"
              )}
            >
              <RefreshCw className={classNames("h-4 w-4", busy && "animate-spin") } />
              {busy ? "Rigenerazione…" : hasUnsavedChanges ? "Salva per rigenerare" : "Rigenera PDF"}
            </button>
            <button
              onClick={() => onSave?.(value)}
              disabled={loading || saving || !hasUnsavedChanges}
              className={classNames(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition",
                loading || saving || !hasUnsavedChanges
                  ? "bg-zinc-800/60 text-zinc-500 cursor-not-allowed"
                  : "bg-sky-600 text-white hover:bg-sky-500"
              )}
            >
              <Save className={classNames("h-4 w-4", saving && "animate-pulse") } />
              {saving ? "Salvataggio…" : "Salva Markdown"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

