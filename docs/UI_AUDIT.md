# UI Audit

## Create (src/pages/Create.jsx)
- **Shell**: vista incapsulata da `AppShell` con banner di stato pipeline derivato da `headerStatus` del contesto (`src/components/layout/AppShell.jsx`, `src/App.jsx`).
- **Workspace setup**:
  - Pannello "Workspace attivo" con combo per selezione workspace, progetto e stato (`context.workspaceSelection`, `context.workspaceProjects`, `context.availableStatuses`).
  - Builder inline per creare workspace/progetti/stati (`context.workspaceBuilder*`, `handleCreateWorkspace`, `handleCreateProjectFromDraft`).
- **Prompt & profili**:
  - `PromptLibrary` per catalogo template e gestione preferiti (`src/components/PromptLibrary.jsx`).
  - Gestione profili workspace (`activeWorkspaceProfiles`, `workspaceProfileSelection`) e caricamento logo PDF.
- **Acquisizione audio**:
  - Card di registrazione con pulsanti `startRecording`/`stopRecording`, misuratore livello audio e fallback upload (`context.fileInputRef`, `context.onPickFile`).
  - Sezione riepilogo clip con player `<audio>` e CTA `processViaBackend` per avviare la pipeline.
- **Monitor pipeline**:
  - Cards `PIPELINE_STAGES` con stato e log (`context.pipelineStatus`, `context.logs`).
  - `Toast` di errore globale (`ErrorBanner`).

**Osservazioni UX**
- Molta densità di controlli; suggerita suddivisione in step collapsable per utenti nuovi.
- Azioni pipeline abilitate solo con `audioBlob`, feedback chiaro tramite highlight stage (`boardroomStageStyles`).
- Workspace builder inline potente ma richiede validazioni addizionali (es. conferma colori).

## Library (src/pages/Library.jsx)
- Switch tra tab "Cronologia" e "Cloud library" (`Tabs`, `TabsTrigger`).
- **Cronologia**: `WorkspaceNavigator` aggrega entry locali (`context.history`) e consente filtri, anteprima, assegnazioni.
- **Cloud library**: `CloudLibraryPanel` consuma API backend per file condivisi.
- Contesto fornisce `workspaceSelection`, `handleAssignEntryWorkspace`, `handleRefreshWorkspaces` per sincronizzare pipeline e libreria.

**Osservazioni UX**
- WorkspaceNavigator offre molte azioni contestuali (apri PDF/MD, rigenera, log, assegnazioni). Potrebbe beneficiare di quick-tour.
- Tabs senza indicatori di badge; aggiungere counts aiuterebbe priorità.

## Editor (src/pages/Editor.jsx)
- Wrapper minimale che espone `MarkdownEditorModal` come pagina dedicata.
- Modal gestisce editing Markdown con salvataggio (`handleMdEditorSave`), ripubblicazione (`handleRepublishFromEditor`) e apertura PDF (`handleMdEditorViewPdf`).
- Stato `mdEditor` nel contesto traccia `open`, `content`, `saving`, `lastAction`.

**Osservazioni UX**
- Accesso diretto tramite rotta `/editor`; assicurarsi che ritorno alla library sia evidente nel modal (pulsante chiusura).
- Considerare autosave / indicatori di versione per editing prolungato.
