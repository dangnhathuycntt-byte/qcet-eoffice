/**
 * Handler outbox cho thông báo văn bản (V-01). Chỉ tạo thông báo trong ứng dụng; chưa có
 * web push cho các sự kiện này. Người nhận tính khi xử lý, theo vai trò hiện tại.
 */
import { AssignmentStatus } from "@prisma/client";
import { OutboxEventType, type DbClient, type OutboxHandlerMap } from "@/lib/db/outbox";
import { isUnitLeaderPosition } from "@/server/authorization/authorization-engine";
import { logger } from "@/server/observability/logger";
import { recipientsForPendingSteps } from "@/server/documents/submission-approval-service";
import type { OutboxEvent } from "@prisma/client";

function payloadOf(event: OutboxEvent): Record<string, unknown> {
  const p = event.payload;
  return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
}

function str(p: Record<string, unknown>, key: string): string | null {
  const v = p[key];
  return typeof v === "string" && v.trim() ? v : null;
}

/** Trưởng đơn vị đang có hiệu lực của một đơn vị. */
async function unitLeaderIds(db: DbClient, unitId: string): Promise<string[]> {
  const rows = await db.positionAssignment.findMany({
    where: { unitId, status: AssignmentStatus.ACTIVE },
    include: { positionDefinition: { select: { code: true } } },
  });
  return rows.filter((r) => isUnitLeaderPosition(r.positionDefinition.code)).map((r) => r.userId);
}

async function notifyUsers(
  db: DbClient,
  documentId: string,
  recipientIds: string[],
  actorId: string | null,
  notice: { type: string; title: string; body: string }
): Promise<string[]> {
  const recipients = [...new Set(recipientIds)].filter((id) => id && id !== actorId);
  if (recipients.length === 0) return [];
  const actor = actorId ? await db.user.findUnique({ where: { id: actorId }, select: { name: true } }) : null;
  await db.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      actorName: actor?.name || "Hệ thống",
      title: notice.title,
      body: notice.body,
      category: "DOCUMENT_DISPATCH",
      type: notice.type,
      linkHref: `/documents?id=${encodeURIComponent(documentId)}`,
    })),
  });
  return recipients;
}

function docLabel(doc: { registrationNumber: number; documentYear: number; summary: string }): string {
  const summary = doc.summary.length > 60 ? `${doc.summary.slice(0, 57)}...` : doc.summary;
  return `Số đến ${doc.registrationNumber}/${doc.documentYear}: ${summary}`;
}

function submissionLabel(doc: { registrationNumber: number; documentYear: number; summary: string }): string {
  const summary = doc.summary.length > 60 ? `${doc.summary.slice(0, 57)}...` : doc.summary;
  return `Tờ trình số ${doc.registrationNumber}/${doc.documentYear}: ${summary}`;
}

const DECISION_TEXT: Record<string, string> = {
  APPROVE: "đồng ý",
  REVISION: "yêu cầu bổ sung",
  REJECT: "không phê duyệt",
};

export const DOCUMENT_NOTIFICATION_HANDLERS: OutboxHandlerMap = {
  // Tờ trình cần duyệt: báo những người đang có bước chờ (kể cả người vừa được chỉ định thay).
  [OutboxEventType.DOCUMENT_APPROVAL_REQUESTED_NOTIFICATION]: async (event, context) => {
    const db = context?.client as DbClient;
    const p = payloadOf(event);
    const documentId = str(p, "documentId") ?? event.aggregateId;
    const workflowId = str(p, "workflowId");
    const doc = await db.document.findUnique({ where: { id: documentId } });
    const workflow = workflowId ? await db.documentApprovalWorkflow.findUnique({ where: { id: workflowId } }) : null;
    if (!doc || !workflow || (workflow.status !== "WAITING_UNIT_HEAD" && workflow.status !== "WAITING_LEADER")) {
      return { skipped: "not_waiting" };
    }
    const recipients = await recipientsForPendingSteps(db, workflow.id);
    return notifyUsers(db, doc.id, recipients, workflow.submittedById, {
      type: "submission_requested",
      title: "Tờ trình chờ bạn duyệt",
      body: submissionLabel(doc),
    });
  },

  // Có quyết định: báo người trình.
  [OutboxEventType.DOCUMENT_APPROVAL_DECIDED_NOTIFICATION]: async (event, context) => {
    const db = context?.client as DbClient;
    const p = payloadOf(event);
    const documentId = str(p, "documentId") ?? event.aggregateId;
    const workflowId = str(p, "workflowId");
    const doc = await db.document.findUnique({ where: { id: documentId } });
    const workflow = workflowId ? await db.documentApprovalWorkflow.findUnique({ where: { id: workflowId } }) : null;
    if (!doc || !workflow?.submittedById) return { skipped: "document_missing" };
    const outcome = str(p, "outcome");
    const decision = str(p, "decision") ?? "";
    const note = str(p, "note");
    const headline =
      outcome === "APPROVED" ? "Tờ trình đã được phê duyệt"
      : outcome === "REJECTED" ? "Tờ trình không được phê duyệt"
      : outcome === "NEEDS_REVISION" ? "Tờ trình cần bổ sung"
      : `Có người ${DECISION_TEXT[decision] ?? "xử lý"} tờ trình`;
    return notifyUsers(db, doc.id, [workflow.submittedById], str(p, "deciderId"), {
      type: "submission_decided",
      title: headline,
      body: `${submissionLabel(doc)}${note ? `. Ghi chú: ${note}` : ""}`,
    });
  },

  // Xin trả lại tờ trình đã có người mở: báo người đang chờ duyệt; có phản hồi thì báo người trình (V-06).
  [OutboxEventType.DOCUMENT_APPROVAL_RETURN_NOTIFICATION]: async (event, context) => {
    const db = context?.client as DbClient;
    const p = payloadOf(event);
    const documentId = str(p, "documentId") ?? event.aggregateId;
    const workflowId = str(p, "workflowId");
    const doc = await db.document.findUnique({ where: { id: documentId } });
    const workflow = workflowId ? await db.documentApprovalWorkflow.findUnique({ where: { id: workflowId } }) : null;
    if (!doc || !workflow) return { skipped: "missing" };
    if (str(p, "kind") === "REQUESTED") {
      if (!workflow.returnRequestedAt) return { skipped: "request_closed" };
      const recipients = await recipientsForPendingSteps(db, workflow.id);
      return notifyUsers(db, doc.id, recipients, str(p, "actorId"), {
        type: "submission_return_requested",
        title: "Người trình xin trả lại tờ trình",
        body: `${submissionLabel(doc)}. Lý do: ${workflow.returnRequestNote ?? "—"}`,
      });
    }
    if (!workflow.submittedById) return { skipped: "no_submitter" };
    const accept = p["accept"] === true;
    const note = str(p, "note");
    return notifyUsers(db, doc.id, [workflow.submittedById], str(p, "actorId"), {
      type: "submission_return_decided",
      title: accept ? "Tờ trình đã được trả lại để sửa" : "Đề nghị trả lại bị từ chối",
      body: `${submissionLabel(doc)}${note ? `. Ghi chú: ${note}` : ""}`,
    });
  },

  // Xin ý kiến: báo người được hỏi; trả lời thì báo người hỏi.
  [OutboxEventType.DOCUMENT_CONSULTATION_NOTIFICATION]: async (event, context) => {
    const db = context?.client as DbClient;
    const p = payloadOf(event);
    const consultationId = str(p, "consultationId");
    const row = consultationId ? await db.documentConsultation.findUnique({ where: { id: consultationId } }) : null;
    const doc = await db.document.findUnique({ where: { id: str(p, "documentId") ?? event.aggregateId } });
    if (!row || !doc) return { skipped: "missing" };
    const asked = str(p, "kind") === "ASKED";
    return notifyUsers(db, doc.id, [asked ? row.consultantId : row.askedById], str(p, "actorId"), {
      type: asked ? "submission_consult" : "submission_consult_answered",
      title: asked ? "Bạn được xin ý kiến về một tờ trình" : "Có ý kiến trả lời về tờ trình",
      body: `${submissionLabel(doc)}`,
    });
  },

  // Đơn vị trả lại văn bản: báo Văn thư đã vào sổ và lãnh đạo đã bút phê.
  [OutboxEventType.DOCUMENT_RETURNED_NOTIFICATION]: async (event, context) => {
    const db = context?.client as DbClient;
    const p = payloadOf(event);
    const documentId = str(p, "documentId") ?? event.aggregateId;
    const doc = await db.document.findUnique({
      where: { id: documentId },
      include: { incomingWorkflow: { select: { leaderId: true } } },
    });
    if (!doc) return { skipped: "document_missing" };
    const reason = str(p, "reason");
    return notifyUsers(db, doc.id, [doc.registeredById, doc.incomingWorkflow?.leaderId ?? ""], str(p, "returnedById"), {
      type: "document_returned",
      title: "Văn bản bị trả lại",
      body: `${docLabel(doc)}. Lý do: ${reason ?? "không nêu"}. Cần chuyển cho đơn vị khác.`,
    });
  },

  // Văn bản đi bị thu hồi (V-05): báo trưởng các đơn vị trong trường đã được ghi là nơi nhận.
  [OutboxEventType.DOCUMENT_RECALLED_NOTIFICATION]: async (event, context) => {
    const db = context?.client as DbClient;
    const p = payloadOf(event);
    const documentId = str(p, "documentId") ?? event.aggregateId;
    const doc = await db.document.findUnique({ where: { id: documentId }, include: { outgoingRecipients: { where: { kind: "INTERNAL_UNIT", unitId: { not: null } } } } });
    if (!doc) return { skipped: "document_missing" };
    const leaders: string[] = [];
    for (const r of doc.outgoingRecipients) if (r.unitId) leaders.push(...(await unitLeaderIds(db, r.unitId)));
    if (leaders.length === 0) return { skipped: "no_internal_recipient_leader" };
    const wf = await db.documentOutgoingWorkflow.findUnique({ where: { documentId }, select: { outgoingNumberStr: true, recallReason: true } });
    const summary = doc.summary.length > 60 ? `${doc.summary.slice(0, 57)}...` : doc.summary;
    return notifyUsers(db, doc.id, leaders, str(p, "recalledById"), {
      type: "document_recalled",
      title: "Văn bản đã bị thu hồi",
      body: `Văn bản số ${wf?.outgoingNumberStr ?? "—"}: ${summary}. Lý do: ${wf?.recallReason ?? "—"}. Không thực hiện theo văn bản này.`,
    });
  },

  // Văn thư chuyển văn bản cho đơn vị khác: báo trưởng đơn vị nhận.
  [OutboxEventType.DOCUMENT_REROUTED_NOTIFICATION]: async (event, context) => {
    const db = context?.client as DbClient;
    const p = payloadOf(event);
    const documentId = str(p, "documentId") ?? event.aggregateId;
    const toUnitId = str(p, "toUnitId");
    const doc = await db.document.findUnique({ where: { id: documentId } });
    if (!doc || !toUnitId) return { skipped: "document_or_unit_missing" };
    const leaders = await unitLeaderIds(db, toUnitId);
    if (leaders.length === 0) {
      logger.warn("outbox.document_rerouted.no_unit_leader", { metadata: { documentId, toUnitId } });
      return { skipped: "no_unit_leader" };
    }
    return notifyUsers(db, doc.id, leaders, str(p, "reroutedById"), {
      type: "document_rerouted",
      title: "Văn bản được chuyển đến đơn vị bạn",
      body: `${docLabel(doc)}. Cần phân công người xử lý.`,
    });
  },
};
