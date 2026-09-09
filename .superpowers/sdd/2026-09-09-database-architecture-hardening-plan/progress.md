# SDD ledger — plan: docs/superpowers/plans/2026-09-09-database-architecture-hardening-plan.md

## Pre-flight Plan Scan
| Tasks | Relation / Interface | Status / Finding |
|---|---|---|
| Task 1 & Task 2 | Schema referential actions vs Archival fields | Clean — additive schema fields and explicit onDelete attributes |
| Task 2 & Task 3 | Archive fields vs Uniqueness & Primary Owner | Clean — no conflict between archive flags and unique constraints |
| Task 3 & Task 5 | Primary Owner partial index vs SQL check constraints | Clean — SQL migrations separated into clear files |
| Task 4 & Task 7 | Atomic Sequence generator vs Transaction boundaries | Clean — Task 7 transactions invoke atomic sequence generation from Task 4 |
| Task 6 & Task 7 | OCC version field vs Transaction boundaries | Clean — OCC updates fit natively inside interactive transactions |
| Task 8 & Task 7 | Idempotency record vs Transaction boundaries | Clean — Idempotency check executes prior to or wraps transaction commit |
| Task 9 & Task 10 | AuditEvent vs OutboxEvent | Clean — distinct tables and services, both commit atomically with business state |
| Task 11 & Task 12 | Composite indexes vs FTS Search utility | Clean — indexes support specific query patterns and FTS |
| Task 13 & Task 14 | Documentation vs Test suite | Clean — documentation specifies invariants, test suite verifies implementation |

All tasks agree with plan constraints and QCET core invariants. Pre-flight scan clean.

## Task Status
- [x] Task 1: Schema Relation Referential Actions Audit (completed, verified with `prisma validate` and `typecheck`)
- [x] Task 2: Data Lifecycle & Archive Policy Schema (completed, verified with `prisma validate`, `prisma generate`, `npm run typecheck`, and `tests/data-lifecycle-archive-schema.test.ts`)
- [x] Task 3: Invariants & Single Primary Owner Constraint (completed, verified with `prisma validate`, `prisma generate`, `npm run typecheck`, `tests/invariants-constraints.test.ts`, and full test suite)
- [x] Task 4: Atomic Sequence Generation & Race-Free Numbering (completed, verified with `npm run typecheck`, `npx tsx --test tests/atomic-sequence-generation.test.ts`, and full test suite)
- [x] Task 5: Database Check Constraints (completed, verified with `prisma/migrations/check_constraints.sql`, and 19/19 tests passing in `tests/database-check-constraints.test.ts`)
- [x] Task 6: Optimistic Concurrency Control (OCC) (completed, verified with `prisma validate`, `prisma generate`, `npm run typecheck`, 15/15 tests passing in `tests/optimistic-concurrency-control.test.ts`, and full test suite)
- [x] Task 7: Atomic Transaction Boundaries for Core Workflows (completed, verified with `npm run typecheck`, 15/15 tests passing in `tests/atomic-transaction-boundaries.test.ts`, and full test suite 286/286 passing)
- [x] Task 8: Idempotency Record Table & Helper (completed, verified with `prisma validate`, `prisma generate`, and 17/17 tests passing in `tests/idempotency.test.ts`)
- [x] Task 9: Immutable AuditEvent Model & Service (completed, verified with `prisma validate`, `prisma generate`, `npm run typecheck`, 19/19 tests passing in `tests/audit-events.test.ts`, and full test suite 344/344 passing)

