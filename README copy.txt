# Rec2pdf

Rec2pdf è una web app che trascrive registrazioni audio di meeting, le analizza con un LLM e genera verbali professionali in formato PDF.

## Novità v11.0.0

L'ultima versione introduce una **pipeline RAG (Retrieval-Augmented Generation) multi-stadio**, un'architettura sofisticata che migliora drasticamente la qualità e la pertinenza del contesto fornito al modello LLM.

- **Query Transformation**: L'input dell'utente viene trasformato in query di ricerca multiple e mirate, garantendo un recupero delle informazioni più preciso.
- **Re-ranking Avanzato**: I risultati della ricerca vengono riordinati e valutati da un LLM per selezionare solo i chunk più pertinenti, massimizzando la qualità del contesto.
- **Download Sicuri**: Il sistema di download ora utilizza URL pre-firmati per un accesso sicuro e affidabile ai file.

## Architettura RAG Avanzata

La nostra pipeline RAG è progettata per massimizzare la pertinenza del contesto. Invece di passare direttamente al modello il primo risultato di una ricerca vettoriale, adottiamo un approccio più sofisticato in quattro fasi:

1.  **Query Transformation**: L'input grezzo dell'utente (es. una trascrizione) viene analizzato da un LLM per generare da 2 a 4 query di ricerca semantica, concise e focalizzate.
2.  **Multi-Query Retrieval**: Eseguiamo ricerche vettoriali multiple in parallelo, una per ogni query generata, recuperando una rosa allargata di chunk candidati dalla nostra knowledge base (Supabase Vector).
3.  **Re-ranking (LLM-as-a-Reranker)**: I chunk candidati vengono passati a un LLM che agisce da "giudice di pertinenza", valutando ogni chunk in relazione alla query originale e assegnandogli un punteggio.
4.  **Selezione**: Infine, selezioniamo solo i chunk con il punteggio più alto per costruire un contesto denso e preciso, che viene poi fornito al modello di generazione per creare il documento finale.

Questo processo a più fasi garantisce che il contesto sia estremamente focalizzato, riducendo il "rumore" e migliorando la qualità dell'output.

## Features Principali

- **Trascrizione Audio**: Supporto per i più comuni formati audio e trascrizione tramite **WhisperX** per un'accuratezza elevata.
- **Identificazione Speaker**: Riconoscimento e mappatura dei diversi speaker presenti nella registrazione (diarizzazione).
- **Generazione Contenuti con AI**: Integrazione con **Google Gemini** per analizzare la trascrizione e generare riassunti, decisioni e azioni.
- **Knowledge Base (RAG)**: Ogni workspace ha una sua knowledge base vettoriale che fornisce contesto aggiuntivo al LLM per generazioni più accurate e personalizzate.
- **Template PDF**: Supporto per template multipli (LaTeX e HTML) per personalizzare l'aspetto dei documenti finali.
- **Accesso Multi-Utente**: Architettura sicura basata su Supabase con policy di Row Level Security (RLS).

## Quickstart

... (resto del file) ...

## Bootstrap Supabase

1. **Applica le migrazioni** contenute in `rec2pdf-backend/supabase/migrations/` per creare tabelle, policy RLS e bucket `logos`.
   ```bash
   cd rec2pdf-backend
   supabase db push
   ```
   Le migrazioni `20240725_draft_prompts_workspaces_profiles.sql`, `20240801_add_metadata_to_workspaces.sql` e `20240815_create_logos_bucket.sql`
   impostano lo schema di base (profili, workspaces, prompts), aggiungono il campo `metadata` e assicurano la presenza del bucket pubblico per i loghi.【F:rec2pdf-backend/supabase/migrations/20240725_draft_prompts_workspaces_profiles.sql†L1-L146】【F:rec2pdf-backend/supabase/migrations/20240801_add_metadata_to_workspaces.sql†L1-L12】【F:rec2pdf-backend/supabase/migrations/20240815_create_logos_bucket.sql†L1-L28】
2. **Migra i prompt locali** (opzionale ma consigliato) eseguendo lo script CLI:
   ```bash
   cd rec2pdf-backend
   node scripts/migrate-prompts.js             # usa ~/.rec2pdf/prompts.json
   node scripts/migrate-prompts.js --dry-run   # valida senza scrivere su Supabase
   ```
   Lo script normalizza slug, checklist e regole PDF/Markdown, controlla duplicati e sincronizza i record via Admin API.【F:rec2pdf-backend/scripts/migrate-prompts.js†L1-L132】【F:rec2pdf-backend/scripts/migrate-prompts.js†L146-L198】
3. **Porta nel cloud workspaces e profili** (inclusi stati e progetti) da `~/.rec2pdf/workspaces.json`:
   ```bash
   cd rec2pdf-backend
   node scripts/migrate-workspaces.js
   node scripts/migrate-workspaces.js --dry-run --file scripts/__fixtures__/workspaces.sample.json
   ```
   Il tool converte slug, versioning policy e percorsi, blocca la procedura in presenza di duplicati e genera un manifest con i loghi locali che richiedono upload manuale.【F:rec2pdf-backend/scripts/migrate-workspaces.js†L1-L200】【F:rec2pdf-backend/scripts/migrate-workspaces.js†L240-L334】
4. **Carica i loghi storici** salvati in `~/.rec2pdf/logos/<workspaceId>/<profileId>/` sfruttando il bucket `logos`:
   ```bash
   cd rec2pdf-backend
   node scripts/migrate-logos.js
   ```
   Lo script esplora il filesystem, valida le estensioni supportate e aggiorna `pdf_logo_url`/metadata dei profili su Supabase con l’URL pubblico risultante.【F:rec2pdf-backend/scripts/migrate-logos.js†L1-L175】

## Backend HTTP
- **Server principale**: `rec2pdf-backend/server.js`.
- **Persistenza locale**: crea automaticamente `~/.rec2pdf/workspaces.json` e `prompts.json` se mancanti, mantenendo metadati locali oltre agli artefatti salvati su Supabase.【F:rec2pdf-backend/server.js†L32-L67】【F:rec2pdf-backend/server.js†L448-L676】
- **Endpoint chiave** (tutti protetti da bearer token Supabase):
  - `POST /api/rec2pdf`: pipeline completa audio → PDF/Markdown; supporta il flag `diarize=true` per attivare WhisperX, restituisce diarizzazioni JSON, etichette speaker e copia la mappa speaker nei metadati di sessione.【rec2pdf-backend/server.js:2937】【rec2pdf-backend/server.js:3202】【rec2pdf-backend/server.js:3330】
  - `POST /api/pre-analyze`: genera suggerimenti rapidi sulle cue card a partire da trascrizioni o Markdown esistenti, normalizza la risposta AI e restituisce `suggestedAnswers` pronte per l'editor o per il reprompt raffinato della pipeline.【F:rec2pdf-backend/server.js†L6016-L6138】【F:rec2pdf-frontend/src/api/preAnalyze.js†L185-L273】
  - `POST /api/text-upload`: stessa pipeline partendo da file `.txt` (senza fase di trascrizione).【F:rec2pdf-backend/server.js†L2058-L2348】
  - `POST /api/ppubr` e `POST /api/ppubr-upload`: rigenera PDF da Markdown già presente (locale o Supabase) o da upload manuale, applicando eventuali mappature speaker e scegliendo automaticamente il template più adatto.【rec2pdf-backend/server.js:3601】【rec2pdf-backend/server.js:3725】
  - `GET/POST/PUT/DELETE /api/workspaces`: CRUD dei workspace con aggiornamento automatico dello storage locale.【F:rec2pdf-backend/server.js†L1072-L1146】
  - `POST /api/workspaces/:workspaceId/ingest`: accoda fino a 20 file alla volta (testo, PDF, audio), estrae il contenuto e genera embedding in background per la knowledge base del workspace o del progetto selezionato tramite i campi `projectId`/`workspaceProjectId`.【rec2pdf-backend/server.js†L3951-L4061】【rec2pdf-backend/server.js†L2877-L2972】
  - `GET /api/workspaces/:workspaceId/knowledge`: restituisce i documenti indicizzati con chunk, dimensione, `projectId` e timestamp filtrando automaticamente tra knowledge base di workspace e di progetto.【rec2pdf-backend/server.js†L4063-L4182】
  - `GET/POST/PUT/DELETE /api/prompts`: gestione dei prompt, inclusa validazione di cue card e checklist.【F:rec2pdf-backend/server.js†L1160-L1269】
  - `GET /api/markdown` & `PUT /api/markdown`: lettura e modifica dei Markdown su Supabase con backup automatico delle versioni precedenti.【F:rec2pdf-backend/server.js†L2375-L2462】
  - `GET /api/storage`: elenco degli oggetti in un bucket/prefisso; `GET /api/file`: genera URL firmati con scadenza breve per download sicuri.【F:rec2pdf-backend/server.js†L2352-L2513】
  - `GET /api/health` e `GET /api/diag`: healthcheck semplice e diagnostica completa delle dipendenze CLI/permessi.【F:rec2pdf-backend/server.js†L1272-L1309】

Il backend usa `multer` per gestire upload multipart, costruisce nomi coerenti con workspace/policy di versioning e sincronizza automaticamente file e log con i bucket Supabase.【F:rec2pdf-backend/server.js†L700-L760】【F:rec2pdf-backend/server.js†L1312-L2055】

### Ingestione della knowledge base
- **Migrazione Supabase**: applica gli script `rec2pdf-backend/supabase/migrations/20240506_add_workspace_id_to_knowledge_chunks.sql`, `rec2pdf-backend/supabase/migrations/20250219_add_project_id_to_knowledge_chunks.sql` e `rec2pdf-backend/supabase/migrations/20250219_update_match_knowledge_chunks_function.sql` per salvare `workspace_id`/`project_id` e usare la funzione RPC aggiornata nei retrieve.【F:rec2pdf-backend/supabase/migrations/20240506_add_workspace_id_to_knowledge_chunks.sql†L1-L9】【F:rec2pdf-backend/supabase/migrations/20250219_add_project_id_to_knowledge_chunks.sql†L1-L9】【F:rec2pdf-backend/supabase/migrations/20250219_update_match_knowledge_chunks_function.sql†L1-L30】
- **Prerequisiti**: configura le variabili `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` e `OPENAI_API_KEY` nel file `.env` del backend e prepara i sorgenti in `rec2pdf-backend/knowledge_sources/<workspaceId>/` per la knowledge base generale oppure in `rec2pdf-backend/knowledge_sources/<workspaceId>/<projectId>/` per i progetti, utilizzando file `.txt` o `.md`.
- **Esecuzione**: lancia `npm run ingest -- --workspaceId=<workspaceId> [--projectId=<projectId>]` per generare chunk da 250 parole (overlap 50 parole), calcolare gli embedding OpenAI `text-embedding-3-small` e inserirli in `knowledge_chunks` con metadati arricchiti da `projectId`.

## RAG multi-tenant

### Overview architettura
Il backend applica un isolamento per workspace e progetto su Supabase: ogni chunk di conoscenza è salvato nella tabella `knowledge_chunks` con il relativo `workspace_id` e l'eventuale `project_id`, quindi viene recuperato tramite la funzione RPC `match_knowledge_chunks`, che combina la knowledge generale del workspace e quella specifica del progetto ordinandole per similarità vettoriale.【F:rec2pdf-backend/scripts/ingest.js†L45-L119】【F:rec2pdf-backend/server.js†L110-L200】【F:rec2pdf-backend/supabase/migrations/20250219_update_match_knowledge_chunks_function.sql†L1-L30】 La nuova coda di ingestione normalizza i file caricati, genera gli embedding tramite OpenAI e popola Supabase mantenendo metadata per auditing, inclusi workspace e progetto.【F:rec2pdf-backend/server.js†L2800-L2972】 Durante la generazione del Markdown il server concatena prompt, note e trascrizione, interroga `match_knowledge_chunks` usando workspace e project correnti e inietta il contesto risultante direttamente nella chiamata a Gemini responsabile della sintesi.【F:rec2pdf-backend/server.js†L5337-L5382】【F:rec2pdf-backend/server.js†L6329-L6376】

### Pipeline di ingest e retrieval
1. Carica contenuti dal frontend (tab "Knowledge Base") oppure invia una richiesta `POST /api/workspaces/:workspaceId/ingest` con testi, PDF o audio: l'API accoda i file, ne estrae il testo, crea chunk e genera embedding OpenAI in background mantenendo metadati su nome, formato, progetto e chunk conteggi.【rec2pdf-backend/server.js†L3951-L4061】【rec2pdf-backend/server.js†L2877-L2972】【rec2pdf-frontend/src/components/workspaces/KnowledgeBaseManager.jsx†L1-L320】
2. In alternativa, usa lo script CLI `npm run ingest -- --workspaceId=<workspaceId> [--projectId=<projectId>]` per import massivi di Markdown/TXT già presenti su disco mantenendo la struttura delle cartelle nei metadati `source` e tracciando l'eventuale progetto associato.【F:rec2pdf-backend/scripts/ingest.js†L38-L138】
3. Durante la pipeline voce→Markdown il backend combina prompt, note e trascrizione, interroga `match_knowledge_chunks` per workspace e progetto in uso e inietta il contesto risultante prima di chiamare Gemini per la sintesi.【F:rec2pdf-backend/server.js†L5337-L5382】【F:rec2pdf-backend/server.js†L6329-L6376】

### Requisiti di configurazione
- Definisci le variabili d’ambiente `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY` e `GOOGLE_API_KEY` nel `.env` del backend per abilitare rispettivamente l’accesso a Supabase, gli embedding e la generazione del Markdown. Puoi personalizzare i provider di default impostando `AI_TEXT_PROVIDER` e `AI_EMBEDDING_PROVIDER` (`gemini` oppure `openai`).【F:rec2pdf-backend/.env.example†L7-L31】
- Dal frontend (Impostazioni → Advanced → Motore AI) è possibile scegliere dinamicamente quale provider usare per la generazione del Markdown e per gli embedding; la selezione viene inviata a ogni pipeline e sovrascrive i default del backend quando il provider è configurato correttamente.
- Applica gli script `20240506_add_workspace_id_to_knowledge_chunks.sql`, `20250219_add_project_id_to_knowledge_chunks.sql` e `20250219_update_match_knowledge_chunks_function.sql` per abilitare il retrieval multi-workspace/multi-progetto della funzione `match_knowledge_chunks`.【F:rec2pdf-backend/supabase/migrations/20240506_add_workspace_id_to_knowledge_chunks.sql†L1-L9】【F:rec2pdf-backend/supabase/migrations/20250219_add_project_id_to_knowledge_chunks.sql†L1-L9】【F:rec2pdf-backend/supabase/migrations/20250219_update_match_knowledge_chunks_function.sql†L1-L30】
- Utilizza l’header `x-workspace-id` (e opzionalmente `workspaceProjectId`) o i relativi parametri quando richiami le API `/api/rec2pdf`, `/api/ppubr` e `/api/workspaces/:workspaceId/knowledge` per assicurarti che il backend risolva la knowledge base corretta durante la generazione del Markdown multi-tenant.【F:rec2pdf-backend/server.js†L34-L58】【F:rec2pdf-backend/server.js†L4014-L4180】【F:rec2pdf-backend/server.js†L5337-L5382】

## Interfaccia web
- **Stack**: React 18, Vite 5, Tailwind CSS 3, icone Lucide, client Supabase JS.【F:rec2pdf-frontend/package.json†L1-L25】
- **Funzionalità UI**:
  - Schermata di login con magic link e OAuth GitHub; il resto della SPA è disponibile solo a sessione Supabase attiva.【F:rec2pdf-frontend/src/App.jsx†L385-L439】【F:rec2pdf-frontend/src/components/LoginPage.jsx†L1-L82】
  - Recorder/loader audio con tracking in tempo reale dei log/stage della pipeline e salvataggio cronologia su `localStorage`.【F:rec2pdf-frontend/src/App.jsx†L1658-L1999】
  - Toggle “Identifica speaker multipli” per attivare la diarizzazione WhisperX direttamente dal pannello di pubblicazione.【rec2pdf-frontend/src/features/base/PipelinePanel.jsx:397】
  - Upload dedicati per Markdown e TXT, riuso delle stesse preferenze workspace/prompt e gestione fallback quando mancano alcune fasi della pipeline.【F:rec2pdf-frontend/src/App.jsx†L1999-L2354】
  - Prompt Library con preferiti, cue card e checklist interattive, sincronizzata con le API del backend.【F:rec2pdf-frontend/src/App.jsx†L1360-L1456】
  - Workspace Navigator evoluto con filtri salvabili, cache anteprime, assegnazioni rapide e adozione dei metadati per la pipeline.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L61-L215】【F:rec2pdf-frontend/src/pages/Library.jsx†L6-L59】
  - Knowledge Base Manager con drag&drop, feedback sull'ingestione e lista dei documenti indicizzati per ogni workspace; puoi scegliere l'ambito "Workspace" oppure un progetto specifico prima dell'upload direttamente dal cassetto impostazioni.【rec2pdf-frontend/src/components/workspaces/WorkspaceProfilesManager.jsx†L916-L1324】【rec2pdf-frontend/src/components/workspaces/KnowledgeBaseManager.jsx†L1-L320】
  - Cloud Library collegata a Supabase Storage per sfogliare, filtrare e aprire artefatti firmati senza lasciare l'app.【F:rec2pdf-frontend/src/components/CloudLibraryPanel.jsx†L75-L198】
  - Modale editor Markdown con analisi struttura, mapper degli speaker e doppia azione di rigenerazione (standard o con nomi applicati).【rec2pdf-frontend/src/App.jsx:3758】【rec2pdf-frontend/src/components/MarkdownEditorModal.jsx:207】【rec2pdf-frontend/src/components/SpeakerMapper.jsx:1】
  - Setup Assistant e diagnostica integrata (`useBackendDiagnostics`) per verificare dipendenze, permessi e connettività autenticata.【F:rec2pdf-frontend/src/hooks/useBackendDiagnostics.js†L1-L85】【F:rec2pdf-frontend/src/components/SetupAssistant.jsx†L1-L200】
  - Temi consultabili, loghi personalizzati, gestione device audio e wizard workspace/progetto/stato dal cassetto impostazioni.【F:rec2pdf-frontend/src/components/layout/SettingsDrawer.jsx†L47-L199】【F:rec2pdf-frontend/src/App.jsx†L361-L714】

Costruzione produzione:
```bash
npm run build
npm run preview  # serve statico su http://localhost:4173
```

## Scorciatoie da tastiera
- `⌘/Ctrl + K` apre e richiude la **command palette** globale finché il focus non è su un campo di input, consentendo di lanciare comandi senza cambiare vista.【F:rec2pdf-frontend/src/components/CommandPalette.jsx†L133-L208】
- Con la palette aperta premi `R` per avviare/fermare la registrazione, `U` per aprire il selettore file audio, `E` per navigare all'editor e `K` per passare alla libreria.【F:rec2pdf-frontend/src/components/CommandPalette.jsx†L59-L112】
- Le lettere `B` e `A` passano rispettivamente alla modalità Base e Advanced sia dalla palette sia dal toggle in header, che mostra lo stato corrente e salva la preferenza in tempo reale.【F:rec2pdf-frontend/src/components/CommandPalette.jsx†L88-L190】【F:rec2pdf-frontend/src/components/layout/AppShell.jsx†L56-L107】
- Usa `Esc`, `Tab` e `Shift+Tab` per navigare e chiudere la palette, mantenendo il focus sul contesto iniziale senza perdere l'operazione in corso.【F:rec2pdf-frontend/src/components/CommandPalette.jsx†L132-L190】

## Workflow tipico
1. Avvia backend e frontend, esegui login con Supabase e verifica lo stato delle dipendenze dalla diagnostica integrata.【F:rec2pdf-frontend/src/App.jsx†L385-L439】【F:rec2pdf-frontend/src/hooks/useBackendDiagnostics.js†L1-L85】
2. Dalla voce **Impostazioni** crea workspace/progetti/stati con il builder interno oppure allinea la selezione al form pipeline.【F:rec2pdf-frontend/src/components/layout/SettingsDrawer.jsx†L47-L199】【F:rec2pdf-frontend/src/App.jsx†L560-L714】
3. Configura (o importa) workspace e filtri salvati nel Navigator per popolare rapidamente le opzioni di pipeline.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L61-L215】【F:rec2pdf-frontend/src/pages/Library.jsx†L6-L59】
4. Crea/duplica un prompt dalla libreria, imposta tone of voice, checklist e regole PDF e salvalo via API.【F:rec2pdf-frontend/src/App.jsx†L1360-L1456】【F:rec2pdf-backend/server.js†L1160-L1269】
5. Registra o carica l'audio (oppure trascina un TXT/Markdown) associando workspace, progetto e prompt desiderati; attiva la diarizzazione se stai lavorando su una riunione multi-speaker.【F:rec2pdf-frontend/src/App.jsx†L1658-L2354】【rec2pdf-frontend/src/features/base/PipelinePanel.jsx:397】
6. Esegui la **pre-analisi** dal Navigator o dalla Library per generare suggerimenti di risposta sulle cue card: il frontend costruisce il payload con `buildPreAnalyzeRequest`, invia il JSON a `/api/pre-analyze` e normalizza il risultato per popolare highlight e sezioni suggerite.【F:rec2pdf-frontend/src/App.jsx†L3003-L3086】【F:rec2pdf-frontend/src/api/preAnalyze.js†L83-L183】【F:rec2pdf-backend/server.js†L6016-L6138】
7. Segui lo stato della pipeline (pre-analyze → transcode → trascrizione → generazione Markdown raffinata → PDF) tramite i log animati e le notifiche di completezza del documento: il backend miscela cue card suggerite e risposte raffinate nel prompt di generazione per produrre Markdown contestualizzato.【F:rec2pdf-frontend/src/App.jsx†L1688-L1768】【F:rec2pdf-backend/server.js†L2195-L2305】【F:rec2pdf-backend/server.js†L6208-L6998】
8. Revisiona il Markdown nell'editor modale, assegna nomi reali agli speaker tramite il mapper incluso, salva le modifiche su Supabase e rigenera il PDF (anche con nomi applicati) direttamente dal browser.【rec2pdf-backend/server.js:3601】【rec2pdf-frontend/src/components/MarkdownEditorModal.jsx:207】【rec2pdf-frontend/src/components/SpeakerMapper.jsx:1】
9. Condividi o scarica gli artefatti dalla Cloud Library, utilizzando i link firmati generati dal backend.【F:rec2pdf-backend/server.js†L2352-L2513】【F:rec2pdf-frontend/src/components/CloudLibraryPanel.jsx†L75-L198】

## QA & non-regression
### Test automatizzati
- **Unit test**: `npm run test:unit` (frontend) – coprono AppShell e WorkspaceNavigator, assicurando che navigazione, banner di onboarding e azioni principali del navigator restino stabili.【F:rec2pdf-frontend/src/components/layout/__tests__/AppShell.test.jsx†L1-L65】【F:rec2pdf-frontend/src/components/__tests__/WorkspaceNavigator.test.jsx†L1-L69】
- **End-to-end**: `npm run test:e2e` avvia Playwright con mock delle API `/api/rec2pdf` e `/api/workspaces` per validare il flusso audio→PDF senza dipendenze esterne.【F:rec2pdf-frontend/tests/e2e/audio-to-pdf.spec.js†L1-L87】【F:rec2pdf-frontend/playwright.config.js†L1-L20】
- **Continuous feedback**: abilitare `npm run test:ui` durante lo sviluppo per monitorare regressioni visive nei componenti chiave.

### Checklist non-regression
1. **Pipeline audio**: caricamento clip, abilitazione CTA "Avvia pipeline" e ricezione evento `Pipeline completata` devono funzionare con backend mockato o reale (verificato dall'E2E).【F:rec2pdf-frontend/src/pages/Create.jsx†L1086-L1145】【F:rec2pdf-frontend/tests/e2e/audio-to-pdf.spec.js†L33-L87】
2. **Diarizzazione WhisperX**: con il toggle attivo la pipeline deve produrre trascrizioni `.json`, log dedicati e popolazione dell'elenco speaker nella risposta.【rec2pdf-frontend/src/features/base/PipelinePanel.jsx:397】【rec2pdf-backend/server.js:3202】
3. **Workspace Navigator**: filtri, anteprima e azioni principali (Aggiorna, ricerca) non devono produrre errori console; unit test garantisce callbacks di base.
4. **Editor Markdown**: apertura modale da `/editor`, salvataggio (`handleMdEditorSave`) e repubblicazione (`handleRepublishFromEditor`) devono rimanere disponibili dopo refactor del contesto.【F:rec2pdf-frontend/src/pages/Editor.jsx†L1-L27】【F:rec2pdf-frontend/src/App.jsx†L3360-L3508】
5. **Mappatura speaker**: inserire nomi reali deve aggiornare anteprima e consentire la rigenerazione con nomi applicati (pulsante dedicato).【rec2pdf-frontend/src/components/SpeakerMapper.jsx:1】【rec2pdf-frontend/src/components/MarkdownEditorModal.jsx:207】
6. **Diagnostica**: `useBackendDiagnostics` deve continuare a riportare stato health/diag senza bloccare l'onboarding; monitorare `diagnostics.status` nel banner.
7. **Accessibilità**: verificare periodicamente la checklist in `docs/ACCESSIBILITY_CHECKLIST.md` (focus visibile, label) dopo modifiche UI.

## Personalizzazione template PDF
La cartella [`Templates/`](Templates) contiene i file LaTeX usati da `publish.sh`:
- `default.tex`: layout principale.
- `header_footer.tex`: elementi ripetuti.
- `cover.tex`: pagina di copertina.

Per personalizzare:
1. Modifica i template mantenendo i placeholder Pandoc (`$body$`, `$logo$`, ecc.).
2. Esegui `Scripts/publish.sh path/al/documento.md` per testare localmente (richiede `pandoc` + `xelatex`).
3. Imposta `CUSTOM_PDF_LOGO` o carica un logo dal frontend per sovrascrivere l'asset di default (`assets/thinkDOC.pdf`).

### Template meeting HTML (`verbale_meeting`)
Oltre ai layout LaTeX è disponibile un template HTML pensato per i verbali di riunione.

1. **Installa un motore HTML → PDF** se non già presente. Il fallback automatico usa `wkhtmltopdf` o `weasyprint`. Su sistemi Debian/Ubuntu è sufficiente `sudo apt-get install -y wkhtmltopdf` oppure `sudo apt-get install -y weasyprint`.
2. **Abilita il template** impostando l'ambiente prima di lanciare il backend/pipeline:
   ```bash
   export WORKSPACE_PROFILE_TEMPLATE="$(pwd)/Templates/verbale_meeting.html"
   export WORKSPACE_PROFILE_TEMPLATE_TYPE=html
   export WORKSPACE_PROFILE_TEMPLATE_CSS="$(pwd)/Templates/verbale_meeting.css"
   ```
   In alternativa seleziona il template dall'interfaccia Workspace Profile.
3. **Usa il prompt dedicato** `prompt_meeting_minutes` (Chief of Staff) per generare il contenuto coerente con il layout.
4. **Prepara il front matter YAML** includendo `pdfRules.layout: verbale_meeting` (o il campo `layout`) e tre array strutturati: `action_items` (oggetti con description, assignee.{name,role}, due_date), `key_points` (stringhe) e `transcript` (blocchi con speaker, role, timestamp e paragraphs). Un esempio completo è disponibile in [`docs/sample_verbale_meeting.md`](docs/sample_verbale_meeting.md) e nel quickstart [`docs/meeting_template_quickstart.md`](docs/meeting_template_quickstart.md).

Il corpo del documento dovrebbe rispettare le sezioni: **Riepilogo esecutivo**, **Decisioni e approvazioni**, **Azioni assegnate**, **Punti chiave** e **Trascrizione integrale**, così da sfruttare al meglio i componenti del template HTML.

## Struttura del repository
```text
Rec2pdf/
├── rec2pdf-backend/      # Server Express e orchestrazione pipeline
├── rec2pdf-frontend/     # SPA React + Tailwind
├── Scripts/              # Script shell per pubblicazione PDF
├── Templates/            # Template LaTeX utilizzati da publish.sh
├── assets/               # Asset grafici (logo PDF, SVG)
├── BusinessCase.md       # Documentazione di prodotto
├── Brand_Vision_and_Creative_Brief.md
└── Manuale utente – Workspace Navigator mul.md
```

## Licenza
Distribuito con licenza [MIT](LICENSE).
