import type { Prisma } from "@prisma/client";
import { DOCUMENT_DONE_STATUSES, type DocumentBucket } from "@qcet/shared/lib/documents/document-sidebar-buckets";

// Quy trình 6: văn bản đến coi là đã xử lý từ bước "Hoàn thành" trở đi.
const INCOMING_WF_DONE = ["RESOLVED", "FILED", "ARCHIVED"] as const;
const OUTGOING_PENDING = ["DRAFT", "CONTENT_REVIEW", "FORMAT_CHECK", "AUTHORIZED_SIGN"] as const;
const OUTGOING_DONE = ["NUMBERED", "ORGANIZATION_SIGNED"] as const;
const OUTGOING_ISSUED = ["ISSUED", "DELIVERED", "FILED", "ARCHIVED", "RECALLED"] as const;

export function buildDocumentBucketWhere(
  type: "VAN_BAN_DEN" | "VAN_BAN_DI",
  bucket: DocumentBucket
): Prisma.DocumentWhereInput | null {
  if (bucket === "recalled") {
    // Chỉ văn bản đi mới có thu hồi; văn bản đến không khớp nhóm này.
    return type === "VAN_BAN_DI" ? { outgoingWorkflow: { is: { status: "RECALLED" } } } : { id: { in: [] } };
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
