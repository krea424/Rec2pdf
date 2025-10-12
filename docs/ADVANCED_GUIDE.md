# Guida alla modalità Advanced

La modalità **Advanced** estende Rec2PDF con una control room boardroom che unifica destinazioni, branding, prompt, diagnostica e sperimentazioni in un'unica vista. Questa guida riassume come abilitarla, quali moduli presidia e come presentarla agli stakeholder.

## Abilitazione e flag
- Il flag richiesto è `MODE_ADVANCED`; può essere pre-popolato tramite `VITE_DEFAULT_MODE_FLAGS` (che ora ricade automaticamente su `MODE_BASE,MODE_ADVANCED` se non valorizzato) oppure assegnato da Supabase ai profili team. Il contesto `ModeContext` fonde i flag locali con quelli remoti e persiste la scelta in `localStorage` e nelle preferenze Supabase quando disponibili.【F:rec2pdf-frontend/.env.example†L1-L4】【F:rec2pdf-frontend/src/context/ModeContext.tsx†L21-L205】
- In ambienti demo abilita `VITE_BYPASS_AUTH=true` per saltare il login e mostrare subito il selettore modalità; Vite userà comunque le chiavi Supabase di default per caricare librerie e assets.【F:rec2pdf-frontend/src/App.jsx†L17-L195】
- I placeholder opzionali (`VITE_ENABLE_FS_INTEGRATION_PLACEHOLDER`, `VITE_ENABLE_RAG_PLACEHOLDER`) permettono di visualizzare idee di roadmap nella tab Context Packs senza introdurre feature incomplete nel codice di produzione.【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L18-L109】

## Pannelli della control room
- **Destinazioni**: richiama `WorkspaceSection` per gestione workspace/profili direttamente dalla dashboard avanzata, riutilizzando la stessa logica del cassetto impostazioni.【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L1-L209】【F:rec2pdf-frontend/src/features/settings/sections/WorkspaceSection.tsx†L1-L7】
- **Branding**: consente di aggiornare loghi PDF e temi usando `BrandingSection`, con lazy loading per ridurre il time-to-interactive.【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L1-L209】
- **Prompt**: la panoramica mostra conteggio totale, preferiti e prompt attivo, con pulsanti rapidi per aggiornare la libreria o raggiungere l'ancora `prompt-library`. Gli eventi vengono tracciati tramite `trackEvent` per alimentare le analytics prodotto.【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L30-L87】【F:rec2pdf-frontend/src/utils/analytics.ts†L29-L60】
- **Diagnostica**: esegue il fetch del modulo `DiagnosticsSection` per riproporre gli stessi controlli dell'onboarding, utile in review executive.【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L12-L76】
- **Context Packs**: aggrega placeholder configurabili o un messaggio neutro quando i flag sono spenti, così da raccontare gli esperimenti futuri mantenendo l'interfaccia stabile.【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L80-L134】

## Operatività quotidiana
1. Dal toggle in header o dalla command palette passa in modalità Advanced, verificando che il badge `MODE_ADVANCED` sia disponibile nel contesto utente.【F:rec2pdf-frontend/src/components/layout/AppShell.jsx†L56-L145】【F:rec2pdf-frontend/src/components/CommandPalette.jsx†L59-L190】
2. Seleziona workspace/progetti dal blocco Destinazioni: le azioni si riflettono immediatamente sui form pipeline e sulle librerie collegati a Supabase.【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L168-L209】【F:rec2pdf-frontend/src/App.jsx†L1360-L2075】
3. Aggiorna branding (logo PDF, tema) senza uscire dalla vista; le modifiche vengono propagate ai componenti `AppShell` e `PipelinePanel` mantenendo il look & feel boardroom.【F:rec2pdf-frontend/src/App.jsx†L361-L714】【F:rec2pdf-frontend/src/features/base/PipelinePanel.jsx†L15-L191】
4. Apri la tab Prompt per consultare le metriche (conteggio, preferiti, persona attiva) e lanciare il refresh della libreria; ogni azione alimenta l'analytics layer per monitorare adozione e bisogno di nuovi template.【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L30-L87】【F:rec2pdf-frontend/src/utils/analytics.ts†L29-L60】
5. Usa la tab Context Packs per discutere le integrazioni future; il bottone "Invia feedback" invia eventi anonimi così da raccogliere insight senza roadmap formale.【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L88-L134】

## Demo script per stakeholder
1. **Setup rapido** – Avvia backend (`npm run dev` nella cartella `rec2pdf-backend`) e frontend (`npm run dev` in `rec2pdf-frontend` con `VITE_BYPASS_AUTH=true`). Il banner di onboarding mostrerà lo stato diagnostica e l'opzione per lanciare il Setup Assistant.【F:rec2pdf-backend/package.json†L1-L17】【F:rec2pdf-frontend/src/components/layout/AppShell.jsx†L16-L53】
2. **Modalità Base** – Mostra la hero "REC → Publish" e la card REC per illustrare quanto sia veloce passare dalla registrazione al publish, evidenziando progress bar e log recenti.【F:rec2pdf-frontend/src/features/base/BaseHome.jsx†L43-L108】【F:rec2pdf-frontend/src/features/base/PipelinePanel.jsx†L15-L191】
3. **Switch Advanced** – Attiva la modalità avanzata dal toggle (shortcut `B`/`A`) per dimostrare la persistenza della preferenza e l'assenza di reload.【F:rec2pdf-frontend/src/components/layout/AppShell.jsx†L56-L107】【F:rec2pdf-frontend/src/components/CommandPalette.jsx†L88-L190】
4. **Control room** – Naviga le tab Destinazioni → Branding → Prompt → Diagnostica, sottolineando lazy load, metriche e tracce analytics per misurare engagement di configurazione.【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L1-L209】【F:rec2pdf-frontend/src/utils/analytics.ts†L29-L60】
5. **Roadmap** – Attiva temporaneamente i placeholder Context Packs per condividere la visione FS/RAG e raccogliere feedback dal pulsante dedicato.【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L88-L134】
6. **Chiudi con KPI** – Mostra nella command palette i comandi rapidi e ricorda che tutti gli eventi chiave finiscono su `trackEvent`, facilitando la definizione di metriche quali tasso di completamento pipeline e tempo medio di configurazione prompt.【F:rec2pdf-frontend/src/components/CommandPalette.jsx†L59-L190】【F:rec2pdf-frontend/src/utils/analytics.ts†L29-L60】

Seguendo la scaletta puoi dimostrare come la modalità Advanced mantenga compatibilità con la Base, introducendo al contempo strumenti decisionali per manager e team operations.
