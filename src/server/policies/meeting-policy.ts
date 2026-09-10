/**
 * MEETING POLICY ADAPTER
 *
 * Enforces authorization boundaries for Meeting and Meeting Materials resources.
 * Supports AuthenticatedUser and AuthorizationContext.
 */

import { type AuthenticatedUser, normalizeRole } from '@/server/api/request-context';
import type { AuthorizationContext } from '@/server/authorization/authorization-context';

export interface MeetingEntity {
  id: string;
  unitId?: string | null;
  bodyId?: string | null;
  status?: string | null;
  organizerId?: string | null;
  participants?: Array<{
    userId?: string | null;
    user?: { id?: string | null; [key: string]: any } | null;
    role?: string | null;
    [key: string]: any;
  }> | null;
  body?: {
    memberships?: Array<{
      userId?: string | null;
      [key: string]: any;
    }>;
  } | null;
  [key: string]: any;
}

type UserLike = {
  id?: string;
  role?: string | null;
  activePositionCode?: string | null;
  positionCode?: string | null;
  departmentId?: string | null;
  [key: string]: any;
} | null | undefined;

function isAdmin(user: UserLike): boolean {
  if (!user || !user.role) return false;
  return normalizeRole(user.role) === 'ADMIN';
}

function isExecutive(user: UserLike): boolean {
  if (!user || !user.role) return false;
  const role = normalizeRole(user.role);
  return role === 'ADMIN' || role === 'BAN_GIAM_HIEU';
}

/**
 * Checks if user can view the specified meeting.
 */
export function canViewMeeting(
  userOrContext: AuthenticatedUser | AuthorizationContext,
  meeting: MeetingEntity
): boolean {
  if (!userOrContext || !meeting) return false;

  const isAuthContext = typeof (userOrContext as any).isSystemAdmin === 'function';
  const user = isAuthContext ? (userOrContext as AuthorizationContext).user : (userOrContext as AuthenticatedUser);
  const userId = isAuthContext ? (userOrContext as AuthorizationContext).userId : user?.id;

  if (!userId) return false;

  // 1. System Administrator
  if (isAuthContext && (userOrContext as AuthorizationContext).isSystemAdmin()) {
    return true;
  }
  if (isAdmin(user)) {
    return true;
  }

  // 2. Executive Leadership (sees all school meetings)
  if (isExecutive(user)) {
    return true;
  }
  if (isAuthContext) {
    const hasExecPosition = (userOrContext as AuthorizationContext).positions?.some((p) =>
      ['HIEU_TRUONG', 'PHO_HIEU_TRUONG', 'BAN_GIAM_HIEU'].includes(p.positionCode.toUpperCase())
    );
    if (hasExecPosition) return true;
  }

  // 3. Meeting Organizer
  if (meeting.organizerId && meeting.organizerId === userId) {
    return true;
  }

  // 4. Meeting Participants (Chair, Secretary, Attendee, Invited Guest)
  if (Array.isArray(meeting.participants)) {
    const isParticipant = meeting.participants.some(
      (p) => p.userId === userId || p.user?.id === userId
    );
    if (isParticipant) return true;
  }

  // 5. Organizational Body Members
  if (meeting.bodyId) {
    if (Array.isArray(meeting.body?.memberships)) {
      const isBodyMember = meeting.body.memberships.some((m) => m.userId === userId);
      if (isBodyMember) return true;
    }
    if (isAuthContext) {
      const isBodyMemberInCtx = (userOrContext as AuthorizationContext).bodyMemberships?.some(
        (bm) => bm.bodyId === meeting.bodyId
      );
      if (isBodyMemberInCtx) return true;
    }
  }

  // 6. Unit Boundary: Leaders and members of the meeting's organizing/hosting unit
  const userUnitId =
    (user as any)?.departmentId ||
    (user as any)?.activeUnitId ||
    (isAuthContext ? (userOrContext as AuthorizationContext).primaryUnitIds?.[0] : null);

  if (meeting.unitId && userUnitId && meeting.unitId === userUnitId) {
    return true;
  }

  if (isAuthContext && meeting.unitId) {
    const inUnit = (userOrContext as AuthorizationContext).primaryUnitIds?.includes(meeting.unitId);
    if (inUnit) return true;
  }

  // 7. Delegations
  if (isAuthContext) {
    const delegations = (userOrContext as AuthorizationContext).getActiveDelegationsForAction?.('meeting.read') || [];
    for (const d of delegations) {
      if (d.grantorPositionCode && ['HIEU_TRUONG', 'PHO_HIEU_TRUONG'].includes(d.grantorPositionCode)) {
        return true;
      }
      for (const rule of d.scopeRules || []) {
        if (rule.entityType === 'unit' && rule.entityId && rule.entityId === meeting.unitId) {
          return true;
        }
      }
    }
  }

  return false;
}

export const meetingPolicy = {
  canViewMeeting,
};
