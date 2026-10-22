/**
 * Văn bản đến trong trường phát sinh từ phát hành văn bản đi, như gửi thư (ADR-015): không tạo bản sao văn bản đến,
 * đơn vị có tên trong nơi nhận đọc được chính văn bản đi đó từ lúc phát hành. Thuần túy, không đọc DB.
 */

/** Trạng thái văn bản đi đã tới tay nơi nhận (kể cả đã thu hồi, để nơi nhận còn mở được thông báo thu hồi). */
export const DELIVERED_OUTGOING_STATUSES = ["ISSUED", "DELIVERED", "FILED", "ARCHIVED", "RECALLED"] as const;

/** Văn bản còn chờ nơi nhận tiếp nhận: đã phát hành, chưa thu hồi, chưa lưu trữ. */
export const AWAITING_RECEIPT_STATUSES = ["ISSUED", "DELIVERED"] as const;

interface DeliveryShape {
  outgoingWorkflow?: { status?: string | null } | null;
  outgoingRecipients?: Array<{ kind?: string | null; unitId?: string | null }> | null;
}

/**
 * Đơn vị trong trường đã nhận văn bản đi này; rỗng khi chưa phát hành hoặc không phải văn bản đi. Không xét `type`:
 * chỉ văn bản đi có `outgoingWorkflow`, còn tài nguyên phân quyền đổi `type` thành `document_outgoing`.
 */
export function deliveredUnitIds(doc: DeliveryShape): string[] {
  const status = doc.outgoingWorkflow?.status;
  if (!status || !(DELIVERED_OUTGOING_STATUSES as readonly string[]).includes(status)) return [];
  return [
    ...new Set(
      (doc.outgoingRecipients ?? [])
        .filter((r) => r.kind === "INTERNAL_UNIT" && r.unitId)
        .map((r) => r.unitId as string)
    ),
  ];
}
