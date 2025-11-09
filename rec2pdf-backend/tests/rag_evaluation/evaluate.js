const pLimitModule = require("p-limit");
const pLimit = pLimitModule.default || pLimitModule;
const fs = require("node:fs/promises");
const path = require("node:path");
const dotenv = require("dotenv");
const { llmScore } = require("./evalLLMClient.js");
const { z } = require("zod");


// Carica le variabili d'ambiente dal file .env
dotenv.config();

const DATASET_PATH = path.resolve("tests/rag_evaluation/benchmark_dataset.json");
const REPORT_PATH = path.resolve("tests/rag_evaluation/report_baseline.json");
const MAX_CTX = Number(process.env.EVAL_MAX_CONTEXT_CHARS || 2000);
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY || 2);
const TIMEOUT_MS = Number(process.env.EVAL_TIMEOUT_MS || 20000);
const ENDPOINT_PATH = process.env.EVAL_RAG_ENDPOINT || "/api/rag/baseline";
const BACKEND_BASE_URL =
  process.env.EVAL_BACKEND_URL || process.env.BACKEND_URL || "http://localhost:8080";
const limit = pLimit(CONCURRENCY);

// --- Gestione Autenticazione ---
// Privilegia EVAL_AUTH_TOKEN per semplicità, ma mantiene la flessibilità.
const AUTH_HEADER_NAME = (process.env.EVAL_AUTH_HEADER_NAME || "Authorization").trim();
const AUTH_BEARER_TOKEN = (process.env.EVAL_AUTH_TOKEN || "").trim(); // <-- MODIFICA: Usiamo una variabile dedicata e chiara
const AUTH_HEADER_VALUE = (process.env.EVAL_AUTH_HEADER_VALUE || "").trim();
const COOKIE_HEADER = (process.env.EVAL_COOKIE || "").trim();

// === SCHEMA DATASET ===
const CaseSchema = z.object({
  id: z.string(),
  query: z.string(),
  gold_notes: z.string().optional(),
  expected_focus: z.string().optional(),
  workspace: z.string().optional(),
  lang: z.string().optional()
});

// === INTEGRAZIONE RAG BASELINE (VIA HTTP) ===
async function runBaselineRag(query, options = {}) {
  const backend = BACKEND_BASE_URL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const endpointUrl = new URL(ENDPOINT_PATH, backend).toString();
  let res;

  try {
    const headers = { "Content-Type": "application/json" };
    
    // <-- MODIFICA: Logica di autenticazione resa più chiara
    // La priorità è data a EVAL_AUTH_TOKEN, che costruisce l'header "Bearer".
    // Se non c'è, si usa EVAL_AUTH_HEADER_VALUE per grant più generici.
    const authValue = AUTH_BEARER_TOKEN ? `Bearer ${AUTH_BEARER_TOKEN}` : AUTH_HEADER_VALUE;
    if (authValue) {
      headers[AUTH_HEADER_NAME] = authValue;
    }
    
    if (COOKIE_HEADER) {
      headers.Cookie = COOKIE_HEADER;
    }

    // <-- MODIFICA: Passiamo il workspaceId se presente nel caso di test
    // L'endpoint /api/rag/baseline si aspetta `query` e opzionalmente `workspaceId`
    const bodyPayload = {
      query,
      workspaceId: options.workspace || null // Passa il workspace ID all'endpoint
    };

    res = await fetch(endpointUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyPayload),
      signal: controller.signal
    });
  } catch (error) {
    const connectionHint =
      error?.code === "ECONNREFUSED"
        ? "Verifica che il backend sia in esecuzione e che BACKEND_URL o EVAL_BACKEND_URL puntino all'host/porta corretti (default http://localhost:8080)."
        : "Controlla che l'endpoint di baseline RAG sia disponibile e che eventuali proxy/firewall non blocchino la richiesta.";
    const endpointHint =
      ENDPOINT_PATH === "/api/rag/baseline"
        ? "Se il tuo backend espone un percorso differente, imposta EVAL_RAG_ENDPOINT di conseguenza."
        : "";
    const hints = [connectionHint, endpointHint].filter(Boolean).join(" ");
    throw new Error(`Impossibile contattare ${endpointUrl}: ${error.message || error}. ${hints}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401) {
      const authHints = [
        AUTH_BEARER_TOKEN || AUTH_HEADER_VALUE
          ? "Verifica che il token/grant fornito in .env sia valido e non scaduto."
          : "Imposta EVAL_AUTH_TOKEN nel file .env con un token JWT valido per l'endpoint di baseline.",
        COOKIE_HEADER ? "Controlla anche eventuali cookie di sessione impostati in EVAL_COOKIE." : "",
      ].filter(Boolean).join(" ");
      throw new Error(
        `RAG baseline HTTP 401 su ${endpointUrl}. Corpo risposta: ${body.slice(0, 200) || "<vuoto>"}. ${authHints}`
      );
    }
    if (res.status === 404) {
      throw new Error(
        `Endpoint ${endpointUrl} non trovato (HTTP 404). Controlla che EVAL_RAG_ENDPOINT punti al percorso corretto del tuo backend.`
      );
    }
    throw new Error(
      `RAG baseline HTTP ${res.status} su ${endpointUrl}. Corpo risposta: ${body.slice(0, 200) || "<vuoto>"}`
    );
  }

  const data = await res.json();
  // Normalizza l'output per corrispondere alla forma { answer, context: [{id, text}] }
  return {
    answer: data.answer || "",
    context: (data.context || []).map((c, i) => ({
      id: c.id || `c_${i}`,
      text: String(c.text || c.content || "").slice(0, MAX_CTX)
    }))
  };
}

const METRICS = [
  "Context Precision",
  "Context Recall",
  "Faithfulness",
  "Answer Relevance"
];

async function evaluateOne(testCase) {
  const { id, query, gold_notes, ...opts } = testCase;
  console.log(`  -> Esecuzione caso: ${id}`);
  const { answer, context } = await runBaselineRag(query, opts);

  const scores = {};
  const scorePromises = METRICS.map(m => 
    llmScore({
      metric: m,
      query,
      answer,
      context,
      gold: gold_notes
    }).then(score => ({ metric: m, score }))
  );
  
  const results = await Promise.all(scorePromises);
  results.forEach(({ metric, score }) => {
    scores[metric] = score;
  });

  return {
    id,
    query,
    answer,
    context_size: context.length,
    retrieved_context: context, // <-- AGGIUNGI QUESTA RIGA
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
  // Validazione del dataset con Zod all'inizio
  cases.forEach((c) => CaseSchema.parse(c));

  console.log("📊 Avvio baseline RAG evaluation");
  console.log(`• Dataset: ${DATASET_PATH} (${cases.length} casi)`);
  console.log(`• Backend URL: ${BACKEND_BASE_URL}`);
  console.log(`• Endpoint: ${ENDPOINT_PATH}`);
  console.log(
    `• Autenticazione: ${AUTH_BEARER_TOKEN || AUTH_HEADER_VALUE ? `${AUTH_HEADER_NAME} impostato` : "nessuna"}`
  );
  console.log(`• Output Report: ${REPORT_PATH}`);

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

  console.log("\n✅ RAG BASELINE REPORT COMPLETATO");
  console.table(totals);
  console.log(`\n📄 Dettaglio completo salvato in: ${REPORT_PATH}`);
}

main().catch((err) => {
  // L'errore è già molto dettagliato grazie alla gestione in runBaselineRag
  console.error("\n❌ Errore durante l'esecuzione della valutazione:", err.message);
  process.exit(1);
});