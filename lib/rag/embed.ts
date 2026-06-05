import { openai } from "@/lib/ai/openai";
import { getServiceClient } from "@/lib/supabase/client";
import { logger } from "@/lib/utils/logger";

export async function upsertChunks(
  workspaceId: string,
  chunks: Array<{ content: string; source: "chat" | "glook_report" | "manual" }>
): Promise<void> {
  if (!chunks.length) return;

  const texts = chunks.map((c) => c.content);
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });

  if (embeddingResponse.data.length !== texts.length) {
    logger.error({ workspaceId, expected: texts.length, got: embeddingResponse.data.length }, "Embedding count mismatch");
    return;
  }

  const supabase = getServiceClient();
  const rows = chunks.map((chunk, i) => ({
    workspace_id: workspaceId,
    source: chunk.source,
    content: chunk.content,
    embedding: embeddingResponse.data[i].embedding,
  }));

  const { error } = await supabase.from("client_context_chunks").insert(rows);
  if (error) {
    logger.error({ workspaceId, error: error.message }, "Failed to upsert RAG chunks");
  }
}

export async function queryChunks(
  workspaceId: string,
  query: string,
  k = 5
): Promise<Array<{ content: string; source: string }>> {
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: [query],
  });

  if (!embeddingResponse.data[0]?.embedding) {
    logger.error({ workspaceId }, "Empty embedding response for query");
    return [];
  }
  const embedding = embeddingResponse.data[0].embedding;

  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("match_chunks", {
    p_workspace_id: workspaceId,
    p_embedding: embedding,
    p_match_count: k,
  });

  if (error) {
    logger.error({ workspaceId, error: error.message }, "RAG query failed");
    return [];
  }

  return (data ?? []) as Array<{ content: string; source: string }>;
}
