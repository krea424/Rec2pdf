### Flusso del Processo di Embedding

```
┌──────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐
│   1. Ingestione          │   │ 2. Elaborazione &        │   │   3. Archiviazione       │
│ (scripts/ingest.js)      │   │    Embedding             │   │ (Supabase/Postgres)      │
├──────────────────────────┤ ► │ (services/ragService.js) │ ► ├──────────────────────────┤
│ - Legge i file sorgente  │   │ - Suddivide in "chunks"  │   │ - Tabella                │
│   (es: knowledge_sources)│   │ - Genera l'embedding per │   │   "knowledge_chunks"     │
│ - Avvia il processo per  │   │   ogni file              │   │ - Colonna "embedding"    │
│   ogni file              │   │   (services/aiService.js)│   │   di tipo "vector"       │
└──────────────────────────┘   └──────────────────────────┘   └──────────────────────────┘
```

Analizziamo ogni fase facendo riferimento ai file specifici.

---

### 1. Fase di Ingestione (Ingestion)

Questa fase è il punto di partenza del processo, tipicamente eseguita tramite uno script per processare in blocco i documenti.

**File di riferimento:** `rec2pdf-backend/scripts/ingest.js`

Questo script è progettato per:
1.  **Individuare le fonti di conoscenza**: Legge i file da una directory specifica, molto probabilmente `knowledge_sources/`.
2.  **Iterare sui file**: Per ogni file trovato, invoca il servizio RAG per avviare l'elaborazione.

**Funzionamento (concettuale):**
Lo script `ingest.js` contiene una logica che esegue una scansione della directory delle fonti di conoscenza. Per ogni documento (es. `verbale_kickoff_meeting_20251005.md`), invoca una funzione del `ragService` passando il contenuto del file e i metadati associati (come il `workspace_id` o `project_id`).

---

### 2. Fase di Elaborazione e Generazione degli Embedding

Questa è la fase centrale, dove il testo grezzo viene trasformato in vettori numerici.

**File di riferimento principali:**
*   `rec2pdf-backend/services/ragService.js`
*   `rec2pdf-backend/services/aiService.js`

**Funzionamento:**

1.  **Suddivisione del testo (Chunking)**: Il testo completo del documento viene suddiviso in blocchi più piccoli e gestibili, chiamati "chunks". Questo è fondamentale perché i modelli di embedding hanno un limite sulla quantità di testo che possono processare in una sola volta e garantisce che i risultati della ricerca semantica siano granulari e pertinenti.
    *   **Dove**: Dentro `ragService.js`, una funzione (es. `processAndEmbedDocument`) utilizza una strategia di suddivisione, come `RecursiveCharacterTextSplitter` da una libreria come `langchain`, per dividere il testo in base a paragrafi, frasi o un numero fisso di caratteri, garantendo una certa sovrapposizione tra i chunk per non perdere il contesto.

2.  **Generazione dell'Embedding**: Per ogni singolo "chunk" di testo, il sistema invoca un modello di embedding esterno (es. `text-embedding-ada-002` di OpenAI o un modello di Google).
    *   **Dove**: `ragService.js` non chiama direttamente l'API del provider AI. Invece, utilizza un'astrazione fornita da `aiService.js`.
    *   In `ragService.js` si trova una chiamata simile a:
        ```javascript
        // Dentro una funzione in ragService.js
        const chunks = splitTextIntoChunks(documentContent);
        for (const chunk of chunks) {
          const embedding = await aiService.generateEmbedding(chunk.textContent);
          // ...poi salva il chunk e l'embedding
        }
        ```
    *   Il file `aiService.js` gestisce la logica per comunicare con il provider AI configurato, inviando il testo del chunk e ricevendo in risposta il vettore di embedding (es. un array di 1536 numeri in virgola mobile).

---

### 3. Fase di Archiviazione (Storage)

Una volta generati, i chunk di testo e i loro corrispondenti vettori di embedding vengono salvati in un database vettoriale per poter essere interrogati.

**File di riferimento:**
*   `rec2pdf-backend/supabase/migrations/20251026_001_initial_schema.sql`
*   `rec2pdf-backend/supabase/migrations/20240506_add_workspace_id_to_knowledge_chunks.sql`
*   `rec2pdf-backend/supabase/migrations/20240703_create_match_knowledge_chunks_function.sql`

**Funzionamento:**

1.  **Struttura del Database**: Il database (Supabase, che usa PostgreSQL con l'estensione `pgvector`) è configurato per memorizzare questi dati. La migrazione `..._initial_schema.sql` definisce la tabella principale.
    *   **Tabella**: `knowledge_chunks`
    *   **Colonne chiave**:
        *   `id`: Identificativo univoco del chunk.
        *   `content`: Il testo originale del chunk.
        *   `embedding`: La colonna più importante, di tipo `vector(1536)`, che contiene il vettore numerico generato.
        *   `workspace_id`, `project_id`: Colonne per il multitenancy, che associano il chunk a un contesto specifico (spazio di lavoro o progetto).

2.  **Salvataggio dei Dati**: Dopo aver ottenuto il vettore da `aiService.js`, il `ragService.js` esegue un'operazione di inserimento nel database tramite il client Supabase.
    ```javascript
    // Dentro una funzione in ragService.js
    const { data, error } = await supabase
      .from('knowledge_chunks')
      .insert([
        {
          content: chunk.textContent,
          embedding: embedding,
          workspace_id: 'some-workspace-id',
          project_id: 'some-project-id'
        }
      ]);
    ```

### Bonus: Il Processo Inverso (La Ricerca)

Sebbene la domanda riguardi l'embedding, è utile capire perché viene fatto. Quando un utente pone una domanda:
1.  La domanda dell'utente viene anch'essa trasformata in un embedding usando lo stesso modello (`aiService.generateEmbedding`).
2.  Questo embedding viene usato per interrogare il database ed eseguire una ricerca di similarità coseno.
3.  **File di riferimento**: `..._create_match_knowledge_chunks_function.sql`. Questo file crea una funzione SQL (`match_knowledge_chunks`) ottimizzata per trovare i `k` chunk di testo il cui embedding è più simile a quello della domanda.
4.  I chunk più pertinenti vengono recuperati e inseriti nel prompt di un modello LLM (come GPT-4) insieme alla domanda originale, per generare una risposta contestualizzata e accurata.

In sintesi, il processo di embedding è un pipeline automatizzato che trasforma documenti non strutturati in dati strutturati e ricercabili semanticamente, abilitando le potenti funzionalità di domanda-risposta del sistema Rec2PDF.
