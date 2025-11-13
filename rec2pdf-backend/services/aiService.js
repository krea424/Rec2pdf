// File: rec2pdf-backend/services/aiService.js

'use strict';

const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class GeminiClient {
  constructor(apiKey, modelName) {
    if (!apiKey) throw new Error('API key Gemini mancante');
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Salva il nome del modello passato. Sarà diverso per testo e embedding.
    this.modelName = modelName;
  }

  async generateContent(prompt, options = {}) {
    const model = this.genAI.getGenerativeModel({ model: this.modelName });
    const maxRetries = options.retries || 5;
    const initialDelay = options.initialDelay || 2000;
    const maxDelay = options.maxDelay || 30000;

    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error) {
        lastError = error;
        const status = error.status || (error.cause && error.cause.status);
        const isRetryable = status >= 500 || status === 429 || (error.message && error.message.toLowerCase().includes('network'));

        if (isRetryable && attempt < maxRetries) {
          const exponentialBackoff = initialDelay * Math.pow(2, attempt - 1);
          const jitter = Math.random() * 1000;
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
    const model = this.genAI.getGenerativeModel({ model: this.modelName });
    
    if (typeof text === 'string') {
      const result = await model.embedContent(text);
      return result.embedding.values;
    }
    if (Array.isArray(text)) {
      const requests = text.map(content => ({ content }));
      const result = await model.batchEmbedContents({ requests });
      return result.embeddings.map(e => e.values);
    }
    throw new Error('Input per generateEmbedding deve essere una stringa o un array di stringhe.');
  }
}

class OpenAIClient {
  constructor(apiKey, modelName) {
    if (!apiKey) throw new Error('API key OpenAI mancante');
    this.openai = new OpenAI({ apiKey });
    // Salva il nome del modello passato. Sarà diverso per testo e embedding.
    this.modelName = modelName;
  }
  
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
        const status = error.status;
        const isRetryable = status >= 500 || status === 429;
            
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
    const response = await this.openai.embeddings.create({
      model: this.modelName, // --- USA IL MODELLO PASSATO AL COSTRUTTORE ---
      input: text,
    });

    if (typeof text === 'string') {
      return response.data[0].embedding;
    }
    // Gestisce correttamente il batch
    return response.data.sort((a, b) => a.index - b.index).map(item => item.embedding);
  }
}

const aiServicesCache = new Map();

function getAIService(provider, apiKey, modelName) {
  const cacheKey = `${provider}-${modelName || 'default'}`;
  if (aiServicesCache.has(cacheKey)) {
    return aiServicesCache.get(cacheKey);
  }

  let client;
  const providerId = provider.toLowerCase();
  if (providerId.startsWith('gemini')) {
    client = new GeminiClient(apiKey, modelName);
  } else if (providerId === 'openai') {
    client = new OpenAIClient(apiKey, modelName);
  } else {
    throw new Error(`Provider AI non supportato: ${provider}`);
  }

  aiServicesCache.set(cacheKey, client);
  return client;
}

module.exports = { getAIService };