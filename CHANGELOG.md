# Changelog
All notable changes to this project will be documented in this file.

## [Unreleased]
### Added

### Changed

### Fixed


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