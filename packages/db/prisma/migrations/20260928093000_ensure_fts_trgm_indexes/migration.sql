-- ====================================================================
-- Ensure Full-Text Search (FTS) & Trigram (pg_trgm) Indexes
-- Restores indexes accidentally dropped in earlier migrations
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Task full-text search index on title and description
CREATE INDEX IF NOT EXISTS task_title_description_fts_idx
ON "tasks" USING gin (to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", '')));

-- Task trigram index on title for typo tolerance and ILIKE acceleration
CREATE INDEX IF NOT EXISTS task_title_trgm_idx
ON "tasks" USING gin ("title" gin_trgm_ops);

-- Document search indexes
CREATE INDEX IF NOT EXISTS document_title_fts_idx
ON "documents" USING gin (to_tsvector('simple', coalesce("summary", '')));

-- Document trigram index on summary
CREATE INDEX IF NOT EXISTS document_summary_trgm_idx
ON "documents" USING gin ("summary" gin_trgm_ops);

-- User full-text search index on name, email, and title
CREATE INDEX IF NOT EXISTS user_name_email_fts_idx
ON "users" USING gin (to_tsvector('simple', coalesce("name", '') || ' ' || coalesce("email", '') || ' ' || coalesce("title", '')));

-- User trigram index on name
CREATE INDEX IF NOT EXISTS user_name_trgm_idx
ON "users" USING gin ("name" gin_trgm_ops);
