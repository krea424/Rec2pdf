# Changelog
All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
- Nothing yet.

### Changed
- Nothing yet.

### Fixed
- Nothing yet.


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