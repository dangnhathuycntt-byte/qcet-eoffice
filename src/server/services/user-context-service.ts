import { prisma } from '@/lib/prisma';
import {
  AssignmentStatus,
  DelegationStatus,
  UserRole,
} from '@prisma/client';
import { UserContextResponse } from '@/contracts/me';

export class UserContextService {
  /**
   * Retrieves the comprehensive institutional context for an authenticated user.
   */
  static async getUserContext(userId: string, now: Date = new Date()): Promise<UserContextResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        positionAssignments: {
          where: {
            status: AssignmentStatus.ACTIVE,
            effectiveFrom: { lte: now },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: now } },
            ],
          },
          include: {
            positionDefinition: true,
            unit: true,
            portfolios: {
              where: {
                effectiveFrom: { lte: now },
                OR: [
                  { effectiveTo: null },
                  { effectiveTo: { gte: now } },
                ],
              },
              include: {
                responsibilityArea: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // 1. Identity
    const identity = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      title: user.title,
      phone: user.phone,
      provider: user.provider,
    };

    // 2. Active assignments
    const activeAssignments = user.positionAssignments.map((pa) => ({
      id: pa.id,
      assignmentType: pa.type,
      isActing: pa.type === 'ACTING',
      effectiveFrom: pa.effectiveFrom.toISOString(),
      effectiveTo: pa.effectiveTo ? pa.effectiveTo.toISOString() : null,
      position: {
        id: pa.positionDefinition.id,
        code: pa.positionDefinition.code,
        title: pa.positionDefinition.title,
        category: pa.positionDefinition.group,
        dacumJobCatalogId: pa.positionDefinition.dacumJobCatalogId,
      },
      unit: {
        id: pa.unit.id,
        code: pa.unit.code,
        name: pa.unit.name,
        type: pa.unit.type,
      },
    }));

    // 3. Responsibility areas
    const areaMap = new Map<string, { id: string; code: string; name: string; description?: string | null }>();
    for (const pa of user.positionAssignments) {
      for (const portfolio of pa.portfolios) {
        const area = portfolio.responsibilityArea;
        if (!areaMap.has(area.id)) {
          areaMap.set(area.id, {
            id: area.id,
            code: area.code,
            name: area.name,
            description: area.description,
          });
        }
      }
    }
    const responsibilityAreas = Array.from(areaMap.values());

    // 4. Delegations
    const assignmentIds = user.positionAssignments.map((a) => a.id);
    const delegationGrants = await prisma.delegationGrant.findMany({
      where: {
        OR: [
          { granteeAssignmentId: { in: assignmentIds } },
          { grantorAssignmentId: { in: assignmentIds } },
        ],
        status: DelegationStatus.ACTIVE,
        revokedAt: null,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
      include: {
        grantorAssignment: {
          include: {
            user: true,
            positionDefinition: true,
          },
        },
        granteeAssignment: {
          include: {
            user: true,
            positionDefinition: true,
          },
        },
        responsibilityArea: true,
      },
    });

    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const delegations = delegationGrants.map((dg) => {
      const isGrantee = assignmentIds.includes(dg.granteeAssignmentId);
      const counterpart = isGrantee ? dg.grantorAssignment : dg.granteeAssignment;
      return {
        id: dg.id,
        direction: (isGrantee ? 'DELEGATED_TO_ME' : 'DELEGATED_BY_ME') as 'DELEGATED_TO_ME' | 'DELEGATED_BY_ME',
        status: dg.status,
        counterpartName: counterpart.user.name,
        counterpartPosition: counterpart.positionDefinition.title,
        capabilities: [dg.action],
        responsibilityAreas: dg.responsibilityArea ? [dg.responsibilityArea.name] : [],
        effectiveFrom: dg.validFrom.toISOString(),
        effectiveUntil: dg.validUntil.toISOString(),
        reason: dg.reason,
        isExpiringSoon: dg.validUntil <= sevenDaysLater,
      };
    });

    // 5. View Scopes & Technical capabilities
    const viewScopes: ('PERSONAL' | 'UNIT' | 'SCHOOL')[] = ['PERSONAL'];
    if (activeAssignments.length > 0 || user.departmentId) {
      viewScopes.push('UNIT');
    }

    const isSchoolLevel =
      user.role === UserRole.ADMIN ||
      user.role === UserRole.BAN_GIAM_HIEU ||
      activeAssignments.some(
        (a) =>
          a.position.code === 'PRINCIPAL' ||
          a.position.code === 'VICE_PRINCIPAL' ||
          a.unit.type === 'SCHOOL'
      );

    if (isSchoolLevel) {
      viewScopes.push('SCHOOL');
    }

    const technicalCapabilities: string[] = [];
    if (user.role === UserRole.ADMIN) {
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

    // Determine highest institutional position level
    let highestPositionLevel = 'CHUYEN_VIEN';
    if (activeAssignments.some((a) => a.position.code === 'PRINCIPAL' || a.position.code === 'VICE_PRINCIPAL')) {
      highestPositionLevel = 'BGH';
    } else if (activeAssignments.some((a) => a.position.code.startsWith('HEAD_') || a.position.code.startsWith('FACULTY_HEAD'))) {
      highestPositionLevel = 'TRUONG_DON_VI';
    } else if (activeAssignments.some((a) => a.position.code.startsWith('DEPUTY_'))) {
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
