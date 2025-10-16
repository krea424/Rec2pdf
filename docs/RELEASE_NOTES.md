# Release notes – vNext

## Highlight
- **Modalità bimodale**: la pagina Create ora offre percorsi dedicati per Base e Advanced con toggle persistente e analytics integrate sul cambio modalità.【F:README.md†L43-L55】【F:rec2pdf-frontend/src/context/ModeContext.tsx†L404-L437】
- **Control room aggiornata**: la dashboard avanzata centralizza destinazioni, branding, prompt e diagnostica con caricamento lazy e segnalazione di roadmap tramite placeholder configurabili.【F:docs/ADVANCED_GUIDE.md†L12-L48】【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L1-L209】
- **Design tokens**: Tailwind include ora spacing, raggi, ombre e palette estese per mantenere coerenza tra modalità e nuove superfici boardroom.【F:docs/UI.md†L23-L34】【F:rec2pdf-frontend/tailwind.config.js†L6-L78】

## KPI suggeriti
- **Tasso di completamento pipeline**: traccia gli eventi `pipeline.publish_requested`, `pipeline.export_pdf` e `pipeline.export_markdown` generati dal pannello Publish per misurare drop-off dopo il caricamento audio.【F:rec2pdf-frontend/src/features/base/PipelinePanel.jsx†L34-L188】
- **Tempo medio di configurazione workspace**: usa gli eventi `settings.section_opened` e `mode.toggle` per correlare quanto tempo passa tra apertura control room e invio pipeline.【F:rec2pdf-frontend/src/components/layout/SettingsDrawer.jsx†L57-L104】【F:rec2pdf-frontend/src/context/ModeContext.tsx†L404-L437】
- **Engagement libreria prompt**: monitora `advanced.dashboard.prompt_refresh`, `advanced.dashboard.prompt_library_open` e il conteggio prompt attivo per capire l'utilizzo della libreria avanzata.【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L30-L87】
- **Feedback roadmap**: misura i click su `advanced.dashboard.placeholder_fs`/`advanced.dashboard.placeholder_rag` per validare priorità delle integrazioni future.【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L88-L134】

## Stato feature flags
- `MODE_BASE`: sempre attivo via flag di default, garantisce accesso alla pipeline essenziale.【F:rec2pdf-frontend/src/context/ModeContext.tsx†L21-L177】
- `MODE_ADVANCED`: attivo di default per ambienti demo (`VITE_DEFAULT_MODE_FLAGS`, con fallback automatico a `MODE_BASE,MODE_ADVANCED` se la variabile manca) ma può essere revocato per profili senza permessi; gli utenti senza flag restano sulla modalità Base.【F:rec2pdf-frontend/.env.example†L1-L4】【F:rec2pdf-frontend/src/context/ModeContext.tsx†L24-L205】【F:rec2pdf-frontend/src/pages/Create.jsx†L69-L187】
- `VITE_BYPASS_AUTH`: flag operativo per ambienti locali/dimostrazione; disattivarlo su staging/produzione per preservare il login Supabase.【F:rec2pdf-frontend/src/App.jsx†L17-L195】
- `VITE_ENABLE_FS_INTEGRATION_PLACEHOLDER` / `VITE_ENABLE_RAG_PLACEHOLDER`: disattivati per default, mostrano card informative nella tab Context Packs quando settati su `true`/`1`/`yes`.【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L18-L109】

## Checklist rilascio
1. Aggiornare `.env` e `.env.local` sugli ambienti con i flag desiderati (es. mantenere `MODE_ADVANCED` solo per i team che hanno completato il training).【F:docs/ADVANCED_GUIDE.md†L8-L20】
2. Rieseguire smoke test base/advanced seguendo la demo script per assicurarsi che gli utenti senza flag avanzato restino operativi.【F:docs/ADVANCED_GUIDE.md†L50-L68】
3. Validare gli screenshot di modalità Base/Advanced prima dell'invio della release note pubblica, assicurandosi che corrispondano al tema boardroom aggiornato descritto nel README.【F:README.md†L43-L55】
4. Per deploy containerizzati (Cloud Run incluso) settare `WHISPER_MODEL=tiny` se non già presente: il backend applica automaticamente il modello `tiny` quando rileva l'ambiente Cloud Run, ma esplicitare la variabile in configurazione evita regressioni su revisioni precedenti o istanze riusate.【F:rec2pdf-backend/server.js†L2353-L2369】

## Backend
- Il fallback Pandoc installa automaticamente il pacchetto LaTeX `lmodern` (via `tlmgr`) se mancante, prevenendo i crash di compilazione PDF su Cloud Run privi della font family di default.【F:rec2pdf-backend/server.js†L163-L260】
