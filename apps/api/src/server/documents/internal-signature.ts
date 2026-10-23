/**
 * Bản ghi ký của văn bản đi là xác nhận nội bộ: QCET chưa ký số bằng chứng thư (spec Văn bản G1, quyết định D1), nên bản
 * ghi không được mang trạng thái VALID hay tên nhà cung cấp CA. Trạng thái `UNVERIFIED` nói đúng điều đó; khi có chữ ký
 * số thật thì bước tích hợp ghi VALID kèm chứng thư đã kiểm. Thông tin chứng thư do máy khách gửi lên không kiểm được
 * nên chỉ lưu dưới khóa `claimed`, không thành bằng chứng.
 */
import { Prisma, SignatureVerificationStatus } from "@prisma/client";

export const INTERNAL_CONFIRMATION_STATUS = SignatureVerificationStatus.UNVERIFIED;

export function internalConfirmationMetadata(claimed?: Record<string, unknown> | null): Prisma.InputJsonValue {
  const hasClaim = claimed && Object.keys(claimed).length > 0;
  return { method: "INTERNAL_CONFIRMATION", ...(hasClaim ? { claimed: claimed as Prisma.InputJsonObject } : {}) };
}
