/**
 * Chuẩn hóa số ký hiệu và cơ quan ban hành để phát hiện văn bản đến trùng (V-02).
 * Hàm thuần, dùng chung cho server và kiểm thử.
 */

/** Giá trị mặc định khi văn bản không có số; không bao giờ coi là trùng. */
export const PLACEHOLDER_DOCUMENT_NUMBER = "CHƯA_CÓ_SỐ";

function collapse(value: string | null | undefined): string {
  return (value ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
}

export function normalizeDocumentNumber(value: string | null | undefined): string {
  return collapse(value).replace(/\s*\/\s*/g, "/").toLocaleUpperCase("vi-VN");
}

export function normalizeIssuingAuthority(value: string | null | undefined): string {
  return collapse(value).toLocaleLowerCase("vi-VN");
}

export function isPlaceholderDocumentNumber(value: string | null | undefined): boolean {
  const normalized = normalizeDocumentNumber(value);
  return normalized === "" || normalized === PLACEHOLDER_DOCUMENT_NUMBER;
}

/** Hai văn bản trùng khi cùng số ký hiệu và cùng cơ quan ban hành sau chuẩn hóa. */
export function isSameIncomingDocument(
  a: { originalNumber: string | null | undefined; issuingAuthority: string | null | undefined },
  b: { originalNumber: string | null | undefined; issuingAuthority: string | null | undefined }
): boolean {
  if (isPlaceholderDocumentNumber(a.originalNumber) || isPlaceholderDocumentNumber(b.originalNumber)) {
    return false;
  }
  return (
    normalizeDocumentNumber(a.originalNumber) === normalizeDocumentNumber(b.originalNumber) &&
    normalizeIssuingAuthority(a.issuingAuthority) === normalizeIssuingAuthority(b.issuingAuthority)
  );
}
