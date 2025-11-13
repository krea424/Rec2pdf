// File: rec2pdf-backend/services/aiOrchestrator.js

'use strict';

const { getAIService } = require('./aiService');
const { resolveProvider } = require('./aiProviders');

class AIOrchestrator {
  /**
   * Genera contenuto testuale con fallback dinamico basato su .env.
   * @param {string} prompt - Il prompt da inviare.
   * @param {object} options - Opzioni, che possono contenere un `textProvider` per sovrascrivere tutto.
   * @returns {Promise<string>} Il contenuto generato.
   */
  async generateContentWithFallback(prompt, options = {}) {
    const providerChain = [];

    if (options.textProvider) {
      try {
        providerChain.push(resolveProvider('text', options.textProvider));
      } catch (e) {
        console.warn(`[Orchestrator] Provider sovrascritto "${options.textProvider}" non valido o non configurato. Lo ignoro.`);
      }
    }

    const primaryProviderId = process.env.AI_TEXT_PROVIDER;
    if (primaryProviderId && !providerChain.some(p => p.id === primaryProviderId)) {
      try {
        providerChain.push(resolveProvider('text', primaryProviderId));
      } catch (e) {
        console.warn(`[Orchestrator] Provider primario "${primaryProviderId}" non valido o non configurato. Lo ignoro.`);
      }
    }

    const fallbackProviderId = process.env.AI_TEXT_PROVIDER_FALLBACK;
    if (fallbackProviderId && !providerChain.some(p => p.id === fallbackProviderId)) {
      try {
        providerChain.push(resolveProvider('text', fallbackProviderId));
      } catch (e) {
        console.warn(`[Orchestrator] Provider di fallback "${fallbackProviderId}" non valido o non configurato. Lo ignoro.`);
      }
    }
    
    if (providerChain.length === 0) {
      throw new Error('Nessun provider AI valido è stato configurato per la generazione di testo.');
    }

    console.log(`[Orchestrator] Catena di provider da tentare: ${providerChain.map(p => p.id).join(' -> ')}`);

    let lastError = null;

    for (const provider of providerChain) {
      try {
        console.log(`[Orchestrator] Tento la generazione con il provider: ${provider.id} (Modello: ${provider.model})`);
        const aiClient = getAIService(provider.id, provider.apiKey, provider.model);
        const result = await aiClient.generateContent(prompt);
        console.log(`[Orchestrator] Successo con il provider: ${provider.id}`);
        return result;
      } catch (error) {
        console.error(`[Orchestrator] Provider ${provider.id} fallito definitivamente: ${error.message}`);
        lastError = error;
      }
    }

    console.error('[Orchestrator] Tutti i provider nella catena hanno fallito.');
    throw lastError;
  }

  /**
   * Genera un embedding con fallback dinamico.
   * @param {string|string[]} text - Il testo o l'array di testi da cui generare l'embedding.
   * @param {object} options - Opzioni, che possono contenere un `embeddingProvider`.
   * @returns {Promise<number[]|number[][]>} L'embedding generato.
   */
  async generateEmbeddingWithFallback(text, options = {}) {
    // La logica di fallback per gli embedding è rimossa per evitare mismatch di dimensioni.
    // Usiamo sempre il provider definito in .env o sovrascritto dall'utente.
    const providerId = options.embeddingProvider || process.env.AI_EMBEDDING_PROVIDER || 'gemini';
    
    try {
      const provider = resolveProvider('embedding', providerId);
      console.log(`[Orchestrator-Embedding] Tento con il provider: ${provider.id} (Modello: ${provider.model})`);
      const aiClient = getAIService(provider.id, provider.apiKey, provider.model);
      const result = await aiClient.generateEmbedding(text);
      console.log(`[Orchestrator-Embedding] Successo con il provider: ${provider.id}`);
      return result;
    } catch (error) {
      console.error(`[Orchestrator-Embedding] Provider ${providerId} fallito: ${error.message}`);
      // Lanciamo l'errore per fermare la pipeline RAG, che non può funzionare senza embedding.
      throw error;
    }
  }
}
module.exports = new AIOrchestrator();