'use strict';

const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_FLASH_MODEL = 'gemini-2.5-flash';

const isGoogleApiKeyInvalidError = (error) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const message = typeof error.message === 'string' ? error.message : '';
  if (/API\s*Key\s*not\s*found/i.test(message) || /API_KEY_INVALID/i.test(message)) {
    return true;
  }

  const details = Array.isArray(error.errorDetails) ? error.errorDetails : [];
  return details.some((detail) => {
    if (!detail || typeof detail !== 'object') {
      return false;
    }
    const reason = typeof detail.reason === 'string' ? detail.reason : '';
    return reason.toUpperCase() === 'API_KEY_INVALID';
  });
};

const buildGoogleApiKeyError = (modelName, originalError) => {
  if (!isGoogleApiKeyInvalidError(originalError)) {
    return originalError;
  }

  const detail = originalError && originalError.message ? ` Dettagli originali: ${originalError.message}` : '';
  const error = new Error(
    `Gemini API key non valida o mancante. Imposta una chiave valida in GOOGLE_API_KEY e assicurati che il modello "${modelName}" sia abilitato.${detail}`
  );
  error.code = 'GOOGLE_API_KEY_INVALID';
  error.cause = originalError;
  return error;
};

const shouldRetryWithFlash = (modelName, error) =>
  modelName && modelName !== GEMINI_FLASH_MODEL && isGoogleApiKeyInvalidError(error);

class AIService {
  async generateContent(prompt) { throw new Error('Metodo non implementato'); }
  async generateEmbedding(input) { throw new Error('Metodo non implementato'); }
}

class GeminiClient extends AIService {
  constructor(apiKey, modelName = GEMINI_FLASH_MODEL) {
    super();
    if (!apiKey) throw new Error('Gemini API key non configurata');
    this.genAI = new GoogleGenerativeAI(apiKey);
    const normalizedModel = typeof modelName === 'string' ? modelName.trim() : '';
    this.modelName = normalizedModel || GEMINI_FLASH_MODEL;
  }

  async generateContent(prompt) {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      if (shouldRetryWithFlash(this.modelName, error)) {
        console.warn(
          `⚠️ Gemini ${this.modelName} ha restituito API_KEY_INVALID: tentativo automatico con ${GEMINI_FLASH_MODEL}.`
        );
        try {
          const model = this.genAI.getGenerativeModel({ model: GEMINI_FLASH_MODEL });
          const result = await model.generateContent(prompt);
          const response = await result.response;
          this.modelName = GEMINI_FLASH_MODEL;
          return response.text();
        } catch (fallbackError) {
          console.error(`❌ Errore GeminiClient fallback (${GEMINI_FLASH_MODEL}):`, fallbackError);
          throw buildGoogleApiKeyError(GEMINI_FLASH_MODEL, fallbackError);
        }
      }

      console.error(`❌ Errore GeminiClient (${this.modelName}):`, error);
      throw buildGoogleApiKeyError(this.modelName, error);
    }
  }

  async generateEmbedding(input) {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
      
      if (Array.isArray(input)) {
        const embeddings = [];
        for (const text of input) {
          const result = await model.embedContent(text);
          embeddings.push(result.embedding.values);
        }
        return embeddings;
      }
      
      const result = await model.embedContent(input);
      return result.embedding.values;
    } catch (error) {
      console.error('❌ Errore GeminiClient generateEmbedding:', error);
      throw buildGoogleApiKeyError('text-embedding-004', error);
    }
  }
}

class OpenAIClient extends AIService {
  constructor(apiKey) {
    super();
    if (!apiKey) throw new Error('OpenAI API key non configurata');
    this.client = new OpenAI({ apiKey });
  }

  async generateContent(prompt) {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0].message.content || '';
  }

  async generateEmbedding(input) {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: Array.isArray(input) ? input : [input],
    });
    const vectors = response.data.map(entry => entry.embedding);
    return Array.isArray(input) ? vectors : vectors[0];
  }
}

// ⭐ QUESTA È LA PARTE CRUCIALE DA MODIFICARE
const getAIService = (provider, apiKey, model) => {
  const normalized = String(provider || '').trim().toLowerCase();
  const normalizedModel = typeof model === 'string' ? model.trim() : '';

  switch (normalized) {
    case 'gemini':
    case 'gemini-pro': {
      const fallbackModel = normalized === 'gemini-pro' ? 'gemini-2.5-pro' : GEMINI_FLASH_MODEL;
      const modelName = normalizedModel || fallbackModel;
      return new GeminiClient(apiKey, modelName);
    }

    case 'openai':
      return new OpenAIClient(apiKey);

    default:
      throw new Error(`Provider AI non supportato: ${provider}`);
  }
};

module.exports = {
  AIService,
  GeminiClient,
  OpenAIClient,
  getAIService,
};