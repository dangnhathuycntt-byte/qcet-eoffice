/**
 * Push Notification Preferences Management
 * Handles user preferences for notification topics both locally and synchronized with the server.
 */

export interface PushPreferences {
  taskAssigned: boolean;
  taskReview: boolean;
  deadlineReminder: boolean;
  documentDirective: boolean;
  /** Yêu cầu gia hạn và kết quả xử lý (T-06). */
  taskExtension: boolean;
  /** Từ chối nhận việc (T-06). */
  taskDecline: boolean;
  /** Yêu cầu phối hợp liên đơn vị và kết quả (T-06). */
  unitRequest: boolean;
}

export type PushTopic =
  | "task_assigned"
  | "task_review"
  | "deadline_reminder"
  | "document_directive"
  | "task_extension"
  | "task_decline"
  | "unit_request";

export interface PushTopicMeta {
  id: PushTopic;
  title: string;
  description: string;
}

export const PUSH_TOPICS: readonly PushTopicMeta[] = [
  {
    id: "task_assigned",
    title: "Nhiệm vụ được giao mới",
    description: "Nhận thông báo tức thì khi bạn được chỉ định làm người chủ trì hoặc phối hợp thực hiện nhiệm vụ mới.",
  },
  {
    id: "task_review",
    title: "Yêu cầu phê duyệt sản phẩm",
    description: "Nhận thông báo khi cán bộ gửi sản phẩm chờ duyệt hoặc có yêu cầu chỉnh sửa, bổ sung hồ sơ.",
  },
  {
    id: "deadline_reminder",
    title: "Cảnh báo hạn chót 24 giờ",
    description: "Nhắc nhở tự động trước khi nhiệm vụ hoặc công việc đến hạn xử lý trong vòng 24 giờ.",
  },
  {
    id: "document_directive",
    title: "Ý kiến chỉ đạo văn bản",
    description: "Nhận thông báo khi Ban Giám hiệu hoặc Lãnh đạo đơn vị ban hành ý kiến chỉ đạo, giao việc xử lý văn bản.",
  },
  {
    id: "task_extension",
    title: "Yêu cầu gia hạn nhiệm vụ",
    description: "Nhận thông báo khi có yêu cầu gia hạn cần bạn quyết định hoặc khi yêu cầu của bạn được trả lời.",
  },
  {
    id: "task_decline",
    title: "Từ chối nhận việc",
    description: "Nhận thông báo khi người thực hiện từ chối nhận nhiệm vụ bạn đã giao.",
  },
  {
    id: "unit_request",
    title: "Phối hợp liên đơn vị",
    description: "Nhận thông báo khi có đề nghị đơn vị bạn cử người phối hợp, hoặc khi đề nghị của bạn được trả lời.",
  },
] as const;

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  taskAssigned: true,
  taskReview: true,
  deadlineReminder: true,
  documentDirective: true,
  taskExtension: true,
  taskDecline: true,
  unitRequest: true,
};

export const PUSH_PREFS_STORAGE_PREFIX = "qcet_push_prefs_v1";

export function getPushPreferencesStorageKey(userId?: string | null): string {
  return userId ? `${PUSH_PREFS_STORAGE_PREFIX}:${userId}` : `${PUSH_PREFS_STORAGE_PREFIX}:anonymous`;
}

export function getDefaultPushPreferences(): PushPreferences {
  return { ...DEFAULT_PUSH_PREFERENCES };
}

export function loadLocalPushPreferences(userId?: string | null): PushPreferences {
  if (typeof localStorage === "undefined") {
    return getDefaultPushPreferences();
  }

  try {
    const raw = localStorage.getItem(getPushPreferencesStorageKey(userId));
    if (!raw) return getDefaultPushPreferences();
    const parsed = JSON.parse(raw);
    return {
      taskAssigned: typeof parsed.taskAssigned === "boolean" ? parsed.taskAssigned : true,
      taskReview: typeof parsed.taskReview === "boolean" ? parsed.taskReview : true,
      deadlineReminder: typeof parsed.deadlineReminder === "boolean" ? parsed.deadlineReminder : true,
      documentDirective: typeof parsed.documentDirective === "boolean" ? parsed.documentDirective : true,
      taskExtension: typeof parsed.taskExtension === "boolean" ? parsed.taskExtension : true,
      taskDecline: typeof parsed.taskDecline === "boolean" ? parsed.taskDecline : true,
      unitRequest: typeof parsed.unitRequest === "boolean" ? parsed.unitRequest : true,
    };
  } catch {
    return getDefaultPushPreferences();
  }
}

export function saveLocalPushPreferences(
  preferences: PushPreferences,
  userId?: string | null
): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(
      getPushPreferencesStorageKey(userId),
      JSON.stringify(preferences)
    );
  } catch (err) {
    console.error("Failed to save local push preferences:", err);
  }
}

export function mapNotificationTypeToTopic(typeOrEvent: string): PushTopic | null {
  const normalized = typeOrEvent.toUpperCase();
  // Loại thông báo riêng của nhiệm vụ (T-06) xét trước vì tên có thể chứa "ASSIGN"/"REVIEW".
  if (normalized.includes("EXTENSION")) return "task_extension";
  if (normalized.includes("DECLINE")) return "task_decline";
  if (normalized.includes("UNIT_REQUEST")) return "unit_request";
  if (normalized === "TASK_ASSIGNED" || normalized.includes("ASSIGN")) {
    return "task_assigned";
  }
  if (
    normalized === "TASK_REVIEW" ||
    normalized === "DELIVERABLE_SUBMITTED" ||
    normalized === "DELIVERABLE_REVISION" ||
    normalized === "DELIVERABLE_APPROVED" ||
    normalized.includes("REVIEW") ||
    normalized.includes("DELIVERABLE")
  ) {
    return "task_review";
  }
  if (
    normalized === "DEADLINE_REMINDER" ||
    normalized === "DEADLINE_WARNING_24H" ||
    normalized.includes("DEADLINE")
  ) {
    return "deadline_reminder";
  }
  if (
    normalized === "DOCUMENT_DIRECTIVE" ||
    normalized === "EXECUTIVE_DIRECTIVE" ||
    normalized.includes("DIRECTIVE")
  ) {
    return "document_directive";
  }
  return null;
}

export function isTopicEnabled(
  preferences: PushPreferences,
  topicOrType: PushTopic | string
): boolean {
  if (topicOrType in preferences) {
    return Boolean(preferences[topicOrType as keyof PushPreferences]);
  }

  const mappedTopic = mapNotificationTypeToTopic(topicOrType);
  if (!mappedTopic) return true; // Default allow unmapped or system notifications

  switch (mappedTopic) {
    case "task_assigned":
      return preferences.taskAssigned;
    case "task_review":
      return preferences.taskReview;
    case "deadline_reminder":
      return preferences.deadlineReminder;
    case "document_directive":
      return preferences.documentDirective;
    case "task_extension":
      return preferences.taskExtension;
    case "task_decline":
      return preferences.taskDecline;
    case "unit_request":
      return preferences.unitRequest;
    default:
      return true;
  }
}

export async function fetchServerPushPreferences(): Promise<PushPreferences | null> {
  try {
    const res = await fetch("/api/notifications/push", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.preferences) {
      return {
        taskAssigned: Boolean(data.preferences.taskAssigned ?? true),
        taskReview: Boolean(data.preferences.taskReview ?? true),
        deadlineReminder: Boolean(data.preferences.deadlineReminder ?? true),
        documentDirective: Boolean(data.preferences.documentDirective ?? true),
        taskExtension: Boolean(data.preferences.taskExtension ?? true),
        taskDecline: Boolean(data.preferences.taskDecline ?? true),
        unitRequest: Boolean(data.preferences.unitRequest ?? true),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function syncServerPushPreferences(
  preferences: PushPreferences
): Promise<boolean> {
  try {
    const res = await fetch("/api/notifications/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
