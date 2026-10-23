import {
  formatNotificationContent,
  type QCETNotification,
} from "@qcet/shared/lib/notification-triage";
import { getDocumentHref } from "@qcet/shared/lib/documents/document-view-model";

const ICT_TIME_ZONE = "Asia/Ho_Chi_Minh";

const ictPartsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: ICT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function ictParts(date: Date) {
  const parts: Record<string, string> = {};
  for (const part of ictPartsFormatter.formatToParts(date)) parts[part.type] = part.value;
  return parts as { year: string; month: string; day: string; hour: string; minute: string };
}

function toValidDate(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  const date = typeof input === "string" ? new Date(input) : input;
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Thời gian rút gọn cho danh sách: "Vừa xong", "N phút", "N giờ", "N ngày" trong 7 ngày,
 * sau đó dd/MM (kèm năm khi khác năm hiện tại, theo múi giờ Asia/Ho_Chi_Minh).
 * Timestamp thiếu/lỗi trả về chuỗi rỗng; timestamp tương lai hiện ngày tuyệt đối.
 */
export function formatNotificationTime(
  input: string | Date | null | undefined,
  now: Date = new Date()
): string {
  const date = toValidDate(input);
  if (!date) return "";
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec >= -60 && diffSec < 60) return "Vừa xong";
  if (diffSec >= 60) {
    const min = Math.floor(diffSec / 60);
    if (min < 60) return `${min} phút`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `${hours} giờ`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày`;
  }
  const p = ictParts(date);
  const sameYear = p.year === ictParts(now).year;
  return sameYear ? `${p.day}/${p.month}` : `${p.day}/${p.month}/${p.year}`;
}

/** "dd/MM/yyyy HH:mm (GMT+7)" — thời gian tuyệt đối cho detail và mô tả accessible. */
export function formatNotificationAbsoluteTime(input: string | Date | null | undefined): string {
  const date = toValidDate(input);
  if (!date) return "";
  const p = ictParts(date);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute} (GMT+7)`;
}

const EVENT_LABELS: Record<string, string> = {
  assigned: "Giao nhiệm vụ",
  task_assigned: "Giao nhiệm vụ",
  directive: "Chỉ đạo",
  executive_directive: "Chỉ đạo",
  urgent: "Khẩn",
  review: "Chờ duyệt",
  review_requested: "Chờ duyệt",
  dacum_step1_review: "Chờ duyệt",
  deliverable_submitted: "Nộp sản phẩm",
  deliverable_revision: "Yêu cầu sửa",
  deadline: "Nhắc hạn",
  deadline_warning_24h: "Nhắc hạn",
  reminder: "Nhắc hạn",
  document_overdue: "Văn bản trễ hạn",
  document_expiring_soon: "Văn bản sắp đến hạn",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  mention: "Nhắc tên",
  declined: "Từ chối nhận việc",
  overdue: "Trễ hạn",
  review_pending: "Chờ duyệt lâu",
  escalation: "Cần xử lý",
  dossier_submit_deadline: "Hồ sơ sắp đến hạn nộp lưu",
  dossier_retention_expired: "Hồ sơ hết hạn bảo quản",
  dossier_disposal_proposed: "Đề nghị xét hủy hồ sơ",
  dossier_disposal_decided: "Quyết định xét hủy hồ sơ",
  submission_requested: "Tờ trình chờ duyệt",
  submission_decided: "Kết quả duyệt tờ trình",
  submission_return_requested: "Đề nghị trả lại tờ trình",
  submission_return_decided: "Phản hồi đề nghị trả lại",
  submission_consult: "Xin ý kiến",
  submission_consult_answered: "Ý kiến trả lời",
  document_returned: "Văn bản bị trả lại",
  document_delivered: "Văn bản gửi đến",
  document_rerouted: "Văn bản chuyển đơn vị",
  document_recalled: "Văn bản bị thu hồi",
  extension_requested: "Xin gia hạn",
  extension_decided: "Phản hồi gia hạn",
  unit_request: "Yêu cầu phối hợp",
  unit_request_decided: "Phản hồi phối hợp",
  progress: "Cập nhật",
  upload: "Tệp mới",
  created: "Tạo mới",
  welcome: "Chào mừng",
  assistant_briefing: "Bản tin sáng",
};

/** Nhãn ngắn của loại sự kiện; type chưa biết dùng nhãn trung tính. */
export function getNotificationEventLabel(type: string | null | undefined): string {
  return EVENT_LABELS[(type || "").toLowerCase().trim()] ?? "Thông báo";
}

export interface NotificationTarget {
  href: string;
  kind: "task" | "document" | "other";
  ctaLabel: string;
  kindLabel: string;
  taskId?: string;
}

/**
 * Xác thực liên kết thông báo: chỉ nhận đường dẫn nội bộ cụ thể (không phải "/" hay URL ngoài).
 * Không có đích hợp lệ thì trả null để UI không dựng CTA.
 */
export function resolveNotificationTarget(link: string | null | undefined): NotificationTarget | null {
  const raw = (link || "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  let url: URL;
  try {
    url = new URL(raw, "http://qcet.local");
  } catch {
    return null;
  }
  if (url.origin !== "http://qcet.local" || url.pathname === "/") return null;
  const href = `${url.pathname}${url.search}${url.hash}`;

  const taskFromPath = url.pathname.match(/^\/tasks\/([^/]+)$/)?.[1];
  const taskId = taskFromPath ? decodeURIComponent(taskFromPath) : url.searchParams.get("taskId") || undefined;
  if (url.pathname.startsWith("/tasks")) {
    return { href, kind: "task", ctaLabel: "Mở nhiệm vụ", kindLabel: "Nhiệm vụ", taskId };
  }
  if (url.pathname.startsWith("/documents")) {
    // Thông báo hạn văn bản lưu dạng /documents?id=<id>; mở thẳng Quick View của văn bản đó.
    const docId = url.pathname === "/documents" ? url.searchParams.get("id") : null;
    return {
      href: docId ? getDocumentHref(docId) : href,
      kind: "document",
      ctaLabel: "Mở văn bản",
      kindLabel: "Văn bản",
    };
  }
  return { href, kind: "other", ctaLabel: "Mở chi tiết", kindLabel: "Chi tiết" };
}

/** Tiêu đề hiển thị duy nhất cho list, header và detail (đã bỏ tiền tố [GIAO VIỆC]...). */
export function getNotificationDisplayTitle(notification: QCETNotification): string {
  return (
    formatNotificationContent(notification).targetTitle ||
    notification.title ||
    notification.targetTitle ||
    "Thông báo"
  ).trim();
}

export interface NotificationGroup {
  key: string;
  /** Sự kiện mới nhất, đại diện cho hàng. */
  latest: QCETNotification;
  /** Các sự kiện của cùng đối tượng, mới nhất trước. */
  items: QCETNotification[];
  unreadIds: string[];
  target: NotificationTarget | null;
}

function timeOf(n: QCETNotification): number {
  const date = toValidDate(n.createdAt ?? null);
  return date ? date.getTime() : 0;
}

/** Khóa nhóm theo đối tượng đích; thông báo không có đích đứng riêng. */
export function getNotificationGroupKey(notification: QCETNotification): string {
  const target = resolveNotificationTarget(notification.linkHref);
  if (target?.kind === "task" && target.taskId) return `task:${target.taskId}`;
  if (target?.kind === "document") {
    const docId = new URL(target.href, "http://local").searchParams.get("docId");
    if (docId) return `document:${docId}`;
  }
  return `notification:${notification.id}`;
}

/** Gom thông báo thành một hàng mỗi đối tượng, sắp theo sự kiện mới nhất. */
export function groupNotificationsByTarget(notifications: QCETNotification[]): NotificationGroup[] {
  const byKey = new Map<string, QCETNotification[]>();
  for (const n of notifications) {
    const key = getNotificationGroupKey(n);
    const bucket = byKey.get(key);
    if (bucket) {
      if (!bucket.some((existing) => existing.id === n.id)) bucket.push(n);
    } else {
      byKey.set(key, [n]);
    }
  }
  const compare = (a: QCETNotification, b: QCETNotification) =>
    timeOf(b) - timeOf(a) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

  const groups: NotificationGroup[] = [];
  for (const [key, items] of byKey) {
    items.sort(compare);
    groups.push({
      key,
      latest: items[0],
      items,
      unreadIds: items.filter((n) => !n.isRead).map((n) => n.id),
      target: resolveNotificationTarget(items[0].linkHref),
    });
  }
  return groups.sort((a, b) => compare(a.latest, b.latest));
}

/** Tham số trên đường dẫn đích: khối cần cuộn tới và tô sáng khi mở từ Hộp thư (như Notion), và bình luận cụ thể. */
export const NOTIFICATION_FOCUS_PARAM = "focus";
export const NOTIFICATION_COMMENT_PARAM = "comment";

/** Khối trên trang nhiệm vụ mang `data-notification-focus` tương ứng. */
export type NotificationFocus = "overview" | "comments" | "deliverables" | "approval" | "extension" | "unit-requests";

/**
 * Khối liên quan của từng loại thông báo nhiệm vụ. Loại không có khối riêng (giao việc, nhắc hạn, hủy, từ chối nhận…)
 * tô phần đầu nhiệm vụ (tên, trạng thái, hạn, người chủ trì). Thông báo văn bản, hồ sơ chỉ mở trang đích.
 */
const FOCUS_BY_TYPE: Record<string, NotificationFocus> = {
  mention: "comments",
  deliverable_submitted: "deliverables",
  deliverable_revision: "deliverables",
  completed: "deliverables",
  progress: "deliverables",
  review: "approval",
  review_requested: "approval",
  review_pending: "approval",
  dacum_step1_review: "approval",
  extension_requested: "extension",
  extension_decided: "extension",
  unit_request_decided: "unit-requests",
};

export function getNotificationFocus(type: string | null | undefined): NotificationFocus {
  return FOCUS_BY_TYPE[(type || "").toLowerCase().trim()] ?? "overview";
}

/** Mã nhiệm vụ dạng "NV-…" (đường dẫn cũ) không mở được /tasks/[id]; giữ nguyên đường dẫn gốc. */
const TASK_CODE_PATTERN = /^[A-Z]{1,4}-\d/i;
/** Trang con của Nhiệm vụ, không phải mã nhiệm vụ. */
const TASK_SUBROUTES = new Set(["unit-requests", "templates"]);

/**
 * Đường dẫn mở khi bấm thông báo trong khung Hộp thư. Nhiệm vụ mở thẳng `/tasks/<id>` kèm khối cần tô sáng:
 * `/tasks?taskId=` đi qua bảng danh sách, chỉ mở được nhiệm vụ đang tải và bỏ mất tham số. Không có đích hợp lệ thì null.
 */
export function getNotificationHref(notification: Pick<QCETNotification, "linkHref" | "type">): string | null {
  const target = resolveNotificationTarget(notification.linkHref);
  if (!target) return null;
  const taskId = target.kind === "task" ? target.taskId : undefined;
  if (!taskId || TASK_CODE_PATTERN.test(taskId) || TASK_SUBROUTES.has(taskId)) return target.href;
  const url = new URL(target.href, "http://qcet.local");
  const params = new URLSearchParams(url.search);
  params.delete("taskId");
  if (!params.has(NOTIFICATION_FOCUS_PARAM)) params.set(NOTIFICATION_FOCUS_PARAM, getNotificationFocus(notification.type));
  return `/tasks/${encodeURIComponent(taskId)}?${params.toString()}${url.hash}`;
}

export type NotificationTimeBucket = "today" | "yesterday" | "week" | "older";

export const NOTIFICATION_TIME_BUCKET_LABELS: Record<NotificationTimeBucket, string> = {
  today: "Hôm nay",
  yesterday: "Hôm qua",
  week: "7 ngày qua",
  older: "Cũ hơn",
};

function ictDayNumber(date: Date): number {
  const p = ictParts(date);
  return Math.floor(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)) / 86_400_000);
}

/** Nhóm thời gian của khung Hộp thư theo ngày lịch Asia/Ho_Chi_Minh; thiếu mốc hoặc mốc tương lai xếp vào Hôm nay. */
export function getNotificationTimeBucket(
  input: string | Date | null | undefined,
  now: Date = new Date()
): NotificationTimeBucket {
  const date = toValidDate(input);
  if (!date) return "older";
  const days = ictDayNumber(now) - ictDayNumber(date);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return "week";
  return "older";
}

/** Trích lời nhắn kèm thông báo (bình luận, lý do, ý kiến) cho dòng phụ; câu mặc định kiểu "vừa giao việc" thì bỏ. */
export function getNotificationSnippet(notification: QCETNotification): string {
  const { actionText } = formatNotificationContent(notification);
  const quoted = actionText.match(/^[:\s]*["“]([\s\S]+?)["”]?$/);
  return quoted ? quoted[1].trim() : "";
}

/** Số chưa đọc ở nơi có chỗ (tab Chưa đọc, hàng Hộp thư trong ngăn kéo): không hiện khi 0, quá 99 ghi "99+" (M3: tối đa bốn ký tự; "9+" làm 30 thư trông như 10). */
export function formatUnreadBadge(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "";
  return count > 99 ? "99+" : String(Math.floor(count));
}
