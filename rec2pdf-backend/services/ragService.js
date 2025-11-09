'use strict';

// ==========================================================
// ==                  DIPENDENZE                          ==
// ==========================================================
const { getAIService } = require('./aiService.js');
const { resolveProvider: resolveAiProvider } = require('./aiProviders.js');
const { canonicalizeProjectScopeId } = require('./utils.js');

const CONTEXT_SEPARATOR = '\n\n---\n\n';


// ==========================================================
// ==                  CLASSE DEL SERVIZIO RAG             ==
// ==========================================================
class RAGService {
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error("RAGService richiede un client Supabase valido.");
    }
    this.supabase = supabaseClient;
    console.log("✅ RAGService initializzato con successo.");
  }

  /**
   * Orchestra il recupero del contesto con una pipeline RAG avanzata che include il re-ranking.
   * 1. Recupera una rosa ampia di chunk candidati (Retrieval).
   * 2. Usa un LLM per riordinarli in base alla pertinenza (Re-ranking).
   * 3. Seleziona solo i chunk migliori per formare il contesto finale (Selezione).
   */
  async retrieveRelevantContext(queryText, workspaceId, options = {}) {
    const normalizedQuery = (queryText || '').trim();
    if (!workspaceId || !normalizedQuery) {
      return '';
    }

    try {
      // --- FASE 1: RETRIEVAL (Recupero di una rosa ampia di candidati) ---
      console.log(`[RAG] Fase 1: Avvio Retrieval per query: "${normalizedQuery.substring(0, 70)}..."`);
      const embeddingProvider = resolveAiProvider('embedding', options.embeddingProvider);
      const aiEmbedder = getAIService(embeddingProvider.id, embeddingProvider.apiKey, embeddingProvider.model);
      const embedding = await aiEmbedder.generateEmbedding(normalizedQuery);

      const CANDIDATE_COUNT = 10; // Recuperiamo N=10 candidati per avere materiale su cui lavorare.
      const { data: candidateChunks, error } = await this.supabase.rpc('match_knowledge_chunks', {
        query_embedding: embedding,
        match_workspace_id: workspaceId,
        match_project_id: options.projectId ? canonicalizeProjectScopeId(options.projectId) : null,
        match_count: CANDIDATE_COUNT,
      });

      if (error) {
        console.error('❌ [RAG] Errore RPC match_knowledge_chunks:', error);
        return '';
      }
      if (!candidateChunks || candidateChunks.length === 0) {
        console.log("[RAG] Nessun chunk candidato trovato nella fase di retrieval.");
        return '';
      }
      console.log(`[RAG] Recuperati ${candidateChunks.length} chunk candidati.`);

      // Ottimizzazione: se ci sono pochi candidati, il re-ranking è inutile e costoso.
      if (candidateChunks.length <= 2) {
        console.log("[RAG] Pochi candidati, re-ranking saltato.");
        return candidateChunks.map(chunk => chunk.content || '').filter(Boolean).join(CONTEXT_SEPARATOR);
      }

      // --- FASE 2: RE-RANKING (LLM-as-a-Reranker) ---
      console.log(`[RAG] Fase 2: Avvio Re-ranking di ${candidateChunks.length} candidati.`);
      const rerankPrompt = `
        Sei un giudice esperto di pertinenza. Il tuo compito è valutare una lista di documenti e assegnare un punteggio di rilevanza da 0 a 100 rispetto a una domanda specifica.

        Domanda dell'utente: "${normalizedQuery}"

        Documenti da valutare:
        ---
        ${candidateChunks.map((chunk, index) => `[DOCUMENTO ID=${index}]\n${(chunk.content || '').substring(0, 500)}`).join('\n\n')}
        ---

        Istruzioni:
        Per ogni DOCUMENTO, valuta quanto è pertinente per rispondere alla Domanda dell'utente.
        Restituisci la tua valutazione come una lista JSON di oggetti, dove ogni oggetto contiene "id" e "score".
        Lo score deve essere un numero intero da 0 (totalmente irrilevante) a 100 (estremamente pertinente).
        Restituisci SOLO l'array JSON, senza commenti o spiegazioni.

        La tua valutazione JSON:`;

      let rankedScores = [];
      try {
        // Usiamo il provider di testo di default ('text'), che è sicuramente definito.
        const textProvider = resolveAiProvider('text', options.textProvider);
        const rerankerLLM = getAIService(textProvider.id, textProvider.apiKey, textProvider.model);
        
        const rerankResponse = await rerankerLLM.generateContent(rerankPrompt);
        
        const jsonStringMatch = rerankResponse.match(/\[[\s\S]*?\]/);
        if (!jsonStringMatch) {
          throw new Error("Nessun array JSON trovato nella risposta del reranker.");
        }
        rankedScores = JSON.parse(jsonStringMatch[0]);

      } catch (rerankError) {
        console.error("❌ [RAG] Errore nella fase di Re-ranking. Eseguo fallback all'ordinamento per similarità.", rerankError.message);
        const topChunks = candidateChunks.slice(0, 3); // Fallback di sicurezza: prendi i primi 3
        return topChunks.map(chunk => chunk.content || '').filter(Boolean).join(CONTEXT_SEPARATOR);
      }

      // --- FASE 3: SELEZIONE (Prendiamo i migliori) ---
      const TOP_P = 3; // Selezioniamo solo i 3 chunk migliori
      const topChunkIndices = rankedScores
        .filter(item => typeof item.id === 'number' && typeof item.score === 'number' && item.score > 50) // Filtra per una soglia minima di pertinenza
        .sort((a, b) => b.score - a.score) // Ordina per punteggio decrescente
        .slice(0, TOP_P)
        .map(item => item.id);

      const finalContextChunks = topChunkIndices.map(index => candidateChunks[index]).filter(Boolean);
      
      console.log(`[RAG] Fase 3: Selezionati i ${finalContextChunks.length} chunk migliori dopo il re-ranking.`);

      return finalContextChunks.map(chunk => chunk.content || '').filter(Boolean).join(CONTEXT_SEPARATOR);

    } catch (error) {
      console.error('❌ [RAG] Errore grave e imprevisto in retrieveRelevantContext:', error);
      return '';
    }
  }
}

// ==========================================================
// ==                  ESPORTAZIONE DEL MODULO             ==
// ==========================================================
module.exports = { RAGService };