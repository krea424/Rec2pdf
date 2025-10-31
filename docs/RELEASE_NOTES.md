# Release notes – vNext

## Highlight
- **Modalità bimodale**: la pagina Create ora offre percorsi dedicati per Base e Advanced con toggle persistente e analytics integrate sul cambio modalità.【F:README.md†L43-L55】【F:rec2pdf-frontend/src/context/ModeContext.tsx†L410-L452】
- **Control room boardroom v2**: gli utenti con `MODE_ADVANCED_V2` accedono a Setup Panel, Input Manager e Pipeline Overview rinnovati con card interattive, sezioni informative a scomparsa e call-to-action dirette verso la Library.【F:rec2pdf-frontend/src/pages/Create.jsx†L270-L362】【F:rec2pdf-frontend/src/features/advanced/SetupPanel.jsx†L96-L170】【F:rec2pdf-frontend/src/features/advanced/InputManager.jsx†L620-L780】【F:rec2pdf-frontend/src/features/advanced/PipelineOverview.jsx†L21-L162】
- **Feature flag telemetry**: ModeContext traccia l'esposizione dei flag sperimentali (`mode.flag_exposed`) per supportare rollout graduali e analisi post-release.【F:rec2pdf-frontend/src/context/ModeContext.tsx†L155-L208】【F:rec2pdf-frontend/src/context/__tests__/ModeContext.test.tsx†L65-L110】

## KPI suggeriti
- **Tasso di completamento pipeline**: traccia gli eventi `pipeline.publish_requested`, `pipeline.export_pdf` e `pipeline.export_markdown` generati dal pannello Publish per misurare drop-off dopo il caricamento audio.【F:rec2pdf-frontend/src/features/base/PipelinePanel.jsx†L34-L188】
- **Adozione control room v2**: monitora `mode.flag_exposed`, `mode.toggle` e gli eventi `advanced.settings.workspace_shortcut`/`advanced.control_room.start_pipeline` per valutare utilizzo e conversione dell'esperienza boardroom.【F:rec2pdf-frontend/src/context/ModeContext.tsx†L155-L208】【F:rec2pdf-frontend/src/pages/Create.jsx†L234-L362】
- **Accessibilità interazioni**: mantieni attivi i check Playwright+axe sulle card informative (`Informazioni su Carica ...`) per garantire contrasti e semantica corretta durante le iterazioni successive.【F:rec2pdf-frontend/tests/e2e/audio-to-pdf.spec.js†L76-L112】

## Stato feature flags
- `MODE_BASE`: sempre attivo via flag di default, garantisce accesso alla pipeline essenziale.【F:rec2pdf-frontend/src/context/ModeContext.tsx†L21-L177】
- `MODE_ADVANCED`: attivo di default per ambienti demo (`VITE_DEFAULT_MODE_FLAGS`, con fallback automatico a `MODE_BASE,MODE_ADVANCED` se la variabile manca) ma può essere revocato per profili senza permessi; gli utenti senza flag restano sulla modalità Base.【F:rec2pdf-frontend/.env.example†L1-L4】【F:rec2pdf-frontend/src/context/ModeContext.tsx†L24-L205】【F:rec2pdf-frontend/src/pages/Create.jsx†L69-L187】
- `MODE_ADVANCED_V2`: abilita la nuova control room boardroom e viene tracciato con `mode.flag_exposed`; abilitalo su Supabase da Authentication → Users aggiungendo `MODE_ADVANCED_V2` a `modeFlags` (insieme a `MODE_ADVANCED`) oppure preimpostalo con `VITE_DEFAULT_MODE_FLAGS=MODE_BASE,MODE_ADVANCED,MODE_ADVANCED_V2` per cohort locali.【F:rec2pdf-frontend/src/context/ModeContext.tsx†L148-L208】【F:rec2pdf-frontend/src/pages/Create.jsx†L288-L326】
- `VITE_BYPASS_AUTH`: flag operativo per ambienti locali/dimostrazione; disattivarlo su staging/produzione per preservare il login Supabase.【F:rec2pdf-frontend/src/App.jsx†L17-L195】
- `VITE_ENABLE_FS_INTEGRATION_PLACEHOLDER` / `VITE_ENABLE_RAG_PLACEHOLDER`: disattivati per default, mostrano card informative nella tab Context Packs quando settati su `true`/`1`/`yes`.【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L18-L109】

## Checklist rilascio
1. Aggiornare `.env` e `.env.local` sugli ambienti con i flag desiderati (abilita `MODE_ADVANCED_V2` solo sui cohort pronti a testare la nuova control room).【F:docs/ADVANCED_GUIDE.md†L8-L28】
2. Rieseguire smoke test base/advanced seguendo la demo script per assicurarsi che gli utenti senza flag avanzato restino operativi e che la control room v2 completi l'intero flusso audio→PDF.【F:docs/ADVANCED_GUIDE.md†L60-L116】
3. Validare gli screenshot di modalità Base/Advanced prima dell'invio della release note pubblica, assicurandosi che corrispondano al tema boardroom aggiornato descritto nel README.【F:README.md†L43-L55】
