/**
 * Tham số `type` trên URL/API của văn bản nhận cả mã chuẩn lẫn bí danh cũ
 * (`inbox`, `INCOMING`…). Hàm thuần, dùng chung cho danh sách, thống kê và xuất sổ.
 */

export type DocumentTypeCode = "VAN_BAN_DEN" | "VAN_BAN_DI" | "TO_TRINH_NOI_BO";

const ALIASES: Record<string, DocumentTypeCode> = {
  VAN_BAN_DEN: "VAN_BAN_DEN",
  INCOMING: "VAN_BAN_DEN",
  inbox: "VAN_BAN_DEN",
  VAN_BAN_DI: "VAN_BAN_DI",
  OUTGOING: "VAN_BAN_DI",
  outbox: "VAN_BAN_DI",
  TO_TRINH_NOI_BO: "TO_TRINH_NOI_BO",
  INTERNAL: "TO_TRINH_NOI_BO",
  submission: "TO_TRINH_NOI_BO",
};

/** Mã loại văn bản chuẩn, hoặc null khi không có/không nhận ra (nghĩa là mọi loại). */
export function resolveDocumentTypeParam(value: string | null | undefined): DocumentTypeCode | null {
  return value ? ALIASES[value] ?? null : null;
}
