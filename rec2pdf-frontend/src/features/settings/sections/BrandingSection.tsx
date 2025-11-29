import React from "react";
import { useAppContext } from "../../../hooks/useAppContext";
import { Palette, CheckCircle2 } from "../../../components/icons";
import { classNames } from "../../../utils/classNames";

const BrandingSection = () => {
  // FIX: Cast a 'any' per evitare errori di tipo su setTheme
  const {
    theme,
    themes,
    setTheme,
  } = useAppContext() as any;

  return (
    <div className="space-y-8">
      
      <div className="border-b border-white/10 pb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Palette className="h-5 w-5 text-indigo-400" />
          Personalizzazione Interfaccia
        </h3>
        <p className="mt-1 text-sm text-zinc-400">
          Scegli l'aspetto visivo della piattaforma più adatto al tuo ambiente di lavoro.
        </p>
      </div>

      <div className="space-y-4">
        <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          Tema Applicazione
        </label>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Object.entries(themes).map(([key, value]: any) => {
            const isActive = theme === key;
            return (
              <button
                key={key}
                onClick={() => setTheme(key)} 
                className={classNames(
                  "group relative flex items-center gap-4 rounded-xl border p-4 text-left transition-all",
                  isActive
                    ? "border-indigo-500/50 bg-indigo-500/10 ring-1 ring-indigo-500/50"
                    : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                )}
              >
                <div className={`h-10 w-10 rounded-lg border border-white/10 shadow-inner ${value.bg.split(' ')[0].replace('from-', 'bg-')}`} />
                
                <div className="flex-1">
                  <p className={classNames(
                    "text-sm font-bold capitalize",
                    isActive ? "text-white" : "text-zinc-300"
                  )}>
                    {key}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {isActive ? "Attivo" : "Clicca per attivare"}
                  </p>
                </div>

                {isActive && (
                  <div className="absolute right-4 top-4 text-indigo-400">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BrandingSection;