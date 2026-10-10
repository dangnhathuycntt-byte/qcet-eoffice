/**
 * Quy tắc thu hồi và thay thế văn bản đi (V-05, quyết định Q10). Thuần túy, không đọc DB.
 * Chỉ thu hồi khi chưa nơi nhận nào tiếp nhận; đã tiếp nhận thì chỉ thay thế bằng văn bản có số mới.
 */

export const RECALLABLE_STATUSES = ["ISSUED", "DELIVERED"] as const;

export type RecallVerdict = { ok: true } | { ok: false; code: string; message: string };

export function evaluateRecall(status: string, recipients: Array<{ receivedAt: Date | null }>): RecallVerdict {
  if (!(RECALLABLE_STATUSES as readonly string[]).includes(status)) {
    return {
      ok: false,
      code: "OUTGOING_NOT_RECALLABLE",
      message: "Chỉ thu hồi được văn bản đã phát hành và chưa lưu trữ, chưa thu hồi.",
    };
  }
  if (recipients.some((r) => r.receivedAt)) {
    return {
      ok: false,
      code: "RECALL_AFTER_RECEIPT",
      message: "Đã có nơi nhận tiếp nhận văn bản nên không thu hồi được. Hãy phát hành văn bản thay thế với số mới.",
    };
  }
  return { ok: true };
}

/**
 * Văn bản được thay thế phải đã thu hồi, hoặc đã có nơi nhận tiếp nhận (không thể thu hồi nữa).
 * Văn bản phát hành mà chưa ai tiếp nhận phải thu hồi trước để không có hai văn bản cùng hiệu lực.
 */
export function evaluateReplacementTarget(status: string, recipients: Array<{ receivedAt: Date | null }>): RecallVerdict {
  if (status === "RECALLED") return { ok: true };
  const issued = ["ISSUED", "DELIVERED", "FILED", "ARCHIVED"].includes(status);
  if (issued && recipients.some((r) => r.receivedAt)) return { ok: true };
  return {
    ok: false,
    code: "REPLACEMENT_NOT_ALLOWED",
    message: issued
      ? "Văn bản cần thay thế chưa có nơi nhận tiếp nhận: hãy thu hồi trước rồi phát hành bản thay thế."
      : "Văn bản cần thay thế chưa được phát hành.",
  };
}
