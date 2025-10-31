# Guida alla modalità Advanced

La modalità **Advanced** estende Rec2PDF con una control room boardroom che unifica destinazioni, branding, prompt, diagnostica e sperimentazioni in un'unica vista. Questa guida riassume come abilitarla, quali moduli presidia e come presentarla agli stakeholder.

## Abilitazione e flag
- Il flag richiesto per la vista tradizionale è `MODE_ADVANCED`; può essere pre-popolato tramite `VITE_DEFAULT_MODE_FLAGS` (fallback automatico a `MODE_BASE,MODE_ADVANCED` quando la variabile non è presente) oppure assegnato da Supabase ai profili team. `ModeContext` fonde i flag locali con quelli remoti e sincronizza la preferenza su `localStorage` e, quando possibile, nel profilo Supabase.【F:rec2pdf-frontend/.env.example†L1-L4】【F:rec2pdf-frontend/src/context/ModeContext.tsx†L21-L205】
- Il rollout della nuova control room boardroom richiede anche `MODE_ADVANCED_V2`: una volta attivo il contesto emette `mode.flag_exposed` per facilitare il monitoraggio analitico del cohort invitato.【F:rec2pdf-frontend/src/context/ModeContext.tsx†L148-L208】【F:rec2pdf-frontend/src/context/__tests__/ModeContext.test.tsx†L65-L110】
  1. **Supabase** – Vai su Authentication → Users, apri il profilo dell'utente pilota e aggiungi `MODE_ADVANCED_V2` all'array `modeFlags` (mantieni anche `MODE_ADVANCED`). Conferma il JSON aggiornato e salva per sincronizzare il flag lato client.
  2. **Ambienti locali/demo** – Aggiungi `VITE_DEFAULT_MODE_FLAGS=MODE_BASE,MODE_ADVANCED,MODE_ADVANCED_V2` al file `.env.local` o alla pipeline di deploy per preattivare il cohort in assenza di Supabase.
  3. **Verifica** – Ricarica la pagina Create e controlla che il banner "Nuova control room in rollout" scompaia mostrando Setup Panel, Input Manager e Pipeline Overview.
- In ambienti demo abilita `VITE_BYPASS_AUTH=true` per saltare il login e mostrare subito il selettore modalità; Vite userà comunque le chiavi Supabase di default per caricare librerie e assets.【F:rec2pdf-frontend/src/App.jsx†L17-L195】

> Suggerimento rollout: popola `VITE_DEFAULT_MODE_FLAGS=MODE_BASE,MODE_ADVANCED,MODE_ADVANCED_V2` su staging per validare la UX, poi assegna il flag su Supabase solo agli utenti pilota in produzione.

## Pannelli della control room
- **Setup Panel**: riassume workspace, progetto, prompt e stato pipeline in un'unica hero con progress bar, pulsante "Avvia pipeline executive" e collegamento rapido alle impostazioni workspace.【F:rec2pdf-frontend/src/pages/Create.jsx†L210-L306】【F:rec2pdf-frontend/src/features/advanced/SetupPanel.jsx†L96-L170】
- **Input Manager**: raccoglie registrazione, upload audio/Markdown/TXT, selezione profilo workspace e logo PDF. I tre pulsanti "Informazioni su …" aprono schede contestuali accessibili per spiegare le automazioni associate.【F:rec2pdf-frontend/src/features/advanced/InputManager.jsx†L25-L220】【F:rec2pdf-frontend/src/features/advanced/InputManager.jsx†L620-L780】
- **Pipeline Overview**: visualizza lo stato delle fasi (upload → publish), evidenzia completamenti e offre il link diretto "Vai alla Library" una volta generato il documento.【F:rec2pdf-frontend/src/features/advanced/PipelineOverview.jsx†L21-L162】

## Operatività quotidiana
1. Passa alla modalità Advanced dal toggle header o dalla command palette (shortcut `A`) e verifica i flag disponibili tramite `context.modeFlags`.【F:rec2pdf-frontend/src/components/layout/AppShell.jsx†L56-L145】【F:rec2pdf-frontend/src/components/CommandPalette.jsx†L59-L190】【F:rec2pdf-frontend/src/App.jsx†L401-L448】
2. Configura contesto e prompt nel Setup Panel: il riassunto si aggiorna in tempo reale e il CTA rimane disabilitato finché non è presente una clip valida.【F:rec2pdf-frontend/src/pages/Create.jsx†L210-L306】【F:rec2pdf-frontend/src/features/advanced/SetupPanel.jsx†L96-L170】
3. Carica asset nel Input Manager (audio, Markdown, TXT) o registra una nuova sessione; le card mostrano dimensioni e formati e offrono download della registrazione corrente.【F:rec2pdf-frontend/src/features/advanced/InputManager.jsx†L233-L612】【F:rec2pdf-frontend/src/features/advanced/InputManager.jsx†L620-L780】
4. Segui l'elaborazione nella Pipeline Overview: l'animazione boardroom evidenzia la fase attiva e, al termine, appare il link "Vai alla Library" per aprire il documento pubblicato.【F:rec2pdf-frontend/src/features/advanced/PipelineOverview.jsx†L21-L162】

## Demo script per stakeholder
1. **Setup rapido** – Avvia backend (`npm run dev` nella cartella `rec2pdf-backend`) e frontend (`npm run dev` in `rec2pdf-frontend` con `VITE_BYPASS_AUTH=true`). Il banner di onboarding mostrerà lo stato diagnostica e il selettore modalità.【F:rec2pdf-backend/package.json†L1-L17】【F:rec2pdf-frontend/src/components/layout/AppShell.jsx†L16-L53】
2. **Modalità Base** – Mostra la hero "REC → Publish" e la card REC per illustrare quanto sia veloce passare dalla registrazione al publish, evidenziando progress bar e log recenti.【F:rec2pdf-frontend/src/features/base/BaseHome.jsx†L43-L108】【F:rec2pdf-frontend/src/features/base/PipelinePanel.jsx†L15-L191】
3. **Switch Advanced V2** – Usa il toggle (shortcut `A`) o la palette comandi per attivare Advanced, spiegando che la control room v2 è disponibile solo con `MODE_ADVANCED_V2` e che l'esposizione viene tracciata su `mode.flag_exposed`.【F:rec2pdf-frontend/src/components/layout/AppShell.jsx†L56-L107】【F:rec2pdf-frontend/src/components/CommandPalette.jsx†L88-L190】【F:rec2pdf-frontend/src/context/ModeContext.tsx†L155-L208】
4. **Setup Panel** – Seleziona workspace/progetto/prompt, mostra il badge di stato pipeline e lancia il CTA "Avvia pipeline executive" una volta caricato l'audio.【F:rec2pdf-frontend/src/pages/Create.jsx†L210-L306】【F:rec2pdf-frontend/src/features/advanced/SetupPanel.jsx†L96-L170】
5. **Input Manager** – Dimostra le card di upload con info a scomparsa (apri ogni pulsante Info e sottolinea i controlli accessibili verificati via axe).【F:rec2pdf-frontend/src/features/advanced/InputManager.jsx†L620-L780】【F:rec2pdf-frontend/tests/e2e/audio-to-pdf.spec.js†L76-L112】
6. **Pipeline Overview** – Segui l'avanzamento, mostra il pannello "Pipeline completata" e apri la Library dal link finale per chiudere la demo.【F:rec2pdf-frontend/src/features/advanced/PipelineOverview.jsx†L21-L162】

Seguendo la scaletta puoi dimostrare come la modalità Advanced mantenga compatibilità con la Base, introducendo al contempo strumenti decisionali per manager e team operations.

## Bootstrap Supabase per ambienti Advanced

Per demo executive o rollout multi-team assicurati che l'istanza Supabase sia allineata con lo schema cloud introdotto dalla migrazione.

1. **Applica le migrazioni SQL** presenti in `rec2pdf-backend/supabase/migrations/` (`supabase db push`) per creare tabelle `profiles`, `workspaces`, `prompts`, la colonna `metadata` e il bucket `logos` con policy dedicate.【F:rec2pdf-backend/supabase/migrations/20240725_draft_prompts_workspaces_profiles.sql†L1-L146】【F:rec2pdf-backend/supabase/migrations/20240801_add_metadata_to_workspaces.sql†L1-L12】【F:rec2pdf-backend/supabase/migrations/20240815_create_logos_bucket.sql†L1-L28】
2. **Sincronizza i dati legacy** con gli script CLI:
   - `node rec2pdf-backend/scripts/migrate-prompts.js [--dry-run]` per importare la libreria prompt da `~/.rec2pdf/prompts.json` con normalizzazione di checklist e regole PDF.【F:rec2pdf-backend/scripts/migrate-prompts.js†L1-L132】【F:rec2pdf-backend/scripts/migrate-prompts.js†L146-L198】
   - `node rec2pdf-backend/scripts/migrate-workspaces.js [--dry-run|--file]` per portare workspace/profili su Supabase, generando un manifest dei loghi locali da caricare manualmente.【F:rec2pdf-backend/scripts/migrate-workspaces.js†L1-L200】【F:rec2pdf-backend/scripts/migrate-workspaces.js†L240-L334】
   - `node rec2pdf-backend/scripts/migrate-logos.js` per pubblicare i loghi storici nel bucket `logos` e aggiornare `pdf_logo_url` nei profili.【F:rec2pdf-backend/scripts/migrate-logos.js†L1-L175】
3. **Verifica le policy RLS** collegate alla modalità Advanced (owner → workspace/profili/prompt) e aggiorna i flag utente tramite Supabase Auth per abilitare i toggles nel frontend.【F:rec2pdf-backend/supabase/migrations/20240725_draft_prompts_workspaces_profiles.sql†L53-L75】【F:rec2pdf-frontend/src/context/ModeContext.tsx†L21-L205】

Con il database bootstrapato e i dati migrati puoi presentare la control room advanced con workspace, progetti e branding già sincronizzati nel cloud.
