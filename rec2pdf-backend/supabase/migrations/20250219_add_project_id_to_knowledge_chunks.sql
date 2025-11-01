BEGIN;

ALTER TABLE public.knowledge_chunks
    ADD COLUMN IF NOT EXISTS project_id uuid;

CREATE INDEX IF NOT EXISTS knowledge_chunks_project_id_idx
    ON public.knowledge_chunks (project_id);

COMMIT;
