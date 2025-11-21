'use strict';

const { getAIService } = require('./aiService');
const { resolveProvider } = require('./aiProviders');

class AIOrchestrator {
  async generateContentWithFallback(prompt, options = {}) {
    const { textProvider: overrideProvider, taskComplexity = 'low' } = options;
    const providerChain = [];

    // 1. Primario
    let primaryId = overrideProvider || process.env.AI_TEXT_PROVIDER || 'gemini';
    try {
      providerChain.push(resolveProvider('text', primaryId, taskComplexity));
    } catch (e) {
      console.warn(`[Orchestrator] Provider primario "${primaryId}" non valido.`, e.message);
    }

    // 2. Fallback (Se primario è Gemini -> OpenAI, e viceversa)
    let fallbackId = process.env.AI_TEXT_PROVIDER_FALLBACK;
    if (!fallbackId) {
        fallbackId = primaryId === 'gemini' ? 'openai' : 'gemini';
    }

    if (fallbackId && fallbackId !== primaryId) {
      try {
        providerChain.push(resolveProvider('text', fallbackId, taskComplexity));
      } catch (e) {
        console.warn(`[Orchestrator] Provider fallback "${fallbackId}" non valido.`, e.message);
      }
    }
    
    if (providerChain.length === 0) throw new Error('Nessun provider AI valido configurato.');

    console.log(`[Orchestrator] Task: ${taskComplexity.toUpperCase()} | Chain: ${providerChain.map(p => `${p.id}(${p.model})`).join(' -> ')}`);

    let lastError = null;

    for (const provider of providerChain) {
      try {
        console.log(`[Orchestrator] Esecuzione con: ${provider.id} (${provider.model})...`);
        const aiClient = getAIService(provider.id, provider.apiKey, provider.model);
        const result = await aiClient.generateContent(prompt);
        console.log(`[Orchestrator] Successo: ${provider.id}`);
        return result;
      } catch (error) {
        console.error(`[Orchestrator] Errore ${provider.id}: ${error.message}`);
        lastError = error;
      }
    }
    throw lastError;
  }

  async generateEmbeddingWithFallback(text, options = {}) {
    const providerId = options.embeddingProvider || process.env.AI_EMBEDDING_PROVIDER || 'gemini';
    try {
      const provider = resolveProvider('embedding', providerId);
      console.log(`[Orchestrator-Embedding] Uso: ${provider.id} (${provider.model})`);
      const aiClient = getAIService(provider.id, provider.apiKey, provider.model);
      return await aiClient.generateEmbedding(text);
    } catch (error) {
      console.error(`[Orchestrator-Embedding] Errore ${providerId}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new AIOrchestrator();