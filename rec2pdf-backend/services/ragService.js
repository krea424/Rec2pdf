'use strict';

const { getAIService } = require('./aiService.js');
const { resolveProvider: resolveAiProvider } = require('./aiProviders.js');
const { canonicalizeProjectScopeId, CONTEXT_SEPARATOR } = require('./utils.js');
const { PromptService } = require('./promptService.js');

/**
 * RAGService gestisce la pipeline di Retrieval-Augmented Generation avanzata.
 * Le sue responsabilità includono:
 * 1. Trasformare l'input utente in query di ricerca ottimizzate (Query Transformation).
 * 2. Eseguire ricerche vettoriali multiple su Supabase (Multi-Query Retrieval).
 * 3. Valutare e riordinare i risultati per pertinenza (Re-ranking).
 * 4. Selezionare i migliori chunk per costruire un contesto denso e preciso.
 */
class RAGService {
  /**
   * @param {object} supabaseClient - Un'istanza del client Supabase.
   */
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error("RAGService richiede un client Supabase valido.");
    }
    this.supabase = supabaseClient;
    this.promptService = new PromptService();

    // Centralizziamo tutti i parametri di tuning in un unico oggetto di configurazione.
    this.config = {
      // Query Transformation
      transformation: {
        maxInputChars: 2000,
        maxQueries: 4,
      },
      // Retrieval
      retrieval: {
        chunksPerQuery: 5,
      },
      // Re-ranking
      reranking: {
        minScoreThreshold: 40, // Soglia di pertinenza minima (0-100)
        topN: 3, // Numero massimo di chunk da selezionare dopo il re-ranking
      },
    };

    console.log("✅ RAGService (Advanced) initializzato con successo.");
  }

  /**
   * Trasforma un testo grezzo in un set di query di ricerca focalizzate.
   * @param {string} rawText - La trascrizione o l'input grezzo dell'utente.
   * @param {object} options - Contiene `focus` e `notes` per guidare la trasformazione.
   * @returns {Promise<string[]>} Un array di query ottimizzate.
   */
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

      const textProvider = resolveAiProvider('text', options.textProvider || 'gemini');
      const aiGenerator = getAIService(textProvider.id, textProvider.apiKey, textProvider.model);
      
      const response = await aiGenerator.generateContent(transformPrompt);

      const queries = response
        .split('\n')
        .map(line => line.trim().replace(/^- \s*/, ''))
        .filter(line => line.length > 10 && line.split(/\s+/).length >= 3)
        .slice(0, this.config.transformation.maxQueries);
      
      console.log(`[RAG] Query Transformation ha generato ${queries.length} query.`);
      return queries.length > 0 ? queries : [rawText.substring(0, 100)].filter(Boolean);

    } catch (error) {
      console.error("❌ [RAG] Errore durante la Query Transformation. Eseguo fallback.", error.message);
      const fallbackQueries = [
        options.focus,
        options.notes,
        rawText.substring(0, 150) // Un pezzo significativo della trascrizione
      ].filter(Boolean).map(q => q.trim()); // Pulisce e rimuove stringhe vuote
      
      // Se non c'è nulla, usa un fallback generico
      if (fallbackQueries.length === 0) {
        console.warn("[RAG] Nessun input valido per il fallback della query.");
        return ['informazioni generali pertinenti'];
      }
      
      console.log(`[RAG] Eseguo fallback con ${fallbackQueries.length} query.`);
      return fallbackQueries;
    }
  }

  /**
   * Orchestra l'intero processo di recupero del contesto.
   * @param {string} queryText - L'input grezzo (trascrizione).
   * @param {string} workspaceId - L'UUID del workspace per filtrare la ricerca.
   * @param {object} options - Opzioni aggiuntive come `projectId`, `focus`, `notes`.
   * @returns {Promise<string>} Il contesto finale, pronto per essere usato dall'LLM di generazione.
   */
  async retrieveRelevantContext(queryText, workspaceId, options = {}) {
    if (!workspaceId) {
      console.warn("[RAG] Workspace ID mancante, impossibile procedere.");
      return '';
    }

    try {
      // --- FASE 0: QUERY TRANSFORMATION ---
      const transformedQueries = await this._transformQuery(queryText, options);
      if (transformedQueries.length === 0) {
        console.log("[RAG] Nessuna query valida generata. Interrompo.");
        return '';
      }

      // --- FASE 1: MULTI-QUERY RETRIEVAL ---
      console.log(`[RAG] Fase 1: Avvio Multi-Query Retrieval per ${transformedQueries.length} query.`);
      const embeddingProvider = resolveAiProvider('embedding', options.embeddingProvider);
      const aiEmbedder = getAIService(embeddingProvider.id, embeddingProvider.apiKey, embeddingProvider.model);
      
      const searchPromises = transformedQueries.map(async (query) => {
        try {
          const embedding = await aiEmbedder.generateEmbedding(query);
          const { data: chunks, error } = await this.supabase.rpc('match_knowledge_chunks', {
            query_embedding: embedding,
            match_workspace_id: workspaceId,
            match_project_id: options.projectId ? canonicalizeProjectScopeId(options.projectId) : null,
            match_count: this.config.retrieval.chunksPerQuery,
          });
          return error ? [] : (chunks || []);
        } catch (e) {
          console.error(`[RAG] Errore durante la ricerca per la query "${query}":`, e);
          return [];
        }
      });

      const results = await Promise.all(searchPromises);
      const uniqueChunks = Array.from(new Map(results.flat().map(c => [c.id, c])).values());
      
      console.log(`[RAG] Recuperati ${uniqueChunks.length} chunk candidati unici in totale.`);
      if (uniqueChunks.length === 0) return '';

      // Ottimizzazione: se ci sono pochi candidati, il re-ranking è superfluo.
      if (uniqueChunks.length <= this.config.reranking.topN) {
        console.log("[RAG] Pochi candidati, re-ranking saltato. Uso i risultati del retrieval.");
        return uniqueChunks.map(chunk => chunk.content || '').filter(Boolean).join(CONTEXT_SEPARATOR);
      }

      // --- FASE 2: RE-RANKING ---
      console.log(`[RAG] Fase 2: Avvio Re-ranking di ${uniqueChunks.length} candidati.`);
      const rerankPrompt = `
        Sei un giudice esperto di pertinenza. Il tuo compito è valutare una lista di frammenti di testo ("Documenti") e assegnare un punteggio di rilevanza da 0 a 100 rispetto a una "Domanda Principale".

        Domanda Principale: "${transformedQueries[0]}"

        Documenti da Valutare:
        ---
        ${uniqueChunks.map((chunk, index) => `[DOCUMENTO ID=${index}]\n${(chunk.content || '').substring(0, 400)}`).join('\n\n')}
        ---

        Istruzioni:
        Per ogni DOCUMENTO, valuta quanto è utile e pertinente per rispondere in modo completo alla Domanda Principale.
        Restituisci la tua valutazione come un array JSON di oggetti. Ogni oggetto deve contenere "id" (l'ID del documento) e "score" (un numero intero da 0 a 100).
        Restituisci SOLO l'array JSON, senza testo introduttivo, spiegazioni o blocchi di codice \`\`\`.

        Valutazione JSON:`;
      
      let rankedScores = [];
      try {
        const textProvider = resolveAiProvider('text', options.textProvider || 'gemini');
        const rerankerLLM = getAIService(textProvider.id, textProvider.apiKey, textProvider.model);
        const rerankResponse = await rerankerLLM.generateContent(rerankPrompt);
        
        const jsonStringMatch = rerankResponse.match(/\[\s*\{[\s\S]*?\}\s*\]/);
        if (!jsonStringMatch) throw new Error("Nessun array JSON valido trovato nella risposta del reranker.");
        rankedScores = JSON.parse(jsonStringMatch[0]);

        console.log("[RAG DEBUG] Punteggi di Re-ranking ricevuti:");
        console.table(rankedScores.map(scoreItem => ({
          id: scoreItem.id,
          score: scoreItem.score,
          content_preview: (uniqueChunks[scoreItem.id]?.content || "N/A").substring(0, 80) + "..."
        })));

      } catch (rerankError) {
        console.error("❌ [RAG] Errore nella fase di Re-ranking. Eseguo fallback all'ordinamento per similarità.", rerankError.message);
        
        // Ordina i chunk candidati in base al punteggio di similarità originale di Supabase
        const sortedBySimilarity = [...uniqueChunks].sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
        
        // Prendi i migliori N chunk, come definito nella configurazione
        const topChunks = sortedBySimilarity.slice(0, this.config.reranking.topN);
        
        console.log(`[RAG Fallback] Selezionati i ${topChunks.length} chunk migliori per similarità.`);
        
        // Restituisci il contesto di fallback e continua l'esecuzione
        return topChunks.map(chunk => chunk.content || '').filter(Boolean).join(CONTEXT_SEPARATOR);
      }
      // --- FASE 3: SELEZIONE ---
      const topChunkIndices = rankedScores
        .filter(item => typeof item.id === 'number' && typeof item.score === 'number' && item.score >= this.config.reranking.minScoreThreshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, this.config.reranking.topN)
        .map(item => item.id);

      const finalContextChunks = topChunkIndices.map(index => uniqueChunks[index]).filter(Boolean);
      console.log(`[RAG] Fase 3: Selezionati i ${finalContextChunks.length} chunk migliori.`);

      return finalContextChunks.map(chunk => chunk.content || '').filter(Boolean).join(CONTEXT_SEPARATOR);

    } catch (error) {
      console.error('❌ [RAG] Errore grave in retrieveRelevantContext:', error);
      return '';
    }
  }
}

module.exports = { RAGService };