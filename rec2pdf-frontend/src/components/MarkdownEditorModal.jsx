import React from "react";
import { classNames } from "../utils/classNames";
import { FileCode, Save, RefreshCw, ExternalLink, XCircle } from "./icons";
import { Button, IconButton } from "./ui/Button";
import { TextArea } from "./ui/Input";
import { Toast } from "./ui/Toast";
import { Skeleton } from "./ui/Skeleton";

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
          "mx-4 flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-surface-800 bg-surface-950/95 shadow-raised",
          themeStyles?.card
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-surface-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-surface-25">Modifica Markdown</h2>
            <p className="mt-1 flex items-center gap-2 text-xs text-surface-300">
              <FileCode className="h-4 w-4" />
              <span className="break-all font-mono text-[11px] text-surface-200">{path}</span>
            </p>
            {title && (
              <p className="mt-1 text-xs text-surface-400">Sessione: {title}</p>
            )}
          </div>
          <IconButton
            variant="ghost"
            onClick={handleClose}
            aria-label="Chiudi editor"
          >
            <XCircle className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-auto px-6 py-4">
          {loading ? (
            <Skeleton className="h-[420px] w-full rounded-2xl bg-surface-800/70" />
          ) : (
            <TextArea
              value={value}
              onChange={(event) => onChange?.(event.target.value)}
              spellCheck={false}
              disabled={saving}
              containerClassName="w-full"
              className={classNames(
                "h-[420px] resize-none font-mono leading-relaxed",
                themeStyles?.input
              )}
            />
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {error ? (
              <Toast tone="danger" description={error} className="text-xs" />
            ) : null}
            {success && !error ? (
              <Toast tone="success" description={success} className="text-xs" />
            ) : null}
            {hasUnsavedChanges && !loading && !saving ? (
              <Toast tone="warning" description="Modifiche non salvate" className="text-xs" />
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-800 bg-surface-900/60 px-6 py-4 text-xs">
          <div className="flex items-center gap-2 text-surface-300">
            {typeof onOpenInNewTab === "function" && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onOpenInNewTab?.()}
                leadingIcon={ExternalLink}
              >
                Apri in nuova scheda
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => onRepublish?.()}
              disabled={busy || hasUnsavedChanges || !onRepublish}
              variant="secondary"
              size="sm"
              leadingIcon={RefreshCw}
              isLoading={busy}
            >
              {busy ? "Rigenerazione…" : hasUnsavedChanges ? "Salva per rigenerare" : "Rigenera PDF"}
            </Button>
            <Button
              onClick={() => onSave?.(value)}
              disabled={loading || saving || !hasUnsavedChanges}
              variant="primary"
              size="sm"
              leadingIcon={Save}
              isLoading={saving}
            >
              {saving ? "Salvataggio…" : "Salva Markdown"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

