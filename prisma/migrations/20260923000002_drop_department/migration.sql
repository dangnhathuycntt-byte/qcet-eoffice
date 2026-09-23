-- Phase 9 WI-9.2: Drop legacy Department table and departmentId foreign key columns
-- Prerequisite: OrganizationalUnit fully adopted, ORG_UNIT_READ/WRITE_CUTOVER active

-- Drop foreign key constraints first (Prisma convention: CASCADE handles referential integrity)
ALTER TABLE "users" DROP COLUMN IF EXISTS "department_id";
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "department_id";
ALTER TABLE "dacum_delegations" DROP COLUMN IF EXISTS "department_id";
ALTER TABLE "documents" DROP COLUMN IF EXISTS "drafting_dept_id";
ALTER TABLE "documents" DROP COLUMN IF EXISTS "lead_department_id";
ALTER TABLE "document_directives" DROP COLUMN IF EXISTS "assigned_dept_id";
ALTER TABLE "job_catalog_items" DROP COLUMN IF EXISTS "department_id";
ALTER TABLE "dacum_duties" DROP COLUMN IF EXISTS "department_id";

-- Drop legacy indexes that reference removed columns
DROP INDEX IF EXISTS "tasks_department_id_academic_year_academic_month_idx";
DROP INDEX IF EXISTS "tasks_department_id_status_due_date_idx";
DROP INDEX IF EXISTS "dacum_delegations_department_id_is_active_idx";
DROP INDEX IF EXISTS "documents_lead_department_id_idx";
DROP INDEX IF EXISTS "documents_drafting_dept_id_idx";
DROP INDEX IF EXISTS "job_catalog_items_group_department_id_idx";
DROP INDEX IF EXISTS "dacum_duties_department_id_code_key";

-- Drop legacy departments table (CASCADE drops any remaining FKs referencing it)
DROP TABLE IF EXISTS "departments" CASCADE;
