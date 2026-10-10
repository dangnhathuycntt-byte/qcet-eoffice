/**
 * Trả lại và chuyển lại văn bản đến cho đơn vị khác (V-01, spec task-document-gap-spec.md).
 *
 * - Đơn vị chủ trì (trưởng đơn vị) trả lại kèm lý do khi văn bản chuyển nhầm. Văn bản về
 *   DIRECTED, không còn đơn vị chủ trì, chờ Văn thư chuyển cho đơn vị khác. Chỉ trả lại được
 *   khi chưa sinh nhiệm vụ liên kết.
 * - Văn thư chuyển lại cho đơn vị khác: văn bản về ASSIGNED_TO_LEAD_UNIT với đơn vị mới.
 * - Lịch sử không bị xóa: mỗi lần trả lại là một bản ghi DocumentUnitReturn; phân công người
 *   thụ lý đang mở chuyển sang CANCELLED (đúng từ vựng "hủy phân công hoặc chuyển đơn vị khác").
 */
import { z } from "zod";
import { IncomingDocumentStatus, Prisma, UnitStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertAuthorized,
  HybridAuthorizationError,
  type AuthenticatedUserContext,
  type AuthorizationResource,
} from "@/lib/auth/hybrid-authorization";
import { auditService, AuditAction, AuditEntityType } from "@/lib/db/audit";
import { publishOutboxEvent, OutboxEventType, OutboxAggregateType } from "@/lib/db/outbox";
import { ConflictError, NotFoundError, ValidationError } from "@/server/api/errors";
import type { SessionPayload } from "@/lib/jwt-session";
import type { AuthenticatedUser } from "@/server/api/request-context";
import {
  IncomingDocumentStateMachine,
  mapIncomingWorkflowStatusToDocumentStatus,
} from "@/lib/documents/state-machine";
import {
  UnitWorkAssignmentStatusValues,
  assertUnitAssignmentTransition,
  isValidUnitWorkAssignmentStatus,
} from "@/domain/documents/unit-assignment-status";
import { resolveUserContext } from "@/lib/services/incoming-document-service";

type Actor = AuthenticatedUserContext | SessionPayload | AuthenticatedUser;

export const ReturnDocumentSchema = z
  .object({ reason: z.string().trim().min(3, "Lý do trả lại tối thiểu 3 ký tự").max(1000, "Lý do tối đa 1000 ký tự") })
  .strict();

export const RerouteDocumentSchema = z
  .object({
    leadUnitId: z.string().trim().min(1, "Cần chọn đơn vị nhận"),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

export type ReturnDocumentInput = z.infer<typeof ReturnDocumentSchema>;
export type RerouteDocumentInput = z.infer<typeof RerouteDocumentSchema>;

/** Trạng thái được trả lại: đã giao đơn vị chủ trì, chưa sinh nhiệm vụ. */
const RETURNABLE: ReadonlySet<IncomingDocumentStatus> = new Set([
  IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT,
  IncomingDocumentStatus.UNIT_ASSIGNED_PERSON,
]);

const READ_COMMITTED = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted } as const;

async function lockWorkflow(tx: Prisma.TransactionClient, workflowId: string): Promise<IncomingDocumentStatus> {
  const rows = await tx.$queryRaw<{ status: string }[]>`
    SELECT status FROM document_incoming_workflows WHERE id = ${workflowId} FOR UPDATE
  `;
  if (!rows.length) {
    throw new ConflictError("Không tìm thấy quy trình văn bản để khoá.", "DOCUMENT_WORKFLOW_NOT_FOUND");
  }
  return rows[0].status as IncomingDocumentStatus;
}

export async function returnIncomingDocument(
  documentId: string,
  input: ReturnDocumentInput,
  actor: Actor,
  requestId?: string
) {
  const validated = ReturnDocumentSchema.parse(input);
  const user = await resolveUserContext(actor);

  const doc = await prisma.document.findUnique({ where: { id: documentId }, include: { incomingWorkflow: true } });
  const workflow = doc?.incomingWorkflow;
  if (!doc || !workflow) throw new NotFoundError("Không tìm thấy văn bản đến hoặc quy trình xử lý liên quan.");

  const fromUnitId = workflow.leadUnitId;
  if (!fromUnitId) throw new ValidationError("Văn bản chưa có đơn vị chủ trì để trả lại.");

  const resource: AuthorizationResource = {
    id: doc.id,
    type: "document_incoming",
    scope: "DEPARTMENT",
    leadDepartmentId: fromUnitId,
    departmentId: fromUnitId,
    securityLevel: doc.securityLevel || "NORMAL",
  };
  await assertAuthorized(user, "document.incoming.return", resource);

  // Chỉ trưởng đơn vị đang là đơn vị chủ trì (hoặc lãnh đạo, quản trị) được trả lại.
  const isExecutiveOrAdmin =
    user.systemRole === "SYSTEM_ADMIN" ||
    user.systemRole === "ADMIN" ||
    user.activePositionCode === "HIEU_TRUONG" ||
    user.activePositionCode === "PHO_HIEU_TRUONG";
  if (!isExecutiveOrAdmin && user.departmentId !== fromUnitId) {
    throw new HybridAuthorizationError(
      "Trưởng đơn vị chỉ có quyền trả lại văn bản của đơn vị mình phụ trách.",
      "DEPARTMENT_BOUNDARY_VIOLATION",
      "document.incoming.return",
      doc.id,
      403
    );
  }

  if (!RETURNABLE.has(workflow.status)) {
    throw new ConflictError("Văn bản không ở bước có thể trả lại cho Văn thư.", "DOCUMENT_NOT_RETURNABLE");
  }
  if (doc.linkedTaskId) {
    throw new ConflictError(
      "Văn bản đã sinh nhiệm vụ liên kết nên không trả lại được. Xử lý hoặc hủy nhiệm vụ trước.",
      "DOCUMENT_RETURN_TASK_EXISTS"
    );
  }

  return prisma.$transaction(async (tx) => {
    const lockedStatus = await lockWorkflow(tx, workflow.id);
    if (lockedStatus !== workflow.status) {
      throw new ConflictError("Quy trình văn bản vừa được thay đổi. Hãy tải lại.", "DOCUMENT_WORKFLOW_CONFLICT");
    }
    IncomingDocumentStateMachine.assertTransition(lockedStatus, IncomingDocumentStatus.DIRECTED, doc.id);

    const claim = await tx.documentIncomingWorkflow.updateMany({
      where: { id: workflow.id, status: lockedStatus },
      data: { status: IncomingDocumentStatus.DIRECTED, leadUnitId: null },
    });
    if (claim.count !== 1) {
      throw new ConflictError("Quy trình văn bản vừa được thay đổi. Hãy tải lại.", "DOCUMENT_WORKFLOW_CONFLICT");
    }

    // Phân công người thụ lý đang mở thì hủy, giữ bản ghi để lưu lịch sử.
    const open = await tx.unitWorkAssignment.findMany({
      where: { workflowId: workflow.id, status: { in: [UnitWorkAssignmentStatusValues.ASSIGNED, UnitWorkAssignmentStatusValues.IN_PROGRESS] } },
    });
    for (const assignment of open) {
      if (isValidUnitWorkAssignmentStatus(assignment.status)) {
        assertUnitAssignmentTransition(assignment.status, UnitWorkAssignmentStatusValues.CANCELLED, assignment.id);
      }
    }
    if (open.length > 0) {
      await tx.unitWorkAssignment.updateMany({
        where: { id: { in: open.map((a) => a.id) } },
        data: { status: UnitWorkAssignmentStatusValues.CANCELLED },
      });
    }

    await tx.document.update({
      where: { id: doc.id },
      data: {
        leadUserId: null,
        status: mapIncomingWorkflowStatusToDocumentStatus(IncomingDocumentStatus.DIRECTED),
      },
    });

    const record = await tx.documentUnitReturn.create({
      data: { documentId: doc.id, fromUnitId, returnedById: user.id, reason: validated.reason },
    });

    await auditService.logEvent(tx, {
      actorId: user.id,
      action: AuditAction.DOCUMENT_RETURNED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: doc.id,
      requestId,
      beforeData: { status: lockedStatus, leadUnitId: fromUnitId },
      afterData: { status: IncomingDocumentStatus.DIRECTED, returnId: record.id, reason: validated.reason },
      metadata: { documentId: doc.id, workflowId: workflow.id },
    });

    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.DOCUMENT_RETURNED_NOTIFICATION,
      aggregateType: OutboxAggregateType.DOCUMENT,
      aggregateId: doc.id,
      payload: { documentId: doc.id, returnId: record.id, fromUnitId, returnedById: user.id, reason: validated.reason },
    });

    return { returnId: record.id, documentId: doc.id, status: IncomingDocumentStatus.DIRECTED, cancelledAssignments: open.length };
  }, READ_COMMITTED);
}

export async function rerouteIncomingDocument(
  documentId: string,
  input: RerouteDocumentInput,
  actor: Actor,
  requestId?: string
) {
  const validated = RerouteDocumentSchema.parse(input);
  const user = await resolveUserContext(actor);

  const doc = await prisma.document.findUnique({ where: { id: documentId }, include: { incomingWorkflow: true } });
  const workflow = doc?.incomingWorkflow;
  if (!doc || !workflow) throw new NotFoundError("Không tìm thấy văn bản đến hoặc quy trình xử lý liên quan.");

  await assertAuthorized(user, "document.incoming.reroute", {
    id: doc.id,
    type: "document_incoming",
    scope: "SCHOOL",
    securityLevel: doc.securityLevel || "NORMAL",
  });

  const open = await prisma.documentUnitReturn.findFirst({
    where: { documentId: doc.id, resolvedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (workflow.status !== IncomingDocumentStatus.DIRECTED || !open) {
    throw new ConflictError("Văn bản không ở trạng thái chờ chuyển lại đơn vị khác.", "DOCUMENT_NOT_AWAITING_REROUTE");
  }
  if (validated.leadUnitId === open.fromUnitId) {
    throw new ValidationError("Đơn vị này vừa trả lại văn bản. Chọn đơn vị khác.");
  }

  const unit = await prisma.organizationalUnit.findUnique({
    where: { id: validated.leadUnitId },
    select: { id: true, status: true },
  });
  if (!unit) throw new NotFoundError("Không tìm thấy đơn vị nhận");
  if (unit.status !== UnitStatus.ACTIVE) throw new ValidationError("Đơn vị nhận không còn hoạt động");

  return prisma.$transaction(async (tx) => {
    const lockedStatus = await lockWorkflow(tx, workflow.id);
    IncomingDocumentStateMachine.assertTransition(lockedStatus, IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT, doc.id);

    const closed = await tx.documentUnitReturn.updateMany({
      where: { id: open.id, resolvedAt: null },
      data: {
        resolvedAt: new Date(),
        toUnitId: unit.id,
        reroutedById: user.id,
        rerouteNote: validated.note || null,
      },
    });
    if (closed.count !== 1) {
      throw new ConflictError("Văn bản vừa được chuyển bởi người khác. Hãy tải lại.", "DOCUMENT_WORKFLOW_CONFLICT");
    }

    const claim = await tx.documentIncomingWorkflow.updateMany({
      where: { id: workflow.id, status: IncomingDocumentStatus.DIRECTED },
      data: { status: IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT, leadUnitId: unit.id },
    });
    if (claim.count !== 1) {
      throw new ConflictError("Quy trình văn bản vừa được thay đổi. Hãy tải lại.", "DOCUMENT_WORKFLOW_CONFLICT");
    }

    await tx.document.update({
      where: { id: doc.id },
      data: { status: mapIncomingWorkflowStatusToDocumentStatus(IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT) },
    });

    await auditService.logEvent(tx, {
      actorId: user.id,
      action: AuditAction.DOCUMENT_REROUTED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: doc.id,
      requestId,
      beforeData: { status: IncomingDocumentStatus.DIRECTED, fromUnitId: open.fromUnitId },
      afterData: { status: IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT, leadUnitId: unit.id, returnId: open.id, note: validated.note ?? null },
      metadata: { documentId: doc.id, workflowId: workflow.id },
    });

    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.DOCUMENT_REROUTED_NOTIFICATION,
      aggregateType: OutboxAggregateType.DOCUMENT,
      aggregateId: doc.id,
      payload: { documentId: doc.id, returnId: open.id, toUnitId: unit.id, reroutedById: user.id, note: validated.note ?? null },
    });

    return { returnId: open.id, documentId: doc.id, status: IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT, leadUnitId: unit.id };
  }, READ_COMMITTED);
}

/** Lịch sử trả lại của một văn bản, mới nhất trước. Người gọi phải đã được phép đọc văn bản. */
export async function listDocumentReturns(documentId: string) {
  const rows = await prisma.documentUnitReturn.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
    include: {
      fromUnit: { select: { id: true, name: true } },
      toUnit: { select: { id: true, name: true } },
      returnedBy: { select: { id: true, name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    fromUnit: r.fromUnit,
    toUnit: r.toUnit,
    returnedBy: r.returnedBy,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    rerouteNote: r.rerouteNote,
  }));
}
