/**
 * LEGACY DOCUMENT POLICY ADAPTER (Phase 0 / Sprint 2 Bridge)
 *
 * ARCHITECTURAL INVARIANTS & AUDIT COMPLIANCE:
 * 1. Statutory Separation:
 *    - Technical administration ('ADMIN') is strictly separated from statutory institutional
 *      leadership ('HIEU_TRUONG', 'PHO_HIEU_TRUONG').
 *    - 'ADMIN' is NOT treated as 'HIEU_TRUONG' / 'PHO_HIEU_TRUONG' for executive direction
 *      or statutory business authority (see canDirectDocument).
 * 2. Canonical Delegation:
 *    - `canReadDocument` delegates directly to `canAccessClassification()` from the canonical
 *      document classification authorization module (`src/server/authorization/document-classification.ts`).
 *    - Statutory document workflows (review, sign, issue, direct) in canonical services
 *      delegate to `authorize(context, action, resource)` in `src/server/authorization/authorization-engine.ts`.
 * 3. Role Equivalence Quarantine:
 *    - `normalizeRole` is quarantined here only for legacy query filtering and backwards-compatible
 *      API responses. It is NEVER exported or imported for new business authorization.
 */

import type { Prisma } from '@prisma/client';
import { type AuthenticatedUser, normalizeRole } from '@/server/api/request-context';
import type { AuthorizationContext } from '@/server/authorization/authorization-context';
import {
  canAccessClassification,
  type DocumentClassificationTarget,
} from '@/server/authorization/document-classification';
import { isDocumentImmutable } from '@/lib/documents/state-machine';

export interface DocumentEntity extends DocumentClassificationTarget {
  id: string;
  departmentId?: string | null;
  leadDepartmentId?: string | null;
  draftingDeptId?: string | null;
  creatorId?: string | null;
  registeredById?: string | null;
  leadUserId?: string | null;
  scope?: string | null;
  isPublic?: boolean | null;
  [key: string]: any;
}

export function isAdmin(user: AuthenticatedUser): boolean {
  return normalizeRole(user?.role) === 'ADMIN';
}

export function isManager(user: AuthenticatedUser): boolean {
  return normalizeRole(user?.role) === 'MANAGER';
}

export function isClerk(user: AuthenticatedUser): boolean {
  return normalizeRole(user?.role) === 'VAN_THU';
}

/**
 * Checks if user can read the specified document.
 * Strictly enforces canonical document classification policy (F15).
 * Removes automatic bypasses for ADMIN or CLERK on RESTRICTED or MAT/TOI_MAT/TUYET_MAT documents.
 */
export function canReadDocument(
  userOrContext: AuthenticatedUser | AuthorizationContext,
  doc: DocumentEntity | DocumentClassificationTarget
): boolean {
  if (!userOrContext || !doc) return false;
  return canAccessClassification(userOrContext as any, doc as any).allowed;
}

/**
 * Checks if user can create a document.
 */
export function canCreateDocument(user: AuthenticatedUser): boolean {
  return Boolean(user && user.id);
}

/**
 * Checks if user can update document metadata or content.
 */
export function canUpdateDocument(
  userOrContext: AuthenticatedUser | AuthorizationContext,
  doc: DocumentEntity
): boolean {
  if (!userOrContext || !doc) return false;
  if (!canReadDocument(userOrContext, doc)) return false;

  const user =
    'user' in (userOrContext as any) && (userOrContext as any).user
      ? (userOrContext as any).user
      : (userOrContext as AuthenticatedUser);
  const userId = (userOrContext as any).userId || user?.id;

  // Creator or registered user can update
  if (doc.creatorId && doc.creatorId === userId) return true;
  if (doc.registeredById && doc.registeredById === userId) return true;

  // Department manager of the document's department
  const deptId =
    (userOrContext as any).primaryUnitIds?.[0] || (user as any)?.departmentId;
  if (isManager(user as AuthenticatedUser) && deptId) {
    if (doc.departmentId && deptId === doc.departmentId) return true;
    if (doc.leadDepartmentId && deptId === doc.leadDepartmentId) return true;
    if (doc.draftingDeptId && deptId === doc.draftingDeptId) return true;
  }

  // Clerical staff (Văn thư) for internal registry handling
  if (isClerk(user as AuthenticatedUser)) {
    return true;
  }

  return false;
}

/**
 * Checks if user has authority to give executive direction / bút phê on the document.
 * Restricted strictly to BAN_GIAM_HIEU / HIEU_TRUONG and TRUONG_PHONG of the relevant department.
 * Technical administrators (SYSTEM_ADMIN) cannot give executive directions.
 */
export function canDirectDocument(
  userOrContext: AuthenticatedUser | AuthorizationContext,
  doc: DocumentEntity
): boolean {
  if (!userOrContext || !doc) return false;
  if (!canReadDocument(userOrContext, doc)) return false;

  const user =
    'user' in (userOrContext as any) && (userOrContext as any).user
      ? (userOrContext as any).user
      : (userOrContext as AuthenticatedUser);
  const deptId =
    (userOrContext as any).primaryUnitIds?.[0] || (user as any)?.departmentId;

  // Executive leadership check
  const roleUpper = ((user as any)?.role || '').toUpperCase();
  const posUpper = ((user as any)?.positionCode || '').toUpperCase();
  const isExecutive =
    roleUpper === 'BAN_GIAM_HIEU' ||
    roleUpper === 'HIEU_TRUONG' ||
    roleUpper === 'PHO_HIEU_TRUONG' ||
    posUpper === 'HIEU_TRUONG' ||
    posUpper === 'PHO_HIEU_TRUONG' ||
    (typeof (userOrContext as any).hasPosition === 'function' &&
      ((userOrContext as any).hasPosition('HIEU_TRUONG') ||
        (userOrContext as any).hasPosition('PHO_HIEU_TRUONG')));

  if (isExecutive) return true;

  if (isManager(user as AuthenticatedUser) && deptId) {
    if (doc.departmentId && deptId === doc.departmentId) return true;
    if (doc.leadDepartmentId && deptId === doc.leadDepartmentId) return true;
    if (doc.draftingDeptId && deptId === doc.draftingDeptId) return true;
  }

  return false;
}

/**
 * Checks if user can delete the document.
 */
export function canDeleteDocument(
  userOrContext: AuthenticatedUser | AuthorizationContext,
  doc: DocumentEntity
): boolean {
  if (!userOrContext || !doc) return false;
  // Immutable documents (signed, issued, completed, or archived) cannot be deleted
  if (isDocumentImmutable(doc as any)) return false;
  if (!canReadDocument(userOrContext, doc)) return false;

  const user =
    'user' in (userOrContext as any) && (userOrContext as any).user
      ? (userOrContext as any).user
      : (userOrContext as AuthenticatedUser);
  const userId = (userOrContext as any).userId || user?.id;

  if (doc.creatorId && doc.creatorId === userId) return true;
  if (doc.registeredById && doc.registeredById === userId) return true;

  const deptId =
    (userOrContext as any).primaryUnitIds?.[0] || (user as any)?.departmentId;
  if (isManager(user as AuthenticatedUser) && deptId) {
    if (doc.departmentId && deptId === doc.departmentId) return true;
    if (doc.leadDepartmentId && deptId === doc.leadDepartmentId) return true;
    if (doc.draftingDeptId && deptId === doc.draftingDeptId) return true;
  }

  return false;
}

/**
 * Builds the database-level Prisma WHERE clause for document access control (ACL)
 * enforcing Decree 30/2020 and institutional governance rules before pagination.
 *
 * Translates access predicates into Prisma.DocumentWhereInput:
 * - Public documents: school-level task linkage (scope: SCHOOL)
 * - Admin / Clerical / Leadership: (VAN_THU / ADMIN / BAN_GIAM_HIEU) can read all non-confidential documents
 * - Creator / Registered by: registeredById = user.id, or linkedTask createdById = user.id
 * - Lead user: leadUserId = user.id
 * - Department match: departmentId = user.departmentId (leadDepartmentId, draftingDeptId, directives, linkedTask)
 * - Handling confidential / restricted documents: securityLevel != TUYET_MAT
 */
export function buildDocumentReadWhere(
  userOrContext?: AuthenticatedUser | AuthorizationContext | null
): Prisma.DocumentWhereInput {
  if (!userOrContext) {
    return { id: '__DENY_ANONYMOUS__' };
  }

  const user =
    'user' in (userOrContext as any) && (userOrContext as any).user
      ? (userOrContext as any).user
      : (userOrContext as AuthenticatedUser);

  const userId = (userOrContext as any)?.userId || user?.id;
  if (!userId) {
    return { id: '__DENY_ANONYMOUS__' };
  }

  const role = normalizeRole(user?.role);
  const positionCode = ((user as any)?.positionCode || '').toUpperCase();
  const departmentId =
    (userOrContext as any)?.primaryUnitIds?.[0] || (user as any)?.departmentId || null;

  // 1. Handling confidential / restricted documents (classification != TUYET_MAT):
  // State secrets (TUYET_MAT) are strictly forbidden from regular document queries
  const nonConfidentialCondition: Prisma.DocumentWhereInput = {
    securityLevel: { not: 'TUYET_MAT' },
  };

  // 2. Admin / Clerical / Institutional Leadership:
  // (VAN_THU / ADMIN / BAN_GIAM_HIEU / HIEU_TRUONG / PHO_HIEU_TRUONG) can read all non-confidential documents
  const isPrivileged =
    role === 'ADMIN' ||
    role === 'VAN_THU' ||
    role === 'BAN_GIAM_HIEU' ||
    role === 'HIEU_TRUONG' ||
    role === 'PHO_HIEU_TRUONG' ||
    positionCode === 'HIEU_TRUONG' ||
    positionCode === 'PHO_HIEU_TRUONG';

  if (isPrivileged) {
    return nonConfidentialCondition;
  }

  // 3. Regular users: can access public, created/registered, lead officer, or unit-scoped documents
  const orConditions: Prisma.DocumentWhereInput[] = [
    // Registered by user (creator/registrar in Decree 30)
    { registeredById: userId },
    // Lead user assigned to the document
    { leadUserId: userId },
    // Linked school-level task (public / school-wide)
    { linkedTask: { is: { scope: 'SCHOOL' } } },
    // Linked task created by user
    { linkedTask: { is: { createdById: userId } } },
    // Directives issued by user
    { directives: { some: { leaderId: userId } } },
  ];

  if (departmentId) {
    orConditions.push(
      { leadDepartmentId: departmentId },
      { draftingDeptId: departmentId },
      { directives: { some: { assignedDeptId: departmentId } } },
      { linkedTask: { is: { departmentId: departmentId } } },
      { linkedTask: { is: { leadUnitId: departmentId } } }
    );
  }

  return {
    AND: [
      nonConfidentialCondition,
      { OR: orConditions },
    ],
  };
}

export const documentPolicy = {
  canReadDocument,
  canCreateDocument,
  canUpdateDocument,
  canDirectDocument,
  canDeleteDocument,
  buildDocumentReadWhere,
};
