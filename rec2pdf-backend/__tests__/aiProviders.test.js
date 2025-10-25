const { GeminiClient, getAIService } = require('../services/aiService');
const { getDefaultProviderMap, resolveProvider } = require('../services/aiProviders');

describe('AI provider defaults', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
  });

  it('returns gemini for text and openai for embedding when env vars are unset', () => {
    delete process.env.AI_TEXT_PROVIDER;
    delete process.env.AI_EMBEDDING_PROVIDER;
    const defaults = getDefaultProviderMap();
    expect(defaults).toEqual({ text: 'gemini', embedding: 'openai' });
  });

  it('resolves gemini text model to gemini-2.5-flash', () => {
    process.env.GOOGLE_API_KEY = 'test';
    process.env.OPENAI_API_KEY = 'test';
    delete process.env.AI_TEXT_PROVIDER;
    const provider = resolveProvider('text');
    expect(provider).toMatchObject({ id: 'gemini', model: 'gemini-2.5-flash' });
  });

  it('keeps explicit gemini-pro override untouched', () => {
    process.env.GOOGLE_API_KEY = 'test';
    process.env.OPENAI_API_KEY = 'test';
    process.env.AI_TEXT_PROVIDER = 'gemini-pro';
    const provider = resolveProvider('text');
    expect(provider).toMatchObject({ id: 'gemini-pro', model: 'gemini-2.5-pro' });
  });
});

describe('Gemini client model fallback', () => {
  it('uses gemini-2.5-flash when model name is empty', () => {
    const client = new GeminiClient('key', '   ');
    expect(client.modelName).toBe('gemini-2.5-flash');
  });

  it('allows overriding the model when provided', () => {
    const client = getAIService('gemini-pro', 'key', 'gemini-2.5-pro');
    expect(client.modelName).toBe('gemini-2.5-pro');
  });
});

describe('Gemini client API key handling', () => {
  const buildApiKeyError = () => {
    const error = new Error('API Key not found.');
    error.errorDetails = [{ reason: 'API_KEY_INVALID' }];
    return error;
  };

  it('falls back to gemini-2.5-flash when the pro model rejects with API_KEY_INVALID', async () => {
    const client = new GeminiClient('key', 'gemini-2.5-pro');
    const apiKeyError = buildApiKeyError();
    const proModel = {
      generateContent: jest.fn(() => Promise.reject(apiKeyError)),
    };
    const flashModel = {
      generateContent: jest.fn(() =>
        Promise.resolve({
          response: Promise.resolve({ text: () => 'flash output' }),
        })
      ),
    };

    client.genAI = {
      getGenerativeModel: jest.fn(({ model }) => {
        if (model === 'gemini-2.5-pro') {
          return proModel;
        }
        if (model === 'gemini-2.5-flash') {
          return flashModel;
        }
        throw new Error(`Unexpected model ${model}`);
      }),
    };

    const result = await client.generateContent('prompt');
    expect(result).toBe('flash output');
    expect(client.modelName).toBe('gemini-2.5-flash');
    expect(client.genAI.getGenerativeModel).toHaveBeenCalledTimes(2);
  });

  it('propagates a descriptive error when the API key is invalid for all Gemini models', async () => {
    expect.assertions(5);
    const client = new GeminiClient('key', 'gemini-2.5-pro');
    const apiKeyError = buildApiKeyError();
    const proModel = {
      generateContent: jest.fn(() => Promise.reject(apiKeyError)),
    };
    const flashModel = {
      generateContent: jest.fn(() => Promise.reject(apiKeyError)),
    };

    client.genAI = {
      getGenerativeModel: jest.fn(({ model }) => {
        if (model === 'gemini-2.5-pro') {
          return proModel;
        }
        if (model === 'gemini-2.5-flash') {
          return flashModel;
        }
        throw new Error(`Unexpected model ${model}`);
      }),
    };

    try {
      await client.generateContent('prompt');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('Gemini API key non valida');
      expect(error.code).toBe('GOOGLE_API_KEY_INVALID');
      expect(error.cause).toBe(apiKeyError);
      expect(client.genAI.getGenerativeModel).toHaveBeenCalledTimes(2);
    }
  });
});
