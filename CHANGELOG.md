# Changelog
All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
- Consulting-grade UI standards captured in `docs/UI.md`, covering layout grid, typography, accessibility, and keyboard patterns for the revamped interface.【F:docs/UI.md†L1-L64】
- Boardroom shell with onboarding banner, settings drawer, theme switcher, logo upload, device management e Setup Assistant integrato.【F:rec2pdf-frontend/src/components/layout/AppShell.jsx†L15-L139】【F:rec2pdf-frontend/src/components/layout/SettingsDrawer.jsx†L26-L199】【F:rec2pdf-frontend/src/App.jsx†L473-L714】
- Workspace Navigator con cache anteprime, filtri salvati persistenti, azioni rapide e propagazione della selezione nel form pipeline.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L61-L215】【F:rec2pdf-frontend/src/App.jsx†L560-L714】
- Cloud Library sincronizzata con la selezione workspace/progetto, sanitizzazione prefissi e feedback su bucket/prefix e richieste Supabase.【F:rec2pdf-frontend/src/components/CloudLibraryPanel.jsx†L6-L198】
- Modale editor Markdown con salvataggio, backup automatico e rigenerazione PDF; nuovi endpoint `/api/markdown` e `/api/ppubr` per editing e ripubblicazione sicura.【F:rec2pdf-frontend/src/components/MarkdownEditorModal.jsx†L9-L133】【F:rec2pdf-backend/server.js†L1733-L2055】【F:rec2pdf-backend/server.js†L2435-L2520】
- Pipeline con metriche struttura (score, sezioni mancanti, checklist prompt) incluse nelle risposte API e mostrate nella libreria.【F:rec2pdf-backend/server.js†L1681-L1707】【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L35-L58】

### Changed
- Frontend navigation adotta la shell boardroom con top navigation, onboarding banner e cassetto impostazioni condiviso.【F:rec2pdf-frontend/src/components/layout/AppShell.jsx†L15-L139】
- Storico e selezioni pipeline sono persistiti in `localStorage` (history, workspace, filtri, prompt) per ridurre l'onboarding ripetuto.【F:rec2pdf-frontend/src/App.jsx†L473-L714】
- Libreria locale e cloud condividono tabs e selezione, migliorando il passaggio fra cronologia e Supabase senza perdita di contesto.【F:rec2pdf-frontend/src/pages/Library.jsx†L6-L59】
- Pipeline audio/testo aggiornata con fallback publish/pandoc e caricamento logo custom dal frontend.【F:rec2pdf-backend/server.js†L1600-L1677】【F:rec2pdf-frontend/src/App.jsx†L1808-L1999】

### Migration
- Adotta `AppShell` e `SettingsDrawer` come guscio principale; elimina componenti legacy (`NavigatorRail`, `PrimaryCTAButton`) e riallinea le rotte alla top navigation.【F:rec2pdf-frontend/src/components/layout/AppShell.jsx†L15-L139】【F:rec2pdf-frontend/src/components/layout/SettingsDrawer.jsx†L26-L199】
- Persiste selezioni e filtri richiamando i nuovi helper (`WORKSPACE_SELECTION_KEY`, `WORKSPACE_FILTERS_KEY`, `PROMPT_SELECTION_KEY`) per mantenere continuità utente.【F:rec2pdf-frontend/src/App.jsx†L500-L714】
- Integra la checklist struttura restituita dal backend nelle feature custom e aggiorna eventuali trasformazioni Markdown per preservare i metadati aggiuntivi.【F:rec2pdf-backend/server.js†L1681-L1707】
