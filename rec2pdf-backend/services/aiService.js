'use strict';

const OpenAI = require('openai');

const loadGeminiSdk = (() => {
  let cachedPromise = null;
  return () => {
    if (!cachedPromise) {
      cachedPromise = import('@google/generative-ai')
        .then((module) => {
          if (!module?.GoogleGenerativeAI) {
            throw new Error('Modulo @google/generative-ai non valido.');
          }
          return module.GoogleGenerativeAI;
        })
        .catch((error) => {
          const hint =
            "Impossibile caricare l'SDK Gemini. Assicurati di aver eseguito `npm install` nel backend per installare @google/generative-ai.";
          error.message = `${hint}\nDettagli originali: ${error.message}`;
          throw error;
        });
    }
    return cachedPromise;
  };
})();

class AIService {
  async generateContent() {
    throw new Error('Metodo generateContent non implementato');
  }

  async generateEmbedding() {
    throw new Error('Metodo generateEmbedding non implementato');
  }
}

class GeminiClient extends AIService {
  constructor(apiKey) {
    super();
    if (!apiKey) {
      throw new Error('Gemini API key non configurata');
    }
    this.apiKey = apiKey;
    this._clientPromise = null;
    this._textModelPromise = null;
    this._embeddingModelPromise = null;
  }

  async _ensureClient() {
    if (!this._clientPromise) {
      this._clientPromise = loadGeminiSdk().then((GoogleGenerativeAI) => new GoogleGenerativeAI(this.apiKey));
    }
    return this._clientPromise;
  }

  async _getTextModel() {
    if (!this._textModelPromise) {
      this._textModelPromise = this._ensureClient().then((client) => client.getGenerativeModel({ model: 'gemini-pro' }));
    }
    return this._textModelPromise;
  }

  async _getEmbeddingModel() {
    if (!this._embeddingModelPromise) {
      this._embeddingModelPromise = this._ensureClient().then((client) => client.getGenerativeModel({ model: 'embedding-001' }));
    }
    return this._embeddingModelPromise;
  }

  async generateContent(prompt) {
    const normalized = typeof prompt === 'string' ? prompt.trim() : '';
    if (!normalized) {
      return '';
    }

    const model = await this._getTextModel();
    const result = await model.generateContent(normalized);
    const text = typeof result?.response?.text === 'function' ? result.response.text() : '';
    return typeof text === 'string' ? text.trim() : '';
  }

  async generateEmbedding(input) {
    if (Array.isArray(input)) {
      const embeddings = [];
      for (const item of input) {
        const vector = await this.generateEmbedding(item);
        embeddings.push(Array.isArray(vector) ? vector : []);
      }
      return embeddings;
    }

    const normalized = typeof input === 'string' ? input.trim() : '';
    if (!normalized) {
      return [];
    }

    const model = await this._getEmbeddingModel();
    const response = await model.embedContent({
      content: { parts: [{ text: normalized }] },
    });
    const values = Array.isArray(response?.embedding?.values) ? response.embedding.values : [];
    return values;
  }
}

class OpenAIClient extends AIService {
  constructor(apiKey) {
    super();
    if (!apiKey) {
      throw new Error('OpenAI API key non configurata');
    }
    this.client = new OpenAI({ apiKey });
  }

  async generateContent(prompt) {
    const normalized = typeof prompt === 'string' ? prompt.trim() : '';
    if (!normalized) {
      return '';
    }

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: normalized }],
    });

    const text = response?.choices?.[0]?.message?.content;
    return typeof text === 'string' ? text.trim() : '';
  }

  async generateEmbedding(input) {
    if (Array.isArray(input)) {
      const sanitized = input.map((item) => (typeof item === 'string' ? item.trim() : ''));
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: sanitized,
      });
      const vectors = Array.isArray(response?.data) ? response.data.map((entry) => entry?.embedding || []) : [];
      return vectors;
    }

    const normalized = typeof input === 'string' ? input.trim() : '';
    if (!normalized) {
      return [];
    }

    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: normalized,
    });
    const vector = response?.data?.[0]?.embedding;
    return Array.isArray(vector) ? vector : [];
  }
}

const getAIService = (provider, apiKey) => {
  const normalized = typeof provider === 'string' ? provider.trim().toLowerCase() : '';
  switch (normalized) {
    case 'gemini':
      return new GeminiClient(apiKey);
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
