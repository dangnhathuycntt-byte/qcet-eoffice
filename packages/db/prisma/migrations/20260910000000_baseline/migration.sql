-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- Extensions & Environment
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
BEGIN
  IF current_setting('search_path') NOT LIKE '%public%' THEN
    PERFORM set_config('search_path', current_setting('search_path') || ', public', false);
  END IF;
END
$$;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BAN_GIAM_HIEU', 'TRUONG_PHONG', 'CHUYEN_VIEN', 'VAN_THU', 'ADMIN');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('VAN_BAN_DEN', 'VAN_BAN_DI', 'TO_TRINH_NOI_BO');

-- CreateEnum
CREATE TYPE "DocumentUrgency" AS ENUM ('THUONG', 'KHAN', 'THUONG_KHAN', 'HOA_TOC');

-- CreateEnum
CREATE TYPE "DocumentSecurityLevel" AS ENUM ('THUONG', 'MAT', 'TOI_MAT', 'TUYET_MAT');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('CHO_PHAN_CONG', 'DANG_XU_LY', 'CHO_PHE_DUYET', 'DA_HOAN_THANH', 'LUU_THEO_DOI');

-- CreateEnum
CREATE TYPE "TaskScope" AS ENUM ('SCHOOL', 'DEPARTMENT', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'WAITING_APPROVAL', 'COMPLETED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('URGENT', 'HIGH', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "AssigneeRole" AS ENUM ('PRIMARY_OWNER', 'COLLABORATOR', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "DeliverableReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REVISION_REQUIRED');

-- CreateEnum
CREATE TYPE "ResolutionType" AS ENUM ('EXTEND_DEADLINE', 'REASSIGN_OWNER', 'DIRECTIVE_NOTE', 'DISMISS_BOTTLENECK');

-- CreateEnum
CREATE TYPE "IncomingDocumentStatus" AS ENUM ('RECEIVED', 'REGISTERED', 'PRESENTED', 'DIRECTED', 'ASSIGNED_TO_LEAD_UNIT', 'UNIT_ASSIGNED_PERSON', 'IN_PROGRESS', 'RESOLVED', 'FILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OutgoingDocumentStatus" AS ENUM ('DRAFT', 'CONTENT_REVIEW', 'FORMAT_CHECK', 'AUTHORIZED_SIGN', 'NUMBERED', 'ORGANIZATION_SIGNED', 'ISSUED', 'DELIVERED', 'FILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SignatureType" AS ENUM ('PERSONAL_DIGITAL', 'ORGANIZATION_DIGITAL', 'PHYSICAL');

-- CreateEnum
CREATE TYPE "SignatureVerificationStatus" AS ENUM ('VALID', 'INVALID', 'REVOKED', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "PushSubscriptionStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "JobCatalogGroup" AS ENUM ('LDPU', 'VCMN', 'VCDC', 'HTPV');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('SCHOOL', 'FACULTY', 'DEPARTMENT', 'CENTER', 'SECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('ACTIVE', 'REORGANIZING', 'MERGED', 'DISSOLVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OrganizationalBodyType" AS ENUM ('COUNCIL', 'COMMITTEE', 'STEERING_COMMITTEE', 'WORKING_GROUP');

-- CreateEnum
CREATE TYPE "BodyStatus" AS ENUM ('ACTIVE', 'CONCLUDED', 'SUSPENDED', 'DISSOLVED');

-- CreateEnum
CREATE TYPE "BodyMemberRole" AS ENUM ('CHAIR', 'VICE_CHAIR', 'SECRETARY', 'MEMBER');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('PRIMARY', 'CONCURRENT', 'ACTING');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'TERMINATED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ResponsibilityCategory" AS ENUM ('EXECUTIVE', 'ACADEMIC', 'OPERATIONAL');

-- CreateEnum
CREATE TYPE "DelegationStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED', 'PENDING');

-- CreateEnum
CREATE TYPE "TaskActorRole" AS ENUM ('ASSIGNER', 'LEAD_UNIT', 'COORDINATING_UNIT', 'DRI', 'COLLABORATOR', 'FOLLOWER', 'REVIEWER', 'APPROVER', 'OBSERVER');

-- CreateEnum
CREATE TYPE "TaskOriginLevel" AS ENUM ('SCHOOL', 'UNIT', 'PERSONAL');

-- CreateEnum
CREATE TYPE "ApprovalProcessStatus" AS ENUM ('NOT_STARTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalStepStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'BYPASSED');

-- CreateEnum
CREATE TYPE "TaskRelationType" AS ENUM ('BLOCKS', 'DEPENDS_ON', 'PARENT_CHILD', 'DUPLICATE_OF', 'DERIVED_FROM');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DossierStatus" AS ENUM ('OPEN', 'ACTIVE', 'CLOSED', 'READY_FOR_ARCHIVE', 'SUBMITTED_TO_ARCHIVE', 'ACCEPTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DossierItemType" AS ENUM ('DOCUMENT', 'TASK', 'RESULT', 'DECISION', 'MEETING_MINUTES', 'ATTACHMENT');

-- CreateEnum
CREATE TYPE "DataClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'RESTRICTED', 'PERSONAL_DATA');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('DRAFT_AGENDA', 'INVITED', 'HELD', 'MINUTES_DRAFT', 'MINUTES_CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MeetingParticipantRole" AS ENUM ('CHAIR', 'SECRETARY', 'ATTENDEE', 'INVITED_GUEST');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'ATTENDED', 'ABSENT');

-- CreateTable
CREATE TABLE "departments" (
    "id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "short_name" VARCHAR(50),
    "color" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "password_hash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CHUYEN_VIEN',
    "department_id" VARCHAR(50),
    "title" VARCHAR(150),
    "phone" VARCHAR(20),
    "avatar_url" TEXT,
    "provider" VARCHAR(50) NOT NULL DEFAULT 'credentials',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deactivated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "onboarded_at" TIMESTAMP(3),
    "onboarding_data" JSONB,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "scope" "TaskScope" NOT NULL DEFAULT 'SCHOOL',
    "status" "TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "academic_month" INTEGER NOT NULL,
    "academic_year" VARCHAR(20) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "department_id" VARCHAR(50),
    "created_by_id" TEXT NOT NULL,
    "parent_task_id" TEXT,
    "dacum_task_def_id" VARCHAR(50),
    "archived_at" TIMESTAMP(3),
    "archived_by_id" TEXT,
    "archive_reason" TEXT,
    "origin_level" "TaskOriginLevel" NOT NULL DEFAULT 'SCHOOL',
    "lead_unit_id" TEXT,
    "primary_assignment_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignees" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_in_task" "AssigneeRole" NOT NULL DEFAULT 'PRIMARY_OWNER',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_deliverables" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" VARCHAR(50),
    "file_size" INTEGER,
    "uploaded_by_id" TEXT NOT NULL,
    "review_status" "DeliverableReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewer_id" TEXT,
    "review_note" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dacum_delegations" (
    "id" TEXT NOT NULL,
    "task_id" TEXT,
    "grantor_id" TEXT NOT NULL,
    "delegate_id" TEXT NOT NULL,
    "committee_role" VARCHAR(100) NOT NULL,
    "authority_scope" VARCHAR(255) NOT NULL,
    "department_id" VARCHAR(50),
    "start_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "document_ref" VARCHAR(100),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dacum_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executive_resolutions" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "resolution_type" "ResolutionType" NOT NULL,
    "directive_note" TEXT,
    "granted_days" INTEGER,
    "previous_due_date" TIMESTAMP(3),
    "new_due_date" TIMESTAMP(3),
    "previous_owner_id" TEXT,
    "new_owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "executive_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "registration_number" INTEGER NOT NULL,
    "document_year" INTEGER NOT NULL,
    "registered_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "original_number" VARCHAR(100) NOT NULL,
    "issued_date" TIMESTAMP(3) NOT NULL,
    "issuing_authority" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "summary" TEXT NOT NULL,
    "urgency" "DocumentUrgency" NOT NULL DEFAULT 'THUONG',
    "security_level" "DocumentSecurityLevel" NOT NULL DEFAULT 'THUONG',
    "signer_name" VARCHAR(150),
    "signer_title" VARCHAR(100),
    "drafting_dept_id" VARCHAR(50),
    "recipient_list" TEXT,
    "distributed_copies" INTEGER DEFAULT 1,
    "due_date" TIMESTAMP(3),
    "lead_department_id" VARCHAR(50),
    "lead_user_id" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'CHO_PHAN_CONG',
    "notes" TEXT,
    "registered_by_id" TEXT NOT NULL,
    "archived_at" TIMESTAMP(3),
    "archived_by_id" TEXT,
    "archive_reason" TEXT,
    "linked_task_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_number_sequences" (
    "id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_attachments" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "sha256_hash" VARCHAR(64),
    "is_original" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_directives" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "leader_id" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "assigned_dept_id" VARCHAR(50) NOT NULL,
    "collaborator_ids" TEXT,
    "is_task_generated" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_directives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_incoming_workflows" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "status" "IncomingDocumentStatus" NOT NULL DEFAULT 'REGISTERED',
    "presented_at" TIMESTAMP(3),
    "presented_by_id" TEXT,
    "presenter_notes" TEXT,
    "directed_at" TIMESTAMP(3),
    "leader_id" TEXT,
    "lead_unit_id" TEXT,
    "coordinating_unit_ids" JSONB,
    "leadership_instruction" TEXT,
    "deadline" TIMESTAMP(3),
    "responsibility_area_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" TEXT,
    "resolution_summary" TEXT,
    "resolution_doc_url" TEXT,
    "filed_at" TIMESTAMP(3),
    "filed_by_id" TEXT,
    "dossier_id" VARCHAR(100),
    "filing_notes" TEXT,
    "archived_at" TIMESTAMP(3),
    "archived_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_incoming_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_work_assignments" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "assigned_by_id" TEXT NOT NULL,
    "dri_user_id" TEXT NOT NULL,
    "collaborator_user_ids" JSONB,
    "instruction" TEXT,
    "deadline" TIMESTAMP(3),
    "status" VARCHAR(50) NOT NULL DEFAULT 'ASSIGNED',
    "task_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_work_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_outgoing_workflows" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "status" "OutgoingDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "content_review_submitted_at" TIMESTAMP(3),
    "content_reviewer_id" TEXT,
    "content_approved_at" TIMESTAMP(3),
    "content_review_notes" TEXT,
    "format_review_submitted_at" TIMESTAMP(3),
    "format_reviewer_id" TEXT,
    "format_approved_at" TIMESTAMP(3),
    "format_review_notes" TEXT,
    "authorized_signer_id" TEXT,
    "authorized_signed_at" TIMESTAMP(3),
    "signing_notes" TEXT,
    "numbered_at" TIMESTAMP(3),
    "numberer_id" TEXT,
    "outgoing_number" INTEGER,
    "outgoing_number_str" VARCHAR(100),
    "org_signed_at" TIMESTAMP(3),
    "org_signer_id" TEXT,
    "issued_at" TIMESTAMP(3),
    "issuer_id" TEXT,
    "recipient_list" TEXT,
    "delivery_method" VARCHAR(100),
    "delivered_at" TIMESTAMP(3),
    "filed_at" TIMESTAMP(3),
    "filed_by_id" TEXT,
    "dossier_id" VARCHAR(100),
    "archived_at" TIMESTAMP(3),
    "archived_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_outgoing_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_records" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "signer_user_id" TEXT NOT NULL,
    "signer_assignment_id" TEXT,
    "signing_capacity" VARCHAR(100) NOT NULL,
    "signature_type" "SignatureType" NOT NULL DEFAULT 'PERSONAL_DIGITAL',
    "certificate_metadata" JSONB,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verification_status" "SignatureVerificationStatus" NOT NULL DEFAULT 'VALID',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signature_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "device_type" TEXT,
    "status" "PushSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_failure_code" INTEGER,
    "last_seen_at" TIMESTAMP(3),
    "disabled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "actor_name" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'task',
    "type" TEXT NOT NULL,
    "link_href" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_sequences" (
    "year" INTEGER NOT NULL,
    "scope" TEXT NOT NULL,
    "department_code" TEXT NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_sequences_pkey" PRIMARY KEY ("year","scope","department_code")
);

-- CreateTable
CREATE TABLE "job_catalog_items" (
    "id" VARCHAR(50) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "group" "JobCatalogGroup" NOT NULL,
    "department_id" VARCHAR(50),
    "description" TEXT,
    "competency_req" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dacum_duties" (
    "id" VARCHAR(50) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "department_id" VARCHAR(50) NOT NULL,
    "job_catalog_item_id" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dacum_duties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dacum_task_defs" (
    "id" VARCHAR(50) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "duty_id" VARCHAR(50) NOT NULL,
    "criteria" TEXT,
    "tools" TEXT,
    "required_deliverables" TEXT,
    "standard_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dacum_task_defs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizational_units" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "UnitType" NOT NULL,
    "parent_id" TEXT,
    "status" "UnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizational_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_closure_paths" (
    "ancestor_id" TEXT NOT NULL,
    "descendant_id" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,

    CONSTRAINT "unit_closure_paths_pkey" PRIMARY KEY ("ancestor_id","descendant_id")
);

-- CreateTable
CREATE TABLE "organizational_bodies" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "OrganizationalBodyType" NOT NULL,
    "established_by" VARCHAR(255),
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "status" "BodyStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizational_bodies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "body_memberships" (
    "id" TEXT NOT NULL,
    "body_id" TEXT NOT NULL,
    "position_assignment_id" TEXT,
    "user_id" TEXT,
    "role" "BodyMemberRole" NOT NULL,
    "appointed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "body_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_definitions" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "group" "JobCatalogGroup" NOT NULL,
    "min_level" INTEGER DEFAULT 1,
    "is_leadership" BOOLEAN NOT NULL DEFAULT false,
    "dacum_job_catalog_id" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "position_definition_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "type" "AssignmentType" NOT NULL DEFAULT 'PRIMARY',
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "source_decision_number" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responsibility_areas" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" "ResponsibilityCategory" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "responsibility_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_assignments" (
    "id" TEXT NOT NULL,
    "position_assignment_id" TEXT NOT NULL,
    "responsibility_area_id" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "source_decision_number" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegation_grants" (
    "id" TEXT NOT NULL,
    "grantor_assignment_id" TEXT NOT NULL,
    "grantee_assignment_id" TEXT NOT NULL,
    "responsibility_area_id" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "resource_scope" VARCHAR(100) NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "source_document_number" VARCHAR(100) NOT NULL,
    "reason" TEXT,
    "status" "DelegationStatus" NOT NULL DEFAULT 'ACTIVE',
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delegation_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegation_scope_rules" (
    "id" TEXT NOT NULL,
    "delegation_grant_id" TEXT NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(100),
    "constraint_type" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegation_scope_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_actors" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT,
    "unit_id" TEXT,
    "role" "TaskActorRole" NOT NULL,
    "is_primary_dri" BOOLEAN NOT NULL DEFAULT false,
    "assigned_by_id" TEXT,
    "appointed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "task_actors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_approval_processes" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "status" "ApprovalProcessStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "total_steps" INTEGER NOT NULL DEFAULT 1,
    "current_step_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_approval_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_approval_steps" (
    "id" TEXT NOT NULL,
    "process_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "reviewer_assignment_id" TEXT,
    "reviewer_user_id" TEXT,
    "status" "ApprovalStepStatus" NOT NULL DEFAULT 'PENDING',
    "decision_note" TEXT,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "task_approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_results" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "submitted_by_user_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "report_url" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_by_user_id" TEXT,
    "verified_at" TIMESTAMP(3),

    CONSTRAINT "task_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_relations" (
    "id" TEXT NOT NULL,
    "source_task_id" TEXT NOT NULL,
    "target_task_id" TEXT NOT NULL,
    "relation_type" "TaskRelationType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "response" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "request_id" TEXT,
    "before_data" JSONB,
    "after_data" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_rules" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "duration_years" INTEGER,
    "legal_basis" VARCHAR(255),
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retention_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_dossiers" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "owning_unit_id" TEXT NOT NULL,
    "responsible_person_id" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "retention_rule_id" TEXT,
    "status" "DossierStatus" NOT NULL DEFAULT 'OPEN',
    "classification" "DataClassification" NOT NULL DEFAULT 'INTERNAL',
    "storage_location" VARCHAR(255),
    "submitted_archive_at" TIMESTAMP(3),
    "submitted_by_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "archived_by_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_dossiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossier_items" (
    "id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "item_type" "DossierItemType" NOT NULL,
    "item_id" VARCHAR(100),
    "title" VARCHAR(500) NOT NULL,
    "document_number" VARCHAR(100),
    "document_date" TIMESTAMP(3),
    "page_count" INTEGER,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "added_by_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "dossier_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "code" VARCHAR(100),
    "body_id" TEXT,
    "unit_id" TEXT,
    "organizer_id" TEXT NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'DRAFT_AGENDA',
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "location" VARCHAR(255),
    "agenda" TEXT,
    "materials_url" TEXT,
    "minutes" TEXT,
    "minutes_confirmed_at" TIMESTAMP(3),
    "minutes_confirmed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_participants" (
    "id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "MeetingParticipantRole" NOT NULL DEFAULT 'ATTENDEE',
    "attendance_status" "AttendanceStatus" NOT NULL DEFAULT 'INVITED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_resolutions" (
    "id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "code" VARCHAR(100),
    "title" VARCHAR(500) NOT NULL,
    "content" TEXT NOT NULL,
    "lead_unit_id" TEXT,
    "lead_user_id" TEXT,
    "deadline" TIMESTAMP(3),
    "resulting_task_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_code_key" ON "tasks"("code");

-- CreateIndex
CREATE INDEX "tasks_department_id_academic_year_academic_month_idx" ON "tasks"("department_id", "academic_year", "academic_month");

-- CreateIndex
CREATE INDEX "tasks_academic_year_idx" ON "tasks"("academic_year");

-- CreateIndex
CREATE INDEX "tasks_status_due_date_idx" ON "tasks"("status", "due_date");

-- CreateIndex
CREATE INDEX "tasks_scope_status_due_date_idx" ON "tasks"("scope", "status", "due_date");

-- CreateIndex
CREATE INDEX "tasks_department_id_status_due_date_idx" ON "tasks"("department_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "tasks_parent_task_id_idx" ON "tasks"("parent_task_id");

-- CreateIndex
CREATE INDEX "tasks_created_by_id_idx" ON "tasks"("created_by_id");

-- CreateIndex
CREATE INDEX "tasks_updated_at_idx" ON "tasks"("updated_at" DESC);

-- CreateIndex
CREATE INDEX "tasks_scope_priority_idx" ON "tasks"("scope", "priority");

-- CreateIndex
CREATE INDEX "tasks_lead_unit_id_idx" ON "tasks"("lead_unit_id");

-- CreateIndex
CREATE INDEX "tasks_primary_assignment_id_idx" ON "tasks"("primary_assignment_id");

-- CreateIndex
CREATE INDEX "task_assignees_user_id_role_in_task_idx" ON "task_assignees"("user_id", "role_in_task");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignees_task_id_user_id_role_in_task_key" ON "task_assignees"("task_id", "user_id", "role_in_task");

-- CreateIndex
CREATE INDEX "task_deliverables_task_id_review_status_idx" ON "task_deliverables"("task_id", "review_status");

-- CreateIndex
CREATE INDEX "dacum_delegations_delegate_id_is_active_expires_at_idx" ON "dacum_delegations"("delegate_id", "is_active", "expires_at");

-- CreateIndex
CREATE INDEX "dacum_delegations_department_id_is_active_idx" ON "dacum_delegations"("department_id", "is_active");

-- CreateIndex
CREATE INDEX "executive_resolutions_task_id_resolution_type_idx" ON "executive_resolutions"("task_id", "resolution_type");

-- CreateIndex
CREATE UNIQUE INDEX "documents_linked_task_id_key" ON "documents"("linked_task_id");

-- CreateIndex
CREATE INDEX "documents_type_document_year_registered_date_idx" ON "documents"("type", "document_year", "registered_date");

-- CreateIndex
CREATE INDEX "documents_type_status_due_date_idx" ON "documents"("type", "status", "due_date");

-- CreateIndex
CREATE INDEX "documents_status_urgency_due_date_idx" ON "documents"("status", "urgency", "due_date");

-- CreateIndex
CREATE INDEX "documents_original_number_idx" ON "documents"("original_number");

-- CreateIndex
CREATE INDEX "documents_lead_department_id_idx" ON "documents"("lead_department_id");

-- CreateIndex
CREATE INDEX "documents_drafting_dept_id_idx" ON "documents"("drafting_dept_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_type_document_year_registration_number_key" ON "documents"("type", "document_year", "registration_number");

-- CreateIndex
CREATE UNIQUE INDEX "document_number_sequences_type_year_key" ON "document_number_sequences"("type", "year");

-- CreateIndex
CREATE INDEX "document_attachments_document_id_idx" ON "document_attachments"("document_id");

-- CreateIndex
CREATE INDEX "document_directives_document_id_leader_id_idx" ON "document_directives"("document_id", "leader_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_incoming_workflows_document_id_key" ON "document_incoming_workflows"("document_id");

-- CreateIndex
CREATE INDEX "document_incoming_workflows_status_idx" ON "document_incoming_workflows"("status");

-- CreateIndex
CREATE INDEX "document_incoming_workflows_lead_unit_id_idx" ON "document_incoming_workflows"("lead_unit_id");

-- CreateIndex
CREATE INDEX "document_incoming_workflows_leader_id_idx" ON "document_incoming_workflows"("leader_id");

-- CreateIndex
CREATE INDEX "unit_work_assignments_workflow_id_idx" ON "unit_work_assignments"("workflow_id");

-- CreateIndex
CREATE INDEX "unit_work_assignments_unit_id_idx" ON "unit_work_assignments"("unit_id");

-- CreateIndex
CREATE INDEX "unit_work_assignments_dri_user_id_idx" ON "unit_work_assignments"("dri_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_outgoing_workflows_document_id_key" ON "document_outgoing_workflows"("document_id");

-- CreateIndex
CREATE INDEX "document_outgoing_workflows_status_idx" ON "document_outgoing_workflows"("status");

-- CreateIndex
CREATE INDEX "document_outgoing_workflows_authorized_signer_id_idx" ON "document_outgoing_workflows"("authorized_signer_id");

-- CreateIndex
CREATE INDEX "document_outgoing_workflows_content_reviewer_id_idx" ON "document_outgoing_workflows"("content_reviewer_id");

-- CreateIndex
CREATE INDEX "document_outgoing_workflows_format_reviewer_id_idx" ON "document_outgoing_workflows"("format_reviewer_id");

-- CreateIndex
CREATE INDEX "signature_records_document_id_version_idx" ON "signature_records"("document_id", "version");

-- CreateIndex
CREATE INDEX "signature_records_signer_user_id_idx" ON "signature_records"("signer_user_id");

-- CreateIndex
CREATE INDEX "signature_records_verification_status_idx" ON "signature_records"("verification_status");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "push_subscriptions_status_idx" ON "push_subscriptions"("status");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_catalog_items_code_key" ON "job_catalog_items"("code");

-- CreateIndex
CREATE INDEX "job_catalog_items_group_department_id_idx" ON "job_catalog_items"("group", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "dacum_duties_department_id_code_key" ON "dacum_duties"("department_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "dacum_task_defs_duty_id_code_key" ON "dacum_task_defs"("duty_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "organizational_units_code_key" ON "organizational_units"("code");

-- CreateIndex
CREATE INDEX "organizational_units_type_status_idx" ON "organizational_units"("type", "status");

-- CreateIndex
CREATE INDEX "unit_closure_paths_descendant_id_idx" ON "unit_closure_paths"("descendant_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizational_bodies_code_key" ON "organizational_bodies"("code");

-- CreateIndex
CREATE INDEX "organizational_bodies_type_status_idx" ON "organizational_bodies"("type", "status");

-- CreateIndex
CREATE INDEX "body_memberships_body_id_role_idx" ON "body_memberships"("body_id", "role");

-- CreateIndex
CREATE INDEX "body_memberships_user_id_idx" ON "body_memberships"("user_id");

-- CreateIndex
CREATE INDEX "body_memberships_position_assignment_id_idx" ON "body_memberships"("position_assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "position_definitions_code_key" ON "position_definitions"("code");

-- CreateIndex
CREATE INDEX "position_definitions_group_idx" ON "position_definitions"("group");

-- CreateIndex
CREATE INDEX "position_assignments_user_id_status_idx" ON "position_assignments"("user_id", "status");

-- CreateIndex
CREATE INDEX "position_assignments_unit_id_status_idx" ON "position_assignments"("unit_id", "status");

-- CreateIndex
CREATE INDEX "position_assignments_position_definition_id_idx" ON "position_assignments"("position_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "responsibility_areas_code_key" ON "responsibility_areas"("code");

-- CreateIndex
CREATE INDEX "portfolio_assignments_responsibility_area_id_idx" ON "portfolio_assignments"("responsibility_area_id");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_assignments_position_assignment_id_responsibility_key" ON "portfolio_assignments"("position_assignment_id", "responsibility_area_id");

-- CreateIndex
CREATE INDEX "delegation_grants_grantor_assignment_id_status_idx" ON "delegation_grants"("grantor_assignment_id", "status");

-- CreateIndex
CREATE INDEX "delegation_grants_grantee_assignment_id_status_idx" ON "delegation_grants"("grantee_assignment_id", "status");

-- CreateIndex
CREATE INDEX "delegation_grants_valid_from_valid_until_status_idx" ON "delegation_grants"("valid_from", "valid_until", "status");

-- CreateIndex
CREATE INDEX "delegation_scope_rules_delegation_grant_id_idx" ON "delegation_scope_rules"("delegation_grant_id");

-- CreateIndex
CREATE INDEX "task_actors_task_id_role_idx" ON "task_actors"("task_id", "role");

-- CreateIndex
CREATE INDEX "task_actors_user_id_idx" ON "task_actors"("user_id");

-- CreateIndex
CREATE INDEX "task_actors_unit_id_idx" ON "task_actors"("unit_id");

-- CreateIndex
CREATE INDEX "task_approval_processes_task_id_status_idx" ON "task_approval_processes"("task_id", "status");

-- CreateIndex
CREATE INDEX "task_approval_steps_process_id_step_order_idx" ON "task_approval_steps"("process_id", "step_order");

-- CreateIndex
CREATE INDEX "task_results_task_id_idx" ON "task_results"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_relations_source_task_id_target_task_id_relation_type_key" ON "task_relations"("source_task_id", "target_task_id", "relation_type");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_user_id_operation_key_key" ON "idempotency_records"("user_id", "operation", "key");

-- CreateIndex
CREATE INDEX "audit_events_entity_type_entity_id_created_at_idx" ON "audit_events"("entity_type", "entity_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_events_actor_id_created_at_idx" ON "audit_events"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_events_request_id_idx" ON "audit_events"("request_id");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_type_aggregate_id_idx" ON "outbox_events"("aggregate_type", "aggregate_id");

-- CreateIndex
CREATE UNIQUE INDEX "retention_rules_code_key" ON "retention_rules"("code");

-- CreateIndex
CREATE UNIQUE INDEX "work_dossiers_code_key" ON "work_dossiers"("code");

-- CreateIndex
CREATE INDEX "work_dossiers_owning_unit_id_idx" ON "work_dossiers"("owning_unit_id");

-- CreateIndex
CREATE INDEX "work_dossiers_responsible_person_id_idx" ON "work_dossiers"("responsible_person_id");

-- CreateIndex
CREATE INDEX "work_dossiers_submitted_by_id_idx" ON "work_dossiers"("submitted_by_id");

-- CreateIndex
CREATE INDEX "work_dossiers_status_idx" ON "work_dossiers"("status");

-- CreateIndex
CREATE INDEX "work_dossiers_classification_idx" ON "work_dossiers"("classification");

-- CreateIndex
CREATE INDEX "dossier_items_dossier_id_idx" ON "dossier_items"("dossier_id");

-- CreateIndex
CREATE INDEX "dossier_items_item_type_item_id_idx" ON "dossier_items"("item_type", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "meetings_code_key" ON "meetings"("code");

-- CreateIndex
CREATE INDEX "meetings_status_start_time_idx" ON "meetings"("status", "start_time");

-- CreateIndex
CREATE INDEX "meetings_body_id_idx" ON "meetings"("body_id");

-- CreateIndex
CREATE INDEX "meetings_unit_id_idx" ON "meetings"("unit_id");

-- CreateIndex
CREATE INDEX "meetings_organizer_id_idx" ON "meetings"("organizer_id");

-- CreateIndex
CREATE INDEX "meeting_participants_user_id_idx" ON "meeting_participants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_participants_meeting_id_user_id_key" ON "meeting_participants"("meeting_id", "user_id");

-- CreateIndex
CREATE INDEX "meeting_resolutions_meeting_id_idx" ON "meeting_resolutions"("meeting_id");

-- CreateIndex
CREATE INDEX "meeting_resolutions_lead_unit_id_idx" ON "meeting_resolutions"("lead_unit_id");

-- CreateIndex
CREATE INDEX "meeting_resolutions_lead_user_id_idx" ON "meeting_resolutions"("lead_user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_dacum_task_def_id_fkey" FOREIGN KEY ("dacum_task_def_id") REFERENCES "dacum_task_defs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_unit_id_fkey" FOREIGN KEY ("lead_unit_id") REFERENCES "organizational_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_primary_assignment_id_fkey" FOREIGN KEY ("primary_assignment_id") REFERENCES "position_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_deliverables" ADD CONSTRAINT "task_deliverables_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_deliverables" ADD CONSTRAINT "task_deliverables_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_deliverables" ADD CONSTRAINT "task_deliverables_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dacum_delegations" ADD CONSTRAINT "dacum_delegations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dacum_delegations" ADD CONSTRAINT "dacum_delegations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dacum_delegations" ADD CONSTRAINT "dacum_delegations_grantor_id_fkey" FOREIGN KEY ("grantor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dacum_delegations" ADD CONSTRAINT "dacum_delegations_delegate_id_fkey" FOREIGN KEY ("delegate_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executive_resolutions" ADD CONSTRAINT "executive_resolutions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executive_resolutions" ADD CONSTRAINT "executive_resolutions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_drafting_dept_id_fkey" FOREIGN KEY ("drafting_dept_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_lead_department_id_fkey" FOREIGN KEY ("lead_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_lead_user_id_fkey" FOREIGN KEY ("lead_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_registered_by_id_fkey" FOREIGN KEY ("registered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_linked_task_id_fkey" FOREIGN KEY ("linked_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_directives" ADD CONSTRAINT "document_directives_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_directives" ADD CONSTRAINT "document_directives_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_directives" ADD CONSTRAINT "document_directives_assigned_dept_id_fkey" FOREIGN KEY ("assigned_dept_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_incoming_workflows" ADD CONSTRAINT "document_incoming_workflows_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_incoming_workflows" ADD CONSTRAINT "document_incoming_workflows_presented_by_id_fkey" FOREIGN KEY ("presented_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_incoming_workflows" ADD CONSTRAINT "document_incoming_workflows_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_incoming_workflows" ADD CONSTRAINT "document_incoming_workflows_lead_unit_id_fkey" FOREIGN KEY ("lead_unit_id") REFERENCES "organizational_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_incoming_workflows" ADD CONSTRAINT "document_incoming_workflows_responsibility_area_id_fkey" FOREIGN KEY ("responsibility_area_id") REFERENCES "responsibility_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_incoming_workflows" ADD CONSTRAINT "document_incoming_workflows_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_incoming_workflows" ADD CONSTRAINT "document_incoming_workflows_filed_by_id_fkey" FOREIGN KEY ("filed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_incoming_workflows" ADD CONSTRAINT "document_incoming_workflows_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_work_assignments" ADD CONSTRAINT "unit_work_assignments_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "document_incoming_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_work_assignments" ADD CONSTRAINT "unit_work_assignments_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_work_assignments" ADD CONSTRAINT "unit_work_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_work_assignments" ADD CONSTRAINT "unit_work_assignments_dri_user_id_fkey" FOREIGN KEY ("dri_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_work_assignments" ADD CONSTRAINT "unit_work_assignments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_outgoing_workflows" ADD CONSTRAINT "document_outgoing_workflows_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_outgoing_workflows" ADD CONSTRAINT "document_outgoing_workflows_content_reviewer_id_fkey" FOREIGN KEY ("content_reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_outgoing_workflows" ADD CONSTRAINT "document_outgoing_workflows_format_reviewer_id_fkey" FOREIGN KEY ("format_reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_outgoing_workflows" ADD CONSTRAINT "document_outgoing_workflows_authorized_signer_id_fkey" FOREIGN KEY ("authorized_signer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_outgoing_workflows" ADD CONSTRAINT "document_outgoing_workflows_numberer_id_fkey" FOREIGN KEY ("numberer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_outgoing_workflows" ADD CONSTRAINT "document_outgoing_workflows_org_signer_id_fkey" FOREIGN KEY ("org_signer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_outgoing_workflows" ADD CONSTRAINT "document_outgoing_workflows_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_outgoing_workflows" ADD CONSTRAINT "document_outgoing_workflows_filed_by_id_fkey" FOREIGN KEY ("filed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_outgoing_workflows" ADD CONSTRAINT "document_outgoing_workflows_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_records" ADD CONSTRAINT "signature_records_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_records" ADD CONSTRAINT "signature_records_signer_user_id_fkey" FOREIGN KEY ("signer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_records" ADD CONSTRAINT "signature_records_signer_assignment_id_fkey" FOREIGN KEY ("signer_assignment_id") REFERENCES "position_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_catalog_items" ADD CONSTRAINT "job_catalog_items_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dacum_duties" ADD CONSTRAINT "dacum_duties_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dacum_duties" ADD CONSTRAINT "dacum_duties_job_catalog_item_id_fkey" FOREIGN KEY ("job_catalog_item_id") REFERENCES "job_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dacum_task_defs" ADD CONSTRAINT "dacum_task_defs_duty_id_fkey" FOREIGN KEY ("duty_id") REFERENCES "dacum_duties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizational_units" ADD CONSTRAINT "organizational_units_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "organizational_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_closure_paths" ADD CONSTRAINT "unit_closure_paths_ancestor_id_fkey" FOREIGN KEY ("ancestor_id") REFERENCES "organizational_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_closure_paths" ADD CONSTRAINT "unit_closure_paths_descendant_id_fkey" FOREIGN KEY ("descendant_id") REFERENCES "organizational_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_memberships" ADD CONSTRAINT "body_memberships_body_id_fkey" FOREIGN KEY ("body_id") REFERENCES "organizational_bodies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_memberships" ADD CONSTRAINT "body_memberships_position_assignment_id_fkey" FOREIGN KEY ("position_assignment_id") REFERENCES "position_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_memberships" ADD CONSTRAINT "body_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_definitions" ADD CONSTRAINT "position_definitions_dacum_job_catalog_id_fkey" FOREIGN KEY ("dacum_job_catalog_id") REFERENCES "job_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_assignments" ADD CONSTRAINT "position_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_assignments" ADD CONSTRAINT "position_assignments_position_definition_id_fkey" FOREIGN KEY ("position_definition_id") REFERENCES "position_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_assignments" ADD CONSTRAINT "position_assignments_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_assignments" ADD CONSTRAINT "portfolio_assignments_position_assignment_id_fkey" FOREIGN KEY ("position_assignment_id") REFERENCES "position_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_assignments" ADD CONSTRAINT "portfolio_assignments_responsibility_area_id_fkey" FOREIGN KEY ("responsibility_area_id") REFERENCES "responsibility_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation_grants" ADD CONSTRAINT "delegation_grants_grantor_assignment_id_fkey" FOREIGN KEY ("grantor_assignment_id") REFERENCES "position_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation_grants" ADD CONSTRAINT "delegation_grants_grantee_assignment_id_fkey" FOREIGN KEY ("grantee_assignment_id") REFERENCES "position_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation_grants" ADD CONSTRAINT "delegation_grants_responsibility_area_id_fkey" FOREIGN KEY ("responsibility_area_id") REFERENCES "responsibility_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation_scope_rules" ADD CONSTRAINT "delegation_scope_rules_delegation_grant_id_fkey" FOREIGN KEY ("delegation_grant_id") REFERENCES "delegation_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_actors" ADD CONSTRAINT "task_actors_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_actors" ADD CONSTRAINT "task_actors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_actors" ADD CONSTRAINT "task_actors_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organizational_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_actors" ADD CONSTRAINT "task_actors_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_approval_processes" ADD CONSTRAINT "task_approval_processes_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_approval_steps" ADD CONSTRAINT "task_approval_steps_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "task_approval_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_approval_steps" ADD CONSTRAINT "task_approval_steps_reviewer_assignment_id_fkey" FOREIGN KEY ("reviewer_assignment_id") REFERENCES "position_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_approval_steps" ADD CONSTRAINT "task_approval_steps_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_results" ADD CONSTRAINT "task_results_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_results" ADD CONSTRAINT "task_results_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_results" ADD CONSTRAINT "task_results_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_source_task_id_fkey" FOREIGN KEY ("source_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_target_task_id_fkey" FOREIGN KEY ("target_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_dossiers" ADD CONSTRAINT "work_dossiers_owning_unit_id_fkey" FOREIGN KEY ("owning_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_dossiers" ADD CONSTRAINT "work_dossiers_responsible_person_id_fkey" FOREIGN KEY ("responsible_person_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_dossiers" ADD CONSTRAINT "work_dossiers_retention_rule_id_fkey" FOREIGN KEY ("retention_rule_id") REFERENCES "retention_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_dossiers" ADD CONSTRAINT "work_dossiers_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_dossiers" ADD CONSTRAINT "work_dossiers_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_items" ADD CONSTRAINT "dossier_items_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "work_dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_items" ADD CONSTRAINT "dossier_items_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_body_id_fkey" FOREIGN KEY ("body_id") REFERENCES "organizational_bodies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organizational_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_resolutions" ADD CONSTRAINT "meeting_resolutions_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_resolutions" ADD CONSTRAINT "meeting_resolutions_lead_unit_id_fkey" FOREIGN KEY ("lead_unit_id") REFERENCES "organizational_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_resolutions" ADD CONSTRAINT "meeting_resolutions_lead_user_id_fkey" FOREIGN KEY ("lead_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_resolutions" ADD CONSTRAINT "meeting_resolutions_resulting_task_id_fkey" FOREIGN KEY ("resulting_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ====================================================================
-- QCET E-Office: Baseline Custom Constraints, Extensions & Indexes
-- Extracted from: check_constraints.sql, constraints.sql, indexes.sql
-- ====================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Domain Check Constraints
ALTER TABLE "tasks"
  ADD CONSTRAINT chk_tasks_progress_percent
  CHECK (progress_percent BETWEEN 0 AND 100);

ALTER TABLE "tasks"
  ADD CONSTRAINT chk_tasks_due_date_after_start_date
  CHECK (due_date IS NULL OR start_date IS NULL OR due_date >= start_date);

ALTER TABLE "push_subscriptions"
  ADD CONSTRAINT chk_push_subscriptions_failure_count
  CHECK (failure_count >= 0);

ALTER TABLE "outbox_events"
  ADD CONSTRAINT chk_outbox_events_attempts
  CHECK (attempts >= 0);

-- 3. Partial Unique Indexes
-- Enforce at most one PRIMARY_OWNER per task
CREATE UNIQUE INDEX IF NOT EXISTS task_assignees_one_primary_owner
  ON "task_assignees" ("task_id")
  WHERE "role_in_task" = 'PRIMARY_OWNER';

-- 4. Partial Performance Indexes
-- Active push subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active_user
  ON "push_subscriptions" ("user_id")
  WHERE "status" = 'ACTIVE';

-- Stale/failing push subscriptions cleanup
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_stale_cleanup
  ON "push_subscriptions" ("status", "failure_count", "disabled_at")
  WHERE "status" = 'REVOKED' OR "disabled_at" IS NOT NULL OR "failure_count" >= 5;

-- Unread notifications partial indexes
CREATE INDEX IF NOT EXISTS notification_unread_user_idx
  ON "notifications" ("user_id", "created_at" DESC)
  WHERE "read_at" IS NULL;

CREATE INDEX IF NOT EXISTS notification_unread_user_flag_idx
  ON "notifications" ("user_id", "created_at" DESC)
  WHERE "is_read" = false;

-- Active (non-archived) tasks partial index
CREATE INDEX IF NOT EXISTS idx_tasks_active_scope_status_due_date
  ON "tasks" ("scope", "status", "due_date")
  WHERE "archived_at" IS NULL;

-- Active (non-archived) documents partial index
CREATE INDEX IF NOT EXISTS idx_documents_active_type_status
  ON "documents" ("type", "status", "due_date")
  WHERE "archived_at" IS NULL;

-- 5. Full-Text Search (FTS) & Trigram (pg_trgm) Indexes
-- Tasks FTS and Trigram
CREATE INDEX IF NOT EXISTS task_title_description_fts_idx
  ON "tasks" USING gin (to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", '')));

CREATE INDEX IF NOT EXISTS task_title_trgm_idx
  ON "tasks" USING gin ("title" gin_trgm_ops);

-- Documents FTS and Trigram
CREATE INDEX IF NOT EXISTS document_title_fts_idx
  ON "documents" USING gin (to_tsvector('simple', coalesce("summary", '')));

CREATE INDEX IF NOT EXISTS document_summary_trgm_idx
  ON "documents" USING gin ("summary" gin_trgm_ops);

-- Users FTS and Trigram
CREATE INDEX IF NOT EXISTS user_name_email_fts_idx
  ON "users" USING gin (to_tsvector('simple', coalesce("name", '') || ' ' || coalesce("email", '') || ' ' || coalesce("title", '')));

CREATE INDEX IF NOT EXISTS user_name_trgm_idx
  ON "users" USING gin ("name" gin_trgm_ops);
