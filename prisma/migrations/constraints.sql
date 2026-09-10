-- ====================================================================
-- QCET E-Office: Database Hardening Constraints & Partial Indexes
-- Task 3: Invariants & Single Primary Owner Constraint
-- ====================================================================

-- 1. Enforce exactly one PRIMARY_OWNER per task
-- Model-level syntax (Prisma model casing)
CREATE UNIQUE INDEX IF NOT EXISTS task_one_primary_owner
ON "TaskAssignee" ("taskId")
WHERE "roleInTask" = 'PRIMARY_OWNER';

-- Physical PostgreSQL table mapping (schema @@map("task_assignees"))
CREATE UNIQUE INDEX IF NOT EXISTS task_assignees_one_primary_owner
ON "task_assignees" ("task_id")
WHERE "role_in_task" = 'PRIMARY_OWNER';

-- 2. Compound unique constraint on task, user, and role
CREATE UNIQUE INDEX IF NOT EXISTS task_user_role_unique
ON "task_assignees" ("task_id", "user_id", "role_in_task");

-- 3. Push subscription uniqueness and tracking constraints
-- Ensure endpoint uniqueness across all subscriptions
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_key
ON "push_subscriptions" ("endpoint");

-- Ensure compound uniqueness for user and endpoint
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_key
ON "push_subscriptions" ("user_id", "endpoint");

-- Partial index for active push subscriptions (accelerates notification dispatch)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active_user
ON "push_subscriptions" ("user_id")
WHERE "status" = 'ACTIVE';

-- Partial index for stale, failing, or disabled push subscriptions cleanup
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_stale_cleanup
ON "push_subscriptions" ("status", "failure_count", "disabled_at")
WHERE "status" = 'REVOKED' OR "disabled_at" IS NOT NULL OR "failure_count" >= 5;
