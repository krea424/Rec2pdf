import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowUp, User, Bot } from './icons';
import { classNames } from '../utils/classNames';
import { useAppContext } from '../hooks/useAppContext';

// --- FALLBACK PERSONAS (Per garantire che la UI funzioni sempre) ---
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
  
  // Inizializziamo con i default, così i bottoni appaiono SUBITO
  const [personas, setPersonas] = useState(DEFAULT_PERSONAS);
  const [activePersona, setActivePersona] = useState('CRITIC');
  const scrollRef = useRef(null);

  // Carica le Personas dal backend (se disponibili, altrimenti tiene i default)
  useEffect(() => {
    const loadPersonas = async () => {
        try {
            const res = await fetchBody(`${normalizedBackendUrl}/api/chat/personas`);
            if (res.ok && res.data?.personas && res.data.personas.length > 0) {
                setPersonas(res.data.personas);
            }
        } catch (e) {
            console.warn("Impossibile caricare personas dal backend, uso default locale.");
        }
    };
    loadPersonas();
    
    // Messaggio di benvenuto iniziale
    setMessages([{
        role: 'assistant',
        content: "Ciao. Ho analizzato la tua trascrizione. Scegli una prospettiva (in alto) e mettiamo alla prova le tue idee."
    }]);
  }, [normalizedBackendUrl, fetchBody]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]); // Aggiunto loading alle dipendenze per scrollare quando l'AI risponde

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
        // Simuliamo un ritardo minimo per UX
        // await new Promise(r => setTimeout(r, 500)); 

        const res = await fetchBody(`${normalizedBackendUrl}/api/chat/session`, {
            method: 'POST',
            // --- AGGIUNTA CRITICA QUI SOTTO ---
            headers: {
                'Content-Type': 'application/json'
            },
            // ----------------------------------
            body: JSON.stringify({
                messages: [...messages, userMsg], 
                transcription,
                persona: activePersona
            })
        });

        if (res.ok && res.data?.message) {
// ...
            setMessages(prev => [...prev, res.data.message]);
        } else {
            throw new Error(res.data?.message || "Errore nella risposta dell'AI");
        }
    } catch (error) {
        console.error("Chat error:", error);
        setMessages(prev => [...prev, { role: 'system', content: "⚠️ Non riesco a contattare l'Advisor. Verifica che il backend sia attivo." }]);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b] text-white rounded-xl overflow-hidden border border-white/10 shadow-inner">
      
      {/* HEADER: Persona Selector (Ora garantito visibile) */}
      <div className="p-3 border-b border-white/10 bg-[#121214] flex items-center gap-2 overflow-x-auto no-scrollbar min-h-[60px]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mr-2 shrink-0">
            Scegli Prospettiva:
        </span>
        {personas.map(p => (
            <button
                key={p.key}
                onClick={() => setActivePersona(p.key)}
                className={classNames(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-all border",
                    activePersona === p.key 
                        ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-200 shadow-[0_0_15px_-3px_rgba(99,102,241,0.4)]" 
                        : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 hover:border-white/10"
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
                    "max-w-[85%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm",
                    m.role === 'user' 
                        ? "bg-indigo-600 text-white rounded-tr-none" 
                        : "bg-[#18181b] border border-white/10 text-zinc-300 rounded-tl-none"
                )}>
                    {m.role === 'system' ? (
                        <span className="text-rose-400 font-mono text-xs">{m.content}</span>
                    ) : (
                        m.content
                    )}
                    
                    {/* Action: Add to Notes */}
                    {m.role === 'assistant' && onAddToNotes && i > 0 && (
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
                    <Bot className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="bg-[#18181b] rounded-2xl rounded-tl-none px-5 py-4 border border-white/10 flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-1.5 w-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-1.5 w-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
            </div>
        )}
      </div>

      {/* INPUT AREA */}
      <div className="p-4 bg-[#121214] border-t border-white/10">
        <div className="relative flex items-center group">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Sfida l'AI: 'Trova i punti deboli' o 'Dammi un'alternativa'..."
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:bg-black/60 focus:ring-1 focus:ring-indigo-500/50 transition-all"
            />
            <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="absolute right-2 p-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-500 disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-600 transition-all shadow-lg shadow-indigo-900/20"
            >
                <ArrowUp className="h-4 w-4" />
            </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;