-- ====================================================================
-- QCET E-Office: Database Hardening - High-Performance Indexes
-- Task 11: Composite & Partial Indexes Audit
-- Database: PostgreSQL 14+ with Prisma ORM
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. TASK COMPOSITE INDEXES
-- Optimizes high-frequency queries in Task Hub, Calendar, and Workspaces
-- --------------------------------------------------------------------

-- Accelerates task filtering by scope (SCHOOL / DEPARTMENT / INDIVIDUAL), status, and due date
CREATE INDEX IF NOT EXISTS idx_tasks_scope_status_due_date
ON "tasks" ("scope", "status", "due_date");

-- Accelerates department task views filtered by status and due date
CREATE INDEX IF NOT EXISTS idx_tasks_dept_status_due_date
ON "tasks" ("department_id", "status", "due_date");

-- Accelerates subtask hierarchy traversals and tree decompositions
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id
ON "tasks" ("parent_task_id");

-- Accelerates creator-based task audits and assignment queries
CREATE INDEX IF NOT EXISTS idx_tasks_created_by_id
ON "tasks" ("created_by_id");

-- Accelerates recent task modification feeds and delta syncs
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at_desc
ON "tasks" ("updated_at" DESC);

-- Accelerates academic year filtering across all units
CREATE INDEX IF NOT EXISTS idx_tasks_academic_year
ON "tasks" ("academic_year");

-- Compound index for department and academic period navigation
CREATE INDEX IF NOT EXISTS idx_tasks_dept_academic_period
ON "tasks" ("department_id", "academic_year", "academic_month");

-- --------------------------------------------------------------------
-- 2. NOTIFICATION COMPOSITE INDEXES
-- Optimizes notification dropdowns, banners, and activity feeds
-- --------------------------------------------------------------------

-- Chronological user notifications query (most recent first)
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at_desc
ON "notifications" ("user_id", "created_at" DESC);

-- Accelerates user read receipt status queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read_at
ON "notifications" ("user_id", "read_at");

-- --------------------------------------------------------------------
-- 3. DOCUMENT COMPOSITE INDEXES
-- Optimizes document register (Sổ văn bản đến/đi) and pending action lists
-- --------------------------------------------------------------------

-- Filter documents by type (VAN_BAN_DEN / VAN_BAN_DI), processing status, and deadline
CREATE INDEX IF NOT EXISTS idx_documents_type_status_due_date
ON "documents" ("type", "status", "due_date");

-- Accelerates original number lookup for incoming/outgoing documents
CREATE INDEX IF NOT EXISTS idx_documents_original_number
ON "documents" ("original_number");

-- Accelerates lead department document aggregations
CREATE INDEX IF NOT EXISTS idx_documents_lead_dept_id
ON "documents" ("lead_department_id");

-- Accelerates drafting department document filtering
CREATE INDEX IF NOT EXISTS idx_documents_drafting_dept_id
ON "documents" ("drafting_dept_id");

-- --------------------------------------------------------------------
-- 4. PARTIAL INDEXES (High-Efficiency Filtered Indexes)
-- PostgreSQL partial indexes covering small, high-churn query subsets
-- --------------------------------------------------------------------

-- Unread notifications partial index: accelerates badge counts & unread popups
-- Eliminates table scans for users with thousands of historical read notifications
CREATE INDEX IF NOT EXISTS notification_unread_user_idx
ON "notifications" ("user_id", "created_at" DESC)
WHERE "read_at" IS NULL;

-- Secondary partial index on is_read boolean flag for queries filtering by boolean
CREATE INDEX IF NOT EXISTS notification_unread_user_flag_idx
ON "notifications" ("user_id", "created_at" DESC)
WHERE "is_read" = false;

-- Single primary owner partial unique index on TaskAssignee (task specification)
-- Guarantees that at most one PRIMARY_OWNER exists per task at the database engine level
CREATE UNIQUE INDEX IF NOT EXISTS task_one_primary_owner_idx
ON "task_assignees" ("task_id")
WHERE "role" = 'PRIMARY_OWNER';

-- Single primary owner partial unique index on physical PostgreSQL column (role_in_task)
CREATE UNIQUE INDEX IF NOT EXISTS task_assignees_one_primary_owner_idx
ON "task_assignees" ("task_id")
WHERE "role_in_task" = 'PRIMARY_OWNER';

-- Active (non-archived) tasks partial index for production dashboard queries
CREATE INDEX IF NOT EXISTS idx_tasks_active_scope_status_due_date
ON "tasks" ("scope", "status", "due_date")
WHERE "archived_at" IS NULL;

-- Active (non-archived) documents partial index
CREATE INDEX IF NOT EXISTS idx_documents_active_type_status
ON "documents" ("type", "status", "due_date")
WHERE "archived_at" IS NULL;
