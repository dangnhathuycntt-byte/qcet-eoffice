-- Migration: 01_contract_legacy_models.sql
-- Sprint 7: Legacy Data Cutover & Removal Contract Migration
-- Description: Drops legacy foreign keys, triggers, indexes, and tables (departments, task_assignees, dacum_delegations)
-- Pre-requisite: 100% data parity verified via prisma/data-migrations/verify-parity.ts

BEGIN;

-- Step 1: Drop foreign keys referencing legacy tables
-- Foreign keys to "departments"
ALTER TABLE IF EXISTS "users" DROP CONSTRAINT IF EXISTS "users_department_id_fkey";
ALTER TABLE IF EXISTS "tasks" DROP CONSTRAINT IF EXISTS "tasks_department_id_fkey";
ALTER TABLE IF EXISTS "dacum_delegations" DROP CONSTRAINT IF EXISTS "dacum_delegations_department_id_fkey";
ALTER TABLE IF EXISTS "documents" DROP CONSTRAINT IF EXISTS "documents_drafting_dept_id_fkey";
ALTER TABLE IF EXISTS "documents" DROP CONSTRAINT IF EXISTS "documents_lead_department_id_fkey";
ALTER TABLE IF EXISTS "document_directives" DROP CONSTRAINT IF EXISTS "document_directives_assigned_dept_id_fkey";
ALTER TABLE IF EXISTS "job_catalog_items" DROP CONSTRAINT IF EXISTS "job_catalog_items_department_id_fkey";
ALTER TABLE IF EXISTS "dacum_duties" DROP CONSTRAINT IF EXISTS "dacum_duties_department_id_fkey";

-- Foreign keys on "task_assignees"
ALTER TABLE IF EXISTS "task_assignees" DROP CONSTRAINT IF EXISTS "task_assignees_task_id_fkey";
ALTER TABLE IF EXISTS "task_assignees" DROP CONSTRAINT IF EXISTS "task_assignees_user_id_fkey";

-- Foreign keys on "dacum_delegations"
ALTER TABLE IF EXISTS "dacum_delegations" DROP CONSTRAINT IF EXISTS "dacum_delegations_task_id_fkey";
ALTER TABLE IF EXISTS "dacum_delegations" DROP CONSTRAINT IF EXISTS "dacum_delegations_grantor_id_fkey";
ALTER TABLE IF EXISTS "dacum_delegations" DROP CONSTRAINT IF EXISTS "dacum_delegations_delegate_id_fkey";

-- Step 2: Drop triggers, functions and obsolete indexes associated with legacy tables
DROP TRIGGER IF EXISTS "trg_check_task_assignee_role" ON "task_assignees";
DROP FUNCTION IF EXISTS "check_task_assignee_role()";
DROP INDEX IF EXISTS "tasks_department_id_academic_year_academic_month_idx";
DROP INDEX IF EXISTS "tasks_department_id_status_due_date_idx";
DROP INDEX IF EXISTS "documents_lead_department_id_idx";
DROP INDEX IF EXISTS "dacum_delegations_department_id_is_active_idx";

-- Step 3: Drop obsolete legacy tables
DROP TABLE IF EXISTS "task_assignees" CASCADE;
DROP TABLE IF EXISTS "dacum_delegations" CASCADE;
DROP TABLE IF EXISTS "departments" CASCADE;

COMMIT;
