// in rec2pdf-frontend/src/hooks/useJobPolling.js
import { useEffect, useRef } from 'react';

export const useJobPolling = (jobId, onUpdate, onComplete, onFailure, fetcher) => {
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    if (!jobId || !fetcher) {
      return;
    }

    let isMounted = true;

    const stopPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };

    const poll = async () => {
      try {
        const { ok, data } = await fetcher();
        if (!isMounted) return;

        if (!ok) {
          throw new Error(data?.message || 'Job non trovato o errore server');
        }
        
        const currentJob = data.job;
        if (!currentJob) {
          throw new Error('Risposta del server non valida: oggetto job mancante.');
        }

        if (typeof onUpdate === 'function') {
          onUpdate(currentJob);
        }
        
        if (currentJob.status === 'completed') {
          stopPolling();
          if (typeof onComplete === 'function') {
            onComplete(currentJob);
          }
        } else if (currentJob.status === 'failed') {
          stopPolling();
          if (typeof onFailure === 'function') {
            onFailure(currentJob);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error(`Errore durante il polling per job ${jobId}:`, err);
          stopPolling();
          if (typeof onFailure === 'function') {
            onFailure({ error_message: err.message || 'Errore di connessione durante il polling.' });
          }
        }
      }
    };

    // Avvia il polling
    poll(); // Esegui subito
    pollingIntervalRef.current = setInterval(poll, 7000);

    // Funzione di pulizia
    return () => {
      isMounted = false;
      stopPolling();
    };

  }, [jobId, onUpdate, onComplete, onFailure, fetcher]);
};