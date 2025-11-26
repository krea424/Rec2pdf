import React, { useState, useEffect } from "react";
import { Save, FileText, Users, ClipboardList, Palette, Sparkles, Trash2, Edit3 } from "../icons";
import { useAppContext } from "../../hooks/useAppContext";
import { Button } from "../ui/Button";

export default function PromptBuilder({ onClose, initialData = null }) {
  const { handleCreatePrompt, handleUpdatePrompt, handleDeletePrompt, promptLoading } = useAppContext();
  
  const isEditing = !!initialData;

  // Stato del Form
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    persona: initialData?.persona || "",
    description: initialData?.description || "",
    tags: Array.isArray(initialData?.tags) ? initialData.tags.join(', ') : "",
    checklist: initialData?.checklist?.sections ? initialData.checklist.sections.join('\n') : "",
    cueCards: Array.isArray(initialData?.cueCards) 
        ? initialData.cueCards.map(c => `${c.title} | ${c.hint}`).join('\n') 
        : "",
    tone: initialData?.markdownRules?.tone || "",
    voice: initialData?.markdownRules?.voice || "",
    bulletStyle: initialData?.markdownRules?.bulletStyle || "",
    layout: initialData?.pdfRules?.layout || "consulting",
    color: initialData?.color || "#6366f1"
  });

  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
      if (initialData) {
          setFormData({
            title: initialData.title || "",
            persona: initialData.persona || "",
            description: initialData.description || "",
            tags: Array.isArray(initialData.tags) ? initialData.tags.join(', ') : "",
            checklist: initialData.checklist?.sections ? initialData.checklist.sections.join('\n') : "",
            cueCards: Array.isArray(initialData.cueCards) 
                ? initialData.cueCards.map(c => `${c.title} | ${c.hint}`).join('\n') 
                : "",
            tone: initialData.markdownRules?.tone || "",
            voice: initialData.markdownRules?.voice || "",
            bulletStyle: initialData.markdownRules?.bulletStyle || "",
            layout: initialData.pdfRules?.layout || "consulting",
            color: initialData.color || "#6366f1"
          });
      }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: "", message: "" });

    const parsedCueCards = formData.cueCards.split('\n').map(line => {
        const [title, hint] = line.split('|');
        if (!title?.trim()) return null;
        return { title: title.trim(), hint: hint?.trim() || "" };
    }).filter(Boolean);

    const parsedChecklist = formData.checklist.split('\n').filter(line => line.trim().length > 0);
    const parsedTags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);

    const payload = {
      title: formData.title,
      persona: formData.persona,
      description: formData.description,
      tags: parsedTags,
      cueCards: parsedCueCards,
      checklist: { sections: parsedChecklist },
      markdownRules: {
          tone: formData.tone,
          voice: formData.voice,
          bulletStyle: formData.bulletStyle
      },
      pdfRules: {
          layout: formData.layout,
          accentColor: formData.color
      }
    };

    let result;
    if (isEditing) {
        result = await handleUpdatePrompt(initialData.id, payload);
    } else {
        result = await handleCreatePrompt(payload);
    }
    
    if (result.ok) {
        setStatus({ type: "success", message: isEditing ? "Prompt aggiornato!" : "Prompt creato!" });
        setTimeout(() => {
            if (onClose) onClose();
        }, 1000);
    } else {
        setStatus({ type: "error", message: result.message || "Errore operazione" });
    }
  };

  const handleDelete = async () => {
      if (!isEditing) return;
      if (!window.confirm("Sei sicuro di voler eliminare questo prompt?")) return;
      
      const result = await handleDeletePrompt(initialData.id);
      if (result.ok) {
          if (onClose) onClose();
      } else {
          setStatus({ type: "error", message: "Errore eliminazione" });
      }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-1">
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {isEditing ? <Edit3 className="h-5 w-5 text-indigo-400"/> : <Sparkles className="h-5 w-5 text-emerald-400"/>}
              {isEditing ? `Modifica: ${initialData.title}` : "Crea Nuovo Prompt"}
          </h3>
          {isEditing && (
              <button type="button" onClick={handleDelete} className="text-rose-400 hover:text-rose-300 p-2 hover:bg-rose-500/10 rounded-lg transition-colors" title="Elimina Prompt">
                  <Trash2 className="h-5 w-5" />
              </button>
          )}
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" /> Nome del Prompt
                </label>
                <input 
                    name="title" 
                    placeholder="Es. Analisi Strategica" 
                    className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
                    value={formData.title} onChange={handleChange} required 
                />
            </div>
            <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" /> Ruolo AI (Persona)
                </label>
                <input 
                    name="persona" 
                    placeholder="Es. Senior Business Analyst" 
                    className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
                    value={formData.persona} onChange={handleChange} 
                />
            </div>
        </div>

        {/* DESCRIZIONE / OBIETTIVO (Area espansa) */}
        <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                Descrizione / Obiettivo
            </label>
            <textarea 
                name="description" 
                rows={8} // Aumentato per visibilità
                placeholder="Istruzioni dettagliate per l'AI (System Prompt)..." 
                className="w-full rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none resize-y font-mono leading-relaxed"
                value={formData.description} onChange={handleChange} 
            />
            <p className="text-[10px] text-zinc-500 text-right">Supporta Markdown e YAML instructions.</p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5" /> Cue Cards (Titolo | Suggerimento)
                </label>
                <textarea 
                    name="cueCards" 
                    rows={6}
                    placeholder="Contesto | Qual è la situazione?&#10;Rischi | Ci sono criticità?" 
                    className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-300 focus:border-indigo-500 outline-none font-mono text-xs leading-relaxed resize-y"
                    value={formData.cueCards} onChange={handleChange} 
                />
                <p className="text-[10px] text-zinc-500">Una per riga. Usa | per separare.</p>
            </div>
            <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <ClipboardList className="h-3.5 w-3.5" /> Checklist Sezioni
                </label>
                <textarea 
                    name="checklist" 
                    rows={6}
                    placeholder="Executive Summary&#10;Analisi Dati&#10;Conclusioni" 
                    className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-300 focus:border-indigo-500 outline-none font-mono text-xs leading-relaxed resize-y"
                    value={formData.checklist} onChange={handleChange} 
                />
                <p className="text-[10px] text-zinc-500">Le sezioni attese nell'output.</p>
            </div>
        </div>

        <div className="h-px bg-white/5 w-full my-6" />
        
        <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
            <Palette className="h-4 w-4 text-indigo-400" /> Stile & Output
        </h3>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
             <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Template Grafico PDF</label>
                <div className="relative">
                    <select 
                        name="layout" 
                        className="w-full appearance-none rounded-xl border border-white/10 bg-black/20 p-3 pr-10 text-sm text-white focus:border-indigo-500 outline-none"
                        value={formData.layout} onChange={handleChange}
                    >
                        <option value="consulting">Consulting Report (Blu/Arancio)</option>
                        <option value="verbale_meeting">Verbale Meeting (Verde/Grigio)</option>
                        <option value="executive">Executive Brief (Teal/Grid)</option>
                        <option value="standard">Standard (Bianco/Nero)</option>
                    </select>
                    {/* Freccina custom CSS o icona posizionata absolute */}
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Tono di Voce</label>
                <input 
                    name="tone" 
                    placeholder="Es. Professionale, Diretto, Empatico" 
                    className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white focus:border-indigo-500 outline-none"
                    value={formData.tone} onChange={handleChange} 
                />
            </div>
        </div>
      </div>

      <div className="pt-6 flex gap-3 border-t border-white/5 mt-6">
        {isEditing && (
            <Button 
                type="button" 
                variant="ghost" 
                onClick={() => {
                    if (onClose) onClose();
                }}
                className="flex-1 text-zinc-400 hover:text-white"
            >
                Annulla
            </Button>
        )}
        <Button 
            type="submit" 
            variant="primary" 
            className="flex-[2] justify-center h-12 text-base font-semibold shadow-lg shadow-indigo-500/20"
            isLoading={promptLoading}
            leadingIcon={Save}
        >
            {isEditing ? "Aggiorna Prompt" : "Salva Prompt in Libreria"}
        </Button>
      </div>
      
      {status.message && (
            <div className={`mt-4 p-3 rounded-xl text-sm text-center font-medium animate-in fade-in slide-in-from-bottom-2 ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                {status.message}
            </div>
      )}
    </form>
  );
}