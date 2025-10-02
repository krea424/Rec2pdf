Manuale utente – Workspace Navigator multi-cliente
1. Panoramica
Workspace Navigator è la nuova vista della Libreria che organizza l’intero archivio per cliente, progetto e stato, fornendo anteprime istantanee e indicatori di completezza per ogni documento generato dalla pipeline.

2. Prerequisiti e configurazione backend
Definisci gli spazi di lavoro: il backend espone le API /api/workspaces per creare, aggiornare e cancellare workspace con metadati su cliente, colori, cataloghi di stato, progetti e policy di versioning (retention, naming, freeze).

Allinea progetti e stati: durante l’elaborazione l’API aggiorna o crea automaticamente progetti e cataloghi di stato se il documento porta nuovi metadati, garantendo coerenza multi-brand.

Naming controllato: i documenti ereditano convenzioni di naming/time-stamping o versioning incrementale in base alla policy del workspace, evitando collisioni fra clienti.

Metadati arricchiti: ogni risposta della pipeline include workspace assegnato e punteggio di struttura (completezza, sezioni mancanti, callout) per alimentare la libreria e le anteprime.

Analisi struttura Markdown: il backend calcola automaticamente heading, sezioni raccomandate, bullet point e word count per orientare il knowledge worker su lacune contenutistiche.

Persistenza nel frontend: la libreria normalizza workspace, struttura e link (PDF/MD), calcolando il punteggio di completezza per ogni elemento salvato.

3. Accesso e layout della vista
Header di controllo – Pulsanti “Aggiorna” (ricarica le definizioni dal backend) e “Usa nel form pipeline” (sincronizza i filtri correnti con il form di registrazione/caricamento) sono sempre disponibili, con badge visivo quando la selezione coincide con quella del form.

Ricerca e filtri salvati – Barra di ricerca full-text su titoli, clienti, progetti, stati, tag e sezioni mancanti, campo per nominare i filtri e chip riutilizzabili/eliminabili per richiami rapidi.

Breadcrumb & sincronizzazione pipeline – Un breadcrumb colorato mostra workspace → progetto → stato e indica quando la selezione è già applicata al form principale.

Colonna Workspace – Elenco ordinato alfabeticamente con colore brand, cliente e conteggio documenti; “Mostra tutti” ripristina la vista completa.

Colonna Progetti e Stati – Pill per progetto con conteggi e palette dedicata, badge stato con frequenze, supporto per “Tutti” e reset rapidi.

Lista documenti – Cards cronologiche con titolo, timestamp, badge progetto/stato, punteggio di completezza e alert sulle sezioni mancanti.

Pannello anteprima – Preview Markdown con fallback di errore, dettagli client/progetto/stato e azioni rapide (Apri PDF, Apri MD, Rigenera PDF, Log pipeline).

Azioni di assegnazione – Pulsanti per allineare o rimuovere l’associazione workspace/progetto/stato dal documento selezionato, con gestione dello stato “in corso”.

4. Operazioni fondamentali
Filtra e salva viste: combina ricerca libera con selezioni workspace/progetto/stato e salva la configurazione per riapplicarla in un clic.

Anteprima immediata: il frontend richiede il Markdown al backend solo al primo click e lo cachea per navigazioni rapide; in assenza di MD segnala l’errore all’utente.

Azioni documento: apri PDF/MD in nuova scheda, rilancia la pubblicazione o consulta i log senza lasciare la vista corrente.

Allinea metadata: “Allinea al workspace” aggiorna il record locale e, se richiesto, crea/aggiorna progetto e stati sul backend prima di sincronizzare l’elenco workspace.

Gestisci non assegnati: puoi filtrare la colonna workspace sui documenti “Non assegnati” per classificarli successivamente.

Propaga al form pipeline: il pulsante “Usa nel form pipeline” copia la selezione corrente nel form di registrazione/caricamento e propone il primo stato utile del progetto scelto.

Gestisci filtri utente: i filtri salvati memorizzano workspace, progetto, stato e query testuale per ripristinare vista e ricerca in un solo click.

5. User journey di riferimento
Crea il workspace del cliente tramite POST /api/workspaces, impostando nome cliente, palette, stati e policy di versioning.

Registra o carica il brainstorming selezionando il workspace (e progetto/stato) nel form; la pipeline restituisce PDF/MD con struttura e metadata arricchiti e aggiorna l’elenco workspace.

Apri Workspace Navigator, filtra per workspace e progetto per vedere solo i deliverable del cliente, con badge di stato e punteggi di completezza.

Valuta la qualità: osserva la percentuale di completezza e l’elenco delle sezioni mancanti per decidere eventuali revisioni o arricchimenti.

Associa o aggiorna lo stato con “Allinea al workspace” e salva un filtro nominativo (es. “Cliente ACME – In revisione”) per ritrovarlo rapidamente.

Propaga le impostazioni al form pipeline con “Usa nel form pipeline” così la prossima registrazione parte già con workspace/progetto/stato corretti.

Itera: ripeti la registrazione o carica nuovi spunti; Workspace Navigator consoliderà cronologia, versioning e insight per cliente/progetto.

6. Suggerimenti e best practice
Monitora la “completezza”: usa il punteggio automatico e l’elenco delle sezioni mancanti per guidare la revisione e assicurare deliverable allineati agli standard di business analysis.

Sfrutta i warning semantici: highlight come “Manca: executive summary” mettono in luce i gap più comuni per knowledge worker frettolosi.

Imposta naming coerenti: definisci slug, colori e policy di naming/versioning per mantenere archivio ordinato tra più clienti e versioni successive.

Crea progetti/stati direttamente dalla pipeline: se assegni un documento a un nuovo progetto o stato, il backend li registra e li rende disponibili a tutta l’interfaccia.