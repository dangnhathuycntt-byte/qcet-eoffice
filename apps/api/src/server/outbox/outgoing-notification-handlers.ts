/**
 * Handler outbox cho các bước của văn bản đi trước khi phát hành (spec Văn bản §8.3, N1): mỗi bước báo đúng người sẽ
 * làm bước kế hoặc người cần biết kết quả. Người thực hiện không nhận thông báo cho hành động của chính mình (xem
 * `notifyUsers`). Handler kiểm lại trạng thái lúc xử lý: việc đã được rút lại hoặc xử lý xong thì không báo nữa.
 * Bước không cần báo (người làm bước kế là chính người vừa làm, hoặc hàng đợi đã đủ) ghi lý do ở `SILENT_OUTBOX_EVENTS`.
 */
import { AssignmentStatus, OutgoingDocumentStatus, UserRole } from "@prisma/client";
import type { OutboxEvent } from "@prisma/client";
import type { DbClient, OutboxHandlerMap } from "@qcet/db/outbox";
import { isUnitLeaderPosition } from "@/server/authorization/authorization-engine";
import {
  OUTGOING_CLERK_POSITION,
  OUTGOING_SIGNER_POSITION,
  returnedReasonOf,
} from "@qcet/shared/domain/documents/outgoing-steps";
import { notifyUsers, payloadOf, str } from "./document-notification-handlers";
import { guarded } from "./task-notification-handlers";

type Summary = { summary: string };

function shortSummary(doc: Summary): string {
  return doc.summary.length > 60 ? `${doc.summary.slice(0, 57)}...` : doc.summary;
}

/** Văn thư đang hoạt động: theo chức danh VAN_THU, hoặc vai trò VAN_THU khi chưa có phân công. */
async function clerkIds(db: DbClient): Promise<string[]> {
  const rows = await db.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: UserRole.VAN_THU },
        { positionAssignments: { some: { status: AssignmentStatus.ACTIVE, positionDefinition: { code: OUTGOING_CLERK_POSITION } } } },
      ],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function rectorIds(db: DbClient): Promise<string[]> {
  const rows = await db.positionAssignment.findMany({
    where: { status: AssignmentStatus.ACTIVE, positionDefinition: { code: OUTGOING_SIGNER_POSITION }, user: { isActive: true } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

async function draftingUnitLeaderIds(db: DbClient, unitId: string | null): Promise<string[]> {
  if (!unitId) return [];
  const rows = await db.positionAssignment.findMany({
    where: { unitId, status: AssignmentStatus.ACTIVE, user: { isActive: true } },
    include: { positionDefinition: { select: { code: true } } },
  });
  return rows.filter((r) => isUnitLeaderPosition(r.positionDefinition.code)).map((r) => r.userId);
}

/** Văn bản đi và workflow hiện tại của sự kiện; null khi không còn hoặc không phải văn bản đi. */
async function loadOutgoing(db: DbClient, event: OutboxEvent) {
  const documentId = str(payloadOf(event), "documentId") ?? event.aggregateId;
  const doc = await db.document.findUnique({ where: { id: documentId }, include: { outgoingWorkflow: true } });
  if (!doc || doc.type !== "VAN_BAN_DI" || !doc.outgoingWorkflow) return null;
  return { doc, workflow: doc.outgoingWorkflow };
}

const MISSING = { skipped: "not_outgoing" } as const;

export const OUTGOING_NOTIFICATION_HANDLERS: OutboxHandlerMap = {
  // Người soạn trình duyệt: báo người duyệt (mặc định trưởng đơn vị soạn).
  DOCUMENT_CONTENT_REVIEW_REQUESTED: guarded(async (event, db) => {
    const p = payloadOf(event);
    const found = await loadOutgoing(db, event);
    if (!found) return MISSING;
    if (found.workflow.status !== OutgoingDocumentStatus.CONTENT_REVIEW) return { skipped: "request_closed" };
    const reviewerId = str(p, "contentReviewerId") ?? found.workflow.contentReviewerId;
    const recipients = reviewerId ? [reviewerId] : await draftingUnitLeaderIds(db, found.workflow.draftingUnitId);
    return notifyUsers(db, found.doc.id, recipients, str(p, "submittedBy"), {
      type: "outgoing_review_requested",
      title: "Dự thảo chờ bạn duyệt nội dung",
      body: `Trình duyệt: ${shortSummary(found.doc)}`,
    });
  }),

  // Người soạn rút lại: người duyệt bỏ việc khỏi hàng đợi và được báo.
  DOCUMENT_CONTENT_REVIEW_WITHDRAWN: guarded(async (event, db) => {
    const p = payloadOf(event);
    const found = await loadOutgoing(db, event);
    if (!found) return MISSING;
    const reviewerId = str(p, "contentReviewerId");
    if (!reviewerId) return { skipped: "no_reviewer" };
    return notifyUsers(db, found.doc.id, [reviewerId], str(p, "drafterId"), {
      type: "outgoing_review_withdrawn",
      title: "Người soạn đã rút lại dự thảo",
      body: `Không cần duyệt nữa: ${shortSummary(found.doc)}`,
    });
  }),

  // Người duyệt trả lại: báo người soạn kèm lý do rút gọn.
  DOCUMENT_CONTENT_REJECTED: guarded(async (event, db) => {
    const p = payloadOf(event);
    const found = await loadOutgoing(db, event);
    if (!found) return MISSING;
    // Lý do nguyên văn nằm trong sự kiện; ghi chú của workflow đã bị ghi đè nếu người soạn trình lại trước khi worker chạy.
    const reason = str(p, "notes") ?? returnedReasonOf(found.workflow.contentReviewNotes);
    const shortReason = reason ? (reason.length > 80 ? `${reason.slice(0, 77)}...` : reason) : null;
    return notifyUsers(db, found.doc.id, [found.doc.registeredById], str(p, "reviewerId"), {
      type: "outgoing_returned",
      title: "Dự thảo cần chỉnh sửa",
      body: `${shortSummary(found.doc)}${shortReason ? `. Lý do: ${shortReason}` : ""}`,
    });
  }),

  // Nội dung đã duyệt: báo Văn thư kiểm thể thức (người soạn thấy trạng thái, không cần báo).
  DOCUMENT_CONTENT_APPROVED: guarded(async (event, db) => {
    const found = await loadOutgoing(db, event);
    if (!found) return MISSING;
    if (found.workflow.status !== OutgoingDocumentStatus.FORMAT_CHECK) return { skipped: "step_done" };
    return notifyUsers(db, found.doc.id, await clerkIds(db), str(payloadOf(event), "contentReviewerId"), {
      type: "outgoing_format_check",
      title: "Chờ kiểm tra thể thức",
      body: shortSummary(found.doc),
    });
  }),

  // Thể thức đạt: báo người ký (người được chỉ định, không thì Hiệu trưởng).
  DOCUMENT_FORMAT_APPROVED: guarded(async (event, db) => {
    const found = await loadOutgoing(db, event);
    if (!found) return MISSING;
    if (found.workflow.status !== OutgoingDocumentStatus.AUTHORIZED_SIGN || found.workflow.authorizedSignedAt) {
      return { skipped: "step_done" };
    }
    const signers = found.workflow.authorizedSignerId ? [found.workflow.authorizedSignerId] : await rectorIds(db);
    return notifyUsers(db, found.doc.id, signers, str(payloadOf(event), "formatReviewerId"), {
      type: "outgoing_sign_requested",
      title: "Dự thảo chờ bạn ký",
      body: shortSummary(found.doc),
    });
  }),

  // Đã ký chức danh: báo Văn thư cấp số.
  DOCUMENT_AUTHORIZED_SIGNED: guarded(async (event, db) => {
    const found = await loadOutgoing(db, event);
    if (!found) return MISSING;
    if (found.workflow.status !== OutgoingDocumentStatus.AUTHORIZED_SIGN) return { skipped: "step_done" };
    return notifyUsers(db, found.doc.id, await clerkIds(db), str(payloadOf(event), "signerUserId"), {
      type: "outgoing_number_requested",
      title: "Đã ký, chờ cấp số",
      body: shortSummary(found.doc),
    });
  }),
};
