# User Journeys

## 1. Creazione report audio → PDF
1. L'utente accede e atterra su **Create** (`/create`).
2. Seleziona o crea workspace/progetto/stato tramite i pannelli "Workspace attivo" (`context.workspaceSelection`, `handleCreateWorkspace`).
3. Sceglie un prompt da `PromptLibrary` o aggiorna focus/notes.
4. Registra audio (`startRecording`) oppure carica file tramite `input[type=file]` gestito da `onPickFile`.
5. Verifica clip in "Clip registrata / caricata" e avvia `processViaBackend`.
6. Osserva avanzamento pipeline (componenti stage + log). Al termine riceve `Pipeline completata` e link a Library.

## 2. Consultazione e gestione cronologia
1. Da **AppShell** seleziona tab **Library**.
2. In "Cronologia" usa `WorkspaceNavigator` per filtrare (workspace/progetto/stato/ricerca) e salva filtri.
3. Visualizza anteprima Markdown (`fetchPreview`), apre PDF (`onOpenPdf`) o rigenera (`onRepublish`).
4. Allinea documento al workspace corrente via `onAssignWorkspace` o rimuove associazione.
5. Passa a "Cloud library" per sfogliare risorse remote via `CloudLibraryPanel`.

## 3. Revisione Markdown
1. Da Library sceglie "Modifica PDF" su un entry (`handleOpenHistoryMd`) oppure dalla pipeline `handleOpenMdEditor`.
2. Naviga a `/editor`, dove `EditorPage` espone `MarkdownEditorModal`.
3. Modifica contenuto (`handleMdEditorChange`), salva (`handleMdEditorSave`) e se necessario ripubblica (`handleRepublishFromEditor`).
4. Torna alla library chiudendo il modal; stato `mdEditorDirty` previene uscite accidentali.

## 4. Onboarding & diagnostica
1. Dopo login, `AppShell` può mostrare `OnboardingBanner` se `shouldShowOnboardingBanner` è true.
2. L'utente apre `SetupAssistant` (`openSetupAssistant`) per seguire check-list (test microfono, backend health tramite `useBackendDiagnostics`).
3. Completando i passaggi, la banner scompare e la pipeline può essere eseguita con maggiore confidenza.
