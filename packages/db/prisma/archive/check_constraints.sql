-- ====================================================================
-- QCET E-Office: Database Architecture Hardening - Check Constraints
-- Task 5: Foundational Invariant Enforcement
-- Dialect: PostgreSQL (Compatible with PostgreSQL 13+)
--
-- Idempotency & Safety Strategy:
-- Uses `ALTER TABLE IF EXISTS ... DROP CONSTRAINT IF EXISTS ...` followed by
-- `ALTER TABLE IF EXISTS ... ADD CONSTRAINT ... CHECK (...)`.
--
-- Architectural Guarantees:
-- 1. Idempotency: Safely re-executable across zero, one, or multiple runs.
-- 2. Schema Drift Resilience: Updates constraint definitions cleanly if criteria change.
-- 3. Non-blocking Execution: `IF EXISTS` prevents failures when optional or
--    subsequent tables (such as outbox_events) are not yet materialized.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Task Invariants
-- Target Table: "tasks" (Prisma Model: Task, @@map("tasks"))
-- --------------------------------------------------------------------

-- Invariant 1.1: progress_percent must be bounded between 0 and 100 inclusive
ALTER TABLE IF EXISTS "tasks"
  DROP CONSTRAINT IF EXISTS chk_tasks_progress_percent;
ALTER TABLE IF EXISTS "tasks"
  ADD CONSTRAINT chk_tasks_progress_percent
  CHECK (progress_percent BETWEEN 0 AND 100);

-- Invariant 1.2: due_date must be on or after start_date (allowing NULL for draft or open-ended tasks)
ALTER TABLE IF EXISTS "tasks"
  DROP CONSTRAINT IF EXISTS chk_tasks_due_date_after_start_date;
ALTER TABLE IF EXISTS "tasks"
  ADD CONSTRAINT chk_tasks_due_date_after_start_date
  CHECK (due_date IS NULL OR start_date IS NULL OR due_date >= start_date);

-- --------------------------------------------------------------------
-- 2. Push Notification Subscription Invariants
-- Target Table: "push_subscriptions" (Prisma Model: PushSubscription, @@map("push_subscriptions"))
-- --------------------------------------------------------------------

-- Invariant 2.1: failure_count cannot be negative
ALTER TABLE IF EXISTS "push_subscriptions"
  DROP CONSTRAINT IF EXISTS chk_push_subscriptions_failure_count;
ALTER TABLE IF EXISTS "push_subscriptions"
  ADD CONSTRAINT chk_push_subscriptions_failure_count
  CHECK (failure_count >= 0);

-- --------------------------------------------------------------------
-- 3. Transactional Outbox Invariants
-- Target Table: "outbox_events" (Prisma Model: OutboxEvent, @@map("outbox_events"))
-- Prepared for Task 10 outbox dispatch queue
-- --------------------------------------------------------------------

-- Invariant 3.1: attempts count cannot be negative
ALTER TABLE IF EXISTS "outbox_events"
  DROP CONSTRAINT IF EXISTS chk_outbox_events_attempts;
ALTER TABLE IF EXISTS "outbox_events"
  ADD CONSTRAINT chk_outbox_events_attempts
  CHECK (attempts >= 0);

-- --------------------------------------------------------------------
-- 4. Unmapped Prisma Model Casing Support
-- (Ensures compatibility for environments where tables mirror Prisma model names)
-- --------------------------------------------------------------------

-- Invariant 4.1: Task progressPercent boundary
ALTER TABLE IF EXISTS "Task"
  DROP CONSTRAINT IF EXISTS chk_task_progress_percent;
ALTER TABLE IF EXISTS "Task"
  ADD CONSTRAINT chk_task_progress_percent
  CHECK ("progressPercent" BETWEEN 0 AND 100);

-- Invariant 4.2: Task dueDate >= startDate
ALTER TABLE IF EXISTS "Task"
  DROP CONSTRAINT IF EXISTS chk_task_due_date_after_start_date;
ALTER TABLE IF EXISTS "Task"
  ADD CONSTRAINT chk_task_due_date_after_start_date
  CHECK ("dueDate" IS NULL OR "startDate" IS NULL OR "dueDate" >= "startDate");

-- Invariant 4.3: PushSubscription failureCount >= 0
ALTER TABLE IF EXISTS "PushSubscription"
  DROP CONSTRAINT IF EXISTS chk_push_subscription_failure_count;
ALTER TABLE IF EXISTS "PushSubscription"
  ADD CONSTRAINT chk_push_subscription_failure_count
  CHECK ("failureCount" >= 0);

-- Invariant 4.4: OutboxEvent attempts >= 0
ALTER TABLE IF EXISTS "OutboxEvent"
  DROP CONSTRAINT IF EXISTS chk_outbox_event_attempts;
ALTER TABLE IF EXISTS "OutboxEvent"
  ADD CONSTRAINT chk_outbox_event_attempts
  CHECK (attempts >= 0);

-- --------------------------------------------------------------------
-- 5. Idempotent PL/pgSQL Procedural Block Alternative (DO $$ ... $$)
-- For execution contexts requiring exception-trapped constraint addition
-- --------------------------------------------------------------------
DO $$
BEGIN
  -- Validate tasks table exists before executing check constraint addition
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'tasks'
  ) THEN
    BEGIN
      ALTER TABLE "tasks" ADD CONSTRAINT chk_tasks_progress_percent_guard
        CHECK (progress_percent BETWEEN 0 AND 100);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER TABLE "tasks" ADD CONSTRAINT chk_tasks_due_date_guard
        CHECK (due_date IS NULL OR start_date IS NULL OR due_date >= start_date);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;

  -- Validate push_subscriptions table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'push_subscriptions'
  ) THEN
    BEGIN
      ALTER TABLE "push_subscriptions" ADD CONSTRAINT chk_push_sub_failure_guard
        CHECK (failure_count >= 0);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;

  -- Validate outbox_events table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'outbox_events'
  ) THEN
    BEGIN
      ALTER TABLE "outbox_events" ADD CONSTRAINT chk_outbox_attempts_guard
        CHECK (attempts >= 0);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
