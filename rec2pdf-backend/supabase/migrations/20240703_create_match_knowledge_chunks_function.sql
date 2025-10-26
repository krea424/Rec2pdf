SET LOCAL search_path = public, extensions;
BEGIN;

CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
    match_workspace_id uuid,
    query_embedding vector
)
RETURNS TABLE (
    id uuid,
    content text,
    metadata jsonb,
    workspace_id uuid,
    similarity double precision
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        kc.id,
        kc.content,
        kc.metadata,
        kc.workspace_id,
        1 - (kc.embedding <=> query_embedding) AS similarity
    FROM public.knowledge_chunks AS kc
    WHERE kc.workspace_id = match_workspace_id
    ORDER BY kc.embedding <=> query_embedding
    LIMIT 4;
$$;

COMMIT;
