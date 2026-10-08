import type { Prisma } from "@prisma/client";

/**
 * Nhóm trạng thái dùng cho menu con "Văn bản" ở sidebar.
 * - Văn bản đến: dựa trên `Document.status`.
 * - Văn bản đi: dựa trên `DocumentOutgoingWorkflow.status` (văn bản chưa có workflow
 *   được suy ra từ `Document.status`).
 */
export type DocumentBucket = "pending" | "done" | "issued";

export const DOCUMENT_BUCKETS: readonly DocumentBucket[] = ["pending", "done", "issued"];

export function parseDocumentBucket(value: string | null | undefined): DocumentBucket | "" {
  const v = (value ?? "").trim().toLowerCase();
  return (DOCUMENT_BUCKETS as readonly string[]).includes(v) ? (v as DocumentBucket) : "";
}

const INCOMING_DONE = ["DA_HOAN_THANH", "LUU_THEO_DOI"] as const;
// Quy trình 6: văn bản đến coi là đã xử lý từ bước "Hoàn thành" trở đi.
const INCOMING_WF_DONE = ["RESOLVED", "FILED", "ARCHIVED"] as const;
const OUTGOING_PENDING = ["DRAFT", "CONTENT_REVIEW", "FORMAT_CHECK", "AUTHORIZED_SIGN"] as const;
const OUTGOING_DONE = ["NUMBERED", "ORGANIZATION_SIGNED"] as const;
const OUTGOING_ISSUED = ["ISSUED", "DELIVERED", "FILED", "ARCHIVED"] as const;

export function buildDocumentBucketWhere(
  type: "VAN_BAN_DEN" | "VAN_BAN_DI",
  bucket: DocumentBucket
): Prisma.DocumentWhereInput | null {
  if (type === "VAN_BAN_DEN") {
    const noIncomingWf: Prisma.DocumentWhereInput = { incomingWorkflow: { is: null } };
    if (bucket === "pending") {
      return {
        OR: [
          { incomingWorkflow: { is: { status: { notIn: [...INCOMING_WF_DONE] } } } },
          { AND: [noIncomingWf, { status: { notIn: [...INCOMING_DONE] } }] },
        ],
      };
    }
    if (bucket === "done") {
      return {
        OR: [
          { incomingWorkflow: { is: { status: { in: [...INCOMING_WF_DONE] } } } },
          { AND: [noIncomingWf, { status: { in: [...INCOMING_DONE] } }] },
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
        { AND: [noWorkflow, { status: { notIn: [...INCOMING_DONE] } }] },
      ],
    };
  }
  if (bucket === "done") {
    return { outgoingWorkflow: { is: { status: { in: [...OUTGOING_DONE] } } } };
  }
  return {
    OR: [
      { outgoingWorkflow: { is: { status: { in: [...OUTGOING_ISSUED] } } } },
      { AND: [noWorkflow, { status: { in: [...INCOMING_DONE] } }] },
    ],
  };
}
