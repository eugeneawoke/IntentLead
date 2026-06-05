CREATE OR REPLACE FUNCTION match_chunks(
  p_workspace_id uuid,
  p_embedding vector(1536),
  p_match_count int DEFAULT 5
) RETURNS TABLE (content text, source text, similarity float)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.content,
    c.source,
    1 - (c.embedding <=> p_embedding) AS similarity
  FROM client_context_chunks c
  WHERE c.workspace_id = p_workspace_id
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> p_embedding
  LIMIT p_match_count;
END;
$$;
