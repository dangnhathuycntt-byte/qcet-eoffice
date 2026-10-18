import type { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { logAuditEvent, AuditAction, AuditEntityType } from '@/lib/db/audit';
import { NotFoundError } from '@/server/api/errors';
import type { AddBodyMembershipSchema, CreateOrganizationalBodySchema } from '@/contracts/meeting';

// Hội đồng, ban chỉ đạo, tổ công tác: danh sách, chi tiết, tạo mới và bổ nhiệm thành viên.

export async function listOrganizationalBodies({
  type,
  status,
}: {
  type: string | null;
  status: string | null;
}) {
  const where: any = {};
  if (type) where.type = type;
  if (status) where.status = status;

  return prisma.organizationalBody.findMany({
    where,
    include: {
      memberships: {
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
          positionAssignment: {
            include: {
              positionDefinition: true,
              unit: true,
            },
          },
        },
      },
      _count: {
        select: { meetings: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/** Tạo rồi ghi audit bằng client mặc định, không chung transaction. */
export async function createOrganizationalBody({
  input,
  actorId,
  requestId,
}: {
  input: z.infer<typeof CreateOrganizationalBodySchema>;
  actorId: string;
  requestId: string;
}) {
  const created = await prisma.organizationalBody.create({
    data: {
      code: input.code,
      name: input.name,
      type: input.type,
      establishedBy: input.establishedBy,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : undefined,
      effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : undefined,
      status: input.status,
    },
  });

  await logAuditEvent({
    actorId,
    action: AuditAction.ORGANIZATIONAL_BODY_CREATED,
    entityType: AuditEntityType.ORGANIZATIONAL_BODY,
    entityId: created.id,
    requestId,
    afterData: { code: created.code, name: created.name, type: created.type },
  });

  return created;
}

export async function getOrganizationalBodyDetail(id: string) {
  const body = await prisma.organizationalBody.findUnique({
    where: { id },
    include: {
      memberships: {
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
          positionAssignment: {
            include: {
              positionDefinition: true,
              unit: true,
            },
          },
        },
      },
      meetings: {
        orderBy: { startTime: 'desc' },
        take: 10,
      },
    },
  });

  if (!body) {
    throw new NotFoundError('Hội đồng / Ban chỉ đạo không tồn tại');
  }

  return body;
}

export async function assertOrganizationalBodyExists(id: string) {
  const existingBody = await prisma.organizationalBody.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existingBody) {
    throw new NotFoundError('Hội đồng / Ban chỉ đạo không tồn tại');
  }
}

/** Tạo membership rồi ghi audit bằng client mặc định, không chung transaction. */
export async function addBodyMembership({
  bodyId,
  input,
  actorId,
  requestId,
}: {
  bodyId: string;
  input: z.infer<typeof AddBodyMembershipSchema>;
  actorId: string;
  requestId: string;
}) {
  const membership = await prisma.bodyMembership.create({
    data: {
      bodyId,
      userId: input.userId,
      positionAssignmentId: input.positionAssignmentId,
      role: input.role,
      appointedAt: input.appointedAt ? new Date(input.appointedAt) : undefined,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    },
  });

  await logAuditEvent({
    actorId,
    action: AuditAction.ORGANIZATIONAL_BODY_MEMBERSHIP_ADDED,
    entityType: AuditEntityType.BODY_MEMBERSHIP,
    entityId: membership.id,
    requestId,
    afterData: { bodyId, userId: input.userId, role: input.role },
  });

  return membership;
}
