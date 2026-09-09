# Task 7 Report: Atomic Transaction Boundaries for Core Workflows

## Overview
Implemented canonical transaction boundary utilities in `src/lib/db/transactions.ts` to ensure strict atomicity across multi-table business workflows in QCET E-Office (PostgreSQL + Prisma ORM).

Core workflows spanning multiple database tables are now executed within atomic interactive transactions (`prisma.$transaction(async (tx) => { ... }, { isolationLevel: 'ReadCommitted', timeout: 15000 })`). Downstream failures automatically roll back all partial writes cleanly. External non-transactional systems (push notifications, emails, external webhooks) are strictly banned from executing inside transaction blocks and are deferred to `afterCommit` hooks.

---

## Deliverables & Architecture

### 1. Canonical Transaction Engine (`src/lib/db/transactions.ts`)
Provides typed transaction orchestrators with built-in rollback guarantees, OCC conflict detection, and post-commit hook execution:

1. **`runInTransaction<T>(client, fn, options)`**:
   - Canonical primitive wrapping Prisma interactive transactions.
   - Defaults to `ReadCommitted` isolation level and 15s timeout.
   - Enforces execution of `afterCommit` hooks only after transaction successfully commits.

2. **`createTaskAtomic(client, payload)`**:
   - **Multi-Table Operations**:
     1. Generates race-free sequential task code using `generateTaskCodeAtomic` (`TaskSequence` row locking).
     2. Persists `Task` and `TaskAssignee` records atomically in a single mutation.
     3. Records audit log (`AuditEvent`) within the same transaction.
     4. Dispatches post-commit hooks (`afterCommit`) outside of the database transaction.
   - **Rollback Invariant**: If code generation, assignee insertion, or audit logging fails, the task is completely rolled back without partial database residue.

3. **`submitDeliverableAtomic(client, payload)`**:
   - **Multi-Table Operations**:
     1. Creates `TaskDeliverable` record.
     2. Atomically transitions `Task` status (e.g. `WAITING_APPROVAL` or `IN_PROGRESS`) with optional Optimistic Concurrency Control (`expectedTaskVersion`).
     3. Records audit log (`AuditEvent`).
     4. Dispatches post-commit hooks.
   - **Rollback Invariant**: If task status transition or audit fails, the deliverable record is rolled back.

4. **`approveTaskAtomic(client, payload)`**:
   - **Multi-Table Operations**:
     1. Updates `Task` status to `COMPLETED` and records `completedAt` timestamp.
     2. Creates `ExecutiveResolution` (or updates `DeliverableReview`).
     3. Optionally approves pending `TaskDeliverable` records.
     4. Records audit log (`AuditEvent`).
     5. Dispatches post-commit hooks.
   - **Rollback Invariant**: If resolution creation or audit fails, the task completion is rolled back to its previous status.

5. **`createDocumentDirectiveAtomic(client, payload)`**:
   - **Multi-Table Operations**:
     1. Creates `DocumentDirective` with assigned leader, department, instructions, and collaborators.
     2. Updates parent `Document` (`leadDepartmentId`, status to `DANG_XU_LY` or target status, and increments version) with OCC support.
     3. Records audit log (`AuditEvent`).
     4. Dispatches post-commit hooks.
   - **Rollback Invariant**: If document update or audit fails, the directive is rolled back.

---

## Test Verification (`tests/atomic-transaction-boundaries.test.ts`)

Conducted 15 test cases across 5 test suites verifying both happy paths and atomic rollbacks under simulated downstream failures:

1. **Suite 1: `createTaskAtomic`**
   - Happy path: Task + assignees + sequential code + audit created atomically.
   - Rollback 1: Simulated exception after task creation -> task not persisted.
   - Rollback 2: Simulated audit failure -> task and assignees rolled back cleanly.
   - Rollback 3: Foreign key violation in assignees -> entire transaction aborted.

2. **Suite 2: `submitDeliverableAtomic`**
   - Happy path: Deliverable creation + task status transition to `WAITING_APPROVAL` + audit.
   - Rollback 1: Failure after deliverable creation -> deliverable rolled back, task status unchanged.
   - Rollback 2: OCC conflict on task version -> deliverable rolled back cleanly.

3. **Suite 3: `approveTaskAtomic`**
   - Happy path: Task completion + Executive Resolution creation + deliverable review approval.
   - Rollback 1: Failure after resolution creation -> task remains in original status, no resolution persisted.
   - Rollback 2: Audit recording failure -> task completion aborted.

4. **Suite 4: `createDocumentDirectiveAtomic`**
   - Happy path: Directive creation + document status touch (`DANG_XU_LY`) + audit.
   - Rollback 1: Simulated failure after document touch -> directive rolled back, document untouched.
   - Rollback 2: OCC conflict on document version -> directive creation aborted.

5. **Suite 5: External Systems Isolation & Invariants**
   - Verified that external side-effects (push notifications, email) are executed outside of the database transaction via `afterCommit`.
   - Verified that failures in `afterCommit` hooks do not affect already-committed transactions.

### Verification Results
- `npx tsx --test tests/atomic-transaction-boundaries.test.ts`: **15 passed, 0 failed** (duration: ~235ms)
- `npm run typecheck`: **Clean pass (0 errors)**
- `npm test`: **286 passed, 0 failed** across 101 test suites

---

## Universal Invariants Compliance
- **One Capability, One Implementation**: `src/lib/db/transactions.ts` is the single canonical coordinator for multi-table transactions.
- **Role Is Not Scope**: Scope and role semantics are respected; transaction functions accept validated domain entities.
- **Server Truth Wins**: Transactions guarantee that incomplete or failed operations never leave inconsistent state in PostgreSQL.
- **Never Claim Verification That Was Not Run**: All verification commands were executed and confirmed before reporting.
