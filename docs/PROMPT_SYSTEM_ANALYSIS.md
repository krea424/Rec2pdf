
# Analisi e Proposta di Upgrade del Sistema di Prompt e RAG di Rec2pdf

**Autore:** Gemini, Lead Prompt & Context Engineer  
**Data:** 25 ottobre 2025  
**Versione:** 1.0

## Introduzione

Questo documento fornisce un'analisi dettagliata dell'architettura di Prompt Engineering e Retrieval-Augmented Generation (RAG) attualmente implementata nel progetto `Rec2pdf`. L'obiettivo è duplice:
1.  **Descrivere in modo esaustivo il sistema attuale (As-Is)**, per creare una baseline di conoscenza condivisa.
2.  **Proporre un piano di evoluzione strategica (To-Be)**, per migliorare la qualità, la manutenibilità e l'efficacia della pipeline di generazione dei documenti, allineandola alle più recenti best practice del settore.

---

## Parte 1: Analisi del Sistema Attuale (As-Is)

Il sistema di generazione documentale di `Rec2pdf` è una pipeline sofisticata che trasforma una registrazione audio in un documento PDF formattato. Il cuore di questa pipeline è un sistema ibrido di Prompting e RAG che guida un modello linguistico di grandi dimensioni (LLM) nella creazione del contenuto Markdown.

### 1.1. Architettura Generale della Pipeline

Il flusso dati può essere riassunto nei seguenti macro-step:

1.  **Input Utente:** L'utente carica un file audio e seleziona opzioni dal frontend, tra cui un "Profilo" di generazione, un "Prompt" specifico (es. "Brief Creativo"), e può inserire testo libero nei campi "Focus" e "Note".
2.  **Backend Processing (`/api/rec2pdf`):** Il file `rec2pdf-backend/server.js` orchestra l'intera pipeline.
3.  **Trascrizione:** L'audio viene prima transcodificato in formato WAV e poi processato da Whisper (o WhisperX per la diarizzazione) per ottenere una trascrizione testuale.
4.  **Context Retrieval (RAG):** Una query viene costruita e inviata al sistema RAG per recuperare contesto rilevante da una knowledge base vettoriale.
5.  **Prompt Assembly:** Le istruzioni per l'LLM vengono assemblate dinamicamente.
6.  **Generazione AI:** Il prompt completo viene inviato al provider AI configurato (es. Google Gemini) per generare il corpo del documento in Markdown.
7.  **Front-matter Assembly:** Il backend costruisce programmaticamente un front-matter YAML e lo antepone al Markdown generato dall'AI.
8.  **Pubblicazione PDF:** Il file Markdown completo viene processato da `pandoc` tramite lo script `Scripts/publish.sh` per creare il PDF finale, applicando template e stili.

### 1.2. Struttura e Definizione dei Prompt

Il sistema di prompt è modulare ma prevalentemente codificato all'interno del backend.

-   **File Sorgente:** La logica principale risiede in `rec2pdf-backend/server.js`.
-   **Definizione dei Prompt:**
    -   **Prompt di Default:** Un set di prompt predefiniti è hardcoded nella costante `DEFAULT_PROMPTS` all'interno di `server.js`. Questi rappresentano la configurazione di base e il fallback del sistema in assenza di una connessione a Supabase.
    -   **Prompt da Database (Supabase):** Il sistema è progettato per leggere i prompt direttamente da una tabella `prompts` nel database Supabase. Questo permette una gestione dinamica e centralizzata dei prompt senza modificare il codice sorgente. La logica di recupero si trova attorno alla linea 3752 di `server.js`.
-   **Anatomia di un Prompt Object:** Ogni prompt è una riga nella tabella `prompts` e viene mappato come un oggetto JavaScript strutturato con campi che ne definiscono il comportamento:
    -   `id`, `slug`, `title`, `description`: Metadati identificativi.
    -   `persona`: Definisce il ruolo che l'AI deve assumere (es. "Creative Strategist").
    -   `cueCards`: Suggerimenti per l'utente nel frontend, non usati direttamente nel prompt.
    -   `markdownRules`: Un oggetto contenente regole di formattazione specifiche (`tone`, `voice`, `bulletStyle`, etc.).
    -   `pdfRules`: Regole per la generazione del PDF, come `layout` e `accentColor`.
    -   `checklist`: Sezioni raccomandate per il documento finale, usate per l'analisi a posteriori.

### 1.3. Il Motore di Prompting: La Funzione `generateMarkdown`

Questa funzione asincrona, situata in `server.js`, è il vero e proprio "motore" di assemblaggio del prompt.

1.  **Prompt di Sistema (Meta-Prompt):** La funzione inizia con una serie di istruzioni di base hardcoded, che definiscono il comportamento fondamentale dell'assistente AI (es. "Sei un assistente AI...", "NON includere il blocco front-matter YAML...").
2.  **Arricchimento Dinamico:** Il meta-prompt viene arricchito in base al `promptPayload` (il prompt selezionato dall'utente):
    -   La `persona` sovrascrive la prima riga del prompt di sistema.
    -   Le `markdownRules` vengono convertite in istruzioni testuali (es. "Usa un tono Ispirazionale...").
    -   Il `focus` e le `notes` inserite dall'utente vengono aggiunte come istruzioni contestuali specifiche per la sessione.
3.  **Iniezione del Contesto RAG:** Il contesto recuperato dalla knowledge base viene inserito nel prompt, preceduto da un'intestazione chiara: `INFORMAZIONI AGGIUNTIVE DALLA KNOWLEDGE BASE...`.
4.  **Aggiunta della Trascrizione:** Infine, la trascrizione audio viene appesa al prompt.
5.  **Chiamata all'LLM:** Il prompt finale, così assemblato, viene inviato al servizio AI, che restituisce unicamente il corpo del documento Markdown.

### 1.4. Interazione con il Sistema RAG

Il RAG ha il compito di fornire contesto rilevante "just-in-time" per rendere la generazione più accurata e informata.

-   **Logica di Ingestion:** Lo script `rec2pdf-backend/scripts/ingest.js` gestisce l'indicizzazione. Suddivide i documenti sorgente in "chunk" (pezzi di testo), ne calcola gli embedding vettoriali tramite un modello AI e li archivia nella tabella `knowledge_chunks` su Supabase.
-   **Logica di Retrieval:**
    1.  **Costruzione della Query:** La funzione `retrieveRelevantContext` in `server.js` è responsabile del recupero. Attualmente, la query per il RAG è una **semplice concatenazione** del `promptFocus`, delle `promptNotes` e dell'**intera trascrizione** del file audio, troncata ai primi `CONTEXT_QUERY_MAX_CHARS` (4000) caratteri.
    2.  **Ricerca Vettoriale:** Viene calcolato l'embedding di questa query e utilizzato per interrogare la funzione `match_knowledge_chunks` di Supabase, che esegue una ricerca per similarità coseno nella knowledge base vettoriale, filtrando per il `workspace_id` corrente.
    3.  **Augmented Generation:** I chunk di testo restituiti vengono inseriti nel prompt, come descritto nel punto 1.3.

### 1.5. Modificabilità e Manutenzione

-   **Aggiungere/Modificare Prompt:** L'approccio più semplice è modificare il file `~/.rec2pdf/prompts.json` o usare le API del backend (se esposte in un'interfaccia di amministrazione) per gestire i prompt dinamicamente. Modificare la costante `DEFAULT_PROMPTS` in `server.js` è un'alternativa, ma richiede un intervento sul codice.
-   **Modificare la Logica di Prompting:** Qualsiasi modifica alla struttura del prompt (es. aggiungere una nuova sezione o cambiare il meta-prompt) richiede di modificare la funzione `generateMarkdown` in `serverjs`.
-   **Modificare la Logica RAG:** Per cambiare la strategia di interrogazione (es. modificare cosa viene incluso nella query) o il numero di chunk recuperati, è necessario intervenire sulla funzione `retrieveRelevantContext`.

---

## Parte 2: Revisione Critica e Proposta di Upgrade (To-Be)

Il sistema attuale è funzionale e ben strutturato, ma presenta diverse opportunità di miglioramento per evolvere verso un'architettura più potente, flessibile e allineata ai moderni paradigmi di sviluppo con LLM.

### 2.1. Punti di Forza

-   **Modularità:** La definizione dei prompt come oggetti JSON/JS è un'ottima base.
-   **Configurabilità Utente:** La possibilità di inserire `focus` e `notes` offre un buon livello di controllo contestuale.
-   **Separazione delle Competenze:** L'astrazione dei provider AI e dei servizi (`aiService.js`) è una pratica eccellente.
-   **Infrastruttura RAG:** La presenza di una pipeline RAG, seppur semplice, è un vantaggio strategico fondamentale.

### 2.2. Aree di Miglioramento (Criticità)

1.  **Prompt Rigido e Monolitico:** L'assemblaggio del prompt tramite concatenazione di stringhe in `generateMarkdown` è poco flessibile e soggetto a errori. Il meta-prompt è hardcoded e difficile da A/B testare.
2.  **Query RAG Ingenua:** Concatenare l'intera trascrizione per la query RAG è sub-ottimale. La query risulta "rumorosa", diluendo l'intento di ricerca e potenzialmente recuperando contesto poco pertinente.
3.  **Assenza di Versioning:** I prompt non sono versionati. Se un prompt viene modificato, diventa impossibile rigenerare un documento con le esatte istruzioni usate in passato, minando la riproducibilità.
4.  **Mancanza di un Feedback Loop:** Il sistema non prevede un modo per valutare la qualità dell'output generato e usare tale feedback per migliorare i prompt o la strategia RAG.
5.  **Knowledge Management Basilare:** L'ingestion si limita a "chunking" e "embedding". Non c'è arricchimento dei metadati, né una gestione del ciclo di vita della conoscenza.

### 2.3. Proposta di Upgrade: Architettura "Context-First"

Propongo un'evoluzione in tre fasi per trasformare `Rec2pdf` in un sistema di generazione documentale di nuova generazione.

#### Fase 1: Refactoring del Core Prompting → Introduzione dei "Prompt Template"

L'obiettivo è disaccoppiare la *struttura* del prompt dalla sua *configurazione*.

-   **Azione:** Abbandonare la concatenazione di stringhe in favore di un sistema di templating. Si può usare una libreria come `Handlebars.js` o semplicemente template literal di ES6.
-   **Implementazione:**
    1.  Creare una nuova cartella: `rec2pdf-backend/prompts/templates/`.
    2.  Al suo interno, creare file di template, es: `base_generation.template`:
        ```
        {{system_message}}

        Segui queste regole specifiche durante la generazione:
        - Il tuo obiettivo specifico è: {{description}}.
        {{#if markdownRules.tone}}- Usa un tono {{markdownRules.tone}}.{{/if}}
        {{#if markdownRules.voice}}- Usa una voce in {{markdownRules.voice}}.{{/if}}
        {{#if promptFocus}}- Durante la generazione, concentrati su: {{promptFocus}}.{{/if}}
        {{#if promptNotes}}- Considera anche queste note aggiuntive: {{promptNotes}}.{{/if}}

        {{#if ragContext}}
        INFORMAZIONI AGGIUNTIVE DALLA KNOWLEDGE BASE (usa questo contesto per arricchire la risposta):
        ---
        {{ragContext}}
        ---
        {{/if}}

        Ecco la trascrizione da elaborare:
        ---
        {{transcript}}
        ```
    3.  Modificare `generateMarkdown` per caricare il template appropriato, popolarlo con le variabili dal `promptPayload` e dal contesto, e usarlo come prompt finale.
-   **Vantaggi:**
    -   **Flessibilità:** I prompt possono essere modificati senza toccare la logica applicativa.
    -   **Manutenibilità:** La struttura del prompt è chiara, leggibile e centralizzata.
    -   **A/B Testing:** Diventa banale testare diverse strutture di prompt semplicemente creando nuovi file di template.

#### Fase 2: Evoluzione del RAG → "Intelligent Query & Hybrid Search"

L'obiettivo è migliorare drasticamente la pertinenza del contesto recuperato.

-   **Azione 1: Query Transformation.** Invece di usare il testo grezzo, usare un LLM per raffinare la query.
    -   **Implementazione:** Creare una nuova funzione `generateRagQuery`. Dati il `focus`, le `notes` e un **sommario** della trascrizione (generato da una prima chiamata all'LLM), questa funzione chiederà a un modello AI: *"Basandoti su questi input, formula una domanda o una serie di keyword che un esperto userebbe per trovare informazioni rilevanti in una knowledge base."* La risposta diventa la query per la ricerca vettoriale.
-   **Azione 2: Hybrid Search.** La ricerca vettoriale è ottima per la similarità semantica, ma può fallire su keyword specifiche (es. codici prodotto, nomi propri).
    -   **Implementazione:** Arricchire la funzione `retrieveRelevantContext` per eseguire due ricerche in parallelo:
        1.  La **ricerca vettoriale** come già avviene (ma con la query trasformata).
        2.  Una **ricerca full-text (keyword-based)** sui metadati dei chunk (vedi Fase 3). Supabase supporta questo tipo di ricerca.
    -   I risultati delle due ricerche vengono poi combinati e ri-ordinati (re-ranking) per produrre il contesto finale.
-   **Vantaggi:**
    -   **Precisione RAG:** Aumento esponenziale della probabilità di recuperare chunk di contesto realmente utili.
    -   **Robustezza:** Il sistema diventa efficace sia su concetti astratti (grazie al vettoriale) sia su termini specifici (grazie al full-text).

#### Fase 3: Gestione Strategica → "Prompt & Knowledge Lifecycle Management"

L'obiettivo è rendere il sistema auto-migliorante e la conoscenza un asset gestito.

-   **Azione 1: Versioning dei Prompt.**
    -   **Implementazione:** Aggiungere un campo `version` (es. `1.0.0`) e un `changelog` a ogni oggetto prompt in `prompts.json`. Quando un prompt viene modificato, si crea una nuova versione invece di sovrascrivere. Il backend dovrà essere in grado di recuperare una versione specifica di un prompt.
-   **Azione 2: Arricchimento della Knowledge Base.**
    -   **Implementazione:** Durante la fase di ingestion (`ingest.js`), dopo aver estratto il testo da un documento, usare un LLM per generare metadati strutturati:
        -   `summary`: Un breve riassunto del chunk.
        -   `keywords`: Un array di parole chiave.
        -   `entities`: Nomi di persone, aziende, prodotti menzionati.
    -   Questi metadati vanno salvati in colonne dedicate nella tabella `knowledge_chunks` di Supabase, abilitando la Hybrid Search della Fase 2.
-   **Azione 3: Implementazione di un Feedback Loop.**
    -   **Implementazione:**
        1.  Aggiungere al frontend un sistema di valutazione (es. un rating da 1 a 5 stelle) sull'output finale.
        2.  Salvare questo feedback associandolo all'ID della generazione, che a sua volta è legato alla versione del prompt usata, ai chunk RAG recuperati e al modello AI.
        3.  Creare una dashboard di analytics per analizzare le performance dei prompt e delle strategie RAG, identificando quali combinazioni producono i risultati migliori.
-   **Vantaggi:**
    -   **Riproducibilità e Governance:** Pieno controllo sulla cronologia e l'evoluzione dei prompt.
    -   **Knowledge "Attiva":** La knowledge base non è più un archivio passivo, ma una risorsa ricca e interrogabile in modi complessi.
    -   **Miglioramento Continuo:** Il sistema impara e migliora nel tempo, guidato da dati quantitativi sull'efficacia.

### 2.4. Struttura File Proposta (To-Be)

Per supportare questa evoluzione, la struttura del backend potrebbe diventare:

```
rec2pdf-backend/
├── prompts/
│   ├── templates/                  # <-- NUOVO: Template dei prompt
│   │   ├── base_generation.template
│   │   └── rag_query_enhancer.template
│   └── prompts.v1.json             # <-- NUOVO: Prompt versionati
├── services/
│   ├── aiService.js
│   ├── aiProviders.js
│   ├── promptService.js            # <-- NUOVO: Logica per caricare e popolare template
│   └── ragService.js               # <-- NUOVO: Evoluzione di retrieveRelevantContext
└── server.js                       # (Semplificato, ora orchestra i servizi)
```

## Conclusione

L'architettura attuale di `Rec2pdf` è solida, ma le evoluzioni proposte la proietterebbero all'avanguardia nello sviluppo di applicazioni basate su LLM. Centralizzare la gestione dei prompt tramite template, rendere intelligente la query RAG e introdurre un ciclo di vita completo per prompt e conoscenza sono i passi chiave per trasformare l'applicazione da uno strumento potente a una piattaforma di generazione documentale intelligente, scalabile e auto-migliorante.
