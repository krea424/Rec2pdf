const fs = require("node:fs/promises");
const path = require("node:path");
const dotenv = require("dotenv");
const { llmScore } = require("./evalLLMClient.js");
const { z } = require("zod");
const pLimit = require("p-limit");

dotenv.config();

const DATASET_PATH = path.resolve("tests/rag_evaluation/benchmark_dataset.json");
const REPORT_PATH = path.resolve("tests/rag_evaluation/report_baseline.json");
const MAX_CTX = Number(process.env.EVAL_MAX_CONTEXT_CHARS || 2000);
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY || 2);
const TIMEOUT_MS = Number(process.env.EVAL_TIMEOUT_MS || 20000);
const ENDPOINT_PATH = process.env.EVAL_RAG_ENDPOINT || "/api/rag/baseline";
const limit = pLimit(CONCURRENCY);

// === SCHEMA DATASET ===
const CaseSchema = z.object({
  id: z.string(),
  query: z.string(),
  gold_notes: z.string().optional(),
  expected_focus: z.string().optional(),
  workspace: z.string().optional(),
  lang: z.string().optional()
});

// === INTEGRA QUI IL TUO RAG BASELINE ===
// Opzione A: HTTP verso il backend esistente
async function runBaselineRag(query, options = {}) {
  const backend = process.env.BACKEND_URL || "http://localhost:3001";
  // Adatta URL/shape a quello che hai già
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const endpointUrl = new URL(ENDPOINT_PATH, backend).toString();
  let res;
  try {
    res = await fetch(endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, ...options }),
      signal: controller.signal
    });
  } catch (error) {
    const hint = error?.code === "ECONNREFUSED"
      ? "Verifica che il backend sia in esecuzione e che BACKEND_URL punti all'host/porta corretti."
      : "Controlla che l'endpoint di baseline RAG sia disponibile e che eventuali proxy/firewall non blocchino la richiesta.";
    throw new Error(`Impossibile contattare ${endpointUrl}: ${error.message || error}. ${hint}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `RAG baseline HTTP ${res.status} su ${endpointUrl}. Corpo risposta: ${body.slice(0, 200) || "<vuoto>"}`
    );
  }
  const data = await res.json();
  // Normalizza: { answer, context: [{id, text}] }
  return {
    answer: data.answer || "",
    context: (data.context || []).map((c, i) => ({
      id: c.id || `c_${i}`,
      text: String(c.text || c.content || "").slice(0, MAX_CTX)
    }))
  };
}

// (In alternativa) Opzione B: import diretto dal tuo servizio Node
// const { runBaselineRag: runRagLocal } = require("../../services/ragService.js");

const METRICS = [
  "Context Precision",
  "Context Recall",
  "Faithfulness",
  "Answer Relevance"
];

async function evaluateOne(testCase) {
  const { id, query, gold_notes, ...opts } = testCase;
  const { answer, context } = await runBaselineRag(query, opts);

  const scores = {};
  for (const m of METRICS) {
    scores[m] = await llmScore({
      metric: m,
      query,
      answer,
      context,
      gold: gold_notes
    });
  }

  return {
    id,
    query,
    answer,
    context_size: context.length,
    ...scores
  };
}

function avg(rows, key) {
  return Number(
    (rows.reduce((s, r) => s + Number(r[key] || 0), 0) / rows.length).toFixed(3)
  );
}

async function main() {
  const raw = await fs.readFile(DATASET_PATH, "utf8");
  const cases = JSON.parse(raw);
  // Validazione
  cases.forEach((c) => CaseSchema.parse(c));

  console.log("📊 Avvio baseline RAG evaluation");
  console.log(`• Dataset: ${DATASET_PATH}`);
  console.log(`• Endpoint: ${ENDPOINT_PATH}`);
  console.log(`• Output atteso: ${REPORT_PATH}`);

  const rows = await Promise.all(
    cases.map((c) => limit(() => evaluateOne(c)))
  );

  const totals = {
    count: rows.length,
    "Context Precision": avg(rows, "Context Precision"),
    "Context Recall": avg(rows, "Context Recall"),
    "Faithfulness": avg(rows, "Faithfulness"),
    "Answer Relevance": avg(rows, "Answer Relevance")
  };

  await fs.writeFile(
    REPORT_PATH,
    JSON.stringify({ totals, rows }, null, 2),
    "utf8"
  );

  console.log("\nRAG BASELINE REPORT");
  console.table(totals);
  console.log(`\nDettaglio: ${REPORT_PATH}`);
}

main().catch((err) => {
  console.error("Eval error:", err);
  process.exit(1);
});
