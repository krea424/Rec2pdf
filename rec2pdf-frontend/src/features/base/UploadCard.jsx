import React, { useRef } from "react";
import { useAppContext } from "../../hooks/useAppContext";
import { 
  Mic, 
  Upload, 
  FileText, 
  FileCode, 
  XCircle, 
  CheckCircle2,
  Waves 
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

  // Helper per le card di upload secondarie
  const UploadButton = ({ icon: Icon, label, subLabel, onClick, active, fileInputId }) => (
    <button
      onClick={onClick}
      disabled={busy || isRecording}
      className={classNames(
        "group relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all duration-200",
        active 
          ? "border-emerald-500/30 bg-emerald-500/5" 
          : "border-white/10 bg-[#18181b] hover:border-white/20 hover:bg-[#202023]",
        (busy || isRecording) && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className={classNames(
        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
        active ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-zinc-400 group-hover:text-zinc-200"
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className={classNames("text-sm font-semibold", active ? "text-emerald-100" : "text-zinc-200")}>
          {label}
        </p>
        <p className="text-[10px] text-zinc-500 uppercase tracking-wide">{subLabel}</p>
      </div>
      {active && (
        <div className="absolute right-3 top-3 text-emerald-500">
          <CheckCircle2 className="h-4 w-4" />
        </div>
      )}
    </button>
  );

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-[#121214] p-6 shadow-sm transition-all">
      
      {/* HEADER: Titolo e Timer */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          <Mic className={classNames("h-4 w-4", isRecording && "text-rose-500 animate-pulse")} />
          Acquisizione Input
        </div>
        <div className="font-mono text-sm font-medium text-zinc-400">
          {isRecording ? (
            <span className="text-rose-400">{fmtTime(elapsed)}</span>
          ) : (
            "00:00:00"
          )}
        </div>
      </div>

      {/* AREA PRINCIPALE: Registrazione */}
      <div className="relative">
        {/* Visualizer Sfondo (Opzionale, per effetto wow) */}
        {isRecording && (
           <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
              <div className="h-16 w-full bg-gradient-to-r from-transparent via-rose-500 to-transparent animate-pulse" style={{ transform: `scaleY(${Math.max(0.2, level * 2)})` }} />
           </div>
        )}

        {!hasAudio ? (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={busy}
            className={classNames(
              "group flex w-full items-center justify-center gap-3 rounded-2xl border py-8 transition-all duration-300",
              isRecording
                ? "border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20"
                : "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-500/50"
            )}
          >
            <div className={classNames(
              "flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all",
              isRecording ? "bg-rose-500 text-white animate-pulse" : "bg-emerald-500 text-slate-900 group-hover:scale-110"
            )}>
              {isRecording ? <div className="h-5 w-5 rounded bg-white" /> : <Mic className="h-7 w-7" />}
            </div>
            <div className="text-left">
              <p className={classNames("text-lg font-bold", isRecording ? "text-rose-100" : "text-emerald-100")}>
                {isRecording ? "Ferma Registrazione" : "Avvia Registrazione"}
              </p>
              <p className={classNames("text-xs", isRecording ? "text-rose-300" : "text-emerald-400/70")}>
                {isRecording ? "Clicca per terminare e processare" : "Usa il microfono del dispositivo"}
              </p>
            </div>
          </button>
        ) : (
          <div className="flex w-full items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
             <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                   <Waves className="h-6 w-6" />
                </div>
                <div>
                   <p className="text-sm font-bold text-white">Audio Acquisito</p>
                   <p className="text-xs text-emerald-200/60">Pronto per l'elaborazione</p>
                </div>
             </div>
             {!busy && (
               <button onClick={resetAll} className="rounded-lg p-2 text-zinc-500 hover:bg-white/10 hover:text-rose-400 transition">
                  <XCircle className="h-5 w-5" />
               </button>
             )}
          </div>
        )}
      </div>

      {/* GRIGLIA UPLOAD SECONDARI */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* 1. Audio File */}
        <UploadButton 
            icon={Upload} 
            label="Carica Audio" 
            subLabel="MP3, WAV, M4A" 
            onClick={() => fileInputRef.current?.click()}
            active={hasAudio && !recording} // Active se c'è audio ma non stiamo registrando
        />
        <input
            type="file"
            accept="audio/*"
            className="hidden"
            ref={fileInputRef}
            onChange={onPickFile}
        />

        {/* 2. Markdown */}
        <UploadButton 
            icon={FileCode} 
            label="Carica .md" 
            subLabel="Markdown" 
            onClick={() => markdownInputRef.current?.click()}
            active={!!lastMarkdownUpload}
        />
        <input
            type="file"
            accept=".md,.markdown"
            className="hidden"
            ref={markdownInputRef}
            onChange={handleMarkdownFilePicked}
        />

        {/* 3. Text */}
        <UploadButton 
            icon={FileText} 
            label="Carica .txt" 
            subLabel="Testo Semplice" 
            onClick={() => textInputRef.current?.click()}
            active={!!lastTextUpload}
        />
        <input
            type="file"
            accept=".txt"
            className="hidden"
            ref={textInputRef}
            onChange={handleTextFilePicked}
        />
      </div>

      {/* DROPZONE (Visiva) */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-6 text-center transition-colors hover:border-white/20 hover:bg-white/[0.04]">
        <p className="text-sm font-medium text-zinc-300">Trascina qui i tuoi file</p>
        <p className="mt-1 text-xs text-zinc-500">Supporta audio, markdown e testo.</p>
      </div>

      {/* STATUS FOOTER */}
      <div className="space-y-2 rounded-xl bg-black/20 p-4 text-xs">
         <div className="flex justify-between items-center">
            <span className="text-zinc-500 uppercase tracking-wider font-bold text-[10px]">Stato Input</span>
            <span className="text-zinc-600">{busy ? "Elaborazione..." : "In attesa"}</span>
         </div>
         
         <div className="h-px bg-white/5 w-full my-2" />

         <div className="flex justify-between">
            <span className="text-zinc-400">Sorgente Audio</span>
            <span className={hasAudio ? "text-emerald-400" : "text-zinc-600"}>
                {hasAudio ? (recording ? "Registrazione..." : "Caricato") : "Vuoto"}
            </span>
         </div>
         <div className="flex justify-between">
            <span className="text-zinc-400">Markdown / Testo</span>
            <span className={lastMarkdownUpload || lastTextUpload ? "text-indigo-400" : "text-zinc-600"}>
                {lastMarkdownUpload ? "Markdown Caricato" : lastTextUpload ? "Testo Caricato" : "Vuoto"}
            </span>
         </div>

         {/* Input Level Bar */}
         <div className="mt-3">
            <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                <span>Livello Mic</span>
                <span>{Math.round(level * 100)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div 
                    className="h-full bg-emerald-500 transition-all duration-75" 
                    style={{ width: `${Math.min(100, level * 100)}%` }} 
                />
            </div>
         </div>
      </div>

    </div>
  );
}