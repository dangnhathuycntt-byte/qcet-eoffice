import { prisma } from '@/lib/prisma';
import {
  TaskStatus,
  TaskActorRole,
  IncomingDocumentStatus,
  OutgoingDocumentStatus,
  DossierStatus,
  DelegationStatus,
} from '@prisma/client';
import { ActionInboxItem, ActionInboxResponse } from '@/contracts/me';

export class ActionInboxService {
  /**
   * Derives a unified institutional Action Inbox tailored to the active user's roles and responsibilities.
   */
  static async getActionInbox(userId: string, now: Date = new Date()): Promise<ActionInboxResponse> {
    const items: ActionInboxItem[] = [];

    // Get user assignments to determine their organizational roles
    const userAssignments = await prisma.positionAssignment.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      include: {
        positionDefinition: true,
        unit: true,
      },
    });

    const isBGH = userAssignments.some(
      (a) => a.positionDefinition.code.startsWith('PRINCIPAL') || a.positionDefinition.code.startsWith('VICE_PRINCIPAL')
    );
    const unitHeadUnitIds = userAssignments
      .filter((a) => a.positionDefinition.code.startsWith('HEAD_') || a.positionDefinition.code.startsWith('FACULTY_HEAD'))
      .map((a) => a.unitId);
    const isClerk = userAssignments.some(
      (a) => a.positionDefinition.code.startsWith('CLERICAL_OFFICER') || a.positionDefinition.code.startsWith('ARCHIVIST')
    );
    const isArchivist = userAssignments.some((a) => a.positionDefinition.code.startsWith('ARCHIVIST'));

    // 1. TASKS: As DRI
    const driTasks = await prisma.task.findMany({
      where: {
        archivedAt: null,
        actors: {
          some: {
            userId,
            role: TaskActorRole.DRI,
          },
        },
        status: { in: [TaskStatus.IN_PROGRESS, TaskStatus.NOT_STARTED] },
      },
      select: {
        id: true,
        code: true,
        title: true,
        priority: true,
        dueDate: true,
        createdAt: true,
      },
      take: 20,
    });

    for (const t of driTasks) {
      items.push({
        id: `inbox-task-dri-${t.id}`,
        resourceType: 'TASK',
        resourceId: t.id,
        resourceCode: t.code,
        title: t.title,
        requiredAction: 'Cập nhật tiến độ hoặc nộp báo cáo kết quả',
        reasonWhyMe: 'Bạn là Cán bộ xử lý chính (DRI) của nhiệm vụ này',
        priority: (t.priority as any) || 'NORMAL',
        deadline: t.dueDate?.toISOString(),
        createdAt: t.createdAt.toISOString(),
        linkUrl: `/tasks/${t.id}`,
      });
    }

    // TASKS: Pending Review for Reviewers / Approvers or Unit Heads
    const reviewPendingTasks = await prisma.task.findMany({
      where: {
        archivedAt: null,
        status: TaskStatus.WAITING_APPROVAL,
        OR: [
          {
            actors: {
              some: {
                userId,
                role: { in: [TaskActorRole.REVIEWER, TaskActorRole.APPROVER] },
              },
            },
          },
          ...(unitHeadUnitIds.length > 0 ? [{ leadUnitId: { in: unitHeadUnitIds } }] : []),
          ...(isBGH ? [{ originLevel: 'SCHOOL' as any }] : []),
        ],
      },
      select: {
        id: true,
        code: true,
        title: true,
        priority: true,
        dueDate: true,
        createdAt: true,
      },
      take: 20,
    });

    for (const t of reviewPendingTasks) {
      items.push({
        id: `inbox-task-rev-${t.id}`,
        resourceType: 'TASK',
        resourceId: t.id,
        resourceCode: t.code,
        title: t.title,
        requiredAction: 'Đánh giá / Phê duyệt kết quả nhiệm vụ',
        reasonWhyMe: 'Báo cáo kết quả nhiệm vụ đang chờ bạn phê duyệt',
        priority: 'HIGH',
        deadline: t.dueDate?.toISOString(),
        createdAt: t.createdAt.toISOString(),
        linkUrl: `/tasks/${t.id}`,
      });
    }

    // 2. INCOMING DOCUMENTS
    // 2a. PRESENTED (For BGH)
    if (isBGH) {
      const presentedDocs = await prisma.documentIncomingWorkflow.findMany({
        where: {
          status: IncomingDocumentStatus.PRESENTED,
        },
        include: { document: true },
        take: 15,
      });

      for (const w of presentedDocs) {
        items.push({
          id: `inbox-doc-in-pres-${w.id}`,
          resourceType: 'INCOMING_DOCUMENT',
          resourceId: w.documentId,
          resourceCode: w.document.originalNumber || String(w.document.registrationNumber),
          title: w.document.summary,
          requiredAction: 'Ban hành chỉ đạo giao đơn vị chủ trì',
          reasonWhyMe: 'Văn bản đến đang chờ Ban Giám hiệu chỉ đạo xử lý',
          priority: 'URGENT',
          deadline: w.deadline?.toISOString(),
          createdAt: w.createdAt.toISOString(),
          classification: w.document.securityLevel as any,
          linkUrl: `/documents/incoming/${w.documentId}`,
        });
      }
    }

    // 2b. ASSIGNED_TO_LEAD_UNIT (For Unit Heads)
    if (unitHeadUnitIds.length > 0) {
      const unitDocs = await prisma.documentIncomingWorkflow.findMany({
        where: {
          status: IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT,
          leadUnitId: { in: unitHeadUnitIds },
        },
        include: { document: true },
        take: 15,
      });

      for (const w of unitDocs) {
        items.push({
          id: `inbox-doc-in-unit-${w.id}`,
          resourceType: 'INCOMING_DOCUMENT',
          resourceId: w.documentId,
          resourceCode: w.document.originalNumber || String(w.document.registrationNumber),
          title: w.document.summary,
          requiredAction: 'Phân công chuyên viên xử lý chính (DRI)',
          reasonWhyMe: 'Văn bản đến đã chuyển giao cho đơn vị bạn chủ trì',
          priority: 'HIGH',
          deadline: w.deadline?.toISOString(),
          createdAt: w.createdAt.toISOString(),
          classification: w.document.securityLevel as any,
          linkUrl: `/documents/incoming/${w.documentId}`,
        });
      }
    }

    // 2c. UNIT_ASSIGNED_PERSON / IN_PROGRESS (Directly assigned to user via UnitWorkAssignment)
    const myUnitAssignments = await prisma.unitWorkAssignment.findMany({
      where: {
        driUserId: userId,
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
      },
      include: {
        workflow: {
          include: { document: true },
        },
      },
      take: 15,
    });

    for (const ua of myUnitAssignments) {
      const w = ua.workflow;
      items.push({
        id: `inbox-doc-in-exec-${ua.id}`,
        resourceType: 'INCOMING_DOCUMENT',
        resourceId: w.documentId,
        resourceCode: w.document.originalNumber || String(w.document.registrationNumber),
        title: w.document.summary,
        requiredAction: 'Giải quyết và báo cáo kết quả văn bản',
        reasonWhyMe: 'Bạn là Chuyên viên xử lý chính (DRI) cho văn bản này',
        priority: 'NORMAL',
        deadline: ua.deadline?.toISOString() || w.deadline?.toISOString(),
        createdAt: ua.createdAt.toISOString(),
        classification: w.document.securityLevel as any,
        linkUrl: `/documents/incoming/${w.documentId}`,
      });
    }

    // 3. OUTGOING DOCUMENTS
    // 3a. CONTENT_REVIEW
    const contentReviewDocs = await prisma.documentOutgoingWorkflow.findMany({
      where: {
        status: OutgoingDocumentStatus.CONTENT_REVIEW,
        contentReviewerId: userId,
      },
      include: { document: true },
      take: 15,
    });

    for (const w of contentReviewDocs) {
      items.push({
        id: `inbox-doc-out-rev-${w.id}`,
        resourceType: 'OUTGOING_DOCUMENT',
        resourceId: w.documentId,
        resourceCode: w.document.originalNumber || 'DỰ THẢO',
        title: w.document.summary,
        requiredAction: 'Phê duyệt nội dung dự thảo văn bản đi',
        reasonWhyMe: 'Dự thảo văn bản đi đang chờ bạn phê duyệt nội dung',
        priority: 'HIGH',
        createdAt: w.createdAt.toISOString(),
        classification: w.document.securityLevel as any,
        linkUrl: `/documents/outgoing/${w.documentId}`,
      });
    }

    // 3b. FORMAT_CHECK & NUMBERED / ORGANIZATION_SIGN (Clerks)
    if (isClerk) {
      const formatCheckDocs = await prisma.documentOutgoingWorkflow.findMany({
        where: {
          status: {
            in: [
              OutgoingDocumentStatus.FORMAT_CHECK,
              OutgoingDocumentStatus.NUMBERED,
              OutgoingDocumentStatus.ORGANIZATION_SIGNED,
            ],
          },
        },
        include: { document: true },
        take: 15,
      });

      for (const w of formatCheckDocs) {
        const isFmt = w.status === OutgoingDocumentStatus.FORMAT_CHECK;
        items.push({
          id: `inbox-doc-out-clerk-${w.id}`,
          resourceType: 'OUTGOING_DOCUMENT',
          resourceId: w.documentId,
          resourceCode: w.document.originalNumber || 'CHỜ SỐ',
          title: w.document.summary,
          requiredAction: isFmt ? 'Kiểm tra thể thức văn bản đi' : 'Cấp số và ký số cơ quan',
          reasonWhyMe: isFmt ? 'Văn bản đi chờ Văn thư kiểm tra thể thức' : 'Văn bản đi đã ký duyệt, chờ Văn thư đóng dấu / cấp số',
          priority: 'URGENT',
          createdAt: w.createdAt.toISOString(),
          classification: w.document.securityLevel as any,
          linkUrl: `/documents/outgoing/${w.documentId}`,
        });
      }
    }

    // 3c. AUTHORIZED_SIGN (Signer or BGH)
    if (isBGH) {
      const signDocs = await prisma.documentOutgoingWorkflow.findMany({
        where: {
          status: OutgoingDocumentStatus.AUTHORIZED_SIGN,
        },
        include: { document: true },
        take: 15,
      });

      for (const w of signDocs) {
        items.push({
          id: `inbox-doc-out-sign-${w.id}`,
          resourceType: 'OUTGOING_DOCUMENT',
          resourceId: w.documentId,
          resourceCode: w.document.originalNumber || 'CHỜ KÝ',
          title: w.document.summary,
          requiredAction: 'Ký số văn bản đi',
          reasonWhyMe: 'Văn bản đi đã duyệt thể thức, chờ Lãnh đạo ký phát hành',
          priority: 'URGENT',
          createdAt: w.createdAt.toISOString(),
          classification: w.document.securityLevel as any,
          linkUrl: `/documents/outgoing/${w.documentId}`,
        });
      }
    }

    // 4. WORK DOSSIERS (Archivists)
    if (isArchivist || isClerk) {
      const submittedDossiers = await prisma.workDossier.findMany({
        where: {
          status: DossierStatus.SUBMITTED_TO_ARCHIVE,
        },
        take: 10,
      });

      for (const d of submittedDossiers) {
        items.push({
          id: `inbox-dossier-${d.id}`,
          resourceType: 'DOSSIER',
          resourceId: d.id,
          resourceCode: d.code,
          title: d.title,
          requiredAction: 'Thẩm định và tiếp nhận hồ sơ nộp lưu',
          reasonWhyMe: 'Hồ sơ công việc đã hoàn thành và được nộp lưu vào Lưu trữ cơ quan',
          priority: 'NORMAL',
          createdAt: d.createdAt.toISOString(),
          classification: d.classification,
          linkUrl: `/dossiers/${d.id}`,
        });
      }
    }

    // 5. DELEGATIONS Expiring Soon (Within 7 days)
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const assignmentIds = userAssignments.map((a) => a.id);
    const expiringDelegations = await prisma.delegationGrant.findMany({
      where: {
        OR: [
          { granteeAssignmentId: { in: assignmentIds } },
          { grantorAssignmentId: { in: assignmentIds } },
        ],
        status: DelegationStatus.ACTIVE,
        validUntil: { lte: sevenDaysLater, gte: now },
      },
      take: 10,
    });

    for (const dg of expiringDelegations) {
      items.push({
        id: `inbox-delegation-${dg.id}`,
        resourceType: 'DELEGATION',
        resourceId: dg.id,
        resourceCode: dg.sourceDocumentNumber,
        title: `Ủy quyền thực hiện hành vi: ${dg.action}`,
        requiredAction: 'Rà soát gia hạn hoặc chuẩn bị bàn giao',
        reasonWhyMe: `Ủy quyền sẽ hết hiệu lực vào ngày ${dg.validUntil.toLocaleDateString('vi-VN')}`,
        priority: 'HIGH',
        deadline: dg.validUntil.toISOString(),
        createdAt: dg.createdAt.toISOString(),
        linkUrl: `/organization/delegations/${dg.id}`,
      });
    }

    // Sort items: URGENT first, then by deadline/createdAt
    const priorityWeight: Record<string, number> = {
      URGENT: 4,
      HIGH: 3,
      NORMAL: 2,
      LOW: 1,
    };

    items.sort((a, b) => {
      const weightDiff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      if (weightDiff !== 0) return weightDiff;
      if (a.deadline && b.deadline) {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const urgentCount = items.filter((i) => i.priority === 'URGENT').length;

    return {
      total: items.length,
      urgentCount,
      items,
    };
  }
}
