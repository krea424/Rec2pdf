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
  Users
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
      if (!confirmed) return;
    }
    onClose?.();
  };

  const normalizedLastAction = lastAction || "idle";
  const showSpeakerMapper = true; // Mostriamo sempre la sezione, anche se vuota, per chiarezza
  const hasSpeakers = Array.isArray(speakers) && speakers.length > 0;
  
  const previewContent = typeof renderedValue === "string" ? renderedValue : value;

  return (
    // 1. Ripristino p-4 per dare "aria" attorno al modale
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 transition-opacity duration-300">
      <div
        className={classNames(
          // 2. FIX PROPORZIONI:
          // - h-[95vh]: Occupa quasi tutta l'altezza verticale.
          // - w-full max-w-[1600px]: Si allarga ma si ferma a 1600px per restare leggibile.
          "flex h-[95vh] w-full max-w-[1600px] overflow-hidden rounded-2xl border border-white/10 bg-[#09090b] shadow-2xl ring-1 ring-white/5",
          themeStyles?.card
        )}
      >
        {/* ================= COLONNA SINISTRA: EDITOR (70%) ================= */}
        <div className="flex flex-1 flex-col border-r border-white/10 bg-[#09090b]">
            {/* Header Editor */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-[#09090b]">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 border border-white/10">
                        <FileCode className="h-5 w-5 text-white/70" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold text-white tracking-tight">Editor Contenuto</h2>
                        <p className="text-[11px] text-white/40 font-mono max-w-md truncate" title={path}>
                            {path || "Nuovo documento"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                     {hasUnsavedChanges ? (
                        <span className="text-xs text-amber-400 font-medium px-2 py-1 rounded bg-amber-400/10 border border-amber-400/20">
                            Modifiche non salvate
                        </span>
                     ) : (
                        <span className="text-xs text-emerald-400 font-medium px-2 py-1 rounded bg-emerald-400/10 border border-emerald-400/20">
                            Salvato
                        </span>
                     )}
                     <Button
                        onClick={() => onSave?.(value)}
                        disabled={loading || saving || !hasUnsavedChanges}
                        variant="primary"
                        size="sm"
                        leadingIcon={Save}
                        isLoading={saving}
                        className="min-w-[100px]"
                    >
                        Salva
                    </Button>
                </div>
            </div>
            
            {/* Area Testo */}
            <div className="flex-1 p-0 relative bg-[#09090b]">
                {loading ? (
                    <Skeleton className="absolute inset-6 rounded-xl bg-white/5" />
                ) : (
                    <TextArea
                        value={value}
                        onChange={(e) => onChange?.(e.target.value)}
                        spellCheck={false}
                        disabled={saving}
                        className="h-full w-full resize-none border-none bg-transparent p-6 font-mono text-sm leading-7 text-white/80 focus:ring-0 selection:bg-indigo-500/30"
                        placeholder="Il contenuto del documento apparirà qui..."
                    />
                )}
            </div>
        </div>

        {/* ================= COLONNA DESTRA: TOOLBAR (30%) ================= */}
        <div className="flex w-[400px] xl:w-[450px] flex-col bg-[#121214] border-l border-white/5">
            {/* Header Toolbar */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-[#121214]">
                <h3 className="text-sm font-semibold text-white/90">Revisione & Pubblicazione</h3>
                <IconButton variant="ghost" onClick={handleClose} className="hover:bg-white/10">
                    <XCircle className="h-5 w-5 text-white/60" />
                </IconButton>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                
                {/* SEZIONE 1: Speaker Mapper */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/50">
                            <Users className="h-4 w-4" /> Identificazione Speaker
                        </h4>
                        {speakerMapHasNames && <span className="text-[10px] text-emerald-400 font-medium bg-emerald-400/10 px-2 py-0.5 rounded">Attiva</span>}
                    </div>
                    
                    {hasSpeakers ? (
                        <>
                            <p className="text-xs text-white/40 leading-relaxed">
                                Sostituisci le etichette generiche (es. SPEAKER_01) con i nomi reali.
                            </p>
                            <div className="bg-[#09090b] rounded-xl border border-white/10 p-1 max-h-[300px] overflow-y-auto">
                                <SpeakerMapper
                                    speakers={speakers}
                                    value={speakerMap}
                                    onMapChange={onSpeakerMapChange}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-6 text-center">
                            <p className="text-xs text-white/30">
                                Nessuno speaker identificato o modalità diarizzazione non attiva per questo documento.
                            </p>
                        </div>
                    )}
                </div>

                <div className="h-px bg-white/10 w-full" />

                {/* SEZIONE 2: Azioni Pubblicazione */}
                <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">Rigenerazione PDF</h4>
                    
                    <div className="grid gap-3">
                        {/* Pulsante Rigenera con Nomi */}
                        <Button
                            onClick={() => onRepublishWithSpeakers?.()}
                            disabled={busy || hasUnsavedChanges || !hasSpeakers || !speakerMapHasNames}
                            variant={hasSpeakers && speakerMapHasNames ? "primary" : "ghost"}
                            className={classNames(
                                "w-full justify-start h-12 text-sm",
                                hasSpeakers && speakerMapHasNames 
                                    ? "bg-indigo-600 hover:bg-indigo-500 border-transparent text-white" 
                                    : "bg-white/5 border-white/10 text-white/40"
                            )}
                            leadingIcon={CheckCircle2}
                            isLoading={busy && speakerMapHasNames}
                        >
                            <div className="flex flex-col items-start text-left">
                                <span className="font-semibold">Applica Nomi & Rigenera</span>
                                <span className="text-[10px] opacity-70 font-normal">Usa la mappatura speaker sopra</span>
                            </div>
                        </Button>

                        {/* Pulsante Rigenera Standard */}
                        <Button
                            onClick={() => onRepublish?.()}
                            disabled={busy || hasUnsavedChanges}
                            variant="secondary"
                            className="w-full justify-start h-12 bg-white/5 border-white/10 hover:bg-white/10 text-white/80"
                            leadingIcon={RefreshCw}
                            isLoading={busy && !speakerMapHasNames}
                        >
                            <div className="flex flex-col items-start text-left">
                                <span className="font-semibold">Rigenera Standard</span>
                                <span className="text-[10px] opacity-50 font-normal">Usa solo il testo modificato</span>
                            </div>
                        </Button>
                    </div>
                </div>

                {/* SEZIONE 3: Stato & Output */}
                <div className="space-y-3">
                     {error && <Toast tone="danger" description={error} />}
                     {success && <Toast tone="success" description={success} />}
                     
                     {normalizedLastAction === "republished" && (
                        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                    <CheckCircle2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">PDF Aggiornato</p>
                                    <p className="text-[11px] text-emerald-200/70">Il documento è pronto per il download.</p>
                                </div>
                            </div>
                            {typeof onViewPdf === "function" && (
                                <Button 
                                    size="sm" 
                                    className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20" 
                                    onClick={onViewPdf} 
                                    leadingIcon={ExternalLink}
                                >
                                    Apri PDF Aggiornato
                                </Button>
                            )}
                        </div>
                     )}
                </div>
            </div>
            
            {/* Footer Toolbar */}
            <div className="border-t border-white/10 p-4 bg-[#121214]">
                {typeof onOpenInNewTab === "function" && (
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onOpenInNewTab?.()}
                        leadingIcon={ExternalLink}
                        className="w-full text-white/40 hover:text-white/80 justify-center"
                    >
                        Apri in nuova scheda
                    </Button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}