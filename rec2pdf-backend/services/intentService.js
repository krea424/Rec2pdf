'use strict';

const aiOrchestrator = require('./aiOrchestrator');

// MAPPATURA STATICA INTENTO -> TEMPLATE (Il "Vestito" giusto per l'occasione)
// Qui definiamo quale template grafico si adatta meglio alla natura del contenuto.
const INTENT_TO_TEMPLATE_MAP = {
  'STRATEGIC_DECISION': 'luxury_report.html',      // Autorevole, elegante
  'OPERATIONAL_UPDATE': 'verbale_meeting.html',    // Strutturato, tabellare
  'CREATIVE_CONCEPT': 'executive_brief.html',      // Visivo, impatto, card
  'FORMAL_RECORD': 'luxury_report.html',           // Formale, ufficiale
  'TECHNICAL_DOCUMENTATION': 'default.tex',        // Standard, pulito (LaTeX)
  'GENERIC_NOTE': 'executive_brief.html'           // Fallback moderno
};

class IntentService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Analizza la trascrizione, determina l'intento e restituisce la configurazione completa.
   * @param {string} transcript - Il testo trascritto.
   * @returns {Promise<object>} - { prompt, template, metadata }
   */
  async analyzeAndResolve(transcript) {
    console.log('[IntentService] Avvio analisi intento...');

    // 1. CLASSIFICAZIONE AI
    const classification = await this._classifyTranscript(transcript);
    console.log(`[IntentService] Intento rilevato: ${classification.intent} (Confidence: ${classification.confidence})`);

    // 2. RISOLUZIONE PROMPT (Dal Database)
    const prompt = await this._findPromptForIntent(classification.intent);

    // 3. RISOLUZIONE TEMPLATE (Dalla Mappa)
    const templateFileName = INTENT_TO_TEMPLATE_MAP[classification.intent] || 'executive_brief.html';

    return {
      intent: classification.intent,
      reasoning: classification.reasoning,
      suggestedTitle: classification.suggested_title,
      prompt: prompt, // Oggetto prompt completo da Supabase
      template: templateFileName, // Nome del file template
      isAutoDetected: true
    };
  }

  async _classifyTranscript(transcript) {
    // Prendiamo solo i primi 3000 caratteri per velocità e costi (sufficienti per capire il tono)
    const snippet = transcript.substring(0, 3000);

    const systemPrompt = `
      Sei un Senior Editor e Analista di Processi. Analizza la trascrizione e classificala in UNA delle seguenti categorie:

      1. STRATEGIC_DECISION: Business case, investimenti, strategia, mercato.
      2. OPERATIONAL_UPDATE: Stato avanzamento progetti, task, riunioni operative.
      3. TECHNICAL_DOCUMENTATION: Specifiche tecniche, codice, ispezioni fisiche.
      4. FORMAL_RECORD: Verbali CdA, legale, HR, compliance.
      5. CREATIVE_CONCEPT: Brainstorming, marketing, idee astratte.
      6. GENERIC_NOTE: Appunti personali, diario, altro.

      Output ESCLUSIVAMENTE in JSON valido:
      {
        "intent": "STRING (uno dei valori sopra)",
        "confidence": 0.0-1.0,
        "suggested_title": "Titolo sintetico e professionale basato sul contenuto",
        "reasoning": "Breve motivo della scelta"
      }

      Trascrizione:
      "${snippet}..."
    `;

    try {
      // Usiamo 'low' complexity per forzare il modello veloce (Gemini Flash / GPT-4o-mini)
      const response = await aiOrchestrator.generateContentWithFallback(systemPrompt, { taskComplexity: 'low' });
      
      // Pulizia JSON (rimuove eventuali backticks markdown)
      const jsonString = response.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('[IntentService] Errore classificazione AI:', error);
      // Fallback sicuro in caso di errore AI
      return { intent: 'GENERIC_NOTE', confidence: 0, suggested_title: 'Nuovo Documento', reasoning: 'AI Error' };
    }
  }

  async _findPromptForIntent(intentCategory) {
    if (!this.supabase) throw new Error('Supabase client mancante');

    // Cerchiamo il prompt di default per quella categoria
    let { data, error } = await this.supabase
      .from('prompts')
      .select('*')
      .eq('intent_category', intentCategory)
      .eq('is_category_default', true)
      .maybeSingle();

    if (error) console.warn('[IntentService] Errore query prompt:', error.message);

    // Se non troviamo un default per la categoria, cerchiamo il fallback universale (Format Base)
    if (!data) {
      console.log(`[IntentService] Nessun prompt default per ${intentCategory}, uso fallback.`);
      const fallback = await this.supabase
        .from('prompts')
        .select('*')
        .eq('slug', 'format_base')
        .maybeSingle();
      data = fallback.data;
    }

    return data;
  }
}

module.exports = IntentService;