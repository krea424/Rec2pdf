import React from "react";
import { classNames } from "../utils/classNames";
import {
  FileCode,
  Save,
  RefreshCw,
  ExternalLink,
  XCircle,
  ChevronLeft,
  CheckCircle2,
} from "./icons";
import { Button, IconButton } from "./ui/Button";
import { TextArea } from "./ui/Input";
import { Toast } from "./ui/Toast";
import { Skeleton } from "./ui/Skeleton";
import SpeakerMapper from "./SpeakerMapper";

export default function MarkdownEditorModal({
  open,
  title,
  path,
  value,
  renderedValue,
  onChange,
  onClose,
  onSave,
  onRepublish,
  onRepublishWithSpeakers,
  loading,
  saving,
  error,
  success,
  hasUnsavedChanges,
  onOpenInNewTab,
  onViewPdf,
  canViewPdf,
  busy,
  themeStyles,
  lastAction,
  speakers = [],
  speakerMap = {},
  onSpeakerMapChange,
  speakerMapHasNames = false,
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

  const stepContainerClasses = {
    pending: "border-surface-800/80 bg-surface-900/60",
    "in-progress": "border-sky-500/40 bg-sky-500/10",
    done: "border-emerald-500/40 bg-emerald-500/10",
  };

  const stepTitleClasses = {
    pending: "text-surface-200",
    "in-progress": "text-sky-50",
    done: "text-emerald-50",
  };

  const stepDescriptionClasses = {
    pending: "text-surface-400",
    "in-progress": "text-sky-200",
    done: "text-emerald-200",
  };

  const stepBadgeClasses = {
    pending: "bg-surface-800 text-surface-200",
    "in-progress": "bg-sky-500/20 text-sky-100",
    done: "bg-emerald-500/20 text-emerald-100",
  };

  const stepStatusLabels = {
    pending: "Da completare",
    "in-progress": "In corso",
    done: "Completato",
  };

  const normalizedLastAction = lastAction || "idle";
  const stepOneStatus = hasUnsavedChanges || normalizedLastAction === "editing"
    ? "in-progress"
    : ["saved", "republished"].includes(normalizedLastAction)
      ? "done"
      : "pending";
  const stepTwoStatus = saving
    ? "in-progress"
    : hasUnsavedChanges
      ? "pending"
    : ["saved", "republished"].includes(normalizedLastAction)
      ? "done"
      : "pending";
  const isRepublishing = busy || normalizedLastAction === "republishing";
  const stepThreeStatus = isRepublishing
    ? "in-progress"
    : normalizedLastAction === "republished"
      ? "done"
      : "pending";
  const showSpeakerMapper = Array.isArray(speakers) && speakers.length > 0;
  const previewContent = typeof renderedValue === "string" ? renderedValue : value;

  const stepOneDescription = hasUnsavedChanges
    ? "Apporta le correzioni direttamente nel testo del documento. Hai modifiche non ancora salvate."
    : "Apporta le correzioni direttamente nel testo del documento prima di procedere.";

  const stepTwoDescription = hasUnsavedChanges
    ? "Salva per rendere disponibili le modifiche alla rigenerazione."
    : ["saved", "republished"].includes(normalizedLastAction)
      ? "Modifiche salvate correttamente: puoi passare alla rigenerazione."
      : "Quando hai terminato, salva le modifiche.";

  const stepThreeDescription = normalizedLastAction === "republished"
    ? "Il PDF aggiornato è pronto. Usa il pulsante \"Apri PDF aggiornato\" per visualizzarlo subito."
    : "Dopo il salvataggio, rigenera il PDF e poi aprilo dalla libreria per verificarlo.";

  const renderStep = (index, title, description, status) => (
    <li
      key={index}
      className={classNames(
        "flex items-start gap-3 rounded-2xl border px-4 py-3",
        stepContainerClasses[status]
      )}
    >
      <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-sm font-semibold text-white/80">
        {index}
      </span>
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className={classNames("flex items-center gap-2 text-sm font-semibold", stepTitleClasses[status])}>
            <span>{title}</span>
            {status === "done" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : status === "in-progress" ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : null}
          </div>
          <p className={classNames("mt-1 text-xs leading-relaxed", stepDescriptionClasses[status])}>{description}</p>
        </div>
        <span
          className={classNames(
            "inline-flex min-w-[120px] justify-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
            stepBadgeClasses[status]
          )}
        >
          {stepStatusLabels[status]}
        </span>
      </div>
    </li>
  );

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
            <h2 className="text-lg font-semibold text-surface-25">Modifica il PDF</h2>
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
        <div className="flex-1 overflow-y-auto px-6 py-4 max-h-[70vh]">
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
          {showSpeakerMapper ? (
            <div className="mt-6 space-y-4 rounded-3xl border border-surface-800/80 bg-surface-950/40 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-surface-50">Identifica speaker</p>
                  <p className="mt-1 text-xs text-surface-400">
                    Assegna un nome reale alle etichette generiche. Le modifiche sono applicate in anteprima in tempo reale; i campi lasciati vuoti manterranno l&apos;etichetta originale.
                  </p>
                </div>
              </div>
              <SpeakerMapper
                speakers={speakers}
                value={speakerMap}
                onMapChange={onSpeakerMapChange}
              />
              <div className="rounded-2xl border border-surface-800 bg-surface-900/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">
                  Anteprima con nomi
                </p>
                <div className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-2xl bg-surface-950/70 p-3 text-xs font-mono text-surface-100 shadow-inset">
                  {previewContent}
                </div>
              </div>
            </div>
          ) : null}
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
          <div className="mt-6 rounded-3xl border border-surface-800/80 bg-surface-950/40 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-400">
              Percorso guidato
            </p>
            <ol className="mt-3 space-y-3 text-sm">
              {renderStep(1, "Modifica il PDF", stepOneDescription, stepOneStatus)}
              {renderStep(2, "Salva le modifiche", stepTwoDescription, stepTwoStatus)}
              {renderStep(3, "Rigenera e verifica il PDF", stepThreeDescription, stepThreeStatus)}
            </ol>
            {isRepublishing ? (
              <p className="mt-3 rounded-2xl border border-sky-500/40 bg-sky-500/10 p-3 text-xs text-sky-100">
                Rigenerazione in corso. Puoi seguire l'avanzamento dal pannello principale.
              </p>
            ) : normalizedLastAction === "republished" ? (
              <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                <p>
                  PDF rigenerato con successo. Apri subito la nuova versione oppure chiudi l'editor per tornare alla libreria.
                </p>
                {typeof onViewPdf === "function" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    leadingIcon={ExternalLink}
                    onClick={() => onViewPdf?.()}
                    disabled={busy || !canViewPdf}
                  >
                    Apri PDF aggiornato
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-800 bg-surface-900/60 px-6 py-4 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-surface-300">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleClose}
              leadingIcon={ChevronLeft}
              disabled={busy}
            >
              Chiudi editor
            </Button>
            {typeof onOpenInNewTab === "function" && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onOpenInNewTab?.()}
                leadingIcon={ExternalLink}
              >
                Apri documento in nuova scheda
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
            {showSpeakerMapper && typeof onRepublishWithSpeakers === "function" ? (
              <Button
                onClick={() => onRepublishWithSpeakers?.()}
                disabled={busy || hasUnsavedChanges || !speakerMapHasNames}
                variant="primary"
                size="sm"
                leadingIcon={RefreshCw}
                isLoading={busy}
              >
                {busy ? "Rigenerazione…" : "Rigenera PDF con nomi"}
              </Button>
            ) : null}
            <Button
              onClick={() => onSave?.(value)}
              disabled={loading || saving || !hasUnsavedChanges}
              variant="primary"
              size="sm"
              leadingIcon={Save}
              isLoading={saving}
            >
              {saving ? "Salvataggio…" : "Salva modifiche"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
