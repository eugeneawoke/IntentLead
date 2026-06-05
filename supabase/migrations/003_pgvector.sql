-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to client_context_chunks
ALTER TABLE client_context_chunks ADD COLUMN embedding vector(1536);

-- IVFFlat index for cosine similarity search
CREATE INDEX idx_chunks_embedding ON client_context_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
