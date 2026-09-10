# Task 3 Completion Report: Invariants & Single Primary Owner Constraint

## Summary
Hardened database-level and application invariants for `TaskAssignee` and `PushSubscription` in `prisma/schema.prisma` and prepared production-grade PostgreSQL migration scripts in `prisma/migrations/constraints.sql`. Enforced that every task maintains at most one `PRIMARY_OWNER` via partial unique indexing, and guaranteed compound uniqueness on `(taskId, userId, roleInTask)`. For Web Push notification resilience, expanded `PushSubscription` with `lastSeenAt` and `disabledAt` tracking fields while ensuring endpoint uniqueness and indexes for stale/revoked subscription cleanup.

## Implemented Changes

### 1. `TaskAssignee` Schema & Constraint
- Updated `prisma/schema.prisma`:
  - Enforced named compound uniqueness:
    ```prisma
    @@unique([taskId, userId, roleInTask], name: "task_user_role_unique")
    ```
- Updated `prisma/seed.ts`:
  - Adjusted upsert queries to use the named unique constraint key `task_user_role_unique`.

### 2. `PushSubscription` Schema
- Added lifecycle and resilience tracking fields:
  - `lastSeenAt`: `DateTime? @map("last_seen_at")` (tracks timestamp of latest successful push interaction/delivery)
  - `disabledAt`: `DateTime? @map("disabled_at")` (records timestamp when endpoint was disabled or revoked)
  - Verified `failureCount`: `Int @default(0) @map("failure_count")` (retains circuit-breaker counter mapped to db column)
  - Verified `endpoint String @unique` (ensures global uniqueness of browser push subscription endpoints)

### 3. PostgreSQL SQL Migration Script (`prisma/migrations/constraints.sql`)
Authored declarative PostgreSQL constraints and partial indexes:
- Single `PRIMARY_OWNER` partial unique index (spec syntax & mapped table syntax):
  ```sql
  -- Model-level syntax
  CREATE UNIQUE INDEX IF NOT EXISTS task_one_primary_owner
  ON "TaskAssignee" ("taskId")
  WHERE "roleInTask" = 'PRIMARY_OWNER';

  -- Physical PostgreSQL table mapping
  CREATE UNIQUE INDEX IF NOT EXISTS task_assignees_one_primary_owner
  ON "task_assignees" ("task_id")
  WHERE "role_in_task" = 'PRIMARY_OWNER';
  ```
- Compound uniqueness on `(task_id, user_id, role_in_task)`:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS task_user_role_unique
  ON "task_assignees" ("task_id", "user_id", "role_in_task");
  ```
- Push subscription uniqueness and partial indexes:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_key
  ON "push_subscriptions" ("endpoint");

  CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_key
  ON "push_subscriptions" ("user_id", "endpoint");

  CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active_user
  ON "push_subscriptions" ("user_id")
  WHERE "status" = 'ACTIVE';

  CREATE INDEX IF NOT EXISTS idx_push_subscriptions_stale_cleanup
  ON "push_subscriptions" ("status", "failure_count", "disabled_at")
  WHERE "status" = 'REVOKED' OR "disabled_at" IS NOT NULL OR "failure_count" >= 5;
  ```

## Verification & Quality Assurances
1. **Prisma Schema Validation**:
   - `npx prisma validate`: Succeeded (`The schema at prisma/schema.prisma is valid 🚀`).
2. **Prisma Client Generation**:
   - `npx prisma generate`: Succeeded (Prisma Client v6.19.3 generated with scalar enums for `lastSeenAt`, `disabledAt`, `failureCount`, and `task_user_role_unique`).
3. **Automated Unit Tests**:
   - Created `tests/invariants-constraints.test.ts` testing schema structure, SQL syntax validity, balanced quotes/parentheses, and business invariant validation logic (single primary owner, compound uniqueness, push status transitions).
   - Test execution: 13/13 passing tests.
   - Run regression push tests (`tests/push-service.test.ts`, `tests/push-resilience.test.ts`): 18/18 passing tests.
   - Full repository test suite (`npm test`): 134/134 passing tests across 51 test suites.
4. **Static Type Safety**:
   - `npm run typecheck`: Passed with 0 errors.
