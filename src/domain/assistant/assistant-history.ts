/**
 * Lịch sử chat của Trợ lý: hàm thuần, không đụng CSDL. Mọi ngày tính theo lịch ICT (Asia/Ho_Chi_Minh),
 * nên kết quả không phụ thuộc múi giờ của máy chủ.
 */
import { ASSISTANT_RETENTION_DAYS } from "@/contracts/assistant";
import { DATE_FALLBACK, formatCompactDate, formatDisplayDate, formatTime, toIctDateTimeParts } from "@/lib/format/date";

const DAY_MS = 86_400_000;
const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;
const NEW_CONVERSATION_TITLE = "Cuộc trò chuyện mới";
const TITLE_MAX_CHARS = 80;

/** Số ngày lịch ICT tính từ epoch của ngày hiển thị trong `input`; NaN nếu thời gian không hợp lệ. */
function ictDayIndex(input: Date | string): number {
  const parts = toIctDateTimeParts(input);
  return parts ? Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS : Number.NaN;
}

/** Tiêu đề từ câu hỏi đầu tiên: gộp khoảng trắng, bỏ ký hiệu đầu dòng, cắt ở ranh giới từ nếu quá dài. */
export function deriveConversationTitle(message: string): string {
  const text = message
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s#>*\-•]+/, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return NEW_CONVERSATION_TITLE;
  const chars = Array.from(text);
  if (chars.length <= TITLE_MAX_CHARS) return text;
  // Cắt 79 ký tự đầu rồi thêm "…" để tổng không vượt 80 ký tự
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

export interface ConversationGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/**
 * Nhóm cuộc trò chuyện theo ngày lịch ICT: Hôm nay, Hôm qua, 7 ngày qua, rồi từng tháng giảm dần.
 * Giữ thứ tự đầu vào trong mỗi nhóm; bỏ nhóm rỗng. Tin có thời gian sau `now` (lệch đồng hồ) xếp vào "Hôm nay".
 */
export function groupConversationsByRecency<T extends { lastMessageAt: string }>(items: T[], now: Date): ConversationGroup<T>[] {
  const today = ictDayIndex(now);
  const todayGroup: ConversationGroup<T> = { key: "today", label: "Hôm nay", items: [] };
  const yesterdayGroup: ConversationGroup<T> = { key: "yesterday", label: "Hôm qua", items: [] };
  const lastSevenGroup: ConversationGroup<T> = { key: "last7", label: "7 ngày qua", items: [] };
  const monthGroups = new Map<string, ConversationGroup<T>>();

  for (const item of items) {
    const day = ictDayIndex(item.lastMessageAt);
    // Thời gian lỗi không xếp được nhóm; máy chủ luôn trả ISO hợp lệ nên nhánh này không xảy ra thực tế
    if (Number.isNaN(day)) continue;
    const age = today - day;
    if (age <= 0) {
      todayGroup.items.push(item);
    } else if (age === 1) {
      yesterdayGroup.items.push(item);
    } else if (age <= 7) {
      lastSevenGroup.items.push(item);
    } else {
      const date = new Date(day * DAY_MS);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1;
      const key = `month:${year}-${String(month).padStart(2, "0")}`;
      let group = monthGroups.get(key);
      if (!group) {
        group = { key, label: `Tháng ${month}/${year}`, items: [] };
        monthGroups.set(key, group);
      }
      group.items.push(item);
    }
  }

  // Khóa dạng YYYY-MM có số 0 đệm nên so sánh chuỗi đúng thứ tự thời gian
  const sortedMonths = [...monthGroups.values()].sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
  return [todayGroup, yesterdayGroup, lastSevenGroup, ...sortedMonths].filter((group) => group.items.length > 0);
}

/**
 * Nhãn thời gian của một cuộc trò chuyện. `short` (trong danh sách): hôm nay "14:05", trong 7 ngày "dd/MM",
 * cũ hơn "dd/MM/yyyy". `full` (tooltip): "14:05, 17/10/2026".
 */
export function formatConversationTime(iso: string, now: Date): { short: string; full: string } {
  const day = ictDayIndex(iso);
  if (Number.isNaN(day)) return { short: DATE_FALLBACK, full: DATE_FALLBACK };
  const age = ictDayIndex(now) - day;
  const time = formatTime(iso);
  const full = `${time}, ${formatDisplayDate(iso)}`;
  if (age <= 0) return { short: time, full };
  if (age <= 7) return { short: formatCompactDate(iso), full };
  return { short: formatDisplayDate(iso), full };
}
