'use strict';

const aiOrchestrator = require('./aiOrchestrator');
const { RAGService } = require('./ragService');

// LE "LENTI" (PERSONAS)
const PERSONAS = {
  CRITIC: {
    name: "L'Avvocato del Diavolo",
    role: "Senior Risk Manager & Critical Thinker",
    instruction: "Il tuo obiettivo è trovare buchi logici, rischi non calcolati e debolezze nell'argomentazione. Sii spietato ma costruttivo. Non fare complimenti, vai dritto al punto critico."
  },
  VISIONARY: {
    name: "Il Visionario",
    role: "Chief Innovation Officer",
    instruction: "Il tuo obiettivo è espandere l'idea. Chiedi 'E se...?', proponi collegamenti laterali, scenari futuri e opportunità di mercato adiacenti. Ispira l'utente a pensare più in grande."
  },
  PRAGMATIST: {
    name: "Il Pragmatico",
    role: "COO / Operations Director",
    instruction: "Ignora la teoria. Concentrati sull'esecuzione. Chiedi: 'Chi lo fa?', 'Quanto costa?', 'Qual è la timeline?', 'Quali sono le risorse necessarie?'. Porta tutto a terra."
  },
  COPYWRITER: {
    name: "Il Comunicatore",
    role: "Senior Editor",
    instruction: "Focalizzati sulla chiarezza e l'impatto del messaggio. Suggerisci modi migliori per formulare i concetti chiave. Identifica slogan o 'hook' potenti nel discorso."
  }
};

class ChatService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.ragService = new RAGService(supabaseClient);
  }

  async chat(messages, contextData, personaKey = 'CRITIC', options = {}) {
    // 1. Recupera la definizione della Persona
    const persona = PERSONAS[personaKey] || PERSONAS.CRITIC;

    // 2. Prepara il contesto (Trascrizione + RAG opzionale)
    const { transcription, workspaceId, projectId } = contextData;
    
    // (Opzionale) Recupero RAG leggero se la domanda lo richiede
    // Per ora ci basiamo sulla trascrizione che è il "cuore" del brainstorming
    
    // 3. Costruzione System Prompt
    const systemPrompt = `
      Sei ${persona.name} (${persona.role}).
      ${persona.instruction}
      
      CONTESTO (Trascrizione dell'utente):
      """
      ${transcription.substring(0, 15000)} 
      """
      
      REGOLE:
      - Rispondi brevemente (max 3-4 frasi) per mantenere il dialogo fluido.
      - Fai una domanda alla volta per stimolare il pensiero.
      - Riferisciti esplicitamente a parti del testo trascritto.
      - Mantieni sempre il tuo "Character".
    `;

    // 4. Chiamata AI (Usiamo l'orchestrator esistente)
    // Costruiamo un prompt unico con la storia (approccio stateless per semplicità backend)
    // In un'app reale chat, passeremmo l'array messages, ma qui usiamo l'orchestrator testuale
    // quindi simuliamo la chat appendendo l'ultimo messaggio utente.
    
    const lastUserMessage = messages[messages.length - 1].content;
    const chatHistory = messages.slice(0, -1).map(m => `${m.role === 'user' ? 'Utente' : 'AI'}: ${m.content}`).join('\n');

    const fullPrompt = `
      ${systemPrompt}

      STORIA CHAT:
      ${chatHistory}

      UTENTE: ${lastUserMessage}
      AI:
    `;

    try {
      // Usiamo 'high' complexity per avere risposte intelligenti
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
      return Object.keys(PERSONAS).map(k => ({ key: k, name: PERSONAS[k].name, role: PERSONAS[k].role }));
  }
}

module.exports = ChatService;