const OpenAI = require('openai');

let cachedClient = null;
let cachedApiKey = '';
let hasWarnedMissingKey = false;

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (!hasWarnedMissingKey) {
      console.warn('⚠️  OPENAI_API_KEY non configurata: funzioni basate su OpenAI verranno disabilitate.');
      hasWarnedMissingKey = true;
    }
    return null;
  }

  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedClient = new OpenAI({ apiKey });
    cachedApiKey = apiKey;
  }

  return cachedClient;
};

module.exports = {
  getOpenAIClient,
};
