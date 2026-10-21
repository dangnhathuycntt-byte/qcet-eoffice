/**
 * Chia danh sách theo độ mới, tính theo ngày lịch ICT (Asia/Ho_Chi_Minh) nên không phụ thuộc múi giờ của máy: Hôm nay, Hôm qua,
 * 7 ngày qua, rồi từng tháng giảm dần (như lịch sử chat của Linear, danh sách của Apple Notes). Dùng chung cho lịch sử Trợ lý
 * và Ghi chú cá nhân.
 */
import { DATE_FALLBACK, formatCompactDate, formatDisplayDate, formatTime, toIctDateTimeParts } from "@qcet/shared/lib/format/date";

const DAY_MS = 86_400_000;

/** Số ngày lịch ICT tính từ epoch của ngày hiển thị trong `input`; NaN nếu thời gian không hợp lệ. */
export function ictDayIndex(input: Date | string): number {
  const parts = toIctDateTimeParts(input);
  return parts ? Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS : Number.NaN;
}

export interface RecencyGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/**
 * Giữ thứ tự đầu vào trong mỗi nhóm; bỏ nhóm rỗng. Thời gian sau `now` (lệch đồng hồ) xếp vào "Hôm nay"; thời gian lỗi bỏ qua
 * (máy chủ luôn trả ISO hợp lệ nên thực tế không xảy ra).
 */
export function groupByRecency<T>(items: T[], timeOf: (item: T) => string, now: Date): RecencyGroup<T>[] {
  const today = ictDayIndex(now);
  const todayGroup: RecencyGroup<T> = { key: "today", label: "Hôm nay", items: [] };
  const yesterdayGroup: RecencyGroup<T> = { key: "yesterday", label: "Hôm qua", items: [] };
  const lastSevenGroup: RecencyGroup<T> = { key: "last7", label: "7 ngày qua", items: [] };
  const monthGroups = new Map<string, RecencyGroup<T>>();

  for (const item of items) {
    const day = ictDayIndex(timeOf(item));
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
 * Nhãn thời gian của một dòng. `short` (trong danh sách): hôm nay "14:05", trong 7 ngày "dd/MM", cũ hơn "dd/MM/yyyy".
 * `full` (tooltip): "14:05, 17/10/2026".
 */
export function formatRecencyTime(iso: string, now: Date): { short: string; full: string } {
  const day = ictDayIndex(iso);
  if (Number.isNaN(day)) return { short: DATE_FALLBACK, full: DATE_FALLBACK };
  const age = ictDayIndex(now) - day;
  const time = formatTime(iso);
  const full = `${time}, ${formatDisplayDate(iso)}`;
  if (age <= 0) return { short: time, full };
  if (age <= 7) return { short: formatCompactDate(iso), full };
  return { short: formatDisplayDate(iso), full };
}
