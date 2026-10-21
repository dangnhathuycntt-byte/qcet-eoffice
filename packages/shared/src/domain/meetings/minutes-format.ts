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
  // Đứng riêng: đầu văn bản, sau dòng trống, hoặc ngay sau một ý (người gõ tay hay viết "Kết luận:" sát ý cuối của mục trước).
  // Dòng nối tiếp của một đoạn văn thì không phải tiêu đề.
  const afterBreak = prev === undefined || !prev.trim();
  const afterItem = prev !== undefined && LIST_LINE.test(prev);
  if (!afterBreak && !afterItem) return false;
  if (text.split(/\s+/).length > HEADING_MAX_WORDS) return false;
  if (/[:：]$/.test(text)) return true;
  // Agent đôi khi bỏ dấu hai chấm ("Kết luận" rồi xuống dòng là các ý): dòng ngắn không có dấu câu cuối, ngay trên một ý. Chỉ
  // nhận khi đứng sau dòng trống: sát dưới một ý thì đó có thể là phần ý bị gõ xuống dòng
  return afterBreak && !/[.!?…;,]$/.test(text) && next !== undefined && LIST_LINE.test(next);
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

export interface RecordingMinutesParts {
  minutesDraft: string | null;
  decisions: string[];
  actionItems: Array<{ task: string; owner: string | null; deadline: string | null }>;
}

/**
 * Biên bản đề xuất của một bản ghi kèm quyết định và việc được giao, thành một khối chữ: đúng chữ "Dùng làm biên bản nháp"
 * điền vào ô soạn và thẻ biên bản của Trợ lý lưu khi soạn từ bản ghi (`propose_minutes` với `recordingId`).
 */
export function composeRecordingMinutes(detail: RecordingMinutesParts): string {
  const sections = [detail.minutesDraft?.trim() ?? ""];
  if (detail.decisions.length > 0) sections.push(["Quyết định:", ...detail.decisions.map((decision) => `- ${decision}`)].join("\n"));
  if (detail.actionItems.length > 0) {
    sections.push(
      [
        "Việc được giao:",
        ...detail.actionItems.map((item) => {
          const extra = [item.owner, item.deadline ? `hạn ${item.deadline}` : null].filter(Boolean).join(", ");
          return `- ${item.task}${extra ? ` (${extra})` : ""}`;
        }),
      ].join("\n")
    );
  }
  return sections.filter(Boolean).join("\n\n");
}
