# RAG Baseline Evaluation (Path A, JS-only)

## Cos'è
Valuta il RAG attuale (baseline) con 4 metriche: Context Precision, Context Recall, Faithfulness, Answer Relevance. L'LLM fa da "giudice".

## Requisiti
- Node 18+
- `.env` con BACKEND_URL e provider LLM:
  - EVAL_LLM_PROVIDER=gemini|openai|mock
  - EVAL_MODEL_NAME=gemini-2.5-flash|gpt-4o-mini
  - GOOGLE_API_KEY o OPENAI_API_KEY

## Esecuzione
1) `npm run test:rag-eval`
2) Output:
   - Console: media metriche
   - File: `tests/rag_evaluation/report_baseline.json`

## Note pratiche
- Inizia con 5–6 casi nel dataset per restare nei limiti free tier.
- Se i contesti sono lunghi, alza/abbassa `EVAL_MAX_CONTEXT_CHARS`.
- Modalità `mock`: nessuna chiamata LLM, utile per smoke-test CI.
