import React, { useMemo } from "react";
import { AlertCircle } from "../../components/icons";
import { useAppContext } from "../../hooks/useAppContext";
import { Toast } from "../../components/ui/Toast";
import { classNames } from "../../utils/classNames";

// Componenti della Feature (Tutti nella stessa cartella 'base')
import PipelinePanel from "./PipelinePanel";
import UploadCard from "./UploadCard";
import RefinementPanel from "./RefinementPanel";
import BaseSummaryCards from "./BaseSummaryCards"; 

// Componenti Globali
import PipelineStatusBar from "../../components/ui/PipelineStatusBar";

const ErrorBanner = () => {
  const { errorBanner, setErrorBanner } = useAppContext();

  if (!errorBanner) {
    return null;
  }

  return (
    <Toast
      tone="danger"
      title={errorBanner.title}
      description={errorBanner.details}
      className="mt-4"
      action={
        <button
          type="button"
          className="text-xs font-semibold text-white/80 transition hover:text-white"
          onClick={() => setErrorBanner(null)}
        >
          Chiudi
        </button>
      }
    />
  );
};

const ConnectionGuard = () => {
  const { secureOK } = useAppContext();

  if (secureOK) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4" />
        <p>
          Per registrare serve HTTPS (o <code className="text-amber-100">localhost</code> durante lo sviluppo).
        </p>
      </div>
    </div>
  );
};

const BaseHome = () => {
  const context = useAppContext();
  const { 
    pipelineComplete, 
    history, 
    audioBlob, 
    busy, 
    baseJourneyVisibility 
  } = context;

  const completionHint = useMemo(() => {
    const latestEntry = history?.[0] || null;
    if (!pipelineComplete || !latestEntry?.pdfPath) {
      return null;
    }

    const workspaceName = latestEntry?.workspace?.name || latestEntry?.workspace?.client || "Workspace";
    const timestamp = latestEntry?.timestamp
      ? new Date(latestEntry.timestamp).toLocaleString()
      : "appena generato";

    return `PDF pronto da ${workspaceName} · ${timestamp}`;
  }, [history, pipelineComplete]);

  const journeyStage = useMemo(() => {
    const latestEntry = history?.[0] || null;
    if (pipelineComplete && latestEntry?.pdfPath) {
      return "download";
    }
    if ((audioBlob || busy) && !pipelineComplete) {
      return "publish";
    }
    return "record";
  }, [audioBlob, busy, history, pipelineComplete]);

  // === LOGICA VISIBILITÀ "DYNAMIC ISLAND" ===
  // Mostriamo il pannello grande SOLO se NON stiamo lavorando (busy = false)
  // E se c'è un motivo per mostrarlo (audio caricato o pipeline finita per il download)
  const showMainPanel = (audioBlob && !busy) || (pipelineComplete && !busy);

  return (
    <div className="space-y-6 relative min-h-[80vh]">
      <ConnectionGuard />
      <ErrorBanner />

      {completionHint ? (
        <div className="flex justify-end max-w-5xl mx-auto"> {/* Allineato al contenuto */}
          <p className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100">
            {completionHint}
          </p>
        </div>
      ) : null}

      {/* CONTENITORE PRINCIPALE CENTRATO (Max Width 5XL per tutto) */}
      <div 
        className={classNames(
          "mx-auto max-w-5xl transition-all duration-700 ease-in-out",
          busy ? "opacity-30 blur-sm scale-[0.99] pointer-events-none grayscale" : "opacity-100 scale-100"
        )}
      >
          {/* 1. BARRA CONTESTO (Le nuove card compatte) */}
          <div className="mb-4">
             <BaseSummaryCards />
          </div>

          {/* 2. AREA DI LAVORO (Upload + Pipeline) */}
          <section
            className={classNames(
              "grid gap-6 transition-all duration-500",
              showMainPanel
                ? "lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]" // Split view quando c'è il pannello
                : "grid-cols-1" // Full width quando c'è solo l'upload
            )}
          >
            <div className="w-full transition-all duration-500">
                <UploadCard journeyStage={journeyStage} />
            </div>

            {showMainPanel && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <PipelinePanel journeyStage={journeyStage} />
              </div>
            )}
          </section>
      </div>

      {baseJourneyVisibility?.refine ? <RefinementPanel /> : null}
      
      <PipelineStatusBar />
    </div>
  );
};

export default BaseHome;