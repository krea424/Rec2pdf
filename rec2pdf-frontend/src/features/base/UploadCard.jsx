import React, { useEffect, useRef, useState } from "react";
import { useAppContext } from "../../hooks/useAppContext";
import { 
  Mic, 
  Upload, 
  FileText, 
  FileCode, 
  XCircle, 
  CheckCircle2,
  Waves,
  Music
} from "../../components/icons";
import { classNames } from "../../utils/classNames";

export default function UploadCard({ journeyStage }) {
  const {
    recording,
    startRecording,
    stopRecording,
    elapsed,
    fmtTime,
    level, 
    onPickFile,
    handleMarkdownFilePicked,
    handleTextFilePicked,
    fileInputRef,
    markdownInputRef,
    textInputRef,
    audioBlob,
    lastMarkdownUpload,
    lastTextUpload,
    resetAll,
    busy
  } = useAppContext();

  const isRecording = journeyStage === "record" && recording;
  const hasAudio = !!audioBlob;

  // === MOTORE VISUALIZER "FLUIDO" ===
  const levelRef = useRef(0);
  useEffect(() => { levelRef.current = level; }, [level]);

  const [bars, setBars] = useState([10, 10, 10, 10, 10]);
  const requestRef = useRef();

  useEffect(() => {
    if (!isRecording) {
        setBars([10, 10, 10, 10, 10]);
        return;
    }
    const animate = () => {
        setBars(prevBars => {
            const currentLevel = levelRef.current;
            const boosted = Math.min(1.0, currentLevel * 4); 
            return prevBars.map((prevHeight, i) => {
                const sensitivity = 1 - (Math.abs(2 - i) * 0.25);
                const noise = Math.random() * 0.05;
                const targetHeight = 10 + ((boosted + noise) * sensitivity * 90);
                return prevHeight + (targetHeight - prevHeight) * 0.2;
            });
        });
        requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [isRecording]);

  // Componente Bottone Upload Compatto
  const UploadButton = ({ icon: Icon, label, subLabel, onClick, active, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        "group relative flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 w-full",
        // UX FIX: Se attivo ma c'è l'audio caricato (quindi step finito), lo rendiamo "spento" (grigio)
        // Invece di verde acceso, usiamo uno stile "selezionato ma passivo"
        active 
          ? "border-white/10 bg-white/5 text-zinc-300" 
          : "border-white/5 bg-[#18181b] hover:border-white/10 hover:bg-[#202023]",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      <div className={classNames(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
        // Icona: Verde solo se attivo, altrimenti grigio
        active ? "bg-white/10 text-zinc-200" : "bg-white/5 text-zinc-400 group-hover:text-zinc-200"
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={classNames("text-xs font-bold uppercase tracking-wide", active ? "text-white" : "text-zinc-300")}>
          {label}
        </p>
        <p className="truncate text-[10px] text-zinc-500 font-medium">{subLabel}</p>
      </div>
      {/* Checkmark: Più discreto */}
      {active && (
        <CheckCircle2 className="h-4 w-4 text-zinc-500 animate-in zoom-in duration-200" />
      )}
    </button>
  );

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#121214] p-5 shadow-sm transition-all">
      
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          <div className={classNames("h-1.5 w-1.5 rounded-full", isRecording ? "bg-rose-500 animate-pulse" : "bg-zinc-600")} />
          Acquisizione Input
        </div>
        <div className="font-mono text-xs font-medium text-zinc-400 bg-white/5 px-2 py-1 rounded-md border border-white/5">
          {isRecording ? (
            <span className="text-rose-400">{fmtTime(elapsed)}</span>
          ) : (
            "00:00:00"
          )}
        </div>
      </div>

      {/* AREA PRINCIPALE */}
      <div className="relative overflow-hidden rounded-xl">
        {!hasAudio ? (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={busy}
            className={classNames(
              "group flex w-full items-center justify-center gap-4 border py-10 transition-all duration-300 relative z-10 overflow-hidden",
              isRecording
                ? "border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10"
                : "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/40"
            )}
            style={{ borderRadius: 'inherit' }}
          >
            {isRecording && (
               <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none z-0">
                  <div 
                    className="h-full w-full bg-gradient-to-r from-transparent via-rose-500 to-transparent transition-transform duration-75 ease-out blur-xl" 
                    style={{ transform: `scaleY(${Math.max(0.2, level * 4)}) scaleX(1.5)` }} 
                  />
               </div>
            )}

            <div className={classNames(
              "flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-300 z-10",
              isRecording 
                ? "bg-rose-500 text-white scale-110 shadow-rose-900/20" 
                : "bg-emerald-500 text-slate-900 group-hover:scale-105 shadow-emerald-900/20"
            )}>
              {isRecording ? <div className="h-4 w-4 rounded-sm bg-white" /> : <Mic className="h-6 w-6" />}
            </div>
            
            <div className="text-left z-10">
              <p className={classNames("text-base font-bold", isRecording ? "text-rose-100" : "text-white")}>
                {isRecording ? "Ferma Registrazione" : "Avvia Registrazione"}
              </p>
              <p className={classNames("text-[11px]", isRecording ? "text-rose-300/80" : "text-zinc-400")}>
                {isRecording ? "Clicca per terminare" : "Usa il microfono del dispositivo"}
              </p>
            </div>
          </button>
        ) : (
          // Stato: Audio Acquisito (UX FIX: Colori spenti/neutri)
          <div className="flex w-full items-center justify-between border border-white/10 bg-white/5 p-4 z-10 relative" style={{ borderRadius: 'inherit' }}>
             <div className="flex items-center gap-3">
                {/* Icona grigia invece che verde */}
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-zinc-400 border border-white/5">
                   <Waves className="h-5 w-5" />
                </div>
                <div>
                   <p className="text-sm font-bold text-zinc-200">Audio Pronto</p>
                   <p className="text-[10px] text-zinc-500 font-mono">
                       {audioBlob.name || "Registrazione vocale"} • {(audioBlob.size / 1024 / 1024).toFixed(2)} MB
                   </p>
                </div>
             </div>
             {!busy && (
               <button 
                onClick={resetAll} 
                className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-black/20 px-3 py-1.5 text-[10px] font-medium text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 transition"
               >
                  <XCircle className="h-3.5 w-3.5" /> Rimuovi
               </button>
             )}
          </div>
        )}
      </div>

      {/* GRIGLIA UPLOAD SECONDARI */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <UploadButton 
            icon={Music} 
            label="Audio File" 
            subLabel="MP3, WAV, M4A" 
            onClick={() => fileInputRef.current?.click()}
            active={hasAudio && !recording}
            disabled={busy || isRecording}
        />
        <UploadButton 
            icon={FileCode} 
            label="Markdown" 
            subLabel="Carica .md" 
            onClick={() => markdownInputRef.current?.click()}
            active={!!lastMarkdownUpload}
            disabled={busy || isRecording}
        />
        <UploadButton 
            icon={FileText} 
            label="Testo" 
            subLabel="Carica .txt" 
            onClick={() => textInputRef.current?.click()}
            active={!!lastTextUpload}
            disabled={busy || isRecording}
        />
        
        <input type="file" accept="audio/*" className="hidden" ref={fileInputRef} onChange={onPickFile} />
        <input type="file" accept=".md,.markdown" className="hidden" ref={markdownInputRef} onChange={handleMarkdownFilePicked} />
        <input type="file" accept=".txt" className="hidden" ref={textInputRef} onChange={handleTextFilePicked} />
      </div>

      {/* DROPZONE */}
      <div className="relative group rounded-lg border border-dashed border-white/5 bg-white/[0.01] py-3 text-center transition-colors hover:border-white/10 hover:bg-white/[0.03]">
        <p className="text-[10px] font-medium text-zinc-500 group-hover:text-zinc-400">
            Oppure trascina qui i tuoi file per caricarli
        </p>
      </div>

      {/* FOOTER DI STATO */}
      <div className="flex items-center justify-end gap-6 rounded-lg bg-black/30 border border-white/5 px-4 py-2.5">
         <div className="flex items-center gap-4 text-[10px] font-medium text-zinc-500">
            {/* Indicatori discreti */}
            <div className={classNames("flex items-center gap-1.5", hasAudio ? "text-zinc-300" : "")}>
                <div className={classNames("h-1.5 w-1.5 rounded-full", hasAudio ? "bg-emerald-500" : "bg-zinc-700")} />
                Audio
            </div>
            <div className={classNames("flex items-center gap-1.5", lastMarkdownUpload || lastTextUpload ? "text-zinc-300" : "")}>
                <div className={classNames("h-1.5 w-1.5 rounded-full", lastMarkdownUpload || lastTextUpload ? "bg-indigo-500" : "bg-zinc-700")} />
                Testo
            </div>
         </div>
      </div>

    </div>
  );
}