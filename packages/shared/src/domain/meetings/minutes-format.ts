/**
 * Biên bản và nội dung cuộc họp lưu dạng chữ thuần theo cách gõ quen của văn bản hành chính (mục "Kết luận:" đứng riêng một
 * dòng, ý "- ", ý con "+ "), cũng là dạng Agent được dặn trả về (`MINUTES_FORMAT_LINES` ở recording-transcript.ts). Hàm này
 * đổi sang dạng Markdown tối giản mà `parseAgentReply` dựng được: dòng mục thành tiêu đề, "+ " thành mục con. Chỉ để hiển
 * thị: chữ lưu, ô soạn và "Sao chép" vẫn giữ nguyên chữ gốc.
 */

const LIST_LINE = /^\s*(?:[-*•+]|\d+[.)])\s+/;
const PLUS_ITEM = /^\s*\+\s+(.*)$/;
/** Dòng đã có định dạng riêng (tiêu đề, trích dẫn, bảng) thì để nguyên. */
const MARKUP_LINE = /^\s*(?:#|>|\|)/;
const HEADING_MAX_WORDS = 8;

function isHeadingLine(line: string, prev: string | undefined, next: string | undefined): boolean {
  const text = line.trim();
  if (!text || LIST_LINE.test(line) || MARKUP_LINE.test(line)) return false;
  // Đứng riêng: đầu văn bản hoặc sau dòng trống (dòng nối tiếp của một đoạn không phải tiêu đề)
  if (prev !== undefined && prev.trim()) return false;
  if (text.split(/\s+/).length > HEADING_MAX_WORDS) return false;
  if (/[:：]$/.test(text)) return true;
  // Agent đôi khi bỏ dấu hai chấm ("Kết luận" rồi xuống dòng là các ý): dòng ngắn không có dấu câu cuối, ngay trên một ý
  return !/[.!?…;,]$/.test(text) && next !== undefined && LIST_LINE.test(next);
}

export function minutesToReplyMarkup(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  return lines
    .map((line, index) => {
      const plus = line.match(PLUS_ITEM);
      if (plus) return `  - ${plus[1]}`;
      if (isHeadingLine(line, lines[index - 1], lines[index + 1])) return `### ${line.trim().replace(/\s*[:：]$/, "")}`;
      return line;
    })
    .join("\n");
}
