/**
 * Lịch sử chat của Trợ lý: hàm thuần, không đụng CSDL. Mọi ngày tính theo lịch ICT (Asia/Ho_Chi_Minh),
 * nên kết quả không phụ thuộc múi giờ của máy chủ.
 */
import { ASSISTANT_RETENTION_DAYS } from "@qcet/contracts/assistant";
import { formatRecencyTime, groupByRecency, ictDayIndex, type RecencyGroup } from "@qcet/shared/lib/format/recency";

const DAY_MS = 86_400_000;
const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;
const NEW_CONVERSATION_TITLE = "Cuộc trò chuyện mới";
const TITLE_MAX_CHARS = 80;

/** Tiêu đề từ câu hỏi đầu tiên: gộp khoảng trắng, bỏ ký hiệu đầu dòng, cắt ở ranh giới từ nếu quá dài. */
export function deriveConversationTitle(message: string): string {
  const text = message
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s#>*\-•]+/, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? clampTitle(text) : NEW_CONVERSATION_TITLE;
}

/**
 * Tên do mô hình đặt (cuộc mới): dòng đầu có chữ, bỏ ký hiệu markdown, nhãn kiểu "Tiêu đề:", ngoặc kép bao quanh và
 * dấu câu cuối, cắt như tên lấy từ câu hỏi. Không còn chữ thì null để giữ tên đang có.
 */
export function cleanGeneratedTitle(raw: string): string | null {
  const line = raw.split(/\r?\n/).map((item) => item.trim()).find(Boolean) ?? "";
  const text = line
    .replace(/^[\s#>*\-•]+/u, "")
    .replace(/[*_`]+/g, "")
    .replace(/^(?:tên cuộc trò chuyện|tiêu đề|tên|title)\s*[:：]\s*/iu, "")
    .replace(/^["'“”‘’«»\s]+|["'“”‘’«»\s]+$/gu, "")
    .replace(/[\s.。:;,!?…]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();
  return text ? clampTitle(text) : null;
}

/** Cắt ở ranh giới từ: 79 ký tự đầu rồi thêm "…" để tổng không vượt 80 ký tự. */
function clampTitle(text: string): string {
  const chars = Array.from(text);
  if (chars.length <= TITLE_MAX_CHARS) return text;
  const head = chars.slice(0, TITLE_MAX_CHARS - 1).join("");
  const lastSpace = head.lastIndexOf(" ");
  const cut = lastSpace > 0 ? head.slice(0, lastSpace) : head;
  return `${cut.trimEnd()}…`;
}

/**
 * Mốc giữ lại: 00:00 ICT của ngày cách hôm nay `days` ngày. Cuộc trò chuyện có tin cuối trước mốc này là quá hạn.
 */
export function retentionCutoff(now: Date, days: number = ASSISTANT_RETENTION_DAYS): Date {
  return new Date((ictDayIndex(now) - days) * DAY_MS - ICT_OFFSET_MS);
}

export type ConversationGroup<T> = RecencyGroup<T>;

/**
 * Nhóm cuộc trò chuyện theo ngày lịch ICT: Hôm nay, Hôm qua, 7 ngày qua, rồi từng tháng giảm dần (xem `groupByRecency`).
 */
export function groupConversationsByRecency<T extends { lastMessageAt: string }>(items: T[], now: Date): ConversationGroup<T>[] {
  return groupByRecency(items, (item) => item.lastMessageAt, now);
}

/**
 * Nhãn thời gian của một cuộc trò chuyện. `short` (trong danh sách): hôm nay "14:05", trong 7 ngày "dd/MM",
 * cũ hơn "dd/MM/yyyy". `full` (tooltip): "14:05, 17/10/2026".
 */
export const formatConversationTime = formatRecencyTime;
