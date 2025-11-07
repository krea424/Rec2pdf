# Rec2PDF Toolchain Overview
v4.0.0

Questo documento illustra l'orchestrazione end-to-end della toolchain `rec2pdf`, evidenziando come frontend e backend collaborano nelle fasi di pre-analisi, generazione Markdown raffinata e pubblicazione PDF.

## 1. Input e raccolta contesto

Nel frontend (`rec2pdf-frontend/src/App.jsx`) l'utente può:

- **Registrare o caricare audio** tramite le card della pipeline base/advanced; i file vengono mantenuti nello stato `pipeline.audioBlob` insieme ai metadati di workspace/progetto e al prompt selezionato.【F:rec2pdf-frontend/src/App.jsx†L1658-L1888】
- **Caricare Markdown/TXT esistenti** che saltano la fase di trascrizione ma condividono la stessa pipeline di generazione e publish.【F:rec2pdf-frontend/src/App.jsx†L1889-L2360】
- **Richiedere insight preliminari** dal Navigator o dalla Library: `fetchEntryPreAnalysis` costruisce il payload con `buildPreAnalyzeRequest` includendo slug, tag, struttura mancante e punteggi di qualità già salvati.【F:rec2pdf-frontend/src/App.jsx†L3003-L3086】【F:rec2pdf-frontend/src/api/preAnalyze.js†L83-L183】

## 2. Handshake di pre-analisi

Quando la pre-analisi è disponibile viene eseguito `postPreAnalyze`:

1. Il payload viene inviato in JSON a `POST /api/pre-analyze` del backend corrente.【F:rec2pdf-frontend/src/api/preAnalyze.js†L185-L273】
2. Il backend valida trascrizione e cue card, renderizza il prompt Handlebars `pre_analyze` e chiama il provider AI risolto da `resolveAiProvider`/`getAIService` per generare un blocco JSON con suggerimenti.【F:rec2pdf-backend/server.js†L6016-L6138】
3. La risposta viene normalizzata in `parsePreAnalyzeData`, producendo sommario, highlight e sezioni pronti per essere mostrati nel Navigator o precompilati come risposte per la generazione successiva.【F:rec2pdf-frontend/src/api/preAnalyze.js†L200-L247】

Le anomalie (JSON invalido, cue card non abbinate) vengono tracciate dal backend per semplificare il debugging senza interrompere il flusso principale.【F:rec2pdf-backend/server.js†L6087-L6138】

## 3. Avvio della pipeline executive

`processViaBackend` confeziona un `FormData` con:

- File audio o testo normalizzato,
- Identificativi di workspace/profilo/progetto,
- Prompt selezionato (incluso override provider AI),
- Eventuali `refinedData` provenienti dalla sessione precedente o dalla pre-analisi,
- Opzioni aggiuntive (focus, note, diarizzazione).【F:rec2pdf-frontend/src/App.jsx†L3944-L4306】

Il `FormData` viene inviato a `POST /api/rec2pdf` tramite `fetchBodyWithAuth`, che gestisce automaticamente il refresh token Supabase e serializza i log di avanzamento nel pannello pipeline.【F:rec2pdf-frontend/src/App.jsx†L1760-L1860】【F:rec2pdf-frontend/src/App.jsx†L4024-L4306】

## 4. Pipeline backend

Nel backend (`rec2pdf-backend/server.js`) l'endpoint `/api/rec2pdf` orchestra le fasi sequenziali, pubblicando eventi di stato:

1. **Upload & normalizzazione** – `multer` salva gli allegati, `ffmpeg` effettua transcode 16kHz mono, e viene preparato il manifest locale/Supabase.【F:rec2pdf-backend/server.js†L1312-L1669】
2. **Trascrizione Whisper** – avvia il CLI configurato, opzionalmente con diarizzazione WhisperX quando è presente il token HuggingFace.【F:rec2pdf-backend/server.js†L1669-L1912】
3. **Ingestione knowledge base** – se richiesto costruisce il contesto RAG interrogando Supabase embeddings e unendo risultati con il transcript.【F:rec2pdf-backend/server.js†L6855-L6998】
4. **Generazione Markdown raffinata** – `generateMarkdown` unisce trascrizione, contesto, cue card e `refinedData` (summary, highlights, cueCardAnswers). Il prompt risultante viene inviato al provider AI, il corpo Markdown viene normalizzato e arricchito con front matter aggiornato (`ai.model`, `refined`).【F:rec2pdf-backend/server.js†L2195-L2305】【F:rec2pdf-backend/server.js†L6208-L6998】
5. **Publish PDF** – `publishWithTemplateFallback` invoca `Scripts/publish.sh` con il template selezionato, gestendo fallback Pandoc/LaTeX o HTML in base al profilo workspace; gli artefatti vengono poi caricati su Supabase Storage con link firmati per il frontend.【F:rec2pdf-backend/server.js†L2003-L2295】【F:Scripts/publish.sh†L1-L103】【F:rec2pdf-backend/server.js†L6471-L7927】

## 5. Output e revisione

Il backend restituisce percorsi Markdown/PDF, `stageEvents` e metadati del prompt utilizzato. Il frontend aggiorna la UI mostrando pulsanti di download, log riepilogativi e rende disponibile il bottone "Vai alla Library" nella dashboard advanced.【F:rec2pdf-backend/server.js†L6990-L7058】【F:rec2pdf-frontend/src/features/advanced/PipelineOverview.jsx†L21-L162】

Le revisioni successive (editor Markdown, rimappatura speaker, republish) riutilizzano gli stessi endpoint `/api/markdown`, `/api/rec2pdf` e `/api/pre-analyze`, mantenendo consistenza dei template e dei suggerimenti generati.
