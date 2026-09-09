# Task 12 Completion Report: PostgreSQL Full-Text Search (FTS) & Search Utilities

## Executive Summary
Successfully implemented and verified PostgreSQL-native Full-Text Search (FTS) and search utilities for QCET E-Office (`src/lib/db/search.ts`), along with production GIN / pg_trgm indexes (`prisma/migrations/indexes.sql`) and a comprehensive test suite (`tests/postgres-search.test.ts`).

The implementation strictly enforces system invariants:
- **Server Truth Wins**: Search ranking, filtering, and pagination are executed entirely in PostgreSQL; zero in-memory table dumping or client-side `.filter()` loops.
- **SQL Injection Immunity**: All dynamic inputs and enum values are parameterized safely via `Prisma.sql` and `Prisma.join`.
- **Hybrid Heuristic Routing**: Automatically routes exact codes (e.g. `TASK-2026`, `NV-001`, `19/UBND-NC`, `#128`, user emails) to B-tree index lookups, and natural language text (Vietnamese phrases, titles, summaries) to GIN FTS (`to_tsvector`, `ts_rank`) and Trigram (`pg_trgm`) similarity search.
- **Progressive Resilience**: Gracefully falls back to parameterized ILIKE queries if FTS extensions or simulated environments encounter runtime restrictions.

---

## Deliverables

### 1. PostgreSQL Search Utilities (`src/lib/db/search.ts`)
- **Heuristic Code Detection (`isExactCodeQuery`, `cleanExactCode`)**:
  - Detects institutional code formats (`TASK-`, `QCET-`, `NV-`, `VB-`, `CV-`, `TB-`, `QD-`, `HD-`, `BC-`, `KH-`, `DA-`, `TT-`).
  - Handles `#`-prefixed identifiers (`#TASK-99`, `#128`).
  - Identifies single alphanumeric tokens without spaces (including emails, registration numbers, phone numbers).
  - Routes multi-token Vietnamese text to full-text search.
- **Search Tasks (`searchTasks`, `buildTaskSearchQuery`, `buildTaskFallbackSearchQuery`)**:
  - Exact code lookup against `code`, `code ILIKE`, or `id` using B-tree indexes.
  - FTS text search across `title` and `description` using `to_tsvector('simple', ...)` and `plainto_tsquery('simple', ...)`.
  - Trigram fuzzy similarity scoring on `title` via `similarity("title", query)`.
  - Composite ranking: `ts_rank + similarity`.
  - Filter criteria: `status`, `departmentId`, `scope`, `archived_at IS NULL`.
  - Clamped pagination: `LIMIT`, `OFFSET`.
- **Search Documents (`searchDocuments`, `buildDocumentSearchQuery`, `buildDocumentFallbackSearchQuery`)**:
  - Exact lookup against `original_number`, `registration_number` (numeric), or `id`.
  - FTS text search across document `summary` (trích yếu nội dung) and `issuing_authority`.
  - Filter criteria: `type`, `status`, `archived_at IS NULL`.
- **Search Users (`searchUsers`, `buildUserSearchQuery`, `buildUserFallbackSearchQuery`)**:
  - Exact lookup against `email`, `phone`, or `id`.
  - FTS text search across `name`, `email`, and `title`.
  - Filter criteria: `role`, `departmentId`, `is_active = true`, `deactivated_at IS NULL`.
- **Progressive Fallback**:
  - Wraps primary queries in try/catch; if PostgreSQL extensions (`pg_trgm`, custom dictionaries) are unavailable, automatically issues parameterized ILIKE queries.

### 2. GIN / FTS Index Migrations (`prisma/migrations/indexes.sql`)
Added Section 5 to `prisma/migrations/indexes.sql`:
```sql
-- Safe extension initialization for trigram fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Task full-text search index on title and description
CREATE INDEX IF NOT EXISTS task_title_description_fts_idx
ON "tasks" USING gin (to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", '')));

-- Task trigram index on title for typo tolerance and ILIKE acceleration
CREATE INDEX IF NOT EXISTS task_title_trgm_idx
ON "tasks" USING gin ("title" gin_trgm_ops);

-- Document search index on summary (trích yếu)
CREATE INDEX IF NOT EXISTS document_title_fts_idx
ON "documents" USING gin (to_tsvector('simple', coalesce("summary", '')));

-- Document trigram index on summary
CREATE INDEX IF NOT EXISTS document_summary_trgm_idx
ON "documents" USING gin ("summary" gin_trgm_ops);

-- User full-text search index on name and email
CREATE INDEX IF NOT EXISTS user_name_email_fts_idx
ON "users" USING gin (to_tsvector('simple', coalesce("name", '') || ' ' || coalesce("email", '')));

-- User trigram index on name
CREATE INDEX IF NOT EXISTS user_name_trgm_idx
ON "users" USING gin ("name" gin_trgm_ops);
```

### 3. Comprehensive Test Suite (`tests/postgres-search.test.ts`)
Implemented 25 rigorous test assertions across 5 suites:
1. **Query Heuristics & Code Detection**:
   - Institutional prefixes, `#`-prefixed numbers, emails, phone numbers vs multi-word Vietnamese phrases.
2. **SQL Query Builder & Fragment Generation**:
   - Exact code query generates targeted lookups (`"code" = ?`, `"code" ILIKE ?`).
   - Keyword query generates `to_tsvector`, `plainto_tsquery`, `ts_rank`, `similarity`.
   - Fallback query generates safe parameterized ILIKE queries.
3. **SQL Injection Immunity & Parameter Safety**:
   - Tested injection vectors (`' OR '1'='1`, `'; DROP TABLE tasks; --`, `' UNION SELECT ...`).
   - Confirmed 100% parameter isolation inside `.values`; zero raw SQL concatenation.
   - Verified typed enum casting (`TaskStatus`, `TaskScope`, `DocumentType`, `DocumentStatus`, `UserRole`).
   - Verified pagination boundary clamping.
4. **Native PostgreSQL Engine Execution**:
   - Live DB: `searchTasks` exact code lookup.
   - Live DB: `searchTasks` FTS keyword search + rank sorting.
   - Live DB: `searchDocuments` exact original number lookup.
   - Live DB: `searchDocuments` FTS summary search.
   - Live DB: `searchUsers` exact email lookup.
   - Live DB: `searchUsers` name keyword search.
   - Simulated fallback execution when primary FTS query throws.
5. **PostgreSQL Catalog Verification**:
   - Queries `pg_indexes` to verify that all 6 GIN indexes (`task_title_description_fts_idx`, `task_title_trgm_idx`, `document_title_fts_idx`, `document_summary_trgm_idx`, `user_name_email_fts_idx`, `user_name_trgm_idx`) exist and specify `USING gin`.

---

## Verification Results

1. **Targeted Test Execution**:
   ```bash
   npx tsx --test tests/postgres-search.test.ts
   ```
   **Output**: 25/25 tests passing (0 failures).

2. **Database Hardening Combined Execution**:
   ```bash
   npx tsx --test tests/composite-indexes.test.ts tests/postgres-search.test.ts
   ```
   **Output**: 41/41 tests passing (0 failures).

3. **Full Project Test Suite**:
   ```bash
   npm test
   ```
   **Output**: 365/365 tests passing across 122 test suites (0 failures).

---

## Invariant Compliance
- **Server Truth Wins**: PostgreSQL database handles all searching, ranking, and pagination.
- **One Capability, One Canonical Implementation**: Single canonical search utility in `src/lib/db/search.ts` replaces fragmented and ad-hoc searches.
- **Never Invent Operational Data**: Live database seed records are queried and verified against real schema tables.
- **Preserve Unrelated Changes**: Edits confined strictly to Task 12 scope (`src/lib/db/search.ts`, `prisma/migrations/indexes.sql`, `tests/postgres-search.test.ts`, progress and report files).
