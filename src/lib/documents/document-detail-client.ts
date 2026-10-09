import type { DocumentItem } from "@/types/document";

export type DetailErrorKind = "forbidden" | "not_found" | "network" | "unknown";

export type DetailResult =
  | { ok: true; item: DocumentItem; availableActions: string[] }
  | { ok: false; kind: DetailErrorKind; message: string };

export const DETAIL_ERROR_MESSAGE: Record<DetailErrorKind, string> = {
  forbidden: "Bạn không có quyền xem văn bản này.",
  not_found: "Văn bản không tồn tại hoặc đã bị xóa.",
  network: "Lỗi kết nối máy chủ khi tải chi tiết văn bản.",
  unknown: "Không thể tải chi tiết văn bản.",
};

const fail = (kind: DetailErrorKind): DetailResult => ({ ok: false, kind, message: DETAIL_ERROR_MESSAGE[kind] });

/** Tải chi tiết văn bản từ `GET /api/documents/[id]` (server là nơi duy nhất quyết định quyền đọc). */
export async function fetchDocumentDetail(
  id: string,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<DetailResult> {
  const doFetch = options.fetchImpl ?? fetch;
  try {
    const response = await doFetch(`/api/documents/${encodeURIComponent(id)}`, { signal: options.signal, cache: "no-store" });
    if (response.status === 403) return fail("forbidden");
    if (response.status === 404) return fail("not_found");
    if (!response.ok) return fail("unknown");
    const json = await response.json();
    const item = (json?.data ?? json?.document ?? json) as DocumentItem | undefined;
    // Chỉ chấp nhận đúng văn bản đã yêu cầu: không bao giờ hiển thị nhầm văn bản khác
    if (!item?.id || item.id !== id) return fail("unknown");
    const actions = json?.availableActions ?? (item as { availableActions?: unknown }).availableActions;
    return { ok: true, item, availableActions: Array.isArray(actions) ? actions : [] };
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") throw error;
    return fail("network");
  }
}

export type DetailState =
  | { docId: null; status: "idle" }
  | { docId: string; status: "loading"; item: DocumentItem | null; availableActions: string[] }
  | { docId: string; status: "ready"; item: DocumentItem; availableActions: string[] }
  | { docId: string; status: "error"; kind: DetailErrorKind; message: string };

export type DetailAction =
  | { type: "select"; docId: string | null }
  | { type: "refresh"; docId: string }
  | { type: "result"; docId: string; result: DetailResult };

export const INITIAL_DETAIL_STATE: DetailState = { docId: null, status: "idle" };

/**
 * Máy trạng thái của `useDocumentDetail`. Kết quả của yêu cầu cũ (docId khác văn bản đang chọn)
 * bị bỏ; làm mới giữ lại dữ liệu cũ để không nháy trống.
 */
export function detailReducer(state: DetailState, action: DetailAction): DetailState {
  switch (action.type) {
    case "select":
      if (!action.docId) return INITIAL_DETAIL_STATE;
      if (state.docId === action.docId) return state;
      return { docId: action.docId, status: "loading", item: null, availableActions: [] };
    case "refresh": {
      if (state.docId !== action.docId) return state;
      const previous = state.status === "ready" ? state : null;
      return { docId: action.docId, status: "loading", item: previous?.item ?? null, availableActions: previous?.availableActions ?? [] };
    }
    case "result": {
      if (state.docId !== action.docId) return state;
      return action.result.ok
        ? { docId: action.docId, status: "ready", item: action.result.item, availableActions: action.result.availableActions }
        : { docId: action.docId, status: "error", kind: action.result.kind, message: action.result.message };
    }
  }
}
