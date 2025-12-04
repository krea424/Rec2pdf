'use strict';

const aiOrchestrator = require('./aiOrchestrator');

// LE "LENTI" (PERSONAS) - AGGIORNATE CON "TRIGGER PROMPT"
const PERSONAS = {
  CRITIC: {
    name: "L'Avvocato del Diavolo",
    role: "Senior Risk Manager & Critical Thinker",
    instruction: "Il tuo obiettivo è trovare buchi logici, rischi non calcolati e debolezze nell'argomentazione.",
    // Questo è il prompt che parte in automatico al click
    triggerPrompt: "Analizza la trascrizione. Identifica i 3 rischi principali o le debolezze logiche più evidenti. Per ogni punto, spiega brevemente il 'perché' è un problema. Sii spietato ma costruttivo."
  },
  VISIONARY: {
    name: "Il Visionario",
    role: "Chief Innovation Officer",
    instruction: "Il tuo obiettivo è espandere l'idea. Chiedi 'E se...?', proponi scenari futuri e opportunità adiacenti.",
    triggerPrompt: "Analizza la trascrizione. Proponi 3 scenari evolutivi o opportunità di mercato che l'autore non ha considerato. Pensa 'out of the box'. Ispirami."
  },
  PRAGMATIST: {
    name: "Il Pragmatico",
    role: "COO / Operations Director",
    instruction: "Concentrati sull'esecuzione. Risorse, costi, timeline e colli di bottiglia.",
    triggerPrompt: "Analizza la trascrizione. Elenca 3 ostacoli operativi concreti che impediranno la realizzazione di questo piano. Chiedi 'Chi fa cosa?' e 'Quanto costa?'."
  },
  COPYWRITER: {
    name: "Il Comunicatore",
    role: "Senior Editor",
    instruction: "Focalizzati sulla chiarezza, l'impatto del messaggio e la sintesi.",
    triggerPrompt: "Analizza la trascrizione. Estrai 3 slogan ('Hook') potenti che riassumono il concetto. Poi riscrivi l'idea centrale in un tweet (max 280 caratteri) di alto impatto."
  }
};

class ChatService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  // Aggiungiamo un flag 'isTrigger' per capire se è il click iniziale
  async chat(messages, contextData, personaKey = 'CRITIC', options = {}) {
    const persona = PERSONAS[personaKey] || PERSONAS.CRITIC;
    const { transcription } = contextData;
    const { isTrigger } = options; // Nuovo parametro

    // Logica di innesco automatico
    let userMessageContent = "";
    
    if (isTrigger) {
      // SCENARIO SEMPLICE: Usiamo il prompt predefinito della persona
      userMessageContent = persona.triggerPrompt;
    } else {
      // SCENARIO AVANZATO: Usiamo l'ultimo messaggio dell'utente
      userMessageContent = messages[messages.length - 1].content;
    }

    const systemPrompt = `
      Sei ${persona.name} (${persona.role}).
      ${persona.instruction}
      
      CONTESTO (Trascrizione):
      """
      ${transcription.substring(0, 20000)}
      """
      
      IMPORTANTE:
      - Rispondi direttamente alla richiesta dell'utente.
      - Usa elenchi puntati se ti chiedono liste.
      - Non premettere frasi di cortesia ("Certamente", "Ecco l'analisi"). Vai dritto al punto.
    `;

    // Costruiamo la history. Se è un trigger, la history è vuota/simulata.
    const historyPrompt = isTrigger 
        ? "" 
        : messages.slice(0, -1).map(m => `${m.role === 'user' ? 'Utente' : 'AI'}: ${m.content}`).join('\n');

    const fullPrompt = `
      ${systemPrompt}

      ${historyPrompt ? `STORIA CHAT:\n${historyPrompt}` : ""}

      UTENTE (Richiesta Attuale): ${userMessageContent}
      AI:
    `;

    try {
      const response = await aiOrchestrator.generateContentWithFallback(fullPrompt, { 
        textProvider: options.aiTextProvider,
        taskComplexity: 'high' 
      });
      
      return { 
        role: 'assistant', 
        content: response.trim(),
        persona: personaKey
      };

    } catch (error) {
      console.error('[ChatService] Errore:', error);
      throw new Error("Impossibile generare la risposta.");
    }
  }
  
  getPersonas() {
      return Object.keys(PERSONAS).map(k => ({ 
          key: k, 
          name: PERSONAS[k].name, 
          role: PERSONAS[k].role 
      }));
  }
}

module.exports = ChatService;