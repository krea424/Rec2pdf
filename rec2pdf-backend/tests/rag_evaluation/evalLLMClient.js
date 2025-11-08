const dotenv = require("dotenv");
dotenv.config();

let openai = null;
let genAI = null;

const provider = (process.env.EVAL_LLM_PROVIDER || "mock").toLowerCase();
const modelName = process.env.EVAL_MODEL_NAME || "gemini-2.5-flash";

async function initClients() {
  if (provider === "openai") {
    const { OpenAI } = await import("openai");
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } else if (provider === "gemini") {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  }
}

const clientsReady = initClients();

const METRIC_RUBRICS = {
  "Context Precision": "Quanto del CONTENUTO nel CONTEXT è davvero pertinente alla RISPOSTA? (poco rumore = punteggio alto)",
  "Context Recall": "Il CONTEXT contiene TUTTE le parti utili per rispondere alla QUERY? (mancanze = punteggio basso)",
  "Faithfulness": "La RISPOSTA è supportata dal CONTEXT senza invenzioni/allucinazioni?",
  "Answer Relevance": "La RISPOSTA risponde alla QUERY in modo diretto e completo?"
};

function buildPrompt({ metric, query, answer, context, gold }) {
  const rubric = METRIC_RUBRICS[metric];
  const ctx = (context || []).map(c => c.text || "").join("\n---\n");
  return `METRICA: ${metric}
RUBRICA: ${rubric}
QUERY: ${query}
GOLD_HINT: ${gold || ""}
ANSWER: ${answer}
CONTEXT_SNIPPETS:
${ctx}

Restituisci SOLO un numero tra 0 e 1 (decimale con punto).`;
}

async function callModel(prompt) {
  if (provider === "mock") {
    // baseline veloce/offline
    return 0.6;
  }
  if (provider === "openai") {
    const res = await openai.chat.completions.create({
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      temperature: 0
    });
    return parseFloat((res.choices?.[0]?.message?.content || "0.5").trim());
  }
  if (provider === "gemini") {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return parseFloat(text);
  }
  return 0.5;
}

async function llmScore({ metric, query, answer, context, gold }) {
  await clientsReady;
  const prompt = buildPrompt({ metric, query, answer, context, gold });
  const val = await callModel(prompt);
  // clamp
  if (Number.isFinite(val)) {
    return Math.max(0, Math.min(1, val));
  }
  return 0.5;
}

module.exports = { llmScore };
