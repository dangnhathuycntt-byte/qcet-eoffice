/**
 * QCET E-Office — Organizational Body & Committee Governance Policy
 * Strictly enforces that creating institutional bodies, committees, or updating their
 * membership (CHAIR, VICE_CHAIR, SECRETARY, MEMBER) requires institutional leadership
 * (HIEU_TRUONG, PHO_HIEU_TRUONG) or System Administration (ADMIN).
 */

import type { AuthorizationContext } from '@/server/authorization/authorization-context';
import { isExecutiveAdministrator } from '@/server/authorization/delegation-policy';
import { ForbiddenError } from '@/server/api/errors';

/**
 * Checks if the caller has statutory authority to create or manage institutional bodies and committees.
 */
export function canManageOrganizationalBodies(context: AuthorizationContext): boolean {
  return isExecutiveAdministrator(context);
}

/**
 * Asserts that the caller has authority to manage organizational bodies, throwing ForbiddenError otherwise.
 */
export function assertCanManageOrganizationalBodies(context: AuthorizationContext): void {
  if (!canManageOrganizationalBodies(context)) {
    throw new ForbiddenError(
      'Chỉ Hiệu trưởng, Phó Hiệu trưởng hoặc Quản trị viên mới có quyền quản lý Hội đồng / Ban chỉ đạo'
    );
  }
}

/**
 * Asserts that the caller has statutory authority to appoint the specified member role.
 * Specifically prevents unauthorized self-appointment as CHAIR.
 */
export function assertCanAppointBodyMember(
  context: AuthorizationContext,
  targetUserId: string | undefined,
  targetRole: string
): void {
  assertCanManageOrganizationalBodies(context);

  if (targetRole === 'CHAIR' && targetUserId && targetUserId === context.user.id) {
    const isRector = context.positions.some((p) => p.positionCode === 'HIEU_TRUONG');
    if (!isRector && !context.isSystemAdmin() && context.user.role !== 'ADMIN') {
      throw new ForbiddenError(
        'Không được phép tự bổ nhiệm bản thân làm Chủ tịch hội đồng'
      );
    }
  }
}
