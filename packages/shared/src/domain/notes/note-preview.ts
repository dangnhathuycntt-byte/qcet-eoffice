/**
 * Chữ của ghi chú cá nhân cho thẻ trong lưới (kiểu Google Keep) và dòng trích. Nội dung soạn bằng editor khối (cùng editor
 * với mô tả nhiệm vụ) được lưu dạng khối QCET JSON v1; ghi chú cũ là chữ thuần. Máy chủ dùng khi trả danh sách, trình duyệt
 * dùng khi cập nhật thẻ theo chữ đang gõ.
 */
import { PERSONAL_NOTE_PREVIEW_MAX, type NoteCardImage, type NotePreviewLine } from "@qcet/contracts/personal-notes";
import { parseContentToBlocks } from "@qcet/shared/lib/tasks/plate-block-codec";

const EXCERPT_LENGTH = 160;
/** Thẻ hiện tối đa 6 ảnh ở đầu (lưới 2–3 cột như Google Keep). */
export const NOTE_CARD_IMAGES_MAX = 6;

function isBlockContent(content: string): boolean {
  return content.trimStart().startsWith("{") && content.includes('"qcetBlocks":true');
}

/** `imageUrl`: dòng nhãn của một khối ảnh (để thẻ bỏ dòng đó khi ảnh đã hiện bằng hình). */
type TextLine = { text: string; heading?: boolean; imageUrl?: string };

/** Khối → từng dòng chữ: danh sách giữ dấu đầu dòng, việc cần làm hiện ô tích, ảnh/tệp thành một dòng nhãn. */
function blocksToLines(content: string): TextLine[] {
  let number = 0;
  return parseContentToBlocks(content).flatMap((block): TextLine[] => {
    if (block.type !== "numbered_list") number = 0;
    const text = (block.content || "").trim();
    switch (block.type) {
      case "heading":
        return text ? [{ text, heading: true }] : [];
      case "bulleted_list":
        return text ? [{ text: `• ${text}` }] : [];
      case "numbered_list":
        number += 1;
        return text ? [{ text: `${number}. ${text}` }] : [];
      case "checklist":
        return text ? [{ text: `${block.checked ? "☑" : "☐"} ${text}` }] : [];
      case "table":
        return (block.rows ?? []).map((row) => ({ text: row.cells.map((cell) => (cell.content || "").trim()).join(" | ") }));
      case "image":
        return [{ text: block.caption?.trim() ? `Ảnh: ${block.caption.trim()}` : "Ảnh", imageUrl: block.url || "" }];
      case "attachment":
        return [{ text: `Tệp: ${block.fileName || text || "đính kèm"}` }];
      case "link":
      case "bookmark":
        return text || block.url ? [{ text: text || block.url || "" }] : [];
      case "divider":
      case "media_embed":
        return [];
      default:
        return text ? text.split("\n").map((line) => ({ text: line })) : [];
    }
  });
}

function contentLines(content: string): TextLine[] {
  return isBlockContent(content) ? blocksToLines(content) : content.split(/\r\n?|\n/).map((text) => ({ text }));
}

/** Chữ của nội dung ghi chú, giữ xuống dòng (ảnh là dòng "Ảnh: chú thích" để tìm và trích vẫn thấy). */
export function noteContentText(content: string): string {
  return isBlockContent(content) ? blocksToLines(content).map((line) => line.text).join("\n") : content;
}

/**
 * Ảnh hiện ở đầu thẻ (như Google Keep), theo thứ tự trong ghi chú. Chỉ ảnh đã tải lên máy chủ: bỏ `blob:` (chỉ còn trong
 * phiên soạn) và `data:` (nặng, không đưa vào danh sách).
 */
export function noteCardImages(content: string): NoteCardImage[] {
  if (!isBlockContent(content)) return [];
  return parseContentToBlocks(content)
    .filter((block) => block.type === "image" && typeof block.url === "string" && /^(\/|https?:\/\/)/.test(block.url))
    .slice(0, NOTE_CARD_IMAGES_MAX)
    .map((block) => ({ url: block.url as string, caption: (block.caption || "").trim() }));
}

/**
 * Dòng chữ của thẻ: tiêu đề khối được đánh dấu để thẻ in đậm; ảnh đã tải lên không thành dòng chữ vì hiện bằng hình ở đầu
 * thẻ. Gộp dòng trống liền nhau, bỏ dòng trống đầu/cuối, tối đa `PERSONAL_NOTE_PREVIEW_MAX` ký tự (thẻ còn cắt theo số dòng).
 */
export function toNotePreviewLines(content: string): NotePreviewLine[] {
  const shown = new Set(noteCardImages(content).map((image) => image.url));
  const lines: NotePreviewLine[] = [];
  let budget = PERSONAL_NOTE_PREVIEW_MAX;
  for (const line of contentLines(content)) {
    if (line.imageUrl && shown.has(line.imageUrl)) continue;
    const text = line.text.replace(/[ \t]+$/, "");
    const blank = text.trim() === "";
    if (blank && (lines.length === 0 || lines[lines.length - 1].text === "")) continue;
    if (budget <= 0) break;
    const clipped = text.slice(0, budget);
    budget -= clipped.length + 1;
    lines.push(line.heading ? { text: clipped, heading: true } : { text: blank ? "" : clipped });
  }
  while (lines.length > 0 && lines[lines.length - 1].text === "") lines.pop();
  return lines;
}

/** Dòng trích một dòng (khoảng trắng gộp, 160 ký tự) cho tiêu đề hộp xác nhận xóa, kết quả tìm. */
export function toNoteExcerpt(content: string): string {
  return noteContentText(content).replace(/\s+/g, " ").trim().slice(0, EXCERPT_LENGTH);
}

/** Các trường của thẻ trong danh sách tính từ nội dung: máy chủ khi trả danh sách, trình duyệt khi thẻ theo chữ đang gõ. */
export function toNoteCardFields(content: string): { excerpt: string; previewLines: NotePreviewLine[]; images: NoteCardImage[] } {
  return { excerpt: toNoteExcerpt(content), previewLines: toNotePreviewLines(content), images: noteCardImages(content) };
}
