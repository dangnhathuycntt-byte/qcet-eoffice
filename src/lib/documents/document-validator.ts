import type {
  DocumentType,
  DocumentUrgency,
  DocumentSecurityLevel,
  DocumentStatus,
} from "@/types/document";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

const VALID_TYPES: DocumentType[] = [
  "VAN_BAN_DEN",
  "VAN_BAN_DI",
  "TO_TRINH_NOI_BO",
];

const VALID_URGENCIES: DocumentUrgency[] = [
  "THUONG",
  "KHAN",
  "THUONG_KHAN",
  "HOA_TOC",
  "normal",
  "urgent",
  "top_urgent",
  "flash",
];

const VALID_SECURITIES: DocumentSecurityLevel[] = [
  "THUONG",
  "MAT",
  "TOI_MAT",
  "TUYET_MAT",
];

const VALID_STATUSES: DocumentStatus[] = [
  "CHO_PHAN_CONG",
  "DANG_XU_LY",
  "CHO_PHE_DUYET",
  "DA_HOAN_THANH",
  "LUU_THEO_DOI",
  "pending_assignment",
  "processing",
  "delegated",
  "approved",
  "completed",
];

/**
 * Validates the payload for registering/creating a new document (ND 30/2020).
 */
export function validateDocumentCreatePayload(payload: any): ValidationResult {
  const errors: string[] = [];

  if (!payload || typeof payload !== "object") {
    return { isValid: false, errors: ["Payload phải là một đối tượng hợp lệ"] };
  }

  // 1. Loại văn bản (type)
  if (!payload.type || !VALID_TYPES.includes(payload.type)) {
    errors.push(
      `Loại văn bản không hợp lệ. Phải là một trong: ${VALID_TYPES.join(", ")}`
    );
  }

  // 2. Số ký hiệu văn bản gốc (originalNumber)
  if (
    typeof payload.originalNumber !== "string" ||
    !payload.originalNumber.trim()
  ) {
    errors.push("Số ký hiệu văn bản (originalNumber) là bắt buộc");
  }

  // 3. Ngày ban hành (issuedDate)
  if (!payload.issuedDate) {
    errors.push("Ngày ban hành (issuedDate) là bắt buộc");
  } else {
    const d = new Date(payload.issuedDate);
    if (isNaN(d.getTime())) {
      errors.push("Ngày ban hành (issuedDate) không đúng định dạng ngày tháng hợp lệ");
    }
  }

  // 4. Cơ quan ban hành (issuingAuthority)
  if (
    typeof payload.issuingAuthority !== "string" ||
    !payload.issuingAuthority.trim()
  ) {
    errors.push("Cơ quan ban hành (issuingAuthority) là bắt buộc");
  }

  // 5. Tên loại văn bản / thể thức (category)
  if (typeof payload.category !== "string" || !payload.category.trim()) {
    errors.push("Thể loại văn bản (category) là bắt buộc");
  }

  // 6. Trích yếu nội dung (summary)
  if (typeof payload.summary !== "string" || !payload.summary.trim()) {
    errors.push("Trích yếu nội dung (summary) là bắt buộc");
  }

  // 7. Người vào sổ tiếp nhận (registeredById)
  if (
    typeof payload.registeredById !== "string" ||
    !payload.registeredById.trim()
  ) {
    errors.push("Người đăng ký vào sổ (registeredById) là bắt buộc");
  }

  // 8. Kiểm tra mức độ khẩn (nếu có)
  if (payload.urgency && !VALID_URGENCIES.includes(payload.urgency)) {
    errors.push(
      `Độ khẩn không hợp lệ. Phải là một trong: ${VALID_URGENCIES.join(", ")}`
    );
  }

  // 9. Kiểm tra mức độ mật (nếu có)
  if (
    payload.securityLevel &&
    !VALID_SECURITIES.includes(payload.securityLevel)
  ) {
    errors.push(
      `Độ mật không hợp lệ. Phải là một trong: ${VALID_SECURITIES.join(", ")}`
    );
  }

  // 10. Kiểm tra trạng thái (nếu có)
  if (payload.status && !VALID_STATUSES.includes(payload.status)) {
    errors.push(
      `Trạng thái không hợp lệ. Phải là một trong: ${VALID_STATUSES.join(", ")}`
    );
  }

  // 11. Hạn xử lý (nếu có)
  if (payload.dueDate) {
    const due = new Date(payload.dueDate);
    if (isNaN(due.getTime())) {
      errors.push("Hạn xử lý (dueDate) không đúng định dạng ngày tháng hợp lệ");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates leadership directive payload (Bút phê BGH).
 */
export function validateDirectivePayload(payload: any): ValidationResult {
  const errors: string[] = [];

  if (!payload || typeof payload !== "object") {
    return { isValid: false, errors: ["Payload phải là một đối tượng hợp lệ"] };
  }

  // 1. Ý kiến chỉ đạo bút phê (instruction)
  if (
    typeof payload.instruction !== "string" ||
    !payload.instruction.trim()
  ) {
    errors.push("Nội dung chỉ đạo bút phê (instruction) là bắt buộc");
  }

  // 2. Đơn vị chủ trì tiếp nhận nhiệm vụ (leadUnitId — OrganizationalUnit.id|code)
  if (
    typeof payload.leadUnitId !== "string" ||
    !payload.leadUnitId.trim()
  ) {
    errors.push("Đơn vị chủ trì thực hiện (leadUnitId) là bắt buộc");
  }

  // 3. Hạn hoàn thành báo cáo (deadline) nếu có
  if (payload.deadline) {
    const d = new Date(payload.deadline);
    if (isNaN(d.getTime())) {
      errors.push("Hạn báo cáo (deadline) không đúng định dạng ngày tháng hợp lệ");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export const FORBIDDEN_PATCH_FIELDS = [
  "status",
  "signedAt",
  "signer",
  "signerName",
  "signerTitle",
  "authorizedSignerId",
  "authorizedSignedAt",
  "documentNumber",
  "registrationNumber",
  "originalNumber",
  "outgoingNumber",
  "numbererId",
  "numberedAt",
  "issuedAt",
  "issuedDate",
  "registeredDate",
  "type",
  "version",
] as const;

export const ALLOWED_DOCUMENT_UPDATE_FIELDS = [
  "summary",
  "notes",
  "category",
  "urgency",
  "securityLevel",
  "recipientList",
  "distributedCopies",
  "dueDate",
  "leadUnitId",
  "leadUserId",
] as const;

export function isWorkflowControlledField(fieldName: string): boolean {
  return (FORBIDDEN_PATCH_FIELDS as readonly string[]).includes(fieldName);
}

/**
 * Validates partial updates to an existing document.
 */
export function validateDocumentUpdatePayload(payload: any): ValidationResult {
  const errors: string[] = [];

  if (!payload || typeof payload !== "object") {
    return { isValid: false, errors: ["Payload phải là một đối tượng hợp lệ"] };
  }

  // Check for workflow-controlled fields
  const forbidden = Object.keys(payload).filter((field) => isWorkflowControlledField(field));
  if (forbidden.length > 0) {
    errors.push(
      `Các trường [${forbidden.join(", ")}] được kiểm soát bởi workflow, không thể cập nhật trực tiếp qua generic PATCH.`
    );
  }

  if (payload.status !== undefined && !VALID_STATUSES.includes(payload.status)) {
    errors.push(
      `Trạng thái không hợp lệ. Phải là một trong: ${VALID_STATUSES.join(", ")}`
    );
  }

  if (
    payload.urgency !== undefined &&
    !VALID_URGENCIES.includes(payload.urgency)
  ) {
    errors.push(
      `Độ khẩn không hợp lệ. Phải là một trong: ${VALID_URGENCIES.join(", ")}`
    );
  }

  if (
    payload.securityLevel !== undefined &&
    !VALID_SECURITIES.includes(payload.securityLevel)
  ) {
    errors.push(
      `Độ mật không hợp lệ. Phải là một trong: ${VALID_SECURITIES.join(", ")}`
    );
  }

  if (payload.dueDate !== undefined && payload.dueDate !== null) {
    const d = new Date(payload.dueDate);
    if (isNaN(d.getTime())) {
      errors.push("Hạn xử lý (dueDate) không đúng định dạng ngày tháng hợp lệ");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
