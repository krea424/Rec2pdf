-- Migrazione: Routing Webhook per ambienti Dev/Prod
-- Autore: Lead Dev Team
-- Data: 2025-11-21

-- 1. Aggiunta colonna environment
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'production';

COMMENT ON COLUMN public.jobs.environment IS 'Indica se il job proviene da dev (ngrok) o production (cloud run)';

-- 2. Abilitazione estensione
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. Definizione Funzioni Trigger (Placeholder per infrastruttura)
-- NOTA: I secret reali vanno aggiornati manualmente o via Vault, qui mettiamo placeholder sicuri
CREATE OR REPLACE FUNCTION public.trigger_job_worker_prod()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
      url := 'https://rec2pdf-backend-v2-281124194901.europe-west3.run.app/api/worker/trigger',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret', current_setting('app.worker_secret', true)),
      body := jsonb_build_object('record', row_to_json(NEW), 'type', 'INSERT', 'table', 'jobs', 'schema', 'public')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- (La funzione dev viene gestita dinamicamente dallo script di utility update_ngrok_url)

-- 4. Creazione Trigger Condizionali
DROP TRIGGER IF EXISTS "job_worker_trigger_prod" ON public.jobs;
CREATE TRIGGER "job_worker_trigger_prod"
AFTER INSERT ON public.jobs
FOR EACH ROW
WHEN (NEW.environment = 'production')
EXECUTE FUNCTION public.trigger_job_worker_prod();

DROP TRIGGER IF EXISTS "job_worker_trigger_dev" ON public.jobs;
CREATE TRIGGER "job_worker_trigger_dev"
AFTER INSERT ON public.jobs
FOR EACH ROW
WHEN (NEW.environment = 'development')
EXECUTE FUNCTION public.trigger_job_worker_dev();