# Rec2PDF

<p align="center">
  <img src="logo_thinkDOC.svg" alt="Rec2PDF" width="260" />
</p>

Rec2PDF automatizza il flusso **voce → trascrizione → documento editoriale** trasformando i pensieri a voce alta, i brainstorming con se stessi e le registrazioni vocali in genere in PDF strutturati e pronti per la distribuzione. Il repository contiene sia il backend di orchestrazione della pipeline sia l'interfaccia utente evoluta per la gestione di workspace, prompt redazionali e pubblicazione.

## Sommario
- [Panoramica](#panoramica)
- [Caratteristiche principali](#caratteristiche-principali)
- [Architettura](#architettura)
- [Prerequisiti](#prerequisiti)
- [Avvio rapido](#avvio-rapido)
- [Backend HTTP](#backend-http)
- [Interfaccia web](#interfaccia-web)
- [Workflow tipico](#workflow-tipico)
- [Personalizzazione template PDF](#personalizzazione-template-pdf)
- [Struttura del repository](#struttura-del-repository)
- [Licenza](#licenza)

## Panoramica
Rec2PDF nasce per supportare team editoriali e professionisti che necessitano di verbalizzazioni affidabili. Il sistema accetta registrazioni vocali (o Markdown già scritto), esegue automaticamente:
1. normalizzazione audio,
2. trascrizione tramite Whisper,
3. generazione del contenuto in Markdown sfruttando prompt configurabili,
4. impaginazione in PDF professionale con template LaTeX dedicati.

La componente frontend guida l'utente attraverso diagnostica delle dipendenze, gestione degli archivi cliente/progetto e revisione del contenuto generato.

## Caratteristiche principali
- **Ingestione flessibile dell'audio**: registrazione browser o upload file, transcodifica automatica in WAV mono 16kHz (`ffmpeg`).
- **Trascrizione automatica**: integrazione con `whisper` (modello small IT di default) per ottenere testi accurati.【F:rec2pdf-backend/server.js†L118-L153】
- **Generazione guidata del documento**: pipeline `generateMarkdown` che applica regole contestuali derivate da prompt salvati dall'utente (tone of voice, checklist, callout ecc.).【F:rec2pdf-backend/server.js†L115-L147】【F:rec2pdf-frontend/src/App.jsx†L170-L219】
- **Impaginazione professionale**: script `Scripts/publish.sh` richiede `pandoc` + `xelatex`, gestisce cover, header/footer e logo personalizzato con fallback automatico su Pandoc se il publish script fallisce.【F:Scripts/publish.sh†L1-L103】【F:rec2pdf-backend/server.js†L148-L189】
- **Workspace Navigator**: catalogazione di clienti/progetti, stati personalizzati e versioning policy salvati localmente (`~/.rec2pdf/workspaces.json`). L'interfaccia consente filtri, assegnazioni e sincronizzazione con la pipeline.【F:rec2pdf-backend/server.js†L84-L115】【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L546-L1003】
- **Prompt Library & Cue Cards**: libreria di prompt con schede di supporto, checklist e regole PDF collegate; memorizzate in `~/.rec2pdf/prompts.json` e richiamabili durante l'esecuzione della pipeline.【F:rec2pdf-backend/server.js†L1-L83】【F:rec2pdf-frontend/src/App.jsx†L220-L344】
- **Markdown editor integrato**: revisione del testo con analisi struttura (heading mancanti, bullet, callout) e rielaborazione manuale prima della pubblicazione.【F:rec2pdf-frontend/src/App.jsx†L1506-L1704】
- **Setup Assistant & Diagnostics**: controllo delle dipendenze (`ffmpeg`, `whisper`, `gemini`, `ppubr`, `pandoc`) e verifica permessi cartelle direttamente dall'app.【F:rec2pdf-backend/server.js†L190-L229】【F:rec2pdf-frontend/src/hooks/useBackendDiagnostics.js†L1-L69】
- **API REST**: endpoint `/api/rec2pdf`, `/api/ppubr`, `/api/markdown` e `/api/workspaces` permettono integrazioni con tool esterni o automazioni interne.【F:rec2pdf-backend/server.js†L230-L350】【F:rec2pdf-backend/server.js†L760-L1653】

## Architettura
```text
┌────────────────┐        ┌────────────────────┐        ┌────────────────────┐
│  Frontend (Vite│  HTTP  │  Backend Express   │  CLI   │  Toolchain locale  │
│  + React)      ├────────►  API & orchestrator├────────►  ffmpeg / whisper  │
│                │        │                    │        │  gemini / ppubr    │
└────────────────┘        └────────────────────┘        │  pandoc / xelatex  │
                                                         └────────────────────┘
```
- **Frontend**: UI single-page, gestione stato client-side (localStorage) per history, workspace, preferenze.
- **Backend**: Node.js Express che coordina elaborazioni, salva configurazioni su filesystem locale (`~/.rec2pdf`), espone API JSON.
- **Toolchain**: dipendenze CLI eseguite tramite `child_process` con fallback e logging granulari.

## Prerequisiti
Installare i seguenti componenti sulla macchina che esegue backend/pipeline:
- Node.js ≥ 18 e npm ≥ 9.
- `ffmpeg` per la transcodifica.
- `whisper` CLI (modelli disponibili localmente).
- `gemini` CLI (per generazione Markdown) e `ppubr/PPUBR` se si desidera la toolchain proprietaria.
- `pandoc` e `xelatex` (es. TeX Live) per l'esportazione PDF via script.
- Facoltativo: `fc-list` per il controllo font dal publish script.

Verificare con la diagnostica interna (`Diagnostica` nell'UI) oppure manualmente:
```bash
ffmpeg -version
whisper --help
pandoc --version
which gemini
which ppubr
```

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
   npm run dev   # espone le API su http://localhost:7788
   ```
   Opzionale: creare un file `.env` per impostare `PORT`, `PROJECT_ROOT`, `PUBLISH_SCRIPT`, `TEMPLATES_DIR`, `ASSETS_DIR`.
3. **Frontend** (nuovo terminale)
   ```bash
   cd rec2pdf-frontend
   npm install
   npm run dev   # interfaccia web su http://localhost:5173
   ```
4. Apri il browser su `http://localhost:5173`, imposta l'URL backend se differente e lancia la diagnostica iniziale.

## Backend HTTP
- **Server principale**: `rec2pdf-backend/server.js`.
- **Storage locale**: crea automaticamente `~/.rec2pdf/workspaces.json` e `prompts.json` se mancanti, con bootstrap di default.【F:rec2pdf-backend/server.js†L32-L67】
- **Endpoint chiave**:
  - `POST /api/rec2pdf`: upload audio + (opzionale) logo, workspace, prompt; ritorna percorso PDF/MD, logs e metadati.
  - `POST /api/ppubr` & `POST /api/ppubr-upload`: importano Markdown esistente o orchestrano pipeline ppubr.
  - `GET/POST/PUT/DELETE /api/workspaces`: CRUD su workspace/progetti/stati.
  - `GET/POST/PUT/DELETE /api/prompts`: gestione prompt personalizzati.
  - `GET /api/markdown` & `PUT /api/markdown`: scarica/aggiorna file Markdown generati.
  - `GET /api/diag`: restituisce stato dipendenze e permessi.

Il backend accetta upload multipart (gestiti con `multer`) e costruisce nomi file coerenti con workspace e policy di retention.

## Interfaccia web
- **Stack**: React 18, Vite 5, Tailwind CSS 3, icone Lucide.
- **Funzionalità UI**:
  - Recorder/loader audio con timeline dei log pipeline e stato step-by-step.
  - Selettore workspace/progetto con filtri salvabili, colori e versioning policy visibili nel pannello laterale.
  - Libreria prompt con cue card, checklist e note contestuali applicate alla generazione.
  - Modale editor Markdown con anteprima struttura, suggerimenti, controllo bullet/callout.
  - Setup Assistant che guida le prime configurazioni, e pannello diagnostico per testare backend/toolchain.
  - Cronologia elaborazioni (persistita in `localStorage`) con link rapido a PDF/Markdown.

Costruzione produzione:
```bash
npm run build
npm run preview  # serve statico su http://localhost:4173
```

## Workflow tipico
1. Avvia backend e frontend, verifica la diagnostica.
2. Configura (o importa) workspace, progetti e stati personalizzati.
3. Crea/duplica un prompt dalla libreria e definisci tone of voice, checklist, regole PDF.
4. Registra o carica l'audio, associa workspace/progetto/stato e scegli il prompt.
5. Attendi la pipeline (transcode → trascrizione → Markdown → PDF) monitorando log e eventi.
6. Revisiona il Markdown nell'editor integrato, apporta modifiche e rigenera il PDF se necessario.
7. Scarica il PDF finale o condividi il percorso generato; i file restano nella cartella destinazione scelta (default `~/Recordings`).

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
