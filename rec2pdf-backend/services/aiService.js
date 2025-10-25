'use strict';

const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
  async generateContent(prompt) { throw new Error('Metodo non implementato'); }
  async generateEmbedding(input) { throw new Error('Metodo non implementato'); }
}

class GeminiClient extends AIService {
  constructor(apiKey, modelName = 'gemini-2.5-flash') {
    super();
    if (!apiKey) throw new Error('Gemini API key non configurata');
    this.genAI = new GoogleGenerativeAI(apiKey);
    const normalizedModel = typeof modelName === 'string' ? modelName.trim() : '';
    this.modelName = normalizedModel || 'gemini-2.5-flash';
  }

  async generateContent(prompt) {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
  
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error(`❌ Errore GeminiClient (${this.modelName}):`, error);
      throw error;
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
      console.error("❌ Errore GeminiClient generateEmbedding:", error);
      throw error;
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
      const fallbackModel = normalized === 'gemini-pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
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