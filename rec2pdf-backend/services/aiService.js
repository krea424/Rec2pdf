'use strict';

const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");

// Funzione helper per l'attesa
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class GeminiClient {
  constructor(apiKey, modelName = 'gemini-1.5-flash-latest') {
    if (!apiKey) throw new Error('API key Gemini mancante');
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
    this.model = this.genAI.getGenerativeModel({ model: this.modelName });
  }

  /**
   * Genera contenuto con logica di retry e exponential backoff.
   */
  async generateContent(prompt, retries = 3, initialDelay = 1000) {
    let lastError = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.model.generateContent(prompt);
        return result.response.text();
      } catch (error) {
        lastError = error;
        // Controlliamo se l'errore è "riprovabile" (5xx, 429, errori di rete)
        const isRetryable = error.status >= 500 || error.status === 429;
        if (isRetryable && attempt < retries) {
          const delay = initialDelay * Math.pow(2, attempt - 1);
          console.warn(`⚠️ Errore GeminiClient (tentativo ${attempt}/${retries}): ${error.message}. Riprovo tra ${delay}ms...`);
          await sleep(delay);
        } else {
          // Se l'errore non è riprovabile o abbiamo esaurito i tentativi, lancia l'errore.
          console.error(`❌ Errore GeminiClient (${this.modelName}):`, error);
          throw error;
        }
      }
    }
    // Questo punto non dovrebbe essere raggiunto, ma per sicurezza...
    throw lastError;
  }

  async generateEmbedding(text) {
    // La logica di embedding potrebbe avere una gestione degli errori simile,
    // ma per ora la lasciamo semplice.
    const embeddingModel = this.genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
  }
}

class OpenAIClient {
  // ... (implementazione simile per OpenAI, con logica di retry)
}

const aiServicesCache = new Map();

function getAIService(provider, apiKey, modelName) {
  const cacheKey = `${provider}-${modelName}`;
  if (aiServicesCache.has(cacheKey)) {
    return aiServicesCache.get(cacheKey);
  }

  let client;
  if (provider === 'gemini') {
    client = new GeminiClient(apiKey, modelName);
  } else if (provider === 'openai') {
    client = new OpenAIClient(apiKey, modelName);
  } else {
    throw new Error(`Provider AI non supportato: ${provider}`);
  }

  aiServicesCache.set(cacheKey, client);
  return client;
}

module.exports = { getAIService };