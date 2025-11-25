import { Cpu, Download, FileText, RefreshCw, Sparkles, Users, XCircle, CheckCircle2 } from "../../components/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "../../hooks/useAppContext";
import { useAnalytics } from "../../context/AnalyticsContext";
import { classNames } from "../../utils/classNames";
import { supabase } from "../../supabaseClient";

const statusTone = {
  idle: "text-white/60",
  pending: "text-sky-200",
  running: "text-sky-100",
  done: "text-emerald-200",
  failed: "text-rose-200",
};

const PipelinePanel = ({ journeyStage = "record" }) => {
  const context = useAppContext();
  const { trackEvent } = useAnalytics();
  const {
    PIPELINE_STAGES,
    pipelineStatus,
    stageMessages,
    STAGE_STATUS_LABELS,
    progressPercent,
    processViaBackend,
    handleRefineAndGenerate: startRefinementFlow,
    audioBlob,
    backendUp,
    busy,
    pipelineComplete,
    refinedData,
    pdfPath,
    mdPath,
    activeStageKey,
    handleOpenHistoryMd,
    resetAll,
    baseJourneyVisibility,
    revealPipelinePanel,
    enableDiarization,
    setEnableDiarization,
    workspaceSelection,
    workspaceProfileSelection,
    activeWorkspaceProfiles,
    applyWorkspaceProfile,
    clearWorkspaceProfile,
    workspaces,
    handleSelectWorkspaceForPipeline,
    normalizedBackendUrl,
    prompts,
    setPromptState,
    setPdfTemplateSelection
  } = context;

  const pipelineRevealState = baseJourneyVisibility?.pipeline ?? false;
  const refinementPanelOpen = baseJourneyVisibility?.refine ?? false;
  const [hasLaunchedPipeline, setHasLaunchedPipeline] = useState(() => pipelineRevealState);
  const canPublish = Boolean(audioBlob) && !busy && backendUp !== false && !hasLaunchedPipeline;
  const publishLocked = hasLaunchedPipeline;
  const focusPublish = journeyStage === "publish" && !pipelineComplete;
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [hasUnlockedNextSteps, setHasUnlockedNextSteps] = useState(false);
  const hasUnlockedNextStepsRef = useRef(false);
  
  const focusDownload = journeyStage === "download" && pipelineComplete && pdfPath && !hasDownloaded;
  const shouldDimContent = focusPublish || focusDownload;
  const pipelineInFlight = busy && !pipelineComplete;
  const previousProfileRef = useRef(null);

  // ... (Manteniamo le funzioni helper come applyMeetingProfileIfAvailable, toggleDiarization, etc.) ...
  // Per brevità qui ometto le funzioni helper se non cambiano, ma nel file finale devono esserci.
  // Assicurati di copiare le funzioni toggleDiarization, handlePublish, handleDownload, handleModifyPdf, handleResetSession dal codice precedente o di lasciarle intatte.
  
  // --- REINSERISCO LE FUNZIONI PER COMPLETEZZA ---
    const toggleDiarization = useCallback(() => {
    if (busy) return;
    setEnableDiarization((prev) => {
      const nextValue = !prev;
      if (nextValue === true) {
        const meetingPrompt = prompts.find(p => p.id === 'prompt_meeting_minutes' || p.slug === 'verbale_meeting');
        if (meetingPrompt) setPromptState(prev => ({ ...prev, promptId: meetingPrompt.id }));
        setPdfTemplateSelection({ fileName: 'verbale_meeting.html', type: 'html', css: 'verbale_meeting.css' });
      }
      return nextValue;
    });
  }, [busy, prompts, setPromptState, setPdfTemplateSelection, setEnableDiarization]);

  const handlePublish = useCallback(() => {
    if (!canPublish) return;
    trackEvent("pipeline.publish_requested", { hasAudio: Boolean(audioBlob), backendReachable: backendUp !== false });
    revealPipelinePanel();
    setHasLaunchedPipeline(true);
    processViaBackend();
  }, [audioBlob, backendUp, canPublish, processViaBackend, revealPipelinePanel, trackEvent]);

  const handleDownload = useCallback(async () => {
    if (!pdfPath) return;
    trackEvent("pipeline.export_pdf", { path: pdfPath });
    try {
      const pathParts = pdfPath.split('/');
      const bucket = pathParts[0];
      const objectPath = pathParts.slice(1).join('/');
      const params = new URLSearchParams({ bucket, path: objectPath });
      const targetUrl = `${normalizedBackendUrl}/api/file?${params.toString()}`;
      const session = (await supabase.auth.getSession())?.data.session;
      if (!session) throw new Error("Sessione utente non trovata.");
      const response = await fetch(targetUrl, { headers: { 'Authorization': `Bearer ${session.access_token}` } });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message);
      window.open(data.url, '_blank', 'noopener,noreferrer');
      setHasDownloaded(true);
      hasUnlockedNextStepsRef.current = true;
      setHasUnlockedNextSteps(true);
    } catch (error) {
      alert(`Errore nel download: ${error.message}`);
    }
  }, [pdfPath, trackEvent, normalizedBackendUrl]);

  const handleModifyPdf = useCallback(() => {
    if (!mdPath) return;
    const temporaryEntry = { id: Date.now(), pdfPath: pdfPath, mdPath: mdPath, backendUrl: normalizedBackendUrl };
    trackEvent("pipeline.export_markdown", { path: mdPath });
    handleOpenHistoryMd(temporaryEntry);
    setHasDownloaded(true);
    hasUnlockedNextStepsRef.current = true;
    setHasUnlockedNextSteps(true);
  }, [handleOpenHistoryMd, mdPath, pdfPath, normalizedBackendUrl, trackEvent]);

  const handleResetSession = useCallback(() => {
    trackEvent("pipeline.reset_session", { fromDownload: pipelineComplete, hadAudio: Boolean(audioBlob) });
    setHasDownloaded(false);
    hasUnlockedNextStepsRef.current = false;
    setHasUnlockedNextSteps(false);
    setHasLaunchedPipeline(false);
    resetAll();
  }, [audioBlob, pipelineComplete, resetAll, trackEvent]);
  // -----------------------------------------------

  const stages = useMemo(() => PIPELINE_STAGES.map((stage) => ({
        key: stage.key,
        label: stage.label,
        icon: stage.icon,
        status: pipelineStatus[stage.key] || "idle",
        description: stageMessages[stage.key] || stage.description,
        statusLabel: STAGE_STATUS_LABELS[status] || status,
  })), [PIPELINE_STAGES, STAGE_STATUS_LABELS, pipelineStatus, stageMessages]);

  const showDownloadActions = pipelineComplete && pdfPath;
  const showNextSteps = showDownloadActions && hasUnlockedNextSteps;

  return (
    <div className="flex h-full flex-col gap-5 rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-subtle transition-all duration-500">
      
      {/* HEADER: Titolo Dinamico */}
      <div>
        <h2 className={classNames("flex items-center gap-2 text-lg font-semibold uppercase tracking-[0.32em]", shouldDimContent ? "text-white/50" : "text-white/70")}>
          {pipelineComplete ? <><CheckCircle2 className="h-4 w-4 text-emerald-400"/> Documento Pronto</> : <><Sparkles className="h-4 w-4" /> Ottieni PDF</>}
        </h2>
        <p className={classNames("mt-1 text-sm", shouldDimContent ? "text-white/45" : "text-white/70")}>
          {pipelineComplete ? "Il tuo documento è stato generato con successo." : "Avvia la pipeline automatizzata e ricevi il PDF pronto da condividere."}
        </p>
      </div>

      {/* SEZIONE 1: Configurazione (Visibile solo prima del lancio) */}
      {!hasLaunchedPipeline && !pipelineComplete && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-start justify-between gap-4">
                <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Users className="h-4 w-4" /> Identifica speaker multipli
                </p>
                <p className="mt-1 text-xs text-white/60">
                    Attiva per separare le voci (riunioni).
                </p>
                </div>
                <button
                type="button"
                role="switch"
                aria-checked={enableDiarization}
                onClick={toggleDiarization}
                disabled={busy}
                className={classNames(
                    "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition focus:ring-2 focus:ring-emerald-300/80",
                    enableDiarization ? "bg-emerald-400" : "bg-white/20"
                )}
                >
                <span className={classNames("inline-block h-5 w-5 rounded-full bg-white transition-transform", enableDiarization ? "translate-x-5" : "translate-x-1")} />
                </button>
            </div>
            </div>
            
            <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={handlePublish} disabled={!canPublish} className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-base font-semibold text-slate-950 hover:bg-emerald-300 transition shadow-lg shadow-emerald-900/20">
                    <Cpu className="h-5 w-5" /> Ottieni PDF
                </button>
                <button type="button" onClick={startRefinementFlow} disabled={!canPublish} className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base font-semibold text-white/80 hover:bg-white/10 transition">
                    <Sparkles className="h-5 w-5" /> Revisione Guidata
                </button>
            </div>
             {!busy && audioBlob && (
                <button type="button" onClick={resetAll} className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-transparent py-2 text-xs text-white/40 hover:text-rose-300 transition">
                    <XCircle className="h-3 w-3" /> Annulla
                </button>
            )}
        </div>
      )}

      {/* SEZIONE 2: Azioni Finali (Visibile solo a pipeline finita) */}
      {showDownloadActions && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button type="button" onClick={handleDownload} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg hover:bg-emerald-300 transition">
                <Download className="h-4 w-4" /> SCARICA PDF
              </button>
              {mdPath && (
                <button type="button" onClick={handleModifyPdf} className="flex items-center justify-center gap-2 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm font-bold text-indigo-200 hover:bg-indigo-500/20 transition">
                  <FileText className="h-4 w-4" /> MODIFICA
                </button>
              )}
            </div>
            
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-white">Nuova Sessione</p>
                        <p className="text-xs text-white/60">Mantieni le impostazioni, resetta i file.</p>
                    </div>
                    <button type="button" onClick={handleResetSession} className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 transition">
                        <RefreshCw className="h-3 w-3" /> Avvia
                    </button>
                </div>
            </div>
          </div>
      )}

      {/* SEZIONE 3: Lista Step Tecnici (Visibile SOLO se stiamo lavorando, NON alla fine) */}
      {/* FIX: Nascondiamo questa lista se pipelineComplete è true */}
      {hasLaunchedPipeline && !pipelineComplete && (
          <div className="space-y-4 opacity-50 pointer-events-none grayscale">
            {/* Qui potremmo anche non mostrare nulla se c'è la Dynamic Island, 
                ma lasciamo una versione "ghost" per riempire lo spazio se vuoi, 
                oppure rimuovilo del tutto per massima pulizia. */}
             <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/50 text-center">
                Vedi stato in basso...
             </div>
          </div>
      )}

    </div>
  );
};

export default PipelinePanel;