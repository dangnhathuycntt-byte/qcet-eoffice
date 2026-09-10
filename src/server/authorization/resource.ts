/**
 * CANONICAL AUTHORIZATION RESOURCE TYPES FOR QCET E-OFFICE
 *
 * Invariants:
 * 1. Role Is Not Scope
 * 2. Typed resources for Meeting (F05), Document (F15), Task, System, Dossier
 * 3. Server truth and statutory institutional governance
 */

import type { CapabilityAction } from './capability';

export type DataClassification =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'RESTRICTED'
  | 'PERSONAL'
  | 'PERSONAL_DATA'
  | 'STATE_SECRET'
  | 'TUYET_MAT'
  | 'TOI_MAT'
  | 'MAT'
  | 'THUONG';

export type InstitutionalPositionCode =
  | 'HIEU_TRUONG'
  | 'PHO_HIEU_TRUONG'
  | 'PHO_HIEU_TRUONG_DT'
  | 'PHO_HIEU_TRUONG_HC'
  | 'TRUONG_DON_VI'
  | 'TRUONG_PHONG'
  | 'TRUONG_KHOA'
  | 'GIAM_DOC_TRUNG_TAM'
  | 'PHO_TRUONG_DON_VI'
  | 'PHO_TRUONG_PHONG'
  | 'PHO_TRUONG_KHOA'
  | 'PHO_GIAM_DOC_TRUNG_TAM'
  | 'GIANG_VIEN_CHUYEN_VIEN'
  | 'CHUYEN_VIEN'
  | 'GIANG_VIEN'
  | 'VAN_THU'
  | 'LUU_TRU'
  | 'QUAN_TRI_HE_THONG'
  | string;

export type InstitutionalPortfolioCode =
  | 'ACADEMIC'
  | 'TRAINING'
  | 'ADMINISTRATION_LOGISTICS'
  | 'INSTITUTIONAL_STRATEGY'
  | 'FINANCE'
  | 'POLITICAL_STUDENT'
  | 'SCIENTIFIC_RESEARCH'
  | string;

export type ResourceRelationship =
  | 'ASSIGNER'
  | 'LEAD_UNIT'
  | 'DRI' // Directly Responsible Individual / Primary Owner
  | 'COLLABORATOR'
  | 'FOLLOWER'
  | 'REVIEWER'
  | 'APPROVER'
  | 'OBSERVER'
  | 'CHAIR'
  | 'SECRETARY'
  | 'PARTICIPANT'
  | 'ORGANIZER'
  | 'BODY_MEMBER'
  | 'DRAFTER'
  | 'SIGNER'
  | 'NUMBERER';

export type RejectionCode =
  | 'UNAUTHENTICATED'
  | 'DEACTIVATED_ACCOUNT'
  | 'SEPARATION_OF_POWERS_VIOLATION'
  | 'STATE_SECRET_STRICT_PROHIBITION'
  | 'CLASSIFICATION_DENIED'
  | 'PERSONAL_DATA_PRIVACY_BREACH'
  | 'SOD_VIOLATION'
  | 'SEPARATION_OF_DUTIES_VIOLATION'
  | 'PORTFOLIO_MISMATCH'
  | 'DELEGATION_EXPIRED'
  | 'DELEGATION_REVOKED'
  | 'NON_DELEGABLE_POWER_VIOLATION'
  | 'SINGLE_DRI_VIOLATION'
  | 'COLLABORATOR_CANNOT_REASSIGN_DRI'
  | 'DEPARTMENT_BOUNDARY_VIOLATION'
  | 'UNIT_SCOPE_DENIED'
  | 'INSUFFICIENT_RELATIONSHIP'
  | 'INSUFFICIENT_CAPABILITY'
  | 'INVALID_WORKFLOW_STATE';

export interface AuditRecord {
  actorId: string;
  action: CapabilityAction;
  resourceType: string;
  resourceId?: string;
  timestamp: Date;
  decision: 'ALLOW' | 'DENY';
  rejectionCode?: RejectionCode;
  policyMatched?: string;
  ipAddress?: string;
}

export interface AuthorizationResult {
  allowed: boolean;
  granted: boolean;
  reason: string;
  rejectionCode?: RejectionCode;
  statusCode: RejectionCode | 'GRANTED';
  delegationUsed?: string;
  actingPositionId?: string;
  auditRecord: AuditRecord;
  delegationContext?: {
    isDelegated: boolean;
    delegationGrantId?: string;
    sourceDocument?: string;
    grantorId?: string;
  };
}

export interface BaseAuthorizationResource {
  id?: string;
  type: string;
  classification?: DataClassification;
  securityLevel?: string;
  status?: string;
  portfolio?: InstitutionalPortfolioCode;
  scope?: string;
  unitId?: string;
  leadUnitId?: string;
  draftingUnitId?: string;
  departmentId?: string;
  leadDepartmentId?: string;
  draftingDeptId?: string;
  owningUnitId?: string;
  bodyId?: string;
  organizerId?: string;
  participantIds?: string[];
  chairIds?: string[];
  secretaryIds?: string[];
  creatorId?: string;
  createdById?: string;
  assignerId?: string;
  drafterId?: string;
  draftingUserId?: string;
  registeredById?: string;
  signerId?: string;
  authorizedSignerId?: string;
  signerName?: string;
  numbererId?: string;
  formatReviewerId?: string;
  reviewerIds?: string[];
  approverIds?: string[];
  primaryOwnerId?: string; // Single DRI
  leadUserId?: string;
  assigneeIds?: string[];
  collaboratorIds?: string[];
  followerIds?: string[];
  observerIds?: string[];
  targetUserId?: string;
  submittedByUserId?: string;
  uploadedById?: string;
  dossierOwnerId?: string;
  archivistId?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MeetingResource extends BaseAuthorizationResource {
  type: 'meeting';
  id: string;
  organizerId?: string;
  unitId?: string;
  bodyId?: string;
  participantIds?: string[];
  chairIds?: string[];
  secretaryIds?: string[];
  status?: string;
  classification?: DataClassification;
}

export interface DocumentResource extends BaseAuthorizationResource {
  type: 'document' | 'document_incoming' | 'document_outgoing';
  id: string;
  classification?: DataClassification;
  securityLevel?: string;
  leadUnitId?: string;
  draftingUnitId?: string;
  creatorId?: string;
  drafterId?: string;
  registeredById?: string;
  signerId?: string;
  numbererId?: string;
  status?: string;
}

export interface TaskResource extends BaseAuthorizationResource {
  type: 'task';
  id: string;
  creatorId?: string;
  leadUnitId?: string;
  primaryOwnerId?: string; // Single DRI
  assigneeIds?: string[];
  reviewerIds?: string[];
  approverIds?: string[];
  status?: string;
  portfolio?: InstitutionalPortfolioCode;
}

export interface SystemResource extends BaseAuthorizationResource {
  type: 'system';
  id?: string;
}

export interface DossierResource extends BaseAuthorizationResource {
  type: 'dossier';
  id: string;
}

export type GenericAuthorizationResource = BaseAuthorizationResource;

export type AuthorizationResource = BaseAuthorizationResource;
