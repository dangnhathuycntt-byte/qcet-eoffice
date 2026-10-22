/**
 * Nơi nhận có định danh của văn bản đi (V-05a), thu hồi và ghi nhận tiếp nhận (V-05).
 * Quyền thu hồi kiểm bằng engine canonical (`document.outgoing.recall`). Tiếp nhận như nhận thư (ADR-015): đơn vị trong
 * trường do trưởng đơn vị nhận tự bấm; cơ quan ngoài trường do văn thư bên gửi ghi nhận (`.confirm_receipt`).
 */
import { z } from "zod";
import { OutgoingDocumentStatus, OutgoingRecipientKind, DocumentStatus, type Prisma } from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import type { SessionPayload } from "@/lib/jwt-session";
import { auditService, AuditAction, AuditEntityType } from "@qcet/db/audit";
import { publishOutboxEvent, OutboxEventType, OutboxAggregateType } from "@qcet/db/outbox";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/api/errors";
import { buildDocumentReadWhere } from "@/server/policies/document-policy";
import { loadContext, canDo, assertCan } from "@/server/documents/authorize-on-document";
import { isUnitLeaderPosition } from "@/server/authorization/authorization-engine";
import type { AuthorizationContext } from "@/server/authorization/authorization-context";
import { evaluateRecall, evaluateReplacementTarget } from "@qcet/shared/domain/documents/recall-rules";
import { AWAITING_RECEIPT_STATUSES } from "@qcet/shared/domain/documents/delivery-rules";

// QCET chỉ gửi nhận trong trường (ADR-015): nơi nhận là đơn vị trong trường, không nhận tên cơ quan ngoài trường.
const RECIPIENT_UNIT_REQUIRED = "Nơi nhận phải là đơn vị trong trường";
export const RecipientInputSchema = z
  .object({ unitId: z.string({ error: RECIPIENT_UNIT_REQUIRED }).trim().min(1, RECIPIENT_UNIT_REQUIRED) })
  .strict();

export const RecipientsSchema = z.array(RecipientInputSchema).max(100);
export type RecipientInput = z.infer<typeof RecipientInputSchema>;

export const RecallSchema = z
  .object({ reason: z.string().trim().min(3, "Cần nêu lý do thu hồi").max(1000) })
  .strict();

export const ConfirmReceiptSchema = z.object({ recipientId: z.string().trim().min(1) }).strict();

/** Chuyển danh sách nhập thành dòng nơi nhận; tên đơn vị lấy từ danh mục, trùng nhau bị gộp. */
export async function resolveRecipientRows(tx: Prisma.TransactionClient, inputs: RecipientInput[]) {
  const unitIds = [...new Set(inputs.map((i) => i.unitId))];
  const units = unitIds.length ? await tx.organizationalUnit.findMany({ where: { id: { in: unitIds } }, select: { id: true, name: true } }) : [];
  const byId = new Map(units.map((u) => [u.id, u.name]));
  return unitIds.map((unitId) => {
    const name = byId.get(unitId);
    if (!name) throw new ValidationError("Đơn vị nhận không tồn tại", undefined, "RECIPIENT_UNIT_NOT_FOUND");
    return { kind: OutgoingRecipientKind.INTERNAL_UNIT, unitId: unitId as string | null, name };
  });
}

/** Kiểm tra văn bản được thay thế (Q10) và chưa có văn bản nào thay thế nó. */
export async function assertReplacementAllowed(tx: Prisma.TransactionClient, targetId: string, selfId: string) {
  if (targetId === selfId) throw new ValidationError("Văn bản không thể tự thay thế chính nó", undefined, "REPLACEMENT_SELF");
  const target = await tx.documentOutgoingWorkflow.findUnique({
    where: { documentId: targetId },
    select: { status: true, outgoingNumberStr: true, document: { select: { outgoingRecipients: { select: { receivedAt: true } } } } },
  });
  if (!target) throw new NotFoundError("Không tìm thấy văn bản cần thay thế", "REPLACED_DOCUMENT_NOT_FOUND");
  const verdict = evaluateReplacementTarget(target.status, target.document.outgoingRecipients);
  if (!verdict.ok) throw new ConflictError(verdict.message, verdict.code);
  const existing = await tx.documentOutgoingWorkflow.findFirst({ where: { replacesDocumentId: targetId, NOT: { documentId: selfId } }, select: { documentId: true } });
  if (existing) throw new ConflictError("Văn bản này đã có văn bản thay thế", "DOCUMENT_ALREADY_REPLACED");
  return { numberStr: target.outgoingNumberStr };
}

async function loadOutgoing(documentId: string) {
  const workflow = await prisma.documentOutgoingWorkflow.findUnique({
    where: { documentId },
    include: { document: { include: { outgoingRecipients: { orderBy: { createdAt: "asc" } } } } },
  });
  if (!workflow) throw new NotFoundError("Không tìm thấy văn bản đi", "DOCUMENT_NOT_FOUND");
  return workflow;
}

async function listReplaceCandidates(selfId: string) {
  const rows = await prisma.documentOutgoingWorkflow.findMany({
    where: {
      documentId: { not: selfId },
      OR: [
        { status: OutgoingDocumentStatus.RECALLED },
        {
          status: { in: [OutgoingDocumentStatus.ISSUED, OutgoingDocumentStatus.DELIVERED, OutgoingDocumentStatus.FILED, OutgoingDocumentStatus.ARCHIVED] },
          document: { outgoingRecipients: { some: { receivedAt: { not: null } } } },
        },
      ],
    },
    orderBy: { issuedAt: "desc" },
    take: 50,
    select: { documentId: true, outgoingNumberStr: true, document: { select: { summary: true } } },
  });
  const taken = rows.length
    ? await prisma.documentOutgoingWorkflow.findMany({ where: { replacesDocumentId: { in: rows.map((r) => r.documentId) } }, select: { replacesDocumentId: true } })
    : [];
  const takenIds = new Set(taken.map((t) => t.replacesDocumentId));
  return rows
    .filter((r) => !takenIds.has(r.documentId))
    .map((r) => ({ documentId: r.documentId, numberStr: r.outgoingNumberStr, title: r.document.summary }));
}

/**
 * Ai ghi nhận một nơi nhận đã tiếp nhận: đơn vị trong trường do chính trưởng đơn vị đó bấm "Tiếp nhận";
 * cơ quan ngoài trường không có tài khoản nên văn thư bên gửi ghi nhận thay.
 */
function canConfirmRecipient(
  ctx: AuthorizationContext,
  recipient: { kind: OutgoingRecipientKind; unitId: string | null },
  doc: Parameters<typeof canDo>[2]
): boolean {
  if (recipient.kind === OutgoingRecipientKind.INTERNAL_UNIT) {
    return Boolean(recipient.unitId) && ctx.positions.some((p) => p.unitId === recipient.unitId && isUnitLeaderPosition(p.positionCode));
  }
  return canDo(ctx, "document.outgoing.confirm_receipt", doc);
}

export interface RecipientsState {
  documentId: string;
  status: string;
  /** `canConfirm`: người xem ghi nhận được nơi nhận này đã tiếp nhận (văn bản đang chờ tiếp nhận). */
  recipients: Array<{ id: string; kind: string; name: string; unitId: string | null; receivedAt: string | null; canConfirm: boolean }>;
  recall: { recalledAt: string; reason: string | null } | null;
  replaces: { documentId: string; numberStr: string | null } | null;
  replacedBy: { documentId: string; numberStr: string | null } | null;
  canRecall: boolean;
  /** Văn thư phát hành được (đã đóng dấu cơ quan, chưa phát hành). */
  canIssue: boolean;
  /** Văn bản có thể được thay thế khi phát hành: đã thu hồi hoặc đã có nơi nhận tiếp nhận, chưa có bản thay thế. */
  replaceCandidates: Array<{ documentId: string; numberStr: string | null; title: string }>;
  /** Lý do chưa thu hồi được, để giao diện hướng dẫn thay vì chỉ ẩn nút. */
  recallBlockedReason: string | null;
}

export async function getRecipientsState(session: SessionPayload, documentId: string): Promise<RecipientsState> {
  const ctx = await loadContext(session);
  const readable = await prisma.document.findFirst({ where: { AND: [{ id: documentId }, buildDocumentReadWhere(ctx)] }, select: { id: true } });
  if (!readable) throw new NotFoundError("Không tìm thấy văn bản", "DOCUMENT_NOT_FOUND");
  const wf = await loadOutgoing(documentId);
  const [replaces, replacedBy] = await Promise.all([
    wf.replacesDocumentId
      ? prisma.documentOutgoingWorkflow.findUnique({ where: { documentId: wf.replacesDocumentId }, select: { documentId: true, outgoingNumberStr: true } })
      : null,
    prisma.documentOutgoingWorkflow.findFirst({ where: { replacesDocumentId: documentId }, select: { documentId: true, outgoingNumberStr: true } }),
  ]);
  const verdict = evaluateRecall(wf.status, wf.document.outgoingRecipients);
  const canRecall = canDo(ctx, "document.outgoing.recall", wf.document);
  const canIssue = wf.status === OutgoingDocumentStatus.ORGANIZATION_SIGNED && canDo(ctx, "document.outgoing.issue", wf.document);
  const awaitingReceipt = (AWAITING_RECEIPT_STATUSES as readonly string[]).includes(wf.status);
  return {
    documentId,
    status: wf.status,
    recipients: wf.document.outgoingRecipients.map((r) => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      unitId: r.unitId,
      receivedAt: r.receivedAt?.toISOString() ?? null,
      canConfirm: awaitingReceipt && !r.receivedAt && canConfirmRecipient(ctx, r, wf.document),
    })),
    recall: wf.recalledAt ? { recalledAt: wf.recalledAt.toISOString(), reason: wf.recallReason } : null,
    replaces: replaces ? { documentId: replaces.documentId, numberStr: replaces.outgoingNumberStr } : null,
    replacedBy: replacedBy ? { documentId: replacedBy.documentId, numberStr: replacedBy.outgoingNumberStr } : null,
    canRecall: canRecall && verdict.ok,
    canIssue,
    replaceCandidates: canIssue ? await listReplaceCandidates(documentId) : [],
    recallBlockedReason: canRecall && !verdict.ok && wf.status !== OutgoingDocumentStatus.RECALLED ? verdict.message : null,
  };
}

/**
 * Nơi nhận tiếp nhận văn bản: trưởng đơn vị nhận bấm cho đơn vị mình, văn thư bên gửi ghi nhận cho cơ quan ngoài trường.
 * Từ lúc này văn bản không thu hồi được nữa.
 */
export async function confirmReceipt(session: SessionPayload, documentId: string, input: unknown, now = new Date()) {
  const { recipientId } = ConfirmReceiptSchema.parse(input);
  const ctx = await loadContext(session);
  const wf = await loadOutgoing(documentId);
  const recipient = wf.document.outgoingRecipients.find((r) => r.id === recipientId);
  if (!recipient) throw new NotFoundError("Không tìm thấy nơi nhận", "RECIPIENT_NOT_FOUND");
  if (!canConfirmRecipient(ctx, recipient, wf.document)) {
    throw new ForbiddenError(
      recipient.kind === OutgoingRecipientKind.INTERNAL_UNIT
        ? "Chỉ trưởng đơn vị nhận mới tiếp nhận văn bản cho đơn vị mình"
        : "Chỉ văn thư mới ghi nhận cơ quan ngoài trường đã nhận văn bản"
    );
  }
  if (!(AWAITING_RECEIPT_STATUSES as readonly string[]).includes(wf.status)) {
    throw new ConflictError("Chỉ ghi nhận tiếp nhận cho văn bản đã phát hành và chưa thu hồi", "OUTGOING_NOT_ISSUED");
  }
  if (recipient.receivedAt) return { recipientId, receivedAt: recipient.receivedAt.toISOString(), changed: false };

  return prisma.$transaction(async (tx) => {
    // Khóa dòng workflow để không chạy song song với thu hồi: một trong hai phải thắng.
    const lock = await tx.documentOutgoingWorkflow.updateMany({
      where: { documentId, status: { in: [OutgoingDocumentStatus.ISSUED, OutgoingDocumentStatus.DELIVERED] } },
      data: { updatedAt: now },
    });
    if (lock.count !== 1) throw new ConflictError("Văn bản đã được thu hồi hoặc thay đổi trạng thái", "OUTGOING_NOT_ISSUED");
    await tx.outgoingDocumentRecipient.update({ where: { id: recipientId }, data: { receivedAt: now, receivedById: session.id } });
    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.OUTGOING_RECEIPT_CONFIRMED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: documentId,
      beforeData: null,
      afterData: { recipientId, recipientName: recipient.name, receivedAt: now.toISOString() },
    });
    return { recipientId, receivedAt: now.toISOString(), changed: true };
  });
}

/** Văn thư thu hồi văn bản đi khi chưa nơi nhận nào tiếp nhận. Số văn bản giữ nguyên và không cấp lại. */
export async function recallOutgoing(session: SessionPayload, documentId: string, input: unknown, now = new Date()) {
  const { reason } = RecallSchema.parse(input);
  const ctx = await loadContext(session);
  const wf = await loadOutgoing(documentId);
  assertCan(ctx, "document.outgoing.recall", wf.document);
  const first = evaluateRecall(wf.status, wf.document.outgoingRecipients);
  if (!first.ok) throw new ConflictError(first.message, first.code);

  return prisma.$transaction(async (tx) => {
    const claim = await tx.documentOutgoingWorkflow.updateMany({
      where: { documentId, status: { in: [OutgoingDocumentStatus.ISSUED, OutgoingDocumentStatus.DELIVERED] } },
      data: { status: OutgoingDocumentStatus.RECALLED, recalledAt: now, recalledById: session.id, recallReason: reason },
    });
    if (claim.count !== 1) throw new ConflictError("Văn bản đã thay đổi trạng thái; hãy tải lại", "OUTGOING_NOT_RECALLABLE");
    // Kiểm lại sau khi giữ khóa: ghi nhận tiếp nhận chạy song song có thể vừa hoàn tất.
    const recipients = await tx.outgoingDocumentRecipient.findMany({ where: { documentId }, select: { receivedAt: true } });
    const again = evaluateRecall(OutgoingDocumentStatus.ISSUED, recipients);
    if (!again.ok) throw new ConflictError(again.message, again.code);
    await tx.document.update({ where: { id: documentId }, data: { status: DocumentStatus.LUU_THEO_DOI } });
    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.OUTGOING_DOCUMENT_RECALLED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: documentId,
      beforeData: { status: wf.status },
      afterData: { status: OutgoingDocumentStatus.RECALLED, reason, outgoingNumberStr: wf.outgoingNumberStr },
    });
    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.DOCUMENT_RECALLED_NOTIFICATION,
      aggregateType: OutboxAggregateType.DOCUMENT,
      aggregateId: documentId,
      payload: { documentId, recalledById: session.id },
    });
    return { documentId, status: OutgoingDocumentStatus.RECALLED, outgoingNumberStr: wf.outgoingNumberStr };
  });
}

