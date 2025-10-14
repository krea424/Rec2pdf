---
title: "Analisi Tecnica e Piano di Upgrade — Rec2PDF Web App"
author: "Lead Developer_Google_AI_Studio"
owner: "Project Manager / Business Analyst"
project_name: "Rec2PDF"
project_code: "R2P"
artifact_type: "SYS"
version: "v1_0_0"
identifier: "R2P-SYS_WebApp_Upgrade_Plan_v1_0_0_20251005"
location: "INT/04_Solution_Design/Architecture/R2P-SYS_WebApp_Upgrade_Plan_v1_0_0_20251005.md"
summary: "Analisi di fattibilità, architettura target e roadmap per l'evoluzione di Rec2PDF da applicazione locale a piattaforma web multi-utente cloud-native, con focus su sicurezza, scalabilità e costi."
usageterms: "Uso interno — Rec2PDF"
ssot: true
status: "approved"
created: "2025-10-05"
updated: "2025-10-05"
tags: ["architettura","cloud","upgrade","multi-utente","supabase","docker","sicurezza"]
ai.generated: false
ai.model: ""
ai.prompt_id: ""
---

# Executive Summary

Questo documento delinea la strategia per evolvere Rec2PDF da un'applicazione locale single-user a una **piattaforma web multi-utente sicura, scalabile e pronta per il mercato**. L'upgrade è non solo tecnicamente fattibile, ma rappresenta il passo logico e necessario per capitalizzare sul valore del prodotto, consentendo modelli di business basati su abbonamento (SaaS) e garantendo al contempo sicurezza e privacy dei dati utente.

La transizione si basa sulla migrazione dell'attuale architettura da uno storage su filesystem e `localStorage` a un'infrastruttura cloud moderna, composta da un database gestito, un object storage per i file multimediali e un sistema di job asincroni per le elaborazioni pesanti. Proponiamo uno stack tecnologico basato su **Supabase** e un hosting PaaS (Platform-as-a-Service), scelto per il suo eccellente rapporto costo/beneficio e i generosi piani gratuiti che minimizzano l'investimento iniziale.

Il piano include una migrazione controllata dei dati, l'adattamento della toolchain esistente in un ambiente containerizzato (Docker) e un processo di sviluppo sicuro basato su GitHub. I rischi principali, legati alla sicurezza dei dati e alla complessità della migrazione, sono mitigati da un approccio incrementale e da best practice di settore. La decisione chiave da prendere è la validazione di questo percorso strategico e l'allocazione delle risorse per la prima fase di sviluppo.

# Valutazione di Fattibilità e Rischi

L'upgrade è **altamente fattibile**. L'architettura attuale, con una chiara separazione tra frontend e backend, è un ottimo punto di partenza. Le funzionalità esistenti non solo verranno mantenute, ma potenziate.

## Fattori Abilitanti
- **Architettura Disaccoppiata**: Frontend e backend comunicano già via API, facilitando la transizione a un modello client-server distribuito.
- **Toolchain Portabile**: Le dipendenze CLI (ffmpeg, whisper, pandoc) sono standard e ben supportate in ambienti containerizzati come Docker.
- **Maturità dei Servizi Cloud**: Piattaforme come Supabase offrono soluzioni "all-in-one" (Auth, DB, Storage) che abbattono drasticamente la complessità e i costi di avvio.

## Rischi Principali e Mitigazioni
- **Sicurezza dei Dati Utente**: Gestire dati di più utenti è una responsabilità critica.
  - **Mitigazione**: Adottare un provider con autenticazione e autorizzazione integrate (Row Level Security di Supabase), cifratura dei dati at-rest e in-transit, e policy di accesso rigorose.
- **Complessità della Migrazione**: Spostare i dati esistenti (`~/.rec2pdf`, `localStorage`) nel cloud senza perdite.
  - **Mitigazione**: Sviluppare script di migrazione testabili e idempotenti (eseguibili più volte senza effetti collaterali), prevedere una fase di "dry-run" (simulazione) e un piano di rollback.
- **Gestione dei Costi Cloud**: Il passaggio al cloud introduce costi operativi variabili.
  - **Mitigazione**: Scegliere servizi con piani gratuiti generosi, impostare budget alert e ottimizzare le operazioni costose (es. esecuzione di job pesanti) per restare entro le quote.

## Takeaway
L'upgrade è una naturale evoluzione del prodotto con rischi gestibili. La sfida non è tecnologica, ma operativa: richiede un approccio disciplinato alla sicurezza, alla gestione dei dati e ai costi.

# Architettura Target

Proponiamo un'architettura a microservizi moderna, disaccoppiata e scalabile.

## Componenti Chiave
- **Frontend Web Multi-Utente**: L'attuale SPA React, modificata per gestire l'autenticazione (login/logout) e recuperare i dati via API invece che da `localStorage`.
- **Backend API**: Il server Express, potenziato per gestire l'autenticazione JWT, le policy di autorizzazione (un utente può vedere solo i propri dati) e l'interazione con i servizi cloud.
- **Database Gestito (Postgres)**: Il cuore del sistema. Conterrà tutti i metadati: utenti, workspace, progetti, documenti, prompt, log dei job. Non conterrà file binari pesanti.
- **Object Storage (S3-compatible)**: Un servizio dedicato all'archiviazione di file di grandi dimensioni (audio, PDF). Ogni file sarà protetto e accessibile solo tramite URL sicuri e a tempo limitato (signed URL) generati dal backend.
- **Job Runner / Queue**: Un sistema per gestire le pipeline pesanti (trascrizione, impaginazione) in modo asincrono. Quando un utente carica un file, il backend non si blocca, ma inserisce un "lavoro" in una coda. Un worker separato prenderà in carico il lavoro, liberando il server principale.
- **Secret Management**: Un servizio per archiviare in modo sicuro le chiavi API (es. per Gemini) e le credenziali del database, senza mai scriverle direttamente nel codice.

## Opzioni Architetturali

### Opzione A: Piattaforma Integrata (Raccomandata)
- **Descrizione**: Utilizzare una piattaforma "Backend-as-a-Service" come **Supabase**.
- **Pro**: Velocità di sviluppo estrema (Auth, Postgres, Storage già pronti e integrati), costi iniziali nulli o bassissimi, RLS (Row Level Security) per una sicurezza dei dati robusta e dichiarativa.
- **Contro**: Minor flessibilità, potenziale vendor lock-in a lungo termine.

### Opzione B: Best-of-Breed Composta
- **Descrizione**: Assemblare i migliori servizi per ogni compito: es. **Vercel** per il frontend, **Railway/Render** per il backend, **Neon/Supabase** solo per il DB, **Cloudflare R2/Backblaze B2** per lo storage.
- **Pro**: Massima flessibilità, ottimizzazione dei costi su ogni singolo componente, nessun vendor lock-in.
- **Contro**: Maggiore complessità di integrazione e gestione, richiede più competenze DevOps.

## Takeaway
L'Opzione A (Supabase) è la scelta pragmatica e professionale per accelerare lo sviluppo, minimizzare i costi iniziali e garantire un elevato standard di sicurezza fin da subito, rimandando le ottimizzazioni dell'Opzione B a una fase di crescita successiva.

# Scelte di Piattaforma e Servizi

- **Piattaforma Primaria**: **Supabase**. Offre Auth, Postgres, Storage S3-compatible, Edge Functions e un generoso piano gratuito. La sua Row Level Security è ideale per garantire che ogni utente veda solo i propri dati.
- **Hosting Backend/Job Runner**: **Railway** o **Render**. Entrambi offrono piani gratuiti, si integrano perfettamente con GitHub e supportano Docker, rendendo il deploy della nostra toolchain containerizzata semplice e a basso costo.
- **Hosting Frontend**: **Vercel** o **Netlify**. Leader per il deploy di SPA React, con CDN globale, deploy istantanei da Git e piani gratuiti eccellenti.

# Modello Dati e Storage

Il principio guida è separare i metadati (piccoli, veloci) dai file binari (grandi, lenti).

## Database (Postgres)
- **`users`**: Tabella fornita da Supabase Auth.
- **`workspaces`**: `id`, `user_id`, `name`, `client`, `color`, policy di versioning, etc.
- **`projects`**: `id`, `workspace_id`, `name`, `color`, lista di stati.
- **`documents`**: `id`, `project_id`, `user_id`, `title`, `slug`, `status`, `pdf_path` (riferimento allo storage), `md_path`, metadati di struttura, etc.
- **`media_assets`**: `id`, `document_id`, `type` ('original_audio', 'normalized_wav'), `storage_path`, `hash`, `duration`, `codec`, etc.
- **`jobs`**: `id`, `document_id`, `type` ('transcription', 'publishing'), `status` ('queued', 'running', 'completed', 'failed'), `logs`.
- **`prompts`**: `id`, `user_id` (se personalizzati), `title`, `description`, regole, etc.

## Object Storage (Supabase Storage)
- **Bucket `audio-uploads`**: Contiene i file audio originali caricati dagli utenti. Policy di accesso ristrette (solo il backend può scrivere).
- **Bucket `processed-media`**: Contiene i file WAV normalizzati e le trascrizioni testuali.
- **Bucket `documents`**: Contiene i PDF e Markdown finali. Accesso in lettura tramite URL firmati a tempo, generati dal backend solo per l'utente proprietario.

# Sicurezza e Compliance

- **Autenticazione**: Gestita da Supabase Auth (Magic Link, OAuth con Google/GitHub).
- **Autorizzazione**: Implementata a livello di database con **Row Level Security (RLS)**. Ogni query al DB viene filtrata automaticamente per l'ID dell'utente autenticato. Un utente non potrà mai, neanche per un bug nel backend, vedere i dati di un altro.
- **Cifratura**: Tutti i dati sono cifrati at-rest e in-transit per impostazione predefinita sui servizi proposti.
- **Audit Trail**: Creare una tabella `audit_logs` per tracciare eventi critici (login, cancellazione documento, modifica workspace).

# Migrazione Dati

La migrazione è un'operazione una-tantum per l'utente esistente (te stesso).

1.  **Fase 1 - Esportazione**: Creare uno script locale (Node.js) che legge tutti i file JSON in `~/.rec2pdf` (workspaces, prompts) e i metadati da `localStorage`.
2.  **Fase 2 - Mapping**: Lo script mappa i dati locali al nuovo schema del database cloud. A tutti i dati verrà assegnato il tuo `user_id`.
3.  **Fase 3 - Upload**:
    - Lo script inserisce i metadati nel database Postgres tramite l'API di Supabase.
    - Per ogni documento, lo script carica i file audio e PDF associati nei rispettivi bucket di Supabase Storage.
4.  **Fase 4 - Validazione**: Verificare che il numero di record e file nel cloud corrisponda a quelli locali.

# Toolchain in Cloud

L'esecuzione di `ffmpeg`, `whisper`, `pandoc`, etc., avverrà in un ambiente isolato e scalabile.

- **Containerizzazione (Docker)**: Creeremo un'immagine Docker che contiene il nostro backend Node.js e **tutte le dipendenze binarie** (ffmpeg, TeX Live, pandoc, whisper). Questo crea un ambiente di esecuzione standard e portabile.
- **Esecuzione come Job**: Quando una pipeline viene avviata, il backend non esegue direttamente i comandi. Inserisce un messaggio in una coda (es. una tabella `jobs` in Postgres). Un "worker" separato, eseguito come container su Railway/Render, legge dalla coda, scarica i file necessari dall'object storage, esegue la pipeline in un volume temporaneo, e carica gli artefatti finali nello storage, aggiornando lo stato del job nel database.

# Uso di Docker e CI/CD

- **Docker è fondamentale**: Garantisce che l'ambiente in cui gira la toolchain sia identico in locale e in produzione, eliminando il classico problema "sul mio computer funziona".
- **Pipeline CI/CD (GitHub Actions)**:
    1.  **On Push to Feature Branch**: Esegue test e linting.
    2.  **On PR to `develop`**: Esegue test, build del frontend e del backend, crea un ambiente di anteprima (Preview Environment) su Vercel/Railway.
    3.  **On Merge to `main`**: Esegue il deploy in produzione.

# Impatto e Integrazione LLM (Gemini)

- **Sicurezza**: La chiave API di Gemini **deve** risiedere solo sul backend, gestita tramite Secret Management. Il frontend non deve mai conoscerla.
- **Pattern Proxy**: Il backend esporrà un endpoint (es. `/api/generate-markdown`) che, internamente, chiama l'API di Gemini con la chiave segreta. Questo fa da "proxy" sicuro.
- **Gestione Costi e Quote**: Questo endpoint proxy implementerà logica di rate limiting e quote per utente, per prevenire abusi e tenere sotto controllo i costi.

# Piano di Azione a 30/60/90 Giorni

## Fase 1: Fondamenta e Autenticazione (Giorni 1-30)
- **Obiettivo**: Avere un'app funzionante con login/registrazione e dati salvati nel cloud.
- **Deliverable**:
  - Setup progetto Supabase (Auth, DB, Storage).
  - Frontend con flusso di autenticazione.
  - Backend con endpoint protetti e middleware JWT.
  - CRUD di base per i Workspace salvati su Postgres.
- **Owner**: Lead Dev.
- **Criteri di Successo**: Un utente può registrarsi, creare un workspace e vederlo salvato nel database.

## Fase 2: Migrazione della Pipeline Core (Giorni 31-60)
- **Obiettivo**: Far funzionare la pipeline audio→PDF nell'infrastruttura cloud.
- **Deliverable**:
  - Immagine Docker con backend e toolchain.
  - Setup del Job Runner su Railway/Render.
  - Modifica degli endpoint `/rec2pdf` e `/ppubr-upload` per creare job nella coda.
  - Logica del worker per eseguire la pipeline usando file da/verso l'object storage.
- **Owner**: Lead Dev.
- **Criteri di Successo**: Un utente autenticato può caricare un audio e ricevere un PDF, con tutti i file salvati su Supabase Storage.

## Fase 3: Migrazione Funzionalità Avanzate e Dati (Giorni 61-90)
- **Obiettivo**: Portare tutte le funzionalità esistenti (Prompt, Editor, etc.) sulla nuova architettura e migrare i dati esistenti.
- **Deliverable**:
  - CRUD per i Prompt su endpoint protetti.
  - Editor Markdown che legge/scrive da/verso il cloud.
  - Script di migrazione per i dati locali.
  - Esecuzione della migrazione e validazione.
- **Owner**: Lead Dev / Knowledge Manager.
- **Criteri di Successo**: Tutte le funzionalità sono operative nel nuovo ambiente e i dati storici sono stati migrati con successo. L'app locale è ufficialmente deprecata.