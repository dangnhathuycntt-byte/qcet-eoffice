/**
 * Handler outbox cho thông báo văn bản (V-01). Chỉ tạo thông báo trong ứng dụng; chưa có
 * web push cho các sự kiện này. Người nhận tính khi xử lý, theo vai trò hiện tại.
 */
import { AssignmentStatus } from "@prisma/client";
import { OutboxEventType, type DbClient, type OutboxHandlerMap } from "@/lib/db/outbox";
import { isUnitLeaderPosition } from "@/server/authorization/authorization-engine";
import { logger } from "@/server/observability/logger";
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

export const DOCUMENT_NOTIFICATION_HANDLERS: OutboxHandlerMap = {
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
