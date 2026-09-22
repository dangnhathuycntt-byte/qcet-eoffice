/**
 * User Directory & Personal Data Visibility Policy
 *
 * Statutory & Governance Reference:
 * - Decree 13/2023/ND-CP on Personal Data Protection
 * - RFC-08: User Directory Visibility Policy (ACCEPTED 2026-09-22)
 * - ADR-002: ReBAC Contextual Authorization & Separation of Powers
 *
 * Invariants:
 * 1. Tier 1 (Public Institutional): Open institution-wide to all authenticated users.
 * 2. Tier 2 (Operational Contact): Open institution-wide when confirmed as institutional work contact.
 * 3. Tier 3 (Protected Personal Data): Default hidden. Accessible ONLY via contextual capability
 *    and authorized scope (Self, Institutional Leadership, or Direct Unit Management).
 *    Legacy Data Invariant: `User.phone` is mixed-classification data and MUST remain
 *    protected by default as Tier 3 until a schema migration separates workPhone and personalPhone.
 * 4. Tier 4 (Statutory HR Data): Never exposed through the Directory API under any circumstances.
 * 5. Separation of Powers: Technical Administrator (SYSTEM_ADMIN) technical privilege must not
 *    silently become business authority to view personal data.
 */

import { type AuthenticatedUser, normalizeRole } from '@/server/api/request-context';
import type { AuthorizationContext } from '@/server/authorization/authorization-context';

export interface TargetUserDescriptor {
  id: string;
  departmentId?: string | null;
  phone?: string | null;
  email?: string | null;
  [key: string]: any;
}

export interface DirectoryViewerContext {
  id?: string;
  userId?: string;
  role?: string;
  departmentId?: string | null;
  activeUnitId?: string | null;
  capabilities?: string[];
  positions?: Array<{ positionCode: string; unitId?: string | null; isLeadership?: boolean }>;
  isSystemAdmin?: boolean | (() => boolean);
  user?: {
    id?: string;
    role?: string;
    departmentId?: string | null;
  };
  primaryUnitIds?: string[];
  systemRoles?: string[];
  hasPosition?: (code: string) => boolean;
}

const INSTITUTIONAL_LEADER_ROLES = new Set([
  'BAN_GIAM_HIEU',
  'BGH',
  'HIEU_TRUONG',
  'PHO_HIEU_TRUONG',
]);

const UNIT_LEADER_ROLES = new Set([
  'MANAGER',
  'TRUONG_PHONG',
  'PHO_TRUONG_PHONG',
  'TRUONG_DON_VI',
  'TRUONG_KHOA',
  'PHO_TRUONG_KHOA',
  'GIAM_DOC_TRUNG_TAM',
  'PHO_GIAM_DOC_TRUNG_TAM',
]);

const SENSITIVE_CAPABILITIES = new Set([
  'user.personal.read_sensitive',
  'user.view_sensitive_personal_data',
]);

/**
 * Determine if an actor has authorized contextual capability and scope
 * to view protected personal data (Tier 3, including User.phone).
 */
export function canReadSensitivePersonalData(
  viewer: DirectoryViewerContext | AuthenticatedUser | AuthorizationContext | null | undefined,
  targetUser: TargetUserDescriptor | null | undefined
): boolean {
  if (!viewer || !targetUser) return false;

  const v = viewer as any;
  const viewerId: string | undefined = v.userId || v.id || v.user?.id;
  const targetId: string | undefined = targetUser.id;

  // 1. Self-access: An actor can always view their own personal profile data
  if (viewerId && targetId && viewerId === targetId) {
    return true;
  }

  // Extract roles and admin status
  const rawRole: string = (v.role || v.user?.role || '').trim().toUpperCase();
  const systemRoles: unknown = v.systemRoles;
  const isSysAdmin: boolean =
    rawRole === 'SYSTEM_ADMIN' ||
    (Array.isArray(systemRoles) && systemRoles.includes('SYSTEM_ADMIN')) ||
    (typeof v.isSystemAdmin === 'function'
      ? v.isSystemAdmin()
      : Boolean(v.isSystemAdmin));

  const positions: Array<{ positionCode?: string; unitId?: string | null; isLeadership?: boolean }> =
    Array.isArray(v.positions) ? v.positions : [];

  // Check institutional leadership
  const hasInstLeadershipRole = INSTITUTIONAL_LEADER_ROLES.has(rawRole);
  const hasInstLeadershipPos = positions.some((p) =>
    ['HIEU_TRUONG', 'PHO_HIEU_TRUONG', 'BAN_GIAM_HIEU', 'BGH'].includes(
      (p.positionCode || '').toUpperCase()
    )
  );
  const hasInstLeadershipMethod =
    typeof v.hasPosition === 'function' &&
    ['HIEU_TRUONG', 'PHO_HIEU_TRUONG', 'BAN_GIAM_HIEU', 'BGH'].some((code: string) =>
      v.hasPosition(code)
    );
  const isInstitutionalLeader =
    hasInstLeadershipRole || hasInstLeadershipPos || hasInstLeadershipMethod;

  // 2. Separation of Powers (ADR-002 Step 3 / RFC-08 §5.1):
  // Technical Administrator (SYSTEM_ADMIN) without statutory institutional leadership role
  // is strictly prohibited from viewing employee personal data.
  if (isSysAdmin && !isInstitutionalLeader) {
    return false;
  }

  // 3. Institutional Leadership Scope (BGH / Rectorate):
  // Granted institutional-wide access for emergency and statutory leadership.
  if (isInstitutionalLeader) {
    return true;
  }

  // 4. Capability Check:
  const capabilities: unknown = v.capabilities;
  const hasSensitiveCapability: boolean =
    Array.isArray(capabilities) &&
    capabilities.some((c: string) => SENSITIVE_CAPABILITIES.has(c));

  // 5. Unit Management Scope:
  // Unit leaders (Deans, Department Heads, Center Directors) may view personal data
  // ONLY for members within their own unit.
  const isUnitLeaderRole = UNIT_LEADER_ROLES.has(rawRole);
  const isUnitLeaderPos = positions.some(
    (p) =>
      UNIT_LEADER_ROLES.has((p.positionCode || '').toUpperCase()) ||
      p.isLeadership === true
  );
  const isUnitLeader = isUnitLeaderRole || isUnitLeaderPos;

  if (isUnitLeader || hasSensitiveCapability) {
    const viewerUnit: string | null | undefined =
      v.departmentId || v.activeUnitId || v.user?.departmentId;
    const targetUnit: string | null | undefined =
      targetUser.departmentId || targetUser.unitId;

    if (viewerUnit && targetUnit && viewerUnit === targetUnit) {
      return true;
    }

    // Check primaryUnitIds if available (e.g. from AuthorizationContext)
    const primaryUnitIds: unknown = v.primaryUnitIds;
    if (Array.isArray(primaryUnitIds) && targetUnit && primaryUnitIds.includes(targetUnit)) {
      return true;
    }

    // Check position-based unit ownership
    if (positions.length > 0 && targetUnit) {
      const managesTargetUnit = positions.some(
        (p) => p.unitId && p.unitId === targetUnit
      );
      if (managesTargetUnit) return true;
    }
  }

  // Default Deny: All other members (staff, colleagues, cross-unit peers)
  return false;
}

export const userDirectoryPolicy = {
  canReadSensitivePersonalData,
};
