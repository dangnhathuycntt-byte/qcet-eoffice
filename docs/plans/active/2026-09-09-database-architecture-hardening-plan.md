---
status: active
domain: data
created: 2026-09-09
---

# QCET E-Office: Database Architecture Hardening Plan

> **Executive Summary**: Comprehensive database architecture hardening for QCET E-Office on PostgreSQL + Prisma. Upgrades the database from a basic ORM storage target into an authoritative system of record ensuring referential integrity, optimistic concurrency control (OCC), transactional audit trails, transactional outbox, idempotency, measured indexes, and operational reliability.

---

## Global Constraints & Architectural Invariants

1. **One Capability, One Implementation**: All database access, transactions, and OCC helpers must be canonical and centralized in `src/lib/db/` or existing canonical services. Never build duplicate DB clients or parallel engines.
2. **Server Truth Wins**: The PostgreSQL database is the ultimate authority. Client states and optimistic UI must always yield to server-validated constraints and versions.
3. **No Casual Deletion**: Business records (`Task`, `Document`, `ExecutiveResolution`, `AuditEvent`) must never be hard-deleted in standard workflows. Archive (`archivedAt`, `archivedById`) represents business state; delete is strictly for data lifecycle.
4. **Never Invent Operational Data**: Use real schema entities, real enum states, and real relations. Never inject synthetic metrics or mock data.
5. **Preserve Unrelated Code**: Limit changes strictly to schema, DB utilities, transactions, migrations, and their tests. Do not touch unrelated UI or frontend features.
6. **Timezone & Academic Integrity**: All timestamps and date comparisons must adhere to Indochina Time (ICT, UTC+7).

---

## Tasks

### Task 1: Schema Relation Referential Actions Audit

- **Description**: Audit all foreign key relationships in `prisma/schema.prisma` and define explicit referential actions (`onDelete`). Business entities (`Task`, `Document`, `ExecutiveResolution`) must NOT cascade-delete when a `User` or `Department` is deleted or modified. Restrict or set null where appropriate; keep cascade only for genuine child/dependent items (`TaskAssignee` on `Task`, `DocumentAttachment` on `Document`, `Session`/`Account` on `User`).
- **Files to Modify**: `prisma/schema.prisma`
- **Verification**: `npx prisma validate`, `npm run typecheck`

### Task 2: Data Lifecycle & Archive Policy Schema

- **Description**: Introduce explicit archival fields to avoid hard deletion of business records. Add `archivedAt DateTime?`, `archivedById String?`, `archiveReason String?` to `Task` and `Document`. Add `deactivatedAt DateTime?` to `User`. Update model mappings and relations accordingly.
- **Files to Modify**: `prisma/schema.prisma`
- **Verification**: `npx prisma validate`, `npm run typecheck`

### Task 3: Invariants & Single Primary Owner Constraint

- **Description**: Enforce single primary owner per task and harden `PushSubscription` uniqueness and cleanup. Ensure `TaskAssignee` enforces uniqueness on `(taskId, userId, roleInTask)`. Add fields `lastSeenAt DateTime?`, `disabledAt DateTime?` to `PushSubscription` to track stale push endpoints. Prepare partial unique index definition for single `PRIMARY_OWNER` per task in SQL migration scripts.
- **Files to Modify**: `prisma/schema.prisma`, `prisma/migrations/constraints.sql`
- **Verification**: `npx prisma validate`, `npm run typecheck`

### Task 4: Atomic Sequence Generation & Race-Free Numbering

- **Description**: Prevent race conditions during task code (`TaskSequence`) and document numbering (`DocumentNumberSequence`) generation. Ensure sequences are generated atomically using Prisma raw SQL or atomic increments (`UPDATE ... SET lastValue = lastValue + 1 RETURNING lastValue`) inside transactions, replacing any read-then-increment logic.
- **Files to Modify**: `src/lib/task-code-generator.ts`, `src/lib/document-numbering.ts` (or sequence service)
- **Verification**: Unit tests demonstrating concurrent requests produce monotonic, non-colliding numbers.

### Task 5: Database Check Constraints

- **Description**: Define PostgreSQL `CHECK` constraints for foundational invariants: `progressPercent BETWEEN 0 AND 100`, `dueDate >= startDate`, `failureCount >= 0` for push subscriptions, and `attempts >= 0` for outbox. Provide a custom migration SQL script `prisma/migrations/check_constraints.sql` for PostgreSQL enforcement.
- **Files to Modify**: `prisma/migrations/check_constraints.sql`
- **Verification**: Validate SQL syntax against PostgreSQL dialect.

### Task 6: Optimistic Concurrency Control (OCC)

- **Description**: Add `version Int @default(1)` to `Task`, `Document`, `DacumDelegation`, and `DocumentDirective` in `prisma/schema.prisma`. Implement a canonical OCC update utility (`src/lib/db/occ.ts`) that executes atomic updates matching `WHERE id = ? AND version = ?` with `SET version = version + 1`, throwing a typed `ConcurrencyConflictError` (HTTP 409 Conflict) on version mismatch.
- **Files to Create/Modify**: `prisma/schema.prisma`, `src/lib/db/occ.ts`
- **Verification**: `npx prisma validate`, `npm run typecheck`, unit tests verifying OCC conflict rejection on stale versions.

### Task 7: Atomic Transaction Boundaries for Core Workflows

- **Description**: Implement transaction boundary utilities (`src/lib/db/transactions.ts`) for multi-table workflows: Task creation + assignees + initial audit; Deliverable submission + task status + audit; Task approval/resolution + task status + audit. Ensure all business state changes commit together atomically in a Prisma interactive transaction.
- **Files to Create/Modify**: `src/lib/db/transactions.ts`
- **Verification**: `npm run typecheck`, unit tests checking atomicity and rollback on failure.

### Task 8: Idempotency Record Table & Helper

- **Description**: Add the `IdempotencyRecord` model to `prisma/schema.prisma` (`id`, `userId`, `operation`, `key`, `status`, `response Json?`, `expiresAt`, `createdAt`, `@@unique([userId, operation, key])`). Implement an idempotency helper (`src/lib/db/idempotency.ts`) for mobile/PWA retries on task creation, deliverable submission, and approvals.
- **Files to Create/Modify**: `prisma/schema.prisma`, `src/lib/db/idempotency.ts`
- **Verification**: `npx prisma validate`, `npm run typecheck`, unit tests verifying duplicate requests return cached responses without re-executing.

### Task 9: Immutable AuditEvent Model & Service

- **Description**: Add the `AuditEvent` model in `prisma/schema.prisma` (`id`, `actorId`, `action`, `entityType`, `entityId`, `requestId`, `beforeData Json?`, `afterData Json?`, `metadata Json?`, `createdAt DateTime @default(now())`, with indexes on `(entityType, entityId, createdAt DESC)`, `(actorId, createdAt DESC)`, `(requestId)`). Implement the canonical audit logger (`src/lib/db/audit.ts`) to record business events (`TASK_CREATED`, `TASK_STATUS_CHANGED`, `DELIVERABLE_SUBMITTED`, etc.).
- **Files to Create/Modify**: `prisma/schema.prisma`, `src/lib/db/audit.ts`
- **Verification**: `npx prisma validate`, `npm run typecheck`, unit tests verifying immutable audit entry creation.

### Task 10: Transactional Outbox Pattern & Model

- **Description**: Add the `OutboxEvent` model in `prisma/schema.prisma` (`id`, `eventType`, `aggregateType`, `aggregateId`, `payload Json`, `status`, `attempts Int @default(0)`, `availableAt DateTime`, `processedAt DateTime?`, `createdAt DateTime @default(now())`, with index on `(status, availableAt)`). Implement outbox publisher and dispatcher utilities (`src/lib/db/outbox.ts`) to decouple push notifications and external integrations from the primary database transaction.
- **Files to Create/Modify**: `prisma/schema.prisma`, `src/lib/db/outbox.ts`
- **Verification**: `npx prisma validate`, `npm run typecheck`, unit tests verifying outbox enqueue and mock dispatch.

### Task 11: Composite & Partial Indexes Audit

- **Description**: Optimize PostgreSQL query performance based on real application queries. Add composite indexes in `prisma/schema.prisma` for `Task` (`(scope, status, dueDate)`, `(departmentId, status, dueDate)`, `(parentTaskId)`, `(updatedAt DESC)`), `Notification` (`(userId, createdAt DESC)`), and `Document` (`(type, status, dueDate)`). Prepare partial index SQL in `prisma/migrations/indexes.sql` for unread notifications (`WHERE readAt IS NULL`).
- **Files to Modify**: `prisma/schema.prisma`, `prisma/migrations/indexes.sql`
- **Verification**: `npx prisma validate`, `npm run typecheck`.

### Task 12: PostgreSQL Full-Text Search (FTS) & Search Utilities

- **Description**: Implement PostgreSQL search utility (`src/lib/db/search.ts`) leveraging B-tree indexes for exact code/number lookups (`code`, `registrationNumber`), and PostgreSQL `to_tsvector` / `pg_trgm` similarity queries for title/summary searches without pulling the whole dataset into Node.js memory.
- **Files to Create/Modify**: `src/lib/db/search.ts`
- **Verification**: `npm run typecheck`, unit tests validating search SQL generation and filter logic.

### Task 13: Operational Reliability & Database Runbook

- **Description**: Create comprehensive database architecture and operations guide at `docs/architecture/DATABASE_OPERATIONS.md`. Cover backup strategies (daily logical + base backup + WAL archiving / PITR), RPO (15 min) & RTO (2 hours) definitions, autovacuum monitoring queries, connection pooling sizing recommendations, and CI/CD `prisma migrate deploy` guidelines (expand-and-contract discipline).
- **Files to Create**: `docs/architecture/DATABASE_OPERATIONS.md`
- **Verification**: Document review for completeness, accuracy, and operational feasibility.

### Task 14: Comprehensive Database Hardening Test Suite

- **Description**: Author end-to-end unit and integration test suite in `tests/database-architecture-hardening.test.ts` covering:
  1. Optimistic Concurrency Control (OCC conflict detection and resolution)
  2. Atomic sequence generation under simulated concurrent calls
  3. Idempotency handling and replay prevention
  4. Immutable audit event recording within transaction boundaries
  5. Transactional outbox event enqueue and state transitions
  6. Archive flags and referential integrity assertions
- **Files to Create**: `tests/database-architecture-hardening.test.ts`
- **Verification**: Run `npm test tests/database-architecture-hardening.test.ts` and ensure 100% passing tests.
