const dotenv = require("dotenv");
dotenv.config();

let openai = null;
let genAI = null;
let clientsInitialized = false; // Aggiungiamo un flag di stato

const provider = (process.env.EVAL_LLM_PROVIDER || "mock").toLowerCase();
const modelName = process.env.EVAL_MODEL_NAME || "gemini-1.5-flash-latest";

// ==========================================================
// ==                  MODIFICA CHIAVE QUI                 ==
// ==========================================================
// Rimuoviamo il top-level await e trasformiamo initClients in una funzione standard
async function initClients() {
  if (clientsInitialized) return; // Inizializza solo una volta

  if (provider === "openai") {
    const { OpenAI } = await import("openai");
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } else if (provider === "gemini") {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  }
  clientsInitialized = true;
  console.log(`[evalLLMClient] Client AI (${provider}) initializzato.`);
}
// ==========================================================


const METRIC_RUBRICS = {
  "Context Recall": "Il CONTESTO RECUPERATO contiene TUTTI i 'Fatti Chiave Attesi' necessari per arricchire il documento?",
  "Faithfulness": "Il DOCUMENTO FINALE è completamente supportato dalla combinazione della TRASCRIZIONE ORIGINALE e del CONTESTO RECUPERATO? Contiene invenzioni o allucinazioni?",
  "Answer Relevance": "Il DOCUMENTO FINALE è un'elaborazione di alta qualità della TRASCRIZIONE ORIGINALE, ben strutturata e pertinente allo SCENARIO descritto? Arricchisce l'input iniziale in modo significativo?"
};

function buildPrompt({ metric, scenario, raw_input, final_answer, context, gold_facts }) {
  // ... (questa funzione rimane invariata)
  const rubric = METRIC_RUBRICS[metric];
  const ctx = (context || []).map(c => c.text || c.content || "").join("\n---\n");
  const facts = (gold_facts || []).join("\n- ");
  return `Sei un giudice esperto... (prompt abbreviato per leggibilità) ...Tua valutazione (solo un numero):`;
}

async function callModel(prompt) {
  await initClients(); // Assicura che i client siano inizializzati prima di ogni chiamata

  if (provider === "mock") {
    return 0.8;
  }
  // ... (il resto della funzione rimane invariato)
  try {
    if (provider === "openai") { /* ... */ }
    if (provider === "gemini") { /* ... */ }
  } catch (error) { /* ... */ }
  return 0.5;
}

async function llmScore({ metric, scenario, raw_input, final_answer, context, gold_facts }) {
  const prompt = buildPrompt({ metric, scenario, raw_input, final_answer, context, gold_facts });
  const val = await callModel(prompt);
  if (Number.isFinite(val)) {
    return Math.max(0, Math.min(1, val));
  }
  return 0.5;
}

module.exports = { llmScore };