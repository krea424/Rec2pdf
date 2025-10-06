---
title: "Upgrade Backend & Web App Deployment per Rec2PDF — Documento Tecnico"
author: "Lead Developer_Codex"
owner: "Project Manager / Business Analyst"
project_name: "Rec2PDF"
project_code: "R2P"
artifact_type: "SYS"
version: "v1_0_0"
identifier: "R2P-SYS_Backend_WebApp_Upgrade_v1_0_0_20251005"
location: "INT/04_Solution_Design/Architecture/R2P-SYS_Backend_WebApp_Upgrade_v1_0_0_20251005.md"
summary: "Analisi tecnica e piano di trasformazione da app locale a web app multi‑utente con backend stateless, DB gestito, object storage, job queue e CDN, mantenendo la toolchain voce→trascrizione→Markdown→PDF."
usageterms: "Uso interno — Rec2PDF"
ssot: true
status: "approved"
created: "2025-10-05"
updated: "2025-10-05"
tags: ["upgrade","architecture","backend","cloud","migration","security","devops","audio","pdf","whisper","gemini","supabase","docker"]
ai.generated: true
ai.model: "GPT-5 Thinking"
ai.prompt_id: "PROMPT-R2P-0008"
---

# Executive Summary

L’upgrade verso una web app multi-utente è tecnicamente fattibile e introduce benefici tangibili: collaborazione centralizzata, gestione sicura di media e documenti, automazione delle pipeline e possibilità di erogare Rec2PDF come servizio. L’attuale soluzione dipende dal filesystem locale e da localStorage per stato applicativo e workspace, limitando scalabilità, sicurezza e collaborazione. Il passaggio al cloud comporta l’adozione di un backend stateless con database gestito, storage oggetti, job queue e CDN, mantenendo la toolchain voce→trascrizione→Markdown→PDF orchestrata da job containerizzati. I rischi principali riguardano costi operativi, sicurezza dei dati audio e complessità della migrazione; sono mitigabili con ambienti separati, controllo accessi, backup incrementali e rollout progressivo. Decisioni urgenti: selezionare piattaforma primaria (Supabase + Railway/Render), definire modelli dati relazionali, pianificare containerizzazione della toolchain e modalità di proxy per Gemini.

## Takeaway pratici

- Confermare budget per ambienti gestiti e storage S3-compatibile.
- Validare requisiti legali su trattamento audio e PDF condivisi.
- Pianificare proof-of-concept con pipeline containerizzata prima della migrazione totale.

# Valutazione di Fattibilità e Rischi

Fattori abilitanti: il backend Express già espone API REST modulari e separa pipeline audio, Markdown e PDF, facilitando il porting verso servizi containerizzati. Il frontend SPA può evolvere a client multi-tenant spostando lo stato critico su API autentiche. Vincoli: dipendenza da CLI pesanti (ffmpeg, whisper, pandoc, xelatex), gestione di file di grandi dimensioni e sensibilità dei contenuti vocali. Rischi principali: latenza e costi di processing audio, compliance (GDPR) per dati sensibili, lock-in piattaforme, regressioni UX durante migrazione. Mitigazioni: predisporre piani di capacity per job queue, cifratura end-to-end, script di migrazione idempotenti con dry-run, feature flags per nuova UX e doppio write temporaneo. Impatto su performance: elaborazioni containerizzate possono risultare più lente rispetto a esecuzioni locali, ma scalabilità orizzontale compensa. Costi aumentano (stimati 200–400 €/mese in produzione con volumi medi), ma benefici di affidabilità e collaborazione superano l’investimento.

## Takeaway pratici

- Avviare benchmark cloud delle pipeline audio/PDF per calibrare dimensionamento.
- Definire matrice rischi con owner e trigger di rollback.
- Allocare budget per cifratura, logging e monitoring sin dall’inizio.

# Architettura Target

Componenti chiave:

- Frontend React servito via CDN con autenticazione federata.
- Backend API stateless (Node.js) con auth, autorizzazione su workspace, orchestration di job.
- Database Postgres gestito per entità, metadati e audit.
- Object storage (S3-compatibile) per media e PDF con CDN e signed URL.
- Job runner/queue (es. Supabase Functions + pg-boss, oppure Railway cron/worker) per pipeline audio→Markdown→PDF.
- Secret management (es. Supabase Secrets o Doppler) e config per ambiente Dev/Stage/Prod.

Opzione A: Supabase (Auth/Postgres/Storage) + Railway (backend) + Cloudflare R2+Workers per CDN.

Pro: stack integrato con piani free generosi, latenza UE, integrazione Auth/DB. Contro: limiti storage free, necessità di orchestrare job esterni e attenzione al lock-in Supabase RPC.

Opzione B: Fly.io (backend+worker) + Neon Postgres + Backblaze B2 + Cloudflare CDN.

Pro: controllo maggiore sulle risorse, scalabilità on demand, costi prevedibili su B2. Contro: maggiore complessità operativa, auth da implementare ex novo.

## Takeaway pratici

- Validare opzione A come baseline MVP multi-tenant.
- Tenere Fly.io + Neon come piano B in caso di limiti Supabase.
- Definire sin da subito secret manager centralizzato.

# Scelte di Piattaforma e Servizi

Soluzione primaria raccomandata:

- Supabase: Auth (OAuth + magic link), Postgres, storage oggetti per asset piccoli, pg-boss per job queue.
- Storage audio primario su Cloudflare R2 o Backblaze B2 (compatibile S3) con CDN Cloudflare per download sicuro.
- Backend Node su Railway (free tier 500 h/mese) o Render (free web service) con autosleep per contenere costi.
- Frontend statico su Cloudflare Pages o Netlify (piani free generosi).
- Monitoring: Axiom o Better Stack (log ingest free).

Alternative: Fly.io (deploy unico backend+worker), Vercel + Neon + S3 Wasabi per compliance UE, oppure AWS Lightsail per maggiore controllo. Criteri scelta: latenza EU, limiti di banda (R2 senza egress verso Cloudflare), policy privacy (data center UE), lock-in (preferire servizi S3-compatibili) e TCO (stimare costi extra per job lunghi).

## Takeaway pratici

- Attivare account Supabase e Cloudflare per valutare piani free effettivi.
- Definire decisione su PaaS backend in base a requisiti di uptime e sleeping.
- Pianificare budget annuo con buffer 30% per crescita volumetrica.

# Modello Dati e Storage

Entità principali:

- User (Auth provider), Workspace (tenant logico), Project (per cliente/campagna), Document (Markdown+PDF), MediaAsset (audio originale/normalizzato), JobRun (pipeline), Prompt, AuditLog, ApiKeyUsage (per Gemini).

Relazioni: Workspace 1:N Project, Project 1:N Document, Document 1:N JobRun, Workspace 1:N Prompt (con versioning), MediaAsset collegato a JobRun e Document. Chiavi surrogate UUID v4.

Storage:

- Bucket audio-original per upload, bucket audio-processed per WAV normalizzati (metadati: hash SHA256, durata, codec, sample rate, lingua).
- Bucket markdown per versioni (naming workspace/project/document/timestamp.md).
- Bucket pdf per output finali con versioning e retention 180 giorni (override configurabile).

Metadati in Postgres con versioning tramite colonne revision e status. Soft delete via deleted_at.

## Takeaway pratici

- Disegnare schema ER dettagliato con attributi obbligatori.
- Configurare lifecycle policy nei bucket per ridurre storage.
- Implementare hash e deduplica per audio identici.

# Sicurezza e Compliance

Requisiti:

- Autenticazione con MFA opzionale; autorizzazione RBAC: Owner, Editor, Reviewer per workspace.
- Segregazione ambienti (Dev/Stage/Prod) con dataset separati.
- Cifratura at-rest e TLS in-transit; secret manager per chiavi LLM e service account.
- Least privilege su bucket tramite signed URL a scadenza e policy per job runner.
- AuditLog per accessi e modifiche (user_id, evento, IP, timestamp).
- Data retention configurabile, diritto all’oblio (soft delete + purge automatica).
- Log applicativi con mascheramento PII, accesso limitato a team autorizzato.

## Takeaway pratici

- Definire strategia di protezione dati condivisa con legal.
- Abilitare logging centralizzato e rotazione segreti trimestrale.
- Implementare DPIA prima del go-live multi-tenant.

# Migrazione Dati

Fasi:

- Inventario: script per esportare ~/.rec2pdf e localStorage; snapshot e checksum.
- Mapping schema: trasformazione JSON in tabelle Postgres, manifest per bucket.
- Migrazione pilota: upload asset su storage con path normalizzati, import SQL in transazione, validazione referenziale, audit.
- Dry-run Stage: riesecuzione idempotente, deduplica su hash audio, assegnazione ownership a utenti registrati.
- Go-live: finestra di manutenzione, doppio write per X giorni, verifica job, backup completo pre-migrazione.
- Rollback: ripristino snapshot locale e revoca accessi cloud in caso di failure critica.

## Takeaway pratici

- Sviluppare migrator CLI con modalità check e apply.
- Documentare mapping attributi per PM/BA.
- Programmare test di riconciliazione campione post-migrazione.

# CRUD di Workspace, Progetti, Documenti

Requisiti funzionali:

- Workspace: creazione con nome unico, slug, policy retention, timezone; inviti team.
- Project: associato a workspace, stato, tag, owner secondario.
- Document: versioning automatico, stato, commenti.

Operazioni transazionali e audit di ogni modifica. Policy: naming kebab-case, lunghezza massima 64 caratteri, tag controllati; soft delete con recovery 30 giorni; versioni documenti numerate semanticamente. Condivisione tramite ruoli o link temporanei.

## Takeaway pratici

- Disegnare contratti REST prima degli endpoint.
- Implementare rate limit per protezione API.
- Pianificare test UAT su flussi CRUD multi-utente.

# Toolchain in Cloud

Strategia:

- Container base con Node.js, ffmpeg, whisper, pandoc, TeX minimal e font.
- Job runner lancia container effimeri con volume temporaneo e monta asset via signed URL.
- Pipeline: scarica audio → normalizza → salva processed → trascrive → genera Markdown via Gemini proxy → render PDF → carica asset → scrive log sintetici.
- Job queue con stati queued, running, succeeded, failed; retry con backoff e limiti di concorrenza.

## Takeaway pratici

- Test di warm-up container per ridurre cold start.
- Caching modelli Whisper su layer immagine o volume condiviso.
- Centralizzare logging job e inviare sintesi all’API.

# Uso di Docker e CI/CD

Motivazioni:

- Dipendenze riproducibili e deploy semplificato su PaaS.
- Immagini distinte: api leggera e worker con toolchain pesante.
- CI/CD con build, test, scan sicurezza, migrazioni DB e deploy controllato.
- Ambienti di anteprima per PR e promozione Stage a Prod.

## Takeaway pratici

- Definire dockerfile multi-stage con caching per TeX.
- Implementare pipeline CI entro la prima iterazione cloud.
- Documentare procedure di rollback immagini.

# Impatto e Integrazione LLM (Gemini)

Motivi per non esporre la chiave personale: rischio di abuso, ripartizione costi impossibile, violazione dei termini. Pattern sicuro: backend proxy con quota per utente, caching di risposte non sensibili e logging d’uso. Ogni chiamata include workspace_id per monitoraggio spesa. I piani free limitano throughput; valutare fallback su modelli open source in worker offline per carichi base. Offerta agli utenti finali: rigenerazione Markdown con opzioni controllate, misurando tasso di successo e costo medio per documento.

## Takeaway pratici

- Implementare rate limit e budgeting per utente.
- Tracciare prompt/generazioni nel DB per auditing.
- Preparare piano B con modelli self‑hosted in caso di limitazioni API.

# Processo di Sviluppo e Governance del Codice

Branching: trunk-based con feature branch e release branch per stage. Protezione main: PR con 2 reviewer, check CI, policy semver. Codex Agent integrato su repo GitHub: permessi limitati, PR automatiche sempre revisionate. Uso di Cursor per sviluppo locale: segreti in file locali esclusi da VCS, injection via secret manager. Feature flags per rollout incrementale. Migrazioni DB versionate e revisionate in PR.

## Takeaway pratici

- Definire PR template con checklist sicurezza.
- Abilitare firma commit e scansione segreti in CI.
- Documentare flusso Agent → PR → review per il team.

# KPI, Stima Costi e Roadmap

KPI tecnici: tempo medio trascrizione target inferiore a 8 minuti per ora di audio, tempo generazione PDF inferiore a 2 minuti, tasso fallimento job inferiore al 2%, costo medio per documento inferiore a 0,80 €, uptime API 99,5%, MTTR inferiore a 30 minuti. KPI di prodotto: retention workspace attivi, numero documenti pubblicati, soddisfazione utenti.

Stima costi mensili: Supabase tier base, storage R2 circa 500 GB, egress Cloudflare intra rete, worker Railway o Render, logging a basso costo; Stage 90–120 €, Produzione 200–400 €.

Roadmap 30/60/90 giorni:

- 0–30 giorni (Owner: Lead Dev): proof‑of‑concept pipeline containerizzata su Supabase+Railway; successo se job audio end‑to‑end riuscito, storage configurato, log centralizzati.
- 31–60 giorni (Owner: Tech Lead Backend): Auth, CRUD cloud, migrazione pilota Stage; successo se utenti invitati, doppio write attivo, test QA superati.
- 61–90 giorni (Owner: PM prodotto): rollout Prod con feature flags, monitor KPI, comunicazione utenti; successo se SLO rispettati per 4 settimane, feedback positivi, piano supporto attivo.

## Takeaway pratici

- Aggiornare forecast costi a ogni sprint.
- Collegare KPI a dashboard condivisa.
- Preparare comunicazione utenti con timeline roadmap.

# Open Questions e Decision Log

Questioni aperte:

- Volume medio e picchi di upload audio per dimensionare storage e bandwidth.
- Requisiti legali specifici su conservazione audio e PDF.
- Necessità di consenso esplicito per uso LLM.

Decisioni prese:

- Target architettura cloud con Supabase e PaaS backend in data 2025-10-05.
- Containerizzazione toolchain come prerequisito per Stage in data 2025-10-05.
- Proxy Gemini gestito server‑side con quota per utente in data 2025-10-05.

## Takeaway pratici

- Ottenere risposte su questioni aperte entro la prossima riunione di steering.
- Aggiornare il registro decisioni a ogni milestone di roadmap.
- Allineare BA su compliance e processi di consenso.
