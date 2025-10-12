# Rec2PDF Interface Guidelines

These guidelines codify the consulting-grade UX overhaul of the Rec2PDF web application. They align brand storytelling with production-ready implementation details so designers and engineers can ship coherent experiences.

## Core Principles
- **Evidence-led simplicity**: Surface only the tasks a document producer needs in the current stage. Every screen must pass the "single-intent" test—if a component does not clarify the next action, it is removed or deferred to secondary navigation.
- **Narrative continuity**: Workspace, prompt, and publishing status appear in a shared header strip across the app. Users never lose the thread of where content is in the pipeline.
- **Resilient collaboration**: The UI must withstand intermittent connectivity and multi-device reviews. All components expose loading and offline states, and the layout remains usable on 1280px monitors or tablets.
- **Measurable accessibility**: Every new workflow is validated against WCAG 2.2 AA. Contrast ratios, focus handling, and keyboard flows are tracked in automated tests and manual QA.

## Layout Grid
- **Breakpoints**: 1280px base (desktop), 960px condense (laptop/tablet landscape), 768px stacked (tablet portrait), 480px compact (mobile fallback for diagnostics only).
- **Grid**: 12-column fluid grid with 24px gutters on desktop; collapse to 8 columns with 16px gutters below 960px; single-column stack below 768px.
- **Spacing scale**: 4px increments (`4, 8, 12, 16, 20, 24, 32, 40, 48, 64`). Components must snap to the scale to keep rhythm consistent between cards, drawers, and modals.
- **Containers**: Primary canvas constrained to `max-width: 1360px`, centered with 32px padding at ≥1280px and 20px padding below.

## Typography Scale
- **Font family**: `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- **Scale**: `Display 32/40`, `Headline 24/32`, `Title 20/28`, `Body 16/24`, `Caption 14/20`, `Micro 12/16` (`font-size/line-height` in px).
- **Weight usage**: Display/Headline at 600, Title at 600/500 for emphasis, Body and below at 400. Never combine more than two weights on a single view.
- **Code/metadata**: Use `"JetBrains Mono", "Fira Code", monospace` for logs and pipeline IDs.

## Component Usage
- **Shell**: `AppShell` gestisce il layout boardroom (header con logo/custom logo, onboarding banner, navigazione principale) e monta il `SettingsDrawer` per temi, diagnostica, builder workspace/progetti e gestione dispositivi.【F:rec2pdf-frontend/src/components/layout/AppShell.jsx†L15-L139】【F:rec2pdf-frontend/src/components/layout/SettingsDrawer.jsx†L26-L199】
- **Navigazione**: la barra superiore utilizza `NavLink` per Create/Library/Editor, mentre la libreria interna alterna cronologia/cloud tramite i componenti `Tabs`, `TabsList` e `TabsTrigger`. Mantieni le tab ghost e i badge coerenti con le classi fornite.【F:rec2pdf-frontend/src/components/layout/AppShell.jsx†L108-L125】【F:rec2pdf-frontend/src/pages/Library.jsx†L6-L59】【F:rec2pdf-frontend/src/components/ui/Tabs.jsx†L1-L74】
- **Primary actions**: usa `Button` e `IconButton` per CTA e controlli rapidi; rispettare varianti/size predefinite e spinner integrati (`isLoading`).【F:rec2pdf-frontend/src/components/ui/Button.jsx†L5-L129】
- **Drawer e modali**: `Drawer` fornisce overlay con gestione ESC/click esterno per il cassetto impostazioni; `MarkdownEditorModal` definisce struttura e comandi per l’editing Markdown.【F:rec2pdf-frontend/src/components/ui/Drawer.jsx†L1-L70】【F:rec2pdf-frontend/src/components/MarkdownEditorModal.jsx†L9-L133】
- **Forms**: `Input`, `Select`, `TextArea` e componenti helper allineano label, helper text e stati. Riutilizza le classi esistenti e collega `aria-describedby` quando fornisci messaggi contestuali.【F:rec2pdf-frontend/src/components/ui/Input.jsx†L1-L120】【F:rec2pdf-frontend/src/components/ui/Select.jsx†L1-L140】【F:rec2pdf-frontend/src/components/MarkdownEditorModal.jsx†L69-L94】
- **Data surfaces**: `WorkspaceNavigator` aggrega cronologia e metadata, `CloudLibraryPanel` dialoga con Supabase, e i log pipeline vengono visualizzati nella Create page. Le nuove viste devono derivare da questi pattern invece di introdurre container custom.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L61-L215】【F:rec2pdf-frontend/src/components/CloudLibraryPanel.jsx†L6-L198】【F:rec2pdf-frontend/src/pages/Create.jsx†L88-L160】
- **Control room avanzata**: `AdvancedDashboard` centralizza destinazioni, branding, prompt e diagnostica con tab lazy-loaded e placeholder opzionali per FS/RAG, riusando le stesse sezioni del cassetto impostazioni.【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L1-L180】【F:rec2pdf-frontend/src/components/layout/SettingsDrawer.jsx†L1-L109】

## State Patterns
- **Loading**: impiega `Skeleton` per superfici >240px (es. editor Markdown) e sfrutta `isLoading`/`loading` props su `Button` e pannelli (es. `WorkspaceNavigator` mostra spinner durante refresh). Evitare overlay bloccanti.【F:rec2pdf-frontend/src/components/ui/Skeleton.jsx†L1-L12】【F:rec2pdf-frontend/src/components/ui/Button.jsx†L37-L110】【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L61-L115】
- **Success**: usa `Toast` con `tone="success"` per conferme di salvataggio/rigenerazione; includi contesto (workspace/progetto) nella descrizione.【F:rec2pdf-frontend/src/components/ui/Toast.jsx†L3-L24】【F:rec2pdf-frontend/src/components/MarkdownEditorModal.jsx†L84-L95】
- **Error**: visualizza errori tramite `Toast` `tone="danger"` o banner dedicati (`ErrorBanner` in Create). Fornisci azioni contestuali (es. chiusura, retry) mantenendo focus sull’elemento interessato.【F:rec2pdf-frontend/src/components/ui/Toast.jsx†L3-L24】【F:rec2pdf-frontend/src/pages/Create.jsx†L19-L39】
- **Diagnostica/offline**: rappresenta stato backend con `backendUp` e `diagnostics` nel cassetto impostazioni/onboarding banner; quando la connessione manca invita l’utente ad aprire il Setup Assistant per la risoluzione guidata.【F:rec2pdf-frontend/src/components/layout/AppShell.jsx†L15-L53】【F:rec2pdf-frontend/src/components/layout/SettingsDrawer.jsx†L47-L138】【F:rec2pdf-frontend/src/hooks/useBackendDiagnostics.js†L3-L86】

## Keyboard Shortcuts
Keyboard accelerators non sono ancora attivi. Quando li introdurrai:
- Registra gli handler a livello di `App.jsx` così da propagare gli effetti via `AppProvider` e mantenere coerenza tra Create/Library/Editor.【F:rec2pdf-frontend/src/App.jsx†L473-L714】
- Assicurati che ogni scorciatoia abbia un equivalente visibile (es. pulsante o voce di menu) e che l’Help/Setup Assistant venga aggiornato di conseguenza.【F:rec2pdf-frontend/src/components/layout/SettingsDrawer.jsx†L47-L138】
- Prevedi preferenze per abilitare/disabilitare shortcut globali nel cassetto impostazioni prima della release pubblica.【F:rec2pdf-frontend/src/components/layout/SettingsDrawer.jsx†L47-L199】

## Accessibility Expectations
- Maintain minimum 4.5:1 contrast for text and 3:1 for large UI icons. Buttons in the brand tone must be tested against both light and dark backgrounds.
- Every interactive element requires a visible focus ring with 2px thickness and 4px corner radius. Do not rely solely on color changes for focus.
- Announce view changes with `aria-live="assertive"` messages when navigation occurs programmatically (e.g., auto-opening the Markdown editor after upload).
- Provide logical tab order: header → sidebar → main content → dialogs. Modals trap focus and restore it to the triggering element on close.
- Ensure screen reader labels include workspace, prompt, and artifact metadata so multi-document workflows remain distinguishable.

## Implementation Checklist
1. Progetta le schermate rispettando la griglia e valida le varianti 1280/960/768/480px in DevTools.
2. Componi le viste a partire da `AppShell`, `SettingsDrawer`, `WorkspaceNavigator`, `CloudLibraryPanel`, `MarkdownEditorModal`, `Button/IconButton`, `Tabs` e `Toast`; estensioni custom devono mantenere le stesse classi base.【F:rec2pdf-frontend/src/components/layout/AppShell.jsx†L15-L139】【F:rec2pdf-frontend/src/components/layout/SettingsDrawer.jsx†L26-L199】【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L61-L215】【F:rec2pdf-frontend/src/components/ui/Button.jsx†L5-L129】【F:rec2pdf-frontend/src/components/ui/Tabs.jsx†L1-L74】
3. Gestisci stato e preferenze tramite `AppProvider` (localStorage keys), `useBackendDiagnostics`, `useMicrophoneAccess` e i setter già esposti; evita duplicazioni globali.【F:rec2pdf-frontend/src/App.jsx†L473-L714】【F:rec2pdf-frontend/src/hooks/useBackendDiagnostics.js†L3-L86】【F:rec2pdf-frontend/src/hooks/useMicrophoneAccess.js†L1-L160】
4. Quando introduci shortcut o nuove azioni, sincronizzale con Setup Assistant/Settings e aggiungi fallback manuali per utenti touch.【F:rec2pdf-frontend/src/components/layout/SettingsDrawer.jsx†L47-L199】
5. Testa manualmente focus order, contrasto e annunci `role="status"` (`Toast`) prima della review; aggiungi test end-to-end quando disponibili.【F:rec2pdf-frontend/src/components/ui/Toast.jsx†L3-L24】【F:rec2pdf-frontend/src/components/MarkdownEditorModal.jsx†L41-L132】

## Telemetria & Feature Flags
- Strumenta le interazioni significative tramite `trackEvent`/`trackToggleEvent`. Il sink preferenziale è `window.analytics.track`, con fallback a `dataLayer`; in sviluppo logga su console.【F:rec2pdf-frontend/src/utils/analytics.ts†L1-L49】
- Gli eventi chiave includono apertura sezioni impostazioni (`settings.section_opened`), run diagnostica e tab del pannello avanzato. Evita payload sensibili inviando solo booleani/contatori.【F:rec2pdf-frontend/src/components/layout/SettingsDrawer.jsx†L57-L104】【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L22-L180】
- I placeholder “File system integration” e “Context packs per RAG” si attivano con `VITE_ENABLE_FS_INTEGRATION_PLACEHOLDER` e `VITE_ENABLE_RAG_PLACEHOLDER` nel file `.env` (`true`/`1`/`yes`).【F:rec2pdf-frontend/.env.example†L1-L3】【F:rec2pdf-frontend/src/features/advanced/AdvancedDashboard.tsx†L17-L65】

Following these standards keeps the Rec2PDF interface cohesive as new pipeline capabilities ship.
