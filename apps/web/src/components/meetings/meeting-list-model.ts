/**
 * Phần không phải giao diện của trang Cuộc họp: hàng danh sách, khoảng thời gian của bộ lọc, thao tác được phép trên một hàng,
 * dữ liệu xuất Excel và tùy chọn hiển thị (cột, sắp xếp) lưu ở trình duyệt.
 */
import { MEETING_SORT_FIELDS, type MeetingBucket, type MeetingSortField } from "@qcet/contracts/meeting";
import { addCalendarDays } from "@qcet/shared/lib/academic-calendar";
import { formatDisplayDate, formatTime, formatWeekday } from "@qcet/shared/lib/format/date";
import { meetingStatus } from "@/components/meetings/meeting-status";

export interface MeetingRow {
  id: string;
  title: string;
  status: string;
  startTime: string;
  endTime: string | null;
  location: string | null;
  organizer: { id: string; name: string; avatarUrl?: string | null } | null;
  unit: { name: string } | null;
  _count: { participants: number; resolutions: number };
  /** Thao tác máy chủ cho phép người đang xem trên cuộc họp này (`meeting.update`…). */
  availableActions: string[];
}

export const MEETING_STATUSES = ["DRAFT_AGENDA", "INVITED", "HELD", "MINUTES_DRAFT", "MINUTES_CONFIRMED", "CANCELLED"] as const;

/**
 * Trạng thái chọn được trong bộ lọc theo tab đang mở. Tab chia theo thời gian nên cuộc họp đã qua giờ mà còn "Dự thảo chương
 * trình" nằm ở Đã họp; mọi trạng thái trừ Đã hủy (chỉ ở Tất cả) đều có thể gặp ở cả hai tab.
 */
export function statusOptionsFor(bucket: MeetingBucket | "all"): string[] {
  return bucket === "all" ? [...MEETING_STATUSES] : MEETING_STATUSES.filter((status) => status !== "CANCELLED");
}

export const MEETING_TIME_FILTERS = [
  { value: "today", label: "Hôm nay" },
  { value: "week", label: "Tuần này" },
  { value: "month", label: "Tháng này" },
  { value: "last-month", label: "Tháng trước" },
] as const;
export type MeetingTimeFilter = (typeof MEETING_TIME_FILTERS)[number]["value"];

export function parseTimeFilter(value: string | null): MeetingTimeFilter | null {
  return MEETING_TIME_FILTERS.some((option) => option.value === value) ? (value as MeetingTimeFilter) : null;
}

/** Đầu ngày `YYYY-MM-DD` theo giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7, không đổi giờ theo mùa). */
const ictDayStart = (date: string) => new Date(`${date}T00:00:00+07:00`);

/**
 * Khoảng giờ họp của bộ lọc thời gian, tính theo ngày Việt Nam `today` (YYYY-MM-DD): tuần bắt đầu thứ Hai, `to` là mili giây
 * cuối cùng của khoảng (máy chủ lọc `startTime` từ `from` tới hết `to`).
 */
export function meetingTimeRange(filter: MeetingTimeFilter, today: string): { from: string; to: string } {
  const [year, month, day] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = (y: number, m: number) => `${y + Math.floor((m - 1) / 12)}-${pad(((m - 1) % 12 + 12) % 12 + 1)}-01`;
  let start: string;
  let end: string;
  if (filter === "today") {
    start = today;
    end = addCalendarDays(today, 1)!;
  } else if (filter === "week") {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    start = addCalendarDays(today, -((weekday + 6) % 7))!;
    end = addCalendarDays(start, 7)!;
  } else if (filter === "month") {
    start = monthStart(year, month);
    end = monthStart(year, month + 1);
  } else {
    start = monthStart(year, month - 1);
    end = monthStart(year, month);
  }
  return { from: ictDayStart(start).toISOString(), to: new Date(ictDayStart(end).getTime() - 1).toISOString() };
}

/** Hàng danh sách hoặc cuộc họp ở trang chi tiết: đủ để biết thao tác nào được phép. */
type MeetingActionSubject = Pick<MeetingRow, "status" | "availableActions">;

const can = (row: MeetingActionSubject, action: string) => row.availableActions.includes(action);

/** Bắt đầu họp (Đã mời → Đã họp): người tổ chức/chủ tọa, như nút ở trang chi tiết. */
export const canStartMeeting = (row: MeetingActionSubject) => row.status === "INVITED" && can(row, "meeting.update");

/** Hủy họp: người tổ chức/chủ tọa, chỉ khi chưa họp (đã họp thì giữ để còn biên bản). */
export const canCancelMeeting = (row: MeetingActionSubject) => (row.status === "DRAFT_AGENDA" || row.status === "INVITED") && can(row, "meeting.update");

/** Câu nhắc trong hộp xác nhận hủy họp (danh sách và trang chi tiết): outbox cuộc họp chưa gửi thông báo hủy. */
export const MEETING_CANCEL_NOTICE = "Hệ thống chưa tự báo cho người được mời, Thầy/Cô báo giúp nếu cần.";

export const meetingPath = (id: string) => `/meetings/${encodeURIComponent(id)}`;

export function meetingTimeRangeLabel(row: Pick<MeetingRow, "startTime" | "endTime">): string {
  const start = formatTime(row.startTime, "");
  const end = row.endTime ? formatTime(row.endTime, "") : "";
  return end ? `${start} – ${end}` : start;
}

/** Một dòng chữ để dán vào tin nhắn: tên · thứ, ngày · giờ · địa điểm (có thì mới ghi). */
export function meetingSummaryText(row: Pick<MeetingRow, "title" | "startTime" | "endTime" | "location">): string {
  return [row.title, `${formatWeekday(row.startTime)}, ${formatDisplayDate(row.startTime)}`, meetingTimeRangeLabel(row), row.location]
    .filter(Boolean)
    .join(" · ");
}

/** Bảng xuất Excel của các cuộc họp đã chọn, theo thứ tự trên màn hình. */
export function meetingCsvRows(rows: MeetingRow[]): string[][] {
  return [
    ["Cuộc họp", "Ngày", "Giờ", "Địa điểm", "Người tổ chức", "Đơn vị", "Thành phần", "Trạng thái"],
    ...rows.map((row) => [
      row.title,
      formatDisplayDate(row.startTime),
      meetingTimeRangeLabel(row),
      row.location ?? "",
      row.organizer?.name ?? "",
      row.unit?.name ?? "",
      String(row._count.participants),
      meetingStatus(row.status).label,
    ]),
  ];
}

/** `wide`: cột chỉ có từ màn hình máy tính bảng (điện thoại chỉ có Cuộc họp và Thời gian), chip của nó ẩn trên điện thoại. */
export const MEETING_COLUMNS = [
  { id: "location", label: "Địa điểm", wide: false },
  { id: "organizer", label: "Người tổ chức", wide: true },
  { id: "participants", label: "Thành phần", wide: true },
  { id: "status", label: "Trạng thái", wide: true },
] as const;
export type MeetingColumn = (typeof MEETING_COLUMNS)[number]["id"];

export const MEETING_SORT_LABELS: Record<MeetingSortField, string> = { startTime: "Giờ họp", createdAt: "Ngày tạo", title: "Tên" };
/** Chiều mặc định khi chọn một cột: tên A→Z, giờ họp và ngày tạo mới nhất trước (như máy chủ). */
export const defaultSortOrder = (field: MeetingSortField): "asc" | "desc" => (field === "title" ? "asc" : "desc");

export interface MeetingDisplayPrefs {
  columns: Record<MeetingColumn, boolean>;
  /** `null`: thứ tự mặc định của tab (sắp diễn ra gần nhất trước, các tab khác mới nhất trước). */
  sort: { field: MeetingSortField; order: "asc" | "desc" } | null;
}

export const DEFAULT_MEETING_DISPLAY: MeetingDisplayPrefs = {
  columns: { location: true, organizer: true, participants: true, status: true },
  sort: null,
};

export const isDefaultMeetingDisplay = (prefs: MeetingDisplayPrefs) =>
  prefs.sort === null && MEETING_COLUMNS.every((column) => prefs.columns[column.id]);

const DISPLAY_KEY = "qcet.meetings.display.v1";

/** Đọc tùy chọn đã lưu; hỏng, thiếu hay trình duyệt chặn lưu trữ thì dùng mặc định. */
export function readMeetingDisplay(): MeetingDisplayPrefs {
  try {
    const raw = JSON.parse(window.localStorage.getItem(DISPLAY_KEY) ?? "null") as Partial<MeetingDisplayPrefs> | null;
    if (!raw || typeof raw !== "object") return DEFAULT_MEETING_DISPLAY;
    const columns = { ...DEFAULT_MEETING_DISPLAY.columns };
    for (const column of MEETING_COLUMNS) {
      if (typeof raw.columns?.[column.id] === "boolean") columns[column.id] = raw.columns[column.id];
    }
    const sort =
      raw.sort && (MEETING_SORT_FIELDS as readonly string[]).includes(raw.sort.field) && (raw.sort.order === "asc" || raw.sort.order === "desc")
        ? { field: raw.sort.field, order: raw.sort.order }
        : null;
    return { columns, sort };
  } catch {
    return DEFAULT_MEETING_DISPLAY;
  }
}

export function writeMeetingDisplay(prefs: MeetingDisplayPrefs): void {
  try {
    if (isDefaultMeetingDisplay(prefs)) window.localStorage.removeItem(DISPLAY_KEY);
    else window.localStorage.setItem(DISPLAY_KEY, JSON.stringify(prefs));
  } catch {
    // Trình duyệt chặn lưu trữ: tùy chọn chỉ giữ trong lượt xem này
  }
}
