import type { Prisma } from "@prisma/client";
import {
  formatNotificationContent,
  getTriageTypes,
  type NotificationTriageTab,
  type QCETNotification,
} from "@/lib/notification-triage";

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
  document_returned: "Văn bản bị trả lại",
  document_rerouted: "Văn bản chuyển đơn vị",
  extension_requested: "Xin gia hạn",
  extension_decided: "Phản hồi gia hạn",
  progress: "Cập nhật",
  upload: "Tệp mới",
  created: "Tạo mới",
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
    // Thông báo hạn văn bản lưu dạng /documents?id=<id>; trang chi tiết là /documents/<id>.
    const docId = url.pathname === "/documents" ? url.searchParams.get("id") : null;
    return {
      href: docId ? `/documents/${encodeURIComponent(docId)}` : href,
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
    const docId = target.href.match(/^\/documents\/([^/?#]+)/)?.[1];
    if (docId) return `document:${decodeURIComponent(docId)}`;
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

/* ------------------------------------------------------------------ */
/* Truy vấn phía server                                                */
/* ------------------------------------------------------------------ */

export function encodeNotificationCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}|${id}`;
}

export function decodeNotificationCursor(
  cursor: string | null | undefined
): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  const sep = cursor.indexOf("|");
  if (sep <= 0) return null;
  const createdAt = new Date(cursor.slice(0, sep));
  const id = cursor.slice(sep + 1);
  if (Number.isNaN(createdAt.getTime()) || !id) return null;
  return { createdAt, id };
}

export interface NotificationWhereInput {
  userId: string;
  unreadOnly?: boolean;
  read?: boolean;
  category?: string;
  type?: string;
  triage?: NotificationTriageTab;
  q?: string;
  cursor?: string | null;
}

/** Tập lọc của danh sách; `withCursor=false` dùng để đếm tổng khớp bộ lọc. */
export function buildNotificationWhere(
  input: NotificationWhereInput,
  withCursor = true
): Prisma.NotificationWhereInput {
  const and: Prisma.NotificationWhereInput[] = [];

  if (input.triage && input.triage !== "all") {
    const types = getTriageTypes(input.triage);
    const variants = [...new Set([...types, ...types.map((t) => t.toUpperCase())])];
    const byType: Prisma.NotificationWhereInput = { type: { in: variants } };
    and.push(
      input.triage === "action_required"
        ? { OR: [byType, { category: { equals: "action", mode: "insensitive" } }] }
        : byType
    );
  }

  const q = input.q?.trim();
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { body: { contains: q, mode: "insensitive" } },
        { actorName: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const cursor = withCursor ? decodeNotificationCursor(input.cursor) : null;
  if (cursor) {
    and.push({
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ],
    });
  }

  return {
    userId: input.userId,
    ...(input.unreadOnly === true || input.read === false
      ? { isRead: false }
      : input.read === true
        ? { isRead: true }
        : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(input.type ? { type: input.type } : {}),
    ...(and.length ? { AND: and } : {}),
  };
}
