import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowUp, User, Bot, RefreshCw } from './icons'; // Aggiungi icone se mancano
import { classNames } from '../utils/classNames';
import { useAppContext } from '../hooks/useAppContext';

const DEFAULT_PERSONAS = [
  { key: 'CRITIC', name: "L'Avvocato del Diavolo", role: "Risk Manager" },
  { key: 'VISIONARY', name: "Il Visionario", role: "Innovation Lead" },
  { key: 'PRAGMATIST', name: "Il Pragmatico", role: "COO" },
  { key: 'COPYWRITER', name: "Il Comunicatore", role: "Senior Editor" }
];

const ChatInterface = ({ transcription, onAddToNotes }) => {
  const { normalizedBackendUrl, fetchBody } = useAppContext();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [personas, setPersonas] = useState(DEFAULT_PERSONAS);
  const [activePersona, setActivePersona] = useState(null); // Nessuno attivo all'inizio
  const scrollRef = useRef(null);

  // Caricamento Personas
  useEffect(() => {
    const loadPersonas = async () => {
        try {
            const res = await fetchBody(`${normalizedBackendUrl}/api/chat/personas`);
            if (res.ok && res.data?.personas?.length > 0) setPersonas(res.data.personas);
        } catch (e) { console.warn("Fallback personas locali."); }
    };
    loadPersonas();
    
    // Messaggio iniziale più pulito
    setMessages([{
        role: 'system',
        content: "Seleziona uno Sparring Partner in alto per avviare un'analisi automatica della trascrizione."
    }]);
  }, [normalizedBackendUrl, fetchBody]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  // --- NUOVA LOGICA: CLICK SUL RUOLO (SCENARIO SEMPLICE) ---
  const handlePersonaClick = async (personaKey) => {
    if (loading) return; // Evita doppi click
    
    setActivePersona(personaKey);
    setLoading(true);

    // Feedback visivo immediato: Messaggio "fantasma" che spiega cosa sta succedendo
    const selectedPersonaName = personas.find(p => p.key === personaKey)?.name || personaKey;
    
    // Puliamo la chat precedente? Opzionale. Per ora la teniamo per contesto.
    // Se vuoi pulire: setMessages([]); 

    try {
        const res = await fetchBody(`${normalizedBackendUrl}/api/chat/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [], // Inviamo array vuoto, è un trigger
                transcription,
                persona: personaKey,
                isTrigger: true // <--- FLAG FONDAMENTALE
            })
        });

        if (res.ok && res.data?.message) {
            setMessages(prev => [
                ...prev, 
                // Aggiungiamo un separatore visivo o un messaggio di sistema per dire chi parla
                { role: 'system', content: `Analisi generata da: ${selectedPersonaName}` },
                res.data.message
            ]);
        } else {
            throw new Error(res.data?.message);
        }
    } catch (error) {
        setMessages(prev => [...prev, { role: 'system', content: "⚠️ Errore nell'analisi automatica." }]);
    } finally {
        setLoading(false);
    }
  };

  // --- LOGICA ESISTENTE: CHAT MANUALE (SCENARIO AVANZATO) ---
  const handleSend = async () => {
    if (!input.trim() || loading) return;
    if (!activePersona) {
        // Fallback se l'utente scrive senza aver selezionato un ruolo
        alert("Seleziona prima una prospettiva (in alto)!");
        return;
    }
    
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
        const res = await fetchBody(`${normalizedBackendUrl}/api/chat/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [...messages, userMsg], 
                transcription,
                persona: activePersona,
                isTrigger: false // <--- È una chat normale
            })
        });

        if (res.ok && res.data?.message) {
            setMessages(prev => [...prev, res.data.message]);
        }
    } catch (error) {
        setMessages(prev => [...prev, { role: 'system', content: "⚠️ Errore di connessione." }]);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b] text-white rounded-xl overflow-hidden border border-white/10 shadow-inner">
      
      {/* HEADER: Persona Selector (Trigger Attivi) */}
      <div className="p-3 border-b border-white/10 bg-[#121214] flex items-center gap-2 overflow-x-auto no-scrollbar min-h-[60px]">
        {personas.map(p => (
            <button
                key={p.key}
                onClick={() => handlePersonaClick(p.key)}
                disabled={loading}
                className={classNames(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-all border",
                    activePersona === p.key 
                        ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-200 ring-1 ring-indigo-500/30" 
                        : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 hover:border-white/10",
                    loading && "opacity-50 cursor-not-allowed"
                )}
            >
                {activePersona === p.key && <Sparkles className="h-3 w-3 text-indigo-400" />}
                {p.name}
            </button>
        ))}
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-[#09090b]" ref={scrollRef}>
        {messages.map((m, i) => (
            <div key={i} className={classNames("flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300", m.role === 'user' ? "justify-end" : "justify-start")}>
                
                {/* Avatar AI */}
                {m.role === 'assistant' && (
                    <div className="h-8 w-8 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20 mt-1">
                        <Bot className="h-4 w-4 text-indigo-400" />
                    </div>
                )}
                
                <div className={classNames(
                    "max-w-[90%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm",
                    m.role === 'user' 
                        ? "bg-indigo-600 text-white rounded-tr-none" 
                        : m.role === 'system'
                            ? "w-full bg-transparent border border-dashed border-zinc-800 text-zinc-500 text-center text-xs py-2" // Stile per messaggi di sistema
                            : "bg-[#18181b] border border-white/10 text-zinc-300 rounded-tl-none"
                )}>
                    {/* Render del contenuto con supporto Markdown basilare (se necessario) o testo semplice */}
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    
                    {/* Action: Add to Notes (SOLO per messaggi AI reali) */}
                    {m.role === 'assistant' && onAddToNotes && (
                        <button 
                            onClick={() => onAddToNotes(m.content)}
                            className="mt-3 flex items-center gap-1.5 text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wide opacity-70 hover:opacity-100 transition-all border-t border-white/5 pt-2 w-full"
                        >
                            <ArrowUp className="h-3 w-3 rotate-45" /> Aggiungi alle note
                        </button>
                    )}
                </div>

                {/* Avatar User */}
                {m.role === 'user' && (
                    <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-white/10 mt-1">
                        <User className="h-4 w-4 text-zinc-400" />
                    </div>
                )}
            </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
            <div className="flex gap-4 animate-pulse">
                 <div className="h-8 w-8 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20">
                    <RefreshCw className="h-4 w-4 text-indigo-400 animate-spin" />
                </div>
                <div className="bg-[#18181b] rounded-2xl rounded-tl-none px-5 py-4 border border-white/10 text-xs text-zinc-500">
                    Analisi in corso...
                </div>
            </div>
        )}
      </div>

      {/* INPUT AREA (Scenario Avanzato) */}
      <div className="p-4 bg-[#121214] border-t border-white/10">
        <div className="relative flex items-center group">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={!activePersona || loading} // Disabilitato se nessun ruolo scelto
                placeholder={activePersona ? "Fai una domanda specifica al ruolo selezionato..." : "👆 Seleziona prima un ruolo in alto per iniziare"}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:bg-black/60 focus:ring-1 focus:ring-indigo-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
                onClick={handleSend}
                disabled={!input.trim() || loading || !activePersona}
                className="absolute right-2 p-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-500 disabled:opacity-30 disabled:bg-zinc-800 transition-all shadow-lg shadow-indigo-900/20"
            >
                <ArrowUp className="h-4 w-4" />
            </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;