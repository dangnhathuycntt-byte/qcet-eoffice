/**
 * Giao diện kiểm chữ ký số của bên gửi (V-03, Q12, spec task-document-gap-spec.md).
 *
 * Chưa chọn nhà cung cấp kiểm chứng: cần cùng quyết định về chứng thư của liên thông (ADR-V08,
 * RFC-12). Bản mặc định luôn trả UNVERIFIED và không bao giờ trả VALID. Khi có nhà cung cấp được duyệt,
 * thay bằng `setSignatureVerifier` mà không đổi nghiệp vụ.
 */
import { SignatureVerificationStatus } from "@prisma/client";
import { logger } from "@/server/observability/logger";

export interface SignatureVerificationInput {
  documentId?: string;
  fileUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
}

export interface SignatureVerificationResult {
  status: SignatureVerificationStatus;
  /** Lý do ngắn hiển thị cho Văn thư. */
  detail: string | null;
}

export interface SignatureVerifier {
  readonly name: string;
  verify(input: SignatureVerificationInput): Promise<SignatureVerificationResult>;
}

export class UnverifiedSignatureVerifier implements SignatureVerifier {
  readonly name = "unverified-default";

  async verify(input: SignatureVerificationInput): Promise<SignatureVerificationResult> {
    return {
      status: SignatureVerificationStatus.UNVERIFIED,
      detail: input.fileUrl ? "Chưa tích hợp dịch vụ kiểm chữ ký số" : "Không có tệp đính kèm để kiểm chữ ký số",
    };
  }
}

let current: SignatureVerifier = new UnverifiedSignatureVerifier();

export function getSignatureVerifier(): SignatureVerifier {
  return current;
}

/** Đổi nhà cung cấp kiểm chữ ký (khi ADR-V08 duyệt) hoặc dùng bản giả lập trong kiểm thử. */
export function setSignatureVerifier(verifier: SignatureVerifier): void {
  current = verifier;
}

export function resetSignatureVerifier(): void {
  current = new UnverifiedSignatureVerifier();
}

/** Chữ ký chỉ được coi là hợp lệ khi nhà cung cấp xác nhận VALID; mọi trạng thái khác gắn cờ. */
export function isSignatureFlagged(status: SignatureVerificationStatus): boolean {
  return status !== SignatureVerificationStatus.VALID;
}

/** Không bao giờ ném lỗi: nhà cung cấp lỗi thì UNVERIFIED để việc tiếp nhận văn bản không bị chặn. */
export async function verifySignatureSafely(input: SignatureVerificationInput): Promise<SignatureVerificationResult> {
  try {
    const result = await current.verify(input);
    return { status: result.status, detail: result.detail?.slice(0, 300) ?? null };
  } catch (error) {
    logger.error("document.signature.verify_failed", { metadata: { verifier: current.name, documentId: input.documentId } }, error);
    return { status: SignatureVerificationStatus.UNVERIFIED, detail: "Dịch vụ kiểm chữ ký số không phản hồi" };
  }
}
