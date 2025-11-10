const fs = require("node:fs/promises");
const path = require("node:path");
const dotenv = require("dotenv");
const { llmScore } = require("./evalLLMClient.js"); // Import statico, ora funzionante
const { z } = require("zod");
const pLimitModule = require("p-limit");
const pLimit = pLimitModule.default || pLimitModule;

dotenv.config();

const DATASET_PATH = path.resolve("tests/rag_evaluation/benchmark_dataset.json");
const REPORT_PATH = path.resolve("tests/rag_evaluation/report_baseline.json");
const MAX_CTX = Number(process.env.EVAL_MAX_CONTEXT_CHARS || 4000);
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY || 2);
const TIMEOUT_MS = Number(process.env.EVAL_TIMEOUT_MS || 120000);
const ENDPOINT_PATH = process.env.EVAL_RAG_ENDPOINT || "/api/rag/baseline";
const BACKEND_BASE_URL = process.env.BACKEND_URL || "http://localhost:8080";
const limit = pLimit(CONCURRENCY);

const AUTH_HEADER_NAME = (process.env.EVAL_AUTH_HEADER_NAME || "Authorization").trim();
const AUTH_BEARER_TOKEN = (process.env.EVAL_AUTH_TOKEN || "").trim();

const CaseSchema = z.object({
  id: z.string(),
  scenario: z.string(),
  raw_text_input: z.string(),
  gold_facts_to_retrieve: z.array(z.string()),
  workspace: z.string(),
});

async function runRagPipeline(rawTextInput, options = {}) {
  const backend = BACKEND_BASE_URL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const endpointUrl = new URL(ENDPOINT_PATH, backend).toString();
  let res;

  try {
    const headers = { "Content-Type": "application/json" };
    if (AUTH_BEARER_TOKEN) {
      headers[AUTH_HEADER_NAME] = `Bearer ${AUTH_BEARER_TOKEN}`;
    }
    const bodyPayload = { query: rawTextInput, workspaceId: options.workspace || null };
    res = await fetch(endpointUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyPayload),
      signal: controller.signal
    });
  } catch (error) {
    throw new Error(`Impossibile contattare ${endpointUrl}: ${error.message || error}.`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Chiamata RAG fallita (HTTP ${res.status}) su ${endpointUrl}. Corpo risposta: ${body.slice(0, 200) || "<vuoto>"}`);
  }

  const data = await res.json();
  return {
    answer: data.answer || "",
    context: (data.context || []).map((c, i) => ({
      id: c.id || `c_${i}`,
      text: String(c.text || c.content || "").slice(0, MAX_CTX)
    }))
  };
}

const METRICS = ["Context Recall", "Faithfulness", "Answer Relevance"];

async function evaluateOne(testCase) {
  const { id, raw_text_input, workspace, gold_facts_to_retrieve, scenario } = testCase;
  console.log(`  -> Esecuzione caso: ${id}`);
  
  const { answer: final_answer, context } = await runRagPipeline(raw_text_input, { workspace });

  const scores = {};
  const scorePromises = METRICS.map(m => 
    llmScore({
      metric: m,
      scenario: scenario,
      raw_input: raw_text_input,
      final_answer: final_answer,
      context: context,
      gold_facts: gold_facts_to_retrieve
    }).then(score => ({ metric: m, score }))
  );
  
  const results = await Promise.all(scorePromises);
  results.forEach(({ metric, score }) => {
    scores[metric] = score;
  });

  return {
    id,
    final_answer_preview: final_answer.substring(0, 200) + (final_answer.length > 200 ? "..." : ""),
    context_size: context.length,
    retrieved_context: context,
    ...scores
  };
}

function avg(rows, key) {
  if (rows.length === 0) return 0;
  return Number(
    (rows.reduce((s, r) => s + Number(r[key] || 0), 0) / rows.length).toFixed(3)
  );
}

async function main() {
  const raw = await fs.readFile(DATASET_PATH, "utf8");
  const cases = JSON.parse(raw);
  cases.forEach((c) => CaseSchema.parse(c));

  console.log("📊 Avvio valutazione RAG (paradigma: Content Enrichment)");
  console.log(`• Dataset: ${DATASET_PATH} (${cases.length} casi)`);
  console.log(`• Backend URL: ${BACKEND_BASE_URL}`);
  console.log(`• Endpoint: ${ENDPOINT_PATH}`);
  console.log(`• Autenticazione: ${AUTH_BEARER_TOKEN ? `${AUTH_HEADER_NAME} impostato` : "nessuna"}`);
  console.log(`• Output Report: ${REPORT_PATH}`);

  const rows = await Promise.all(
    cases.map((c) => limit(() => evaluateOne(c)))
  );

  const totals = {
    count: rows.length,
    "Context Recall": avg(rows, "Context Recall"),
    "Faithfulness": avg(rows, "Faithfulness"),
    "Answer Relevance": avg(rows, "Answer Relevance")
  };

  await fs.writeFile(
    REPORT_PATH,
    JSON.stringify({ totals, rows }, null, 2),
    "utf8"
  );

  console.log("\n✅ REPORT DI VALUTAZIONE RAG COMPLETATO");
  console.table(totals);
  console.log(`\n📄 Dettaglio completo salvato in: ${REPORT_PATH}`);
}

main().catch((err) => {
  console.error("\n❌ Errore durante l'esecuzione della valutazione:", err.message);
  process.exit(1);
});