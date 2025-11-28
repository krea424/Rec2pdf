import { Cpu, Download, FileText, RefreshCw, Sparkles, Users, XCircle, CheckCircle2 } from "../../components/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "../../hooks/useAppContext";
import { useAnalytics } from "../../context/AnalyticsContext";
import { classNames } from "../../utils/classNames";
import { supabase } from "../../supabaseClient";

const PipelinePanel = ({ journeyStage = "record" }) => {
  const context = useAppContext();
  const { trackEvent } = useAnalytics();
  const {
    PIPELINE_STAGES,
    pipelineStatus,
    stageMessages,
    STAGE_STATUS_LABELS,
    processViaBackend,
    handleRefineAndGenerate: startRefinementFlow,
    audioBlob,
    backendUp,
    busy,
    pipelineComplete,
    pdfPath,
    mdPath,
    handleOpenHistoryMd,
    resetAll,
    baseJourneyVisibility,
    revealPipelinePanel,
    enableDiarization,
    setEnableDiarization,
    normalizedBackendUrl,
    prompts,
    setPromptState,
    setPdfTemplateSelection
  } = context;

  const pipelineRevealState = baseJourneyVisibility?.pipeline ?? false;
  const [hasLaunchedPipeline, setHasLaunchedPipeline] = useState(() => pipelineRevealState);
  const canPublish = Boolean(audioBlob) && !busy && backendUp !== false && !hasLaunchedPipeline;
  const focusPublish = journeyStage === "publish" && !pipelineComplete;
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [hasUnlockedNextSteps, setHasUnlockedNextSteps] = useState(false);
  const hasUnlockedNextStepsRef = useRef(false);
  
  const focusDownload = journeyStage === "download" && pipelineComplete && pdfPath && !hasDownloaded;
  const shouldDimContent = focusPublish || focusDownload;

  // --- LOGICA TOGGLE & AZIONI ---
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

    // --- FIX IOS/MOBILE ---
    // 1. Apriamo la finestra IMMEDIATAMENTE (prima di qualsiasi await)
    // Questo dice al browser: "L'utente ha cliccato, apri una finestra".
    const newWindow = window.open('', '_blank');
    
    // 2. Mettiamo un feedback visivo nella nuova finestra mentre carica
    if (newWindow) {
        newWindow.document.write(`
            <html>
                <head><title>Caricamento...</title></head>
                <body style="background-color: #121214; color: #e4e4e7; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: system-ui, sans-serif; margin: 0;">
                    <div style="text-align: center;">
                        <div style="margin-bottom: 16px; font-size: 24px;">⏳</div>
                        <div>Recupero il tuo PDF sicuro...</div>
                    </div>
                </body>
            </html>
        `);
    }

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
      
      if (!response.ok || !data.ok) throw new Error(data.message || "Errore nel recupero del file");

      // 3. Reindirizziamo la finestra già aperta all'URL finale
      if (newWindow) {
          newWindow.location.href = data.url;
      } else {
          // Fallback estremo se il browser ha bloccato anche l'apertura sincrona
          window.location.href = data.url;
      }

      setHasDownloaded(true);
      hasUnlockedNextStepsRef.current = true;
      setHasUnlockedNextSteps(true);

    } catch (error) {
      // Se fallisce, chiudiamo la finestra che avevamo aperto
      if (newWindow) newWindow.close();
      console.error("Download error:", error);
      alert(`Impossibile scaricare il PDF: ${error.message}`);
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

  const showDownloadActions = pipelineComplete && pdfPath;

  return (
    // 1. SFONDO UNIFICATO: bg-[#121214] per matchare il pannello sopra
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-[#121214] p-5 shadow-sm transition-all duration-500">
      
      {/* 2. HEADER TECNICO: Identico a "ACQUISIZIONE INPUT" */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          <div className={classNames("h-1.5 w-1.5 rounded-full", busy ? "bg-emerald-400 animate-pulse" : "bg-zinc-600")} />
          Elaborazione & Output
        </div>
        {/* Status Badge */}
        <div className="font-mono text-xs font-medium text-zinc-400 bg-white/5 px-2 py-1 rounded-md border border-white/5">
             {pipelineComplete ? <span className="text-emerald-400">COMPLETATO</span> : busy ? <span className="text-indigo-400">IN CORSO</span> : "PRONTO"}
        </div>
      </div>

      {/* SEZIONE 1: Configurazione (Prima del lancio) */}
      {!hasLaunchedPipeline && !pipelineComplete && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
            
            {/* Card Toggle Diarizzazione (Stile coerente con UploadButton) */}
            <button
                onClick={toggleDiarization}
                disabled={busy}
                className={classNames(
                    "group relative flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 w-full",
                    enableDiarization 
                        ? "border-indigo-500/30 bg-indigo-500/5" 
                        : "border-white/5 bg-[#18181b] hover:border-white/10 hover:bg-[#202023]"
                )}
            >
                <div className="flex items-center gap-3">
                    <div className={classNames(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                        enableDiarization ? "bg-indigo-500/20 text-indigo-400" : "bg-white/5 text-zinc-400"
                    )}>
                        <Users className="h-4 w-4" />
                    </div>
                    <div>
                        <p className={classNames("text-xs font-bold uppercase tracking-wide", enableDiarization ? "text-indigo-100" : "text-zinc-300")}>
                            Modalità Riunione
                        </p>
                        <p className="text-[10px] text-zinc-500 font-medium">Identifica speaker multipli</p>
                    </div>
                </div>
                
                {/* Switch UI */}
                <div className={classNames(
                    "w-9 h-5 rounded-full p-0.5 transition-colors",
                    enableDiarization ? "bg-indigo-500" : "bg-zinc-700"
                )}>
                    <div className={classNames(
                        "w-4 h-4 bg-white rounded-full shadow-sm transition-transform",
                        enableDiarization ? "translate-x-4" : "translate-x-0"
                    )} />
                </div>
            </button>
            
            <div className="grid grid-cols-1 gap-3">
                {/* Pulsante Principale: Ottieni PDF */}
                <button 
                    type="button" 
                    onClick={handlePublish} 
                    disabled={!canPublish} 
                    className="group flex w-full items-center justify-center gap-3 rounded-xl bg-emerald-500 py-4 text-slate-900 shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-400 hover:scale-[1.01] active:scale-[0.99]"
                >
                    <Cpu className="h-5 w-5" />
                    <div className="text-left">
                        <p className="text-sm font-bold uppercase tracking-wide">Genera PDF</p>
                    </div>
                </button>

                {/* Pulsante Secondario: Revisione */}
                <button 
                    type="button" 
                    onClick={startRefinementFlow} 
                    disabled={!canPublish} 
                    className="group flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-[#18181b] py-3 text-zinc-300 transition-all hover:bg-[#202023] hover:border-white/20 hover:text-white"
                >
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    <span className="text-xs font-bold uppercase tracking-wide">Revisione Guidata AI</span>
                </button>
            </div>

             {!busy && audioBlob && (
                <div className="flex justify-center pt-2">
                    <button type="button" onClick={resetAll} className="text-[10px] font-medium text-zinc-500 hover:text-rose-400 transition flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> Annulla sessione
                    </button>
                </div>
            )}
        </div>
      )}

      {/* SEZIONE 2: Azioni Finali (Post-Pipeline) */}
      {showDownloadActions && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* Card di Successo */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mb-2">
                    <CheckCircle2 className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold text-white">Documento Pronto</p>
                <p className="text-[10px] text-zinc-400">Il PDF è stato generato e salvato in archivio.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button type="button" onClick={handleDownload} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-900 shadow-lg hover:bg-emerald-400 transition">
                <Download className="h-4 w-4" /> Scarica
              </button>
              {mdPath && (
                <button type="button" onClick={handleModifyPdf} className="flex items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-xs font-bold uppercase tracking-wide text-indigo-200 hover:bg-indigo-500/20 transition">
                  <FileText className="h-4 w-4" /> Modifica
                </button>
              )}
            </div>
            
            <div className="border-t border-white/5 pt-4">
                <button type="button" onClick={handleResetSession} className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-[#18181b] px-4 py-3 text-xs font-bold text-zinc-400 hover:bg-[#202023] hover:text-white transition">
                    <RefreshCw className="h-3 w-3" /> Nuova Sessione
                </button>
            </div>
          </div>
      )}

      {/* Placeholder Invisibile per mantenere l'altezza durante il caricamento (opzionale) */}
      {hasLaunchedPipeline && !pipelineComplete && (
          <div className="h-40 opacity-0 pointer-events-none" />
      )}

    </div>
  );
};

export default PipelinePanel;