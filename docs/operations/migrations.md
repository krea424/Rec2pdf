# Migrazioni operative

## Migrazione dei prompt locali verso Supabase

Lo script `rec2pdf-backend/scripts/migrate-prompts.js` consente di importare in Supabase i prompt salvati localmente nel file `~/.rec2pdf/prompts.json`. Il tool normalizza i campi principali (slug, colori, regole Markdown/PDF, checklist) e utilizza il client Admin di Supabase per eseguire upsert basati su `id` (quando presente un UUID) oppure su `slug`.

### Prerequisiti

1. Il file `~/.rec2pdf/prompts.json` deve esistere e contenere un oggetto con la chiave `prompts` (o un array di prompt) e, opzionalmente, un campo `updatedAt` globale.
2. Configura le variabili d'ambiente richieste dal backend (`SUPABASE_URL` e `SUPABASE_SERVICE_KEY`). Puoi inserirle in `rec2pdf-backend/.env` oppure esportarle nella shell prima di eseguire lo script.
3. Assicurati che il progetto abbia le dipendenze installate (`npm install` dentro `rec2pdf-backend/`).

### Esecuzione standard

```bash
cd rec2pdf-backend
node scripts/migrate-prompts.js
```

Durante l'esecuzione lo script:

- legge e valida `prompts.json`;
- elimina duplicati su `id`/`slug` (interrompendo il processo se rilevati);
- normalizza campi come `cueCards`, `checklist`, `markdownRules`, `pdfRules` e colori;
- verifica la coerenza dei timestamp `updatedAt` rispetto a `createdAt` e al valore globale del file, segnalando eventuali anomalie;
- suddivide i record con `id` (UUID) da quelli che devono essere upsertati tramite `slug` e invia i batch a Supabase con il client Admin.

Al termine viene mostrato il numero di record migrati per ciascuna modalità (`id` o `slug`).

### Modalità di verifica/dry-run

Per validare il contenuto senza inviare dati a Supabase è disponibile la modalità dry-run:

```bash
cd rec2pdf-backend
node scripts/migrate-prompts.js --dry-run
```

La modalità dry-run effettua comunque tutti i controlli (duplicati e coerenza `updatedAt`) e stampa un estratto dei record normalizzati. È utile per ispezionare il payload che verrebbe scritto nel database prima della migrazione definitiva.

### Parametri opzionali

| Opzione | Descrizione |
|---------|-------------|
| `--dry-run` | Esegue la validazione senza chiamare Supabase. |
| `--file <percorso>` | Utilizza un file JSON alternativo invece di `~/.rec2pdf/prompts.json`. |

### Risoluzione di problemi comuni

- **File mancante o JSON non valido**: lo script termina con un errore esplicito. Verifica il percorso e che il JSON sia ben formato.
- **Variabili d'ambiente mancanti**: viene segnalata la lista delle variabili richieste (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`).
- **Timestamp non coerenti**: se un prompt ha `updatedAt` precedente a `createdAt`, viene normalizzato automaticamente e riportato un avviso. Aggiorna il file sorgente per mantenere i metadati allineati.
- **Duplicati**: eventuali collisioni su `id` o `slug` bloccano la migrazione. Rimuovi o rinomina i prompt duplicati nel file locale prima di rieseguire lo script.
