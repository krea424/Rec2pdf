import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook per il polling resiliente e adattivo (Smart Backoff).
 * - Inizia veloce per feedback immediato.
 * - Rallenta nel tempo per risparmiare risorse DB.
 * - Gestisce "Wake Up" da mobile e tab switching.
 */
export const useJobPolling = (jobId, onUpdate, onComplete, onFailure, fetcher) => {
  const timeoutRef = useRef(null);
  const attemptsRef = useRef(0); // Contatore dei tentativi per calcolare il backoff
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Calcolo intelligente dell'intervallo
  const getNextInterval = (attemptCount) => {
    if (attemptCount < 5) return 2000;   // Primi 10s: ogni 2s (Sprint)
    if (attemptCount < 20) return 5000;  // Fino a ~1.5m: ogni 5s (Crociera)
    return 10000;                        // Oltre: ogni 10s (Risparmio)
  };

  const poll = useCallback(async () => {
    if (!jobId || !fetcher) return;

    try {
      const result = await fetcher();
      
      if (!isMountedRef.current) return;

      // GESTIONE ERRORI RETE (Resilienza)
      if (!result || !result.ok) {
        console.warn(`[SmartPolling] Errore temporaneo job ${jobId}. Riprovo...`);
        // In caso di errore, non incrementiamo il backoff aggressivamente, riproviamo tra 5s
        timeoutRef.current = setTimeout(poll, 5000);
        return; 
      }
      
      const currentJob = result.data?.job;
      if (!currentJob) return; // Should not happen

      // 1. Notifica UI
      if (typeof onUpdate === 'function') {
        onUpdate(currentJob);
      }
      
      // 2. Check Stato Finale
      if (currentJob.status === 'completed') {
        stopPolling();
        if (typeof onComplete === 'function') onComplete(currentJob);
        return; // Stop recursion
      } else if (currentJob.status === 'failed') {
        stopPolling();
        if (typeof onFailure === 'function') onFailure(currentJob);
        return; // Stop recursion
      }

      // 3. Schedula Prossimo Tentativo (Adaptive)
      attemptsRef.current += 1;
      const nextDelay = getNextInterval(attemptsRef.current);
      // console.debug(`[SmartPolling] Ciclo #${attemptsRef.current} completato. Prossimo check tra ${nextDelay}ms`);
      
      timeoutRef.current = setTimeout(poll, nextDelay);

    } catch (err) {
      console.warn(`[SmartPolling] Eccezione critica: ${err.message}. Continuo.`);
      // Retry di sicurezza
      timeoutRef.current = setTimeout(poll, 10000);
    }
  }, [jobId, fetcher, onUpdate, onComplete, onFailure, stopPolling]);

  // EFFETTO 1: Avvio e Cleanup
  useEffect(() => {
    if (!jobId) {
      stopPolling();
      return;
    }

    console.log(`[SmartPolling] 🚀 Avvio monitoraggio adattivo per: ${jobId}`);
    attemptsRef.current = 0; // Reset contatore
    poll(); // Primo check immediato

    return () => stopPolling();
  }, [jobId, poll, stopPolling]);

  // EFFETTO 2: Wake Up (Visibility API)
  useEffect(() => {
    if (!jobId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[SmartPolling] 📱 App visibile. Force check.');
        // Cancelliamo il timeout pendente (che magari è tra 10s) e controlliamo SUBITO
        stopPolling();
        poll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [jobId, poll, stopPolling]);
};