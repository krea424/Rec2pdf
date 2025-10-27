# Changelog
All notable changes to this project will be documented in this file.

## [6.0.0] - 2025-10-27

### BREAKING CHANGE

Questa versione introduce una revisione completa dell'architettura di persistenza dei dati, migrando l'intera applicazione dal filesystem locale a **Supabase**. Tutti i dati utente (Workspace, Profili, Prompt) sono ora gestiti tramite un database PostgreSQL e le relative API, mentre gli asset (loghi) sono gestiti tramite Supabase Storage. Questo cambiamento migliora drasticamente la scalabilità, la sicurezza e l'affidabilità dell'applicazione, rendendola pronta per il deploy in ambienti cloud moderni.

### Added
- **Infrastruttura Supabase**: Implementato schema del database con tabelle per `workspaces`, `profiles`, `workspace_profiles` e `prompts`.
- **Backend Refactoring**: L'intero backend (`server.js`) è stato riscritto per usare il client Supabase per tutte le operazioni CRUD, eliminando la dipendenza dal filesystem (`fs`).
- **Sicurezza Multi-Utente**: Introdotta la gestione dei dati per utente tramite `owner_id` e policy di Row Level Security (RLS) su Supabase.
- **Sincronizzazione Profili Utente**: Aggiunto un trigger di database per creare automaticamente un profilo utente (`public.profiles`) alla registrazione di un nuovo utente (`auth.users`).
- **Validazione Robusta**: Integrata la libreria `zod` nel backend per la validazione degli schemi di dati in entrata.
- **Gestione Loghi su Cloud**: La gestione dei loghi ora utilizza Supabase Storage, con upload diretti e accesso tramite URL pubblici.
- **Script di Migrazione**: Aggiunti script operativi (`migrate-workspaces.js`, `migrate-logos.js`) per consentire agli utenti esistenti di importare i loro dati locali nel nuovo sistema.

### Changed
- **Frontend State Management**: Il frontend è stato aggiornato per recuperare tutti i dati tramite le API del backend, utilizzando React Context per la gestione dello stato.
- **Dipendenze**: Aggiornate le dipendenze di backend e frontend per supportare la nuova architettura.

### Removed
- **Tutta la logica basata su filesystem**: Le funzioni `read/write` per i file `.json` e la gestione delle cartelle locali sono state completamente rimosse dal backend.


## [4.0.0] - 2025-10-22
### Added
- Endpoint `POST /api/workspaces/:workspaceId/ingest` con coda di elaborazione e supporto multi-formato (testi, PDF, audio) per aggiornare la knowledge base RAG senza script manuali.
- Vista "Knowledge Base" nel frontend con drag&drop, progress feedback e riepilogo dei documenti indicizzati per workspace.
- Retrieval automatico del contesto RAG durante la generazione del Markdown, combinando prompt, note e trascrizioni per la chiamata a Gemini.
### Changed
- Pipeline audio orchestrata via Supabase Storage con retry su upload/download e validazione dei WAV per gestire in modo affidabile registrazioni lunghe.
### Fixed
- Corretto l'ordine degli hook in `CreatePage` e `WorkspaceNavigator` eliminando i warning di React DevTools in console.

## [3.0.0] - 2025-10-20
### Added
- Pipeline di trascrizione per riunioni con identificazione speaker (diarizzazione) tramite WhisperX.
- Interfaccia utente per la mappatura manuale degli speaker.
- Supporto per template PDF basati su HTML, con motore di rendering `wkhtmltopdf`.
- Nuovo template "Verbale Meeting" (`verbale_meeting.html`) per un output più accattivante.
- Endpoint API `/api/templates` per elencare dinamicamente i template disponibili.
- Menu a tendina nella UI per la selezione del template.

### Changed
- Lo script `publish.sh` ora supporta condizionalmente sia template LaTeX che HTML.
- Aggiornato il `Dockerfile` per includere le dipendenze di `whisperX`.