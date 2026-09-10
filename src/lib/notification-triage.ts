import {
  CheckCircle2,
  Clock,
  FileText,
  AlertTriangle,
  Plus,
  Activity,
  Wifi,
  Bell,
  Check,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type NotificationTriageTab = "all" | "action_required" | "approvals" | "reminders";

export interface QCETNotification {
  id: string;
  actorName: string;
  actorRole?: string;
  action?: string;
  targetTitle?: string;
  timestamp: string;
  category: string;
  isRead: boolean;
  timeGroup?: "new" | "earlier";
  type: string;
  linkHref?: string;
  body?: string;
  title?: string;
  createdAt?: string | Date;
}

export interface AvatarStyle {
  bg: string;
  text: string;
  ring: string;
}

const AVATAR_PALETTES: AvatarStyle[] = [
  { bg: "bg-emerald-500/15", text: "text-emerald-700", ring: "ring-emerald-500/30" },
  { bg: "bg-blue-500/15", text: "text-blue-700", ring: "ring-blue-500/30" },
  { bg: "bg-purple-500/15", text: "text-purple-700", ring: "ring-purple-500/30" },
  { bg: "bg-amber-500/15", text: "text-amber-800", ring: "ring-amber-500/30" },
  { bg: "bg-teal-500/15", text: "text-teal-700", ring: "ring-teal-500/30" },
  { bg: "bg-rose-500/15", text: "text-rose-700", ring: "ring-rose-500/30" },
  { bg: "bg-indigo-500/15", text: "text-indigo-700", ring: "ring-indigo-500/30" },
  { bg: "bg-sky-500/15", text: "text-sky-700", ring: "ring-sky-500/30" },
  { bg: "bg-violet-500/15", text: "text-violet-700", ring: "ring-violet-500/30" },
  { bg: "bg-cyan-500/15", text: "text-cyan-800", ring: "ring-cyan-500/30" },
  { bg: "bg-orange-500/15", text: "text-orange-800", ring: "ring-orange-500/30" },
];

/**
 * Generates a stable hash number from any string.
 */
export function hashStringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Deterministic avatar helper: generates consistent avatar colors based on name or department hash.
 */
export function getDeterministicAvatarStyle(nameOrDept: string): AvatarStyle {
  if (!nameOrDept || !nameOrDept.trim()) {
    return {
      bg: "bg-primary/10",
      text: "text-primary",
      ring: "ring-primary/20",
    };
  }

  const clean = nameOrDept.trim().toLowerCase();

  // Neutral slate tone for system notifications
  if (clean.includes("hệ thống") || clean.includes("system") || clean === "qcet") {
    return {
      bg: "bg-slate-500/15",
      text: "text-slate-700",
      ring: "ring-slate-500/30",
    };
  }

  const hash = hashStringToNumber(clean);
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
}

/**
 * Extracts 2-letter uppercase initials from personnel or department name.
 */
export function getActorInitials(name: string): string {
  if (!name || !name.trim()) return "QC";
  // Remove academic titles (ThS., TS., PGS., GS., etc.)
  const cleanName = name.replace(/^(ThS\.|TS\.|PGS\.|GS\.|CN\.|KS\.)\s+/i, "").trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "QC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Action-required notification types:
 * ["assigned", "directive", "urgent", "TASK_ASSIGNED", "EXECUTIVE_DIRECTIVE"]
 */
const ACTION_REQUIRED_TYPES = new Set([
  "assigned",
  "directive",
  "urgent",
  "task_assigned",
  "executive_directive",
]);

/**
 * Approval notification types:
 * ["review", "review_requested", "deliverable_submitted", "dacum_step1_review", "DELIVERABLE_SUBMITTED", "DELIVERABLE_REVISION"]
 */
const APPROVAL_TYPES = new Set([
  "review",
  "review_requested",
  "deliverable_submitted",
  "dacum_step1_review",
  "deliverable_revision",
]);

/**
 * Reminder notification types:
 * ["deadline", "reminder", "deadline_warning_24h", "DEADLINE_WARNING_24H"]
 */
const REMINDER_TYPES = new Set([
  "deadline",
  "reminder",
  "deadline_warning_24h",
]);

/**
 * Filters notifications into one of the 4 triage tabs.
 */
export function filterNotificationsByTab(
  notifications: QCETNotification[],
  tab: NotificationTriageTab
): QCETNotification[] {
  if (tab === "all") {
    return notifications;
  }

  return notifications.filter((notif) => {
    const rawType = (notif.type || "").toLowerCase().trim();
    const rawCategory = (notif.category || "").toLowerCase().trim();
    const titleText = (notif.targetTitle || notif.title || "").toLowerCase();
    const bodyText = (notif.action || notif.body || "").toLowerCase();

    if (tab === "action_required") {
      return (
        ACTION_REQUIRED_TYPES.has(rawType) ||
        rawCategory === "action"
      );
    }

    if (tab === "approvals") {
      return APPROVAL_TYPES.has(rawType);
    }

    if (tab === "reminders") {
      return (
        REMINDER_TYPES.has(rawType) ||
        titleText.includes("hạn") ||
        titleText.includes("nhắc nhở") ||
        bodyText.includes("hạn") ||
        bodyText.includes("nhắc nhở")
      );
    }

    return true;
  });
}

export interface FormattedNotificationContent {
  actorName: string;
  actionText: string;
  targetTitle: string;
  directiveNote?: string;
  extraBadge?: string;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Helper to safely format notification text without word duplication glitch.
 * Prevents repeating actorName and targetTitle when both title and body contain them.
 */
export function formatNotificationContent(
  notification: Partial<QCETNotification> & {
    actorName?: string;
    action?: string;
    targetTitle?: string;
    body?: string;
    title?: string;
    type?: string;
  }
): FormattedNotificationContent {
  const actorName = (notification.actorName || "Hệ thống QCET").trim();
  const rawTitle = (notification.targetTitle || notification.title || "").trim();
  const rawBody = (notification.action || notification.body || "").trim();
  const type = (notification.type || "").toLowerCase().trim();

  // 1. Clean bracketed tags from targetTitle (e.g. "[GIAO VIỆC] Báo cáo..." -> "Báo cáo...")
  let cleanTitle = rawTitle.replace(/^\[(GIAO VIỆC|NỘP DUYỆT|ĐÃ DUYỆT|YÊU CẦU SỬA|SẮP HẾT HẠN|CHỈ ĐẠO BGH|THÔNG BÁO)\]\s*/i, "").trim();
  cleanTitle = cleanTitle.replace(/^["'“”«»]+|["'“”«»]+$/g, "").trim();

  let actionRemainder = rawBody;
  let extraBadge: string | undefined;
  let directiveNote: string | undefined;

  // 2. Strip duplicate actorName prefix from body if present
  // Handle variations: "ThS. Nguyễn Văn Hùng" vs "Nguyễn Văn Hùng"
  const cleanActor = actorName.replace(/^(ThS\.|TS\.|PGS\.|GS\.|CN\.|KS\.)\s+/i, "").trim();
  const actorRegex = new RegExp(`^(?:${escapeRegex(actorName)}|${escapeRegex(cleanActor)})\\s*[-:.–—]?\\s*`, "i");

  if (actorRegex.test(actionRemainder)) {
    actionRemainder = actionRemainder.replace(actorRegex, "").trim();
  }

  // 3. Extract Due Date badge if present (e.g. "Hạn: 30/09/2026" or ". Hạn: 30/09")
  const dueMatch = actionRemainder.match(/\.?\s*(Hạn:\s*[\d/]+(?:\s*[\d:]+)?)/i);
  if (dueMatch) {
    extraBadge = dueMatch[1].trim();
    actionRemainder = actionRemainder.replace(dueMatch[0], "").trim();
  }

  // 4. Check if actionRemainder contains the targetTitle inside quotes
  if (cleanTitle) {
    const titleRegex = new RegExp(`[-:.–—]?\\s*["'“”«»]${escapeRegex(cleanTitle)}["'“”«»]`, "i");
    if (titleRegex.test(actionRemainder)) {
      actionRemainder = actionRemainder.replace(titleRegex, "").trim();
    }
  }

  // Clean trailing punctuation safely
  actionRemainder = actionRemainder.replace(/[-:.–—]+$/, "").trim();

  // 5. Detect and format specialized types if body was empty or stripped
  let actionText = actionRemainder;

  if (type === "assigned" || type === "task_assigned") {
    if (!actionText || actionText.includes("giao việc") || actionText.includes("giao nhiệm vụ")) {
      actionText = "vừa giao nhiệm vụ";
    }
  } else if (type === "directive" || type === "executive_directive") {
    // Check if remaining body is a directive quotation (e.g. "Đồng ý chủ trương...")
    if (actionText.startsWith('"') || actionText.startsWith('“')) {
      directiveNote = actionText.replace(/^["'“”«»]+|["'“”«»]+$/g, "").trim();
      actionText = "đã ban hành ý kiến chỉ đạo:";
    } else if (!actionText) {
      actionText = "đã ban hành chỉ đạo điều hành về";
    }
  } else if (type === "deliverable_submitted") {
    if (!actionText) actionText = "đã nộp sản phẩm kết quả cần duyệt";
  } else if (type === "deliverable_revision") {
    if (!actionText) actionText = "yêu cầu chỉnh sửa sản phẩm";
  } else if (type === "deadline_warning_24h" || type === "deadline") {
    if (!actionText) actionText = "nhắc nhở sắp đến hạn hoàn thành (còn 24 giờ)";
    if (!extraBadge && dueMatch) extraBadge = dueMatch[1].trim();
  } else if (type === "completed") {
    if (!actionText) actionText = "đã hoàn thành";
  }

  // Fallback if still empty
  if (!actionText) {
    actionText = "vừa cập nhật";
  }

  return {
    actorName,
    actionText,
    targetTitle: cleanTitle || rawTitle,
    directiveNote,
    extraBadge,
  };
}

/**
 * Formats relative timestamp in Vietnamese.
 */
export function formatRelativeTime(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (isNaN(diffSec) || diffSec < 60) return "Vừa xong";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return date.toLocaleDateString("vi-VN");
}

/**
 * Classifies date into new (< 2 hours) or earlier.
 */
export function getTimeGroup(dateInput: string | Date): "new" | "earlier" {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  return isNaN(diffHours) || diffHours < 2 ? "new" : "earlier";
}

/**
 * Maps raw API/database notification record into typed QCETNotification.
 */
export function mapDbNotification(raw: any): QCETNotification {
  const dateVal = raw.createdAt ? new Date(raw.createdAt) : new Date();
  return {
    id: raw.id,
    actorName: raw.actorName || "Hệ thống QCET",
    action: raw.body || raw.action || "",
    targetTitle: raw.title || raw.targetTitle || "",
    timestamp: raw.timestamp || formatRelativeTime(dateVal),
    category: (raw.category || "QCET").toUpperCase(),
    isRead: Boolean(raw.isRead),
    timeGroup: raw.timeGroup || getTimeGroup(dateVal),
    type: raw.type || "completed",
    linkHref: raw.linkHref || "/",
    body: raw.body,
    title: raw.title,
    createdAt: dateVal,
  };
}

/**
 * Maps notification type to appropriate visual badge styling and icon.
 */
export function getTypeBadge(type: string): { bg: string; icon: LucideIcon } {
  const normalized = (type || "").toLowerCase().trim();
  switch (normalized) {
    case "completed":
      return {
        bg: "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30",
        icon: CheckCircle2,
      };
    case "progress":
      return {
        bg: "bg-blue-500/15 text-blue-600 border border-blue-500/30",
        icon: Clock,
      };
    case "upload":
      return {
        bg: "bg-purple-500/15 text-purple-600 border border-purple-500/30",
        icon: FileText,
      };
    case "review":
    case "review_requested":
    case "dacum_step1_review":
    case "deliverable_submitted":
    case "deliverable_revision":
      return {
        bg: "bg-amber-500/15 text-amber-700 border border-amber-500/30",
        icon: ShieldCheck,
      };
    case "created":
      return {
        bg: "bg-teal-500/15 text-teal-600 border border-teal-500/30",
        icon: Plus,
      };
    case "report":
      return {
        bg: "bg-indigo-500/15 text-indigo-600 border border-indigo-500/30",
        icon: Activity,
      };
    case "network":
      return {
        bg: "bg-sky-500/15 text-sky-600 border border-sky-500/30",
        icon: Wifi,
      };
    case "assigned":
    case "task_assigned":
      return {
        bg: "bg-blue-500/15 text-blue-700 border border-blue-500/30",
        icon: FileText,
      };
    case "directive":
    case "executive_directive":
      return {
        bg: "bg-rose-500/15 text-rose-700 border border-rose-500/30",
        icon: AlertTriangle,
      };
    case "deadline":
    case "reminder":
    case "deadline_warning_24h":
      return {
        bg: "bg-amber-500/15 text-amber-800 border border-amber-500/30",
        icon: Clock,
      };
    case "test":
      return {
        bg: "bg-purple-500/15 text-purple-700 border border-purple-500/30",
        icon: Activity,
      };
    default:
      return {
        bg: "bg-primary/15 text-primary border border-primary/30",
        icon: Bell,
      };
  }
}

// ============================================================================
// Mobile Actionable Inbox Helpers & Deep Link Resolver
// ============================================================================

export interface NotificationEntity {
  code: string;
  type: "task" | "document";
}

/**
 * Extracts entity code (task code or document number) from notification content or links.
 * Invariant: Entity codes are normalized and tabular.
 */
export function extractNotificationEntity(
  notif: Partial<QCETNotification> | {
    title?: string;
    body?: string;
    targetTitle?: string;
    action?: string;
    linkHref?: string;
    category?: string;
    type?: string;
  }
): NotificationEntity | null {
  const link = notif.linkHref || "";
  const title = (notif as any).targetTitle || notif.title || "";
  const body = (notif as any).action || notif.body || "";
  const combined = `${link} ${title} ${body}`;

  // 1. Explicit query parameter extraction
  if (link.includes("taskId=")) {
    const m = link.match(/taskId=([^&]+)/);
    if (m && m[1]) {
      return { code: decodeURIComponent(m[1]), type: "task" };
    }
  }
  if (link.includes("docId=")) {
    const m = link.match(/docId=([^&]+)/);
    if (m && m[1]) {
      return { code: decodeURIComponent(m[1]), type: "document" };
    }
  }
  if (link.includes("code=")) {
    const m = link.match(/code=([^&]+)/);
    if (m && m[1]) {
      const codeVal = decodeURIComponent(m[1]);
      if (/^NV/i.test(codeVal)) {
        return { code: codeVal.toUpperCase(), type: "task" };
      }
      return { code: codeVal, type: "document" };
    }
  }

  // 2. Task Code regex: e.g. NV-092, NV-2026-09-038
  const taskMatch = combined.match(/\b(NV(?:-\d+)+)\b/i);
  if (taskMatch) {
    return {
      code: taskMatch[1].toUpperCase(),
      type: "task",
    };
  }

  // 3. Document Number regex: e.g. 142/QĐ, 420/QĐ-CĐKTCN, 282/QĐ-UBND, 55/CV-SGDĐT
  const docMatch = combined.match(/\b(\d+\/(?:QĐ|QD|CV|TB|KH|BC|HD|HĐ|TTr|TT)(?:-[A-ZĐ_a-z0-9]+)*)\b/i);
  if (docMatch) {
    return {
      code: docMatch[1].toUpperCase(),
      type: "document",
    };
  }

  // 4. Secondary fallback: check link target path
  if (link.startsWith("/tasks")) {
    const lastPart = link.split("/").pop();
    if (lastPart && lastPart !== "tasks" && !lastPart.includes("?")) {
      return { code: decodeURIComponent(lastPart), type: "task" };
    }
  }
  if (link.startsWith("/documents")) {
    const lastPart = link.split("/").pop();
    if (lastPart && lastPart !== "documents" && !lastPart.includes("?")) {
      return { code: decodeURIComponent(lastPart), type: "document" };
    }
  }

  return null;
}

/**
 * Resolves an actionable deep link for a notification.
 * - Task: /tasks?taskId=xxx&scope=...
 * - Document: /documents?docId=xxx
 */
export function resolveActionableDeepLink(
  notif: Partial<QCETNotification> | {
    title?: string;
    body?: string;
    targetTitle?: string;
    action?: string;
    linkHref?: string;
    category?: string;
    type?: string;
  },
  defaultScope: "school" | "unit" | "my" = "school"
): string {
  const link = (notif.linkHref || "").trim();
  const entity = extractNotificationEntity(notif);

  // Link points to tasks
  if (link.startsWith("/tasks")) {
    try {
      const url = new URL(link, "http://localhost");
      const currentTaskId = url.searchParams.get("taskId") || url.searchParams.get("code");
      const currentScope = url.searchParams.get("scope") || defaultScope;

      const targetTaskId = currentTaskId || (entity?.type === "task" ? entity.code : null);
      if (targetTaskId) {
        url.searchParams.set("taskId", targetTaskId);
        url.searchParams.delete("code");
      }
      url.searchParams.set("scope", currentScope);
      return `${url.pathname}${url.search}`;
    } catch {
      // Ignore URL parse error
    }
  }

  // Link points to documents
  if (link.startsWith("/documents")) {
    try {
      const url = new URL(link, "http://localhost");
      const currentDocId =
        url.searchParams.get("docId") ||
        url.searchParams.get("code") ||
        url.searchParams.get("id");
      const targetDocId = currentDocId || (entity?.type === "document" ? entity.code : null);
      if (targetDocId) {
        url.searchParams.set("docId", targetDocId);
        url.searchParams.delete("code");
        url.searchParams.delete("id");
      }
      return `${url.pathname}${url.search}`;
    } catch {
      // Ignore URL parse error
    }
  }

  // If entity is detected but link is generic/absent
  if (entity?.type === "task") {
    return `/tasks?taskId=${encodeURIComponent(entity.code)}&scope=${defaultScope}`;
  }
  if (entity?.type === "document") {
    return `/documents?docId=${encodeURIComponent(entity.code)}`;
  }

  const category = ((notif.category as string) || "").toLowerCase();
  const type = ((notif.type as string) || "").toLowerCase();

  if (category.includes("văn bản") || type.includes("document")) {
    return "/documents";
  }
  if (category.includes("nhiệm vụ") || type.includes("task") || type.includes("deadline")) {
    return `/tasks?scope=${defaultScope}`;
  }

  return link && link !== "/" ? link : `/tasks?scope=${defaultScope}`;
}

export type NotificationDayGroup = "TODAY" | "EARLIER";

/**
 * Classifies a notification into "TODAY" ("HÔM NAY") or "EARLIER" ("TRƯỚC ĐÓ").
 */
export function getNotificationDayGroup(
  item: Partial<QCETNotification> | {
    createdAt?: string | Date;
    timestamp?: string;
    timeGroup?: string;
  }
): NotificationDayGroup {
  if (item.createdAt) {
    const itemDate =
      typeof item.createdAt === "string" ? new Date(item.createdAt) : item.createdAt;
    if (!isNaN(itemDate.getTime())) {
      const now = new Date();
      const isSameDay =
        itemDate.getFullYear() === now.getFullYear() &&
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getDate() === now.getDate();
      return isSameDay ? "TODAY" : "EARLIER";
    }
  }

  const text = (item.timestamp || "").toLowerCase();
  if (
    text.includes("phút") ||
    text.includes("giờ") ||
    text.includes("vừa xong") ||
    text.includes("hôm nay") ||
    item.timeGroup === "new"
  ) {
    return "TODAY";
  }

  return "EARLIER";
}

/**
 * Groups an array of notifications into TODAY and EARLIER.
 */
export function groupNotificationsByDay(
  notifications: QCETNotification[]
): { today: QCETNotification[]; earlier: QCETNotification[] } {
  const today: QCETNotification[] = [];
  const earlier: QCETNotification[] = [];

  for (const notif of notifications) {
    if (getNotificationDayGroup(notif) === "TODAY") {
      today.push(notif);
    } else {
      earlier.push(notif);
    }
  }

  return { today, earlier };
}

export type MobileNotificationFilter = "all" | "unread" | "action_required";

/**
 * Filters notifications on mobile inbox for:
 * [Tất cả] [Chưa đọc] [Cần xử lý]
 */
export function filterNotificationsMobile(
  notifications: QCETNotification[],
  filter: MobileNotificationFilter
): QCETNotification[] {
  if (filter === "unread") {
    return notifications.filter((n) => !n.isRead);
  }
  if (filter === "action_required") {
    return filterNotificationsByTab(notifications, "action_required");
  }
  return notifications;
}

