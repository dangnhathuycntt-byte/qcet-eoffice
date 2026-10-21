/**
 * Đoạn đầu nội dung ghi chú cá nhân cho thẻ trong lưới (kiểu Google Keep): giữ xuống dòng để thẻ hiện đúng dạng người viết,
 * gộp nhiều dòng trống liền nhau thành một, bỏ dòng trống đầu và khoảng trắng cuối, tối đa `PERSONAL_NOTE_PREVIEW_MAX` ký tự
 * (thẻ còn cắt theo số dòng). Máy chủ dùng khi trả danh sách, trình duyệt dùng khi cập nhật thẻ theo chữ đang gõ.
 */
import { PERSONAL_NOTE_PREVIEW_MAX } from "@qcet/contracts/personal-notes";

export function toNotePreview(content: string): string {
  return content
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .trimEnd()
    .slice(0, PERSONAL_NOTE_PREVIEW_MAX);
}
