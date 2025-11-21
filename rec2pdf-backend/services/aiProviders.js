'use strict';

// Costanti aggiornate alla timeline corrente (Nov 2025)
const MODELS = {
  GEMINI_FLASH: 'gemini-2.5-flash', // Tier 1: Veloce ed economico
  GEMINI_PRO: 'gemini-2.5-pro',     // Tier 2: Massima qualità (Thinking Mode)
  OPENAI_MINI: 'gpt-4o-mini',       // Fallback veloce
  OPENAI_FULL: 'gpt-4o',            // Fallback qualità
  EMBEDDING_GEMINI: 'text-embedding-004',
  EMBEDDING_OPENAI: 'text-embedding-3-small'
};

const PROVIDERS = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    envKey: 'GOOGLE_API_KEY',
    description: 'Provider Google con routing automatico',
    models: {
      'text-low': 'gemini-2.5-flash', // Usato se taskComplexity è 'low' o mancante
      'text-high': 'gemini-2.5-pro',  // Usato se taskComplexity è 'high'
      'embedding': 'text-embedding-004',
    },
  },
  {
    id: 'openai',
    label: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    description: 'Fallback automatico: GPT-4o Mini / GPT-4o',
    models: {
      'text-low': MODELS.OPENAI_MINI,
      'text-high': MODELS.OPENAI_FULL,
      'embedding': MODELS.EMBEDDING_OPENAI,
    },
  },
];

const PROVIDER_MAP = new Map(PROVIDERS.map((provider) => [provider.id, provider]));

const sanitizeProviderInput = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

const getDefaultProviderId = (type) => {
  const envVar = type === 'embedding' ? process.env.AI_EMBEDDING_PROVIDER : process.env.AI_TEXT_PROVIDER;
  const normalizedEnv = sanitizeProviderInput(envVar);
  
  if (normalizedEnv && PROVIDER_MAP.has(normalizedEnv)) {
    return normalizedEnv;
  }
  return 'gemini'; // Default solido su Gemini
};

const listProviders = () =>
  PROVIDERS.map((provider) => ({
    id: provider.id,
    label: provider.label,
    description: provider.description,
    envKey: provider.envKey,
    configured: Boolean(process.env[provider.envKey]),
    capabilities: ['text', 'embedding'],
    models: { ...provider.models },
  }));

const getDefaultProviderMap = () => ({
  text: getDefaultProviderId('text'),
  embedding: getDefaultProviderId('embedding'),
});

const resolveProvider = (type, override, taskComplexity = 'low') => {
  const normalizedOverride = sanitizeProviderInput(override);
  const providerId = normalizedOverride || getDefaultProviderId(type);

  if (!providerId) throw new Error('Nessun provider AI configurato');

  const provider = PROVIDER_MAP.get(providerId);
  if (!provider) throw new Error(`Provider AI non supportato: ${override || providerId}`);

  const apiKey = process.env[provider.envKey];
  if (!apiKey) throw new Error(`Chiave API non configurata per ${provider.label}`);

  // Logica di routing del modello
  let modelKey = type;
  if (type === 'text') {
    modelKey = taskComplexity === 'high' ? 'text-high' : 'text-low';
  }

  const model = provider.models ? provider.models[modelKey] || '' : '';

  if (!model) {
     // Fallback di sicurezza
     if (type === 'text') return provider.models['text-low'] || '';
     throw new Error(`Modello non trovato per ${provider.label} (tipo: ${type})`);
  }

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