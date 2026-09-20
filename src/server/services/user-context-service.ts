import { JobCatalogGroup } from '@prisma/client';
import { UserContextResponse } from '@/contracts/me';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { AuthorizationContext } from '@/server/authorization/authorization-context';

/**
 * Service providing the display context DTO for the current user.
 *
 * INSTITUTIONAL INVARIANT:
 * This context is strictly designed for client UI rendering (view scopes, menu items,
 * and display information).
 *
 * CRITICAL SECURITY INVARIANT:
 * Server mutations MUST NEVER trust client-provided context, roles, scopes,
 * or client.availableActions. All server-side mutations and privileged operations
 * MUST independently invoke the canonical authorization engine (AuthorizationContextService,
 * AuthorityResolutionService, and domain policies) with server database truth.
 */
export class UserContextService {
  /**
   * Retrieves the comprehensive institutional context for an authenticated user
   * by mapping the canonical AuthorizationContext to the UserContextResponse DTO.
   */
  static async getUserContext(userId: string, now: Date = new Date()): Promise<UserContextResponse> {
    const authContext = await loadAuthorizationContext(userId, now, { useCache: true, ttlMs: 10_000 });
    return this.mapToUserContextResponse(authContext, now);
  }

  /**
   * Maps canonical AuthorizationContext to the client UI response DTO.
   */
  static mapToUserContextResponse(authContext: AuthorizationContext, now: Date = new Date()): UserContextResponse {
    // 1. Identity
    const identity = {
      id: authContext.user.id,
      name: authContext.user.name,
      email: authContext.user.email,
      avatarUrl: authContext.user.avatarUrl ?? null,
      title: authContext.user.title ?? null,
      phone: authContext.user.phone ?? null,
      provider: authContext.user.provider ?? 'credentials',
    };

    // 2. Active assignments
    const activeAssignments = authContext.positions.map((pa) => ({
      id: pa.id,
      assignmentType: pa.type,
      isActing: pa.isActing,
      effectiveFrom: pa.effectiveFrom.toISOString(),
      effectiveTo: pa.effectiveTo ? pa.effectiveTo.toISOString() : null,
      position: {
        id: pa.positionDefinitionId,
        code: pa.positionCode,
        title: pa.positionTitle,
        category: pa.positionGroup ?? JobCatalogGroup.VCMN,
        isLeadership: pa.isLeadership,
        positionLevel: pa.positionLevel,
      },
      unit: {
        id: pa.unitId,
        code: pa.unitCode,
        name: pa.unitName,
        type: pa.unitType,
      },
    }));

    // 3. Responsibility areas
    const responsibilityAreas = authContext.responsibilityAreas.map((ra) => ({
      id: ra.id,
      code: ra.code,
      name: ra.name,
      description: ra.description ?? null,
      category: ra.category,
    }));

    // 4. Delegations
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const delegations = authContext.delegations.map((d) => {
      const isGrantee = d.granteeUserId === authContext.userId;
      const counterpartName = isGrantee
        ? (d.grantorName || 'Cán bộ ủy quyền')
        : (d.granteeName || 'Cán bộ nhận ủy quyền');
      const counterpartPosition = isGrantee
        ? (d.grantorPositionTitle || d.grantorPositionCode || '')
        : (d.granteePositionTitle || d.granteePositionCode || '');

      return {
        id: d.id,
        direction: (isGrantee ? 'DELEGATED_TO_ME' : 'DELEGATED_BY_ME') as 'DELEGATED_TO_ME' | 'DELEGATED_BY_ME',
        status: d.status,
        counterpartName,
        counterpartPosition,
        capabilities: [d.action],
        responsibilityAreas: d.responsibilityArea ? [d.responsibilityArea.name] : [],
        effectiveFrom: d.validFrom.toISOString(),
        effectiveUntil: d.validUntil.toISOString(),
        reason: d.reason ?? null,
        isExpiringSoon: d.validUntil <= sevenDaysLater,
      };
    });

    // 5. View scopes
    // Invariant: Role Is Not Scope. Scope is visual display and query aggregation only.
    const viewScopes: ('PERSONAL' | 'UNIT' | 'SCHOOL')[] = ['PERSONAL'];
    if (activeAssignments.length > 0 || authContext.primaryUnitIds.length > 0 || authContext.user.departmentId) {
      viewScopes.push('UNIT');
    }

    const isSchoolLevel =
      authContext.isSystemAdmin() ||
      authContext.hasLeadershipPosition() ||
      authContext.positions.some(
        (p) =>
          p.positionCode === 'PRINCIPAL' ||
          p.positionCode.startsWith('PRINCIPAL_') ||
          p.positionCode === 'VICE_PRINCIPAL' ||
          p.positionCode.startsWith('VICE_PRINCIPAL_') ||
          p.positionCode.startsWith('HIEU_TRUONG') ||
          p.positionCode.startsWith('PHO_HIEU_TRUONG') ||
          p.unitType === 'SCHOOL'
      );

    if (isSchoolLevel) {
      viewScopes.push('SCHOOL');
    }

    // 6. Technical capabilities
    // Strict separation: SYSTEM_ADMIN gets technical admin capabilities, never institutional authority
    const technicalCapabilities: string[] = [];
    if (authContext.isSystemAdmin()) {
      technicalCapabilities.push(
        'SYSTEM_ADMIN',
        'account.manage',
        'system.configure',
        'audit.read',
        'integration.manage'
      );
    } else {
      technicalCapabilities.push('task.read', 'document.read');
    }

    // 7. Highest position level (UI indicator)
    let highestPositionLevel = 'CHUYEN_VIEN';
    if (
      authContext.positions.some(
        (p) =>
          p.positionCode === 'PRINCIPAL' ||
          p.positionCode.startsWith('PRINCIPAL_') ||
          p.positionCode === 'VICE_PRINCIPAL' ||
          p.positionCode.startsWith('VICE_PRINCIPAL_') ||
          p.positionCode.startsWith('HIEU_TRUONG') ||
          p.positionCode.startsWith('PHO_HIEU_TRUONG')
      )
    ) {
      highestPositionLevel = 'BGH';
    } else if (
      authContext.positions.some(
        (p) =>
          p.positionCode.startsWith('HEAD_') ||
          p.positionCode.startsWith('FACULTY_HEAD') ||
          p.positionCode.startsWith('TRUONG_')
      )
    ) {
      highestPositionLevel = 'TRUONG_DON_VI';
    } else if (
      authContext.positions.some(
        (p) =>
          p.positionCode.startsWith('DEPUTY_') ||
          p.positionCode.startsWith('PHO_')
      )
    ) {
      highestPositionLevel = 'PHO_DON_VI';
    }

    return {
      identity,
      activeAssignments,
      viewScopes,
      responsibilityAreas,
      technicalCapabilities,
      delegations,
      highestPositionLevel,
    };
  }
}
