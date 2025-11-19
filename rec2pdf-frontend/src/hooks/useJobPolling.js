import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook per il polling resiliente (Mobile-First).
 * Gestisce sospensioni del browser, errori di rete temporanei e ripresa immediata alla visibilità.
 */
export const useJobPolling = (jobId, onUpdate, onComplete, onFailure, fetcher) => {
  const pollingIntervalRef = useRef(null);
  
  // Ref per tracciare se il componente è montato (evita memory leaks)
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // La funzione che esegue il controllo effettivo
  const poll = useCallback(async () => {
    if (!jobId || !fetcher) return;

    try {
      // Eseguiamo la chiamata. Se la rete è giù (telefono in standby), fetcher potrebbe fallire o tornare !ok
      const result = await fetcher();
      
      // Se l'utente ha cambiato pagina mentre aspettavamo, fermiamoci
      if (!isMountedRef.current) return;

      // GESTIONE RESILIENZA:
      // Se la richiesta fallisce (es. timeout, rete persa), NON fermiamo il polling.
      // Logghiamo solo un warning e lasciamo che il prossimo intervallo ci riprovi.
      if (!result || !result.ok) {
        console.warn(`[ResilientPolling] Errore temporaneo (rete/server) per job ${jobId}. Riprovo al prossimo ciclo.`);
        return; 
      }
      
      const currentJob = result.data?.job;
      if (!currentJob) return;

      // Notifica aggiornamento stato (es. per aggiornare i log in tempo reale)
      if (typeof onUpdate === 'function') {
        onUpdate(currentJob);
      }
      
      // Logica di completamento
      if (currentJob.status === 'completed') {
        stopPolling();
        if (typeof onComplete === 'function') onComplete(currentJob);
      } else if (currentJob.status === 'failed') {
        stopPolling();
        if (typeof onFailure === 'function') onFailure(currentJob);
      }
      // Se è 'pending' o 'processing', non facciamo nulla: il prossimo intervallo controllerà di nuovo.

    } catch (err) {
      // GESTIONE RESILIENZA ESTREMA:
      // Anche se fetch lancia un'eccezione critica (es. "NetworkError when attempting to fetch resource"),
      // noi la catturiamo e NON chiamiamo onFailure.
      // Il telefono potrebbe essere solo in ascensore o in tasca.
      console.warn(`[ResilientPolling] Eccezione critica catturata: ${err.message}. Il polling continuerà.`);
    }
  }, [jobId, fetcher, onUpdate, onComplete, onFailure, stopPolling]);

  // EFFETTO 1: Gestione del Ciclo di Vita del Polling (Timer)
  useEffect(() => {
    if (!jobId) {
      stopPolling();
      return;
    }

    console.log(`[ResilientPolling] Avvio monitoraggio per job: ${jobId}`);
    
    // 1. Controllo immediato
    poll();
    
    // 2. Impostazione intervallo (5 secondi è un buon compromesso per mobile)
    pollingIntervalRef.current = setInterval(poll, 5000);

    return () => stopPolling();
  }, [jobId, poll, stopPolling]);

  // EFFETTO 2: Gestione "Wake Up" (Visibility API)
  // Questo è il trucco magico per il mobile.
  useEffect(() => {
    if (!jobId) return;

    const handleVisibilityChange = () => {
      // Se la pagina torna visibile (utente sblocca il telefono o torna sul tab)
      if (document.visibilityState === 'visible') {
        console.log('[ResilientPolling] 📱 App ritornata visibile (Wake Up). Forzo controllo immediato.');
        // Non aspettiamo i 5 secondi del timer, controlliamo SUBITO.
        poll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [jobId, poll]);
};