-- Content-hash based de-duplication of documents, scoped per user.
-- The hash is sha256 of the extracted text.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- One document per (user, content) — partial so legacy rows with NULL hash are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS documents_user_hash_uidx
  ON documents(user_id, content_hash)
  WHERE content_hash IS NOT NULL;
