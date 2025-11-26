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

 // Calcolo intelligente dell'intervallo basato sull'esperienza (Job > 2 min)
 const getNextInterval = (attemptCount) => {
  // Supponendo che ogni check avvenga dopo il delay precedente.
  
  // 1. FASE DI ATTESA (Primi ~90 secondi)
  // Se facciamo check ogni 10s, i primi 9 tentativi coprono 90s.
  if (attemptCount < 9) return 15000; // 10 secondi

  // 2. FASE TARGET (Da 1:30 a ~5:00 minuti)
  // Qui ci aspettiamo che finisca. Diventiamo molto reattivi.
  if (attemptCount < 60) return 5000;  // 3 secondi

  // 3. FASE LONG RUN (Oltre 5 minuti)
  // Se non ha ancora finito, rallentiamo per non intasare il server.
  return 10000;                        // 10 secondi
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