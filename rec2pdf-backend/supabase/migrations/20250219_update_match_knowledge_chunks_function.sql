SET LOCAL search_path = public, extensions;
BEGIN;

CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
    match_workspace_id uuid,
    query_embedding vector,
    match_project_id uuid DEFAULT NULL,
    match_count integer DEFAULT 4
)
RETURNS TABLE (
    id uuid,
    content text,
    metadata jsonb,
    workspace_id uuid,
    project_id uuid,
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
        kc.project_id,
        1 - (kc.embedding <=> query_embedding) AS similarity
    FROM public.knowledge_chunks AS kc
    WHERE kc.workspace_id = match_workspace_id
      AND (kc.project_id IS NULL OR kc.project_id = match_project_id)
    ORDER BY kc.embedding <=> query_embedding
    LIMIT COALESCE(match_count, 4);
$$;

COMMIT;
