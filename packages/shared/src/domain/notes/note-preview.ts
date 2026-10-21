/**
 * Chữ của ghi chú cá nhân cho thẻ trong lưới (kiểu Google Keep) và dòng trích. Nội dung soạn bằng editor khối (cùng editor
 * với mô tả nhiệm vụ) được lưu dạng khối QCET JSON v1; ghi chú cũ là chữ thuần. Máy chủ dùng khi trả danh sách, trình duyệt
 * dùng khi cập nhật thẻ theo chữ đang gõ.
 */
import { PERSONAL_NOTE_PREVIEW_MAX } from "@qcet/contracts/personal-notes";
import { parseContentToBlocks } from "@qcet/shared/lib/tasks/plate-block-codec";

const EXCERPT_LENGTH = 160;

function isBlockContent(content: string): boolean {
  return content.trimStart().startsWith("{") && content.includes('"qcetBlocks":true');
}

/** Khối → từng dòng chữ: danh sách giữ dấu đầu dòng, việc cần làm hiện ô tích, ảnh/tệp thành một dòng nhãn. */
function blocksToText(content: string): string {
  let number = 0;
  return parseContentToBlocks(content)
    .flatMap((block) => {
      if (block.type !== "numbered_list") number = 0;
      const text = (block.content || "").trim();
      switch (block.type) {
        case "bulleted_list":
          return text ? [`• ${text}`] : [];
        case "numbered_list":
          number += 1;
          return text ? [`${number}. ${text}`] : [];
        case "checklist":
          return text ? [`${block.checked ? "☑" : "☐"} ${text}`] : [];
        case "table":
          return (block.rows ?? []).map((row) => row.cells.map((cell) => (cell.content || "").trim()).join(" | "));
        case "image":
          return [block.caption?.trim() ? `Ảnh: ${block.caption.trim()}` : "Ảnh"];
        case "attachment":
          return [`Tệp: ${block.fileName || text || "đính kèm"}`];
        case "link":
        case "bookmark":
          return [text || block.url || ""].filter(Boolean);
        case "divider":
        case "media_embed":
          return [];
        default:
          return text ? [text] : [];
      }
    })
    .join("\n");
}

/** Chữ của nội dung ghi chú, giữ xuống dòng. */
export function noteContentText(content: string): string {
  return isBlockContent(content) ? blocksToText(content) : content;
}

/** Dòng trích một dòng (khoảng trắng gộp, 160 ký tự) cho tiêu đề hộp xác nhận xóa, kết quả tìm. */
export function toNoteExcerpt(content: string): string {
  return noteContentText(content).replace(/\s+/g, " ").trim().slice(0, EXCERPT_LENGTH);
}

/**
 * Đoạn đầu cho thẻ: giữ xuống dòng để thẻ hiện đúng dạng người viết, gộp nhiều dòng trống liền nhau thành một, bỏ dòng trống
 * đầu và khoảng trắng cuối, tối đa `PERSONAL_NOTE_PREVIEW_MAX` ký tự (thẻ còn cắt theo số dòng).
 */
export function toNotePreview(content: string): string {
  return noteContentText(content)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .trimEnd()
    .slice(0, PERSONAL_NOTE_PREVIEW_MAX);
}
