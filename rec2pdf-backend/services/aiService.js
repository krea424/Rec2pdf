'use strict';

const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");

// Funzione helper per l'attesa (invariata)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class GeminiClient {
  constructor(apiKey, modelName = 'gemini-1.5-flash-latest') {
    if (!apiKey) throw new Error('API key Gemini mancante');
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
    this.model = this.genAI.getGenerativeModel({ model: this.modelName });
  }

  /**
   * Genera contenuto con logica di retry migliorata:
   * - Più tentativi
   * - Attesa più lunga
   * - Aggiunta di "jitter" (ritardo casuale)
   */
  async generateContent(prompt, options = {}) {
    // --- MODIFICA 1: Rendiamo i parametri configurabili ---
    // Invece di avere valori fissi, li passiamo come opzioni.
    // Impostiamo dei default più robusti.
    const maxRetries = options.retries || 5; // Aumentato da 3 a 5
    const initialDelay = options.initialDelay || 2000; // Aumentato da 1000ms a 2000ms
    const maxDelay = options.maxDelay || 30000; // Aggiunto un limite massimo di attesa (30s)

    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.model.generateContent(prompt);
        return result.response.text();
      } catch (error) {
        lastError = error;

        // Miglioriamo il controllo per gli errori "riprovabili"
        const status = error.status || (error.cause && error.cause.status);
        const isRetryable = 
            status >= 500 || // Errori del server (come il 503)
            status === 429 || // Rate limit
            (error.message && error.message.toLowerCase().includes('network')); // Errori di rete

        if (isRetryable && attempt < maxRetries) {
          // --- MODIFICA 2: Calcolo del ritardo con Exponential Backoff + Jitter ---
          // Calcola il ritardo base in modo esponenziale
          const exponentialBackoff = initialDelay * Math.pow(2, attempt - 1);
          // Aggiunge un ritardo casuale ("jitter") per evitare richieste simultanee
          const jitter = Math.random() * 1000;
          // Si assicura che il ritardo non superi il massimo consentito
          const delay = Math.min(exponentialBackoff + jitter, maxDelay);

          console.warn(`⚠️ Errore GeminiClient (tentativo ${attempt}/${maxRetries}): ${error.message}. Riprovo tra ${Math.round(delay / 1000)}s...`);
          await sleep(delay);
        } else {
          console.error(`❌ Errore definitivo GeminiClient (${this.modelName}) dopo ${attempt} tentativi:`, error);
          throw error;
        }
      }
    }
    
    throw lastError;
  }

  async generateEmbedding(text) {
    // Potresti applicare una logica di retry simile anche qui se necessario.
    const embeddingModel = this.genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
  }
}

class OpenAIClient {
  constructor(apiKey, modelName = 'gpt-4o-mini') {
    if (!apiKey) throw new Error('API key OpenAI mancante');
    this.openai = new OpenAI({ apiKey });
    this.modelName = modelName;
  }
  
  // --- NUOVA IMPLEMENTAZIONE PER OPENAI CON RETRY ---
  async generateContent(prompt, options = {}) {
    const maxRetries = options.retries || 5;
    const initialDelay = options.initialDelay || 2000;
    const maxDelay = options.maxDelay || 30000;

    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const completion = await this.openai.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: this.modelName,
        });
        return completion.choices[0].message.content || "";
      } catch (error) {
        lastError = error;
        
        // La libreria di OpenAI usa codici di stato leggermente diversi
        const status = error.status;
        const isRetryable = 
            status >= 500 || 
            status === 429; // Rate limit
            
        if (isRetryable && attempt < maxRetries) {
          const exponentialBackoff = initialDelay * Math.pow(2, attempt - 1);
          const jitter = Math.random() * 1000;
          const delay = Math.min(exponentialBackoff + jitter, maxDelay);
          
          console.warn(`⚠️ Errore OpenAIClient (tentativo ${attempt}/${maxRetries}): ${error.message}. Riprovo tra ${Math.round(delay / 1000)}s...`);
          await sleep(delay);
        } else {
          console.error(`❌ Errore definitivo OpenAIClient (${this.modelName}) dopo ${attempt} tentativi:`, error);
          throw error;
        }
      }
    }
    
    throw lastError;
  }

  async generateEmbedding(text) {
    // Aggiungi la logica di embedding per OpenAI se necessario
    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small", // o un altro modello di embedding
      input: text,
    });
    return response.data[0].embedding;
  }
}

const aiServicesCache = new Map();

function getAIService(provider, apiKey, modelName) {
  const cacheKey = `${provider}-${modelName || 'default'}`;
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