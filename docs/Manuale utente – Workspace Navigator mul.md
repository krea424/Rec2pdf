Manuale utente – Workspace Navigator multi-cliente
===============================================

1. Panoramica
-------------
Workspace Navigator organizza la cronologia Rec2PDF per cliente, progetto e stato. La vista unifica filtri salvabili, anteprime Markdown in cache e azioni rapide su PDF/MD/log per accelerare la gestione multi-brand.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L61-L215】

2. Prerequisiti e configurazione backend
---------------------------------------
* Definisci i workspace dal backend (`/api/workspaces`) impostando client, colori, cataloghi di stato e policy di versioning. Gli aggiornamenti vengono sincronizzati con il frontend al refresh della libreria.【F:rec2pdf-backend/server.js†L1131-L1217】【F:rec2pdf-frontend/src/App.jsx†L1376-L1554】
* La pipeline restituisce workspace assegnato, progetto, stato e struttura del documento (punteggio, sezioni mancanti, checklist prompt) per alimentare le anteprime.【F:rec2pdf-backend/server.js†L1681-L1707】【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L35-L58】
* Le librerie cloud e locale condividono la stessa selezione; l’adozione dei filtri nel form pipeline avviene tramite `onAdoptSelection` e `handleAssignEntryWorkspace`.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L61-L215】【F:rec2pdf-frontend/src/App.jsx†L560-L714】

3. Layout e comandi principali
------------------------------
### 3.1 Barra strumenti
* **Tabs Cronologia/Cloud**: consente di alternare la vista locale e quella Supabase mantenendo la stessa selezione.【F:rec2pdf-frontend/src/pages/Library.jsx†L6-L59】 
* **Ricerca full-text**: filtra titoli, clienti, progetti, stati, tag e sezioni mancanti; apre automaticamente il pannello Filtri.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L40-L120】
* **Filtri salvati**: memorizza combinazioni di workspace/progetto/stato/query e le ripristina in un clic.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L84-L115】【F:rec2pdf-frontend/src/App.jsx†L560-L714】
* **Pulsante "Usa nel form pipeline"**: copia la selezione corrente nel form principale, proponendo stato e progetto coerenti.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L61-L83】

### 3.2 Colonne navigator
* **Workspace**: elenco con colori brand, conteggio documenti e ordinamento alfabetico; include voce “Non assegnati”.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L122-L198】
* **Progetti e stati**: pill con contatori, palette dedicate e default derivati da workspace o `DEFAULT_STATUSES`.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L122-L198】
* **Lista documenti**: card cronologiche con timestamp formattato, punteggio completezza e badge progetto/stato.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L28-L38】【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L122-L198】

### 3.3 Pannello anteprima
* Richiama il Markdown solo al primo click e lo cachea per navigazioni successive (`previewCache`).【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L91-L108】
* Mostra link rapidi per Apri PDF/MD, Rigenera PDF, Visualizza log e Allinea workspace; tutte le azioni espongono stato di caricamento.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L61-L198】
* Evidenzia l’elenco delle sezioni mancanti (checklist prompt) e i metadati prompt/pipeline a supporto della revisione.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L35-L58】

4. Operazioni fondamentali
--------------------------
1. **Aggiorna e sincronizza**: premi “Aggiorna” per ricaricare workspaces e cronologia dal backend; il pannello mostra spinner finché `loading` è attivo.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L61-L115】
2. **Salva un filtro personale**: combina ricerca + selezione workspace/progetto/stato, inserisci un nome e salva; la configurazione è persistita in `localStorage`.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L84-L115】【F:rec2pdf-frontend/src/App.jsx†L560-L714】
3. **Esamina un documento**: seleziona la card, attiva l’anteprima Markdown e consulta punteggi di completezza/mancanze per decidere eventuali revisioni.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L35-L108】
4. **Allinea al workspace**: usa l’azione dedicata per aggiornare workspace/progetto/stato del documento, mantenendo sincronizzati storico locale e backend.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L61-L198】
5. **Propaga al form pipeline**: applica “Usa nel form pipeline” per preparare la prossima registrazione/caricamento con gli stessi metadati.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L61-L83】【F:rec2pdf-frontend/src/App.jsx†L560-L714】

5. Workflow consigliato
-----------------------
1. Crea workspace e progetti dal cassetto **Impostazioni → Branding/Advanced**, definendo colori, default di stato e policy di versioning.【F:rec2pdf-frontend/src/components/layout/SettingsDrawer.jsx†L47-L199】
2. Registra o carica documenti associando workspace/progetto/stato; la pipeline aggiorna cronologia e metriche di struttura.【F:rec2pdf-frontend/src/App.jsx†L1658-L2354】【F:rec2pdf-backend/server.js†L1681-L1707】
3. Usa Workspace Navigator per filtrare per cliente/progetto, analizzare punteggi e se necessario rigenerare PDF o aprire i log.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L61-L198】
4. Salva viste ricorrenti (es. “Cliente ACME – In revisione”) e adotta le selezioni nel form pipeline per mantenere consistenza tra registrazioni successive.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L84-L115】【F:rec2pdf-frontend/src/App.jsx†L560-L714】
5. Monitora i documenti “Non assegnati” filtrando la colonna workspace per completare rapidamente i metadati mancanti.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L122-L198】

6. Suggerimenti e best practice
-------------------------------
* Tieni d’occhio il punteggio di completezza e le sezioni mancanti per indirizzare la revisione editoriale prima di condividere il PDF.【F:rec2pdf-backend/server.js†L1681-L1707】【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L35-L58】
* Utilizza l’anteprima cache per confrontare versioni consecutive senza ricaricare lo stesso Markdown dal backend.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L91-L108】
* Affianca la Cloud Library quando ti serve il file originale da Supabase: il prefisso di ricerca viene sincronizzato con la selezione corrente, evitando errori di percorso.【F:rec2pdf-frontend/src/components/CloudLibraryPanel.jsx†L76-L198】【F:rec2pdf-frontend/src/pages/Library.jsx†L6-L59】
* In caso di riassegnazioni massive, usa i filtri salvati per scorrere rapidamente i documenti che richiedono la stessa etichetta e applica l’azione di allineamento in sequenza.【F:rec2pdf-frontend/src/components/WorkspaceNavigator.jsx†L61-L198】
