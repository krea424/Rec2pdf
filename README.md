# Rec2PDF

<p align="center">
  <img src="logo_thinkDOC.svg" alt="Rec2PDF" width="260" />
</p>

Rec2PDF automatizza il flusso **voce → trascrizione → documento editoriale** trasformando i pensieri a voce alta, i brainstorming con se stessi e le registrazioni vocali in genere in PDF strutturati e pronti per la distribuzione. Oggi il progetto integra autenticazione e storage gestiti da Supabase, con un frontend che offre login, librerie cloud e strumenti di revisione, e un backend che coordina pipeline audio/testo, generazione Markdown e impaginazione.

## Sommario
- [Panoramica](#panoramica)
- [Caratteristiche principali](#caratteristiche-principali)
- [Architettura](#architettura)
- [Prerequisiti](#prerequisiti)
- [Autenticazione & Supabase](#autenticazione--supabase)
- [Avvio rapido](#avvio-rapido)
- [Backend HTTP](#backend-http)
- [Interfaccia web](#interfaccia-web)
- [Workflow tipico](#workflow-tipico)
- [Personalizzazione template PDF](#personalizzazione-template-pdf)
- [Struttura del repository](#struttura-del-repository)
- [Licenza](#licenza)

## Panoramica
Rec2PDF nasce per supportare team editoriali e professionisti che necessitano di verbalizzazioni affidabili. Il sistema accetta registrazioni vocali, file di testo già trascritti o Markdown esistente e coordina automaticamente:
1. normalizzazione e transcodifica audio,
2. trascrizione tramite Whisper,
3. generazione del contenuto in Markdown con regole derivate dai prompt scelti,
4. impaginazione in PDF professionale con template LaTeX dedicati,
5. archiviazione su Supabase Storage e analisi strutturale del documento.

La componente frontend guida l'utente con login (magic link o GitHub), diagnostica delle dipendenze, gestione di workspace/progetti, revisione del contenuto generato e accesso alla libreria cloud sincronizzata con Supabase.

## Caratteristiche principali
- **Autenticazione centralizzata**: Supabase gestisce login (magic link e GitHub) e protegge tutte le rotte `/api` con bearer token automatici nel frontend.【F:rec2pdf-backend/server.js†L13-L105】【F:rec2pdf-frontend/src/App.jsx†L385-L439】【F:rec2pdf-frontend/src/components/LoginPage.jsx†L1-L82】
- **Pipeline audio end-to-end**: upload o registrazione browser, normalizzazione, trascrizione Whisper, generazione Markdown e pubblicazione PDF con log di stato e assegnazione workspace/progetto.【F:rec2pdf-backend/server.js†L1312-L1669】【F:rec2pdf-frontend/src/App.jsx†L1660-L1807】
- **Upload testo e Markdown**: endpoint dedicati per TXT e `.md` pre-esistenti replicano le fasi di generazione, consentendo reimpaginazioni e conversioni veloci con gli stessi metadati della pipeline audio.【F:rec2pdf-backend/server.js†L1673-L2348】【F:rec2pdf-frontend/src/App.jsx†L1810-L2075】
- **Prompt library e generazione guidata**: i prompt preconfigurati (con cue card, checklist e regole PDF) sono persistiti su filesystem, modificabili via API e applicati nel comando `gemini` che produce il Markdown finale.【F:rec2pdf-backend/server.js†L376-L445】【F:rec2pdf-backend/server.js†L833-L1250】【F:rec2pdf-frontend/src/App.jsx†L1360-L1456】
- **Impaginazione professionale**: `publish.sh` orchestra `pandoc`/`xelatex`, gestisce logo custom e fallback automatico, mentre il backend replica la stessa logica anche per rigenerazioni da Supabase.【F:Scripts/publish.sh†L1-L103】【F:rec2pdf-backend/server.js†L2003-L2055】【F:rec2pdf-backend/server.js†L2232-L2295】
- **Workspace Navigator**: gestione avanzata di clienti, progetti e stati con filtri salvabili, sincronizzazione pipeline e assegnazioni massive direttamente dalla cronologia.【F:rec2pdf-backend/server.js†L448-L676】【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L520-L719】
- **Cloud library su Supabase**: browsing, anteprima e download sicuro degli artefatti archiviati nei bucket (`processed-media`, `audio-uploads`, `text-uploads`) con query filtrate per workspace/progetto.【F:rec2pdf-backend/server.js†L2352-L2513】【F:rec2pdf-frontend/src/components/CloudLibraryPanel.jsx†L75-L198】
- **Markdown editor e analisi struttura**: l'editor modale applica controlli su heading, checklist del prompt e completezza percentuale sfruttando la metrica calcolata dal backend.【F:rec2pdf-backend/server.js†L573-L643】【F:rec2pdf-frontend/src/App.jsx†L1980-L1999】【F:rec2pdf-frontend/src/components/MarkdownEditorModal.jsx†L1-L200】
- **Setup Assistant & diagnostica**: check list delle dipendenze CLI, verifica permessi di scrittura e fetch autenticati tramite l'hook `useBackendDiagnostics` integrato nell'onboarding.【F:rec2pdf-backend/server.js†L1274-L1309】【F:rec2pdf-frontend/src/hooks/useBackendDiagnostics.js†L1-L85】【F:rec2pdf-frontend/src/components/SetupAssistant.jsx†L1-L200】

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
- `gemini` CLI (per generazione Markdown) e `ppubr/PPUBR` se si desidera la toolchain proprietaria.
- `pandoc` e `xelatex` (es. TeX Live) per l'esportazione PDF via script.
- Facoltativo: `fc-list` per il controllo font dal publish script.
- Account Supabase con progetto configurato (servizio Auth attivo) e bucket `audio-uploads`, `text-uploads`, `processed-media` con policy di lettura/scrittura per il servizio backend.【F:rec2pdf-backend/server.js†L710-L760】【F:rec2pdf-backend/server.js†L2352-L2513】

Verificare con la diagnostica interna (`Diagnostica` nell'UI) oppure manualmente:
```bash
ffmpeg -version
whisper --help
pandoc --version
which gemini
which ppubr
```

## Autenticazione & Supabase
1. **Configura le variabili d'ambiente del backend** (`rec2pdf-backend/.env`):
   ```bash
   SUPABASE_URL="https://<your-project>.supabase.co"
   SUPABASE_SERVICE_KEY="<service_role_key>"
   PROJECT_ROOT="$(pwd)"
   PUBLISH_SCRIPT="$(pwd)/Scripts/publish.sh"  # opzionale, default già corretto
   ```
   Il backend crea automaticamente il client Supabase, abilita l'autenticazione su tutte le rotte `/api` (eccetto `/api/health`) e mostra un warning se avviato senza credenziali, ricadendo in modalità sviluppo senza protezione.【F:rec2pdf-backend/server.js†L13-L105】
2. **Crea i bucket di storage** nel progetto Supabase chiamandoli `audio-uploads`, `text-uploads`, `processed-media` e abilita le policy di lettura/scrittura per il ruolo `service_role`; gli upload/download falliscono se il client non è configurato.【F:rec2pdf-backend/server.js†L710-L760】【F:rec2pdf-backend/server.js†L736-L760】
3. **Imposta le variabili del frontend** (`rec2pdf-frontend/.env.local`):
   ```bash
   VITE_SUPABASE_URL="https://<your-project>.supabase.co"
   VITE_SUPABASE_ANON_KEY="<anon_public_key>"
   ```
   Il client Supabase del frontend usa questi valori per login via magic link o GitHub e per allegare automaticamente il token alle richieste verso il backend.【F:rec2pdf-frontend/src/supabaseClient.js†L1-L9】【F:rec2pdf-frontend/src/App.jsx†L385-L439】【F:rec2pdf-frontend/src/components/LoginPage.jsx†L1-L82】
4. **Configura i provider di autenticazione** in Supabase (email OTP e GitHub OAuth) e aggiorna gli URL di redirect verso l'origin del frontend (es. `http://localhost:5173`).【F:rec2pdf-frontend/src/components/LoginPage.jsx†L11-L66】
5. **Permessi locali e file di configurazione**: il backend continua a salvare workspaces e prompt sotto `~/.rec2pdf`, ma tutti gli artefatti (audio, trascrizioni, Markdown, PDF) vengono sincronizzati su Supabase Storage una volta completata la pipeline.【F:rec2pdf-backend/server.js†L448-L676】【F:rec2pdf-backend/server.js†L1312-L1669】【F:rec2pdf-backend/server.js†L2003-L2055】

## Avvio rapido
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
   Nel file `.env` puoi anche impostare `PORT`, `PROJECT_ROOT`, `PUBLISH_SCRIPT`, `TEMPLATES_DIR`, `ASSETS_DIR`.
3. **Frontend** (nuovo terminale)
   ```bash
   cd rec2pdf-frontend
   npm install
   # crea .env.local con VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
   npm run dev   # interfaccia web su http://localhost:5173
   ```
4. Apri il browser su `http://localhost:5173`, imposta l'URL backend se differente e lancia la diagnostica iniziale.

## Backend HTTP
- **Server principale**: `rec2pdf-backend/server.js`.
- **Persistenza locale**: crea automaticamente `~/.rec2pdf/workspaces.json` e `prompts.json` se mancanti, mantenendo metadati locali oltre agli artefatti salvati su Supabase.【F:rec2pdf-backend/server.js†L32-L67】【F:rec2pdf-backend/server.js†L448-L676】
- **Endpoint chiave** (tutti protetti da bearer token Supabase):
  - `POST /api/rec2pdf`: pipeline completa audio → PDF/Markdown; restituisce percorsi Supabase, eventi di stage, log e metadati workspace/prompt.【F:rec2pdf-backend/server.js†L1312-L1669】
  - `POST /api/text-upload`: stessa pipeline partendo da file `.txt` (senza fase di trascrizione).【F:rec2pdf-backend/server.js†L2058-L2348】
  - `POST /api/ppubr` e `POST /api/ppubr-upload`: rigenera PDF da Markdown già presente (locale o Supabase) o da upload manuale.【F:rec2pdf-backend/server.js†L1673-L2055】
  - `GET/POST/PUT/DELETE /api/workspaces`: CRUD dei workspace con aggiornamento automatico dello storage locale.【F:rec2pdf-backend/server.js†L1072-L1146】
  - `GET/POST/PUT/DELETE /api/prompts`: gestione dei prompt, inclusa validazione di cue card e checklist.【F:rec2pdf-backend/server.js†L1160-L1269】
  - `GET /api/markdown` & `PUT /api/markdown`: lettura e modifica dei Markdown su Supabase con backup automatico delle versioni precedenti.【F:rec2pdf-backend/server.js†L2375-L2462】
  - `GET /api/storage`: elenco degli oggetti in un bucket/prefisso; `GET /api/file`: genera URL firmati con scadenza breve per download sicuri.【F:rec2pdf-backend/server.js†L2352-L2513】
  - `GET /api/health` e `GET /api/diag`: healthcheck semplice e diagnostica completa delle dipendenze CLI/permessi.【F:rec2pdf-backend/server.js†L1272-L1309】

Il backend usa `multer` per gestire upload multipart, costruisce nomi coerenti con workspace/policy di versioning e sincronizza automaticamente file e log con i bucket Supabase.【F:rec2pdf-backend/server.js†L700-L760】【F:rec2pdf-backend/server.js†L1312-L2055】

## Interfaccia web
- **Stack**: React 18, Vite 5, Tailwind CSS 3, icone Lucide, client Supabase JS.【F:rec2pdf-frontend/package.json†L1-L25】
- **Funzionalità UI**:
  - Schermata di login con magic link e OAuth GitHub; il resto della SPA è disponibile solo a sessione Supabase attiva.【F:rec2pdf-frontend/src/App.jsx†L385-L439】【F:rec2pdf-frontend/src/components/LoginPage.jsx†L1-L82】
  - Recorder/loader audio con tracking in tempo reale dei log/stage della pipeline e salvataggio cronologia su `localStorage`.【F:rec2pdf-frontend/src/App.jsx†L1660-L1807】
  - Upload dedicati per Markdown e TXT, riuso delle stesse preferenze workspace/prompt e gestione fallback quando mancano alcune fasi della pipeline.【F:rec2pdf-frontend/src/App.jsx†L1810-L2075】
  - Prompt Library con preferiti, cue card e checklist interattive, sincronizzata con le API del backend.【F:rec2pdf-frontend/src/App.jsx†L1360-L1456】
  - Workspace Navigator evoluto con filtri salvabili, assegnazioni rapide e adozione dei metadati per la pipeline.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L520-L719】
  - Cloud Library collegata a Supabase Storage per sfogliare, filtrare e aprire artefatti firmati senza lasciare l'app.【F:rec2pdf-frontend/src/components/CloudLibraryPanel.jsx†L75-L198】
  - Modale editor Markdown con analisi struttura, checklist del prompt e repubblicazione diretta dal browser.【F:rec2pdf-frontend/src/App.jsx†L1980-L1999】【F:rec2pdf-frontend/src/components/MarkdownEditorModal.jsx†L1-L200】
  - Setup Assistant e diagnostica integrata (`useBackendDiagnostics`) per verificare dipendenze, permessi e connettività autenticata.【F:rec2pdf-frontend/src/hooks/useBackendDiagnostics.js†L1-L85】【F:rec2pdf-frontend/src/components/SetupAssistant.jsx†L1-L200】

Costruzione produzione:
```bash
npm run build
npm run preview  # serve statico su http://localhost:4173
```

## Workflow tipico
1. Avvia backend e frontend, esegui login con Supabase e verifica lo stato delle dipendenze dalla diagnostica integrata.【F:rec2pdf-frontend/src/App.jsx†L385-L439】【F:rec2pdf-frontend/src/hooks/useBackendDiagnostics.js†L1-L85】
2. Configura (o importa) workspace, progetti e stati personalizzati dal Navigator per popolare le opzioni di pipeline.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L520-L719】
3. Crea/duplica un prompt dalla libreria, imposta tone of voice, checklist e regole PDF e salvalo via API.【F:rec2pdf-frontend/src/App.jsx†L1360-L1456】【F:rec2pdf-backend/server.js†L1160-L1269】
4. Registra o carica l'audio (oppure trascina un TXT/Markdown) associando workspace, progetto e prompt desiderati.【F:rec2pdf-frontend/src/App.jsx†L1660-L2075】
5. Segui lo stato della pipeline (transcode → trascrizione → Markdown → PDF) tramite i log animati e le notifiche di completezza del documento.【F:rec2pdf-frontend/src/App.jsx†L1705-L1743】
6. Revisiona il Markdown nell'editor modale, salva le modifiche su Supabase e rigenera il PDF direttamente dal browser.【F:rec2pdf-backend/server.js†L2375-L2462】【F:rec2pdf-frontend/src/components/MarkdownEditorModal.jsx†L1-L138】
7. Condividi o scarica gli artefatti dalla Cloud Library, utilizzando i link firmati generati dal backend.【F:rec2pdf-backend/server.js†L2352-L2513】【F:rec2pdf-frontend/src/components/CloudLibraryPanel.jsx†L75-L198】

## Personalizzazione template PDF
La cartella [`Templates/`](Templates) contiene i file LaTeX usati da `publish.sh`:
- `default.tex`: layout principale.
- `header_footer.tex`: elementi ripetuti.
- `cover.tex`: pagina di copertina.

Per personalizzare:
1. Modifica i template mantenendo i placeholder Pandoc (`$body$`, `$logo$`, ecc.).
2. Esegui `Scripts/publish.sh path/al/documento.md` per testare localmente (richiede `pandoc` + `xelatex`).
3. Imposta `CUSTOM_PDF_LOGO` o carica un logo dal frontend per sovrascrivere l'asset di default (`assets/thinkDOC.pdf`).

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
