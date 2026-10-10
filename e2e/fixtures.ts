// Định danh cố định của dữ liệu E2E (tạo bởi global-setup). Mọi id có tiền tố `e2e_`.
export const E2E_USER_ID = "e2e_user";
export const E2E_UNIT_ID = "e2e_unit";
export const E2E_FILE_COUNTS = [0, 1, 5, 6, 12] as const;

export const docIdForFiles = (count: number) => `e2e_doc_files${count}`;
export const attachmentId = (docId: string, index: number) => `${docId}_att${index + 1}`;
export const DOC_LONG_ID = "e2e_doc_long"; // 1 tệp 60 trang
export const DOC_MIXED_ID = "e2e_doc_mixed"; // dọc / ngang / khổ lạ / xoay / scan / hỏng
export const DOC_OUTGOING_ID = "e2e_doc_outgoing"; // văn bản đi, 2 tệp
export const DOC_SUBMISSION_ID = "e2e_doc_submission"; // tờ trình, 3 tệp
export const DOC_EDIT_ID = "e2e_doc_edit"; // văn bản đến, 0 tệp: chỉ spec sửa thông tin/bổ sung tệp được thay đổi
