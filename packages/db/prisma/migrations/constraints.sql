-- ====================================================================
-- QCET E-Office: Database Hardening Constraints & Partial Indexes
-- Task 3: Invariants & Single Primary Owner Constraint
-- ====================================================================

-- 1. Enforce at most one primary DRI per task.
-- Phase 9: `TaskAssignee` / bảng `task_assignees` đã bị drop (migration
-- 20260923000001), nên không còn `role_in_task` hay `PRIMARY_OWNER`. Bất biến
-- tương đương được thực thi trên `task_actors` bằng partial unique index trong
-- migration 20260923000005_task_actor_single_primary_dri.
CREATE UNIQUE INDEX IF NOT EXISTS task_actors_one_primary_dri_idx
ON "task_actors" ("task_id")
WHERE "role" = 'DRI' AND "is_primary_dri" = TRUE;

-- 2. Push subscription uniqueness and tracking constraints
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
