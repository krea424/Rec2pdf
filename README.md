# Rec2PDF

<p align="center">
  <img src="rec2pdf-frontend/logo-thinkdoc-sfondo_scuro.svg" alt="Rec2PDF" width="260" />
</p>

Rec2PDF automatizza il flusso **voce → trascrizione → documento editoriale** trasformando i pensieri a voce alta, i brainstorming con se stessi e le registrazioni vocali in genere in PDF strutturati e pronti per la distribuzione. Oggi il progetto integra autenticazione e storage gestiti da Supabase, con un frontend che offre login, librerie cloud e strumenti di revisione, e un backend che coordina pipeline audio/testo, generazione Markdown e impaginazione. La release 4.0.0 introduce ingestion RAG multi-formato, un Knowledge Base manager integrato e una pipeline audio resiliente pensata per registrazioni più lunghe senza perdere traccia dei log di avanzamento.【rec2pdf-frontend/src/components/workspaces/KnowledgeBaseManager.jsx†L1-L220】【rec2pdf-backend/server.js†L2236-L2314】【rec2pdf-backend/server.js†L3840-L3897】

## Sommario
- [Panoramica](#panoramica)
- [Modalità Base](#modalità-base)
- [Modalità Advanced](#modalità-advanced)
- [Caratteristiche principali](#caratteristiche-principali)
- [Architettura](#architettura)
- [RAG multi-tenant](#rag-multi-tenant)
- [Prerequisiti](#prerequisiti)
- [Autenticazione & Supabase](#autenticazione--supabase)
- [Quick start](#quick-start)
- [Bootstrap Supabase](#bootstrap-supabase)
- [Backend HTTP](#backend-http)
- [Interfaccia web](#interfaccia-web)
- [Scorciatoie da tastiera](#scorciatoie-da-tastiera)
- [Workflow tipico](#workflow-tipico)
- [Personalizzazione template PDF](#personalizzazione-template-pdf)
- [Struttura del repository](#struttura-del-repository)
- [Licenza](#licenza)

## Novità v4.0.0
- **Ingestion RAG multi-formato**: l'endpoint `POST /api/workspaces/:workspaceId/ingest` accetta testi, PDF e audio, normalizza i contenuti e li indicizza in background generando embedding OpenAI e metadati per workspace.【rec2pdf-backend/server.js†L2236-L2314】【rec2pdf-backend/server.js†L3010-L3043】
- **Knowledge Base manager nel frontend**: il tab "Knowledge Base" permette drag&drop, monitoraggio ingestion e lista dei documenti con chunk e formato, collegandosi automaticamente agli endpoint di ingest e listing.【rec2pdf-frontend/src/components/workspaces/WorkspaceProfilesManager.jsx†L916-L1324】【rec2pdf-frontend/src/components/workspaces/KnowledgeBaseManager.jsx†L1-L220】
- **Context retrieval automatico**: la pipeline unisce prompt, focus note, trascrizione e contesto RAG recuperato tramite Supabase prima di invocare Gemini, garantendo deliverable aderenti al workspace.【rec2pdf-backend/server.js†L4045-L4070】
- **Pipeline audio resiliente per registrazioni lunghe**: l'orchestrazione su Supabase Storage valida upload/transcodifica, applica retry ai download e gestisce file WAV temporanei per evitare interruzioni con registrazioni estese.【rec2pdf-backend/server.js†L2333-L2412】【rec2pdf-backend/server.js†L3840-L3897】

## Panoramica
Rec2PDF nasce per supportare team editoriali e professionisti che necessitano di verbalizzazioni affidabili. Il sistema accetta registrazioni vocali, file di testo già trascritti o Markdown esistente e coordina automaticamente:
1. normalizzazione e transcodifica audio,
2. trascrizione tramite Whisper,
3. generazione del contenuto in Markdown con regole derivate dai prompt scelti,
4. impaginazione in PDF professionale con template LaTeX dedicati,
5. archiviazione su Supabase Storage e analisi strutturale del documento.

La componente frontend guida l'utente con login (magic link o GitHub), diagnostica delle dipendenze, gestione di workspace/progetti, revisione del contenuto generato e accesso alla libreria cloud sincronizzata con Supabase.

## Modalità Base
La modalità **Base** è attiva per impostazione predefinita e offre un pannello essenziale incentrato sulla pipeline voce → PDF, accessibile a qualsiasi account abilitato al flag `MODE_BASE`. Il routing della pagina Create monta automaticamente questa modalità quando il contesto `ModeContext` restituisce `base` o quando l'utente non possiede il flag avanzato.【F:rec2pdf-frontend/src/pages/Create.jsx†L65-L90】【F:rec2pdf-frontend/src/context/ModeContext.tsx†L7-L177】

- **Executive pipeline con stato immediato**: hero, banner di completamento e guard-rail di connettività guidano l'utente attraverso lo stato corrente della pipeline e invitano a completare l'onboarding quando necessario.【F:rec2pdf-frontend/src/features/base/BaseHome.jsx†L10-L108】
- **Card REC unica**: registrazione e caricamento file sono unificati in una singola card che verifica permessi microfono, formato audio e livello d'ingresso prima di consentire la pubblicazione.【F:rec2pdf-frontend/src/features/base/UploadCard.jsx†L6-L138】
- **Pannello Publish**: progress bar, lista degli stadi (`Upload`, `Transcodifica`, `Whisper`, `Sintesi`, `Impaginazione`, `Conclusione`) e azioni rapide per download PDF/Markdown sono disponibili senza lasciare la vista principale.【F:rec2pdf-frontend/src/features/base/PipelinePanel.jsx†L15-L191】

## Modalità Advanced
La modalità **Advanced** abilita la “control room” boardroom experience. È disponibile agli utenti con il flag `MODE_ADVANCED` (persistito su Supabase e unito ai flag di default) e può essere affiancata alla modalità base per un’esperienza bimodale.【F:rec2pdf-frontend/src/pages/Create.jsx†L69-L187】【F:rec2pdf-frontend/src/context/ModeContext.tsx†L21-L258】

- **Control room modulare**: tab Destinazioni, Branding, Prompt, Diagnostica e Context Packs sono caricati lazy e strumentati con `trackEvent` per monitorare engagement su workspace, profili e libreria prompt.【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L1-L209】【F:rec2pdf-frontend/src/utils/analytics.ts†L29-L60】
- **Esperienza boardroom**: superfici, badge e highlight dinamici riprendono il tema `boardroom`, estendendo i controlli della pipeline con wizard workspace/progetto, upload logo PDF e gestione slug direttamente dalla dashboard.【F:rec2pdf-frontend/src/pages/Create.jsx†L92-L210】
- **Roadmap guidata da placeholder**: variabili d'ambiente `VITE_ENABLE_FS_INTEGRATION_PLACEHOLDER` e `VITE_ENABLE_RAG_PLACEHOLDER` mostrano card contestuali per preview funzionalità future e raccolta feedback degli stakeholder.【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L18-L109】

## Caratteristiche principali
- **Autenticazione centralizzata**: Supabase gestisce login (magic link e GitHub) e protegge tutte le rotte `/api` con bearer token automatici nel frontend.【F:rec2pdf-backend/server.js†L13-L105】【F:rec2pdf-frontend/src/App.jsx†L385-L439】【F:rec2pdf-frontend/src/components/LoginPage.jsx†L1-L82】
- **Pipeline audio end-to-end**: upload o registrazione browser, normalizzazione, trascrizione Whisper, generazione Markdown e pubblicazione PDF con log di stato e assegnazione workspace/progetto.【F:rec2pdf-backend/server.js†L1312-L1669】【F:rec2pdf-frontend/src/App.jsx†L1660-L1807】
- **Upload testo e Markdown**: endpoint dedicati per TXT e `.md` pre-esistenti replicano le fasi di generazione, consentendo reimpaginazioni e conversioni veloci con gli stessi metadati della pipeline audio.【F:rec2pdf-backend/server.js†L1673-L2348】【F:rec2pdf-frontend/src/App.jsx†L1810-L2075】
- **Prompt library e generazione guidata**: i prompt preconfigurati (con cue card, checklist e regole PDF) sono persistiti su filesystem, modificabili via API e applicati nel comando `gemini` che produce il Markdown finale.【F:rec2pdf-backend/server.js†L376-L445】【F:rec2pdf-backend/server.js†L833-L1250】【F:rec2pdf-frontend/src/App.jsx†L1360-L1456】
- **Impaginazione professionale**: `publish.sh` orchestra `pandoc`/`xelatex`, gestisce logo custom e fallback automatico, mentre il backend replica la stessa logica anche per rigenerazioni da Supabase.【F:Scripts/publish.sh†L1-L103】【F:rec2pdf-backend/server.js†L2003-L2055】【F:rec2pdf-backend/server.js†L2232-L2295】
- **Workspace Navigator**: gestione avanzata di clienti, progetti e stati con filtri salvabili, sincronizzazione pipeline e assegnazioni massive direttamente dalla cronologia.【F:rec2pdf-backend/server.js†L448-L676】【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L520-L719】
- **Cloud library su Supabase**: browsing, anteprima e download sicuro degli artefatti archiviati nei bucket (`processed-media`, `audio-uploads`, `text-uploads`) con query filtrate per workspace/progetto.【F:rec2pdf-backend/server.js†L2352-L2513】【F:rec2pdf-frontend/src/components/CloudLibraryPanel.jsx†L75-L198】
- **Knowledge base multi-formato**: carica testi, PDF e audio dal tab dedicato per avviare l'ingestione RAG, monitora chunk e metadati e sfrutta automaticamente il contesto durante la generazione dei documenti.【rec2pdf-backend/server.js†L2236-L2314】【rec2pdf-backend/server.js†L3010-L3043】【rec2pdf-frontend/src/components/workspaces/KnowledgeBaseManager.jsx†L1-L220】
- **Markdown editor e analisi struttura**: l'editor modale applica controlli su heading, checklist del prompt e completezza percentuale sfruttando la metrica calcolata dal backend.【F:rec2pdf-backend/server.js†L573-L643】【F:rec2pdf-frontend/src/App.jsx†L1980-L1999】【F:rec2pdf-frontend/src/components/MarkdownEditorModal.jsx†L1-L200】
- **Setup Assistant & diagnostica**: check list delle dipendenze CLI, verifica permessi di scrittura e fetch autenticati tramite l'hook `useBackendDiagnostics` integrato nell'onboarding.【F:rec2pdf-backend/server.js†L1274-L1309】【F:rec2pdf-frontend/src/hooks/useBackendDiagnostics.js†L1-L85】【F:rec2pdf-frontend/src/components/SetupAssistant.jsx†L1-L200】
- **Esperienza boardroom personalizzabile**: temi consultabili, loghi custom e wizard di onboarding sono salvati lato client e richiamabili dal cassetto impostazioni, con possibilità di creare workspace/progetti/stati senza lasciare la modale.【F:rec2pdf-frontend/src/App.jsx†L361-L714】【F:rec2pdf-frontend/src/components/layout/AppShell.jsx†L15-L139】【F:rec2pdf-frontend/src/components/layout/SettingsDrawer.jsx†L47-L199】

## Architettura
```text
┌────────────────┐   HTTP    ┌────────────────────┐    CLI    ┌────────────────────┐
│ Frontend (Vite │──────────►│ Backend Express    │──────────►│ Toolchain locale   │
│ + React)       │           │ orchestrator       │           │ ffmpeg/whisper/    │
└────────────────┘           └────────────────────┘           │ gemini/pandoc/...  │
        │                           │                        └────────────────────┘
        │ Supabase auth/session     │ Storage API
        ▼                           ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                             Supabase Cloud                                 │
│  • Auth (magic link, OAuth GitHub)                                         │
│  • Storage buckets: audio-uploads, text-uploads, processed-media           │
└────────────────────────────────────────────────────────────────────────────┘
```
- **Frontend**: single-page app con gestione locale di history, workspace, preferenze e sessione Supabase.【F:rec2pdf-frontend/src/App.jsx†L385-L475】
- **Backend**: Node.js Express che coordina pipeline, persiste configurazioni locali (`~/.rec2pdf`) e delega storage/autenticazione a Supabase.【F:rec2pdf-backend/server.js†L13-L736】
- **Toolchain**: dipendenze CLI eseguite tramite `child_process` con fallback e logging granulari (ffmpeg, whisper, gemini, ppubr, pandoc, xelatex).【F:rec2pdf-backend/server.js†L1274-L1300】【F:Scripts/publish.sh†L1-L103】
- **Supabase**: servizio esterno per autenticazione, gestione token e storage degli artefatti generati.【F:rec2pdf-backend/server.js†L15-L105】【F:rec2pdf-backend/server.js†L710-L760】【F:rec2pdf-backend/server.js†L2352-L2513】

## Prerequisiti
Installare i seguenti componenti sulla macchina che esegue backend/pipeline:
- Node.js ≥ 18 e npm ≥ 9.
- `ffmpeg` per la transcodifica.
- `whisper` CLI (modelli disponibili localmente).
- `whisperx` CLI (per diarizzazione multi-speaker; installabile con `pip install git+https://github.com/m-bain/whisperX` e richiede un token Hugging Face).
- `gemini` CLI (per generazione Markdown) e `ppubr/PPUBR` se si desidera la toolchain proprietaria.
- `pandoc` e `xelatex` (es. TeX Live) per l'esportazione PDF via script.
- Facoltativo: `fc-list` per il controllo font dal publish script.
- Account Supabase con progetto configurato (servizio Auth attivo) e bucket `audio-uploads`, `text-uploads`, `processed-media` con policy di lettura/scrittura per il servizio backend.【F:rec2pdf-backend/server.js†L710-L760】【F:rec2pdf-backend/server.js†L2352-L2513】

Verificare con la diagnostica interna (`Diagnostica` nell'UI) oppure manualmente:
```bash
ffmpeg -version
whisper --help
whisperx --help
pandoc --version
which gemini
which ppubr
```

## Autenticazione & Supabase
1. **Configura le variabili d'ambiente del backend** (`rec2pdf-backend/.env`):
   ```bash
   SUPABASE_URL="https://<your-project>.supabase.co"
   SUPABASE_SERVICE_KEY="<service_role_key>"
   HUGGING_FACE_TOKEN="<hf_token>"
   PROJECT_ROOT="$(pwd)"
   PUBLISH_SCRIPT="$(pwd)/Scripts/publish.sh"  # opzionale, default già corretto
   PUBLISH_BUNDLE_ROOT="$(pwd)"                # opzionale, punta alla cartella che contiene Scripts/ e Templates/
   WHISPER_MODEL=tiny  # es. per Cloud Run o container con memoria ridotta
   ```
   Il backend crea automaticamente il client Supabase, abilita l'autenticazione su tutte le rotte `/api` (eccetto `/api/health`) e mostra un warning se avviato senza credenziali o senza token Hugging Face, ricadendo in modalità sviluppo senza protezione o disattivando la diarizzazione.【rec2pdf-backend/server.js:13】【rec2pdf-backend/server.js:36】
2. **Crea i bucket di storage** nel progetto Supabase chiamandoli `audio-uploads`, `text-uploads`, `processed-media` e abilita le policy di lettura/scrittura per il ruolo `service_role`; gli upload/download falliscono se il client non è configurato.【F:rec2pdf-backend/server.js†L710-L760】【F:rec2pdf-backend/server.js†L736-L760】
3. **Imposta le variabili del frontend** (`rec2pdf-frontend/.env.local`):
   ```bash
   VITE_SUPABASE_URL="https://<your-project>.supabase.co"
   VITE_SUPABASE_ANON_KEY="<anon_public_key>"
   ```
   Il client Supabase del frontend usa questi valori per login via magic link o GitHub e per allegare automaticamente il token alle richieste verso il backend.【F:rec2pdf-frontend/src/supabaseClient.js†L1-L9】【F:rec2pdf-frontend/src/App.jsx†L385-L439】【F:rec2pdf-frontend/src/components/LoginPage.jsx†L1-L82】
4. **Configura i provider di autenticazione** in Supabase (email OTP e GitHub OAuth) e aggiorna gli URL di redirect verso l'origin del frontend (es. `http://localhost:5173`).【F:rec2pdf-frontend/src/components/LoginPage.jsx†L11-L66】
5. **Permessi locali e file di configurazione**: il backend continua a salvare workspaces e prompt sotto `~/.rec2pdf`, ma tutti gli artefatti (audio, trascrizioni, Markdown, PDF) vengono sincronizzati su Supabase Storage una volta completata la pipeline.【F:rec2pdf-backend/server.js†L448-L676】【F:rec2pdf-backend/server.js†L1312-L1669】【F:rec2pdf-backend/server.js†L2003-L2055】

## Quick start
1. **Clona il repository**
   ```bash
   git clone https://github.com/krea424/Rec2pdf.git
   cd Rec2pdf
   ```
2. **Backend**
   ```bash
   cd rec2pdf-backend
   npm install
   # crea un file .env con SUPABASE_URL e SUPABASE_SERVICE_KEY (vedi sezione dedicata)
   npm run dev   # espone le API su http://localhost:7788
   ```
   Il server Express usa `PORT`, `PROJECT_ROOT`, `PUBLISH_SCRIPT`, `TEMPLATES_DIR` e `ASSETS_DIR` se presenti nel `.env` ed esegue il publish script `Scripts/publish.sh` quando richiesto.【F:rec2pdf-backend/package.json†L1-L17】【F:rec2pdf-backend/server.js†L13-L83】
   > Per sfruttare la diarizzazione installa prima `whisperx` e definisci il token Hugging Face:
   > ```bash
   > pip install git+https://github.com/m-bain/whisperX
   > export HUGGING_FACE_TOKEN="hf_xxx"
   > ```
3. **Frontend** (nuovo terminale)
   ```bash
   cd rec2pdf-frontend
   npm install
   cat <<'EOF' > .env.local
   VITE_SUPABASE_URL=https://dvbijjzltpfjggkimqsg.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2YmlqanpsdHBmamdna2ltcXNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NjIyMzEsImV4cCI6MjA3NTMzODIzMX0.WTGFXu7FwlSMFOMtz6ULkhgFlEK_Cvl1bSz_jwWJvGw
   VITE_DEFAULT_MODE_FLAGS=MODE_BASE,MODE_ADVANCED
   VITE_BYPASS_AUTH=true
   EOF
   npm run dev   # interfaccia web su http://localhost:5173 (Vite adatta automaticamente la porta se occupata)
   ```
   L'opzione `VITE_BYPASS_AUTH` attiva il bypass login per demo locali, mentre i flag di default rendono disponibili entrambe le modalità fin dal primo avvio. Se dimentichi di impostare `VITE_DEFAULT_MODE_FLAGS`, il frontend usa automaticamente `MODE_BASE,MODE_ADVANCED` per evitare che il toggle sparisca; per limitare l'accesso puoi specificare esplicitamente solo `MODE_BASE` e affidarti a Supabase per abilitare l'advanced agli utenti selezionati.【F:rec2pdf-frontend/src/App.jsx†L17-L195】【F:rec2pdf-frontend/src/context/ModeContext.tsx†L21-L205】
4. Apri il browser sull'URL servito da Vite, configura se necessario l'endpoint backend (`http://localhost:7788` è il default) e lancia la diagnostica dall'onboarding banner.【F:rec2pdf-frontend/src/components/layout/AppShell.jsx†L16-L53】【F:rec2pdf-frontend/src/hooks/useBackendDiagnostics.js†L1-L86】
5. Cambia modalità direttamente dal toggle in header o dalla command palette per testare base e advanced senza ricaricare la pagina.【F:rec2pdf-frontend/src/components/layout/AppShell.jsx†L56-L156】【F:rec2pdf-frontend/src/components/CommandPalette.jsx†L59-L190】

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
  - `POST /api/text-upload`: stessa pipeline partendo da file `.txt` (senza fase di trascrizione).【F:rec2pdf-backend/server.js†L2058-L2348】
  - `POST /api/ppubr` e `POST /api/ppubr-upload`: rigenera PDF da Markdown già presente (locale o Supabase) o da upload manuale, applicando eventuali mappature speaker e scegliendo automaticamente il template più adatto.【rec2pdf-backend/server.js:3601】【rec2pdf-backend/server.js:3725】
  - `GET/POST/PUT/DELETE /api/workspaces`: CRUD dei workspace con aggiornamento automatico dello storage locale.【F:rec2pdf-backend/server.js†L1072-L1146】
  - `POST /api/workspaces/:workspaceId/ingest`: accoda fino a 20 file alla volta (testo, PDF, audio), estrae il contenuto e genera embedding in background per la knowledge base del workspace.【rec2pdf-backend/server.js†L2236-L2314】【rec2pdf-backend/server.js†L3010-L3043】
  - `GET /api/workspaces/:workspaceId/knowledge`: restituisce i documenti indicizzati con chunk, dimensione, projectId e timestamp filtrando automaticamente tra knowledge base di workspace e di progetto.【rec2pdf-backend/server.js†L4014-L4180】
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
1. Carica contenuti dal frontend (tab "Knowledge Base") oppure invia una richiesta `POST /api/workspaces/:workspaceId/ingest` con testi, PDF o audio: l'API accoda i file, ne estrae il testo, crea chunk e genera embedding OpenAI in background mantenendo metadati su nome, formato e chunk conteggi.【rec2pdf-backend/server.js†L2236-L2314】【rec2pdf-backend/server.js†L3010-L3043】【rec2pdf-frontend/src/components/workspaces/KnowledgeBaseManager.jsx†L1-L220】
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
  - Knowledge Base Manager con drag&drop, feedback sull'ingestione e lista dei documenti indicizzati per ogni workspace, direttamente dal cassetto impostazioni.【rec2pdf-frontend/src/components/workspaces/WorkspaceProfilesManager.jsx†L916-L1324】【rec2pdf-frontend/src/components/workspaces/KnowledgeBaseManager.jsx†L1-L220】
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
6. Segui lo stato della pipeline (transcode → trascrizione → Markdown → PDF) tramite i log animati e le notifiche di completezza del documento.【F:rec2pdf-frontend/src/App.jsx†L1688-L1768】【F:rec2pdf-backend/server.js†L1681-L1707】
7. Revisiona il Markdown nell'editor modale, assegna nomi reali agli speaker tramite il mapper incluso, salva le modifiche su Supabase e rigenera il PDF (anche con nomi applicati) direttamente dal browser.【rec2pdf-backend/server.js:3601】【rec2pdf-frontend/src/components/MarkdownEditorModal.jsx:207】【rec2pdf-frontend/src/components/SpeakerMapper.jsx:1】
8. Condividi o scarica gli artefatti dalla Cloud Library, utilizzando i link firmati generati dal backend.【F:rec2pdf-backend/server.js†L2352-L2513】【F:rec2pdf-frontend/src/components/CloudLibraryPanel.jsx†L75-L198】

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
