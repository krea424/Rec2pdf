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
1. Dopo login, `AppShell` mostra `OnboardingBanner` solo quando la diagnostica segnala un problema (`diagnostics.status === 'error'`).
2. L'utente apre `SetupAssistant` (`openSetupAssistant`) per seguire check-list (test microfono, backend health tramite `useBackendDiagnostics`).
3. Completando i passaggi, la banner scompare e la pipeline può essere eseguita con maggiore confidenza.

## 5. Ottimizzazione del flusso di configurazione

Questo documento mira a delineare i prossimi passi nell'ottimizzazione e semplificazione del user journey all'interno dell'applicazione App rec2pdf, concentrandosi in particolare sulla gestione delle configurazioni e dei progetti.

### Analisi del flusso attuale di configurazione

Attualmente, il processo di configurazione nell'applicazione App rec2pdf si articola in due fasi principali e distinte:

#### Fase 1: Gestione delle impostazioni generali

Questa fase si svolge all'interno del pannello delle impostazioni, dove l'utente può configurare i parametri e i criteri principali. Qui è possibile:

* **Creare, modificare o eliminare Workspace**: Il Workspace rappresenta il contenitore principale per le configurazioni.
* **Gestire elementi all'interno del Workspace selezionato**: Relativamente a un Workspace specifico, l'utente può:
  * Creare, modificare o eliminare **Profili**.
  * Creare, modificare o eliminare **Knowledge Base**.

È stato rilevato che, in questa fase, la gestione dei **Progetti** (creazione, modifica o eliminazione) non è prevista direttamente all'interno del pannello delle impostazioni del Workspace.

#### Fase 2: Selezione dei parametri per la pipeline

Successivamente, in un'interfaccia dedicata e separata, l'utente procede alla selezione dei parametri specifici che intende adottare per una determinata pipeline. Questa selezione include la specificazione di:

* Il **Workspace** desiderato.
* Il **Profilo** da associare.
* Il **Progetto** specifico su cui operare.

### Identificazione della criticità

La principale criticità emersa riguarda l'incoerenza nella gestione dei **Progetti**. Mentre Profili e Knowledge Base possono essere creati, modificati ed eliminati direttamente dal pannello delle impostazioni del Workspace, la medesima funzionalità non è disponibile per i Progetti. Questo costringe l'utente a un flusso di lavoro meno intuitivo e potenzialmente più frammentato per la gestione completa di tutti gli elementi operativi, dato che non è possibile creare, modificare o cancellare un progetto direttamente dalla sezione di configurazione del Workspace.

### Proposta di miglioramento

Per semplificare ulteriormente il user journey e garantire coerenza nella gestione delle configurazioni, si propone di estendere le funzionalità del pannello delle impostazioni del Workspace. Nello specifico, si dovrà:

* **Abilitare la gestione dei Progetti all'interno delle impostazioni del Workspace**: L'utente, dopo aver selezionato un Workspace, dovrà essere in grado di creare, modificare ed eliminare i Progetti associati a tale Workspace.
* **Introduzione di un'azione dedicata**: Sarà necessario aggiungere un apposito pulsante o un'opzione chiara, ad esempio "Crea Progetto", che permetta all'utente di eseguire tale operazione in modo diretto e integrato, analogamente a quanto già avviene per Profili e Knowledge Base.

### Piano di integrazione nel pannello del Workspace

Per rendere operativa la proposta sono previsti i seguenti interventi coordinati tra frontend e backend:

1. **Estensione delle API di gestione Workspace**
   * Endpoint REST `POST /api/workspaces/:workspaceId/projects` per creare nuovi progetti con nome, descrizione e profilo associato.
   * Endpoint `PATCH /api/workspaces/:workspaceId/projects/:projectId` per aggiornare metadati (nome, profilo, stato).
   * Endpoint `DELETE /api/workspaces/:workspaceId/projects/:projectId` per l'eliminazione sicura, con validazione che nessuna pipeline attiva faccia ancora riferimento al progetto.
   * Aggiornamento dei test Jest in `rec2pdf-backend/__tests__/workspaces.test.js` per coprire le nuove operazioni CRUD.

2. **Aggiornamento della UI delle impostazioni**
   * Nel componente `rec2pdf-frontend/src/components/layout/SettingsDrawer.jsx` aggiungere una nuova sezione "Progetti" accanto a Profili e Knowledge Base, popolata tramite hook `useWorkspaceProjects`.
   * Inserire un bottone primario "Crea progetto" che apra il modal esistente `WorkspaceEntityModal` (o una sua estensione) con i campi: nome progetto, profilo di default, knowledge base opzionale.
   * Abilitare azioni di modifica/eliminazione inline con menù contestuale `DropdownMenu` per coerenza con le altre entità.
   * Aggiornare gli stati globali in `context/workspaceSelection.ts` affinché i progetti creati dal drawer siano immediatamente disponibili nella pipeline senza refresh.

3. **Revisione del flusso pipeline**
   * Adeguare il wizard di selezione nella vista `/create` per leggere i progetti dall'elenco sincronizzato, rimuovendo il collegamento alla vecchia schermata di gestione separata.
   * Aggiornare la documentazione inline (`WorkspaceProjectSelector` docstring) per segnalare che ora la gestione avviene nel drawer.

4. **Onboarding e guida utente**
   * Integrare un tooltip contestuale o spotlight al primo accesso dopo l'aggiornamento, illustrando che i progetti sono ora gestibili dal pannello impostazioni.
   * Aggiornare `docs/ADVANCED_GUIDE.md` e `docs/UI.md` con screenshot e descrizione del nuovo flusso.

### Benefici attesi

Questa modifica consentirà di:

* **Migliorare l'esperienza utente**: Unificando la gestione di tutti gli elementi chiave in un'unica interfaccia logica.
* **Ridurre la complessità**: Eliminando la necessità di passare a interfacce diverse per operazioni simili.
* **Aumentare l'efficienza**: Permettendo una configurazione più rapida e intuitiva del contesto operativo.

### Conclusione

L'integrazione della gestione dei Progetti direttamente nel pannello delle impostazioni del Workspace rappresenta un passo fondamentale verso una maggiore semplificazione e coerenza del user journey in App rec2pdf. Il piano sopra delineato descrive gli interventi necessari per implementare l'integrazione end-to-end e garantire un'esperienza fluida, accompagnata da documentazione e onboarding aggiornati.
