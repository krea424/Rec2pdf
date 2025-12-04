import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { classNames } from "../utils/classNames";
import {
  FileText,
  Save,
  RefreshCw,
  ExternalLink,
  XCircle,
  CheckCircle2,
  Users,
  Settings,
  ChevronDown
} from "./icons";
import { Button, IconButton } from "./ui/Button";
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
  availableTemplates = [], // <--- NUOVA PROP
}) {
  if (!open) return null;

  // Stato per il template override nell'editor
  const [selectedTemplateOverride, setSelectedTemplateOverride] = useState("");
  const [activeTab, setActiveTab] = useState("editor");
  const [editorPane, setEditorPane] = useState("write");

  const previewContent =
    typeof value === "string"
      ? value
      : typeof renderedValue === "string"
        ? renderedValue
        : "";

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
  const hasSpeakers = Array.isArray(speakers) && speakers.length > 0;
  
  return (
    // 1. CONTENITORE ESTERNO
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 transition-opacity duration-300">
      
      {/* 2. CARD PRINCIPALE */}
      <div
        className={classNames(
          "flex h-full w-full max-w-[1920px] flex-col lg:flex-row overflow-hidden rounded-2xl border border-white/10 bg-[#09090b] shadow-2xl ring-1 ring-white/5",
          themeStyles?.card
        )}
      >
        {/* HEADER MOBILE */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#121214] px-4 py-3 lg:hidden shrink-0">
           <div className="flex gap-2">
              <button 
                onClick={() => setActiveTab("editor")}
                className={classNames(
                    "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                    activeTab === "editor" ? "bg-white/10 text-white" : "text-white/50"
                )}
              >
                Editor
              </button>
              <button 
                onClick={() => setActiveTab("options")}
                className={classNames(
                    "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                    activeTab === "options" ? "bg-white/10 text-white" : "text-white/50"
                )}
              >
                Opzioni
              </button>
           </div>
           <div className="flex items-center gap-2">
              {activeTab === "editor" && (
                <Button
                  onClick={() => onSave?.(value)}
                  disabled={loading || saving || !hasUnsavedChanges}
                  size="sm"
                  variant="primary"
                  leadingIcon={Save}
                  isLoading={saving}
                  className="h-9 px-3 text-xs font-bold"
                >
                  Save
                </Button>
              )}
              <IconButton variant="ghost" onClick={handleClose}>
                <XCircle className="h-6 w-6 text-white/70" />
              </IconButton>
           </div>
        </div>

        {/* ================= COLONNA SINISTRA: EDITOR ================= */}
        <div className={classNames(
            "flex flex-1 flex-col border-r border-white/10 bg-[#09090b] transition-all min-h-0",
            activeTab === "editor" ? "block h-full" : "hidden lg:flex"
        )}>
            {/* Header Desktop */}
            <div className="hidden lg:flex items-center justify-between border-b border-white/10 px-6 py-4 bg-[#09090b] shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                        <FileText className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">Editor Contenuto</h2>
                        <p className="text-xs text-zinc-400 font-mono max-w-md truncate mt-0.5 opacity-70">
                            {path || "Nuovo documento"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                     {hasUnsavedChanges ? (
                        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-400 font-bold bg-amber-400/10 px-3 py-1.5 rounded border border-amber-400/20">
                            Non salvato
                        </span>
                     ) : (
                        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-emerald-400 font-bold bg-emerald-400/10 px-3 py-1.5 rounded border border-emerald-400/20">
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
                        className="min-w-[100px] h-9 text-xs font-bold shadow-lg shadow-indigo-500/20"
                    >
                        SALVA
                    </Button>
                </div>
            </div>
            
            {/* AREA TESTO + ANTEPRIMA */}
            <div className="flex-1 relative w-full min-h-0 bg-[#09090b]">
                {loading ? (
                    <div className="absolute inset-0 p-6">
                        <Skeleton className="h-full w-full rounded-xl bg-white/5" />
                    </div>
                ) : (
                    <div className="absolute inset-0 flex flex-col">
                        {/* Toggle editor/preview mobile */}
                        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 lg:hidden">
                            <button
                                onClick={() => setEditorPane("write")}
                                className={classNames(
                                    "flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                                    editorPane === "write"
                                        ? "bg-white/10 text-white"
                                        : "bg-white/5 text-white/60"
                                )}
                            >
                                Scrivi
                            </button>
                            <button
                                onClick={() => setEditorPane("preview")}
                                className={classNames(
                                    "flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                                    editorPane === "preview"
                                        ? "bg-white/10 text-white"
                                        : "bg-white/5 text-white/60"
                                )}
                            >
                                Anteprima
                            </button>
                        </div>

                        <div className="flex-1 flex flex-col lg:flex-row divide-y divide-white/5 lg:divide-y-0 lg:divide-x lg:divide-white/5 min-h-0">
                            {/* Pannello Scrittura */}
                            <div
                                className={classNames(
                                    "flex-1 min-h-0 bg-[#09090b]",
                                    editorPane === "preview" ? "hidden lg:flex" : "flex"
                                )}
                            >
                                <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar smooth-scroll-pane">
                                    <textarea
                                        value={previewContent}
                                        onChange={(e) => onChange?.(e.target.value)}
                                        spellCheck={false}
                                        disabled={saving}
                                        className="h-full min-h-[360px] w-full resize-none rounded-xl border border-white/5 bg-[#0b0b0f] p-4 lg:p-6 font-mono text-base leading-relaxed text-zinc-100 focus:ring-0 focus:outline-none selection:bg-indigo-500/30 placeholder-white/20 shadow-inner shadow-black/30 custom-scrollbar smooth-scroll-pane"
                                        placeholder="Il contenuto del documento apparirà qui..."
                                    />
                                </div>
                            </div>

                            {/* Pannello Anteprima */}
                            <div
                                className={classNames(
                                    "flex-1 min-h-0 bg-[#0b0b10]",
                                    editorPane === "write" ? "hidden lg:flex" : "flex"
                                )}
                            >
                                <div className="flex w-full flex-col min-h-0">
                                    <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 lg:hidden">
                                        <span className="text-sm font-semibold text-white">Anteprima</span>
                                        <span className="text-[11px] text-white/50">PDF styled</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto px-4 py-4 lg:p-8 custom-scrollbar smooth-scroll-pane min-h-0">
                                        <div className="mx-auto max-w-3xl rounded-2xl bg-white text-slate-900 shadow-[0_20px_60px_-25px_rgba(15,23,42,0.35)] ring-1 ring-slate-100 min-h-0 w-full">
                                            <div className="hidden items-center justify-between border-b border-slate-200 px-6 py-4 lg:flex">
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                                                        Anteprima documento
                                                    </p>
                                                    <p className="text-sm text-slate-700">Stile consulting / professional</p>
                                                </div>
                                            </div>
                                            <div className="px-5 py-5 lg:px-8 lg:py-8">
                                                <div className="prose prose-slate max-w-none prose-headings:font-serif prose-headings:text-slate-900 prose-lead:text-slate-700 prose-strong:text-slate-900 prose-a:text-indigo-700 prose-blockquote:border-slate-300 prose-blockquote:text-slate-700 prose-hr:border-slate-200 prose-table:border-collapse prose-table:border prose-table:border-slate-200 prose-th:border prose-th:border-slate-200 prose-td:border prose-td:border-slate-200 prose-td:px-3 prose-td:py-2">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {previewContent || "*Inizia a scrivere per vedere l'anteprima...*"}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* ================= COLONNA DESTRA: TOOLBAR ================= */}
        <div className={classNames(
            "flex w-full lg:w-[420px] xl:w-[480px] flex-col bg-[#121214] border-l border-white/5 shadow-2xl z-10 shrink-0",
            activeTab === "options" ? "block h-full" : "hidden lg:flex"
        )}>
            {/* Header Toolbar Desktop */}
            <div className="hidden lg:flex items-center justify-between border-b border-white/10 px-6 py-4 bg-[#121214] shrink-0">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Settings className="h-4 w-4 text-white/50" />
                    Revisione & Export
                </h3>
                <IconButton variant="ghost" onClick={handleClose} className="hover:bg-white/10 text-white/60 hover:text-white h-9 w-9">
                    <XCircle className="h-5 w-5" />
                </IconButton>
            </div>

           {/* Contenuto Scrollabile */}
            {/* MODIFICA QUI: Aggiunto pb-32 su mobile e ridotto spaziature (p-4, space-y-5) */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5 lg:space-y-8 pb-32 lg:pb-6 custom-scrollbar smooth-scroll-pane">
                
               {/* SEZIONE 1: Speaker Mapper */}
               <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                            <Users className="h-3 w-3" /> Identificazione Speaker
                        </h4>
                        {speakerMapHasNames && <span className="text-[10px] text-emerald-400 font-bold bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">ATTIVA</span>}
                    </div>
                    
                    {hasSpeakers ? (
                        <>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Assegna i nomi reali agli speaker rilevati.
                            </p>
                            <div className="bg-[#09090b] rounded-xl border border-white/10 p-2 max-h-[40vh] overflow-y-auto shadow-inner">
                                <SpeakerMapper
                                    speakers={speakers}
                                    value={speakerMap}
                                    onMapChange={onSpeakerMapChange}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-6 text-center">
                            <p className="text-xs text-zinc-500">
                                Nessuno speaker identificato in questo documento.
                            </p>
                        </div>
                    )}
                </div>

                <div className="h-px bg-white/5 w-full" />

                {/* SEZIONE 2: Azioni Pubblicazione */}
                <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Rigenerazione PDF</h4>

                    {/* --- SELETTORE TEMPLATE (NUOVO) --- */}
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-wide text-zinc-400 font-semibold">
                            Cambia Stile Grafico
                        </label>
                        <div className="relative">
                            <select
                                value={selectedTemplateOverride}
                                onChange={(e) => setSelectedTemplateOverride(e.target.value)}
                                className="w-full appearance-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 pr-10 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                            >
                                <option value="">Mantieni attuale (Default)</option>
                                {availableTemplates.map((t) => (
                                    <option key={t.fileName} value={t.fileName}>
                                        {t.name || t.fileName}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        </div>
                    </div>
                    
                    <div className="grid gap-3">
                        {/* Pulsante Rigenera con Nomi */}
                        <Button
                            onClick={() => onRepublishWithSpeakers?.({ template: selectedTemplateOverride })}
                            disabled={busy || hasUnsavedChanges || !hasSpeakers || !speakerMapHasNames}
                            variant={hasSpeakers && speakerMapHasNames ? "primary" : "ghost"}
                            className={classNames(
                                "w-full justify-start h-14 text-sm px-4 rounded-xl transition-all",
                                hasSpeakers && speakerMapHasNames 
                                    ? "bg-indigo-600 hover:bg-indigo-500 border-transparent text-white shadow-lg shadow-indigo-900/20" 
                                    : "bg-white/5 border border-white/10 text-white/40"
                            )}
                            leadingIcon={CheckCircle2}
                            isLoading={busy && speakerMapHasNames}
                        >
                            <div className="flex flex-col items-start text-left ml-2">
                                <span className="font-bold text-sm">Applica Nomi & Rigenera</span>
                                <span className="text-[10px] opacity-70 font-normal">Usa la mappatura speaker sopra</span>
                            </div>
                        </Button>

                        {/* Pulsante Rigenera Standard */}
                        <Button
                            onClick={() => onRepublish?.({ template: selectedTemplateOverride })}
                            disabled={busy || hasUnsavedChanges}
                            variant="secondary"
                            className="w-full justify-start h-14 bg-zinc-800 border border-white/10 hover:bg-zinc-700 text-zinc-200 px-4 rounded-xl"
                            leadingIcon={RefreshCw}
                            isLoading={busy && !speakerMapHasNames}
                        >
                            <div className="flex flex-col items-start text-left ml-2">
                                <span className="font-bold text-sm">Rigenera Standard</span>
                                <span className="text-[10px] opacity-60 font-normal">Usa solo il testo modificato</span>
                            </div>
                        </Button>
                    </div>
                </div>

                {/* SEZIONE 3: Stato & Output */}
                <div className="space-y-3 pt-2">
                     {error && <Toast tone="danger" description={error} />}
                     {success && <Toast tone="success" description={success} />}
                     
                     {normalizedLastAction === "republished" && (
                        <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-900/20 p-5 animate-in fade-in slide-in-from-bottom-2 shadow-lg shadow-emerald-900/10">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
                                    <CheckCircle2 className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-base font-bold text-white">PDF Aggiornato!</p>
                                    <p className="text-xs text-emerald-200/80">Il documento è pronto.</p>
                                </div>
                            </div>
                            {typeof onViewPdf === "function" && (
                                <Button 
                                    size="sm" 
                                    className="w-full h-10 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold border-none" 
                                    onClick={onViewPdf} 
                                    leadingIcon={ExternalLink}
                                >
                                    APRI PDF AGGIORNATO
                                </Button>
                            )}
                        </div>
                     )}
                </div>
            </div>
            
            {/* Footer Toolbar */}
            <div className="border-t border-white/10 p-4 bg-[#121214] lg:block hidden shrink-0">
                {typeof onOpenInNewTab === "function" && (
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onOpenInNewTab?.()}
                        leadingIcon={ExternalLink}
                        className="w-full text-zinc-500 hover:text-zinc-300 justify-center text-xs"
                    >
                        Apri documento in nuova scheda
                    </Button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}