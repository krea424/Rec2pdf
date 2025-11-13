// File: rec2pdf-backend/services/ragService.js

'use strict';

const { getAIService } = require('./aiService.js');
const { resolveProvider: resolveAiProvider } = require('./aiProviders.js');
const { canonicalizeProjectScopeId, CONTEXT_SEPARATOR } = require('./utils.js');
const { PromptService } = require('./promptService.js');
// --- MODIFICA 1: Importa la configurazione centralizzata ---
const { RAG_CONFIG } = require('./rag.config.js');
// --- MODIFICA: Importa l'orchestratore ---
const aiOrchestrator = require('./aiOrchestrator.js');

class RAGService {
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error("RAGService richiede un client Supabase valido.");
    }
    this.supabase = supabaseClient;
    this.promptService = new PromptService();
    // --- MODIFICA 2: Usa la configurazione importata ---
    this.config = RAG_CONFIG.pipeline;

    console.log("✅ RAGService (Advanced) initializzato con successo.");
  }

  // In services/ragService.js
  // Sostituisci l'intero metodo _transformQuery con questo

  async _transformQuery(rawText, options = {}) {
    console.log(`[RAG] Avvio Query Transformation...`);
    try {
      const truncatedInput = (rawText || '').substring(0, this.config.transformation.maxInputChars);
      const focus = options.focus || '';
      const notes = options.notes || '';

      if (!truncatedInput && !focus && !notes) {
        console.warn("[RAG] Nessun input per la trasformazione della query.");
        return [];
      }

      const transformPrompt = await this.promptService.render('rag_query_transformer', {
        raw_input: truncatedInput,
        focus: focus,
        notes: notes
      });

      // --- CHIAMATA CORRETTA E UNICA ---
      // Usiamo l'orchestratore per ottenere la risposta.
      const response = await aiOrchestrator.generateContentWithFallback(transformPrompt, options);

      // Il resto della logica per processare la risposta rimane invariato.
      const queries = response
        .split('\n')
        .map(line => line.trim().replace(/^- \s*/, ''))
        .filter(line => line.length > 10 && line.split(/\s+/).length >= 3)
        .slice(0, this.config.transformation.maxQueries);
      
      console.log(`[RAG] Query Transformation ha generato ${queries.length} query.`);
      return queries.length > 0 ? queries : [rawText.substring(0, 100)].filter(Boolean);

    } catch (error) {
      // Il catch ora gestirà anche il fallimento di TUTTI i provider nell'orchestratore.
      console.error("❌ Errore durante la Query Transformation (tutti i provider hanno fallito). Eseguo fallback.", error.message);
      const fallbackQueries = [
        options.focus,
        options.notes,
        rawText.substring(0, 150)
      ].filter(Boolean).map(q => q.trim());
      
      if (fallbackQueries.length === 0) {
        console.warn("[RAG] Nessun input valido per il fallback della query.");
        return ['informazioni generali pertinenti'];
      }
      
      console.log(`[RAG] Eseguo fallback con ${fallbackQueries.length} query.`);
      return fallbackQueries;
    }
  }

  // --- MODIFICA 3: Nuovo metodo per l'analisi dell'intento ---
  // In services/ragService.js
  // Sostituisci l'intero metodo _analyzeQueryIntent con questo

  async _analyzeQueryIntent(queries) {
    if (!queries || queries.length === 0) {
      return 'GENERAL';
    }

    const analysisPrompt = RAG_CONFIG.intentAnalysisPromptTemplate.replace('{{queries}}', queries.join('\n- '));

    try {
      // --- CHIAMATA CORRETTA E UNICA ---
      // Usiamo l'orchestratore. Passiamo un'opzione per forzare un provider veloce ed economico.
      const response = await aiOrchestrator.generateContentWithFallback(analysisPrompt, { textProvider: 'gemini' });
      
      const intent = response.trim().toUpperCase();

      if (RAG_CONFIG.rerankingRubrics[intent]) {
        console.log(`[RAG] Intento identificato: ${intent}`);
        return intent;
      }
      // Se l'LLM risponde con una categoria non valida, facciamo fallback su GENERAL
      console.warn(`[RAG] Intento "${intent}" non riconosciuto, fallback su GENERAL.`);

    } catch (error) {
      // Questo blocco viene eseguito se anche il provider di fallback fallisce.
      console.warn(`[RAG] Analisi intento fallita (tutti i provider hanno fallito), fallback su GENERAL. Errore: ${error.message}`);
    }
    
    return 'GENERAL';
  }

  // --- MODIFICA 4: Funzione principale aggiornata per il flusso dinamico ---
  // In services/ragService.js
  // Sostituisci l'intero metodo retrieveRelevantContext con questo

 // In services/ragService.js

// File: services/ragService.js
// Sostituisci l'intero metodo con questo.

// In services/ragService.js
// Sostituisci l'intero metodo retrieveRelevantContext con questa versione di DEBUG

// In services/ragService.js
// Sostituisci l'intero metodo retrieveRelevantContext con questa versione di DEBUG

async retrieveRelevantContext(queryText, workspaceId, options = {}) {
  console.log('\n\n--- [DEBUG RAG] INIZIO retrieveRelevantContext ---');
  console.log(`[DEBUG RAG] Opzioni ricevute: ${JSON.stringify(options)}`);

  if (!workspaceId) {
    console.warn("[RAG] Workspace ID mancante, impossibile procedere.");
    return ''; // Ritorna sempre stringa, non oggetto debug
  }

  try {
    const transformedQueries = await this._transformQuery(queryText, options);
    console.log(`[DEBUG RAG] Query Trasformate: ${JSON.stringify(transformedQueries)}`);
    if (transformedQueries.length === 0) {
      console.log('[DEBUG RAG] Nessuna query, esco.');
      return '';
    }

    const intent = await this._analyzeQueryIntent(transformedQueries);
    console.log(`[DEBUG RAG] Intento Analizzato: ${intent}`);

    // ==========================================================
    // ==                INIZIO BLOCCO DI DEBUG                ==
    // ==========================================================
    console.log('[DEBUG RAG] Avvio fase di Retrieval...');
    const searchPromises = transformedQueries.map(async (query, i) => {
      console.log(`[DEBUG RAG] Processing query ${i + 1}/${transformedQueries.length}: "${query}"`);
      try {
        const embedding = await aiOrchestrator.generateEmbeddingWithFallback(query, options);
        console.log(`[DEBUG RAG] Embedding generato per query ${i + 1}. Lunghezza: ${embedding?.length}`);

        if (!embedding || embedding.length === 0) {
          throw new Error("L'embedding generato è vuoto o non valido.");
        }

        const rpcParams = {
          query_embedding: embedding,
          match_workspace_id: workspaceId,
          match_project_id: options.projectId ? canonicalizeProjectScopeId(options.projectId) : null,
          match_count: this.config.retrieval.chunksPerQuery,
        };
        console.log(`[DEBUG RAG] Parametri RPC per query ${i + 1}: ${JSON.stringify({ ...rpcParams, query_embedding: `[Vector L=${embedding.length}]` }, null, 2)}`);

        const { data: chunks, error } = await this.supabase.rpc('match_knowledge_chunks', rpcParams);

        if (error) {
          console.error(`❌ [DEBUG RAG] Errore RPC Supabase per query ${i + 1}:`, error);
          return [];
        }
        console.log(`[DEBUG RAG] Supabase ha restituito ${chunks?.length || 0} chunk per query ${i + 1}.`);
        return chunks || [];
      } catch (e) {
        console.error(`❌ [DEBUG RAG] Fallimento CRITICO nel loop di ricerca per query ${i + 1}: ${e.message}`);
        return [];
      }
    });
    // ==========================================================
    // ==                  FINE BLOCCO DI DEBUG                ==
    // ==========================================================

    const results = await Promise.all(searchPromises);
    const uniqueChunks = Array.from(new Map(results.flat().map(c => [c.id, c])).values());
    
    console.log(`[DEBUG RAG] Chunk Recuperati (totale unico): ${uniqueChunks.length}`);
    if (uniqueChunks.length === 0) {
      console.log('[DEBUG RAG] Nessun chunk recuperato, esco.');
      return '';
    }

    let finalContextChunks = [];
    const debugLog = { steps: { selection: {} } }; // Inizializza per i log

    if (uniqueChunks.length <= this.config.reranking.topN) {
      console.log("[DEBUG RAG] Pochi candidati, salto re-ranking.");
      finalContextChunks = uniqueChunks;
      debugLog.steps.selection.strategy = 'skip_reranking_due_to_low_candidate_count';
    } else {
      const rubric = RAG_CONFIG.rerankingRubrics[intent] || RAG_CONFIG.rerankingRubrics.GENERAL;
      const rerankPrompt = `
        Agisci come un ${rubric.role}. Valuta i seguenti documenti per la domanda: "${transformedQueries[0]}".
        Rubrica (${intent}): ${rubric.instructions}
        Documenti:
        ---
        ${uniqueChunks.map((chunk, index) => `[DOCUMENTO ID=${index}]\n${(chunk.content || '').substring(0, 500)}`).join('\n\n')}
        ---
        Restituisci solo un array JSON di oggetti {id, score}.`;
      
      debugLog.steps.rerankerPrompt = { prompt: rerankPrompt };

      try {
        console.log('[DEBUG RAG] Avvio Re-ranking...');
        const rerankResponse = await aiOrchestrator.generateContentWithFallback(rerankPrompt, options);
        console.log(`[DEBUG RAG] Risposta grezza del Re-ranker: "${rerankResponse}"`);
        
        const jsonStringMatch = rerankResponse.match(/\[\s*\{[\s\S]*?\}\s*\]/);
        if (!jsonStringMatch) throw new Error("La risposta del Re-ranker non contiene un JSON valido.");
        
        const rankedScores = JSON.parse(jsonStringMatch[0]);
        console.log(`[DEBUG RAG] Punteggi Re-ranking parsati: ${JSON.stringify(rankedScores)}`);

        const topChunkIndices = rankedScores
          .filter(item => typeof item.id === 'number' && typeof item.score === 'number' && item.score >= this.config.reranking.minScoreThreshold)
          .sort((a, b) => b.score - a.score)
          .slice(0, this.config.reranking.topN)
          .map(item => item.id);
        
        finalContextChunks = topChunkIndices.map(index => uniqueChunks[index]).filter(Boolean);
        debugLog.steps.selection.strategy = 'reranking_score';
        console.log(`[DEBUG RAG] Chunk selezionati dopo Re-ranking: ${finalContextChunks.length}`);

      } catch (rerankError) {
        console.error(`❌ [DEBUG RAG] Re-ranking fallito (${rerankError.message}). Eseguo fallback su similarità.`);
        debugLog.steps.reranking = { rerankFailed: true, error: rerankError.message };

        finalContextChunks = [...uniqueChunks]
          .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
          .slice(0, this.config.reranking.topN);
        debugLog.steps.selection.strategy = 'fallback_to_similarity_score';
        console.log(`[DEBUG RAG] Chunk selezionati dopo Fallback: ${finalContextChunks.length}`);
      }
    }

    const structuredContext = finalContextChunks.map((chunk, index) => {
      const sourceName = chunk.metadata?.sourceFile || `Fonte Sconosciuta ${index + 1}`;
      return `--- Inizio Documento di Contesto ${index + 1} (Fonte: ${sourceName}) ---\n\n${chunk.content}\n\n--- Fine Documento di Contesto ${index + 1} ---`;
    }).join(`\n\n${CONTEXT_SEPARATOR}\n\n`);

    const finalContext = finalContextChunks.length > 0
      ? `Ecco i documenti di contesto più pertinenti che ho trovato. Usali per costruire la tua risposta:\n\n${structuredContext}`
      : '';

    console.log(`[DEBUG RAG] Lunghezza contesto finale: ${finalContext.length}`);
    console.log('--- [DEBUG RAG] FINE retrieveRelevantContext ---\n\n');

    return finalContext;

  } catch (error) {
    console.error('❌ [RAG] Errore grave in retrieveRelevantContext:', error);
    return '';
  }
}
}
module.exports = { RAGService };