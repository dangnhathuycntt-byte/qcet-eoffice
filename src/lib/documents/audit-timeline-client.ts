import type { DocumentAuditApiResponse } from "@/types/document-audit";

export type AuditTimelineResult =
  | { ok: true; data: DocumentAuditApiResponse }
  | { ok: false; error: string; aborted?: boolean };

type FetchLike = (input: string, init?: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json">>;

const HTTP_ERRORS: Record<number, string> = {
  401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  403: "Bạn không có quyền xem lịch sử luân chuyển của văn bản này.",
  404: "Không tìm thấy lịch sử luân chuyển của văn bản này.",
};

const STEP_STATUSES = ["completed", "current", "pending", "rejected"];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
/** Trường tùy chọn: vắng mặt, null hoặc chuỗi. */
const isOptStr = (v: unknown) => v === undefined || v === null || typeof v === "string";

const STEP_OPTIONAL = ["actorName", "actorRole", "actorTitle", "actorAvatar", "timestamp", "notes", "departmentName", "assignedToName", "deadline"];
const LOG_OPTIONAL = ["actorRole", "actorTitle", "actorAvatar", "notes"];

function isStep(v: unknown): boolean {
  return (
    isObject(v) &&
    isStr(v.id) && isStr(v.key) && isStr(v.title) && isStr(v.subtitle) &&
    isNum(v.stepNumber) &&
    isStr(v.status) && STEP_STATUSES.includes(v.status) &&
    STEP_OPTIONAL.every((k) => isOptStr(v[k]))
  );
}

function isLog(v: unknown): boolean {
  return (
    isObject(v) &&
    isStr(v.id) && isStr(v.actionLabel) && isStr(v.actorName) && isStr(v.timestamp) &&
    LOG_OPTIONAL.every((k) => isOptStr(v[k]))
  );
}

/** Kiểm các trường mà giao diện thực sự đọc; không chuẩn hóa hay bổ sung nội dung. */
export function isTimelinePayload(value: unknown): value is DocumentAuditApiResponse {
  return (
    isObject(value) &&
    isNum(value.progressPercent) && isNum(value.completedCount) && isNum(value.totalSteps) &&
    Array.isArray(value.steps) && value.steps.every(isStep) &&
    Array.isArray(value.auditLogs) && value.auditLogs.every(isLog)
  );
}

/** Đọc lịch sử luân chuyển từ API. Thất bại trả lỗi, không dựng dữ liệu thay thế. `signal` để hủy khi đổi văn bản. */
export async function fetchDocumentAuditTimeline(
  documentId: string,
  fetchImpl: FetchLike = fetch,
  signal?: AbortSignal,
): Promise<AuditTimelineResult> {
  try {
    const res = await fetchImpl(`/api/documents/${encodeURIComponent(documentId)}/audit-logs`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal,
    });
    if (!res.ok) {
      return { ok: false, error: HTTP_ERRORS[res.status] ?? `Không thể tải lịch sử luân chuyển (HTTP ${res.status}).` };
    }
    const json: unknown = await res.json();
    const payload = isObject(json) && json.data ? json.data : json;
    if (!isTimelinePayload(payload)) {
      return { ok: false, error: "Dữ liệu lịch sử luân chuyển không hợp lệ." };
    }
    return { ok: true, data: payload };
  } catch {
    if (signal?.aborted) return { ok: false, error: "Đã hủy yêu cầu.", aborted: true };
    return { ok: false, error: "Không thể kết nối để tải lịch sử luân chuyển. Vui lòng thử lại." };
  }
}

export function isEmptyTimeline(data: DocumentAuditApiResponse): boolean {
  return data.steps.length === 0 && data.auditLogs.length === 0;
}
