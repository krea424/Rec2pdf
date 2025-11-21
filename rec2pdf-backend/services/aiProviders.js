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
  // 1. IL DEFAULT INTELLIGENTE (Quello attuale)
  {
    id: 'gemini', // ID storico per retrocompatibilità
    label: 'Google Gemini (Auto - Recommended)',
    envKey: 'GOOGLE_API_KEY',
    description: 'Routing intelligente: Flash per analisi, Pro per scrittura.',
    models: {
      'text-low': MODELS.GEMINI_FLASH, // Task leggeri
      'text-high': MODELS.GEMINI_PRO,  // Task pesanti (generazione finale)
      'embedding': MODELS.EMBEDDING_GEMINI,
    },
  },
  // 2. FORZATURA FLASH (Utile per DEV o risparmio)
  {
    id: 'gemini-flash',
    label: 'Google Gemini Flash (Force Speed)',
    envKey: 'GOOGLE_API_KEY',
    description: 'Usa SEMPRE Gemini Flash. Veloce ed economico.',
    models: {
      'text-low': MODELS.GEMINI_FLASH,
      'text-high': MODELS.GEMINI_FLASH, // <--- FORZATURA QUI
      'embedding': MODELS.EMBEDDING_GEMINI,
    },
  },
  // 3. FORZATURA PRO (Utile per massima qualità)
  {
    id: 'gemini-pro',
    label: 'Google Gemini Pro (Force Quality)',
    envKey: 'GOOGLE_API_KEY',
    description: 'Usa SEMPRE Gemini Pro. Massima qualità, più lento.',
    models: {
      'text-low': MODELS.GEMINI_PRO, // <--- FORZATURA QUI
      'text-high': MODELS.GEMINI_PRO,
      'embedding': MODELS.EMBEDDING_GEMINI,
    },
  },
  // 4. OPENAI (Fallback o alternativa)
  {
    id: 'openai',
    label: 'OpenAI (GPT-4o)',
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
  
  // Se la var d'ambiente punta a un ID valido, usalo.
  if (normalizedEnv && PROVIDER_MAP.has(normalizedEnv)) {
    return normalizedEnv;
  }
  // Default solido su Gemini Auto
  return 'gemini'; 
};

const listProviders = () =>
  PROVIDERS.map((provider) => ({
    id: provider.id,
    label: provider.label,
    description: provider.description,
    envKey: provider.envKey, // Il frontend può usare questo per mostrare se è configurato
    configured: Boolean(process.env[provider.envKey]),
    capabilities: ['text', 'embedding'],
    // Non esponiamo 'models' al frontend per non confondere, basta l'ID
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