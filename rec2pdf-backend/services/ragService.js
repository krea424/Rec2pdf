// File: rec2pdf-backend/services/ragService.js

'use strict';

const { getAIService } = require('./aiService.js');
const { resolveProvider: resolveAiProvider } = require('./aiProviders.js');
const { canonicalizeProjectScopeId, CONTEXT_SEPARATOR } = require('./utils.js');
const { PromptService } = require('./promptService.js');
// --- MODIFICA 1: Importa la configurazione centralizzata ---
const { RAG_CONFIG } = require('./rag.config.js');

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

  async _transformQuery(rawText, options = {}) {
    // ... (questo metodo rimane invariato) ...
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
  async _analyzeQueryIntent(queries) {
    if (!queries || queries.length === 0) {
      return 'GENERAL';
    }

    const analysisPrompt = RAG_CONFIG.intentAnalysisPromptTemplate.replace('{{queries}}', queries.join('\n- '));

    try {
      const textProvider = resolveAiProvider('text', 'gemini');
      const analyzerLlm = getAIService(textProvider.id, textProvider.apiKey, textProvider.model);
      const response = await analyzerLlm.generateContent(analysisPrompt);
      const intent = response.trim().toUpperCase();

      if (RAG_CONFIG.rerankingRubrics[intent]) {
        console.log(`[RAG] Intento identificato: ${intent}`);
        return intent;
      }
    } catch (error) {
      console.warn(`[RAG] Analisi intento fallita, fallback su GENERAL. Errore: ${error.message}`);
    }
    return 'GENERAL';
  }

  // --- MODIFICA 4: Funzione principale aggiornata per il flusso dinamico ---
  async retrieveRelevantContext(queryText, workspaceId, options = {}) {
    if (!workspaceId) {
      console.warn("[RAG] Workspace ID mancante, impossibile procedere.");
      return options.debug ? { error: 'Workspace ID mancante' } : '';
    }

    const debugLog = {
      timestamp: new Date().toISOString(),
      inputs: { queryText, workspaceId, options },
      steps: {},
    };

    try {
      const transformedQueries = await this._transformQuery(queryText, options);
      debugLog.steps.queryTransformation = { queries: transformedQueries };
      if (transformedQueries.length === 0) return options.debug ? debugLog : '';

      const intent = await this._analyzeQueryIntent(transformedQueries);
      debugLog.steps.queryAnalysis = { intent };

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
        } catch (e) { return []; }
      });

      const results = await Promise.all(searchPromises);
      const uniqueChunks = Array.from(new Map(results.flat().map(c => [c.id, c])).values());
      
      debugLog.steps.retrieval = { retrievedChunks: uniqueChunks };
      if (uniqueChunks.length === 0) return options.debug ? debugLog : '';

      if (uniqueChunks.length <= this.config.reranking.topN) {
        const finalContext = uniqueChunks.map(chunk => chunk.content || '').filter(Boolean).join(CONTEXT_SEPARATOR);
        debugLog.steps.selection = { strategy: 'skip_reranking_due_to_low_candidate_count', finalChunks: uniqueChunks, finalContext };
        return options.debug ? debugLog : finalContext;
      }

      const rubric = RAG_CONFIG.rerankingRubrics[intent] || RAG_CONFIG.rerankingRubrics.GENERAL;
      const rerankPrompt = `
        Agisci come un ${rubric.role}. Il tuo compito è valutare una lista di "Documenti" e assegnare un punteggio di pertinenza da 0 a 100 rispetto a una "Domanda Principale", seguendo una rubrica specifica.
        Domanda Principale: "${transformedQueries[0]}"
        Rubrica di Valutazione (${intent}):
        ${rubric.instructions}
        Documenti da Valutare:
        ---
        ${uniqueChunks.map((chunk, index) => `[DOCUMENTO ID=${index}]\n${(chunk.content || '').substring(0, 500)}`).join('\n\n')}
        ---
        Restituisci la tua valutazione come un array JSON di oggetti {id, score}, e nient'altro.
        Valutazione JSON:`;
      
      debugLog.steps.rerankerPrompt = { prompt: rerankPrompt };

      let rankedScores = [];
      let rerankFailed = false;
      try {
        const textProvider = resolveAiProvider('text', options.textProvider || 'gemini');
        const rerankerLLM = getAIService(textProvider.id, textProvider.apiKey, textProvider.model);
        const rerankResponse = await rerankerLLM.generateContent(rerankPrompt);
        const jsonStringMatch = rerankResponse.match(/\[\s*\{[\s\S]*?\}\s*\]/);
        if (!jsonStringMatch) throw new Error("Nessun array JSON valido trovato nella risposta del reranker.");
        rankedScores = JSON.parse(jsonStringMatch[0]);
      } catch (rerankError) {
        console.error("❌ [RAG] Errore nella fase di Re-ranking. Eseguo fallback.", rerankError.message);
        rerankFailed = true;
      }
      
      debugLog.steps.reranking = { rerankFailed, scores: rankedScores.map(scoreItem => ({ chunkId: uniqueChunks[scoreItem.id]?.id, score: scoreItem.score, contentPreview: (uniqueChunks[scoreItem.id]?.content || "N/A").substring(0, 150) + "..." })).sort((a,b) => b.score - a.score) };

      if (rerankFailed) {
        const sortedBySimilarity = [...uniqueChunks].sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
        const topChunks = sortedBySimilarity.slice(0, this.config.reranking.topN);
        const finalContext = topChunks.map(chunk => chunk.content || '').filter(Boolean).join(CONTEXT_SEPARATOR);
        debugLog.steps.selection = { strategy: 'fallback_to_similarity_score', finalChunks: topChunks, finalContext };
        return options.debug ? debugLog : finalContext;
      }
      
      // --- FASE 3: SELEZIONE (E COSTRUZIONE CONTESTO INTELLIGENTE) ---
      const topChunkIndices = rankedScores
        .filter(item => typeof item.id === 'number' && typeof item.score === 'number' && item.score >= this.config.reranking.minScoreThreshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, this.config.reranking.topN)
        .map(item => item.id);

      const finalContextChunks = topChunkIndices.map(index => uniqueChunks[index]).filter(Boolean);
      
      // ========================================================================
      // ==                  INIZIO MODIFICA STRATEGICA                      ==
      // ========================================================================
      
      // Invece di unire ciecamente i chunk, li strutturiamo.
      const structuredContext = finalContextChunks.map((chunk, index) => {
        const sourceName = chunk.metadata?.sourceFile || `Fonte Sconosciuta ${index + 1}`;
        // Usiamo CONTEXT_SEPARATOR per coerenza, ma potremmo usare anche \n\n
        return `--- Inizio Documento di Contesto ${index + 1} (Fonte: ${sourceName}) ---\n\n${chunk.content}\n\n--- Fine Documento di Contesto ${index + 1} ---`;
      }).join(`\n\n${CONTEXT_SEPARATOR}\n\n`); // Separiamo i blocchi con il nostro separatore standard

      const finalContext = `Ecco i documenti di contesto più pertinenti che ho trovato. Usali per costruire la tua risposta:\n\n${structuredContext}`;
      
      // ========================================================================
      // ==                    FINE MODIFICA STRATEGICA                      ==
      // ========================================================================

      debugLog.steps.selection = {
          strategy: 'reranking_score',
          finalChunks: finalContextChunks,
          finalContext, // Ora logghiamo il contesto strutturato
      };

      console.log(`[RAG] Fase 3: Selezionati i ${finalContextChunks.length} chunk migliori e costruito contesto strutturato.`);

      if (options.debug) {
        return debugLog;
      }

      return finalContext;

    } catch (error) {
      console.error('❌ [RAG] Errore grave in retrieveRelevantContext:', error);
      debugLog.error = error.message;
      return options.debug ? debugLog : '';
    }
  }
}

module.exports = { RAGService };