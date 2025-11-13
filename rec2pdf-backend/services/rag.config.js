// File: rec2pdf-backend/services/rag.config.js

'use strict';

const RAG_CONFIG = {
  // Parametri generali della pipeline RAG
  pipeline: {
    transformation: {
      maxInputChars: 2000,
      maxQueries: 4,
    },
    retrieval: {
      chunksPerQuery: 10, // Manteniamo il valore aumentato
    },
    reranking: {
      minScoreThreshold: 40,
      topN: 5, // Manteniamo il valore aumentato
    },
  },

  // Registro delle rubriche di valutazione per il Re-ranker, indicizzate per INTENTO
  rerankingRubrics: {
    FINANCE: {
      role: "analista finanziario esperto e meticoloso",
      instructions: `
        1. Priorità Massima (95-100): Documenti che contengono le parole chiave "Ricavi", "Fatturato", "Valore della Produzione" E valori numerici specifici per gli anni richiesti. La combinazione di parola chiave + numero è fondamentale.
        2. Priorità Alta (85-95): Documenti con altri dati quantitativi come "Costi", "Utile", "Margini", "Patrimonio Netto", "Debiti".
        3. Priorità Media (70-85): Documenti che contengono il nome esatto di una delle aziende menzionate nella domanda (es. "U-PMI CONSULTING S.R.L.S.") in un contesto finanziario.
        4. Priorità Bassa (40-60): Discussioni generiche su strategie aziendali o "best practice" senza dati numerici.
        5. Priorità Minima (0-40): Testo irrilevante o definizioni contabili generiche.
      `
    },
    LEGAL: {
      role: "avvocato d'affari specializzato in contrattualistica",
      instructions: `
        1. Priorità Massima (95-100): Clausole contrattuali, articoli di legge, obblighi, responsabilità e definizioni legali specifiche.
        2. Priorità Alta (75-90): Contesto generale del contratto, parti coinvolte, date di scadenza.
        3. Priorità Media (60-75): Corrispondenza email che discute i termini del contratto.
        4. Priorità Bassa (0-40): Opinioni personali o testo non legale.
      `
    },
    PROJECT_MANAGEMENT: {
      role: "Project Manager senior (PMP certified)",
      instructions: `
        1. Priorità Massima (95-100): Documenti che definiscono Action Items, scadenze (due dates), responsabili (owners), rischi e decisioni chiave.
        2. Priorità Alta (75-90): Sintesi di meeting, obiettivi di progetto (goals), milestone e stato di avanzamento (status update).
        3. Priorità Media (60-75): Discussioni generali sul progetto, brainstorming o contesto di background.
        4. Priorità Bassa (0-40): Informazioni non correlate alla gestione operativa del progetto.
      `
    },
    BUSINESS_ANALYSIS: {
        role: "Business Analyst esperto con specializzazione in finanza aziendale",
        instructions: `
          1. Priorità Massima (95-100): Dati finanziari "top-line" (Ricavi, Fatturato) e metriche di business chiave (KPI) direttamente richieste.
          2. Priorità Alta (85-95): Altri dati quantitativi come Costi, Utili, Margini, analisi di mercato numeriche.
          3. Priorità Media (70-85): Requisiti funzionali, analisi SWOT, descrizione di processi di business.
          4. Priorità Bassa (40-60): Interviste a stakeholder, note generali su un problema di business.
          5. Priorità Minima (0-40): Informazioni tecniche di implementazione o opinioni non supportate da dati.
        `
      },
    GENERAL: {
      role: "assistente di ricerca senior",
      instructions: `
        1. Priorità Massima (95-100): Documenti che forniscono una risposta diretta, fattuale e concisa alla domanda principale.
        2. Priorità Alta (75-90): Documenti che offrono un contesto essenziale, esempi pertinenti o spiegazioni dettagliate.
        3. Priorità Media (60-75): Documenti che menzionano le parole chiave principali ma in modo tangenziale o superficiale.
        4. Priorità Bassa (0-40): Documenti irrilevanti, opinioni personali non richieste o testo troppo generico.
      `
    }
  },

  // Prompt per l'analisi dell'intento. Include i nuovi intenti.
  intentAnalysisPromptTemplate: `
    Analizza la seguente lista di query di ricerca e identifica il dominio principale.
    Scegli una delle seguenti categorie: FINANCE, LEGAL, PROJECT_MANAGEMENT, BUSINESS_ANALYSIS, GENERAL.
    Rispondi con una sola parola.

    Ecco alcuni esempi:
    - Query: "analisi comparativa bilanci", "trend ricavi e perdite" -> Categoria: FINANCE
    - Query: "clausole di riservatezza", "termini di servizio" -> Categoria: LEGAL
    - Query: "definire roadmap progetto", "assegnare task team" -> Categoria: PROJECT_MANAGEMENT
    - Query: "analisi SWOT", "ottimizzazione processi aziendali" -> Categoria: BUSINESS_ANALYSIS

    Query da analizzare:
    - {{queries}}

    Categoria:
  `
};

module.exports = { RAG_CONFIG };