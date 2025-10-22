BEGIN;

ALTER TABLE public.knowledge_chunks
    ADD COLUMN IF NOT EXISTS workspace_id uuid;

CREATE INDEX IF NOT EXISTS knowledge_chunks_workspace_id_idx
    ON public.knowledge_chunks (workspace_id);

COMMIT;
