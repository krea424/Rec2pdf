# Changelog
All notable changes to this project will be documented in this file.

## [14.0.0] - 2025-11-27

### 🚀 Major Architectural Changes (The "Supersonic" Update)
Questa release segna un cambio di paradigma nelle prestazioni e nell'affidabilità del sistema.

- **Hybrid Transcription Engine (Groq + WhisperX):** Introdotto un router intelligente per la trascrizione audio:
  - **Groq LPU (Fast Mode):** Utilizzato per note e audio singolo speaker. Trascrive 10 minuti in <15 secondi (~37x più veloce rispetto alla v13). Include compressione FFmpeg automatica (32kbps) per massimizzare la durata supportata.
  - **WhisperX (Meeting Mode):** Mantenuto per i casi d'uso che richiedono diarizzazione (riconoscimento speaker), ora ottimizzato con quantizzazione `int8` per ridurre il carico CPU.
- **Direct-to-Storage Upload:** Il frontend ora carica i file audio direttamente su Supabase Storage, bypassando il backend. Questo elimina i colli di bottiglia di memoria su Cloud Run e risolve definitivamente i fallimenti di upload (HTTP 0) su reti mobili e per file di grandi dimensioni (>30MB).

### 🎨 UI/UX & Dashboard Redesign
- **Nuova Dashboard:** Layout completamente ridisegnato con navigazione localizzata (Home, Archivio, Configura).
- **Pipeline "Dynamic Island":** La visualizzazione dello stato della pipeline è ora più compatta e informativa, nascondendo i log tecnici a favore di uno stato visivo chiaro.
- **Upload Card Refactoring:** Nuovi pulsanti compatti e ripristino del visualizzatore a onde organiche durante la registrazione.
- **Automazione Meeting:** Attivando lo switch "Modalità Riunione", il sistema preseleziona automaticamente il prompt e il template corretti per i verbali.
- **Doppio Pannello Editor:** Introdotta la visualizzazione split-screen per modificare Markdown e vedere l'anteprima PDF simultaneamente.

### ⚡️ Infrastructure & Performance
- **Docker Optimization:** Riduzione drastica della dimensione dell'immagine Docker (da ~10GB a ~3.4GB) grazie a build multi-stage ottimizzate.
- **PDF Engine Upgrade:** Passaggio definitivo a **Weasyprint** come motore di rendering PDF primario per una migliore compatibilità CSS.
- **Polling Adattivo:** Migliorata la logica di polling (`useJobPolling`) per ridurre il traffico di rete e aggiornare la UI più velocemente al completamento dei job.
- **Webhook Routing:** Implementato routing basato sull'ambiente (Development/Production) per i trigger asincroni.

### 🐛 Fixed
- Risolto crash upload su iPhone per registrazioni lunghe (>6 min) grazie al Direct Upload.
- Risolto problema di posizionamento logo nel template `executive_brief`.
- Corretto scroll della preview su dispositivi mobile.
- Fix su reset dello stato applicazione dopo logout o completamento pipeline.

## [13.0.0] - 2025-11-19

### Added
- **Architettura Asincrona:** Implementato sistema a code basato su tabella `jobs` in Supabase.
- **Supporto Mobile:** Il frontend ora supporta la ripresa della sessione e il polling in background, permettendo l'uso su smartphone anche con blocco schermo.
- **Docker Optimization:** "Preriscaldamento" dei modelli WhisperX e Wav2Vec2 durante la build dell'immagine per eliminare i timeout al primo avvio.
- **Webhook Trigger:** Endpoint `/api/worker/trigger` protetto da secret per l'avvio automatico dei worker.

### Changed
- **Pipeline:** La pipeline non tiene più aperta la connessione HTTP. Risponde immediatamente con `202 Accepted` e `jobId`.
- **Frontend:** Sostituita la logica di attesa sincrona con un custom hook `useJobPolling` per il monitoraggio dello stato.
- **Database:** Aggiunta tabella `jobs` per tracciare lo stato delle elaborazioni.

### Fixed
- Risolto problema di timeout su file audio di grandi dimensioni.
- Risolto bug di visualizzazione dei pulsanti di download al termine della pipeline.
- Risolti conflitti di inizializzazione React (`ReferenceError`) in `App.jsx`.

## [12.0.0] - 2025-11-15

### Added
- **Fallback Dinamico a OpenAI**: Implementata una logica di fallback automatico da Gemini a OpenAI in caso di fallimento della chiamata, garantendo maggiore resilienza e affidabilità del servizio.
- **Ambiente di Sviluppo Dockerizzato**: Configurato un ambiente di sviluppo locale basato su Docker per semplificare il setup e garantire la coerenza tra gli ambienti.

### Changed
- **Miglioramenti al RAG**: Apportate diverse migliorie alla pipeline RAG, inclusa l'aggiunta di monitoraggio per un'analisi più approfondita delle performance.

### Fixed
- **Formato di Upload .csv**: Corretto un bug che impediva il corretto upload dei file in formato .csv.
- **Processo di Embedding**: Risolto un problema nel processo di embedding che poteva causare errori durante l'indicizzazione dei documenti.
- **Query Transformer RAG**: Corretto un bug nel template `rag_query_transformer.hbs` per migliorare la trasformazione delle query.

## [11.0.0] - 2025-11-10

### Added
- **Advanced RAG Pipeline**: Implementata una pipeline RAG (Retrieval-Augmented Generation) a più stadi per migliorare drasticamente la pertinenza del contesto. La nuova pipeline include:
    - **Query Transformation**: L'input dell'utente viene trasformato in query di ricerca multiple e mirate tramite un LLM, utilizzando il nuovo template `rag_query_transformer.hbs`.
    - **Multi-Query Retrieval & Re-ranking**: I risultati della ricerca vengono riordinati e valutati da un LLM per selezionare solo i chunk più pertinenti, massimizzando la qualità del contesto fornito al modello generativo.
- **Download Sicuro dei File**: Il sistema di download è stato potenziato. Ora utilizza un endpoint backend dedicato (`/api/file`) che genera URL pre-firmati per accedere ai file su Supabase Storage, migliorando sicurezza e affidabilità.

### Changed
- **RAGService Refactoring**: Tutta la logica RAG è stata incapsulata nel nuovo `RAGService` (`rec2pdf-backend/services/ragService.js`), migliorando l'organizzazione e la manutenibilità del codice.
- **Framework di Valutazione Aggiornato**: Il framework di test per il RAG (`evaluate.js`) è stato aggiornato per supportare l'inizializzazione asincrona dei client AI, garantendo maggiore stabilità durante le esecuzioni.

## [10.0.0] - 2025-11-09

### Added
- **Pipeline RAG con Re-ranking**: Introdotta una nuova pipeline RAG avanzata che utilizza un modello LLM per riordinare i chunk di contesto recuperati. Questo approccio, noto come "LLM-as-a-reranker", migliora significativamente la `Context Precision` (+20% secondo i test), fornendo al modello di generazione un contesto più pulito e pertinente.
- **Servizio RAG dedicato**: Tutta la logica RAG è stata centralizzata nel nuovo `RAGService`, migliorando la manutenibilità e la leggibilità del codice.

### Changed
- **Refactoring del codice**: Le funzioni di utilità sono state spostate in un file dedicato (`services/utils.js`) per una migliore organizzazione del codice.

## [9.0.0] - 2025-11-09

### Added
- **Framework di Valutazione RAG**: Introdotto un sistema completo per valutare le performance del RAG basato su metriche standard del settore. Utilizza un LLM come "giudice" per calcolare `Context Precision`, `Context Recall`, `Faithfulness` e `Answer Relevance`. I risultati sono salvati in un report JSON per analisi comparative.
- **Chunking Semantico Personalizzato**: Implementata una strategia di chunking ricorsiva e basata su separatori gerarchici. Questo approccio migliora la qualità della suddivisione del testo, creando chunk più coerenti e semanticamente rilevanti per il sistema RAG, superando i limiti del chunking a dimensione fissa.

## [7.0.0] - 2025-11-03

### Added
- **Esperienza bimodale Create/Advanced**: la shell di navigazione espone un accesso dedicato alla nuova vista "Advanced A" e mantiene la pipeline base disponibile per tutti, con banner di onboarding che guidano gli utenti senza flag avanzati.【F:rec2pdf-frontend/src/components/layout/AppShell.jsx†L10-L109】【F:rec2pdf-frontend/src/pages/Create.jsx†L1-L37】【F:rec2pdf-frontend/src/pages/Advanced.jsx†L65-L123】
- **Control room boardroom v2**: la pagina Advanced introduce il nuovo `InputManager` con superfici boardroom, gestione workspace/progetto, upload logo PDF e collegamenti rapidi, affiancato da una `PipelineOverview` che evidenzia progressi, log diagnostici e call-to-action verso la Library.【F:rec2pdf-frontend/src/features/advanced/InputManager.jsx†L1-L188】【F:rec2pdf-frontend/src/features/advanced/PipelineOverview.jsx†L1-L147】
- **Telemetry di prodotto**: `ModeContext` invia eventi `mode.flag_exposed` quando vengono abilitati i flag sperimentali e il pannello Publish traccia `pipeline.publish_requested`, `pipeline.export_pdf`, `pipeline.export_markdown` e `pipeline.reset_session` per monitorare l'uso della pipeline base.【F:rec2pdf-frontend/src/context/ModeContext.tsx†L1-L90】【F:rec2pdf-frontend/src/features/base/PipelinePanel.jsx†L1-L120】【F:rec2pdf-frontend/src/features/base/PipelinePanel.jsx†L220-L276】

### Changed
- **Accesso avanzato controllato da flag**: la Create page e la vista Advanced mostrano messaggi contestuali quando `MODE_ADVANCED` o `MODE_ADVANCED_V2` non sono presenti, chiarendo come abilitare la nuova control room.【F:rec2pdf-frontend/src/pages/Create.jsx†L17-L37】【F:rec2pdf-frontend/src/pages/Advanced.jsx†L78-L122】


## [6.0.0] - 2025-10-27

### BREAKING CHANGE

Questa versione introduce una revisione completa dell'architettura di persistenza dei dati, migrando l'intera applicazione dal filesystem locale a **Supabase**. Tutti i dati utente (Workspace, Profili, Prompt) sono ora gestiti tramite un database PostgreSQL e le relative API, mentre gli asset (loghi) sono gestiti tramite Supabase Storage. Questo cambiamento migliora drasticamente la scalabilità, la sicurezza e l'affidabilità dell'applicazione, rendendola pronta per il deploy in ambienti cloud moderni.

### Added
- **Infrastruttura Supabase**: Implementato schema del database con tabelle per `workspaces`, `profiles`, `workspace_profiles` e `prompts`.
- **Backend Refactoring**: L'intero backend (`server.js`) è stato riscritto per usare il client Supabase per tutte le operazioni CRUD, eliminando la dipendenza dal filesystem (`fs`).
- **Sicurezza Multi-Utente**: Introdotta la gestione dei dati per utente tramite `owner_id` e policy di Row Level Security (RLS) su Supabase.
- **Sincronizzazione Profili Utente**: Aggiunto un trigger di database per creare automaticamente un profilo utente (`public.profiles`) alla registrazione di un nuovo utente (`auth.users`).
- **Validazione Robusta**: Integrata la libreria `zod` nel backend per la validazione degli schemi di dati in entrata.
- **Gestione Loghi su Cloud**: La gestione dei loghi ora utilizza Supabase Storage, con upload diretti e accesso tramite URL pubblici.
- **Script di Migrazione**: Aggiunti script operativi (`migrate-workspaces.js`, `migrate-logos.js`) per consentire agli utenti esistenti di importare i loro dati locali nel nuovo sistema.

### Changed
- **Frontend State Management**: Il frontend è stato aggiornato per recuperare tutti i dati tramite le API del backend, utilizzando React Context per la gestione dello stato.
- **Dipendenze**: Aggiornate le dipendenze di backend e frontend per supportare la nuova architettura.

### Removed
- **Tutta la logica basata su filesystem**: Le funzioni `read/write` per i file `.json` e la gestione delle cartelle locali sono state completamente rimosse dal backend.


## [4.0.0] - 2025-10-22
### Added
- Endpoint `POST /api/workspaces/:workspaceId/ingest` con coda di elaborazione e supporto multi-formato (testi, PDF, audio) per aggiornare la knowledge base RAG senza script manuali.
- Vista "Knowledge Base" nel frontend con drag&drop, progress feedback e riepilogo dei documenti indicizzati per workspace.
- Retrieval automatico del contesto RAG durante la generazione del Markdown, combinando prompt, note e trascrizioni per la chiamata a Gemini.
### Changed
- Pipeline audio orchestrata via Supabase Storage con retry su upload/download e validazione dei WAV per gestire in modo affidabile registrazioni lunghe.
### Fixed
- Corretto l'ordine degli hook in `CreatePage` e `WorkspaceNavigator` eliminando i warning di React DevTools in console.

## [3.0.0] - 2025-10-20
### Added
- Pipeline di trascrizione per riunioni con identificazione speaker (diarizzazione) tramite WhisperX.
- Interfaccia utente per la mappatura manuale degli speaker.
- Supporto per template PDF basati su HTML, con motore di rendering `wkhtmltopdf`.
- Nuovo template "Verbale Meeting" (`verbale_meeting.html`) per un output più accattivante.
- Endpoint API `/api/templates` per elencare dinamicamente i template disponibili.
- Menu a tendina nella UI per la selezione del template.

### Changed
- Lo script `publish.sh` ora supporta condizionalmente sia template LaTeX che HTML.
- Aggiornato il `Dockerfile` per includere le dipendenze di `whisperX`.