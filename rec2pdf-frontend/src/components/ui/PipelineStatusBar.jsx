import React, { useState, useEffect, useMemo } from "react";
import { useAppContext } from "../../hooks/useAppContext";
import { classNames } from "../../utils/classNames";
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  ChevronUp, 
  ChevronDown,
  Cpu,
  Waves,
  FileText,
  Sparkles,
  Upload
} from "../icons"; // Assicurati che queste icone siano esportate in icons.jsx

export default function PipelineStatusBar() {
  const { 
    busy, 
    pipelineStatus, 
    activeStageKey, 
    pipelineComplete, 
    errorBanner,
    PIPELINE_STAGES
  } = useAppContext();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Gestione Visibilità: Appare se busy, rimane per 5s dopo il completamento
  useEffect(() => {
    let timeout;
    if (busy) {
      setIsVisible(true);
    } else if (pipelineComplete || errorBanner) {
      timeout = setTimeout(() => {
        setIsVisible(false);
        setIsExpanded(false);
      }, 5000);
    } else {
      setIsVisible(false);
    }
    return () => clearTimeout(timeout);
  }, [busy, pipelineComplete, errorBanner]);

  // Mappa gli stati tecnici a testi user-friendly
  const currentLabel = useMemo(() => {
    if (errorBanner) return "Errore nella pipeline";
    if (pipelineComplete) return "Documento pronto";
    
    switch (activeStageKey) {
      case 'upload': return "Caricamento file...";
      case 'transcode': return "Ottimizzazione audio...";
      case 'transcribe': return "Trascrizione in corso...";
      case 'markdown': return "Generazione contenuti AI...";
      case 'publish': return "Creazione PDF...";
      case 'complete': return "Finalizzazione...";
      default: return "Elaborazione in corso...";
    }
  }, [activeStageKey, pipelineComplete, errorBanner]);

  // Icona dello stato corrente
  const CurrentIcon = useMemo(() => {
    if (errorBanner) return XCircle;
    if (pipelineComplete) return CheckCircle2;
    return RefreshCw;
  }, [errorBanner, pipelineComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 flex flex-col items-center gap-2 transition-all duration-300">
      
      {/* --- EXPANDED CARD (Dettagli) --- */}
      <div 
        className={classNames(
          "w-[380px] overflow-hidden rounded-2xl border border-white/10 bg-[#121214]/95 backdrop-blur-xl shadow-2xl transition-all duration-300 ease-out origin-bottom",
          isExpanded ? "mb-3 max-h-[400px] opacity-100 scale-100" : "max-h-0 opacity-0 scale-95 pointer-events-none"
        )}
      >
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-bold uppercase tracking-widest text-white/50">Stato Avanzamento</span>
            <span className="text-[10px] font-mono text-white/30">Live Log</span>
          </div>
          
          <ul className="space-y-2">
            {PIPELINE_STAGES.map((stage) => {
              const status = pipelineStatus[stage.key] || 'idle';
              const isDone = status === 'done';
              const isRunning = status === 'running';
              const isFailed = status === 'failed';
              const Icon = stage.icon || Sparkles;

              return (
                <li key={stage.key} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <div className={classNames(
                      "flex h-6 w-6 items-center justify-center rounded-full border",
                      isDone ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" :
                      isRunning ? "border-indigo-500/20 bg-indigo-500/10 text-indigo-400" :
                      isFailed ? "border-rose-500/20 bg-rose-500/10 text-rose-400" :
                      "border-white/5 bg-white/5 text-white/20"
                    )}>
                      {isRunning ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
                    </div>
                    <span className={classNames(
                      isRunning || isDone ? "text-white/90" : "text-white/40"
                    )}>
                      {stage.label}
                    </span>
                  </div>
                  {isDone && <CheckCircle2 className="h-3 w-3 text-emerald-500/50" />}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* --- COLLAPSED PILL (Dynamic Island) --- */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={classNames(
          "group flex items-center gap-3 rounded-full border px-1.5 py-1.5 pr-5 shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95",
          errorBanner 
            ? "border-rose-500/30 bg-[#1a0505] text-rose-200" 
            : pipelineComplete 
              ? "border-emerald-500/30 bg-[#021a0f] text-emerald-200"
              : "border-white/10 bg-[#09090b] text-white"
        )}
      >
        {/* Icona Circolare */}
        <div className={classNames(
          "flex h-9 w-9 items-center justify-center rounded-full",
          errorBanner ? "bg-rose-500/20" : pipelineComplete ? "bg-emerald-500/20" : "bg-white/10"
        )}>
          <CurrentIcon className={classNames(
            "h-5 w-5",
            !pipelineComplete && !errorBanner && "animate-spin"
          )} />
        </div>

        {/* Testo Stato */}
        <div className="flex flex-col items-start text-left">
          <span className="text-xs font-medium leading-tight">
            {currentLabel}
          </span>
          {(!pipelineComplete && !errorBanner) && (
             <span className="text-[10px] text-white/40 font-mono">
               Clicca per dettagli
             </span>
          )}
        </div>

        {/* Chevron Indicatore */}
        <div className="ml-2 text-white/20 transition-colors group-hover:text-white/60">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </div>
      </button>
    </div>
  );
}