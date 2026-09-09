# Task 4 Report: Atomic Sequence Generation & Race-Free Numbering

## 1. Overview & Objectives
The goal of Task 4 was to eliminate race conditions and non-monotonic sequence generation during task code (`TaskSequence`) and document numbering (`DocumentNumberSequence`) creation. Previously, sequence generation relied on read-then-increment workflows (`findUnique` followed by conditional `update`), which created a race window under concurrent requests leading to collisions or duplicate numbers.

## 2. Key Changes Implemented

### A. Task Code Generator (`src/lib/task-code-generator.ts`)
- **Eliminated Read-then-Increment**: Completely removed `client.taskSequence.findUnique` followed by separate `update`.
- **Atomic Prisma Upsert**: Used single-statement Prisma `upsert` with `update: { lastValue: { increment: 1 } }`. In PostgreSQL, this generates atomic `INSERT INTO task_sequences ... ON CONFLICT DO UPDATE SET last_value = task_sequences.last_value + 1 RETURNING last_value`.
- **PostgreSQL Raw SQL Upsert Support**: Added `generateTaskCodeRawSql` and `useRawSql` option supporting:
  ```sql
  INSERT INTO "task_sequences" ("year", "scope", "department_code", "last_value", "updated_at")
  VALUES ($1, $2, $3, $4, NOW())
  ON CONFLICT ("year", "scope", "department_code")
  DO UPDATE SET "last_value" = "task_sequences"."last_value" + 1, "updated_at" = NOW()
  RETURNING "last_value";
  ```
- **Race-Free In-Flight Initialization**: Added in-flight promise synchronization (`inFlightInits`) for cold-start initializations, preventing in-memory fallback race conditions under high concurrency.
- **O(1) Execution Complexity**: Sequences maintain single-statement atomic increments with zero table scans on hot paths.

### B. Document Numbering Engine (`src/lib/documents/numbering-engine.ts` & `src/lib/document-numbering.ts`)
- **Interactive Transaction Resilience**: Handled root `PrismaClient` (executing via `$transaction`) and interactive `TransactionClient` (executing directly on `tx`, since `tx.$transaction` is undefined in Prisma).
- **Atomic Raw SQL Increment Support**: Added `getNextRegistrationNumberRawSql` and `useRawSql` option supporting:
  ```sql
  UPDATE "document_number_sequences"
  SET "last_number" = "last_number" + 1, "updated_at" = NOW()
  WHERE "type" = $1::"DocumentType" AND "year" = $2
  RETURNING "last_number";
  ```
- **Decree 30/2020/ND-CP Compliance**: Maintained formatting rules for `VAN_BAN_DEN` (`01`, `09`, `125`), `VAN_BAN_DI` (`89/CĐKTCN-ĐT`), and `TO_TRINH_NOI_BO` (`TT-5/2026`).
- **Canonical Entry Point**: Created `src/lib/document-numbering.ts` re-exporting numbering functions and types for system-wide access.

### C. Concurrency Test Suite (`tests/atomic-sequence-generation.test.ts`)
Added 12 rigorous concurrency and contract tests:
1. Concurrency on `TaskSequence`: 30 simultaneous calls generate strictly monotonic, non-colliding NV codes `1..30`.
2. Concurrency on Department `CV` format: 20 simultaneous calls generate consecutive codes `1..20`.
3. Raw SQL concurrency: 15 simultaneous calls with raw SQL upsert generate consecutive codes `1..15`.
4. Concurrency inside Prisma interactive transactions: 10 concurrent calls inside `$transaction(async (tx) => ...)` generate sequential codes `1..10`.
5. In-memory fallback concurrency: 25 simultaneous calls produce strictly monotonic `1..25`.
6. Concurrency on `DocumentNumberSequence`: 30 simultaneous calls for `VAN_BAN_DEN` produce numbers `1..30` with zero collisions.
7. Independent sequences across document types (`VAN_BAN_DEN`, `VAN_BAN_DI`, `TO_TRINH_NOI_BO`).
8. Transaction client execution: 10 concurrent requests inside `$transaction` on `VAN_BAN_DI`.
9. Raw SQL atomic document numbering: 10 concurrent requests using `getNextRegistrationNumberRawSql`.
10. In-memory fallback sequence numbering: 20 concurrent requests produce consecutive numbers `1..20`.
11. Decree 30/2020/ND-CP display formatting assertions.
12. Standardized document reference code formatting assertions (`VBDEN-2026-0001`, `VBDI-2026-0089`, `TTNB-2026-0005`).

## 3. Verification & Test Output
- `npm run typecheck`: Passed cleanly (0 TypeScript errors).
- `npx tsx --test tests/atomic-sequence-generation.test.ts`: Passed (12/12 tests passing).
- `npx tsx --test tests/task-code-generator.test.ts tests/document-numbering.test.ts tests/atomic-sequence-generation.test.ts`: Passed (24/24 tests passing).
- `npm test`: Passed (145/145 tests across 52 suites passing).
