# RAG Baseline Evaluation (Path A, JS-only)

## Cos'è
Valuta il RAG attuale (baseline) con 4 metriche: Context Precision, Context Recall, Faithfulness, Answer Relevance. L'LLM fa da "giudice".

## Requisiti
- Node 18+
- `.env` con BACKEND_URL (porta di default 8080) e provider LLM:
  - EVAL_LLM_PROVIDER=gemini|openai|mock
  - EVAL_MODEL_NAME=gemini-2.5-flash|gpt-4o-mini
  - GOOGLE_API_KEY o OPENAI_API_KEY
  - (opzionale) EVAL_BACKEND_URL=http://localhost:8080 (per override locale)
  - (opzionale) EVAL_RAG_ENDPOINT=/api/rag/baseline

## Esecuzione
1) Avvia il backend baseline (`npm start` o `npm run dev`) così da esporre l'endpoint RAG.
2) `npm run test:rag-eval`
3) Output:
   - Console: riepilogo delle metriche e percorso del report generato
   - File: `tests/rag_evaluation/report_baseline.json`

## Note pratiche
- Inizia con 5–6 casi nel dataset per restare nei limiti free tier.
- Se i contesti sono lunghi, alza/abbassa `EVAL_MAX_CONTEXT_CHARS`.
- Modalità `mock`: nessuna chiamata LLM, utile per smoke-test CI.
