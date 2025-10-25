'use strict';

const PROVIDERS = [
  {
    id: 'gemini',
    label: 'Google Gemini Flash',
    envKey: 'GEMINI_API_KEY',
    description: 'Veloce ed economico (1.500/giorno FREE)',
    models: {
      text: 'gemini-2.5-flash',
      embedding: 'text-embedding-004',
    },
  },
  {
    id: 'gemini-pro',
    label: 'Google Gemini Pro',
    envKey: 'GEMINI_API_KEY',
    description: 'Massima qualità con thinking mode (50/giorno FREE)',
    models: {
      text: 'gemini-2.5-pro',
      embedding: 'text-embedding-004',
    },
  },
  {
    id: 'openai',
    label: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    description: 'Modelli GPT e embedding di OpenAI',
    models: {
      text: 'gpt-4o',
      embedding: 'text-embedding-3-small',
    },
  },
];

const PROVIDER_MAP = new Map(PROVIDERS.map((provider) => [provider.id, provider]));

const sanitizeProviderInput = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  return trimmed;
};

const getDefaultProviderId = (type) => {
  const envVar = type === 'embedding' ? process.env.AI_EMBEDDING_PROVIDER : process.env.AI_TEXT_PROVIDER;
  const normalizedEnv = sanitizeProviderInput(envVar);
  if (normalizedEnv && PROVIDER_MAP.has(normalizedEnv)) {
    const candidate = PROVIDER_MAP.get(normalizedEnv);
    if (!type || !candidate.models || candidate.models[type]) {
      return candidate.id;
    }
  }

  const fallback = type === 'embedding' ? 'openai' : 'gemini';
  if (PROVIDER_MAP.has(fallback)) {
    const candidate = PROVIDER_MAP.get(fallback);
    if (!type || !candidate.models || candidate.models[type]) {
      return candidate.id;
    }
  }

  for (const provider of PROVIDERS) {
    if (!type) {
      return provider.id;
    }
    if (!provider.models || provider.models[type]) {
      return provider.id;
    }
  }

  return '';
};

const listProviders = () =>
  PROVIDERS.map((provider) => ({
    id: provider.id,
    label: provider.label,
    description: provider.description,
    envKey: provider.envKey,
    configured: Boolean(process.env[provider.envKey]),
    capabilities: Object.keys(provider.models || {}),
    models: { ...provider.models },
  }));

const getDefaultProviderMap = () => ({
  text: getDefaultProviderId('text'),
  embedding: getDefaultProviderId('embedding'),
});

const resolveProvider = (type, override) => {
  const normalizedOverride = sanitizeProviderInput(override);
  const providerId = normalizedOverride || getDefaultProviderId(type);
  if (!providerId) {
    throw new Error('Nessun provider AI configurato');
  }

  const provider = PROVIDER_MAP.get(providerId);
  if (!provider) {
    throw new Error(`Provider AI non supportato: ${override || providerId}`);
  }

  if (type && provider.models && !provider.models[type]) {
    throw new Error(`Il provider ${provider.label} non supporta ${type === 'embedding' ? 'gli embedding' : 'la generazione testo'}`);
  }

  const apiKey = process.env[provider.envKey];
  if (!apiKey) {
    throw new Error(`Chiave API non configurata per ${provider.label} (${provider.envKey})`);
  }

  const model = provider.models ? provider.models[type] || '' : '';

  return {
    id: provider.id,
    label: provider.label,
    apiKey,
    envKey: provider.envKey,
    model,
  };
};

module.exports = {
  listProviders,
  resolveProvider,
  getDefaultProviderMap,
  sanitizeProviderInput,
};