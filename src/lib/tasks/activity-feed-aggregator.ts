/**
 * Activity Feed Aggregator & Consolidation Engine
 *
 * Phân biệt rõ ràng giữa:
 * 1. Autosave: Cơ chế lưu dữ liệu nền thường xuyên (debounced) tránh mất mát dữ liệu.
 * 2. Audit Trail (Backend History): Bản ghi chi tiết đầy đ���, bất biến phục vụ kiểm toán.
 * 3. Activity Feed (Giao diện người dùng): Dòng thời gian mạch lạc, thông minh, thân thiện.
 *
 * Quy tắc gộp (Consolidation Invariants):
 * - Gộp các thao tác chỉnh sửa văn bản liên tiếp (Tiêu đề, Mô tả) của cùng một người trên cùng nhiệm vụ.
 * - Sử dụng ngưỡng nghỉ (inactivity threshold) mặc định là 60 giây (có thể cấu hình).
 * - KHÔNG gộp xuyên qua thao tác của người khác (người khác chen ngang).
 * - KHÔNG gộp xuyên qua các hành động nghiệp vụ (đổi trạng thái, phân công, thời hạn, báo cáo, tài liệu, bình luận).
 * - Chống trùng lặp (Deduplication) khi có sự cố retry hoặc nhiều lần lưu có cùng dấu vết.
 */

export interface RawAuditLogItem {
  id: string;
  action: string;
  timestamp: string;
  actorName?: string;
  actorId?: string;
  description?: string;
  [key: string]: any;
}

export interface ConsolidatedActivityItem extends RawAuditLogItem {
  count: number;
  firstTimestamp: string;
  lastTimestamp: string;
  isConsolidated: boolean;
  rawEvents: RawAuditLogItem[];
}

/** Danh sách các action chỉnh sửa văn bản liên tục có thể được gộp theo đợt */
export const CONSOLIDATABLE_TEXT_ACTIONS = new Set([
  "UPDATE_DESCRIPTION",
  "UPDATE_TITLE",
  "EDIT_DESCRIPTION",
  "EDIT_TITLE",
]);

/** Danh sách các hành động nghiệp vụ then chốt - tuyệt đối KHÔNG được gộp và đóng vai trò là rào cản (barrier) */
export const BUSINESS_BARRIER_ACTIONS = new Set([
  "NOT_STARTED",
  "IN_PROGRESS",
  "WAITING_APPROVAL",
  "COMPLETED",
  "CANCELLED",
  "NEEDS_REVIEW",
  "TASK_STATUS_CHANGED",
  "TASK_APPROVED",
  "TASK_REJECTED",
  "TASK_ASSIGNED",
  "UPDATE_DUE_DATE",
  "UPDATE_START_DATE",
  "TASK_DEADLINE_CHANGED",
  "UPDATE_PROGRESS",
  "SUBMIT_RESULT",
  "DELIVERABLE_UPLOADED",
  "DELIVERABLE_APPROVED",
  "COMMENT",
  "DIRECTIVE",
]);

/**
 * Kiểm tra xem một action có phải là thao tác chỉnh sửa văn bản liên tục có thể gộp hay không
 */
export function isConsolidatableAction(action: string, description?: string): boolean {
  if (CONSOLIDATABLE_TEXT_ACTIONS.has(action)) return true;
  if (!action) return false;
  // Fallback kiểm tra mô tả nếu action generic
  const desc = (description || "").toLowerCase();
  if (action === "TASK_UPDATED" && (desc.includes("mô tả") || desc.includes("tiêu đề"))) {
    return true;
  }
  return false;
}

/**
 * Xác định phân loại trường sửa đổi ("description" | "title" | "other")
 */
export function getEditCategory(action: string, description?: string): string {
  if (action === "UPDATE_DESCRIPTION" || action === "EDIT_DESCRIPTION") return "description";
  if (action === "UPDATE_TITLE" || action === "EDIT_TITLE") return "title";
  const desc = (description || "").toLowerCase();
  if (desc.includes("mô tả")) return "description";
  if (desc.includes("tiêu đề") || desc.includes("tên nhiệm vụ")) return "title";
  return action;
}

/**
 * Kiểm tra 2 sự kiện có thể được gộp vào cùng một đợt sửa đổi hay không
 */
export function canConsolidate(
  current: RawAuditLogItem,
  previous: RawAuditLogItem,
  thresholdMs: number = 60000
): boolean {
  // 1. Phải là action chỉnh sửa văn bản liên tục
  if (!isConsolidatableAction(current.action, current.description)) return false;
  if (!isConsolidatableAction(previous.action, previous.description)) return false;

  // 2. Phải cùng phân loại trường sửa đổi (không gộp mô tả chung với tiêu đề)
  const catCurrent = getEditCategory(current.action, current.description);
  const catPrevious = getEditCategory(previous.action, previous.description);
  if (catCurrent !== catPrevious) return false;

  // 3. Phải cùng người thao tác (actorName hoặc actorId)
  const actor1 = (current.actorId || current.actorName || "").trim().toLowerCase();
  const actor2 = (previous.actorId || previous.actorName || "").trim().toLowerCase();
  if (!actor1 || !actor2 || actor1 !== actor2) return false;

  // 4. Khoảng cách thời gian phải nằm trong ngưỡng nghỉ cho phép
  const t1 = new Date(current.timestamp).getTime();
  const t2 = new Date(previous.timestamp).getTime();
  if (isNaN(t1) || isNaN(t2)) return false;

  const diffMs = Math.abs(t1 - t2);
  return diffMs <= thresholdMs;
}

/**
 * Tạo mô tả gộp thân thiện với người dùng
 */
export function formatConsolidatedDescription(
  baseDescription: string,
  action: string,
  count: number
): string {
  if (count <= 1) return baseDescription;

  const category = getEditCategory(action, baseDescription);
  if (category === "description") {
    return `Cập nhật mô tả nhiệm vụ (${count} lần chỉnh sửa liên tiếp)`;
  }
  if (category === "title") {
    return `Cập nhật tiêu đề nhiệm vụ (${count} lần chỉnh sửa)`;
  }
  return `${baseDescription} (${count} lần lưu)`;
}

/**
 * Gộp danh sách audit events thành feed hoạt động thông minh (Consolidated Feed)
 * Hỗ trợ danh sách sắp xếp theo thứ tự mới nhất đứng trư���c (mặc định) hoặc cũ nhất trước.
 *
 * @param events Danh sách sự kiện thô (từ database hoặc state)
 * @param thresholdMs Ngưỡng nghỉ giữa các lần sửa (mặc định 60 giây)
 * @returns Danh sách hoạt động đã gộp gọn gàng
 */
export function consolidateActivityFeed(
  events: RawAuditLogItem[],
  thresholdMs: number = 60000
): ConsolidatedActivityItem[] {
  if (!Array.isArray(events) || events.length === 0) return [];

  // 1. Chống trùng lặp hoàn toàn (Deduplication) khi retry hoặc cùng id/timestamp sát sạt
  const deduplicated: RawAuditLogItem[] = [];
  const seenKeys = new Set<string>();

  for (const evt of events) {
    if (!evt) continue;
    // Khóa định danh duy nhất dựa trên action + actor + timestamp tương đối (trong 1 giây) + description
    const tsSec = evt.timestamp ? Math.floor(new Date(evt.timestamp).getTime() / 1000) : 0;
    const actor = (evt.actorId || evt.actorName || "").trim();
    const key = `${evt.action}|${actor}|${tsSec}|${evt.description || ""}`;

    // Nếu id trùng hoặc thông điệp trùng trong cùng 1 giây (retry) -> bỏ qua
    if (seenKeys.has(key) || seenKeys.has(evt.id)) {
      continue;
    }
    seenKeys.add(key);
    if (evt.id) seenKeys.add(evt.id);
    deduplicated.push(evt);
  }

  if (deduplicated.length === 0) return [];

  // 2. Thuật toán gom cụm (Clustering)
  const result: ConsolidatedActivityItem[] = [];

  for (const evt of deduplicated) {
    if (result.length === 0) {
      result.push({
        ...evt,
        count: 1,
        firstTimestamp: evt.timestamp,
        lastTimestamp: evt.timestamp,
        isConsolidated: false,
        rawEvents: [evt],
      });
      continue;
    }

    const lastGroup = result[result.length - 1];

    // Kiểm tra xem sự kiện hiện tại có thể gộp vào nhóm gần nhất không
    if (canConsolidate(evt, lastGroup, thresholdMs)) {
      lastGroup.count += 1;
      lastGroup.isConsolidated = true;
      lastGroup.rawEvents.push(evt);

      // Cập nhật timestamp bao quát
      const groupStart = new Date(lastGroup.firstTimestamp).getTime();
      const groupEnd = new Date(lastGroup.lastTimestamp).getTime();
      const currentT = new Date(evt.timestamp).getTime();

      if (!isNaN(currentT)) {
        if (isNaN(groupStart) || currentT < groupStart) {
          lastGroup.firstTimestamp = evt.timestamp;
        }
        if (isNaN(groupEnd) || currentT > groupEnd) {
          lastGroup.lastTimestamp = evt.timestamp;
        }
      }

      // Cập nhật mô tả hiển thị thân thiện
      lastGroup.description = formatConsolidatedDescription(
        lastGroup.rawEvents[0].description || lastGroup.action,
        lastGroup.action,
        lastGroup.count
      );
    } else {
      // Bắt đầu một nhóm mới (barrier hoặc khác người hoặc vượt ngưỡng thời gian)
      result.push({
        ...evt,
        count: 1,
        firstTimestamp: evt.timestamp,
        lastTimestamp: evt.timestamp,
        isConsolidated: false,
        rawEvents: [evt],
      });
    }
  }

  return result;
}
