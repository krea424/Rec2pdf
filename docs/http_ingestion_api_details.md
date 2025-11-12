### Descrizione Dettagliata del Processo di Ingestione via HTTP in `server.js`

Il file `rec2pdf-backend/server.js` implementa un endpoint API dedicato all'ingestione di file per la knowledge base, confermando pienamente l'ipotesi di un meccanismo di upload HTTP.

**1. Definizione della Rotta API:**
*   **Metodo e URL:** `app.post('/api/workspaces/:workspaceId/ingest')`
    *   Questa rotta accetta richieste `POST` e include un parametro dinamico `:workspaceId` nell'URL, indicando che i file vengono caricati in un contesto di workspace specifico.
*   **Middleware `multer`:** `knowledgeUpload.array('files', 20)`
    *   Viene utilizzato il middleware `multer` (precedentemente configurato con `const knowledgeUpload = multer({ dest: KNOWLEDGE_UPLOAD_BASE });`) per gestire l'upload di file.
    *   `array('files', 20)` significa che l'endpoint si aspetta un campo `files` nel form `multipart/form-data` e può accettare fino a 20 file contemporaneamente. I file caricati vengono temporaneamente salvati nella directory `KNOWLEDGE_UPLOAD_BASE` (definita come `path.join(os.tmpdir(), 'rec2pdf_knowledge_uploads')`).

**Codice rilevante per la configurazione di Multer:**
```javascript
const UP_BASE = path.join(os.tmpdir(), 'rec2pdf_uploads');
if (!fs.existsSync(UP_BASE)) fs.mkdirSync(UP_BASE, { recursive: true });

const uploadMiddleware = multer({ dest: UP_BASE });
const KNOWLEDGE_UPLOAD_BASE = path.join(os.tmpdir(), 'rec2pdf_knowledge_uploads');
if (!fs.existsSync(KNOWLEDGE_UPLOAD_BASE)) fs.mkdirSync(KNOWLEDGE_UPLOAD_BASE, { recursive: true });
const knowledgeUpload = multer({ dest: KNOWLEDGE_UPLOAD_BASE });
// ... altre configurazioni multer ...
```

**2. Estrazione dei Dati dalla Richiesta:**
*   **File Caricati:** I file caricati sono disponibili tramite `req.files` (un array di oggetti file forniti da `multer`).
*   **`workspaceId`:** Viene estratto dal parametro URL (`req.params.workspaceId`) o da `req.body` / `req.query`.
*   **`projectId` e `projectName`:** Possono essere forniti nel corpo della richiesta (`req.body`) o nei parametri di query (`req.query`), permettendo di associare i file a un progetto specifico all'interno del workspace.

**3. Validazioni Iniziali:**
*   **`workspaceId`:** Viene verificato che sia presente.
*   **`supabase` e `OpenAI`:** Il sistema controlla che Supabase sia configurato (per l'archiviazione) e che il servizio AI (OpenAI, in questo caso) sia disponibile per la generazione degli embedding. Se uno dei due non è configurato, l'ingestione viene rifiutata.
*   **File Presenti:** Viene controllato che almeno un file sia stato caricato.
*   **Autenticazione:** Viene verificato l'ID dell'utente (`req.user.id`) per assicurarsi che solo utenti autenticati possano avviare l'ingestione.
*   **Autorizzazione (Workspace):** Il sistema recupera il `workspace` dal database (`getWorkspaceFromDb`) per assicurarsi che l'utente abbia accesso al workspace specificato.

**4. Risoluzione del Contesto del Progetto:**
*   Se vengono forniti `projectId` o `projectName`, il codice tenta di risolvere il progetto all'interno del workspace dell'utente. Questo assicura che i file siano correttamente associati al contesto di un progetto esistente. Se il progetto non viene trovato, viene emesso un warning o un errore a seconda della situazione.

**5. Accodamento del Task di Ingestione:**
*   **`ingestionId`:** Viene generato un ID univoco per l'ingestione.
*   **Normalizzazione dei File:** I dettagli dei file caricati (`path`, `originalname`, `mimetype`, `size`) vengono normalizzati.
*   **`enqueueKnowledgeIngestion`:** La parte cruciale: invece di processare i file immediatamente, viene creato un oggetto `task` contenente tutti i dettagli necessari (ID del workspace, ID del progetto, dettagli dei file, ID dell'ingestione) e viene aggiunto a una coda tramite `enqueueKnowledgeIngestion`. Questo delega l'elaborazione effettiva a un processo in background (`processKnowledgeQueue`), rendendo l'API responsiva e robusta.

**Codice rilevante per l'accodamento:**
```javascript
const knowledgeIngestionQueue = [];
let knowledgeIngestionProcessing = false;

const processKnowledgeQueue = async () => {
  if (knowledgeIngestionProcessing) {
    return;
  }
  knowledgeIngestionProcessing = true;
  while (knowledgeIngestionQueue.length) {
    const task = knowledgeIngestionQueue.shift();
    try {
      await processKnowledgeTask(task);
    } catch (error) {
      console.error('Errore processo ingestion knowledge:', error);
    }
  }
  knowledgeIngestionProcessing = false;
};

const enqueueKnowledgeIngestion = (task) => {
  if (!task) {
    return;
  }
  knowledgeIngestionQueue.push(task);
  setImmediate(processKnowledgeQueue);
};

const processKnowledgeTask = async (task = {}) => {
  const {
    workspaceId,
    projectId = '',
    projectOriginalId = '',
    projectName = '',
    files = [],
    ingestionId,
  } = task;
  // ... (logica di validazione e setup) ...

  for (const file of files) {
    const fileLabel = file?.originalName || file?.originalname || path.basename(file?.path || '') || 'file';
    try {
      const rawText = await extractTextFromKnowledgeFile(file);
      const normalized = normalizeKnowledgeText(rawText);
      const chunks = createKnowledgeChunks(normalized);
      // ... (generazione embedding e salvataggio su Supabase) ...
    } catch (error) {
      console.error(`Errore ingestione knowledge per ${fileLabel}:`, error);
    } finally {
      // ... (pulizia file temporanei) ...
    }
  }
};
```

**6. Risposta API:**
*   L'API risponde con uno stato `202 Accepted`, indicando che la richiesta è stata accettata per l'elaborazione.
*   La risposta include l'`ingestionId`, il numero di file accodati e un messaggio che conferma l'avvio dell'ingestione in background.

**Codice completo della rotta API:**
```javascript
app.post(
  '/api/workspaces/:workspaceId/ingest',
  knowledgeUpload.array('files', 20),
  async (req, res) => {
    const uploadedFiles = Array.isArray(req.files) ? req.files : [];
    const paramId = typeof req.params?.workspaceId === 'string' ? req.params.workspaceId.trim() : '';
    const workspaceId = paramId || getWorkspaceIdFromRequest(req);
    const rawProjectId =
      typeof req.body?.projectId === 'string'
        ? req.body.projectId
        : typeof req.body?.workspaceProjectId === 'string'
          ? req.body.workspaceProjectId
          : typeof req.query?.projectId === 'string'
            ? req.query.projectId
            : typeof req.query?.workspaceProjectId === 'string'
              ? req.query.workspaceProjectId
              : '';
    const requestedProjectId = sanitizeProjectIdentifier(rawProjectId);
    const rawProjectName =
      typeof req.body?.projectName === 'string'
        ? req.body.projectName
        : typeof req.body?.workspaceProjectName === 'string'
          ? req.body.workspaceProjectName
          : typeof req.query?.projectName === 'string'
            ? req.query.projectName
            : typeof req.query?.workspaceProjectName === 'string'
              ? req.query.workspaceProjectName
              : '';
    const requestedProjectName = sanitizeProjectName(rawProjectName);

    if (!workspaceId) {
      await cleanupKnowledgeFiles(uploadedFiles);
      return res.status(400).json({ ok: false, message: 'workspaceId obbligatorio' });
    }

    if (!supabase) {
      await cleanupKnowledgeFiles(uploadedFiles);
      return res
        .status(503)
        .json({ ok: false, message: 'Supabase non configurato: impossibile indicizzare la knowledge base.' });
    }

    try {
      getAIService('openai', process.env.OPENAI_API_KEY);
    } catch (error) {
      await cleanupKnowledgeFiles(uploadedFiles);
      return res
        .status(503)
        .json({ ok: false, message: 'OpenAI non configurato: impossibile generare embedding per la knowledge base.' });
    }

    if (!uploadedFiles.length) {
      return res.status(400).json({ ok: false, message: 'Carica almeno un file da indicizzare.' });
    }

    const ownerId = typeof req.user?.id === 'string' ? req.user.id.trim() : '';
    if (!ownerId) {
      await cleanupKnowledgeFiles(uploadedFiles);
      return res.status(403).json({ ok: false, message: 'Utente non autorizzato' });
    }

    let workspace;
    try {
      workspace = await getWorkspaceFromDb(workspaceId, { ownerId });
      if (!workspace) {
        await cleanupKnowledgeFiles(uploadedFiles);
        return res.status(404).json({ ok: false, message: 'Workspace non trovato' });
      }
    } catch (workspaceError) {
      await cleanupKnowledgeFiles(uploadedFiles);
      return res.status(500).json({ ok: false, message: workspaceError?.message || 'Recupero workspace non riuscito' });
    }

    let knowledgeProjectScopeId = '';
    let knowledgeProjectOriginalId = '';
    let knowledgeProjectName = '';
    if (workspace && (requestedProjectId || requestedProjectName)) {
      const projects = Array.isArray(workspace.projects) ? workspace.projects : [];
      const normalizedProjectId = sanitizeProjectIdentifier(requestedProjectId);
      const normalizedProjectName = sanitizeProjectName(requestedProjectName);
      const projectById = normalizedProjectId
        ? projects.find((proj) => sanitizeProjectIdentifier(proj?.id) === normalizedProjectId)
        : null;
      const normalizedName = normalizedProjectName ? normalizedProjectName.toLowerCase() : '';
      const projectByName = !projectById && normalizedName
        ? projects.find(
            (proj) => sanitizeProjectName(proj?.name).toLowerCase() === normalizedName
          )
        : null;
      const targetProject = projectById || projectByName || null;
      if (!targetProject) {
        if (!normalizedProjectId) {
          await cleanupKnowledgeFiles(uploadedFiles);
          return res.status(404).json({ ok: false, message: 'Progetto non trovato nel workspace' });
        }
        console.warn(
          `⚠️  Progetto ${normalizedProjectId} non trovato nel workspace ${workspaceId}: procedo utilizzando l'ID fornito.`
        );
        const fallbackScope = resolveProjectScopeIdentifiers(normalizedProjectId);
        knowledgeProjectScopeId = fallbackScope.canonicalId;
        knowledgeProjectOriginalId = fallbackScope.originalId || normalizedProjectId;
        knowledgeProjectName = normalizedProjectName || '';
      } else {
        const resolvedScope = resolveProjectScopeIdentifiers(targetProject.id);
        knowledgeProjectScopeId = resolvedScope.canonicalId;
        knowledgeProjectOriginalId = resolvedScope.originalId;
        knowledgeProjectName = sanitizeProjectName(targetProject.name) || normalizedProjectName || '';
      }
    }

    const ingestionId = crypto.randomUUID();
    const normalizedFiles = uploadedFiles.map((file) => ({
      path: file.path,
      originalName: file.originalname || file.filename || path.basename(file.path),
      mimetype: file.mimetype || '',
      size: Number.isFinite(file.size) ? file.size : Number(file.size) || undefined,
    }));

    enqueueKnowledgeIngestion({
      workspaceId: workspaceId.trim(),
      projectId: knowledgeProjectScopeId || null,
      projectOriginalId: knowledgeProjectOriginalId || null,
      projectName: knowledgeProjectName || null,
      files: normalizedFiles,
      ingestionId,
    });

    res.status(202).json({
      ok: true,
      ingestionId,
      filesQueued: normalizedFiles.length,
      projectId: knowledgeProjectOriginalId || null,
      projectScopeId: knowledgeProjectScopeId || null,
      projectName: knowledgeProjectName || null,
      message: 'Ingestion avviata: la knowledge base verrà aggiornata in background.',
    });
  }
);
```

**In sintesi:**
Questo endpoint `POST /api/workspaces/:workspaceId/ingest` è il punto di ingresso HTTP per l'ingestione di documenti. Utilizza `multer` per la gestione dei file, esegue validazioni e controlli di sicurezza, risolve il contesto del progetto e, cosa fondamentale, accoda l'elaborazione effettiva (estrazione testo, chunking, embedding, salvataggio su Supabase) a un processo asincrono gestito da `knowledgeIngestionQueue` e `processKnowledgeQueue`. Questo design è robusto e scalabile per la gestione degli upload di conoscenza.
