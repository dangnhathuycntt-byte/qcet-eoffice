import type { Prisma } from "@prisma/client";
import { DOCUMENT_DONE_STATUSES, type DocumentBucket } from "@qcet/shared/lib/documents/document-sidebar-buckets";
import { AWAITING_RECEIPT_STATUSES } from "@qcet/shared/domain/documents/delivery-rules";
import { deliveredToUnitsWhere } from "@/server/policies/document-policy";
import {
  outgoingAwaitingViewerWhere,
  outgoingHandledByViewerWhere,
  type OutgoingQueueViewer,
} from "./outgoing-queue";

// Quy trình 6: văn bản đến coi là đã xử lý từ bước "Hoàn thành" trở đi.
const INCOMING_WF_DONE = ["RESOLVED", "FILED", "ARCHIVED"] as const;
const OUTGOING_PENDING = ["DRAFT", "CONTENT_REVIEW", "FORMAT_CHECK", "AUTHORIZED_SIGN"] as const;
const OUTGOING_DONE = ["NUMBERED", "ORGANIZATION_SIGNED"] as const;
const OUTGOING_ISSUED = ["ISSUED", "DELIVERED", "FILED", "ARCHIVED", "RECALLED"] as const;

/**
 * Văn bản đi đã phát hành tới các đơn vị này mà một đơn vị chưa tiếp nhận: nhóm "Chờ xử lý" của sổ Văn bản đến.
 * Đã tiếp nhận, đã thu hồi hay đã lưu trữ thì vào "Đã xử lý".
 */
function awaitingReceiptWhere(unitIds: string[]): Prisma.DocumentWhereInput {
  return {
    type: "VAN_BAN_DI",
    outgoingWorkflow: { is: { status: { in: [...AWAITING_RECEIPT_STATUSES] } } },
    outgoingRecipients: { some: { kind: "INTERNAL_UNIT", unitId: { in: unitIds }, receivedAt: null } },
  };
}

/**
 * `deliveredUnitIds`: đơn vị của người xem khi sổ Văn bản đến gồm cả văn bản đi đã phát hành tới đơn vị đó
 * (`buildInboxTypeWhere`, ADR-015). Không truyền thì chỉ xét văn bản đến đã vào sổ như trước.
 * `viewer`: với Văn bản đi, "Chờ xử lý" và "Đã xử lý" tính theo người xem (`outgoing-queue`). Không truyền thì tính theo
 * trạng thái cho cả trường, dùng cho số liệu Báo cáo (không phải việc của một người).
 */
export function buildDocumentBucketWhere(
  type: "VAN_BAN_DEN" | "VAN_BAN_DI",
  bucket: DocumentBucket,
  deliveredUnitIds?: string[],
  viewer?: OutgoingQueueViewer
): Prisma.DocumentWhereInput | null {
  if (bucket === "recalled") {
    // Chỉ văn bản đi mới có thu hồi; văn bản đến không khớp nhóm này.
    return type === "VAN_BAN_DI" ? { outgoingWorkflow: { is: { status: "RECALLED" } } } : { id: { in: [] } };
  }
  if (type === "VAN_BAN_DEN" && deliveredUnitIds) {
    const registered = buildDocumentBucketWhere("VAN_BAN_DEN", bucket);
    if (!registered) return null;
    const delivered =
      bucket === "pending"
        ? awaitingReceiptWhere(deliveredUnitIds)
        : { AND: [deliveredToUnitsWhere(deliveredUnitIds), { NOT: awaitingReceiptWhere(deliveredUnitIds) }] };
    return { OR: [{ AND: [{ type: "VAN_BAN_DEN" }, registered] }, delivered] };
  }
  if (type === "VAN_BAN_DEN") {
    const noIncomingWf: Prisma.DocumentWhereInput = { incomingWorkflow: { is: null } };
    if (bucket === "pending") {
      return {
        OR: [
          { incomingWorkflow: { is: { status: { notIn: [...INCOMING_WF_DONE] } } } },
          { AND: [noIncomingWf, { status: { notIn: [...DOCUMENT_DONE_STATUSES] } }] },
        ],
      };
    }
    if (bucket === "done") {
      return {
        OR: [
          { incomingWorkflow: { is: { status: { in: [...INCOMING_WF_DONE] } } } },
          { AND: [noIncomingWf, { status: { in: [...DOCUMENT_DONE_STATUSES] } }] },
        ],
      };
    }
    return null;
  }
  if (viewer && bucket === "pending") return outgoingAwaitingViewerWhere(viewer);
  if (viewer && bucket === "done") return outgoingHandledByViewerWhere(viewer);
  const noWorkflow: Prisma.DocumentWhereInput = { outgoingWorkflow: { is: null } };
  if (bucket === "pending") {
    return {
      OR: [
        { outgoingWorkflow: { is: { status: { in: [...OUTGOING_PENDING] } } } },
        { AND: [noWorkflow, { status: { notIn: [...DOCUMENT_DONE_STATUSES] } }] },
      ],
    };
  }
  if (bucket === "done") {
    return { outgoingWorkflow: { is: { status: { in: [...OUTGOING_DONE] } } } };
  }
  return {
    OR: [
      { outgoingWorkflow: { is: { status: { in: [...OUTGOING_ISSUED] } } } },
      { AND: [noWorkflow, { status: { in: [...DOCUMENT_DONE_STATUSES] } }] },
    ],
  };
}
