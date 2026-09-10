/**
 * Domain Models, DTOs, and ViewModel Interfaces for Tasks in QCET E-Office.
 *
 * Strict Architectural Separation:
 * - Prisma DB Model: Raw database entities with generated relational structures.
 * - Domain Model: Pure encapsulated business entities with verified invariants, calculated flags, and domain rules.
 * - API DTO: Public-facing network transfer contracts stripped of internal secrets.
 * - UI ViewModel: Frontend display models tailored for ergonomics, tables, and views.
 */

import type { SchoolTask } from '@/types/dashboard';

// ============================================================================
// 1. DOMAIN MODELS (Internal Core Business Entities)
// ============================================================================

export type DomainTaskScope = 'SCHOOL' | 'DEPARTMENT' | 'INDIVIDUAL';

export type DomainTaskStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'WAITING_APPROVAL'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'CANCELLED';

export type DomainTaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type DomainAssigneeRole = 'PRIMARY_OWNER' | 'COLLABORATOR';

export type DomainDeliverableStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED';

export interface TaskAssigneeDomain {
  userId: string;
  roleInTask: DomainAssigneeRole;
  userName: string;
  userAvatar?: string | null;
}

export interface TaskDeliverableDomain {
  id: string;
  taskId: string;
  title: string;
  fileUrl: string;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  reviewStatus: DomainDeliverableStatus;
  reviewNote?: string | null;
  uploadedById?: string | null;
  uploadedByName?: string | null;
  createdAt: Date | string;
  submittedAt?: Date | string | null;
}

export interface TaskParentDomainSummary {
  id: string;
  code: string;
  title: string;
  scope?: string;
}

export interface TaskDomainModel {
  id: string;
  code: string;
  title: string;
  description: string | null;
  scope: DomainTaskScope;
  status: DomainTaskStatus;
  priority: DomainTaskPriority;
  progressPercent: number;
  dueDate: string;
  startDate?: string | null;
  completedAt?: string | null;
  academicMonth: number;
  academicYear: string;
  departmentId: string | null;
  departmentName?: string | null;
  departmentCode?: string | null;
  createdById: string;
  parentTaskId?: string | null;
  parentTask?: TaskParentDomainSummary | null;
  assignees: TaskAssigneeDomain[];
  primaryOwner: TaskAssigneeDomain | null;
  collaborators: TaskAssigneeDomain[];
  deliverables: TaskDeliverableDomain[];
  subTasks?: TaskDomainModel[];
  totalSubTasks: number;
  completedSubTasks: number;
  dacumTaskDefId?: string | null;
  dacumDutyId?: string | null;
  dacumDutyCode?: string | null;
  dacumTaskDefCode?: string | null;
  dacumTaskDefTitle?: string | null;
  isOverdue: boolean;
  requiresReview: boolean;
}

export interface TaskMetricsDomain {
  total: number;
  completed: number;
  inProgress: number;
  waitingApproval: number;
  overdue: number;
  cancelled: number;
  completionRate: number;
  referenceDate: string;
  isDenominatorSeparated: boolean;
}

// ============================================================================
// 2. API DATA TRANSFER OBJECTS (Public Network Contracts)
// ============================================================================

export interface TaskAssigneeDTO {
  userId: string;
  roleInTask: string;
  name: string;
  avatarUrl?: string | null;
}

export interface TaskDeliverableDTO {
  id: string;
  taskId?: string;
  title: string;
  fileUrl: string;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  reviewStatus: string;
  reviewNote?: string | null;
  uploadedById?: string | null;
  uploadedByName?: string | null;
  submittedAt?: string | null;
}

export interface TaskDTO {
  id: string;
  code: string;
  title: string;
  description: string | null;
  scope: string;
  status: string;
  priority: string;
  progressPercent: number;
  dueDate: string;
  startDate?: string | null;
  completedAt?: string | null;
  academicMonth: number;
  academicYear: string;
  departmentId: string | null;
  departmentName?: string | null;
  departmentCode?: string | null;
  createdById?: string;
  parentTaskId?: string | null;
  parentTask?: TaskParentDomainSummary | null;
  primaryOwner?: TaskAssigneeDTO | null;
  collaborators: TaskAssigneeDTO[];
  deliverables: TaskDeliverableDTO[];
  subTasks?: TaskDTO[];
  totalSubTasks: number;
  completedSubTasks: number;
  isOverdue: boolean;
  requiresReview: boolean;
}

export interface TaskMetricsDTO {
  total: number;
  completed: number;
  inProgress: number;
  waitingApproval: number;
  overdue: number;
  cancelled: number;
  completionRate: number;
  referenceDate: string;
  isDenominatorSeparated?: boolean;
}

export interface TaskPaginatedDTO<T = TaskDTO> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

// ============================================================================
// 3. UI VIEW MODEL (Frontend Ergonomics)
// ============================================================================

export type TaskViewModel = SchoolTask;
