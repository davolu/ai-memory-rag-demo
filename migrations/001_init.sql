-- AI Memory & Knowledge Retrieval — schema
-- Requires the pgvector extension (available on Vercel Postgres / Neon).

CREATE EXTENSION IF NOT EXISTS vector;

-- Users (NextAuth Credentials provider authenticates against this table)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Uploaded documents, scoped to a user
CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'processing', -- processing | ready | error
  error       TEXT,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id);

-- Text chunks + their embeddings (text-embedding-3-small => 1536 dims)
CREATE TABLE IF NOT EXISTS chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(1536),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chunks_user_id_idx ON chunks(user_id);
CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks(document_id);

-- Approximate-nearest-neighbour index for cosine similarity search.
-- (Safe to create on an empty table; ivfflat builds lists lazily.)
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Persisted chat history, scoped to a user
CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL, -- user | assistant
  content    TEXT NOT NULL,
  sources    JSONB, -- array of { documentId, filename, snippet, score }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx ON chat_messages(user_id, created_at);
