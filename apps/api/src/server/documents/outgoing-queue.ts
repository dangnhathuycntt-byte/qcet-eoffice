/**
 * Hàng đợi văn bản đi theo người xem (spec Văn bản §8.2, S3): "Chờ xử lý" là văn bản đang chờ chính người xem làm bước
 * của mình, "Đã xử lý" là văn bản người xem đã làm bước và đang ở người khác (kể cả bản mình soạn mà đang chờ duyệt).
 * Điều kiện khớp `describeOutgoingWaiting` và người được báo ở `outgoing-notification-handlers`; lãnh đạo có quyền duyệt
 * hay ký thay vẫn bấm được ở chi tiết văn bản nhưng không có việc trong hàng đợi trừ khi là người được giao.
 */
import type { Prisma } from "@prisma/client";
import { DOCUMENT_DONE_STATUSES } from "@qcet/shared/lib/documents/document-sidebar-buckets";
import {
  OUTGOING_CLERK_POSITION,
  OUTGOING_SIGNER_POSITION,
  RETURNED_NOTE_PREFIX,
} from "@qcet/shared/domain/documents/outgoing-steps";
import { isDeputyUnitLeaderPosition, isUnitLeaderPosition } from "@/server/authorization/authorization-engine";

export interface OutgoingQueueViewer {
  userId: string;
  /** Văn thư: kiểm thể thức, cấp số, đóng dấu, phát hành. */
  isClerk: boolean;
  /** Hiệu trưởng: ký khi dự thảo chưa chỉ định người ký. */
  isSigner: boolean;
  /** Đơn vị người xem làm trưởng hoặc phó: duyệt dự thảo cũ chưa có người được trình. */
  ledUnitIds: string[];
}

interface ViewerSource {
  id?: string;
  userId?: string;
  role?: string;
  user?: { id: string; role?: string };
  positions?: Array<{ positionCode: string; unitId?: string | null }>;
}

/** Người xem từ ngữ cảnh phân quyền (có chức danh) hoặc từ người dùng đã xác thực (chỉ có vai trò). */
export function outgoingQueueViewerOf(source: ViewerSource): OutgoingQueueViewer {
  const user = source.user ?? source;
  const positions = source.positions ?? [];
  return {
    userId: (source.userId ?? user.id) as string,
    isClerk: user.role === "VAN_THU" || positions.some((p) => p.positionCode === OUTGOING_CLERK_POSITION),
    isSigner: positions.some((p) => p.positionCode === OUTGOING_SIGNER_POSITION),
    ledUnitIds: [
      ...new Set(
        positions
          .filter((p) => p.unitId && (isUnitLeaderPosition(p.positionCode) || isDeputyUnitLeaderPosition(p.positionCode)))
          .map((p) => p.unitId as string)
      ),
    ],
  };
}

/** Đầu ghi chú của dự thảo bị trả lại; bản ghi cũ ghi "[Trả lại soạn thảo …]" nên bỏ dấu đóng ngoặc (xem `isReturnedNote`). */
const RETURNED_NOTE_MARK = RETURNED_NOTE_PREFIX.replace("]", "");

const workflow = (where: Prisma.DocumentOutgoingWorkflowWhereInput): Prisma.DocumentWhereInput => ({
  outgoingWorkflow: { is: where },
});

/**
 * So sánh bằng trên cột có thể trống mà cho FALSE (không phải NULL) khi cột trống. Nhóm "Đã xử lý" bọc điều kiện chờ
 * trong `NOT`, và `NOT NULL` vẫn là NULL nên một nhánh so sánh với cột trống sẽ loại nhầm cả hàng.
 */
const eq = <K extends "contentReviewerId" | "authorizedSignerId" | "draftingUnitId">(
  field: K,
  value: string | { in: string[] }
): Prisma.DocumentOutgoingWorkflowWhereInput => ({ AND: [{ [field]: { not: null } }, { [field]: value }] });

/**
 * Văn bản đi đang chờ chính người xem làm bước của mình.
 * `attentionOnly`: bỏ bản nháp thường của chính mình (nằm đó đến khi soạn xong, không phải tín hiệu), chỉ giữ bản "Cần
 * sửa" bị trả lại; dùng cho chấm báo việc ở sidebar. Danh sách "Chờ xử lý" vẫn gồm mọi bản nháp của mình.
 */
export function outgoingAwaitingViewerWhere(
  viewer: OutgoingQueueViewer,
  options: { attentionOnly?: boolean } = {}
): Prisma.DocumentWhereInput {
  const me = viewer.userId;
  const branches: Prisma.DocumentWhereInput[] = [
    // Bản nháp và bản "Cần sửa" của chính mình; nháp của người khác không phải việc của mình.
    {
      registeredById: me,
      ...workflow({
        status: "DRAFT",
        ...(options.attentionOnly ? { contentReviewNotes: { startsWith: RETURNED_NOTE_MARK } } : {}),
      }),
    },
    // Duyệt nội dung: người được trình; dự thảo cũ chưa có người được trình thì trưởng/phó đơn vị soạn. Người soạn không tự duyệt.
    {
      registeredById: { not: me },
      ...workflow({
        status: "CONTENT_REVIEW",
        OR: [
          eq("contentReviewerId", me),
          ...(viewer.ledUnitIds.length
            ? [{ AND: [{ contentReviewerId: null }, eq("draftingUnitId", { in: viewer.ledUnitIds })] }]
            : []),
        ],
      }),
    },
    // Ký chức danh: người được chỉ định ký, hoặc Hiệu trưởng khi chưa chỉ định; người kiểm thể thức không tự ký.
    workflow({
      status: "AUTHORIZED_SIGN",
      authorizedSignedAt: null,
      OR: [eq("authorizedSignerId", me), ...(viewer.isSigner ? [{ authorizedSignerId: null }] : [])],
      AND: [{ OR: [{ formatReviewerId: null }, { formatReviewerId: { not: me } }] }],
    }),
  ];
  // Bản chưa có quy trình (dữ liệu cũ): chỉ của người soạn, chưa xử lý xong.
  if (!options.attentionOnly) {
    branches.push({ registeredById: me, outgoingWorkflow: { is: null }, status: { notIn: [...DOCUMENT_DONE_STATUSES] } });
  }
  if (viewer.isClerk) {
    branches.push(
      workflow({ status: "FORMAT_CHECK" }),
      // Cấp số, đóng dấu: người ký không tự làm (phân tách nhiệm vụ).
      workflow({
        status: "AUTHORIZED_SIGN",
        authorizedSignedAt: { not: null },
        OR: [{ authorizedSignerId: null }, { authorizedSignerId: { not: me } }],
      }),
      workflow({ status: "NUMBERED", OR: [{ authorizedSignerId: null }, { authorizedSignerId: { not: me } }] }),
      workflow({ status: "ORGANIZATION_SIGNED" })
    );
  }
  return { OR: branches };
}

const IN_FLIGHT = ["CONTENT_REVIEW", "FORMAT_CHECK", "AUTHORIZED_SIGN", "NUMBERED", "ORGANIZATION_SIGNED"] as const;

/** Văn bản đi người xem đã làm bước của mình (hoặc đã soạn) và đang ở người khác, chưa phát hành. */
export function outgoingHandledByViewerWhere(viewer: OutgoingQueueViewer): Prisma.DocumentWhereInput {
  const me = viewer.userId;
  return {
    AND: [
      workflow({ status: { in: [...IN_FLIGHT] } }),
      {
        OR: [
          { registeredById: me },
          workflow({ contentReviewerId: me }),
          workflow({ formatReviewerId: me }),
          workflow({ authorizedSignerId: me }),
          workflow({ numbererId: me }),
          workflow({ orgSignerId: me }),
        ],
      },
      { NOT: outgoingAwaitingViewerWhere(viewer) },
    ],
  };
}
