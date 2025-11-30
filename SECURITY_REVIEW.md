# Security Review Completa – Prodotto SaaS "rec2pdf"

## 1. Executive Summary

La presente analisi di sicurezza ha valutato l'architettura e il codice del prodotto "rec2pdf" per determinarne l'idoneità a un rilascio in produzione (Go-Live). Sebbene l'applicazione dimostri una notevole maturità in diverse aree chiave (in particolare l'autorizzazione a livello di dati e la gestione dello storage), sono state identificate diverse vulnerabilità critiche e ad alto impatto che devono essere risolte prima di poter considerare l'ambiente sicuro per un contesto B2B.

**Giudizio Sintetico: NO-GO**

Il rilascio in produzione è sconsigliato fino alla risoluzione di tutte le vulnerabilità con priorità P0. I rischi di Denial of Service, accesso non autorizzato a funzionalità globali e potenziale esecuzione di codice arbitrario sono attualmente troppo elevati.

**Riepilogo dei Finding Principali:**

*   **[CRITICAL]** **Denial of Service (DoS) tramite File Upload:** (Backend) Molteplici endpoint API non impongono limiti sulla dimensione dei file caricati, consentendo a un utente malintenzionato di esaurire lo spazio su disco del server.
*   **[CRITICAL]** **Autenticazione Globalmente Disattivabile:** (Backend/Config) Una singola variabile d'ambiente (`isAuthEnabled`, legata alla configurazione di Supabase) disabilita completamente l'autenticazione su tutte le API se non configurata, esponendo l'intero sistema.
*   **[HIGH]** **Broken Access Control su API Prompts:** (Backend/API) Le API CRUD per la gestione dei prompt personalizzati (`/api/prompts`) non sembrano avere controlli di autorizzazione per workspace, permettendo a un utente di modificare o eliminare i prompt di un altro.
*   **[HIGH]** **Rischio di Command Injection (Pattern Fragile):** (Backend) L'uso di `bash -c` per eseguire comandi (`whisperx`) con input dall'utente (percorsi di file) è un pattern intrinsecamente rischioso, anche se mitigato dall'uso di quoting.
*   **[HIGH]** **Path Traversal / Lettura File Arbitrari:** (Backend/API) L'endpoint `/api/ppubr` accetta un percorso di file locale dal client, che potrebbe essere sfruttato per leggere file sensibili dal filesystem del server.
*   **[MEDIUM]** **Supabase Service Key:** (Backend) L'uso della `SUPABASE_SERVICE_KEY` conferisce al backend privilegi di amministratore. Una compromissione del server comporterebbe la compromissione totale di tutti i dati su Supabase.
*   **[LOW]** **Esposizione di Informazioni (Information Disclosure):** (Backend/API) Gli endpoint di diagnostica (`/api/diag`) e debug (`/api/rag/*`) espongono la configurazione interna del server e dovrebbero essere disabilitati in produzione.
*   **[INFO]** **Gap Informativo su Dipendenze e Flag di Build:** Non è stato possibile analizzare `package.json` e `.env.local`, impedendo la verifica di dipendenze vulnerabili e di flag di sviluppo pericolosi come `VITE_BYPASS_AUTH`.

## 2. Threat Model e Architettura

### Architettura Logica e Flussi Dati

Il sistema è un monorepo con un'architettura SaaS multi-componente:

-   **Frontend (React):** Single-Page Application che comunica con il backend e Supabase. Gestisce l'interfaccia utente, l'autenticazione (via Supabase) e la visualizzazione dei documenti.
-   **Backend (Node.js/Express):** Il cuore del sistema. Espone API REST per:
    -   Avviare pipeline di elaborazione (upload audio -> PDF).
    -   Gestire entità di business (Workspace, Progetti, Profili).
    -   Interagire con servizi esterni (AI Providers come Groq).
    -   Eseguire comandi locali (`ffmpeg`, `whisperx`, `pandoc`).
-   **Supabase:** Utilizzato come Backend-as-a-Service per:
    -   **Auth:** Gestione utenti (Magic Link, OAuth).
    -   **Database (PostgreSQL):** Archiviazione dei metadati (jobs, workspaces, utenti, chunks della knowledge base).
    -   **Storage:** Archiviazione dei file binari (audio, trascrizioni, PDF, loghi).
-   **Pipeline Dati Principale:**
    1.  `[User]` carica un file audio via `[Frontend]`.
    2.  `[Frontend]` ottiene un URL di upload da `[Backend]` o carica direttamente il file.
    3.  Il file viene archiviato in `[Supabase Storage]`.
    4.  `[Backend]` avvia un job asincrono:
        a. Scarica l'audio.
        b. **Transcodifica** con `ffmpeg`.
        c. **Trascrive** con `whisperx` (diarizzazione) o `Groq API` (veloce).
        d. **Arricchisce** con dati da `[Database Supabase]` (RAG).
        e. **Genera Markdown** tramite un modello AI.
        f. **Impagina il PDF** con `pandoc` e lo script `publish.sh`.
    5.  Gli artefatti finali (MD, PDF) sono salvati in `[Supabase Storage]` e su disco locale.

### Risorse, Minacce e Controlli

| Risorsa da Proteggere                                     | Minaccia Principale                                                                       | Controlli Attuali (✅) / Gap (❌)                                                                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Dati Utente** (Audio, Trascrizioni, PDF, Metadati)      | **Accesso non autorizzato (IDOR)** da parte di un altro utente.                           | ✅ Le query al DB sono filtrate per `owner_id`. <br> ✅ I percorsi su Supabase Storage includono `user_id`. <br> ❌ Le policy RLS non sono verificate nel codice. |
| **Server Backend**                                        | **Denial of Service (DoS)** tramite esaurimento risorse (disco, CPU).                       | ❌ Nessun limite sulla dimensione dei file in upload (`multer`). <br> ❌ Parsing di file complessi (PDF) in background.        |
| **Server Backend**                                        | **Esecuzione di Codice Remoto (RCE)** tramite command injection.                          | ❌ Uso di `bash -c` per eseguire comandi con input esterni. <br> ✅ `publish.sh` usa array per gli argomenti di `pandoc`, mitigando il rischio. |
| **Prompt AI / Dati Sensibili**                            | **Data Leakage** verso provider AI esterni (es. Groq).                                    | ❌ I dati utente (trascrizioni) vengono inviati a servizi esterni.                                                              |
| **Integrità del Sistema**                                 | **Accesso non autorizzato all'amministrazione** tramite flag di debug o segreti esposti. | ✅ Il segreto del worker è gestito in modo sicuro. <br> ❌ Esistono flag per bypassare l'autenticazione (`isAuthEnabled`). <br> ❌ Endpoint di debug esposti. |
| **Dati Globali** (es. Prompt Personalizzati)              | **Manipolazione/cancellazione non autorizzata** da parte di altri utenti.                  | ❌ Le API `/api/prompts` non sembrano avere controlli di accesso per workspace/utente.                                           |

## 3. Risultati Dettagliati

### Backend / API Security

---

-   **ID:** SEC-01
-   **Titolo:** Denial of Service (DoS) tramite Upload di File senza Limiti
-   **Severità:** Critical
-   **Probabilità:** High, **Impatto:** High
-   **Area:** Backend – File Upload
-   **Descrizione:** Le istanze di `multer` usate negli endpoint `/api/rec2pdf`, `/api/ppubr-upload`, e altri non configurano limiti di dimensione (`fileSize`) o tipo (`fileFilter`). Un utente malintenzionato può caricare file di dimensioni arbitrarie, esaurendo rapidamente lo spazio su disco del server e causando un Denial of Service per tutti gli utenti.
-   **Riferimenti di codice:** `rec2pdf-backend/server.js` (dichiarazioni di `uploadMiddleware`, `knowledgeUpload`).
-   **Scenario di sfruttamento:** Un attaccante invia una richiesta `POST` a `/api/rec2pdf` con un file di decine di GB. Il server tenta di salvarlo nella cartella temporanea `/tmp`, bloccando il servizio.
-   **Raccomandazione:** Impostare limiti ragionevoli per tutti gli upload.
-   **Esempio di fix:**
    ```javascript
    const uploadMiddleware = multer({
      dest: UP_BASE,
      limits: {
        fileSize: 50 * 1024 * 1024, // 50 MB
        files: 1
      },
      fileFilter: (req, file, cb) => {
        // Aggiungere logica per accettare solo tipi di file audio validi
        const allowedMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4'];
        if (allowedMimeTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Tipo di file non supportato.'), false);
        }
      }
    });
    ```
-   **Priorità di remediation:** P0

---

-   **ID:** SEC-02
-   **Titolo:** Rischio di Command Injection per Pattern di Esecuzione Fragile
-   **Severità:** High
-   **Probabilità:** Low, **Impatto:** Critical
-   **Area:** Backend – Esecuzione Processi Esterni
-   **Descrizione:** Diverse funzioni (`transcribeAudioForKnowledge`, `runPipeline`) costruiscono stringhe di comando per `whisperx` e le eseguono tramite `bash -lc "..."`. Sebbene i percorsi siano racchiusi tra virgolette, questo pattern è intrinsecamente più rischioso rispetto a passare argomenti come array. Una vulnerabilità nella sanitizzazione degli input potrebbe portare a un'iniezione di comandi.
-   **Riferimenti di codice:** `rec2pdf-backend/server.js` (funzione `runPipeline`, `transcribeAudioForKnowledge`).
-   **Scenario di sfruttamento:** Un nome di file o un parametro creato ad-hoc (`"file.wav; rm -rf /"`) potrebbe, in caso di sanitizzazione imperfetta, essere eseguito come comando separato.
-   **Raccomandazione:** Rifattorizzare tutte le chiamate a processi esterni per usare la forma `spawn(command, [arg1, arg2, ...])`, evitando la shell (`bash -c`). Lo script `publish.sh` usa già questo pattern sicuro internamente.
-   **Priorità di remediation:** P1

---

-   **ID:** SEC-03
-   **Titolo:** Broken Access Control sulle API dei Prompt
-   **Severità:** High
-   **Probabilità:** High, **Impatto:** Medium
-   **Area:** Backend – API
-   **Descrizione:** Le API CRUD in `/api/prompts` non sembrano implementare alcun controllo di possesso (ownership). Qualsiasi utente autenticato può potenzialmente leggere, modificare o cancellare i prompt personalizzati creati da altri utenti, dato che le query non sono filtrate per `workspace_id` o `user_id`.
-   **Riferimenti di codice:** `rec2pdf-backend/server.js` (endpoint `app.put('/api/prompts/:id')`, `app.delete('/api/prompts/:id')`).
-   **Scenario di sfruttamento:** L'utente A scopre l'ID di un prompt creato dall'utente B. Invia una richiesta `DELETE /api/prompts/<ID_PROMPT_B>` e lo cancella.
-   **Raccomandazione:** Aggiungere una colonna `workspace_id` (o `user_id`) alla tabella `prompts` e filtrare tutte le query (`select`, `update`, `delete`) per l'ID del workspace/utente corrente.
-   **Priorità di remediation:** P1

---

-   **ID:** SEC-04
-   **Titolo:** Path Traversal e Lettura File Arbitrari
-   **Severità:** High
-   **Probabilità:** Medium, **Impatto:** High
-   **Area:** Backend – API
-   **Descrizione:** L'endpoint `/api/ppubr` accetta un percorso di file locale (`localMdPathRaw`) e lo usa per leggere un file dal server con `path.resolve()`. Se la sanitizzazione dell'input non è perfetta, un attaccante potrebbe fornire un percorso come `../../../../etc/passwd` per leggere file sensibili.
-   **Riferimenti di codice:** `rec2pdf-backend/server.js` (endpoint `app.post('/api/ppubr')`).
-   **Scenario di sfruttamento:** Un attaccante invia una richiesta a `/api/ppubr` con `localMdPath` impostato a un percorso di file di sistema noto. L'errore o il contenuto del file potrebbero essere riflessi nella risposta.
-   **Raccomandazione:** Rimuovere completamente la possibilità di specificare percorsi di file locali tramite API. L'endpoint dovrebbe operare solo su file identificati tramite ID e recuperati da Supabase Storage, dove l'accesso è già controllato.
-   **Priorità di remediation:** P0

---

-   **ID:** SEC-05
-   **Titolo:** Configurazione di Autenticazione Globalmente Disattivabile
-   **Severità:** Critical
-   **Probabilità:** Low, **Impatto:** Critical
-   **Area:** Backend – Configurazione
-   **Descrizione:** La variabile `isAuthEnabled` in `server.js` è un "interruttore" globale per l'autenticazione. Se le variabili d'ambiente di Supabase non sono definite, l'autenticazione viene completamente bypassata per tutte le API. Un errore di configurazione in produzione lascerebbe l'intero sistema esposto.
-   **Riferimenti di codice:** `rec2pdf-backend/server.js`.
-   **Scenario di sfruttamento:** Un deploy in produzione fallisce nel caricare le variabili d'ambiente. Il backend si avvia in modalità "insicura", permettendo a chiunque di accedere ai dati.
-   **Raccomandazione:** Rimuovere questo flag. Il backend non dovrebbe mai avviarsi senza autenticazione in un ambiente non esplicitamente di `development`. Lanciare un'eccezione all'avvio se le chiavi Supabase non sono presenti in produzione.
-   **Priorità di remediation:** P0

### Supabase (Auth, Storage, DB, RLS)

---

-   **ID:** SEC-06
-   **Titolo:** Mancata Verifica delle Policy di Row Level Security (RLS)
-   **Severità:** High
-   **Probabilità:** Medium, **Impatto:** High
-   **Area:** Supabase – DB/Storage
-   **Descrizione:** L'applicazione si affida pesantemente a Supabase, ma il codice non contiene le definizioni delle policy RLS per il database o per lo Storage. Sebbene il backend filtri correttamente le query per `owner_id`, un accesso diretto a Supabase dal client (possibile con la chiave `anon`) senza RLS attive permetterebbe a un utente di leggere i dati di altri.
-   **Riferimenti di codice:** Assenza di file `.sql` con definizioni RLS nel repository, al di fuori delle migrazioni.
-   **Scenario di sfruttamento:** Un utente malintenzionato usa il `supabase-js` client nel browser per interrogare direttamente la tabella `workspaces` o per accedere a un file in Storage conoscendone il percorso, bypassando le API del backend.
-   **Raccomandazione:** Assicurarsi che policy RLS restrittive siano attive per tutte le tabelle contenenti dati utente (es. `workspaces`, `jobs`, `knowledge_chunks`) e per tutti i bucket in Supabase Storage. Le policy devono garantire che un utente possa accedere solo ai record (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) che possiede.
-   **Priorità di remediation:** P0

### Frontend Security (React)

---

-   **ID:** SEC-07
-   **Titolo:** Rischio di Flag di Sviluppo Pericolosi in Produzione
-   **Severità:** High
-   **Probabilità:** Low, **Impatto:** High
-   **Area:** Frontend – Configurazione
-   **Descrizione:** L'analisi del backend ha rivelato l'esistenza di flag che alterano il comportamento di sicurezza (es. `isAuthEnabled`). È probabile che anche nel frontend esistano flag simili (es. `VITE_BYPASS_AUTH`), ma non è stato possibile verificare il file `.env.local`. Se un flag del genere venisse attivato in una build di produzione, potrebbe bypassare i controlli di login lato client.
-   **Riferimenti di codice:** `rec2pdf-frontend/.env.local` (non accessibile, ma ipotizzato).
-   **Scenario di sfruttamento:** Una build di produzione viene creata per errore con il file `.env.local` di uno sviluppatore che contiene `VITE_BYPASS_AUTH=true`. Il frontend non richiederebbe più il login.
-   **Raccomandazione:** Verificare manualmente che nessun file `.env.local` o simile venga incluso nelle build di produzione. La pipeline di CI/CD deve usare un file di variabili d'ambiente specifico per la produzione, privo di qualsiasi flag di debug.
-   **Priorità di remediation:** P1

### AI & RAG Security

---

-   **ID:** SEC-08
-   **Titolo:** Rischio di Data Leakage verso Provider AI
-   **Severità:** Medium
-   **Probabilità:** High, **Impatto:** Medium
-   **Area:** AI – Data Privacy
-   **Descrizione:** La pipeline di generazione Markdown e trascrizione invia contenuti potenzialmente sensibili (trascrizioni di meeting, note audio) a servizi di terze parti come Groq o altri provider AI. Se questi dati contengono informazioni confidenziali o PII, si verifica una fuga di dati verso un sistema esterno le cui policy di data retention e privacy potrebbero non essere allineate con quelle di "rec2pdf".
-   **Riferimenti di codice:** `rec2pdf-backend/server.js` (funzioni `generateMarkdown`, `runPipeline`).
-   **Scenario di sfruttamento:** Un cliente discute dati finanziari riservati in un meeting. La trascrizione viene inviata a un provider AI esterno per la sintesi. Questi dati potrebbero essere registrati o usati per addestrare modelli futuri, violando la confidenzialità.
-   **Raccomandazione:**
    1.  **Trasparenza:** Informare chiaramente gli utenti (tramite Privacy Policy e Termini di Servizio) che i loro dati vengono elaborati da provider AI esterni.
    2.  **Anonimizzazione:** Ove possibile, implementare uno strato di anonimizzazione che rimuova PII (nomi, email, numeri di telefono) prima di inviare il testo al provider AI.
    3.  **Contratti:** Scegliere provider AI che offrano accordi "zero-retention" o "zero-data-training" per i dati inviati tramite API.
-   **Priorità di remediation:** P2

## 4. Checklist Pre-Go-Live

Elenco delle azioni di sicurezza **minime e obbligatorie** da completare prima del lancio in produzione.

| ID | Azione                                                                                             | Area               | Priorità |
|----|----------------------------------------------------------------------------------------------------|--------------------|----------|
| 1  | **SEC-01:** Implementare limiti di dimensione e tipo per tutti gli upload di file (`multer`).        | Backend            | P0       |
| 2  | **SEC-05:** Rimuovere il flag `isAuthEnabled` e assicurarsi che il backend fallisca all'avvio se le chiavi Supabase mancano in produzione. | Backend/Config     | P0       |
| 3  | **SEC-06:** Verificare e implementare policy RLS restrittive su tutte le tabelle e bucket di Supabase. | Supabase           | P0       |
| 4  | **SEC-04:** Rimuovere o disabilitare l'endpoint `/api/ppubr` che accetta percorsi di file locali.     | Backend/API        | P0       |
| 5  | Abilitare HTTPS forzato e configurare security header (CSP, HSTS, X-Frame-Options) sull'ambiente di produzione. | Config/Deploy      | P0       |
| 6  | Verificare che nessun segreto (es. `SUPABASE_SERVICE_KEY`, `GROQ_API_KEY`) sia hardcodato o esposto. Utilizzare un gestore di segreti (es. Google Secret Manager, Doppler). | Backend/Config | P0 |
| 7  | **SEC-07:** Assicurarsi che la pipeline di build del frontend escluda i file `.env.local` e non attivi flag di bypass. | Frontend/Deploy    | P1       |
| 8  | **SEC-03:** Correggere il controllo degli accessi sulle API `/api/prompts`.                           | Backend/API        | P1       |

## 5. Roadmap di Hardening

Roadmap proposta per migliorare la postura di sicurezza dell'applicazione nel tempo.

### Fase 1 – Prima del Go-Live (Giorni 0-15)

-   **Obiettivo:** Risolvere tutte le vulnerabilità critiche (P0) che bloccano il rilascio.
-   **Interventi:**
    -   Completare tutti gli elementi della "Checklist Pre-Go-Live".
    -   Eseguire una scansione delle dipendenze (`npm audit`) e aggiornare le librerie con vulnerabilità note.
    -   Disabilitare gli endpoint di diagnostica (`/diag`, `/rag/*`) in produzione.

### Fase 2 – Primo Mese Post-Go-Live (Giorni 15-45)

-   **Obiettivo:** Risolvere le vulnerabilità ad alto impatto e migliorare la robustezza.
-   **Interventi:**
    -   **SEC-02:** Rifattorizzare tutte le chiamate a processi esterni per usare la sintassi `spawn(cmd, [args])` sicura.
    -   Migliorare il logging per includere audit trail significativi (es. chi ha creato/eliminato un workspace).
    -   Introdurre un Web Application Firewall (WAF) (es. Cloudflare) per un primo livello di difesa.

### Fase 3 – Roadmap a Lungo Termine (+90 giorni)

-   **Obiettivo:** Raggiungere una postura di sicurezza matura e prepararsi per funzionalità future come E2EE.
-   **Interventi:**
    -   **SEC-08:** Implementare una strategia di anonimizzazione dei dati inviati ai provider AI.
    -   **Zero-Knowledge Readiness:**
        -   **Analisi:** Mappare tutti i punti in cui i dati sono in chiaro (frontend state, backend memory, DB, storage).
        -   **Crittografia lato client:** Iniziare a progettare un flusso in cui i file audio vengono cifrati nel browser prima dell'upload. Le chiavi di decifratura devono rimanere lato client e non essere mai inviate al server.
        -   **Refactoring Backend:** Il backend dovrà operare su "blob" cifrati. Funzionalità come la trascrizione AI o la ricerca RAG richiederanno una logica ibrida o dovranno essere eseguite parzialmente lato client (es. tramite WASM).
    -   Ottenere un penetration test completo da una terza parte specializzata.
    -   **SEC-06 Refactoring:** Spostare i controlli di accesso granulari dal codice backend alle RLS di Supabase, per un'applicazione più robusta del principio del "least privilege".
    -   **SEC-07:** Utilizzare un servizio di gestione delle chiavi (KMS) per la `SUPABASE_SERVICE_KEY` invece di variabili d'ambiente.
